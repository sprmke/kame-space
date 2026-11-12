---
name: seo
description: >-
  Public SEO and AI search visibility for the guest site: the route registry, the crawler
  snapshot, canonical origin, robots and sitemap. Use when adding or changing a guest route,
  page meta tags, structured data, or anything under ui/src/lib/seo/.
---

# SEO — public routes, crawler snapshot, robots

Reference: **`docs/architecture/seo.md`**. Rule: **`.cursor/rules/seo.mdc`**.

## Why it exists

The app is a Vite SPA: `index.html` ships `<div id="root"></div>`. Google runs JS; GPTBot,
OAI-SearchBot, ClaudeBot, PerplexityBot, Bingbot and link-preview bots do not. For those user
agents the Vercel middleware injects a semantic snapshot into `#root` plus full `<head>` tags.

## Files

| Concern                   | File                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| Route registry            | `ui/src/lib/seo/publicRoutes.ts`                                          |
| Canonical origin          | `ui/src/lib/seo/siteOrigin.ts`                                            |
| Shared static page copy   | `ui/src/lib/seo/content/staticPageCopy.ts`                                |
| Snapshot HTML             | `ui/src/lib/seo/snapshot/renderSnapshot.ts`                               |
| Request handling          | `ui/src/lib/seo/seoMiddleware.ts`                                         |
| Vercel entry point        | `ui/middleware.ts`                                                        |
| Meta for JS crawlers      | `ui/src/lib/seo/usePageMeta.ts`                                           |
| robots + JSON-LD builders | `ui/src/lib/seo/seoMeta.ts`                                               |
| Sitemap builder (Deno)    | `supabase/functions/_shared/publicSitemap.ts`                             |
| Guards                    | `scripts/seo/check-seo-routes.ts`, `generate-robots.ts`, `crawl-audit.ts` |

## Workflow: add a public page

1. Add the route in `ui/src/features/guest/**/routes/`.
2. Add a `PUBLIC_ROUTES` entry with `indexable`, `inSitemap`, `canonical`, `snapshot`, and (for
   static pages) `title` + `description`.
3. Move the page's hero copy into `content/staticPageCopy.ts` and import it from the page.
4. Call `usePageMeta({})` in the page.
5. Private route? Add a prefix to `ROBOTS_DISALLOW`.
6. `bun run seo:generate-robots && bun run check:seo-routes`.

## Rules that must not break

- **One `<h1>`** in the snapshot. List pages have none in the SPA, so the snapshot heading comes
  from the registry title (server markup only).
- **No text the page does not show.** Static copy comes from the shared module; dynamic copy
  from the same edge payloads the SPA reads.
- **Apex canonical always.** Previews and `www.` never self-canonicalize.
- **Fail open.** Any error in the middleware returns `next()`, never a 5xx.
- **Browsers never see the snapshot.** `createRoot` replaces it; `seo:audit` asserts a browser
  UA gets no `data-seo-route`.
- **Dead slugs** answer crawlers with 404 + `noindex`; browsers still get the SPA shell.

## Verify

```bash
bun run check:seo-routes
bun run test                                   # seo unit tests
bun run seo:audit -- --origin https://<preview-url> --fail-on-error
```

Reports land in `docs/workflow/done/seo-evidence/`.
