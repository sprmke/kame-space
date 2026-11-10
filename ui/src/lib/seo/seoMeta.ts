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

/** Head tags for crawler HTML (all values escaped). */
export function renderMetaTags(input: SeoMeta): string {
  const meta = {
    ...input,
    image: input.image || new URL(DEFAULT_SOCIAL_IMAGE, input.canonicalUrl).href,
    description: truncateDescription(input.description),
  };
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}" />`,
    `<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
  ];
  if (meta.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}" />`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(meta.image)}" />`);
  }
  if (!input.image) {
    tags.push('<meta property="og:image:width" content="1200" />');
    tags.push('<meta property="og:image:height" content="630" />');
    tags.push('<meta property="og:image:alt" content="KameSpace" />');
    tags.push('<meta name="twitter:image:alt" content="KameSpace" />');
  }
  if (meta.noindex) tags.push('<meta name="robots" content="noindex" />');
  if (meta.jsonLd) {
    tags.push(`<script type="application/ld+json">${serializeJsonLd(meta.jsonLd)}</script>`);
  }
  return tags.join('\n    ');
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
