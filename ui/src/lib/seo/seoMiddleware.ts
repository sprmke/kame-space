/**
 * Request handling for the Vercel middleware (`ui/middleware.ts`): robots.txt, sitemap.xml
 * proxy, and crawler-ready HTML for every indexable public route.
 *
 * Why: the SPA shell is `<div id="root"></div>`. Google renders JS; GPTBot, OAI-SearchBot,
 * ClaudeBot, PerplexityBot, Bingbot and link-preview bots mostly do not. For those user
 * agents this module swaps in a semantic snapshot (one `<h1>`, real text, real `<a href>`
 * links, images with alt) plus the full `<head>`. React replaces it when JS runs.
 *
 * Every path fails open: any error or missing data returns `null` and the request continues
 * to the normal SPA response. No `@/` imports (bundled by Vercel outside Vite).
 */

import { legalPageCopy, STATIC_PAGE_COPY, type StaticPageCopy } from './content/staticPageCopy';
import {
  FAMILY_LIST_PATHS,
  matchHostPath,
  matchPlacePath,
  matchStaticRoute,
  type PublicRouteEntry,
  type RouteFamily,
} from './publicRoutes';
import {
  buildBreadcrumbJsonLd,
  buildDevelopmentJsonLd,
  buildFaqJsonLd,
  buildItemListJsonLd,
  buildOrganizationJsonLd,
  buildPageTitle,
  buildParkingJsonLd,
  buildPropertyJsonLd,
  buildRobotsTxt,
  buildSoftwareApplicationJsonLd,
  buildWebSiteJsonLd,
  combineJsonLd,
  DEFAULT_DESCRIPTION,
  DEFAULT_INDEXABLE_HOSTS,
  DEFAULT_SOCIAL_IMAGE,
  developmentTitle,
  hostDescription,
  hostTitle,
  injectMetaIntoHtml,
  isCrawlerUserAgent,
  listingDescription,
  matchListingDetailPath,
  minNightlyRate,
  parkingTitle,
  placeDescription,
  placeTitle,
  propertyTitle,
  socialImageMeta,
  type ListingFamily,
  type SeoMeta,
} from './seoMeta';
import { canonicalUrlFor, PRODUCTION_SITE_ORIGIN } from './siteOrigin';
import {
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildLlmsTxtUnavailable,
  type LlmsListing,
} from './llmsTxt';
import {
  injectSnapshotIntoHtml,
  renderSnapshotHtml,
  type SnapshotImage,
  type SnapshotLink,
  type SnapshotPage,
} from './snapshot/renderSnapshot';

export type SeoMiddlewareDeps = {
  /** `VITE_SUPABASE_URL` — the functions base (…/functions/v1). */
  functionsUrl: string;
  anonKey: string;
  siteName: string;
  /** Canonical origin for every absolute URL. Defaults to the production apex. */
  siteOrigin?: string;
  /** `VITE_SUPABASE_IMAGE_TRANSFORMS` — build 1200x630 Storage share crops. */
  imageTransforms?: boolean;
  /** Contact email for the Organization `contactPoint`. */
  supportEmail?: string | null;
  /** Public social profiles for `Organization.sameAs`. */
  socialLinks?: readonly string[];
  /** `INDEXNOW_KEY` — served at `/{key}.txt` for Bing and Yandex. */
  indexNowKey?: string | null;
  /** One-paragraph site summary for `llms.txt`. */
  summary?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Hosts allowed in robots.txt; others get `Disallow: /`. Defaults to the production hosts. */
  indexableHosts?: readonly string[];
};

const DEFAULT_TIMEOUT_MS = 2_500;

type Json = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function records(value: unknown): Json[] {
  return Array.isArray(value)
    ? (value.filter((row) => row && typeof row === 'object') as Json[])
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => !!str(item)) : [];
}

