/**
 * SEO metadata shared by the SPA (`usePageMeta`) and the Vercel middleware that serves
 * crawler-ready HTML (`ui/middleware.ts`).
 *
 * Pure and dependency-free (no `@/` imports): the middleware bundle resolves it by
 * relative path.
 */

import {
  AI_CRAWLER_USER_AGENTS,
  ROBOTS_DISALLOW,
} from './publicRoutes';
import { PRODUCTION_SITE_ORIGIN } from './siteOrigin';

export { ROBOTS_DISALLOW };

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
  jsonLd?: Record<string, unknown> | null;
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

/**
 * Strip anything a meta description must not carry: HTML, Markdown syntax, URLs, emails,
 * phone numbers and emoji runs. Host descriptions are free text.
 */
export function sanitizeMetaText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~#>|]+/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\S+@\S+\.\S+/g, ' ')
    .replace(/\+?\d[\d\s()-]{7,}\d/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type ListingTitleInput = {
  name: string;
  unitType?: string | null;
  city?: string | null;
  place?: string | null;
};

/** `{Name}, {Unit type} in {City}`, dropping whichever part is missing. */
export function propertyTitle(input: ListingTitleInput): string {
  const name = input.name.trim();
  const kind = input.unitType?.trim();
  const city = (input.city ?? input.place)?.trim();
  if (kind && city) return `${name}, ${kind} in ${city}`;
  if (kind) return `${name}, ${kind}`;
  if (city) return `${name} in ${city}`;
  return name;
}

/** `{Name} parking in {Place}`. */
export function parkingTitle(input: ListingTitleInput): string {
  const place = (input.place ?? input.city)?.trim();
  return place ? `${input.name.trim()} parking in ${place}` : `${input.name.trim()} parking`;
}

/** `{Name}, {City} condos and parking`. */
export function developmentTitle(input: ListingTitleInput): string {
  const city = (input.city ?? input.place)?.trim();
  return city
    ? `${input.name.trim()}, ${city} condos and parking`
    : `${input.name.trim()} condos and parking`;
}

/** `Condos and homes for rent in {Place}` and its family variants. */
export function placeTitle(family: 'property' | 'parking' | 'development', place: string): string {
  const label = place.trim();
  if (family === 'parking') return `Parking for rent in ${label}`;
  if (family === 'development') return `Condos and parking in ${label}`;
  return `Condos and homes for rent in ${label}`;
}

/** `{Host name} stays and parking`. */
export function hostTitle(name: string): string {
  return `${name.trim()} stays and parking`;
}

export type ListingDescriptionInput = {
  name: string;
  unitType?: string | null;
  city?: string | null;
  guests?: number | null;
  bedrooms?: number | null;
  amenities?: readonly string[];
  priceFrom?: number | null;
  hostDescription?: string | null;
};

/**
 * Meta description for a listing. Host copy wins when it is usable; otherwise a data
 * fallback built from the fields the page already shows. Missing parts are skipped, never
 * rendered as gaps or "undefined".
 */
export function listingDescription(input: ListingDescriptionInput, max = MAX_DESCRIPTION_LENGTH): string {
  const host = sanitizeMetaText(input.hostDescription);
  if (host.length >= 70) return truncateDescription(host, max);

  const kind = input.unitType?.trim();
  const place = input.city?.trim();
  const head = [kind, place ? `in ${place}` : null].filter(Boolean).join(' ');
  const parts: string[] = [`${input.name.trim()}${head ? `: ${head}` : ''}`];

  if (input.guests && input.guests > 0) parts.push(`sleeps ${input.guests}`);
  if (input.bedrooms && input.bedrooms > 0) {
    parts.push(`${input.bedrooms} ${input.bedrooms === 1 ? 'bedroom' : 'bedrooms'}`);
  }
  const amenities = (input.amenities ?? []).map((item) => sanitizeMetaText(item)).filter(Boolean).slice(0, 2);
  if (amenities.length > 0) parts.push(amenities.join(' and '));

  let text = `${parts.join('. ')}.`;
  if (input.priceFrom && input.priceFrom > 0) {
    text += ` From PHP ${Math.round(input.priceFrom)} per night. Check dates and book online.`;
  } else {
    text += ' Check dates and book online.';
  }
  if (text.length < 70 && host) text = `${host} ${text}`;
  return truncateDescription(text, max);
}

/** `{count} condos and homes in {Place}, from PHP {min}/night.` */
export function placeDescription(input: {
  family: 'property' | 'parking' | 'development';
  place: string;
  count: number;
  priceFrom?: number | null;
}): string {
  const noun =
    input.family === 'parking'
      ? 'parking slots'
      : input.family === 'development'
        ? 'developments'
        : 'stays';
  const count = Math.max(input.count, 1);
  const head = `${count} ${noun} in ${input.place.trim()}`;
  const price =
    input.priceFrom && input.priceFrom > 0
      ? `, from PHP ${Math.round(input.priceFrom)} per night`
      : '';
  return truncateDescription(`${head}${price}. Check dates and book online.`);
}

/**
 * Lowest nightly rate across a card list. Accepts any card shape because the three families
 * name the field differently (`price`, `ratePerNight`, `nightlyRate`). Returns null when no
 * card carries a usable number.
 */
export function minNightlyRate(rows: ReadonlyArray<unknown>): number | null {
  let min: number | null = null;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    for (const key of ['price', 'ratePerNight', 'nightlyRate']) {
      const value = record[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
      if (min == null || value < min) min = value;
      break;
    }
  }
  return min;
}

/** `{Host name} lists {n} stays and {m} parking slots on Kame Space.` */
export function hostDescription(input: {
  name: string;
  stays: number;
  parking: number;
  tagline?: string | null;
  description?: string | null;
}): string {
  const host = sanitizeMetaText(input.description) || sanitizeMetaText(input.tagline);
  if (host.length >= 70) return truncateDescription(host);

  const bits: string[] = [];
  if (input.stays > 0) bits.push(`${input.stays} ${input.stays === 1 ? 'stay' : 'stays'}`);
  if (input.parking > 0) {
    bits.push(`${input.parking} parking ${input.parking === 1 ? 'slot' : 'slots'}`);
  }
  const listing = bits.length > 0 ? ` lists ${bits.join(' and ')}` : ' lists stays and parking';
  return truncateDescription(`${input.name.trim()}${listing} on ${SITE_NAME}.`);
}

/**
 * 1200x630 share crop for a Supabase Storage photo, so link previews are not letterboxed.
 * Returns the original URL when transforms are off or the source is not Storage, because a
 * render URL on a plan without transforms is a 404 in every preview.
 */
export function buildSocialImage(
  src: string | null | undefined,
  options: { transforms: boolean; width?: number; height?: number } = { transforms: false }
): string | null {
  const value = src?.trim();
  if (!value) return null;
  if (!options.transforms) return value;
  const marker = '/storage/v1/object/public/';
  if (!value.includes(marker)) return value;
  const width = options.width ?? 1200;
  const height = options.height ?? 630;
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(marker, '/storage/v1/render/image/public/');
    url.searchParams.set('width', String(width));
    url.searchParams.set('height', String(height));
    url.searchParams.set('resize', 'cover');
    url.searchParams.set('quality', '80');
    return url.toString();
  } catch {
    return value;
  }
}

