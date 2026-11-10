/**
 * SEO primitives: site constants, description truncation, HTML/JSON escaping and the public
 * title builder.
 *
 * Split out of `seoMeta.ts` on purpose. `pageTitle.ts` and `usePageMeta.ts` live in the entry
 * bundle (every route needs a title), while the schema builders and description templates in
 * `seoMeta.ts` are only needed by lazy pages and the edge middleware. Keeping the primitives
 * here keeps the route registry and JSON-LD builders out of the initial chunk.
 *
 * Pure and dependency-free (no `@/` imports): the middleware bundle resolves it by relative
 * path, and it is re-exported from `seoMeta.ts` so callers can keep one import.
 */

export const SITE_NAME = 'Kame Space';
export const DEFAULT_SOCIAL_IMAGE = '/brand/kame-space-social-f5.png';
export const DEFAULT_DESCRIPTION =
  'Book condos, homes, and parking across the Philippines. Browse by place, check dates, and reserve online.';
export const MAX_DESCRIPTION_LENGTH = 160;

export type SeoMeta = {
  title: string;
  description: string;
  /** Absolute canonical URL (no query string). */
  canonicalUrl: string;
  /** Absolute image URL for link previews. */
  image?: string | null;
  /** Alt text for the share image. */
  imageAlt?: string | null;
  /** Known share-image dimensions, emitted so previews never letterbox oddly. */
  imageWidth?: number | null;
  imageHeight?: number | null;
  type?: 'website' | 'article';
  /** One entity, or several rendered as a single `@graph`. */
  jsonLd?: Record<string, unknown> | ReadonlyArray<Record<string, unknown>> | null;
  noindex?: boolean;
};

export function truncateDescription(text: string, max = MAX_DESCRIPTION_LENGTH): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export const TITLE_SEPARATOR = ' | ';
/** Search results truncate around here; longer titles lose the tail, not the brand. */
export const MAX_TITLE_LENGTH = 60;

/**
 * Public page title, brand last: `{Page} | Kame Space`.
 *
 * The brand suffix is dropped first when the page part is long, because the page words
 * carry the query. Never emits a trailing separator.
 */
export function buildPageTitle(page: string, siteName: string = SITE_NAME): string {
  const clean = page.replace(/\s+/g, ' ').trim();
  if (!clean) return siteName;
  if (!siteName) return truncateTitle(clean, MAX_TITLE_LENGTH);

  const withBrand = `${clean}${TITLE_SEPARATOR}${siteName}`;
  if (withBrand.length <= MAX_TITLE_LENGTH) return withBrand;
  if (clean.length <= MAX_TITLE_LENGTH) return clean;
  return truncateTitle(clean, MAX_TITLE_LENGTH);
}

/** Cut on a word boundary, hard-cut only when a single word overflows. */
function truncateTitle(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.55 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}


/** Locale of the public site. Every page is Philippine English. */
export const OG_LOCALE = 'en_PH';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON for a <script type="application/ld+json"> body (no `</script>` breakout). */
export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
