---
title: 'SEO and AI search visibility — how it works'
status: active
tags: [architecture, seo, aeo, middleware, public-site]
updated: 2026-11-11
---

# SEO and AI search visibility

How the public guest site (`kamespace.com`) is made crawlable, canonical, and citable by both
classic search engines and AI answer engines.

Plan of record: [`docs/workflow/in-progress/seo-and-ai-search-visibility.md`](../workflow/in-progress/seo-and-ai-search-visibility.md).

## The problem this solves

The app is a Vite SPA. `index.html` ships `<div id="root"></div>` and every page is painted by
JavaScript. Google renders JS; **GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, CCBot,
Bingbot and every link-preview bot mostly do not.** Before this work those crawlers received an
empty page: no text, no `<h1>`, no links, wrong canonical. `bun run seo:audit` against
production on 2026-11-10 recorded exactly that (17 sitemap URLs, all `h1-count 0`,
`canonical-missing`).

## Pieces

| Piece                       | File                                                    | Job                                                                                    |
| --------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Public route registry**   | `ui/src/lib/seo/publicRoutes.ts`                        | One row per guest route: indexable, in sitemap, canonical policy, snapshot kind, copy. |
| **Canonical origin**        | `ui/src/lib/seo/siteOrigin.ts`                          | `https://kamespace.com` always; `VITE_CANONICAL_APP_ORIGIN` overrides.                 |
| **Shared page copy**        | `ui/src/lib/seo/content/staticPageCopy.ts`              | The exact strings a static page renders, imported by page **and** snapshot.            |
| **Crawler snapshot**        | `ui/src/lib/seo/snapshot/renderSnapshot.ts`             | Semantic HTML for `#root`: one `<h1>`, facts, links, images with alt.                  |
| **Request routing**         | `ui/src/lib/seo/seoMiddleware.ts`                       | robots, sitemap proxy, per-route snapshot, 404 for dead slugs. Fail-open.              |
| **Vercel entry point**      | `ui/middleware.ts`                                      | Matcher + env. Passes browsers straight through.                                       |
| **Meta for JS crawlers**    | `ui/src/lib/seo/usePageMeta.ts`                         | Description, canonical, OG/Twitter, JSON-LD, robots; cleans up on unmount.             |
| **Robots / sitemap bodies** | `ui/src/lib/seo/seoMeta.ts`, `_shared/publicSitemap.ts` | robots rules + AI groups; sitemap URLs from `public_listing_search`.                   |
| **Guards**                  | `scripts/seo/check-seo-routes.ts`                       | Registry vs router vs sitemap vs `public/robots.txt`. Runs in CI and `ci:quality`.     |
| **Audit**                   | `scripts/seo/crawl-audit.ts`                            | Reads the sitemap, fetches as crawler + browser, reports gaps. Report-only by default. |

## Adding a public route

1. Add the route module under `ui/src/features/guest/**/routes/`.
2. Add an entry to `PUBLIC_ROUTES` in `ui/src/lib/seo/publicRoutes.ts`:
   - `indexable: true` only for pages a stranger should land on.
   - `inSitemap: true` only for static pages (dynamic URLs come from the database).
   - `snapshot: 'static' | 'listing' | 'place' | 'host' | 'none'`.
   - `title` + `description` for every indexable static route (120-160 characters).
3. If `snapshot: 'static'` and the page has hero copy, move that copy into
   `ui/src/lib/seo/content/staticPageCopy.ts` and import it from the page. The snapshot renders
   the same string, so crawler HTML never contains text the page does not show.
4. Call `usePageMeta({})` in the page (or pass richer values).
5. If the route is private, add a matching prefix to `ROBOTS_DISALLOW`.
6. Run `bun run seo:generate-robots` and `bun run check:seo-routes`.

`check:seo-routes` fails when a router path has no registry entry, when a registry static route
is missing from `STATIC_SITEMAP_PATHS`, when an indexable route is blocked by robots, or when
`ui/public/robots.txt` drifts from `ROBOTS_DISALLOW`.

