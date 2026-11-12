/**
 * sitemap.xml builder for the public guest site.
 *
 * URLs: static marketing pages, every ACTIVE property / development / parking detail page,
 * every place browse page (`/{family}/in/:place`), and a development's properties / parking
 * sub-pages once they list something. Above MAX_URLS_PER_SITEMAP the root becomes a sitemap
 * index pointing at `?part=N` files (protocol limit is 50,000 URLs).
 */

export const MAX_URLS_PER_SITEMAP = 45_000;

export const STATIC_SITEMAP_PATHS = [
  '/',
  '/properties',
  '/developments',
  '/parkings',
  '/for-hosts',
  '/for-hosts/pricing',
  '/about',
  '/contact',
  '/support',
  '/terms',
  '/privacy',
  '/cookies',
] as const;

/**
 * Date the page copy was last reviewed. Deliberately a fixed date per route, never the build
 * time: Google stops trusting `lastmod` when it always equals today. Bump the date here and in
 * `ui/src/lib/seo/publicRoutes.ts#lastReviewed` (the registry) in the same change as the copy;
 * `check:seo-routes` fails when the two disagree.
 */
export const STATIC_SITEMAP_LASTMOD: Record<string, string> = {
  '/': '2026-11-13',
  '/properties': '2026-11-13',
  '/developments': '2026-11-13',
  '/parkings': '2026-11-13',
  '/for-hosts': '2026-11-13',
  '/for-hosts/pricing': '2026-11-13',
  '/about': '2026-11-13',
  '/contact': '2026-11-13',
  '/support': '2026-11-13',
  '/terms': '2026-11-12',
  '/privacy': '2026-11-12',
  '/cookies': '2026-11-12',
};

export type SitemapEntry = { path: string; lastmod?: string | null };

const FAMILY_PATH = {
  property: 'properties',
  development: 'developments',
  parking: 'parkings',
} as const;

export type SitemapFamily = keyof typeof FAMILY_PATH;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function listingPath(family: SitemapFamily, slug: string): string {
  return `/${FAMILY_PATH[family]}/${encodeURIComponent(slug)}`;
}

export function placePath(family: SitemapFamily, placeSlug: string): string {
  return `/${FAMILY_PATH[family]}/in/${encodeURIComponent(placeSlug)}`;
}

/**
 * A development's units or parking. Only listed once the sub-page has at least one listing,
 * because an empty list page is a thin duplicate of the development detail page.
 */
export function developmentSubPath(slug: string, segment: 'properties' | 'parking'): string {
  return `/developments/${encodeURIComponent(slug)}/${segment}`;
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

export function buildUrlset(origin: string, entries: SitemapEntry[]): string {
  const body = entries
    .map((entry) => {
      const loc = `<loc>${escapeXml(`${origin}${entry.path}`)}</loc>`;
      const lastmod = isoDate(entry.lastmod);
      return `  <url>${loc}${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildSitemapIndex(origin: string, parts: number): string {
  const body = Array.from(
    { length: parts },
    (_, i) => `  <sitemap><loc>${escapeXml(`${origin}/sitemap.xml?part=${i + 1}`)}</loc></sitemap>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}
