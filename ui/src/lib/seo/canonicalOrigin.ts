/**
 * Browser-side canonical origin.
 *
 * `siteOrigin.ts` stays pure so the Vercel middleware bundle can share it; this module is the
 * one place that reads `import.meta.env`. Use it for canonical links, `og:url` and JSON-LD
 * `url` so no page ever falls back to `window.location.origin`.
 */

import { canonicalUrlFor, resolveSiteOrigin } from '@/lib/seo/siteOrigin';

export function siteOrigin(): string {
  return resolveSiteOrigin(import.meta.env.VITE_CANONICAL_APP_ORIGIN);
}

/** Absolute canonical URL for a path, on the configured origin. */
export function absoluteCanonicalUrl(pathname: string): string {
  return canonicalUrlFor(siteOrigin(), pathname);
}
