/**
 * Vercel Routing Middleware (project root = ui/), fail-open:
 * - /robots.txt and /sitemap.xml (the sitemap is proxied from the `public-sitemap` edge function)
 * - every indexable public route, for crawler user agents only, gets a semantic HTML snapshot
 *   in `#root` plus full meta tags, so bots that do not run JS still see real content.
 * Everything else, and any error, continues to the normal SPA response.
 * Logic + tests: src/lib/seo/seoMiddleware.ts.
 */

import { next } from '@vercel/functions';

import { handleSeoRequest } from './src/lib/seo/seoMiddleware';
import { resolveSiteOrigin } from './src/lib/seo/siteOrigin';

// Vercel runs Routing Middleware on Node; only env reads are needed here.
declare const process: { env: Record<string, string | undefined> };

export const config = {
  // Static assets short-circuit at the CDN, so the catch-all stays cheap.
  matcher: [
    '/robots.txt',
    '/sitemap.xml',
    '/llms.txt',
    '/llms-full.txt',
    '/((?!assets/|brand/|icons/|favicon|fonts/|images/|marketing/|avatars/|templates/|splash/|worklets/|ingest/|sw\\.js|manifest\\.webmanifest|pwa-version\\.json|offline\\.html|robots\\.txt|sitemap\\.xml).*)',
  ],
};

export default async function middleware(request: Request): Promise<Response> {
  const functionsUrl = process.env.VITE_SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (!functionsUrl || !anonKey) return next();

  const indexableHosts = (process.env.SEO_INDEXABLE_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  const response = await handleSeoRequest(
    request,
    {
      functionsUrl,
      anonKey,
      siteName: process.env.VITE_PLATFORM_APP_NAME?.trim() || 'Kame Space',
      siteOrigin: resolveSiteOrigin(process.env.VITE_CANONICAL_APP_ORIGIN),
      imageTransforms: process.env.VITE_SUPABASE_IMAGE_TRANSFORMS === 'true',
      indexNowKey: process.env.INDEXNOW_KEY?.trim() || null,
      supportEmail: process.env.VITE_PLATFORM_CONTACT_EMAIL?.trim() || null,
      socialLinks: [
        process.env.VITE_PLATFORM_SOCIAL_FACEBOOK,
        process.env.VITE_PLATFORM_SOCIAL_INSTAGRAM,
        process.env.VITE_PLATFORM_SOCIAL_TWITTER,
      ].filter((href): href is string => Boolean(href && href.trim())),
      // Empty or unset keeps the production defaults in seoMeta.ts.
      indexableHosts: indexableHosts.length > 0 ? indexableHosts : undefined,
    },
    async () => {
      const res = await fetch(new URL('/index.html', request.url), {
        signal: AbortSignal.timeout(2_500),
      });
      return res.ok ? res.text() : null;
    }
  );
  return response ?? next();
}
