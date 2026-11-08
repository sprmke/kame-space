import { useLayoutEffect } from 'react';

import { useLocation } from 'react-router-dom';

import { resolveAdminNavPrefetch } from '@/features/dashboard/bookings/lib/adminNavPrefetch';
import { prefetchChunkOnce } from '@/hooks/usePrefetchOnIntent';

/**
 * Starts the matched admin page's chunk download as soon as the shell mounts, instead of
 * after the guard chain resolves its queries.
 *
 * The cold-open order used to be: shell chunk → auth → organizations → properties →
 * property-access → entitlements → **then** the page chunk. The page chunk has no
 * dependency on any of that; it is a static path-to-module mapping. Starting it in parallel
 * removes one serial network phase from every cold open and every first visit to a module.
 *
 * Mounted by each admin shell *outside* its guards on purpose: a guard that blocks rendering
 * must not also block the prefetch, and the prefetch is harmless when a guard later denies
 * access (one wasted chunk on a route the user was never going to see).
 *
 * `prefetchChunkOnce` already skips metered connections and never throws.
 */
export function useAdminRouteChunkPrefetch(): void {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const loader = resolveAdminNavPrefetch(pathname);
    if (!loader) return;
    prefetchChunkOnce(`route-chunk:${pathname}`, loader);
  }, [pathname]);
}
