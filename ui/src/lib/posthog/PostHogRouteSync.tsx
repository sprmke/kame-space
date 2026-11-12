import { useEffect } from 'react';

import { useLocation } from 'react-router-dom';

import { posthog } from '@/lib/posthog/client';
import { surfaceForPath } from '@/lib/posthog/context';
import { routePatternFor } from '@/lib/telemetry/routePattern';

/**
 * Registers `route_pattern` and `surface` as PostHog **super properties**.
 *
 * This is not the same as `buildSharedAnalyticsProperties`. That builder only decorates events we
 * capture ourselves; the SDK's automatic `$pageview` never sees it. Without a super property, every
 * page view arrives with a raw URL and one page is split across tenants — measured 2026-11-12:
 * 1,146 page views, none carrying a route pattern.
 *
 * Super properties persist for the session and are attached to every subsequent event, so this
 * only runs on navigation. Values are route templates, never slugs or ids.
 */
export function PostHogRouteSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      posthog.register({
        route_pattern: routePatternFor(pathname),
        surface: surfaceForPath(pathname),
      });
    } catch {
      // Analytics being unavailable must never affect navigation.
    }
  }, [pathname]);

  return null;
}
