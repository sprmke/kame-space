/**
 * Durable rate limiting for public GET (and optional read) edge functions.
 * Reads `platform_settings.public_rate_limit_per_min` with a compiled-in default.
 */

import { getPublicRateLimitPerMin } from './platformSettingsCache.ts';
import { identityFromRequest, rateLimitGate, rateLimitGateInMemory } from './rateLimit.ts';

export type PublicRateLimitOptions = {
  /** Cap below the platform ceiling for sensitive endpoints (PII, tokens). */
  maxPerMin?: number;
  windowSec?: number;
};

/**
 * Gate for anonymous public reads. Keys by client IP (or authenticated user when passed).
 * Returns a CORS-headed 429 Response, or null when the caller may proceed.
 */
export async function publicGetRateLimitGate(
  req: Request,
  scope: string,
  options: PublicRateLimitOptions = {},
  user?: { id?: string | null } | null
): Promise<Response | null> {
  const platformLimit = await getPublicRateLimitPerMin();
  const limit = Math.max(1, Math.min(platformLimit, options.maxPerMin ?? platformLimit));
  const windowSec = options.windowSec ?? 60;

  return rateLimitGate(req, {
    scope,
    identity: identityFromRequest(req, user),
    limit,
    windowSec,
  });
}

/**
 * Gate for a public read answered from an in-isolate cache, with no database work. Counts
 * in memory so a hit does not pay for the durable counter write. Anything that misses the
 * cache must still go through `publicGetRateLimitGate`.
 */
export async function publicCachedGetRateLimitGate(
  req: Request,
  scope: string,
  user?: { id?: string | null } | null
): Promise<Response | null> {
  const limit = Math.max(1, await getPublicRateLimitPerMin());
  return rateLimitGateInMemory(req, {
    scope: `${scope}:cached`,
    identity: identityFromRequest(req, user),
    limit,
    windowSec: 60,
  });
}
