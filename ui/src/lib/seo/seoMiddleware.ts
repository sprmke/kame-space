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
  buildDevelopmentJsonLd,
  buildPageTitle,
  buildParkingJsonLd,
  buildPropertyJsonLd,
  buildRobotsTxt,
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
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === 'object') as Json[]) : [];
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

/** `makati-city` → `Makati City`. Used only when no edge payload carries a readable label. */
function placeLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  // registry title. Everything else reuses the page's own hero copy.
  const heading = copy?.heading ?? entry.title ?? deps.siteName;
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
    const developmentSlug = str(data.developmentSlug) ?? str(data.residenceSlug);
    if (developmentSlug) {
      links.push({
        href: `${FAMILY_LIST_PATHS.development}/${developmentSlug}`,
        label: str(data.residenceName) ?? 'Development',
      });
    }
    const hostSlug = str(data.hostSlug) ?? str(data.orgSlug);
    if (hostSlug) links.push({ href: `/hosts/${hostSlug}`, label: 'Host profile' });

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
            city: str(data.city),
            province: str(data.province),
            country: str(data.country),
          },
          rating: num(data.rating),
          reviewCount: num(data.reviewCount) ?? 0,
          priceFrom: price,
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
          image: str(data.coverImage),
          address: {
            city: str(data.city),
            province: str(data.province),
            country: str(data.country),
          },
          priceFrom: rate,
        }),
      },
      snapshot: {
        id: 'parking-detail',
        heading: name,
        intro: description,
        facts,
        images: str(data.coverImage) ? [{ src: str(data.coverImage)!, alt: name }] : [],
        links: [{ href: FAMILY_LIST_PATHS.parking, label: 'All parking' }],
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
        image: str(data.coverImage),
        city: str(data.city),
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
      links: listingLinks(cards, family),
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

// --- dispatch ----------------------------------------------------------------------------

type Resolved =
  | { kind: 'page'; meta: SeoMeta; snapshot: SnapshotPage }
  | { kind: 'missing' }
  | null;

async function resolveRoute(pathname: string, deps: SeoMiddlewareDeps): Promise<Resolved> {
  const canonicalUrl = canonicalUrlFor(deps.siteOrigin ?? PRODUCTION_SITE_ORIGIN, pathname);

  const listing = matchListingDetailPath(pathname);
  if (listing) {
    const resolved = await loadListingRoute(listing.family, listing.slug, canonicalUrl, deps);
    return resolved ? { kind: 'page', ...resolved } : { kind: 'missing' };
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

  const developmentSubPage = pathname.match(/^\/developments\/([a-z0-9-]+)\/(properties|parking)\/?$/);
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
      const indexableHosts = deps.indexableHosts?.length
        ? [...new Set([...DEFAULT_INDEXABLE_HOSTS, ...deps.indexableHosts])]
        : undefined;
      return new Response(buildRobotsTxt(url.origin, indexableHosts, siteOrigin), {
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

    const withMeta = injectMetaIntoHtml(shell, resolved.meta);
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