async function getJson(url: string, deps: SeoMiddlewareDeps): Promise<Json | null> {
  const doFetch = deps.fetchImpl ?? fetch;
  const res = await doFetch(url, {
    headers: { apikey: deps.anonKey, Authorization: `Bearer ${deps.anonKey}` },
    signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return (await res.json()) as Json;
}

function apiBase(deps: SeoMiddlewareDeps): string {
  return deps.functionsUrl.replace(/\/+$/, '');
}

function title(siteName: string, page: string): string {
  return siteName ? `${siteName} - ${page}` : page;
}

/** `Places to stay | Kame Space` → `Places to stay`, so an `<h1>` stays brand-free. */
function stripBrandSuffix(value: string, siteName: string): string {
  const suffix = ` | ${siteName}`;
  return value.endsWith(suffix) ? value.slice(0, -suffix.length).trim() : value;
}

/** `makati-city` → `Makati City`. Used only when no edge payload carries a readable label. */
function placeLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const RELATED_ENDPOINT: Record<RouteFamily, string> = {
  property: 'list-public-properties',
  parking: 'list-public-parkings',
  development: 'list-public-developments',
};

/**
 * Ask the edge whether a slug is a historical one. The public handlers answer a renamed
 * listing with a 301 and a `Location`, so this reads that header instead of parsing data.
 */
async function probeSlugRedirect(url: string, deps: SeoMiddlewareDeps): Promise<string | null> {
  try {
    const doFetch = deps.fetchImpl ?? fetch;
    const res = await doFetch(url, {
      headers: { apikey: deps.anonKey, Authorization: `Bearer ${deps.anonKey}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (res.status < 300 || res.status >= 400) return null;
    return res.headers.get('location');
  } catch {
    return null;
  }
}

/** Endpoint that knows how to answer a 301 for each family. */
function detailEndpoint(family: ListingFamily, slug: string, deps: SeoMiddlewareDeps): string {
  const base = apiBase(deps);
  const encoded = encodeURIComponent(slug);
  if (family === 'property') return `${base}/get-public-property?property=${encoded}`;
  if (family === 'parking') return `${base}/get-public-parking?parking=${encoded}`;
  return `${base}/list-public-developments?slug=${encoded}&pageSize=1`;
}

/**
 * Other listings in the same city, for internal links in the crawler HTML. Best effort: an
 * empty list on any error, so a snapshot never fails because of an optional sidebar.
 */
async function relatedListings(
  deps: SeoMiddlewareDeps,
  family: RouteFamily,
  city: string | null,
  excludeSlug: string
): Promise<SnapshotLink[]> {
  const place = city?.trim();
  if (!place) return [];
  try {
    const body = await getJson(
      `${apiBase(deps)}/${RELATED_ENDPOINT[family]}?where=${encodeURIComponent(place)}&pageSize=8`,
      deps
    );
    return listingLinks(
      records(body?.data).filter((card) => str(card.slug) !== excludeSlug),
      family
    ).slice(0, 6);
  } catch {
    return [];
  }
}

function listingLinks(cards: Json[], family: RouteFamily): SnapshotLink[] {
  return cards
    .map((card) => {
      const slug = str(card.slug);
      const name = str(card.name);
      if (!slug || !name) return null;
      return { href: `${FAMILY_LIST_PATHS[family]}/${slug}`, label: name };
    })
    .filter((link): link is SnapshotLink => link !== null);
}

function listingImages(cards: Json[]): SnapshotImage[] {
  const images: SnapshotImage[] = [];
  for (const card of cards) {
    const src = str(card.coverImage) ?? strings(card.images)[0] ?? null;
    if (!src) continue;
    images.push({ src, alt: str(card.name) ?? 'Listing photo' });
    if (images.length >= 4) break;
  }
  return images;
}

// --- static pages ------------------------------------------------------------------------

const STATIC_COPY_BY_ID: Record<string, StaticPageCopy | undefined> = {
  home: STATIC_PAGE_COPY.home,
  about: STATIC_PAGE_COPY.about,
  contact: STATIC_PAGE_COPY.contact,
  support: STATIC_PAGE_COPY.support,
  'for-hosts': STATIC_PAGE_COPY.forHosts,
  'for-hosts-pricing': STATIC_PAGE_COPY.forHostsPricing,
};

function staticCopy(entry: PublicRouteEntry, productName: string): StaticPageCopy | undefined {
  const direct = STATIC_COPY_BY_ID[entry.id];
  if (direct) return direct;
  const legal = legalPageCopy(productName);
  if (entry.id === 'terms') return legal.terms;
  if (entry.id === 'privacy') return legal.privacy;
  if (entry.id === 'cookies') return legal.cookies;
  return undefined;
}

function buildStaticRoute(
  entry: PublicRouteEntry,
  canonicalUrl: string,
  deps: SeoMiddlewareDeps
): { meta: SeoMeta; snapshot: SnapshotPage } {
  const copy = staticCopy(entry, deps.siteName);
  // List pages carry no `<h1>` in the SPA yet, so the snapshot heading comes from the
  // registry title, minus the brand suffix (an `<h1>` never carries it). Everything else
  // reuses the page's own hero copy.
  const heading = copy?.heading ?? stripBrandSuffix(entry.title ?? deps.siteName, deps.siteName);
  const accent = copy?.headingAccent;
  const intro = copy?.intro ?? entry.description ?? DEFAULT_DESCRIPTION;

  return {
    meta: {
      // Registry titles are the complete string, brand included.
      title: entry.title ?? buildPageTitle(heading, deps.siteName),
      description: entry.description ?? intro,
      canonicalUrl,
    },
    snapshot: {
      id: entry.id,
      heading: accent ? `${heading} ${accent}` : heading,
      intro,
      links: [],
    },
  };
}

// --- listing detail ----------------------------------------------------------------------

export async function loadListingMeta(
  family: ListingFamily,
  slug: string,
  canonicalUrl: string,
  deps: SeoMiddlewareDeps
): Promise<SeoMeta | null> {
  const resolved = await loadListingRoute(family, slug, canonicalUrl, deps);
  return resolved?.meta ?? null;
}

async function loadListingRoute(
  family: ListingFamily,
  slug: string,
  canonicalUrl: string,
  deps: SeoMiddlewareDeps
): Promise<{ meta: SeoMeta; snapshot: SnapshotPage } | null> {
  const base = apiBase(deps);
  const encoded = encodeURIComponent(slug);

  if (family === 'property') {
    const body = await getJson(`${base}/get-public-property?property=${encoded}`, deps);
    const data = (body?.data ?? null) as Json | null;
    const name = str(data?.name);
    if (!data || !name) return null;
    const images = strings(data.images);
    const location = str(data.locationLabel);
    const pricing = (data.pricing ?? {}) as Json;
    const price = num(pricing.weekdayNightlyRate);
    const city = str(data.city);
    const description = listingDescription({
      name,
      unitType: str(data.type),
      city,
      guests: num(data.maxGuests),
      bedrooms: num(data.bedrooms),
      amenities: strings(data.amenities),
      priceFrom: price,
      hostDescription: str(data.description),
    });
    const share = socialImageMeta(images[0] ?? str(data.coverImage), Boolean(deps.imageTransforms));

    const facts: Array<{ label: string; value: string }> = [];
    if (location) facts.push({ label: 'Location', value: location });
    if (num(data.maxGuests)) facts.push({ label: 'Guests', value: String(num(data.maxGuests)) });
    if (num(data.bedrooms)) facts.push({ label: 'Bedrooms', value: String(num(data.bedrooms)) });
    if (price) facts.push({ label: 'From', value: `PHP ${Math.round(price)} / night` });

    const links: SnapshotLink[] = [{ href: FAMILY_LIST_PATHS.property, label: 'All stays' }];
    const development = (data.development ?? null) as Json | null;
    const developmentSlug = str(development?.slug) ?? str(data.developmentSlug);
    const developmentName = str(development?.name) ?? str(data.residenceName);
    if (developmentSlug) {
      links.push({
        href: `${FAMILY_LIST_PATHS.development}/${developmentSlug}`,
        label: developmentName ?? 'Development',
      });
    }
    const host = (data.host ?? null) as Json | null;
    const hostSlug = str(host?.organizationSlug) ?? str(data.hostSlug) ?? str(data.orgSlug);
    if (hostSlug) {
      links.push({
        href: `/hosts/${hostSlug}`,
        label: str(host?.organizationName) ?? 'Host profile',
      });
    }
    if (location) {
      links.push({
        href: `${FAMILY_LIST_PATHS.property}?where=${encodeURIComponent(location)}`,
        label: `Stays in ${location}`,
      });
    }
    // Related stays in the same city, so a crawler has a path deeper into the catalogue.
    for (const related of await relatedListings(deps, 'property', city, slug)) {
      links.push({ href: related.href, label: related.label });
    }

    return {
      meta: {
        title: buildPageTitle(
          propertyTitle({ name, unitType: str(data.type), city }),
          deps.siteName
        ),
        description,
        canonicalUrl,
        image: share.image,
        imageWidth: share.imageWidth,
        imageHeight: share.imageHeight,
        imageAlt: name,
        jsonLd: buildPropertyJsonLd({
          name,
          url: canonicalUrl,
          description: str(data.description),
          images,
          address: {
            city,
            province: str(data.province),
            country: str(data.country),
          },
          rating: num(data.rating),
          reviewCount: num(data.reviewCount) ?? 0,
          priceFrom: price,
          geo: { latitude: num(data.latitude), longitude: num(data.longitude) },
          amenities: strings(data.amenities),
          guests: num(data.maxGuests),
          bedrooms: num(data.bedrooms),
          checkinTime: str(data.checkInTime),
          checkoutTime: str(data.checkOutTime),
          containedInName: developmentName,
          containedInUrl: developmentSlug
            ? `${FAMILY_LIST_PATHS.development}/${developmentSlug}`
            : null,
        }),
      },
      snapshot: {
        id: 'property-detail',
        heading: name,
        intro: description,
        facts,
        images: images.slice(0, 6).map((src) => ({ src, alt: name })),
        links,
        breadcrumbs: [
          { name: 'Home', path: '/' },
          { name: 'Stays', path: FAMILY_LIST_PATHS.property },
          { name, path: '' },
        ],
      },
    };
  }

  if (family === 'parking') {
    const body = await getJson(`${base}/get-public-parking?parking=${encoded}`, deps);
    const data = (body?.data ?? null) as Json | null;
    const name = str(data?.name);
    if (!data || !name) return null;
    const place = str(data.residenceName) ?? str(data.city);
    const rate = num(data.ratePerNight);
    const description = listingDescription({
      name,
      city: str(data.city),
      priceFrom: rate,
      hostDescription: str(data.description),
    });
    const share = socialImageMeta(str(data.coverImage), Boolean(deps.imageTransforms));

    const facts: Array<{ label: string; value: string }> = [];
    if (place) facts.push({ label: 'Location', value: place });
    if (rate) facts.push({ label: 'From', value: `PHP ${Math.round(rate)} / night` });

    const parkingLinks: SnapshotLink[] = [
      { href: FAMILY_LIST_PATHS.parking, label: 'All parking' },
    ];
    const parkingDevelopment = (data.development ?? null) as Json | null;
    const parkingDevelopmentSlug = str(parkingDevelopment?.slug) ?? str(data.developmentSlug);
    if (parkingDevelopmentSlug) {
      parkingLinks.push({
        href: `${FAMILY_LIST_PATHS.development}/${parkingDevelopmentSlug}/parking`,
        label: `${str(parkingDevelopment?.name) ?? str(data.residenceName) ?? 'Development'} parking`,
      });
    }
    const parkingHost = (data.host ?? null) as Json | null;
    const parkingHostSlug =
      str(parkingHost?.organizationSlug) ?? str(data.hostSlug) ?? str(data.orgSlug);
    if (parkingHostSlug) {
      parkingLinks.push({
        href: `/hosts/${parkingHostSlug}`,
        label: str(parkingHost?.organizationName) ?? 'Host profile',
      });
    }
    for (const related of await relatedListings(deps, 'parking', str(data.city), slug)) {
      parkingLinks.push({ href: related.href, label: related.label });
    }

    return {
      meta: {
        title: buildPageTitle(parkingTitle({ name, place }), deps.siteName),
        description,
        canonicalUrl,
        image: share.image,
        imageWidth: share.imageWidth,
        imageHeight: share.imageHeight,
        imageAlt: name,
        jsonLd: buildParkingJsonLd({
          name,
          url: canonicalUrl,
          description: str(data.description),
          image: share.image,
          address: {
            city: str(data.city),
            province: str(data.province),
            country: str(data.country),
          },
          priceFrom: rate,
          geo: { latitude: num(data.latitude), longitude: num(data.longitude) },
          containedInName: str(parkingDevelopment?.name) ?? str(data.residenceName),
          containedInUrl: parkingDevelopmentSlug
            ? `${FAMILY_LIST_PATHS.development}/${parkingDevelopmentSlug}`
            : null,
        }),
      },
      snapshot: {
        id: 'parking-detail',
        heading: name,
        intro: description,
        facts,
        images: str(data.coverImage) ? [{ src: str(data.coverImage)!, alt: name }] : [],
        links: parkingLinks,
        breadcrumbs: [
          { name: 'Home', path: '/' },
          { name: 'Parking', path: FAMILY_LIST_PATHS.parking },
          { name, path: '' },
        ],
      },
    };
  }

  const body = await getJson(`${base}/list-public-developments?slug=${encoded}&pageSize=1`, deps);
  const data = records(body?.data)[0];
  const name = str(data?.name);
  if (!data || !name) return null;
  const location = str(data.locationLabel) ?? str(data.location) ?? str(data.city);
  const city = str(data.city);
  const description = listingDescription({
    name,
    city: city ?? location,
    hostDescription: str(data.description),
  });
  const share = socialImageMeta(str(data.coverImage), Boolean(deps.imageTransforms));

  const facts: Array<{ label: string; value: string }> = [];
  if (location) facts.push({ label: 'Location', value: location });
  if (num(data.price)) facts.push({ label: 'From', value: `PHP ${Math.round(num(data.price)!)}` });

  // Homes inside this development, so crawlers can reach the units from the parent page.
  const unitLinks = await (async (): Promise<SnapshotLink[]> => {
    try {
      const unitsBody = await getJson(
        `${apiBase(deps)}/list-public-properties?development=${encodeURIComponent(name)}&pageSize=8`,
        deps
      );
      return listingLinks(records(unitsBody?.data), 'property');
    } catch {
      return [];
    }
  })();

  return {
    meta: {
      title: buildPageTitle(developmentTitle({ name, city: city ?? location }), deps.siteName),
      description,
      canonicalUrl,
      image: share.image,
      imageWidth: share.imageWidth,
      imageHeight: share.imageHeight,
      imageAlt: name,
      jsonLd: buildDevelopmentJsonLd({
        name,
        url: canonicalUrl,
        description: str(data.description),
        image: share.image,
        city: city ?? location,
        province: str(data.province),
        geo: { latitude: num(data.latitude), longitude: num(data.longitude) },
        units: unitLinks.map((link) => ({ name: link.label, url: link.href })),
      }),
    },
    snapshot: {
      id: 'development-detail',
      heading: name,
      intro: description,
      facts,
      images: str(data.coverImage) ? [{ src: str(data.coverImage)!, alt: name }] : [],
      links: [
        { href: FAMILY_LIST_PATHS.development, label: 'All developments' },
        { href: `${FAMILY_LIST_PATHS.development}/${slug}/properties`, label: `${name} homes` },
        { href: `${FAMILY_LIST_PATHS.development}/${slug}/parking`, label: `${name} parking` },
        ...unitLinks,
      ],
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Developments', path: FAMILY_LIST_PATHS.development },
        { name, path: '' },
      ],
    },
  };
}

// --- place pages -------------------------------------------------------------------------

const PLACE_ENDPOINT: Record<RouteFamily, string> = {
  property: 'list-public-properties',
  parking: 'list-public-parkings',
  development: 'list-public-developments',
};

const PLACE_LABEL: Record<RouteFamily, string> = {
  property: 'Homes',
  parking: 'Parking',
  development: 'Developments',
};

/**
 * Other places in the same family, from the same place-group index the list pages use.
 * Best effort: an empty list on any error.
 */
async function neighbouringPlaces(
  deps: SeoMiddlewareDeps,
  family: RouteFamily,
  place: string,
  /** Family noun used in the anchor text, e.g. `Homes`. */
  familyLabel: string
): Promise<SnapshotLink[]> {
  try {
    const routeFamily = `${FAMILY_LIST_PATHS[family].replace(/^\//, '')}`;
    const body = await getJson(
      `${apiBase(deps)}/list-public-place-groups?family=${routeFamily}&groupLimit=12&previewSize=1`,
      deps
    );
    const groups = records(body?.groups);
    return groups
      .map((group) => {
        const slug = str(group.locationSlug);
        const name = str(group.place);
        if (!slug || !name || slug === place) return null;
        return {
          href: `${FAMILY_LIST_PATHS[family]}/in/${slug}`,
          label: `${familyLabel} in ${name}`,
        };
      })
      .filter((link): link is SnapshotLink => link !== null)
      .slice(0, 6);
  } catch {
    return [];
  }
}

async function loadPlaceRoute(
  family: RouteFamily,
  place: string,
  canonicalUrl: string,
  deps: SeoMiddlewareDeps
): Promise<{ meta: SeoMeta; snapshot: SnapshotPage } | null> {
  const body = await getJson(
    `${apiBase(deps)}/${PLACE_ENDPOINT[family]}?locationSlug=${encodeURIComponent(place)}&pageSize=12`,
    deps
  );
  const cards = records(body?.data);
  if (cards.length === 0) return null;

  const label = str(cards[0]?.locationLabel) ?? placeLabel(place);
  const heading = placeTitle(family, label);
  const description = placeDescription({
    family,
    place: label,
    count: cards.length,
    priceFrom: minNightlyRate(cards),
  });
  const share = socialImageMeta(str(cards[0]?.coverImage), Boolean(deps.imageTransforms));

  // Sideways links: the other families in this place, then neighbouring places.
  const links: SnapshotLink[] = listingLinks(cards, family);
  for (const otherFamily of ['property', 'parking', 'development'] as const) {
    if (otherFamily === family) continue;
    links.push({
      href: `/${FAMILY_LIST_PATHS[otherFamily].replace(/^\//, '')}/in/${place}`,
      label: `${PLACE_LABEL[otherFamily]} in ${label}`,
    });
  }
  links.push(...(await neighbouringPlaces(deps, family, place, PLACE_LABEL[family])));

  return {
    meta: {
      title: buildPageTitle(heading, deps.siteName),
      description,
      canonicalUrl,
      image: share.image,
      imageWidth: share.imageWidth,
      imageHeight: share.imageHeight,
    },
    snapshot: {
      id: `${family}-place`,
      heading,
      intro: description,
      images: listingImages(cards),
      links,
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: PLACE_LABEL[family], path: FAMILY_LIST_PATHS[family] },
        { name: label, path: '' },
      ],
    },
  };
}

// --- host page ---------------------------------------------------------------------------

async function loadHostRoute(
  orgSlug: string,
  canonicalUrl: string,
  deps: SeoMiddlewareDeps
): Promise<{ meta: SeoMeta; snapshot: SnapshotPage } | null> {
  const body = await getJson(
    `${apiBase(deps)}/get-public-host?org=${encodeURIComponent(orgSlug)}`,
    deps
  );
  const data = (body?.data ?? null) as Json | null;
  const name = str(data?.name);
  if (!data || !name) return null;

  const propertyCards = records(data.properties);
  const parkingCards = records(data.parkings);
  const description = hostDescription({
    name,
    stays: propertyCards.length,
    parking: parkingCards.length,
    tagline: str(data.tagline),
    description: str(data.description),
  });
  const share = socialImageMeta(str(data.logoUrl), Boolean(deps.imageTransforms));

  const links: SnapshotLink[] = [
    ...listingLinks(propertyCards, 'property'),
    ...listingLinks(parkingCards, 'parking'),
  ];
  const credit = str(data.ownerName);

  return {
    meta: {
      title: buildPageTitle(hostTitle(name), deps.siteName),
      description,
      canonicalUrl,
      image: share.image,
      imageWidth: share.imageWidth,
      imageHeight: share.imageHeight,
      imageAlt: `${name} logo`,
    },
    snapshot: {
      id: 'host-public',
      heading: name,
      intro: description,
      facts: credit ? [{ label: 'Host', value: credit }] : [],
      images: str(data.logoUrl) ? [{ src: str(data.logoUrl)!, alt: name }] : [],
      links,
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name, path: '' },
      ],
    },
  };
}

// --- development sub-pages ---------------------------------------------------------------

async function loadDevelopmentSubPage(
  slug: string,
  segment: 'properties' | 'parking',
  canonicalUrl: string,
  deps: SeoMiddlewareDeps
): Promise<{ meta: SeoMeta; snapshot: SnapshotPage } | null> {
  const body = await getJson(
    `${apiBase(deps)}/list-public-developments?slug=${encodeURIComponent(slug)}&pageSize=1`,
    deps
  );
  const data = records(body?.data)[0];
  const name = str(data?.name);
  if (!data || !name) return null;

  const heading = segment === 'properties' ? `Homes at ${name}` : `Parking at ${name}`;
  const description =
    segment === 'properties'
      ? `Homes for rent at ${name}. Check dates and book online.`
      : `Parking slots at ${name}. Check availability and reserve online.`;
  const share = socialImageMeta(str(data.coverImage), Boolean(deps.imageTransforms));

  return {
    meta: {
      title: buildPageTitle(heading, deps.siteName),
      description,
      canonicalUrl,
      image: share.image,
      imageWidth: share.imageWidth,
      imageHeight: share.imageHeight,
      imageAlt: name,
    },
    snapshot: {
      id: `development-${segment}`,
      heading,
      intro: description,
      images: str(data.coverImage) ? [{ src: str(data.coverImage)!, alt: name }] : [],
      links: [
        { href: `${FAMILY_LIST_PATHS.development}/${slug}`, label: name },
        {
          href: FAMILY_LIST_PATHS[segment === 'properties' ? 'property' : 'parking'],
          label: segment === 'properties' ? 'All stays' : 'All parking',
        },
      ],
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Developments', path: FAMILY_LIST_PATHS.development },
        { name, path: `${FAMILY_LIST_PATHS.development}/${slug}` },
      ],
    },
  };
}

// --- llms.txt ----------------------------------------------------------------------------

const LLMS_SUMMARY =
  'Book condos, homes and parking across the Philippines. Browse by place, check dates and reserve online with the host.';

/** Top places per family, from the same index the list pages read. Best effort. */
async function llmsPlaces(
  deps: SeoMiddlewareDeps
): Promise<Array<{ label: string; path: string; count?: number }>> {
  const families: Array<[RouteFamily, string]> = [
    ['property', 'properties'],
    ['parking', 'parkings'],
    ['development', 'developments'],
  ];
  const places: Array<{ label: string; path: string; count?: number }> = [];

  for (const [family, routeFamily] of families) {
    try {
      const body = await getJson(
        `${apiBase(deps)}/list-public-place-groups?family=${routeFamily}&groupLimit=8&previewSize=1`,
        deps
      );
      for (const group of records(body?.groups)) {
        const slug = str(group.locationSlug);
        const place = str(group.place);
        if (!slug || !place) continue;
        places.push({
          label: `${place} ${family === 'parking' ? 'parking' : family === 'development' ? 'developments' : 'stays'}`,
          path: `${FAMILY_LIST_PATHS[family]}/in/${slug}`,
          count: num(group.total) ?? undefined,
        });
      }
    } catch {
      // A missing family is not a reason to fail the whole file.
    }
  }

  return places;
}

/** Every ACTIVE listing the sitemap knows, capped for `llms-full.txt`. */
async function llmsListings(deps: SeoMiddlewareDeps): Promise<LlmsListing[]> {
  const families: Array<[RouteFamily, string]> = [
    ['property', 'list-public-properties'],
    ['parking', 'list-public-parkings'],
    ['development', 'list-public-developments'],
  ];
  const listings: LlmsListing[] = [];

  for (const [family, endpoint] of families) {
    try {
      const body = await getJson(`${apiBase(deps)}/${endpoint}?pageSize=48`, deps);
      for (const card of records(body?.data)) {
        const name = str(card.name);
        const slug = str(card.slug);
        if (!name || !slug) continue;
        listings.push({
          name,
          path: `${FAMILY_LIST_PATHS[family]}/${slug}`,
          kind: family,
          place: str(card.locationLabel) ?? str(card.city),
          priceFrom: num(card.price),
        });
      }
    } catch {
      // Ignore a family that failed; the file still lists the rest.
    }
  }

  return listings;
}

// --- structured data ---------------------------------------------------------------------

/** Site-wide entities every snapshot page carries. */
function siteJsonLdNodes(deps: SeoMiddlewareDeps, siteOrigin: string) {
  const logo = `${siteOrigin}/brand/kame-space-mark-120.png`;
  return [
    buildOrganizationJsonLd({
      name: deps.siteName,
      url: `${siteOrigin}/`,
      logo,
      sameAs: deps.socialLinks ?? [],
      email: deps.supportEmail ?? null,
    }),
    buildWebSiteJsonLd({
      name: deps.siteName,
      url: `${siteOrigin}/`,
    }),
  ];
}

function breadcrumbNodes(
  snapshot: SnapshotPage,
  siteOrigin: string,
  canonicalUrl: string
): Record<string, unknown> | null {
  const crumbs = snapshot.breadcrumbs;
  if (!crumbs?.length) return null;
  return buildBreadcrumbJsonLd(
    crumbs.map((crumb) => ({
      name: crumb.name,
      // The trailing crumb is the current page, so it takes the canonical URL.
      url: crumb.path ? `${siteOrigin}${crumb.path}` : canonicalUrl,
    }))
  );
}

/** Items for an ItemList from the snapshot's own links, minus navigation links. */
function itemListNodes(snapshot: SnapshotPage): Record<string, unknown> | null {
  const links = snapshot.links ?? [];
  if (links.length === 0) return null;
  return buildItemListJsonLd({
    name: snapshot.heading,
    items: links.map((link) => ({ name: link.label, url: link.href })),
  });
}

/** FAQPage for /support, from the same published FAQs the page renders. */
async function supportFaqNodes(deps: SeoMiddlewareDeps): Promise<Record<string, unknown> | null> {
  try {
    const body = await getJson(`${apiBase(deps)}/list-public-support-faqs`, deps);
    const rows = records(body?.data);
    return buildFaqJsonLd(
      rows
        .map((row) => ({ question: str(row.question) ?? '', answer: str(row.answer) ?? '' }))
        .filter((row) => row.question && row.answer)
    );
  } catch {
    return null;
  }
}

/** SoftwareApplication + one Offer per published plan for /for-hosts/pricing. */
async function pricingNodes(deps: SeoMiddlewareDeps): Promise<Record<string, unknown> | null> {
  try {
    const body = await getJson(`${apiBase(deps)}/list-public-pricing-plans`, deps);
    const rows = records(body?.data);
    if (rows.length === 0) return null;
    return buildSoftwareApplicationJsonLd({
      name: `${deps.siteName} for hosts`,
      offers: rows.map((row) => ({
        name: str(row.name) ?? '',
        description: str(row.tagline),
        price: num(row.pricePhp),
        currency: 'PHP',
      })),
    });
  } catch {
    return null;
  }
}

/** `Organization` for a host page, with the listings it offers. */
function hostOfferCatalog(
  snapshot: SnapshotPage,
  siteOrigin: string,
  canonicalUrl: string
): Record<string, unknown> | null {
  const links = snapshot.links ?? [];
  if (links.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: snapshot.heading,
    url: canonicalUrl,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${snapshot.heading} listings`,
      itemListElement: links.slice(0, 24).map((link) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Accommodation',
          name: link.label,
          url: `${siteOrigin}${link.href}`,
        },
      })),
    },
  };
}

// --- dispatch ----------------------------------------------------------------------------

type Resolved =
  | { kind: 'page'; meta: SeoMeta; snapshot: SnapshotPage }
  | { kind: 'redirect'; to: string }
  | { kind: 'missing' }
  | null;

async function resolveRoute(pathname: string, deps: SeoMiddlewareDeps): Promise<Resolved> {
  const canonicalUrl = canonicalUrlFor(deps.siteOrigin ?? PRODUCTION_SITE_ORIGIN, pathname);

  const listing = matchListingDetailPath(pathname);
  if (listing) {
    const resolved = await loadListingRoute(listing.family, listing.slug, canonicalUrl, deps);
    if (resolved) return { kind: 'page', ...resolved };
    const to = await probeSlugRedirect(detailEndpoint(listing.family, listing.slug, deps), deps);
    return to ? { kind: 'redirect', to } : { kind: 'missing' };
  }

  const place = matchPlacePath(pathname);
  if (place) {
    const resolved = await loadPlaceRoute(place.family, place.place, canonicalUrl, deps);
    return resolved ? { kind: 'page', ...resolved } : { kind: 'missing' };
  }

  const host = matchHostPath(pathname);
  if (host) {
    const resolved = await loadHostRoute(host.orgSlug, canonicalUrl, deps);
    return resolved ? { kind: 'page', ...resolved } : { kind: 'missing' };
  }

  const developmentSubPage = pathname.match(
    /^\/developments\/([a-z0-9-]+)\/(properties|parking)\/?$/
  );
  if (developmentSubPage?.[1] && developmentSubPage[2]) {
    const resolved = await loadDevelopmentSubPage(
      developmentSubPage[1],
      developmentSubPage[2] as 'properties' | 'parking',
      canonicalUrl,
      deps
    );
    return resolved ? { kind: 'page', ...resolved } : { kind: 'missing' };
  }

  const entry = matchStaticRoute(pathname);
  if (!entry) return null;
  if (!entry.indexable) return null;

  return { kind: 'page', ...buildStaticRoute(entry, canonicalUrl, deps) };
}

/**
 * Returns a Response to send, or null to pass the request through unchanged.
 * `loadShell` fetches the built SPA index.html for this deployment.
 */
export async function handleSeoRequest(
  request: Request,
  deps: SeoMiddlewareDeps,
  loadShell: () => Promise<string | null>
): Promise<Response | null> {
  try {
    const url = new URL(request.url);
    const siteOrigin = (deps.siteOrigin ?? PRODUCTION_SITE_ORIGIN).replace(/\/+$/, '');

    if (url.pathname === '/robots.txt') {
      // Production hosts are always indexable; `SEO_INDEXABLE_HOSTS` can only add.
      // A stale Vercel env (e.g. one that predates the kamespace rebrand) must never
      // de-index the live domain.
      const hostsForRobots = deps.indexableHosts?.length
        ? [...new Set([...DEFAULT_INDEXABLE_HOSTS, ...deps.indexableHosts])]
        : undefined;
      return new Response(buildRobotsTxt(url.origin, hostsForRobots, siteOrigin), {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=3600, s-maxage=86400',
        },
      });
    }

    if (url.pathname === '/sitemap.xml') {
      const doFetch = deps.fetchImpl ?? fetch;
      const res = await doFetch(`${apiBase(deps)}/public-sitemap${url.search}`, {
        headers: { apikey: deps.anonKey, Authorization: `Bearer ${deps.anonKey}` },
        signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS * 4),
      });
      if (!res.ok) return null;
      return new Response(await res.text(), {
        headers: {
          'content-type': 'application/xml; charset=utf-8',
          'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }

    const indexableHosts = deps.indexableHosts?.length
      ? [...new Set([...DEFAULT_INDEXABLE_HOSTS, ...deps.indexableHosts])]
      : DEFAULT_INDEXABLE_HOSTS;
    const hostIsIndexable = indexableHosts.includes(url.hostname);

    if (url.pathname === '/llms.txt' || url.pathname === '/llms-full.txt') {
      const headers = {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400',
      };
      if (!hostIsIndexable) {
        return new Response(buildLlmsTxtUnavailable(deps.siteName), { headers });
      }
      const full = url.pathname === '/llms-full.txt';
      const input = {
        siteOrigin,
        siteName: deps.siteName,
        summary: deps.summary?.trim() || LLMS_SUMMARY,
        places: await llmsPlaces(deps),
        listings: full ? await llmsListings(deps) : undefined,
      };
      const body = full ? buildLlmsFullTxt(input) : buildLlmsTxt(input);
      return new Response(body, { headers });
    }

    if (deps.indexNowKey && url.pathname === `/${deps.indexNowKey}.txt`) {
      return new Response(`${deps.indexNowKey}\n`, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=86400',
        },
      });
    }

    // Every public route is lowercase. A mixed-case link (a paste from a doc, a hand-typed
    // URL) would otherwise render the SPA 404 for a page that exists.
    const lowerPath = url.pathname.toLowerCase();
    if (lowerPath !== url.pathname) {
      return new Response(null, {
        status: 301,
        headers: { location: `${siteOrigin}${lowerPath}${url.search}` },
      });
    }

    if (request.method !== 'GET' || !isCrawlerUserAgent(request.headers.get('user-agent'))) {
      return null;
    }

    const resolved = await resolveRoute(url.pathname, deps);
    if (!resolved) return null;

    const shell = await loadShell();
    if (!shell) return null;

    const headers = {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600',
      vary: 'user-agent',
    };

    if (resolved.kind === 'redirect') {
      const location = /^https?:\/\//i.test(resolved.to)
        ? resolved.to
        : `${siteOrigin}${resolved.to}`;
      return new Response(null, { status: 301, headers: { ...headers, location } });
    }

    if (resolved.kind === 'missing') {
      // A crawler asked for a slug the catalogue does not have. Answer with a real 404 so
      // Google stops reporting these as Soft 404s; browsers keep the SPA shell.
      const html = injectMetaIntoHtml(shell, {
        title: title(deps.siteName, 'Page not found'),
        description: 'This listing is no longer available.',
        canonicalUrl: `${siteOrigin}/`,
        noindex: true,
      });
      return new Response(html, { status: 404, headers });
    }

    const canonicalUrl = canonicalUrlFor(siteOrigin, url.pathname);
    const extra: Array<Record<string, unknown> | null> = [
      ...siteJsonLdNodes(deps, siteOrigin),
      breadcrumbNodes(resolved.snapshot, siteOrigin, canonicalUrl),
    ];

    switch (resolved.snapshot.id) {
      case 'support':
        extra.push(await supportFaqNodes(deps));
        break;
      case 'for-hosts-pricing':
        extra.push(await pricingNodes(deps));
        break;
      case 'host-public':
        extra.push(hostOfferCatalog(resolved.snapshot, siteOrigin, canonicalUrl));
        break;
      default:
        if (
          resolved.snapshot.id.endsWith('-place') ||
          resolved.snapshot.id.startsWith('development-')
        ) {
          extra.push(itemListNodes(resolved.snapshot));
        }
        break;
    }

    const jsonLd = combineJsonLd([
      ...extra,
      ...(Array.isArray(resolved.meta.jsonLd)
        ? (resolved.meta.jsonLd as ReadonlyArray<Record<string, unknown>>)
        : resolved.meta.jsonLd
          ? [resolved.meta.jsonLd as Record<string, unknown>]
          : []),
    ]);

    const withMeta = injectMetaIntoHtml(shell, { ...resolved.meta, jsonLd });
    const html = injectSnapshotIntoHtml(
      withMeta,
      renderSnapshotHtml(resolved.snapshot, siteOrigin)
    );
    return new Response(html, { headers });
  } catch {
    return null;
  }
}

/** Exported for tests and for the snapshot budget check. */
export const SEO_SNAPSHOT_DEFAULTS = {
  image: DEFAULT_SOCIAL_IMAGE,
  description: DEFAULT_DESCRIPTION,
} as const;
