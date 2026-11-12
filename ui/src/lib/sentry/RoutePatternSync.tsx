import { useEffect } from 'react';

import { useLocation } from 'react-router-dom';

import { routePatternFor } from '@/lib/telemetry/routePattern';

import { setSentryRoutePattern } from './scope';

/**
 * Gives every Sentry transaction and every PostHog event a route pattern.
 *
 * The app renders one splat route (`{ path: '*' }`) and puts `<Routes>` inside `AppRoutes`, so
 * router-based integrations can only see `/*`. Every browser transaction was named `/*`, which
 * made per-route latency, and the boot measurements attached to it, unreadable.
 *
 * Separate from `SentrySurfaceSync` only because they answer different questions: surface is
 * "which audience", pattern is "which page".
 */
export function RoutePatternSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    setSentryRoutePattern(routePatternFor(pathname));
  }, [pathname]);

  return null;
}
