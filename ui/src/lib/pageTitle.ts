import { useEffect } from 'react';

import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { matchStaticRoute } from '@/lib/seo/publicRoutes';
import { buildPageTitle } from '@/lib/seo/seoMeta';

export { APP_TITLE, PLATFORM_APP_NAME, appPageTitle } from '@/lib/platformBranding';

/**
 * Public marketing tab title, brand last: `{Page} | Kame Space`.
 *
 * Dashboard titles keep the existing `Kame Space - {Page}` shape (they are `noindex`), so
 * this lives here rather than in `appPageTitle`.
 */
export function publicPageTitle(pageName: string): string {
  return buildPageTitle(pageName, PLATFORM_APP_NAME);
}

/** Registry title for a static public route, e.g. `/about`. */
export function publicRouteTitle(pathname: string): string | undefined {
  return matchStaticRoute(pathname)?.title;
}

/** Sets `document.title` from the route registry. No-op for unregistered paths. */
export function usePublicRouteTitle(pathname: string): void {
  usePageTitle(publicRouteTitle(pathname));
}

/**
 * Sets `document.title` when the page renders.
 * Pass `undefined` to skip the effect while data is loading (the shell or
 * index.html fallback will remain visible).
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title === undefined) return;
    document.title = title;
  }, [title]);
}

/** Build a page title for an org-level dashboard page. */
export function orgPageTitle(orgName: string, pageName: string): string {
  return `${orgName} - ${pageName}`;
}

/** Build a page title for a public property-scoped page. */
export function propertyPublicPageTitle(propertyName: string, pageName: string): string {
  return `${propertyName} - ${pageName}`;
}

/** Build a page title for a property-level dashboard page. */
export function propertyDashboardPageTitle(propertyName: string, pageName: string): string {
  return `${propertyName} - ${pageName}`;
}

/** Build a page title for a parking-level dashboard page. */
export function parkingDashboardPageTitle(
  orgName: string,
  parkingName: string,
  pageName: string
): string {
  return `${orgName} - ${parkingName} - ${pageName}`;
}