/**
 * Share-image fields for a listing photo. With transforms on, Supabase serves a 1200x630
 * cover crop, so the tags can also declare the dimensions.
 */
export function socialImageMeta(
  src: string | null | undefined,
  transforms: boolean
): { image: string | null; imageWidth?: number; imageHeight?: number } {
  const image = buildSocialImage(src, { transforms });
  if (!image) return { image: null };
  return transforms && image !== src
    ? { image, imageWidth: 1200, imageHeight: 630 }
    : { image };
}

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

export type ListingFamily = 'property' | 'parking' | 'development';

const DETAIL_PATTERNS: Array<[ListingFamily, RegExp]> = [
  ['property', /^\/properties\/(?!in(?:\/|$))([a-z0-9-]+)\/?$/],
  ['parking', /^\/parkings\/(?!in(?:\/|$)|requests(?:\/|$))([a-z0-9-]+)\/?$/],
  ['development', /^\/developments\/(?!in(?:\/|$))([a-z0-9-]+)\/?$/],
];

/** Listing detail route → family + slug (location browse and sub-pages excluded). */
export function matchListingDetailPath(
  pathname: string
): { family: ListingFamily; slug: string } | null {
  for (const [family, pattern] of DETAIL_PATTERNS) {
    const match = pathname.match(pattern);
    if (match?.[1]) return { family, slug: match[1] };
  }
  return null;
}

const CRAWLER_PATTERN =
  /bot|crawler|spider|crawling|facebookexternalhit|facebookcatalog|meta-externalagent|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|embedly|pinterest|redditbot|skypeuripreview|vkshare|applebot|google-inspectiontool|bingpreview|viber/i;

export function isCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && CRAWLER_PATTERN.test(userAgent));
}

type Address = { city?: string | null; province?: string | null; country?: string | null };

function postalAddress(address: Address): Record<string, unknown> | undefined {
  const locality = address.city?.trim();
  if (!locality) return undefined;
  return {
    '@type': 'PostalAddress',
    addressLocality: locality,
    ...(address.province?.trim() ? { addressRegion: address.province.trim() } : {}),
    addressCountry: address.country?.trim() || 'PH',
  };
}

export function buildPropertyJsonLd(input: {
  name: string;
  url: string;
  description?: string | null;
  images: string[];
  address: Address;
  rating?: number | null;
  reviewCount?: number;
  priceFrom?: number | null;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: input.name,
    url: input.url,
    ...(input.description ? { description: truncateDescription(input.description, 500) } : {}),
    ...(input.images.length > 0 ? { image: input.images.slice(0, 5) } : {}),
    ...(postalAddress(input.address) ? { address: postalAddress(input.address) } : {}),
    ...(input.rating != null && (input.reviewCount ?? 0) > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: input.rating,
            reviewCount: input.reviewCount,
            bestRating: 5,
          },
        }
      : {}),
    ...(input.priceFrom != null
      ? { priceRange: `From PHP ${Math.round(input.priceFrom)} / night` }
      : {}),
  };
}

