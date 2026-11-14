import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { listingSlugBlockedByOwners } from './listingSlugAllocation.ts';

Deno.test('listingSlugBlockedByOwners: free when nobody owns it', () => {
  assertEquals(
    listingSlugBlockedByOwners({
      liveOwnerId: null,
      redirectOwnerId: null,
    }),
    false
  );
});

Deno.test('listingSlugBlockedByOwners: live owner blocks other listings', () => {
  assertEquals(
    listingSlugBlockedByOwners({
      liveOwnerId: 'prop-a',
      redirectOwnerId: null,
      excludeListingId: 'prop-b',
    }),
    true
  );
});

Deno.test('listingSlugBlockedByOwners: same listing may keep its live slug', () => {
  assertEquals(
    listingSlugBlockedByOwners({
      liveOwnerId: 'prop-a',
      redirectOwnerId: null,
      excludeListingId: 'prop-a',
    }),
    false
  );
});

Deno.test('listingSlugBlockedByOwners: redirect reserved for another listing blocks', () => {
  assertEquals(
    listingSlugBlockedByOwners({
      liveOwnerId: null,
      redirectOwnerId: 'prop-old',
      excludeListingId: 'prop-new',
    }),
    true
  );
});

Deno.test('listingSlugBlockedByOwners: same listing may reclaim its redirected slug', () => {
  assertEquals(
    listingSlugBlockedByOwners({
      liveOwnerId: null,
      redirectOwnerId: 'prop-a',
      excludeListingId: 'prop-a',
    }),
    false
  );
});

Deno.test('listingSlugBlockedByOwners: create with no exclude still blocked by redirect', () => {
  assertEquals(
    listingSlugBlockedByOwners({
      liveOwnerId: null,
      redirectOwnerId: 'prop-a',
    }),
    true
  );
});
