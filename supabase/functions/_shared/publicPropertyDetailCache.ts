/**
 * In-isolate cache for the anonymous `get-public-property` response.
 *
 * The detail payload is the heaviest public read (about fifteen queries) and is identical
 * for every anonymous viewer, so it is cached per isolate. Production readiness PR-131 /
 * issue #183: the listing detail median was 12 s at 50 concurrent visitors with no cache.
 *
 * Freshness: keyed by the `property` catalog version (bumped by listing, price, review and
 * development writes) and capped by a short TTL, because the payload also reads contact
 * info, badges and page config that the version does not track. 30 s is below the 60 s
 * `max-age` the response already advertises, so it adds no new staleness for a browser.
 *
 * Never route host preview (`preview` / `embed`) through here: it can include an inactive
 * listing. A missing or unpublished listing (`null`) is never stored.
 */

import type { PublicPropertyDetailDto } from './publicPropertyService.ts';
import {
  listingCacheKey,
  peekListingCache,
  withListingCache,
  type ListingCacheOptions,
} from './publicListingCache.ts';

export const PROPERTY_DETAIL_CACHE_TTL_MS = 30_000;

const OPTIONS: ListingCacheOptions = {
  families: ['property'],
  ttlMs: PROPERTY_DETAIL_CACHE_TTL_MS,
  skipNull: true,
};

/** One key per request shape. A slug and an id for the same listing are separate entries. */
export function propertyDetailCacheKey(lookup: { slug?: string | null; id?: string | null }) {
  return listingCacheKey('property-detail', {
    id: lookup.id ?? null,
    slug: lookup.slug ?? null,
  });
}

export async function peekPublicPropertyDetail(lookup: {
  slug?: string | null;
  id?: string | null;
}): Promise<PublicPropertyDetailDto | null> {
  const peek = await peekListingCache<PublicPropertyDetailDto | null>(
    propertyDetailCacheKey(lookup),
    OPTIONS
  );
  return peek.hit ? peek.value : null;
}

export function loadPublicPropertyDetailCached(
  lookup: { slug?: string | null; id?: string | null },
  load: () => Promise<PublicPropertyDetailDto | null>
): Promise<PublicPropertyDetailDto | null> {
  return withListingCache(propertyDetailCacheKey(lookup), OPTIONS, load);
}