## Canonical rules

- Canonical, `og:url`, sitemap `<loc>`, robots `Sitemap:` and JSON-LD `url` always use the
  canonical origin. Never the request host: `www.`, Vercel previews and `kamehomes.space` all
  serve the same pages.
- Query strings are dropped (filters, map bounds, UTM, `?property=`).
- Trailing slashes 308 to the slashless path (`trailingSlash: false` in `ui/vercel.json`).
- `www.kamespace.com` 301s to the apex for every path except service-worker and manifest
  assets.
- `app.kamespace.com` is deliberately **not** redirected yet; its role as a dashboard entry is
  unconfirmed.

## Crawler snapshot rules

- User agents matched by `isCrawlerUserAgent` get the snapshot; everyone else gets `next()`.
- Exactly one `<h1>`. List pages carry no `<h1>` in the SPA today, so their snapshot heading
  comes from the registry title. That is server markup only; the UI is unchanged.
- Every link is absolute on the canonical origin.
- `createRoot` replaces the markup at hydration, so a browser never sees it. `seo:audit`
  asserts a browser UA does not receive `data-seo-route`.
- Any error, timeout or missing shell returns `null` and the request falls through to the SPA.
- A slug the catalogue does not have returns **404 + `noindex`** to crawlers, which removes the
  Soft 404 class of reports. Browsers keep the SPA shell and render `NotFoundPage`.

## robots.txt

- Served dynamically by the middleware; `ui/public/robots.txt` is the generated fallback.
- Non-production hosts (dev, Vercel previews) get `Disallow: /`.
- The `Sitemap:` line always points at the apex.
- AI answer engines are listed explicitly and allowed, with the same private-path disallows as
  `*`. `CCBot` is allowed on purpose (it feeds many smaller models). The comment in
  `publicRoutes.ts` records that product decision.

## sitemap.xml

- Served by the `public-sitemap` edge function through the middleware.
- URLs: static registry pages, every ACTIVE listing, every place page. Above 45,000 URLs the
  root becomes a sitemap index of `?part=N` files.
- `<loc>` uses `PUBLIC_GUEST_APP_ORIGIN` (server) which defaults to the same apex.

## AI discovery files

| File                            | Source                                | Notes                                                                                                                             |
| ------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/llms.txt`                     | `ui/src/lib/seo/llmsTxt.ts`           | H1, summary, then links per section. Built from the registry plus top places from the public place-group index. Nothing invented. |
| `/llms-full.txt`                | same module                           | The map plus one line per ACTIVE listing, capped at 2,000.                                                                        |
| `/{INDEXNOW_KEY}.txt`           | middleware                            | Key file for Bing and Yandex.                                                                                                     |
| `indexnow-submit` edge function | `supabase/functions/indexnow-submit/` | Batch-submits the sitemap URL list. Cron-only, `X-Indexnow-Cron-Secret`. Fails open.                                              |

Both `llms` files are PII-free by construction: `isPublicSafe` rejects emails, phone numbers
and street addresses, and the same guard is asserted in `llmsTxt.test.ts`. A non-indexable host
gets a three-line file that points at production.

## Verification

```bash
bun run check:seo-routes                         # registry vs router vs sitemap vs robots.txt
bun run seo:audit -- --origin https://kamespace.com --limit 100
bun run seo:audit -- --origin https://<preview>.vercel.app --fail-on-error
bun run images:budget                        # public raster budget
node scripts/media/generate-hero-variants.mjs # hero AVIF + WebP width variants
bun run test                                     # seoMeta, publicRoutes, siteOrigin, snapshot, middleware
```

Reports land in `docs/workflow/in-progress/seo-evidence/`.

## Related

- Route guides: [`docs/guides/routes/`](../guides/routes/README.md)
- Sitemap builder: `supabase/functions/_shared/publicSitemap.ts`
- Plan: [`docs/workflow/in-progress/seo-and-ai-search-visibility.md`](../workflow/in-progress/seo-and-ai-search-visibility.md)
