import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import { OUTBOX_DB_NAME } from '@/pwa/shared';

/**
 * Durable queue of mutations made while offline (or that failed the network).
 * The sync engine (`syncEngine.ts`) drains it FIFO when connectivity returns.
 */
export type OutboxItem = {
  id: string;
  /** Domain label for UI + query invalidation, e.g. `booking-transition`. */
  kind: string;
  /** Human-readable one-liner for the Sync Center. */
  label: string;
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Headers minus Authorization — a fresh token is attached at send time. */
  headers: Record<string, string>;
  body: string;
  idempotencyKey: string;
  /** TanStack Query keys (roots) to invalidate once this item lands. */
  invalidateKeys: string[];
  createdAt: number;
  attempts: number;
  status: 'pending' | 'failed';
  lastError?: string;
};

interface OutboxDB extends DBSchema {
  mutations: {
    key: string;
    value: OutboxItem;
    indexes: { 'by-createdAt': number };
  };
}

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null;

function db(): Promise<IDBPDatabase<OutboxDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OutboxDB>(OUTBOX_DB_NAME, 1, {
      upgrade(database) {
        const store = database.createObjectStore('mutations', { keyPath: 'id' });
        store.createIndex('by-createdAt', 'createdAt');
      },
    }).then((database) => {
      const drop = () => {
        if (dbPromise) dbPromise = null;
      };
      // A blocked delete (Clear offline data) closes this handle. Drop it so the
      // next call reopens instead of hanging on a dead connection.
      database.addEventListener('versionchange', () => {
        database.close();
        drop();
      });
      database.addEventListener('close', drop);
      return database;
    });
    // Do not cache a failed open: Safari reports "unable to open database file on disk"
    // when storage is briefly unavailable, and every later call must be able to retry.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/**
 * `InvalidStateError: ... connection is closing` happens when a transaction starts on a
 * handle that `releaseOutboxConnection` (or a blocked delete) just closed. Drop the cached
 * handle and retry once on a fresh connection; any other failure is the caller's to handle.
 */
async function withDb<T>(run: (database: IDBPDatabase<OutboxDB>) => Promise<T>): Promise<T> {
  const attempt = async () => run(await db());
  try {
    return await attempt();
  } catch (error) {
    const name = error && typeof error === 'object' ? (error as { name?: unknown }).name : '';
    const message = error instanceof Error ? error.message : '';
    if (name !== 'InvalidStateError' || !/clos(e|ing)/i.test(message)) throw error;
    dbPromise = null;
    return attempt();
  }
}

/** Close the cached handle so a following `deleteDatabase` is not blocked. */
export async function releaseOutboxConnection(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (!pending) return;
  try {
    (await pending).close();
  } catch {
    // already closed or the open failed
  }
}

export async function outboxAdd(
  item: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts' | 'status'>
): Promise<OutboxItem> {
  const full: OutboxItem = {
    ...item,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
  };
  await withDb((database) => database.put('mutations', full));
  return full;
}

export async function outboxList(): Promise<OutboxItem[]> {
  return withDb((database) => database.getAllFromIndex('mutations', 'by-createdAt'));
}

export async function outboxRemove(id: string): Promise<void> {
  await withDb((database) => database.delete('mutations', id));
}

export async function outboxUpdate(id: string, patch: Partial<OutboxItem>): Promise<void> {
  await withDb(async (database) => {
    const existing = await database.get('mutations', id);
    if (!existing) return;
    await database.put('mutations', { ...existing, ...patch });
  });
}

export async function outboxClear(): Promise<void> {
  await withDb((database) => database.clear('mutations'));
}

export async function outboxCount(): Promise<number> {
  return withDb((database) => database.count('mutations'));
}
