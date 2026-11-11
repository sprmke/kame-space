/**
 * Canonical public origin for every SEO surface (canonical link, `og:url`, sitemap `<loc>`,
 * robots `Sitemap:`, JSON-LD `url`, `llms.txt`).
 *
 * Never derive these from the request host: `www.kamespace.com`, Vercel previews and the
 * legacy `kamehomes.space` domain all serve the same pages, and self-canonicalizing each one
 * splits ranking signals.
 *
 * Pure and dependency-free (no `@/` imports) so the Vercel middleware bundle can resolve it
 * and the SPA can share it.
 */

/** Apex production origin. The only origin that may appear in SEO output. */
export const PRODUCTION_SITE_ORIGIN = 'https://kamespace.com';

/** Hosts that serve the app but must never be canonical. */
export const NON_CANONICAL_HOSTS: readonly string[] = [
  'www.kamespace.com',
  'app.kamespace.com',
  'kamehomes.space',
  'www.kamehomes.space',
  'app.kamehomes.space',
];

/** Trim whitespace and trailing slashes; return null when the value is not a usable origin. */
export function normalizeOrigin(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Canonical origin for SEO output.
 *
 * `configured` is `VITE_PUBLIC_SITE_ORIGIN` (UI) or the same value read from the middleware
 * env. Anything unusable falls back to the apex, so a stale deploy can never publish a
 * preview host as the canonical origin.
 */
export function resolveSiteOrigin(configured?: string | null): string {
  return normalizeOrigin(configured) ?? PRODUCTION_SITE_ORIGIN;
}

/**
 * Absolute canonical URL for a path: query string and hash dropped, trailing slash removed
 * (except for `/`). A path that is already absolute keeps only its pathname.
 */
export function canonicalUrlFor(origin: string, pathname: string): string {
  const base = origin.replace(/\/+$/, '');
  let path = pathname;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      path = '/';
    }
  }

  const queryIndex = path.search(/[?#]/);
  if (queryIndex >= 0) path = path.slice(0, queryIndex);
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return `${base}${path === '' ? '/' : path}`;
}
