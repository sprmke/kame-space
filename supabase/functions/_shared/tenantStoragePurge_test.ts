import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  GUEST_ASSET_BUCKETS,
  propertyStoragePurgeTargets,
  purgeStorageTargets,
  removeStoragePrefix,
  type TenantStorageClient,
} from './tenantStoragePurge.ts';

Deno.test('property targets cover media, marketing and every guest-PII bucket', () => {
  const targets = propertyStoragePurgeTargets({
    propertyId: 'prop-1',
    orgId: 'org-1',
    conversationIds: ['conv-1'],
  });
  const buckets = new Set(targets.map((target) => target.bucket));
  for (const bucket of GUEST_ASSET_BUCKETS) {
    assertEquals(buckets.has(bucket), true, `${bucket} missing from purge targets`);
  }
  assertEquals(buckets.has('property-media'), true);
  assertEquals(buckets.has('marketing-media'), true);
  assertEquals(buckets.has('listing-authorization-assets'), true);
  assertEquals(buckets.has('guest-chat-attachments'), true);

  const guest = targets.filter((target) => (GUEST_ASSET_BUCKETS as readonly string[]).includes(target.bucket));
  assertEquals(guest.length, GUEST_ASSET_BUCKETS.length);
  for (const target of guest) assertEquals(target.prefix, 'prop-1/');

  assertEquals(
    targets.some(
      (target) =>
        target.bucket === 'listing-authorization-assets' &&
        target.prefix === 'org/org-1/property/prop-1/'
    ),
    true
  );
  assertEquals(
    targets.some(
      (target) => target.bucket === 'guest-chat-attachments' && target.prefix === 'org-1/conv-1/'
    ),
    true
  );
});

/** A fake storage client: `tree` maps a directory to entries (folders have no id). */
function fakeStorage(tree: Record<string, { name: string; id?: string | null }[]>) {
  const removed: Record<string, string[]> = {};
  const client: TenantStorageClient = {
    storage: {
      from(bucket: string) {
        return {
          list: async (path: string) => ({ data: tree[`${bucket}|${path}`] ?? [], error: null }),
          remove: async (paths: string[]) => {
            removed[bucket] = [...(removed[bucket] ?? []), ...paths];
            return { error: null };
          },
        };
      },
    },
  };
  return { client, removed };
}

Deno.test('removeStoragePrefix walks nested folders and removes files only', async () => {
  const { client, removed } = fakeStorage({
    'valid-ids|prop-1': [
      { name: 'file-a.jpg', id: '1' },
      { name: 'booking-1', id: null },
    ],
    'valid-ids|prop-1/booking-1': [{ name: 'file-b.jpg', id: '2' }],
  });
  await removeStoragePrefix(client, 'valid-ids', 'prop-1/');
  assertEquals(removed['valid-ids'].sort(), ['prop-1/booking-1/file-b.jpg', 'prop-1/file-a.jpg']);
});

Deno.test('removeStoragePrefix is best effort and never throws on a list error', async () => {
  let calls = 0;
  const client: TenantStorageClient = {
    storage: {
      from: () => ({
        list: async () => {
          calls += 1;
          return { data: null, error: { message: 'boom' } };
        },
        remove: async () => ({ error: null }),
      }),
    },
  };
  await removeStoragePrefix(client, 'payment-receipts', 'prop-1/');
  assertEquals(calls, 1);
});

Deno.test('purgeStorageTargets visits every target', async () => {
  const visited: string[] = [];
  const client: TenantStorageClient = {
    storage: {
      from(bucket: string) {
        return {
          list: async (path: string) => {
            visited.push(`${bucket}|${path}`);
            return { data: [], error: null };
          },
          remove: async () => ({ error: null }),
        };
      },
    },
  };
  await purgeStorageTargets(client, [
    { bucket: 'property-media', prefix: 'prop-1/' },
    { bucket: 'valid-ids', prefix: 'prop-1/' },
  ]);
  assertEquals(visited, ['property-media|prop-1', 'valid-ids|prop-1']);
});
