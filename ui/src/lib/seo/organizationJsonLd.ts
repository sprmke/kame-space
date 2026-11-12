import { FORMER_PLATFORM_APP_NAME, PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { siteOrigin } from '@/lib/seo/canonicalOrigin';
import { buildOrganizationJsonLd, buildWebSiteJsonLd, combineJsonLd } from '@/lib/seo/seoMeta';

/** Public social profiles configured for this deployment, for `Organization.sameAs`. */
function socialLinks(): string[] {
  return [
    import.meta.env.VITE_PLATFORM_SOCIAL_FACEBOOK,
    import.meta.env.VITE_PLATFORM_SOCIAL_INSTAGRAM,
    import.meta.env.VITE_PLATFORM_SOCIAL_TWITTER,
  ].filter((href): href is string => Boolean(href && href.trim()));
}

/**
 * Site-wide `Organization` + `WebSite` structured data for JS crawlers.
 *
 * The crawler snapshot (`ui/src/lib/seo/seoMiddleware.ts`) emits the same entities for bots
 * that do not run JS, so both paths share the builders in `seoMeta.ts`.
 *
 * Injected at runtime instead of living in `ui/index.html` because the CSP is hash-free and
 * `check-csp-theme-hash.sh` forbids inline script bodies there. It also keeps the name
 * env-driven instead of hardcoding it in the shell.
 *
 * `alternateName` keeps the former product name discoverable for search engines for 6 to 12
 * months after the rename.
 */
export function installOrganizationJsonLd(doc: Document = document): void {
  if (doc.querySelector('script[data-organization-jsonld]')) return;

  const origin = siteOrigin();
  const graph = combineJsonLd([
    buildOrganizationJsonLd({
      name: PLATFORM_APP_NAME,
      alternateName: FORMER_PLATFORM_APP_NAME,
      url: `${origin}/`,
      logo: `${origin}/images/logo.png`,
      sameAs: socialLinks(),
      email: import.meta.env.VITE_PLATFORM_CONTACT_EMAIL?.trim() || null,
    }),
    buildWebSiteJsonLd({
      name: PLATFORM_APP_NAME,
      alternateName: FORMER_PLATFORM_APP_NAME,
      url: `${origin}/`,
    }),
  ]);
  if (!graph) return;

  const script = doc.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.organizationJsonld = 'true';
  script.textContent = JSON.stringify(graph);

  doc.head.appendChild(script);
}
