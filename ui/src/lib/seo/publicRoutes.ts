/**
 * One registry for every guest-facing public route.
 *
 * Three consumers read this file and must never disagree:
 * 1. the SPA (`usePageMeta` defaults, and the `check:seo-routes` guard),
 * 2. the Vercel middleware crawler snapshot (`ui/middleware.ts` → `seoMiddleware.ts`),
 * 3. `scripts/seo/check-seo-routes.mjs`, which compares it against the router, the Deno
 *    sitemap's `STATIC_SITEMAP_PATHS` and `ui/public/robots.txt`.
 *
 * Pure and dependency-free (no `@/` imports, no React): the middleware bundle resolves it by
 * relative path. Adding a public route without adding an entry here fails CI.
 */

export const SITE_ORIGIN_PLACEHOLDER = 'https://kamespace.com';

export { AI_CRAWLER_USER_AGENTS, ROBOTS_DISALLOW, isAllowedByRobots } from './robotsRules';

export type CanonicalPolicy =
  /** Canonical is the route's own path. */
  | 'self'
  /** Canonical is the route's own path, but only once the edge payload resolves the slug. */
  | 'listing'
  /** No canonical tag (redirect aliases, 404). */
  | 'none';

export type SnapshotKind =
  /** Registry-driven static page copy. */
  | 'static'
  /** Requires an edge payload for the slug. */
  | 'listing'
  /** Place browse page (`/{family}/in/{place}`). */
  | 'place'
  /** Host public page (`/hosts/{orgSlug}`). */
  | 'host'
  | 'none';

export type PublicRouteEntry = {
  /** Stable id used by the snapshot renderer and the check script. */
  id: string;
  /** React Router path pattern, always absolute and slashless. */
  pattern: string;
  /** May search engines index it? */
  indexable: boolean;
  /** Belongs in `sitemap.xml`? */
  inSitemap: boolean;
  canonical: CanonicalPolicy;
  snapshot: SnapshotKind;
  /**
   * Final `<title>` for a static route. Always the complete string (brand included), so the
   * page and the crawler HTML emit the same value. Dynamic routes build theirs from data.
   */
  title?: string;
  /** Static meta description, 120-160 characters. Dynamic routes build theirs. */
  description?: string;
  /** Why the route is excluded, or any caveat worth keeping next to the entry. */
  note?: string;
};