export function buildParkingJsonLd(input: {
  name: string;
  url: string;
  description?: string | null;
  image?: string | null;
  address: Address;
  priceFrom?: number | null;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ParkingFacility',
    name: input.name,
    url: input.url,
    ...(input.description ? { description: truncateDescription(input.description, 500) } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(postalAddress(input.address) ? { address: postalAddress(input.address) } : {}),
    ...(input.priceFrom != null
      ? { priceRange: `From PHP ${Math.round(input.priceFrom)} / night` }
      : {}),
  };
}

export function buildDevelopmentJsonLd(input: {
  name: string;
  url: string;
  description?: string | null;
  image?: string | null;
  city?: string | null;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Residence',
    name: input.name,
    url: input.url,
    ...(input.description ? { description: truncateDescription(input.description, 500) } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(input.city ? { address: postalAddress({ city: input.city }) } : {}),
  };
}

/** Locale of the public site. Every page is Philippine English. */
export const OG_LOCALE = 'en_PH';

/** Head tags for crawler HTML (all values escaped). */
export function renderMetaTags(input: SeoMeta): string {
  const usesDefaultImage = !input.image;
  const image = input.image || new URL(DEFAULT_SOCIAL_IMAGE, input.canonicalUrl).href;
  const description = truncateDescription(input.description);
  const imageAlt = sanitizeMetaText(input.imageAlt) || SITE_NAME;
  const width = input.imageWidth ?? (usesDefaultImage ? 1200 : null);
  const height = input.imageHeight ?? (usesDefaultImage ? 630 : null);

  const tags = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(input.canonicalUrl)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE}" />`,
    `<meta property="og:type" content="${input.type ?? 'website'}" />`,
    `<meta property="og:title" content="${escapeHtml(input.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(input.canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(input.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`,
  ];

  if (width && height) {
    tags.push(`<meta property="og:image:width" content="${width}" />`);
    tags.push(`<meta property="og:image:height" content="${height}" />`);
    tags.push(`<meta property="og:image:type" content="${imageType(width, height)}" />`);
  }
  if (input.noindex) tags.push('<meta name="robots" content="noindex" />');
  if (input.jsonLd) {
    tags.push(`<script type="application/ld+json">${serializeJsonLd(input.jsonLd)}</script>`);
  }
  return tags.join('\n    ');
}

/** Social cards are rendered as PNG or AVIF; the default brand card is a PNG. */
function imageType(width: number, height: number): string {
  return width === 1200 && height === 630 ? 'image/png' : 'image/jpeg';
}

/**
 * Replace <title> and the default description in the SPA shell, then append the rest
 * of the tags before </head>. Returns the original HTML if it has no </head>.
 */
export function injectMetaIntoHtml(html: string, meta: SeoMeta): string {
  if (!html.includes('</head>')) return html;
  const withoutDefaults = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/i, '');
  return withoutDefaults.replace('</head>', `    ${renderMetaTags(meta)}\n  </head>`);
}

/**
 * Hosts that may be indexed. Anything else (dev, Vercel previews) gets `Disallow: /`.
 * Canonical tags still point at the apex for every one of these, so they cannot split
 * ranking signals.
 */
export const DEFAULT_INDEXABLE_HOSTS: readonly string[] = [
  // Current production domain (kamespace rebrand). Without these the production
  // build served `Disallow: /` and Lighthouse SEO capped at 69.
  'kamespace.com',
  'www.kamespace.com',
  'app.kamespace.com',
  // Legacy production domain, kept while it still serves the app.
  'app.kamehomes.space',
  'kamehomes.space',
  'www.kamehomes.space',
];

function robotsGroup(userAgent: string): string[] {
  return [`User-agent: ${userAgent}`, 'Allow: /', ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`), ''];
}

/**
 * robots.txt body.
 *
 * `origin` is the request origin and only decides whether the deployment may be crawled at
 * all. The `Sitemap:` line always uses the canonical origin so `www.`, `app.` and the legacy
 * domain all point crawlers at the same file.
 */
export function buildRobotsTxt(
  origin: string,
  indexableHosts: readonly string[] = DEFAULT_INDEXABLE_HOSTS,
  siteOrigin: string = PRODUCTION_SITE_ORIGIN
): string {
  if (!indexableHosts.includes(new URL(origin).hostname)) {
    return ['User-agent: *', 'Disallow: /', ''].join('\n');
  }

  const lines = [
    ...robotsGroup('*'),
    ...AI_CRAWLER_USER_AGENTS.flatMap((agent) => robotsGroup(agent)),
    `Sitemap: ${siteOrigin.replace(/\/+$/, '')}/sitemap.xml`,
    '',
  ];
  return lines.join('\n');
}
