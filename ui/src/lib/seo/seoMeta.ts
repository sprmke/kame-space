/**
 * SEO metadata shared by the SPA (`usePageMeta`) and the Vercel middleware that serves
 * crawler-ready HTML (`ui/middleware.ts`).
 *
 * Pure and dependency-free (no `@/` imports): the middleware bundle resolves it by
 * relative path.
 */

import { AI_CRAWLER_USER_AGENTS, ROBOTS_DISALLOW } from './robotsRules';
import {
  DEFAULT_SOCIAL_IMAGE,
  escapeHtml,
  MAX_DESCRIPTION_LENGTH,
  serializeJsonLd,
  SITE_NAME,
  truncateDescription,
  OG_LOCALE,
  type SeoMeta,
} from './seoPrimitives';
import { PRODUCTION_SITE_ORIGIN } from './siteOrigin';

export * from './seoPrimitives';
export { ROBOTS_DISALLOW };

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
export function listingDescription(
  input: ListingDescriptionInput,
  max = MAX_DESCRIPTION_LENGTH
): string {
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
  const amenities = (input.amenities ?? [])
    .map((item) => sanitizeMetaText(item))
    .filter(Boolean)
    .slice(0, 2);
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
  const count = Math.max(input.count, 1);
  const plural = count !== 1;

  // Singular and plural per family, plus a closing clause that keeps a one-listing place
  // page above the 70-character floor instead of shipping a 44-character description.
  const subject =
    input.family === 'parking'
      ? `${count} parking ${plural ? 'slots' : 'slot'}`
      : input.family === 'development'
        ? `${count} ${plural ? 'developments' : 'development'}`
        : `${count} ${plural ? 'stays' : 'stay'}`;

  const price =
    input.priceFrom && input.priceFrom > 0
      ? `, from PHP ${Math.round(input.priceFrom)} per night`
      : '';

  const closing =
    input.family === 'parking'
      ? 'Check availability and reserve your slot by the night.'
      : input.family === 'development'
        ? 'with the homes and parking inside each.'
        : 'Compare photos, check dates and book direct with the host.';

  const head =
    input.family === 'development'
      ? `${subject} in ${input.place.trim()}${price}, ${closing}`
      : `${subject} in ${input.place.trim()}${price}. ${closing}`;

  return truncateDescription(head);
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
  return transforms && image !== src ? { image, imageWidth: 1200, imageHeight: 630 } : { image };
}

/** Merge several entities into one `@graph` document. */
export function combineJsonLd(
  nodes: ReadonlyArray<Record<string, unknown> | null | undefined>
): Record<string, unknown> | null {
  const entities = nodes.filter((node): node is Record<string, unknown> => Boolean(node));
  if (entities.length === 0) return null;
  if (entities.length === 1) return entities[0]!;
  return { '@context': 'https://schema.org', '@graph': entities };
}

/** Serialize one entity or a graph. */
export function serializeJsonLdGraph(
  value: Record<string, unknown> | ReadonlyArray<Record<string, unknown>>
): string {
  if (Array.isArray(value)) {
    const combined = combineJsonLd(value as ReadonlyArray<Record<string, unknown>>);
    return serializeJsonLd(combined ?? {});
  }
  return serializeJsonLd(value as Record<string, unknown>);
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

/** Site-wide Organization entity for the crawler snapshot and the runtime injector. */
export function buildOrganizationJsonLd(input: {
  name: string;
  url: string;
  logo: string;
  alternateName?: string | null;
  sameAs?: readonly string[];
  email?: string | null;
  telephone?: string | null;
}): Record<string, unknown> {
  const sameAs = (input.sameAs ?? []).filter((href) => /^https?:\/\//.test(href));
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    ...(input.alternateName ? { alternateName: input.alternateName } : {}),
    url: input.url,
    logo: input.logo,
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(input.email || input.telephone
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            ...(input.email ? { email: input.email } : {}),
            ...(input.telephone ? { telephone: input.telephone } : {}),
            areaServed: 'PH',
            availableLanguage: ['en', 'fil'],
          },
        }
      : {}),
  };
}

/** Site-wide WebSite entity. */
export function buildWebSiteJsonLd(input: {
  name: string;
  url: string;
  alternateName?: string | null;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.name,
    ...(input.alternateName ? { alternateName: input.alternateName } : {}),
    url: input.url,
  };
}

export type BreadcrumbInput = { name: string; url: string };