export const PUBLIC_ROUTES: readonly PublicRouteEntry[] = [
  {
    id: 'home',
    pattern: '/',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Kame Space: Book condos, homes and parking in the Philippines',
    description:
      'Book condos, homes and parking across the Philippines. Browse by place, check dates and reserve online with the host.',
  },
  {
    id: 'properties',
    pattern: '/properties',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Places to stay in the Philippines | Kame Space',
    description:
      'Browse condos, houses and apartments across the Philippines. Filter by city, dates and guest count, then book with the host.',
  },
  {
    id: 'properties-place',
    pattern: '/properties/in/:location',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'place',
    note: 'Place pages are enumerated from public_listing_search place slugs.',
  },
  {
    id: 'property-detail',
    pattern: '/properties/:propertySlug',
    indexable: true,
    inSitemap: true,
    canonical: 'listing',
    snapshot: 'listing',
  },
  {
    id: 'parkings',
    pattern: '/parkings',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Parking for rent in the Philippines | Kame Space',
    description:
      'Find parking slots near condos, offices and malls across the Philippines. Check availability and reserve online.',
  },
  {
    id: 'parkings-place',
    pattern: '/parkings/in/:location',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'place',
  },
  {
    id: 'parking-detail',
    pattern: '/parkings/:parkingSlug',
    indexable: true,
    inSitemap: true,
    canonical: 'listing',
    snapshot: 'listing',
  },
  {
    id: 'parking-form',
    pattern: '/parkings/:parkingSlug/form',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Booking form; transactional.',
  },
  {
    id: 'parking-request-status',
    pattern: '/parkings/requests/:bookingId',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Per-booking status page.',
  },
  {
    id: 'developments',
    pattern: '/developments',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Condos and parking by development | Kame Space',
    description:
      'Browse condominium developments across the Philippines and see the units and parking slots available in each one.',
  },
  {
    id: 'developments-place',
    pattern: '/developments/in/:location',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'place',
  },
  {
    id: 'development-detail',
    pattern: '/developments/:slug',
    indexable: true,
    inSitemap: true,
    canonical: 'listing',
    snapshot: 'listing',
  },
  {
    id: 'development-properties',
    pattern: '/developments/:slug/properties',
    indexable: true,
    inSitemap: false,
    canonical: 'self',
    snapshot: 'listing',
    note: 'Canonical to itself; only added to the sitemap once it lists at least one unit.',
  },
  {
    id: 'development-parking',
    pattern: '/developments/:slug/parking',
    indexable: true,
    inSitemap: false,
    canonical: 'self',
    snapshot: 'listing',
    note: 'Canonical to itself; only added to the sitemap once it lists at least one slot.',
  },
  {
    id: 'host-public',
    pattern: '/hosts/:orgSlug',
    indexable: true,
    inSitemap: true,
    canonical: 'listing',
    snapshot: 'host',
  },
  {
    id: 'for-hosts',
    pattern: '/for-hosts',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Run your rentals from one dashboard | Kame Space',
    description:
      'Bookings, guest messages, documents, finance and marketing in one host dashboard built for Philippine rentals.',
  },
  {
    id: 'for-hosts-pricing',
    pattern: '/for-hosts/pricing',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Host plans and pricing | Kame Space',
    description:
      'Start free on one listing. Upgrade for automation, marketing, AI and hands-off hosting. Compare host plans and what each one unlocks.',
  },
  {
    id: 'about',
    pattern: '/about',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'About Kame Space',
    description:
      'Kame Space connects guest booking, host operations, messaging, marketing and parking so every Philippine stay has a clear path to check-out.',
  },
  {
    id: 'contact',
    pattern: '/contact',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Contact Kame Space',
    description:
      'Reach the Kame Space team about a stay, host onboarding or your account. Sign in to open a support ticket and track the reply.',
  },
  {
    id: 'support',
    pattern: '/support',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Support and answers | Kame Space',
    description:
      'Short answers for guests and hosts on bookings, payments, documents, check-in and account access. Find the answer, then contact us.',
  },
  {
    id: 'terms',
    pattern: '/terms',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Terms of Service | Kame Space',
    description:
      'The terms that govern use of Kame Space as a guest, host, organization member or visitor of the public site.',
  },
  {
    id: 'privacy',
    pattern: '/privacy',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Privacy Policy | Kame Space',
    description:
      'What Kame Space collects from guests and hosts, how it is used to run a booking, and how to ask for a copy or deletion.',
  },
  {
    id: 'cookies',
    pattern: '/cookies',
    indexable: true,
    inSitemap: true,
    canonical: 'self',
    snapshot: 'static',
    title: 'Cookie Policy | Kame Space',
    description:
      'Which cookies Kame Space sets, what each one is for, and how to change your choice in the browser or in the app.',
  },
  {
    id: 'search',
    pattern: '/search',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Faceted search results; already sets noindex.',
  },
  {
    id: 'services',
    pattern: '/services',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    title: 'Services | Kame Space',
    note: 'Placeholder "Coming Soon" page, noindex until the catalog ships.',
  },
  {
    id: 'for-hosts-preview',
    pattern: '/for-hosts/preview',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redirects to /for-hosts/v2.',
  },
  {
    id: 'for-hosts-v2',
    pattern: '/for-hosts/v2',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redesign preview, not linked from nav.',
  },
  {
    id: 'for-hosts-v3',
    pattern: '/for-hosts/v3',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redesign preview, not linked from nav.',
  },
  {
    id: 'explore-preview',
    pattern: '/explore-preview',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redesign preview, not linked from nav.',
  },
  {
    id: 'home-v2',
    pattern: '/v2',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redesign preview, not linked from nav.',
  },
  {
    id: 'development-parking-category',
    pattern: '/developments/:slug/parking/category',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redirects to /developments/:slug/parking.',
  },
  {
    id: 'development-parking-list',
    pattern: '/developments/:slug/parking/list',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redirects to /developments/:slug/parking.',
  },
  {
    id: 'property-stay-guide',
    pattern: '/properties/:propertySlug/stay-guide',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Decide self canonical vs detail canonical in SEO-4.7 before indexing.',
  },
  {
    id: 'property-showcase',
    pattern: '/properties/:propertySlug/showcase',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Decide self canonical vs detail canonical in SEO-4.7 before indexing.',
  },
  {
    id: 'property-document',
    pattern: '/properties/:propertySlug/document',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Token-scoped booking document.',
  },
  {
    id: 'property-calendar',
    pattern: '/properties/:propertySlug/calendar',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'property-messages',
    pattern: '/properties/:propertySlug/messages',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'property-form',
    pattern: '/properties/:propertySlug/form',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'property-success',
    pattern: '/properties/:propertySlug/success',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'property-trip',
    pattern: '/properties/:propertySlug/trip',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'property-sd-form',
    pattern: '/properties/:propertySlug/sd-form',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'property-guest-review',
    pattern: '/properties/:propertySlug/guest-review',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'property-pay-parking',
    pattern: '/properties/:propertySlug/parking/:bookingId',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'legacy-calendar',
    pattern: '/calendar',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Legacy alias that redirects to the property calendar.',
  },
  {
    id: 'legacy-form',
    pattern: '/form',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Legacy alias that redirects to the property form.',
  },
  {
    id: 'legacy-success',
    pattern: '/success',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'legacy-guest-review',
    pattern: '/guest-review',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'legacy-sd-form',
    pattern: '/sd-form',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'legacy-pay-parking',
    pattern: '/bookings/:bookingId/parking',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'sign-in',
    pattern: '/sign-in',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Legacy alias that redirects to the audience sign-in page.',
  },
  {
    id: 'host-login',
    pattern: '/for-hosts/login',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'host-register',
    pattern: '/for-hosts/register',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redirects to host login; passwordless sign-up happens there.',
  },
  {
    id: 'guest-login',
    pattern: '/for-guests/login',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'guest-register',
    pattern: '/for-guests/register',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'account',
    pattern: '/account',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'account-trips',
    pattern: '/account/trips',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'account-stays',
    pattern: '/account/stays',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'account-profile',
    pattern: '/account/profile',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'account-favorites',
    pattern: '/account/favorites',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'account-vouchers',
    pattern: '/account/vouchers',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'account-reviews',
    pattern: '/account/reviews',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'account-tickets',
    pattern: '/account/tickets',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'account-tickets-any',
    pattern: '/account/tickets/*',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Ticket thread within the guest portal.',
  },
  {
    id: 'account-help',
    pattern: '/account/help',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
  },
  {
    id: 'account-messages',
    pattern: '/account/messages',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redirects to /account/stays.',
  },
  {
    id: 'account-wishlist',
    pattern: '/account/wishlist',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redirects to /account/favorites.',
  },
  {
    id: 'account-settings',
    pattern: '/account/settings',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Redirects to /account/profile.',
  },
  {
    id: 'guest-portal-wildcard',
    pattern: '/for-guests/*',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Catch-all that redirects to guest login.',
  },
  {
    id: 'not-found',
    pattern: '*',
    indexable: false,
    inSitemap: false,
    canonical: 'none',
    snapshot: 'none',
    note: 'Catch-all; NotFoundPage sets noindex.',
  },
] as const;

