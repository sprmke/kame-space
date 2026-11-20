import type { AdminTabKey, AdminTabScope } from '@/features/dashboard/bookings/lib/adminTabForRoute';

const STORAGE_KEY = 'kame-admin-tab-memory-v1';

type MemoryMap = Record<string, string>;

function scopeBucket(scope: AdminTabScope, basePath: string): string {
  return `${scope}:${basePath}`;
}

function readAll(): MemoryMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MemoryMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: MemoryMap) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function entryKey(scope: AdminTabScope, basePath: string, tab: AdminTabKey): string {
  return `${scopeBucket(scope, basePath)}:${tab}`;
}

/** Remember the deepest screen for a tab within this session. */
export function rememberAdminTabPath(
  scope: AdminTabScope,
  basePath: string,
  tab: AdminTabKey,
  pathname: string
): void {
  const map = readAll();
  map[entryKey(scope, basePath, tab)] = pathname;
  writeAll(map);
}

/** Last path for a tab, or null to use the tab root. */
export function recallAdminTabPath(
  scope: AdminTabScope,
  basePath: string,
  tab: AdminTabKey
): string | null {
  return readAll()[entryKey(scope, basePath, tab)] ?? null;
}

/** Clear memory for one tab (after second re-tap pops to root). */
export function clearAdminTabPath(scope: AdminTabScope, basePath: string, tab: AdminTabKey): void {
  const map = readAll();
  delete map[entryKey(scope, basePath, tab)];
  writeAll(map);
}
