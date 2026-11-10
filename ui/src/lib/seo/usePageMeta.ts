/**
 * test: N/A — React hook that writes `<head>` tags inside an effect (no return value to
 * assert in the Node test environment). The pure formatting lives in `seoMeta.ts` and
 * `siteOrigin.ts`, which have colocated Vitest coverage.
 */
import { useEffect } from 'react';

import { matchStaticRoute } from '@/lib/seo/publicRoutes';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_SOCIAL_IMAGE,
  SITE_NAME,
  serializeJsonLd,
  truncateDescription,
} from '@/lib/seo/seoMeta';
import { canonicalUrlFor, resolveSiteOrigin } from '@/lib/seo/siteOrigin';

export type PageMetaInput = {
  /** Plain description; truncated to ~160 characters. Omit for the route's registry default. */
  description?: string | null;
  /** Path for the canonical URL (query string dropped). Defaults to the current path. */
  canonicalPath?: string;
  /** Absolute or root-relative image for link previews. */
  image?: string | null;
  /** Title for og:title / twitter:title (document.title stays with usePageTitle). */
  title?: string;
  jsonLd?: Record<string, unknown> | null;
  noindex?: boolean;
};

const MARKER = 'data-seo';

const OWNED_SELECTORS = [
  'meta[name="description"]',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
  'meta[name="robots"]',
  'link[rel="canonical"]',
  'script[type="application/ld+json"]',
] as const;

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  // Always mark, including shell tags from index.html, so cleanup can find them.
  el.setAttribute(MARKER, '');
  el.setAttribute('content', content);
}

function removeOwned(selector: string): void {
  document.head.querySelectorAll(`${selector}[${MARKER}]`).forEach((el) => el.remove());
}

function canonicalOrigin(): string {
  return resolveSiteOrigin(import.meta.env.VITE_CANONICAL_APP_ORIGIN);
}

function absoluteAsset(value: string): string {
  try {
    return new URL(value, canonicalOrigin()).toString();
  } catch {
    return value;
  }
}

/**
 * Description, canonical, Open Graph / Twitter, robots, and JSON-LD for public pages.
 *
 * Crawlers that do not run JS get the same tags from the Vercel middleware; this hook keeps
 * in-app navigation, JS-rendering crawlers and the browser tab in sync.
 *
 * Canonical and `og:url` always use `VITE_CANONICAL_APP_ORIGIN` (apex by default) so previews,
 * `www.` and the legacy domain never self-canonicalize.
 *
 * On unmount every owned tag is removed. The next route re-applies its own, or its registry
 * default, so a listing's canonical can never leak onto `/about`.
 */
export function usePageMeta(input: PageMetaInput, enabled = true): void {
  const { description, canonicalPath, image, title, jsonLd, noindex } = input;
  const jsonLdText = jsonLd ? serializeJsonLd(jsonLd) : null;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const path = canonicalPath ?? window.location.pathname;
    const canonical = canonicalUrlFor(canonicalOrigin(), path);
    const route = matchStaticRoute(path);
    const text = truncateDescription(
      description?.trim() || route?.description || DEFAULT_DESCRIPTION
    );
    const ogTitle = title ?? route?.title ?? document.title ?? SITE_NAME;
    const shouldNoindex = noindex ?? (route ? !route.indexable : false);

    upsertMeta('name', 'description', text);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:title', ogTitle);
    upsertMeta('property', 'og:description', text);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', ogTitle);
    upsertMeta('name', 'twitter:description', text);

    const socialImage = absoluteAsset(image || DEFAULT_SOCIAL_IMAGE);
    upsertMeta('property', 'og:image', socialImage);
    upsertMeta('name', 'twitter:image', socialImage);

    // Static shell dimensions describe the default card, never an arbitrary listing photo.
    for (const key of ['og:image:width', 'og:image:height', 'og:image:alt']) {
      document.head.querySelector(`meta[property="${key}"]`)?.remove();
    }
    document.head.querySelector('meta[name="twitter:image:alt"]')?.remove();
    if (!image) {
      upsertMeta('property', 'og:image:width', '1200');
      upsertMeta('property', 'og:image:height', '630');
      upsertMeta('property', 'og:image:alt', 'KameSpace');
      upsertMeta('name', 'twitter:image:alt', 'KameSpace');
    }

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.setAttribute(MARKER, '');
    link.href = canonical;

    if (shouldNoindex) upsertMeta('name', 'robots', 'noindex');
    else removeOwned('meta[name="robots"]');

    removeOwned('script[type="application/ld+json"]');
    if (jsonLdText) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(MARKER, '');
      script.textContent = jsonLdText;
      document.head.appendChild(script);
    }

    return () => {
      for (const selector of OWNED_SELECTORS) removeOwned(selector);
    };
  }, [enabled, description, canonicalPath, image, title, jsonLdText, noindex]);
}