export function buildBreadcrumbJsonLd(
  crumbs: readonly BreadcrumbInput[]
): Record<string, unknown> | null {
  const items = crumbs.filter((crumb) => crumb.name.trim() && crumb.url.trim());
  if (items.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name.trim(),
      item: crumb.url.trim(),
    })),
  };
}

/** `BreadcrumbList` from the same items the visible trail renders. */
export function buildBreadcrumbJsonLdFromItems(
  items: ReadonlyArray<{ label: string; to?: string }>,
  canonicalOrigin: string
): Record<string, unknown> | null {
  const crumbs = items
    .filter((item) => item.label.trim())
    .map((item) => ({
      name: item.label.trim(),
      url: item.to
        ? `${canonicalOrigin.replace(/\/+$/, '')}${item.to}`
        : `${canonicalOrigin.replace(/\/+$/, '')}/`,
    }));
  return buildBreadcrumbJsonLd(crumbs);
}

export function buildItemListJsonLd(input: {
  name: string;
  items: ReadonlyArray<{ name: string; url: string; image?: string | null }>;
}): Record<string, unknown> | null {
  const items = input.items.filter((item) => item.name.trim() && item.url.trim()).slice(0, 24);
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: input.name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name.trim(),
      url: item.url.trim(),
      ...(item.image ? { image: item.image } : {}),
    })),
  };
}

