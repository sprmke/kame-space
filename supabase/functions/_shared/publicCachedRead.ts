/**
 * Rate-limit + cache for anonymous list reads (production readiness PR-131 / issue #183).
 *
 * Every public GET used to pay a durable `bump_rate_limit` database write before it looked
 * at the cache, so a cached answer still cost a write and a round trip, and a single hot
 * visitor serialized on one counter row. Order here is:
 *
 *   hit  -> count in memory (no I/O), answer from the isolate cache
 *   miss -> durable counter (a real quota, shared across isolates), then compute and store
 *
 * Anything that would reach the database is still metered durably. A bypassed read (for
 * example one filtered by dates) never hits the cache, so it always takes the durable gate.
 */

import {
  peekListingCache,
  withListingCache,
  type ListingCacheOptions,
} from './publicListingCache.ts';
import { publicCachedGetRateLimitGate, publicGetRateLimitGate } from './publicEndpointRateLimit.ts';

export type CachedPublicRead<T> = { limited: Response } | { value: T };

export async function cachedPublicListingRead<T>(
  req: Request,
  scope: string,
  key: string,
  options: ListingCacheOptions,
  compute: () => Promise<T>
): Promise<CachedPublicRead<T>> {
  const peek = await peekListingCache<T>(key, options);
  if (peek.hit) {
    const burst = await publicCachedGetRateLimitGate(req, scope);
    return burst ? { limited: burst } : { value: peek.value };
  }
  const limited = await publicGetRateLimitGate(req, scope);
  if (limited) return { limited };
  return { value: await withListingCache(key, options, compute) };
}