/** Family browse routes, used by snapshots to link sideways. */
export const FAMILY_LIST_PATHS = {
  property: '/properties',
  development: '/developments',
  parking: '/parkings',
} as const;

export type RouteFamily = keyof typeof FAMILY_LIST_PATHS;

const PLACE_PATTERNS: Array<[RouteFamily, RegExp]> = [
  ['property', /^\/properties\/in\/([a-z0-9-]+)\/?$/],
  ['parking', /^\/parkings\/in\/([a-z0-9-]+)\/?$/],
  ['development', /^\/developments\/in\/([a-z0-9-]+)\/?$/],
];

export function matchPlacePath(pathname: string): { family: RouteFamily; place: string } | null {
  for (const [family, pattern] of PLACE_PATTERNS) {
    const match = pathname.match(pattern);
    if (match?.[1]) return { family, place: match[1] };
  }
  return null;
}

const HOST_PATTERN = /^\/hosts\/([a-z0-9-]+)\/?$/;

export function matchHostPath(pathname: string): { orgSlug: string } | null {
  const match = pathname.match(HOST_PATTERN);
  return match?.[1] ? { orgSlug: match[1] } : null;
}

/** Static (parameterless) entry for a URL path, if the registry has one. */
export function matchStaticRoute(pathname: string): PublicRouteEntry | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return (
    PUBLIC_ROUTES.find(
      (route) =>
        route.pattern === normalized && !route.pattern.includes(':') && route.pattern !== '*'
    ) ?? null
  );
}

/** Every indexable route the sitemap must be able to enumerate. */
export function indexableRoutes(): PublicRouteEntry[] {
  return PUBLIC_ROUTES.filter((route) => route.indexable);
}

/** Static sitemap paths the registry owns, in registry order. */
export function staticSitemapPaths(): string[] {
  return PUBLIC_ROUTES.filter((route) => route.inSitemap && route.snapshot === 'static').map(
    (route) => route.pattern
  );
}