export function buildFaqJsonLd(
  faqs: ReadonlyArray<{ question: string; answer: string }>
): Record<string, unknown> | null {
  const usable = faqs
    .map((faq) => ({
      question: sanitizeMetaText(faq.question),
      answer: sanitizeMetaText(faq.answer),
    }))
    .filter((faq) => faq.question && faq.answer)
    .slice(0, 20);
  if (usable.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: usable.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export type PlanOfferInput = {
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  url?: string | null;
};

/** `SoftwareApplication` with one `Offer` per published plan. */
export function buildSoftwareApplicationJsonLd(input: {
  name: string;
  applicationCategory?: string;
  offers: readonly PlanOfferInput[];
}): Record<string, unknown> {
  const offers = input.offers
    .filter((offer) => offer.name.trim())
    .map((offer) => ({
      '@type': 'Offer',
      name: offer.name.trim(),
      ...(offer.description ? { description: truncateDescription(offer.description, 200) } : {}),
      ...(offer.price != null && offer.price >= 0
        ? { price: String(offer.price), priceCurrency: (offer.currency ?? 'PHP').toUpperCase() }
        : {}),
      ...(offer.url ? { url: offer.url } : {}),
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: input.name,
    applicationCategory: input.applicationCategory ?? 'BusinessApplication',
    operatingSystem: 'Web',
    ...(offers.length > 0 ? { offers } : {}),
  };
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

export type GeoInput = { latitude?: number | null; longitude?: number | null };

function geoJsonLd(geo: GeoInput | undefined): Record<string, unknown> | undefined {
  if (geo?.latitude == null || geo.longitude == null) return undefined;
  return {
    '@type': 'GeoCoordinates',
    latitude: geo.latitude,
    longitude: geo.longitude,
  };
}

function amenityJsonLd(amenities: readonly string[] | undefined): Record<string, unknown>[] {
  return (amenities ?? [])
    .map((name) => sanitizeMetaText(name))
    .filter(Boolean)
    .slice(0, 12)
    .map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true }));
}

function nightOffer(priceFrom: number | null | undefined, url: string) {
  if (priceFrom == null || priceFrom <= 0) return undefined;
  return {
    '@type': 'Offer',
    price: String(Math.round(priceFrom)),
    priceCurrency: 'PHP',
    url,
    availability: 'https://schema.org/InStock',
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
  geo?: GeoInput;
  amenities?: readonly string[];
  guests?: number | null;
  bedrooms?: number | null;
  petsAllowed?: boolean | null;
  checkinTime?: string | null;
  checkoutTime?: string | null;
  containedInName?: string | null;
  containedInUrl?: string | null;
}): Record<string, unknown> {
  const offer = nightOffer(input.priceFrom, input.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: input.name,
    url: input.url,
    ...(input.description ? { description: truncateDescription(input.description, 500) } : {}),
    ...(input.images.length > 0 ? { image: input.images.slice(0, 5) } : {}),
    ...(postalAddress(input.address) ? { address: postalAddress(input.address) } : {}),
    ...(geoJsonLd(input.geo) ? { geo: geoJsonLd(input.geo) } : {}),
    ...(amenityJsonLd(input.amenities).length > 0
      ? { amenityFeature: amenityJsonLd(input.amenities) }
      : {}),
    ...(input.bedrooms && input.bedrooms > 0 ? { numberOfRooms: input.bedrooms } : {}),
    ...(input.guests && input.guests > 0
      ? { occupancy: { '@type': 'QuantitativeValue', maxValue: input.guests } }
      : {}),
    ...(input.petsAllowed != null ? { petsAllowed: input.petsAllowed } : {}),
    ...(input.checkinTime ? { checkinTime: input.checkinTime } : {}),
    ...(input.checkoutTime ? { checkoutTime: input.checkoutTime } : {}),
    ...(input.containedInName
      ? {
          containedInPlace: {
            '@type': 'Place',
            name: input.containedInName,
            ...(input.containedInUrl ? { url: input.containedInUrl } : {}),
          },
        }
      : {}),
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
    ...(offer ? { makesOffer: offer } : {}),
  };
}

export function buildParkingJsonLd(input: {
  name: string;
  url: string;
  description?: string | null;
  image?: string | null;
  images?: readonly string[];
  address: Address;
  priceFrom?: number | null;
  geo?: GeoInput;
  containedInName?: string | null;
  containedInUrl?: string | null;
}): Record<string, unknown> {
  const images = [...new Set([...(input.images ?? []), ...(input.image ? [input.image] : [])])];
  const offer = nightOffer(input.priceFrom, input.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'ParkingFacility',
    name: input.name,
    url: input.url,
    ...(input.description ? { description: truncateDescription(input.description, 500) } : {}),
    ...(images.length > 0 ? { image: images.slice(0, 5) } : {}),
    ...(postalAddress(input.address) ? { address: postalAddress(input.address) } : {}),
    ...(geoJsonLd(input.geo) ? { geo: geoJsonLd(input.geo) } : {}),
    ...(input.containedInName
      ? {
          containedInPlace: {
            '@type': 'Place',
            name: input.containedInName,
            ...(input.containedInUrl ? { url: input.containedInUrl } : {}),
          },
        }
      : {}),
    ...(input.priceFrom != null
      ? { priceRange: `From PHP ${Math.round(input.priceFrom)} / night` }
      : {}),
    ...(offer ? { makesOffer: offer } : {}),
  };
}

export function buildDevelopmentJsonLd(input: {
  name: string;
  url: string;
  description?: string | null;
  image?: string | null;
  images?: readonly string[];
  city?: string | null;
  province?: string | null;
  geo?: GeoInput;
  units?: ReadonlyArray<{ name: string; url: string }>;
}): Record<string, unknown> {
  const images = [...new Set([...(input.images ?? []), ...(input.image ? [input.image] : [])])];
  const units = (input.units ?? []).filter((unit) => unit.name && unit.url).slice(0, 24);
  return {
    '@context': 'https://schema.org',
    '@type': 'Residence',
    name: input.name,
    url: input.url,
    ...(input.description ? { description: truncateDescription(input.description, 500) } : {}),
    ...(images.length > 0 ? { image: images.slice(0, 5) } : {}),
    ...(input.city
      ? { address: postalAddress({ city: input.city, province: input.province }) }
      : {}),
    ...(geoJsonLd(input.geo) ? { geo: geoJsonLd(input.geo) } : {}),
    ...(units.length > 0
      ? {
          containsPlace: units.map((unit) => ({
            '@type': 'Accommodation',
            name: unit.name,
            url: unit.url,
          })),
        }
      : {}),
  };
}

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
  // The cover photo is the LCP element on a listing page. Preloading it removes one
  // render-blocking round trip for JS crawlers and for the first paint after hydration.
  if (input.image) {
    tags.push(`<link rel="preload" as="image" href="${escapeHtml(image)}" fetchpriority="high" />`);
  }
  if (input.noindex) tags.push('<meta name="robots" content="noindex" />');
  if (input.jsonLd) {
    tags.push(`<script type="application/ld+json">${serializeJsonLdGraph(input.jsonLd)}</script>`);
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
  return [
    `User-agent: ${userAgent}`,
    'Allow: /',
    ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
    '',
  ];
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
    // llms.txt is a map for AI answer engines; the comment keeps it discoverable.
    `# LLM map: ${siteOrigin.replace(/\/+$/, '')}/llms.txt`,
    '',
  ];
  return lines.join('\n');
}
