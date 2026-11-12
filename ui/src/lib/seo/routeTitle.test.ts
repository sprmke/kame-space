import { describe, expect, it } from 'vitest';

import { PUBLIC_ROUTES, matchStaticRoute } from '@/lib/seo/publicRoutes';
import { publicRouteMeta } from '@/lib/seo/routeTitle';

/**
 * `usePublicStaticRouteSeo` is the only thing giving a static page its description,
 * canonical and robots value now, so the data it reads must be complete. The registry is the
 * source; this pins the contract the hook depends on.
 */
describe('publicRouteMeta', () => {
  it('returns title, description and indexability for every static indexable route', () => {
    for (const route of PUBLIC_ROUTES.filter(
      (entry) => entry.indexable && !entry.pattern.includes(':') && entry.pattern !== '*'
    )) {
      const meta = publicRouteMeta(route.pattern);
      expect(meta, route.pattern).toBeDefined();
      expect(meta?.indexable, route.pattern).toBe(true);
      expect(meta?.title?.length ?? 0, route.pattern).toBeGreaterThan(0);
      expect(meta?.description?.length ?? 0, route.pattern).toBeGreaterThan(70);
    }
  });

  it('marks every non-indexable static route as such, so the page gets noindex', () => {
    for (const route of PUBLIC_ROUTES.filter(
      (entry) => !entry.indexable && entry.pattern !== '*' && !entry.pattern.includes(':')
    )) {
      expect(publicRouteMeta(route.pattern)?.indexable, route.pattern).toBe(false);
    }
  });

  it('returns undefined for dynamic and unknown paths', () => {
    expect(publicRouteMeta('/properties/monaco-2604')).toBeUndefined();
    expect(publicRouteMeta('/not-a-route')).toBeUndefined();
  });

  it('matches the registry title verbatim', () => {
    const entry = matchStaticRoute('/support');
    expect(publicRouteMeta('/support')?.title).toBe(entry?.title);
  });
});
