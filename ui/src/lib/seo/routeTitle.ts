/**
 * Route-level SEO for static public pages, read from the route registry.
 *
 * Kept out of `pageTitle.ts` and `usePageMeta.ts` on purpose: the registry has an entry per
 * guest route, and both of those modules sit in the entry bundle. Only public pages call this,
 * so the registry lands in a lazy chunk instead of the initial payload.
 */

import { matchStaticRoute } from '@/lib/seo/publicRoutes';
import { usePageMeta } from '@/lib/seo/usePageMeta';
import { usePageTitle } from '@/lib/pageTitle';

export type StaticRouteMeta = {
  title?: string;
  description?: string;
  indexable: boolean;
};

/** Registry title, description and indexability for a static route. */
export function publicRouteMeta(pathname: string): StaticRouteMeta | undefined {
  const entry = matchStaticRoute(pathname);
  if (!entry) return undefined;
  return { title: entry.title, description: entry.description, indexable: entry.indexable };
}

/** `document.title` from the registry. No-op for unregistered paths. */
export function usePublicRouteTitle(pathname: string): void {
  usePageTitle(publicRouteMeta(pathname)?.title);
}

/**
 * Title plus meta description, canonical and robots from the registry. This is what a static
 * public page needs; richer pages pass their own values to `usePageMeta` instead.
 */
export function usePublicStaticRouteSeo(pathname: string): void {
  const meta = publicRouteMeta(pathname);
  usePageTitle(meta?.title);
  usePageMeta({
    description: meta?.description,
    canonicalPath: pathname,
    ...(meta && !meta.indexable ? { noindex: true } : {}),
  });
}
