/**
 * Intent-based chunk prefetch map for the admin navigation (sidebar, phone tab bar,
 * AI-mode targets).
 *
 * Each entry mirrors the exact `import()` call made by that page's `React.lazy()`
 * definition, so calling a loader here warms the same Vite/Rollup chunk the real route
 * will fetch, without adding a second lazy boundary or changing what renders.
 *
 * **Three maps, not one.** `/org/:orgSlug/bookings` renders `OrgBookingsPage` while
 * `/org/:orgSlug/property/:slug/bookings` renders `BookingsListPage`, and parking has its
 * own page again. A single map keyed by trailing segment warmed the wrong chunk for two of
 * the three scopes: harmless in the sense that nothing broke, useless in the sense that the
 * bytes fetched were never going to be used. Scope is therefore resolved from the path.
 *
 * Keep in sync with the `lazy()` specifiers in each module's routes. A stale entry is
 * harmless (it prefetches something unused), but a stale import specifier fails
 * `type-check` immediately, because these are real dynamic `import()` expressions.
 */

/** `/org/:orgSlug/<segment>` */
export const ORG_NAV_PREFETCH: Record<string, () => Promise<unknown>> = {
  dashboard: () => import('@/features/dashboard/org/pages/OrgDashboardPage'),
  bookings: () => import('@/features/dashboard/org/pages/OrgBookingsPage'),
  reviews: () => import('@/features/reviews/pages/OrgReviewsPage'),
  settings: () => import('@/features/dashboard/org/pages/OrgSettingsPage'),
  properties: () => import('@/features/dashboard/org/pages/OrgPropertiesPage'),
  parkings: () => import('@/features/dashboard/org/pages/OrgParkingsPage'),
  analytics: () => import('@/features/dashboard/analytics/pages/OrgAnalyticsPage'),
  team: () => import('@/features/dashboard/team/pages/OrgTeamPage'),
  plans: () => import('@/features/dashboard/plans/pages/OrgPlansPage'),
};

/** `/org/:orgSlug/property/:propertySlug/<segment>` */
export const PROPERTY_NAV_PREFETCH: Record<string, () => Promise<unknown>> = {
  dashboard: () => import('@/features/dashboard/property/pages/DashboardPage'),
  bookings: () => import('@/features/dashboard/bookings/pages/BookingsListPage'),
  reviews: () => import('@/features/reviews/pages/PropertyReviewsPage'),
  templates: () => import('@/features/dashboard/bookings/pages/TemplatesPage'),
  notifications: () => import('@/features/dashboard/bookings/pages/NotificationsPage'),
  finance: () => import('@/features/dashboard/finance/pages/FinancePage'),
  maintenance: () => import('@/features/dashboard/maintenance/pages/MaintenancePage'),
  pricing: () => import('@/features/dashboard/pricing/pages/PropertyPricingPage'),
  marketing: () => import('@/features/dashboard/marketing/pages/MarketingStudioPage'),
  inbox: () => import('@/features/dashboard/inbox/pages/PropertyInboxPage'),
};

/** `/org/:orgSlug/parking/:parkingSlug/<segment>` */
export const PARKING_NAV_PREFETCH: Record<string, () => Promise<unknown>> = {
  dashboard: () => import('@/features/dashboard/parking/pages/ParkingDashboardPage'),
  bookings: () => import('@/features/dashboard/parking/pages/ParkingBookingsPage'),
  finance: () => import('@/features/dashboard/parking/pages/ParkingFinancePage'),
  pricing: () => import('@/features/dashboard/parking/pages/ParkingPricingPage'),
  settings: () => import('@/features/dashboard/parking/pages/ParkingSettingsPage'),
  notifications: () => import('@/features/dashboard/parking/pages/ParkingNotificationsPage'),
  team: () => import('@/features/dashboard/team/pages/ParkingTeamPage'),
  inbox: () => import('@/features/dashboard/inbox/pages/ParkingInboxPage'),
};

/**
 * Backwards-compatible alias for the property map. Prefer the scope-explicit name in new
 * code; `resolveAdminNavPrefetch` is the usual entry point anyway.
 */
export const ADMIN_NAV_PREFETCH = PROPERTY_NAV_PREFETCH;

/**
 * Resolve a nav href to its loader, or `null` when the section is not prefetchable.
 *
 * Works on the path shape rather than `includes('/parking/')` so an org name that happens
 * to contain the word cannot select the wrong map.
 */
export function resolveAdminNavPrefetch(href: string): (() => Promise<unknown>) | null {
  const segments = href.split('/').filter(Boolean);
  if (segments[0] !== 'org' || segments.length < 3) return null;

  // `/org/:orgSlug/:section`
  if (segments.length === 3) return ORG_NAV_PREFETCH[segments[2]] ?? null;

  const scope = segments[2];
  const map =
    scope === 'parking'
      ? PARKING_NAV_PREFETCH
      : scope === 'property'
        ? PROPERTY_NAV_PREFETCH
        : null;
  if (!map) return null;

  // `/org/:orgSlug/property/:slug` *is* the dashboard, so there is no section segment
  // and the trailing segment is the slug. Same for parking.
  if (segments.length === 4) return map.dashboard ?? null;

  // `/org/:orgSlug/property/:slug/:section`. Anything deeper is a detail route, which is
  // never a nav target, so it resolves to null rather than a guess.
  if (segments.length === 5) return map[segments[4]] ?? null;

  return null;
}
