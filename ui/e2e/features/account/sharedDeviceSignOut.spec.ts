import { expect, test } from '@playwright/test';

import { SUPABASE_AUTH_STORAGE_KEY } from '../../shared/ids';
import { installGuestFavoritesMocks } from './shared/guestFavoritesHarness';

/**
 * Shared-device sign-out proof (production-readiness checklist 21, item 3 / PR-015).
 *
 * Sign-out must leave nothing a second person on the same device can read: the auth session,
 * the persisted query cache (operator PII) and the PWA Cache Storage. This seeds the same
 * stores the PWA owns, signs out through the real UI, and asserts each one is empty. An
 * unrelated origin cache must survive, so the purge is not a blanket wipe.
 *
 * The seeded IndexedDB connection is kept open on purpose. `purgeOfflineState` clears the
 * object store (the real removal) and also asks to delete the database, which the app itself
 * documents as blocked while idb-keyval holds a connection. Opening a new connection while
 * that delete is queued would hang, so the test reads through the connection it already has.
 */

const SEEDED_VIEWER_KEY = 'gfm-rq-user-seeded-viewer';
const SEEDED_VALUE = JSON.stringify({
  clientState: { queries: [{ queryKey: ['bookings'], state: { data: 'tenant-secret' } }] },
});

type SignOutState = {
  authToken: string | null;
  cacheKeys: string[];
  hasProbe: boolean;
  queryKeys: string[];
  queryValues: string[];
};

/** Read the stores the PWA owns, without creating the cache it just deleted. */
async function readState(page: import('@playwright/test').Page): Promise<SignOutState> {
  return page.evaluate(async (authKey) => {
    const cacheKeys = await caches.keys();
    const hasProbe = (await caches.has('gfm-api'))
      ? Boolean(await (await caches.open('gfm-api')).match('/offline-probe'))
      : false;
    const query = await new Promise<{ keys: string[]; values: string[] }>((resolve) => {
      const read = (db: IDBDatabase) => {
        const tx = db.transaction('keyval', 'readonly');
        const store = tx.objectStore('keyval');
        const keys = store.getAllKeys();
        const values = store.getAll();
        tx.oncomplete = () =>
          resolve({
            keys: keys.result as string[],
            values: (values.result as unknown[]).map((value) => String(value)),
          });
        tx.onerror = () => resolve({ keys: ['<error>'], values: [] });
      };
      const existing = (window as unknown as { __signOutTestDb?: IDBDatabase }).__signOutTestDb;
      if (existing) {
        read(existing);
        return;
      }
      const request = indexedDB.open('gfm-query-cache');
      request.onupgradeneeded = () => request.result.createObjectStore('keyval');
      request.onblocked = () => resolve({ keys: ['<blocked>'], values: [] });
      request.onsuccess = () => read(request.result);
      request.onerror = () => resolve({ keys: ['<error>'], values: [] });
    });
    return {
      authToken: window.localStorage.getItem(authKey),
      cacheKeys,
      hasProbe,
      queryKeys: query.keys,
      queryValues: query.values,
    };
  }, SUPABASE_AUTH_STORAGE_KEY);
}

test.describe('@ci @critical shared-device sign-out', () => {
  test('clears the session, the persisted query cache and PWA cache storage', async ({ page }) => {
    await installGuestFavoritesMocks(page);
    await page.route('**/auth/v1/logout**', (route) =>
      route.fulfill({ status: 204, contentType: 'text/plain', body: '' })
    );

    await page.goto('/account/settings');
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible({ timeout: 20_000 });

    // Seed the same stores the PWA owns. The auth session comes from the harness. Seeding
    // after mount is deliberate: the purge only runs on sign-out, and the initial restore has
    // already read its own key by now.
    await page.evaluate(
      async ({ viewerKey, value }) => {
        const appCache = await caches.open('gfm-api');
        await appCache.put(
          '/offline-probe',
          new Response('cached', { headers: { 'content-type': 'text/plain' } })
        );
        await caches.open('other-app');
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('gfm-query-cache');
          request.onupgradeneeded = () => request.result.createObjectStore('keyval');
          request.onblocked = () => reject(new Error('seeded database is blocked'));
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('keyval', 'readwrite');
            tx.objectStore('keyval').put(value, viewerKey);
            tx.oncomplete = () => {
              // Keep the connection open so later reads are not queued behind the delete.
              (window as unknown as { __signOutTestDb?: IDBDatabase }).__signOutTestDb = db;
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          request.onerror = () => reject(request.error);
        });
      },
      { viewerKey: SEEDED_VIEWER_KEY, value: SEEDED_VALUE }
    );

    // Prove the stores really held data before sign-out; otherwise the assertions are vacuous.
    const before = await readState(page);
    expect(before.authToken).toBeTruthy();
    expect(before.cacheKeys).toEqual(expect.arrayContaining(['gfm-api', 'other-app']));
    expect(before.hasProbe).toBe(true);
    expect(before.queryKeys).toContain(SEEDED_VIEWER_KEY);
    expect(before.queryValues.join(' ')).toContain('tenant-secret');

    await page.getByRole('button', { name: 'Log out' }).click();

    // Sign-out leaves the account route immediately, before the network call resolves.
    await expect(page).toHaveURL('/');
    await expect
      .poll(async () => (await readState(page)).authToken, { timeout: 10_000 })
      .toBeNull();
    await expect
      .poll(
        async () => {
          const state = await readState(page);
          return {
            appCaches: state.cacheKeys.filter(
              (key) => key.startsWith('gfm-') || key.startsWith('workbox-')
            ),
            queryKeys: state.queryKeys,
            leaked: state.queryValues.join(' ').includes('tenant-secret'),
          };
        },
        { timeout: 10_000 }
      )
      .toEqual({ appCaches: [], queryKeys: [], leaked: false });

    // An unrelated origin cache is not ours to delete.
    expect(await page.evaluate(() => caches.has('other-app'))).toBe(true);
  });
});
