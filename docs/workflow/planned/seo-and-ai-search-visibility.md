---
title: 'SEO and AI search visibility (17-point checklist)'
status: in-progress
tags: [workflow, planned, seo, aeo, public-site, images, performance, middleware]
updated: 2026-11-11
stage: in-progress
kind: plan
---

# SEO and AI search visibility

> **Revised 2026-11-11 (execute-plan):** audited every named path against the code on
> `origin/develop` (`6b856c01`). Drift found and corrected below; scope for this branch is
> Phase 1 + Phase 2 only, per this plan's own execution order (§5) which gates each phase on
> the previous one shipping and being verified on the deploy preview.
>
> - **Drift 1.** The sitemap already builds `<loc>` from `resolvePublicGuestAppOrigin()`
>   (`_shared/publicAppOrigin.ts`), not the request host. F4 applies to robots.txt, canonical
>   and JSON-LD, not to the sitemap. SEO-1.8 restated to match.
> - **Drift 2.** `ui/tsconfig.middleware.json` lists its inputs explicitly. Every new middleware
>   module must be added to `include` or the middleware type-check silently skips it.
> - **Drift 3.** `usePageMeta` runs on 15 pages, not "15 public pages" as claimed: 12 marketing
>   pages plus trip, search and the hook itself. The static-page gap (F2) is real and larger:
>   8 public pages set a title but never call `usePageMeta`.
> - **Drift 4.** `ROBOTS_DISALLOW` already carries `/for-hosts/v2`; the _static_
>   `ui/public/robots.txt` is the file that drifted (missing `/for-hosts/v2` and `/*/trip?`).
>   SEO-2.2 (generate the fallback) is the fix, not a manual edit.
> - **Added:** `## Decisions`, per-phase acceptance commands, an edge-case list, and a rollback
>   line per phase.

Close every gap in a 20-point SEO checklist for the public guest site (`kamespace.com`), with
extra weight on **AI search** (ChatGPT search, Claude, Perplexity, Google AI Overviews, Copilot).

**In scope:** items 1-6, 9-14, 16-20 (17 items).
**Out of scope (user decision, 2026-11-10):** 7 One H1 per page, 8 Heading order, 15 Mobile
layout. These change visible UI and are largely handled already. The crawler HTML in Phase 1
still emits exactly one `<h1>` per page because it is server markup for bots, not a UI change.

Every task has an ID (`SEO-<item>.<n>`) so PRs and commits can reference it. `[x]` means
already shipped (found in the 2026-11-10 audit), `[ ]` means to do.

---

## 1. Audit summary (2026-11-10)

A lot of SEO infrastructure already exists. The plan builds on it rather than replacing it.

| What exists today                                                                         | Where                                                                      |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Vercel Routing Middleware for `/robots.txt`, `/sitemap.xml`, listing detail crawler meta  | `ui/middleware.ts`, `ui/src/lib/seo/seoMiddleware.ts`                      |
| Host-gated robots (`Disallow: /` on dev and previews), disallow list, `Sitemap:` line     | `ui/src/lib/seo/seoMeta.ts#buildRobotsTxt`, `ROBOTS_DISALLOW`              |
| Sitemap from `public_listing_search` (ACTIVE only) + place pages + 13 static paths, index | `supabase/functions/public-sitemap`, `_shared/publicSitemap.ts`            |
| `usePageMeta` (description, canonical, OG/Twitter, robots, JSON-LD) on 15 public pages    | `ui/src/lib/seo/usePageMeta.ts`                                            |
| JSON-LD: `LodgingBusiness`, `ParkingFacility`, `Residence`, runtime `Organization`        | `seoMeta.ts`, `organizationJsonLd.ts`                                      |
| Default OG card 1200x630, listing first photo as OG image                                 | `ui/index.html`, `usePageMeta`, `renderMetaTags`                           |
| `MarketingImage` with lazy loading, `fetchPriority`, responsive `srcset` (opt-in)         | `ui/src/features/guest/marketing/shared/components/MarketingImage.tsx`     |
| Client-side compression on host photo upload                                              | `ui/src/features/dashboard/org/lib/propertyMedia.ts`                       |
| HSTS 2 years + `includeSubDomains; preload`, `kamehomes.space` 301s to `kamespace.com`    | `ui/vercel.json`                                                           |
| Search Console domain property verified by DNS TXT (2026-11-03)                           | `docs/archive/operations/google-services-approval.md`                      |
| Sentry is the field source for LCP / INP / CLS; Lighthouse route scripts                  | `ui/src/lib/posthog/beforeSend.ts`, `scripts/performance/lighthouse-*.mjs` |

### Cross-cutting findings (the real gaps)

| #   | Finding                                                                                                                                                                                                                                                                                                           | Impact                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| F1  | **Crawlers that do not run JS see an empty page.** `index.html` body is `<div id="root"></div>`. The middleware only swaps `<head>` tags on 3 detail routes. GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, CCBot and most link-preview bots do not execute JS, so they get no text, no H1, no links.           | Biggest blocker for AI search and for internal-link discovery outside Google.  |
| F2  | **10+ public pages have a title but no description, canonical or OG tags**: About, Contact, Cookies, Privacy, Terms, Support, Services, For Hosts, For Hosts Pricing, Host public page (`/hosts/:orgSlug`), Showcase, Stay guide.                                                                                 | They inherit the generic home description and `og:url=https://kamespace.com/`. |
| F3  | **`usePageMeta` cleanup leaks.** On unmount it resets description and image but leaves `link[rel=canonical]`, `og:url`, `og:title`, `twitter:title`. SPA navigation from a listing to `/about` keeps the listing canonical.                                                                                       | Wrong canonical for JS-rendering crawlers that navigate.                       |
| F4  | **Canonical and sitemap host follow the request origin.** `www.kamespace.com` and `app.kamespace.com` are both in `DEFAULT_INDEXABLE_HOSTS` and self-canonicalize.                                                                                                                                                | Duplicate content across hosts.                                                |
| F5  | **Static `public/robots.txt` fallback drifted** from `ROBOTS_DISALLOW` (missing `/for-hosts/v2`, `/*/trip?`), and both miss private routes: `/for-guests/*`, `/for-hosts/login`, `/for-hosts/register`, `/guest-review`, `/vouchers`, `/tickets`, `/bookings/*/parking`, `/parking/*`, `/*/document`, `/ingest/`. | Login/registration and token pages can get indexed.                            |
| F6  | **Soft 404s.** Unknown routes and dead listing slugs return HTTP 200 with the SPA shell. Client `<Navigate>` redirects (`/for-hosts/preview`, `/developments/:slug/parking/category`, account aliases) are 200s to crawlers.                                                                                      | Search Console "Soft 404" and wasted crawl budget.                             |
| F7  | **Renaming a listing changes its slug with no redirect** (`propertySlugPreview`). Old links, shares and rankings break.                                                                                                                                                                                           | Broken inbound links, lost ranking.                                            |
| F8  | **Listing name slugs drop accented letters.** `slugifyName` (Deno) and `slugifyOrgName` (UI) do not strip diacritics: `Parañaque Loft` becomes `para-aque-loft`. `pls_location_slug` (SQL) already normalizes NFD correctly, so the two disagree.                                                                 | Ugly, keyword-broken URLs for Philippine place names.                          |
| F9  | **Alt text is generic or empty.** Listing photos use `"{name} - Image 3"`. 108 of 125 `<img>` tags use `alt=""`, including content images in showcase templates, galleries and trip pages. Media items have `caption` but no `alt`.                                                                               | Weak image search, weak accessibility, weak AI image understanding.            |
| F10 | **Responsive image transforms are opt-in** (`VITE_SUPABASE_IMAGE_TRANSFORMS`) and several public images bypass `MarketingImage`. Hero WebP files are barely smaller than the JPEGs (246 KB vs 266 KB).                                                                                                            | LCP and image weight on the pages that matter most.                            |
| F11 | **No `llms.txt`, no Bing Webmaster Tools, no IndexNow, sitemap submission unconfirmed.** Bing feeds ChatGPT search and Copilot.                                                                                                                                                                                   | Slower discovery in AI search engines.                                         |
| F12 | **`Organization` JSON-LD is injected by JS only**, so non-JS crawlers never see it.                                                                                                                                                                                                                               | Entity / brand knowledge for AI engines.                                       |

---

## 2. Decisions

### D1. How non-JS crawlers get real content (fixes F1)

| Option                                                                                                 | Verdict                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Move to an SSR framework                                                                            | **Rejected.** Repo rule: no Next.js, no separate API package.                                                                                                                                                                                                             |
| B. Build-time prerender of the React app (`renderToString` or headless Chromium in the build)          | **Rejected for now.** Many public components touch `window` at import, Vercel build gets heavier, and dynamic listing pages still need the middleware.                                                                                                                    |
| **C. Extend the middleware to a "crawler snapshot"** for every indexable public route, crawler UA only | **Recommended.** One code path, reuses the existing fail-open middleware and existing public edge reads. Injects semantic HTML (one `<h1>`, summary text, key facts, links, images with alt) into `#root`. `createRoot` replaces it when JS runs, so humans never see it. |

Guardrails for C (Google treats dynamic rendering as acceptable only when content is
equivalent):

- Snapshot copy must come from the **same source** as the React page. Static page copy moves
  into shared `content.ts` modules imported by both the page component and the snapshot
  renderer. Listing snapshots use the same edge payloads the SPA uses.
- Snapshot never contains text the page does not show.
- Fail open: any error returns the plain SPA shell, never a 5xx.
- `vary: user-agent` and short `s-maxage` (already the pattern).

### D2. One public route registry (fixes drift in F2, F5)

New `ui/src/lib/seo/publicRoutes.ts`: one typed entry per public route pattern with `indexable`,
`inSitemap`, `titleTemplate`, `description` (or loader), `canonicalPolicy`, `ogImage`,
`changefreq/priority hint`, `snapshotRenderer`. Robots disallow, static sitemap paths, the
snapshot renderer and a CI check all derive from it. Deno cannot import from `ui/`, so a check
script (`check:seo-routes`) asserts `_shared/publicSitemap.ts#STATIC_SITEMAP_PATHS` and
`ui/public/robots.txt` match the registry.

### D3. Canonical origin (fixes F4)

Canonical, `og:url`, sitemap `<loc>`, robots `Sitemap:`, JSON-LD `url` and `llms.txt` links
always use the **production canonical origin** `https://kamespace.com`, never the request host.
New env `VITE_PUBLIC_SITE_ORIGIN` (UI + middleware) mirrors the existing server
`PUBLIC_GUEST_APP_ORIGIN`. `www.kamespace.com` and `app.kamespace.com` 301 to the apex for
public routes (confirm `app.` is not the host dashboard entry before redirecting; if it is,
it keeps serving dashboard routes and only public routes redirect).

### D4. AI crawler policy (fixes F11)

Default: **allow** search and answer-engine crawlers so listings can be cited: `OAI-SearchBot`,
`ChatGPT-User`, `GPTBot`, `Claude-SearchBot`, `Claude-User`, `ClaudeBot`, `PerplexityBot`,
`Perplexity-User`, `Google-Extended`, `Applebot-Extended`, `Bingbot`. Same private-path
disallows as `*`. `CCBot` (Common Crawl, training only) is a product call; recommended allow,
since it feeds many smaller models. Decision recorded in the robots builder with a comment.

### D5. Scope of this branch (execute-plan, 2026-11-11)

Phases 0 and 1 plus the registry-derived half of Phase 2. Everything else stays here as the
next PRs, in the plan's own order.

| Phase | This branch               | Why                                                                                                                                   |
| ----- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Partial                   | Vercel/Search Console baselines need dashboard access (SEO-14.8, SEO-19.3). `seo:audit` script ships here; prod run follows.          |
| 1     | **Yes, all**              | Registry, origin, content modules, snapshot, middleware, `check:seo-routes`, `usePageMeta` fix.                                       |
| 2     | **Yes, registry-derived** | Robots (AI groups, disallows, generated fallback), sitemap static paths, canonical, noindex, trailing slash, 404 status, `seo:audit`. |
| 3-10  | No, separate PRs          | Each is its own goal with its own copy, assets, migrations or console work. Bundling them makes an unreviewable diff.                 |

---

## 2b. Decisions

| #   | Decision                                 | Choice                                                                                                                               | Why                                                                                                                                       |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Registry location                        | `ui/src/lib/seo/publicRoutes.ts`, dependency-free (no `@/` imports)                                                                  | Must be importable by the Vite SPA, the middleware bundle and the Node check script without a second copy.                                |
| 2   | Static copy source for snapshots         | `ui/src/lib/seo/content/*.ts` pure data modules, imported by page and by snapshot renderer                                           | Satisfies D1's "same source" guardrail without a 5,000-line refactor. Only the hero + section copy moves.                                 |
| 3   | Snapshot escaping                        | Reuse `escapeHtml` / `serializeJsonLd` from `seoMeta.ts`                                                                             | One escaper, already tested.                                                                                                              |
| 4   | Snapshot HTML shape                      | `<header>` nav, `<main>` with exactly one `<h1>`, facts `<dl>`, `<a href>` links, `<footer>`                                         | Matches what a crawler needs and what the SPA renders; no invented copy.                                                                  |
| 5   | Canonical origin default                 | `https://kamespace.com`; `VITE_PUBLIC_SITE_ORIGIN` only overrides when set                                                           | A stale env must never de-index or split the live domain, same reasoning as `DEFAULT_INDEXABLE_HOSTS`.                                    |
| 6   | `app.kamespace.com` redirect (SEO-4.9)   | Not in this branch                                                                                                                   | Its role as a dashboard entry is unconfirmed; redirecting it could break host sign-in. www. keeps working and self-canonicalizes for now. |
| 7   | robots.txt fallback generation (SEO-2.2) | `scripts/seo/generate-robots.mjs` writes `ui/public/robots.txt` from `ROBOTS_DISALLOW`, run by `check:seo-routes` in CI              | A Vite plugin would regenerate on every dev build for no gain; one script plus a CI diff check catches drift.                             |
| 8   | 404 status (SEO-12.2)                    | Middleware returns 404 + `noindex` only when the edge lookup proves the slug is missing on a crawler UA; browsers keep the SPA shell | Browsers need the shell to render `NotFoundPage`; crawlers need the status.                                                               |
| 9   | Title format (SEO-5.1)                   | Deferred to Phase 3                                                                                                                  | Changing 70 page titles is a copy PR, not a foundation PR.                                                                                |
| 10  | Host-facing copy for new surfaces        | None added                                                                                                                           | Nothing host-visible ships in this branch.                                                                                                |

---

## 2c. Per-phase acceptance

| Phase | Command that proves it                                                                             |
| ----- | -------------------------------------------------------------------------------------------------- |
| 0     | `bun run seo:audit -- --origin https://kamespace.com --out docs/workflow/in-progress/seo-evidence` |
| 1     | `bun run type-check && bun run lint && bun run test && bun run check:seo-routes`                   |
| 2     | `bun run test:edge && bun run check:seo-routes && curl -sI $PREVIEW/robots.txt`                    |

---

## 2d. Edge cases this branch must handle

| Case                                              | Required behaviour                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Middleware edge fetch times out or 500s           | Return the plain SPA shell (`next()`), never a 5xx                                     |
| Crawler hits a slug that does not exist           | 404 with `noindex`, not a 200 shell                                                    |
| Browser hits the same dead slug                   | Normal shell, `NotFoundPage` renders, `noindex` set by the page                        |
| Route in the registry but missing from the router | `check:seo-routes` fails CI                                                            |
| Route in the router but missing from the registry | `check:seo-routes` fails CI                                                            |
| `VITE_PUBLIC_SITE_ORIGIN` unset                   | Canonical falls back to `https://kamespace.com`                                        |
| `VITE_PUBLIC_SITE_ORIGIN` set on a preview deploy | Canonical stays the apex; robots stays `Disallow: /` because the host is not indexable |
| Query string (`?swLat=`, UTM, filters)            | Dropped from canonical and `og:url`                                                    |
| Trailing slash                                    | 308 to the slashless path via `vercel.json`                                            |
| Non-production host                               | `X-Robots-Tag: noindex, nofollow` from the middleware                                  |

---

## 3. Tasks per checklist item

### Item 1. Build sitemap.xml

Current: shipped (dynamic, ACTIVE listings + places + 13 static paths, sitemap index above
45,000 URLs). Gaps: static list is hand-maintained in Deno, host pages and development
sub-pages missing, no `lastmod` on static and place pages, no image entries, origin must be
the canonical apex.

- [x] SEO-1.0 Dynamic `/sitemap.xml` via middleware proxy to `public-sitemap`.
- [ ] SEO-1.1 Derive `STATIC_SITEMAP_PATHS` from the D2 registry; `check:seo-routes` fails CI on drift.
- [ ] SEO-1.2 Add `/hosts/:orgSlug` for orgs with at least one ACTIVE public listing (read from `public_listing_search` org column or a join; exclude unverified orgs).
- [ ] SEO-1.3 Decide and add development sub-pages `/developments/:slug/properties` and `/developments/:slug/parking` (include only when the list is non-empty; they already set their own canonical).
- [ ] SEO-1.4 Decide showcase (`/properties/:slug/showcase`) and stay guide: include only if their content is distinct from the detail page; otherwise canonical to the detail page and exclude (see SEO-4.7).
- [ ] SEO-1.5 `lastmod` for place pages = max `refreshed_at` of their listings; static pages = last content change (registry field updated with the page copy, not build time, so Google keeps trusting it).
- [ ] SEO-1.6 Split into typed child sitemaps (`?part=static|properties|parkings|developments|places|hosts`) under one sitemap index so Search Console reports indexing per type. Keep the 45,000 URL split per child.
- [ ] SEO-1.7 Image sitemap extension (`<image:image><image:loc>`) for up to 10 photos per listing (Google Images discovery).
- [ ] SEO-1.8 Use the canonical origin (D3) for every `<loc>`; assert in a Deno test that no `<loc>` uses a non-apex host or `http://`.
- [ ] SEO-1.9 Never list a URL that is `noindex`, redirected, or non-ACTIVE. Deno test with fixtures for suspended, archived, unverified listings.
- [ ] SEO-1.10 Validate output against the sitemap XSD in a Deno test; size check under 50 MB uncompressed.
- [ ] SEO-1.11 Prod smoke: `curl -I https://kamespace.com/sitemap.xml` returns 200 `application/xml`; add to `web-probe.yml`.

### Item 2. Add robots.txt

Current: shipped (dynamic, host-gated). Gaps: F5 drift and missing private paths, `Sitemap:`
uses request origin, no explicit AI crawler groups.

- [x] SEO-2.0 Dynamic robots with `Disallow: /` on non-indexable hosts.
- [ ] SEO-2.1 Add missing disallows: `/for-guests/`, `/for-hosts/login`, `/for-hosts/register`, `/guest-review`, `/vouchers`, `/tickets`, `/bookings/`, `/parking/` (booking-id route, not `/parkings`), `/*/document`, `/ingest/`, `/account/`. Verify each path against the router before adding, so no public route is blocked.
- [ ] SEO-2.2 Generate `ui/public/robots.txt` from `ROBOTS_DISALLOW` at build (small Vite plugin or prebuild script) so the fallback cannot drift. `check:seo-routes` covers it too.
- [ ] SEO-2.3 `Sitemap:` line uses the canonical origin (D3).
- [ ] SEO-2.4 Explicit AI crawler groups per D4, each with the same disallows.
- [ ] SEO-2.5 Confirm `/assets/`, fonts, `/brand/`, `/marketing/`, `/images/` are crawlable (Google needs JS and CSS to render).
- [ ] SEO-2.6 Vitest: every registry route with `indexable: true` is allowed by the generated robots; every `indexable: false` route is disallowed or `noindex`.
- [ ] SEO-2.7 Test in Search Console robots.txt report after deploy.

### Item 3. Remove noindex tags (and add them where they belong)

Current: `index.html` has no robots meta (good). Only `/search` and trip pages set `noindex`.
Gaps: no protection on preview deploys beyond robots, private shells have no `noindex`, soft 404s.

- [ ] SEO-3.1 Audit: Vitest asserts no registry route with `indexable: true` ever passes `noindex`, and the shipped `index.html` has no robots meta on production builds.
- [ ] SEO-3.2 Non-production hosts: emit `X-Robots-Tag: noindex, nofollow` from the middleware for every matched path on non-indexable hosts, and a build-time `<meta name="robots" content="noindex">` in `index.html` when `VITE_NODE_ENV` is not production (Vite `transformIndexHtml`). `Disallow` alone does not de-index URLs Google already knows.
- [ ] SEO-3.3 `noindex` in the dashboard shell, guest account shell and auth pages via a `usePageMeta({ noindex: true })` default in those layouts.
- [ ] SEO-3.4 `noindex` + real 404 status for dead listings and unknown routes (see SEO-12.2).
- [ ] SEO-3.5 Preview pages (`/v2`, `/for-hosts/v2`, `/for-hosts/v3`, `/explore-preview`): `noindex` meta in addition to robots, or remove the routes if obsolete.
- [ ] SEO-3.6 After deploy, review Search Console "Excluded by noindex tag" and "Blocked by robots.txt" for anything public.

### Item 4. Add canonical tags

Current: listing detail, list and place pages set canonical. Gaps: F2, F3, F4, trailing slash
and query-string policy.

- [ ] SEO-4.1 Canonical on every public page via registry defaults (About, Contact, Cookies, Privacy, Terms, Support, Services, For Hosts, Pricing, Host page, Showcase, Stay guide, NotFound none).
- [ ] SEO-4.2 Fix `usePageMeta` cleanup: restore canonical, `og:url`, `og:title`, `twitter:title` to the route default on unmount (or own every tag and reset all of them).
- [ ] SEO-4.3 Canonical origin from `VITE_PUBLIC_SITE_ORIGIN` in `usePageMeta`, `renderMetaTags`, JSON-LD (D3).
- [ ] SEO-4.4 Static `<link rel="canonical" href="https://kamespace.com/">` in `index.html` replaced by the middleware snapshot per route; remove the hardcoded `og:url` homepage value for non-home routes (snapshot sets it).
- [ ] SEO-4.5 Trailing slash policy: set `"trailingSlash": false` in `ui/vercel.json` so `/properties/` 308s to `/properties`. Confirm the PWA scope and SW routes still match.
- [ ] SEO-4.6 Query strings: filters, sort, map bounds, `?property=` and UTM params never appear in canonicals. Paginated list pages: canonical to themselves with `?page=N` only if pagination is URL-driven; otherwise canonical to page 1.
- [ ] SEO-4.7 Showcase and stay guide canonical decision (self vs detail), applied with SEO-1.4.
- [ ] SEO-4.8 Lowercase redirect: middleware 301s `/Properties/Foo` to `/properties/foo` on listing routes.
- [ ] SEO-4.9 `www.` and `app.` hosts 301 to apex for public routes (Vercel domain config + `vercel.json` host redirects), per D3.

### Item 5. Add meta titles

Current: `usePageTitle` on ~70 pages, brand-first format `Kame Space - X`. Gaps: brand-first
wastes the strongest title slot, no length control, middleware uses the same format.

- [ ] SEO-5.1 One title builder in `seoMeta.ts` used by SPA and middleware: `{Page} | Kame Space`, brand last. Dashboard titles keep their current format (they are `noindex`).
- [ ] SEO-5.2 Templates (final copy through the `human-copy` skill):
  - Home: `Kame Space: Book condos, homes and parking in the Philippines`
  - Property detail: `{Name}, {Unit type} in {City} | Kame Space`
  - Parking detail: `{Name} parking in {Place} | Kame Space`
  - Development detail: `{Name}, {City} condos and parking | Kame Space`
  - Place pages: `Condos and homes for rent in {City} | Kame Space` (and parking / developments variants)
  - List pages: `Places to stay in the Philippines | Kame Space`, `Parking for rent | Kame Space`
  - Host page: `{Host name} stays and parking | Kame Space`
  - Static: `About Kame Space`, `Pricing for hosts | Kame Space`, and so on from the registry.
- [ ] SEO-5.3 Truncate at ~60 characters on a word boundary, dropping the brand suffix first when the page part is long.
- [ ] SEO-5.4 Keep `og:title` and `twitter:title` equal to the document title minus the suffix where it reads better.
- [ ] SEO-5.5 Uniqueness: crawl audit (SEO-12.4) flags duplicate titles across sitemap URLs.
- [ ] SEO-5.6 Vitest for every template, including long names, missing city, and HTML-sensitive characters.

### Item 6. Meta descriptions

Current: listing pages use the host description or a short fallback; static pages inherit the
home default. Gaps: F2, weak fallbacks, no host control.

- [ ] SEO-6.1 Unique 120-160 character description for every static page in the registry (About, Contact, Cookies, Privacy, Terms, Support, Services, For Hosts, Pricing, list pages, home). Write with `human-copy`, no em dashes.
- [ ] SEO-6.2 Richer data fallback for listings with no host description: `{Unit type} in {City} for up to {guests} guests. {bedrooms} bedrooms, {top 2 amenities}. From PHP {price}/night.` Skip missing parts cleanly.
- [ ] SEO-6.3 Place pages: `{count} condos and homes in {City}, from PHP {min}/night. Check dates and book online.` (counts from `public_listing_search`).
- [ ] SEO-6.4 Host pages and development pages: data-driven templates.
- [ ] SEO-6.5 Sanitize: strip Markdown, HTML, emoji runs, URLs, phone numbers and emails (no PII in meta), collapse whitespace, then truncate.
- [ ] SEO-6.6 Optional host feature: "Search preview" (SEO title + description override) in property and parking Public page settings with a live Google-style preview and character counter. Needs `unsaved-changes-guard`, `mobile-responsive`, `plans-and-permissions` (recommend all plans, existing public-page edit permission), `audit-logging` (rides the existing settings save event or new `listing.seo_updated`), route guide and FAQ updates. Ship after SEO-6.1 to 6.5.
- [ ] SEO-6.7 Align the shorter `twitter:description` in `index.html` with the main description.
- [ ] SEO-6.8 Crawl audit flags missing, duplicate, under 70 or over 160 character descriptions.

### Item 9. Add alt text

Current: F9. Listing galleries use `"{name} - Image n"`, 108 `alt=""` across 40+ files,
media items have `caption` but no `alt`.

Data and pipeline:

- [ ] SEO-9.1 Add optional `alt` to the property media item shape (`settings.media[]` JSONB: `normalizePropertyMediaItems` in Deno + the UI type). No migration needed for JSONB, but update the normalizer, the public DTO (`PublicPropertyMediaDto`) and the parking / development image DTOs.
- [ ] SEO-9.2 One shared `buildListingImageAlt({ alt, caption, roomTag, listingName, unitType, city, index })` in a pure module (Vitest). Priority: host `alt` > `caption` > generated `"{Room or photo n} of {listingName}, {unitType} in {city}"`.
- [ ] SEO-9.3 Host UI: "Alt text" field per photo in the property media manager and parking cover editor (short helper, 125 char soft limit, mobile bottom sheet). Wire `useGuardedClose`/`useUnsavedChangesGuard`. Activity log rides the existing media save event; confirm it records the change.
- [ ] SEO-9.4 AI suggestion: on upload, generate alt text from the image with the existing AI gateway (vision model), host can edit. Respects AI limits (super-admin profiles, `check:ai-gateway`), never blocks upload, falls back to SEO-9.2.
- [ ] SEO-9.5 Backfill job for existing photos without `alt` (one-shot script or cron with rate limit, dev first, dry-run report). Record in the migration runbook.

Rendering:

- [ ] SEO-9.6 Replace generic alts in `ListingGallery`, `GalleryLightbox`, `PropertyCard`, `PropertyListItem`, `DevelopmentCard`, `DevelopmentHero`, `ListingMapView`, `ParkingSlotCard` with SEO-9.2.
- [ ] SEO-9.7 Triage every `alt=""` in `features/guest/**`, `features/reviews/**`, `components/**` (40 files found). Rule: decorative (icons, background textures, avatars next to a visible name) keeps `alt=""`; content (photos, showcase gallery, hero product shots, QR codes, maps) gets descriptive alt. Priority files: all `showcase/templates/*Sections.tsx`, `ShowcaseGalleryCarousel`, `StayGuideSections`, `GuestOperationalHeader`, `V2ApertureHero`, `V2PlacesIndex`, `BookingSteps`, `PropertyReviews` (review photos), `ReviewCardContent`, `ChatMapLinkCard`.
- [ ] SEO-9.8 Host and org logos: `alt="{Org name}"`; review photos: `"Guest photo from a review of {listing}"`.
- [ ] SEO-9.9 Listing `og:image:alt` and `twitter:image:alt` from the cover photo alt.
- [ ] SEO-9.10 Static marketing images in `ui/public/marketing/**` and for-hosts film scenes: descriptive alt from the component, not the filename.

Guardrails:

- [ ] SEO-9.11 Add `eslint-plugin-jsx-a11y` with `alt-text` (and `img-redundant-alt`) as errors, scoped to `ui/src/**` (dashboard can start as warn if the backlog is large).
- [ ] SEO-9.12 Crawl audit flags content images without alt on snapshot HTML.

### Item 10. Add schema markup

Current: `LodgingBusiness`, `ParkingFacility`, `Residence`, runtime `Organization`. Gaps: F12,
no `WebSite`, `BreadcrumbList`, `ItemList`, thin listing properties.

- [ ] SEO-10.1 `Organization` (with `sameAs` social profiles, `logo` as a verified absolute URL, `contactPoint`) and `WebSite` (`name`, `alternateName`, `url`) in the crawler snapshot `<head>` for every route. Keep the runtime injector for JS crawlers. Verify `/images/logo.png` exists or point to `/brand/...`.
- [ ] SEO-10.2 `BreadcrumbList` on listing detail, place, development and host pages (Home > Properties > {City} > {Listing}).
- [ ] SEO-10.3 `ItemList` of `ListItem` URLs on list, place, development sub-pages and host pages (first page of results).
- [ ] SEO-10.4 Enrich `LodgingBusiness`: `geo` (lat/lng when public), `amenityFeature` (`LocationFeatureSpecification`), `numberOfRooms`, `occupancy`/`maximumAttendeeCapacity`, `petsAllowed`, `checkinTime`, `checkoutTime`, `containedInPlace` (development), `priceRange`, `makesOffer`/`Offer` with `priceCurrency: PHP`. Only fields the page shows.
- [ ] SEO-10.5 Enrich `ParkingFacility` and `Residence` the same way (geo, address, `containsPlace` listings for developments).
- [ ] SEO-10.6 `FAQPage` on Support and For Hosts Pricing from the curated FAQ source (`docs/guides/support/faqs.md` pipeline). Google limits FAQ rich results, but AI engines read it.
- [ ] SEO-10.7 Host product: `SoftwareApplication` + `Offer` per plan on `/for-hosts/pricing` from `list-public-pricing-plans` / `planPresentation.ts`.
- [ ] SEO-10.8 Host public page: `Organization` with `makesOffer` / `hasOfferCatalog` linking its listings.
- [ ] SEO-10.9 Keep `aggregateRating` only where reviews are visible on the page. Note in code: self-hosted ratings on `LodgingBusiness` are not eligible for Google review stars, but stay valid markup.
- [ ] SEO-10.10 Vitest snapshot tests per builder; manual Rich Results Test and validator.schema.org pass for one URL per type, recorded in the evidence file.

### Item 11. Add internal links

Current: the SPA links well when JS runs (cards, `ListingPlaceGroupsFooter`, nav). Gaps: no
links in crawler HTML (F1), no breadcrumbs, possible JS-only navigation.

- [ ] SEO-11.1 Crawler snapshot includes real `<a href>` links: global nav, footer (place groups, legal, for hosts), and page-specific links.
- [ ] SEO-11.2 Listing detail links to: its place page, its development, its host page, and 4 to 8 related listings in the same place (from `search_public_*`).
- [ ] SEO-11.3 Place pages link to neighbouring places and to the other families in the same place (properties, parking, developments).
- [ ] SEO-11.4 Host pages link to all their public listings; listings link back to the host page.
- [ ] SEO-11.5 Audit public cards and buttons for `onClick={() => navigate(...)}` or `div` click handlers that should be `<Link>`/`<a href>`. Fix without visual change.
- [ ] SEO-11.6 Descriptive anchor text in snapshot links (listing names, "Condos in Makati"), no "click here" or "view".
- [ ] SEO-11.7 Visible breadcrumbs on detail pages: **separate UI decision** (out of scope by default because it changes UI). JSON-LD breadcrumbs (SEO-10.2) ship regardless.
- [ ] SEO-11.8 Orphan check: crawl audit reports sitemap URLs with zero inbound internal links.

### Item 12. Fix broken links

Current: F6, F7, no link checker.

- [ ] SEO-12.1 Move client-only redirects to server 301s in `ui/vercel.json`: `/for-hosts/preview`, `/developments/:slug/parking/category`, `/developments/:slug/parking/list`, `/sign-in`, account aliases (`messages`, `wishlist`, `settings`). Keep the client `<Navigate>` as fallback.
- [ ] SEO-12.2 Real 404s: middleware returns status 404 with the SPA shell plus `noindex` when a listing, place, development or host slug does not resolve (for all UAs on those paths; humans still get the NotFound page from React). Unknown top-level routes: add a narrow matcher or `vercel.json` rule only if it does not break the SPA fallback; otherwise rely on `noindex` in `NotFoundPage`.
- [ ] SEO-12.3 `NotFoundPage` sets `noindex`.
- [ ] SEO-12.4 New `scripts/seo/crawl-audit.mjs` (`bun run seo:audit -- --origin <url>`): reads the sitemap, fetches each URL with a crawler UA and a browser UA, follows internal links one level, and reports status codes, redirect chains, missing/duplicate titles and descriptions, canonical mismatch, `noindex` on sitemap URLs, images without alt, broken images (Storage 404), JSON-LD parse errors, and orphans. Output Markdown + JSON to `docs/workflow/in-progress/seo-evidence/`.
- [ ] SEO-12.5 External link check (report only, never fails CI): host-provided URLs (Facebook, Instagram, maps), footer socials, email template links.
- [ ] SEO-12.6 Stored media URLs: report `settings.media[].url` and cover image URLs that 404 in Storage (deleted files still referenced).
- [ ] SEO-12.7 Schedule `seo:audit` weekly against production in `web-probe.yml` (or a new workflow) and on PRs that touch `ui/src/routes`, `features/guest/**/routes`, `lib/seo`, `middleware.ts`, `public-sitemap`, against the preview URL.

### Item 13. Compress images

Current: upload compression exists, responsive transforms opt-in, some heavy static assets.

- [ ] SEO-13.1 Confirm the Supabase plan includes Storage image transforms and the cost; then set `VITE_SUPABASE_IMAGE_TRANSFORMS=true` on production and dev Vercel envs (update the env registry and `validation-and-env.md`).
- [ ] SEO-13.2 Route every public content image through `MarketingImage` (or a shared `ResponsiveImage`), including showcase templates, trip pages, V2 landing, host page, reviews. Always pass `width`/`height` or a fixed aspect box.
- [ ] SEO-13.3 Re-encode public static images with `sharp`: hero JPEG/WebP to AVIF + WebP at real display sizes (target under 120 KB for the hero), `avatars/receptionist-turtle-idle.png` (402 KB) to WebP/AVIF, `brand/kame-space-mark-2048.png` only where 2048 px is needed. Script `scripts/images/optimize-public.mjs`.
- [ ] SEO-13.4 `check:public-image-budget`: fail CI for any new file in `ui/public/{marketing,images,brand,avatars}` over 200 KB unless allowlisted (PWA splash and screenshots excluded).
- [ ] SEO-13.5 Verify the upload pipeline: max long edge (recommend 2560 px), quality (~80), output WebP, and **EXIF stripped** (GPS in guest and host photos is a privacy issue as well as weight). Add a Vitest for the compression helper's options.
- [ ] SEO-13.6 Backfill report: list Storage images over 1 MB in listing media; re-compress in a dry-run-first script (dev first, then production with `kamewave`).
- [ ] SEO-13.7 Listing OG image: 1200x630 crop via the transform URL when enabled (pairs with SEO-18.2).

### Item 14. Core Web Vitals

Current: Sentry field data, Lighthouse scripts, bundle budgets. The broad speed work lives in
[`app-speed-root-cause-overhaul.md`](./app-speed-root-cause-overhaul.md); this item covers only
the public, indexable pages and must not duplicate that plan.

- [ ] SEO-14.1 Targets at p75 on public routes: LCP under 2.5 s, INP under 200 ms, CLS under 0.1 (mobile).
- [ ] SEO-14.2 Sentry dashboard filtered to registry routes (home, list, place, detail, for-hosts, pricing). Weekly check in the ops report.
- [ ] SEO-14.3 Add public routes to `scripts/performance/lighthouse-routes.mjs` with assertions: SEO category >= 95, Performance >= 85 mobile, no "image elements without width/height", no "properly size images" failures.
- [ ] SEO-14.4 LCP: preload and `fetchPriority="high"` on the listing detail cover photo and home hero; snapshot HTML includes the preload link for crawler renders.
- [ ] SEO-14.5 Fonts: public pages load only the platform fonts, not all 15 host-selectable families; `font-display: swap`; preload the primary weight.
- [ ] SEO-14.6 CLS: image dimensions (SEO-13.2), fixed skeleton heights on cards, reserved map container height.
- [ ] SEO-14.7 Third parties: Google Maps loads on interaction or in view; PostHog and Sentry after first paint (confirm current behaviour).
- [ ] SEO-14.8 Field data from CrUX: record origin CWV from PageSpeed Insights and the Search Console Core Web Vitals report before and after.

### Item 16. Enforce HTTPS

Current: Vercel forces HTTPS, HSTS 2 years with `includeSubDomains; preload`.

- [ ] SEO-16.1 Verify with `curl -I` that `http://` for apex, `www.`, `app.`, `kamehomes.space`, `www.kamehomes.space` all reach `https://kamespace.com/...` in at most two hops.
- [ ] SEO-16.2 Mixed content scan: search DB-stored URLs (listing media, org logos, host social links, email templates, page-editor content) and `ui/src` for `http://`; rewrite to `https://` where the target supports it.
- [ ] SEO-16.3 Add `upgrade-insecure-requests` to the CSP (coordinate with the CSP enforcement work; Report-Only today).
- [ ] SEO-16.4 Decide HSTS preload submission (hstspreload.org). Check every `*.kamespace.com` subdomain is HTTPS-capable first, since `includeSubDomains` is already set and preload is hard to undo.
- [ ] SEO-16.5 All generated URLs (canonical, sitemap, OG, JSON-LD, llms.txt) are `https://`; enforced by the D3 origin and Deno/Vitest tests.

### Item 17. Clean up URL slugs

Current: `slugifyName` lowercase ASCII, hyphens, max 64, numeric suffix on collision. Gaps:
F7, F8.

- [ ] SEO-17.1 Strip diacritics before slugging in `_shared/slugUtils.ts#slugifyName`, `ui/.../orgSettingsForm.ts#slugifyOrgName` and `pls_slugify_name` (new migration): `normalize('NFD')` then remove combining marks, so `Parañaque` becomes `paranaque`. Shared test vectors in Deno, Vitest and SQL (`ñ`, `é`, `&`, emoji, leading digits, 64-char cut on a hyphen).
- [ ] SEO-17.2 Slug history: new table `listing_slug_redirects (family, old_slug, listing_id, created_at)` with a unique key on `(family, old_slug)`, filled by a trigger when a property, parking or development slug changes. Never reuse an old slug for a different listing without removing its redirect first.
- [ ] SEO-17.3 Resolve old slugs: `get-public-property`, `get-public-parking`, `list-public-developments` return `{ redirectTo }` for a historical slug; the middleware answers 301 to the current URL; the SPA does `<Navigate replace>` as fallback.
- [ ] SEO-17.4 One-time: existing listings whose slug would change under SEO-17.1 keep their current slug (no mass renames). Only new slugs and renames use the new rule.
- [ ] SEO-17.5 Host UX: when a rename changes the public URL, the settings save shows the new URL and states that the old link keeps working. Small copy change only.
- [ ] SEO-17.6 Lowercase and trailing-slash normalization (SEO-4.5, SEO-4.8).
- [ ] SEO-17.7 Document slug rules in `docs/PROJECT.md` and the migration runbook.

Plans/RBAC: N/A (no new gated capability). Activity log: slug change already happens inside a
settings save; add `listing.slug_changed` with old and new slug if the existing event does not
carry it.

### Item 18. Add an og:image

Current: default 1200x630 card, listing first photo. Gaps: listing photo dimensions unknown,
non-1.91:1 crops, no previews for non-detail routes without JS.

- [ ] SEO-18.1 Snapshot HTML (Phase 1) sets per-route OG tags for every indexable route, so Facebook, Messenger, WhatsApp, Viber, Slack and LinkedIn previews work on place, host, list and static pages, not only detail pages.
- [ ] SEO-18.2 Listing OG image as a 1200x630 cover crop (transform URL) with `og:image:width`, `og:image:height`, `og:image:type`, `og:image:alt`.
- [ ] SEO-18.3 Optional: generated OG cards (listing name, place, price-from over the cover photo, brand mark) from an edge function with caching. Decide after SEO-18.2 based on share click-through.
- [ ] SEO-18.4 Per-page static OG images for For Hosts, Pricing, About (from `social-creative` / `marketing/social`), stored in `ui/public/brand/og/`.
- [ ] SEO-18.5 Add `og:locale` `en_PH`, `twitter:site` if an X handle exists.
- [ ] SEO-18.6 Post-deploy: Facebook Sharing Debugger re-scrape and LinkedIn Post Inspector for one URL per type; record results.

### Item 19. Verify Search Console

Current: domain property verified (DNS TXT, 2026-11-03). Gaps: sitemap submission, Bing,
IndexNow, change of address, monitoring routine.

- [ ] SEO-19.1 Submit `https://kamespace.com/sitemap.xml` (and child sitemaps after SEO-1.6) in Google Search Console.
- [ ] SEO-19.2 If the old `kamehomes.space` property is verified, run the **Change of Address** tool to `kamespace.com` (rebrand migration; 301s already exist).
- [ ] SEO-19.3 URL Inspection "Test live URL" for home, one listing, one place page, About: confirm rendered HTML has content, canonical is the apex, indexing allowed. Save screenshots to the evidence folder.
- [ ] SEO-19.4 Bing Webmaster Tools: import from Search Console, submit the sitemap. Bing feeds ChatGPT search and Copilot.
- [ ] SEO-19.5 IndexNow: key file served at `/{key}.txt` (middleware or `public/`), env `INDEXNOW_KEY`, and a ping from the listing publish / update / unpublish path (via `workflowOrchestrator`-style side effect or the search-index refresh trigger with `pg_net`), batched and rate-limited. Fail open.
- [ ] SEO-19.6 Give the right people access (owner + one backup) and document who.
- [ ] SEO-19.7 Monthly SEO review checklist in a new runbook `docs/archive/operations/seo-runbook.md`: Page indexing report, CWV report, Enhancements (breadcrumbs, structured data errors), Manual actions, top queries, Bing report, crawl audit diff.

### Item 20. Add llms.txt

Current: none.

- [ ] SEO-20.1 Serve `/llms.txt` from the middleware (add to matcher): H1 site name, one-paragraph summary, then sections with links and one-line descriptions: For guests (home, properties, parking, developments, top places), For hosts (for-hosts, pricing, services), Help (support, FAQ), Company (about, contact, terms, privacy). Built from the registry + top places from `public_listing_search`.
- [ ] SEO-20.2 Serve `/llms-full.txt`: the same plus a plain-text summary per ACTIVE listing (name, type, place, capacity, price-from, URL). Cap size (for example 2,000 listings) and paginate by family if needed.
- [ ] SEO-20.3 Only public, ACTIVE data. No host emails, phone numbers, addresses beyond city/province, or guest data. Unit test that the builder rejects PII fields.
- [ ] SEO-20.4 Non-indexable hosts return a minimal file that says the host is not public.
- [ ] SEO-20.5 Cache like the sitemap (`s-maxage=3600`, `stale-while-revalidate`).
- [ ] SEO-20.6 Optional: Markdown versions of key static pages (`/about.md`, `/for-hosts/pricing.md`) from the shared `content.ts` modules.
- [ ] SEO-20.7 Reference `llms.txt` from `robots.txt` as a comment and link it from the footer of the snapshot HTML.

---

## 4. Foundation tasks (Phase 1, shared by many items)

- [ ] SEO-0.1 Public route registry `ui/src/lib/seo/publicRoutes.ts` (D2) covering every guest route from `features/guest/*/routes/index.tsx`, each marked `indexable` or not with a reason.
- [ ] SEO-0.2 `VITE_PUBLIC_SITE_ORIGIN` env + helper (D3); register in env docs and `.env.example` files.
- [ ] SEO-0.3 Move static page copy (About, Services, For Hosts, Pricing intro, Support intro, legal page summaries) into `content.ts` modules shared by the React page and the snapshot renderer, without changing what renders.
- [ ] SEO-0.4 Crawler snapshot renderer (D1): `ui/src/lib/seo/snapshot/*.ts`, pure functions returning escaped HTML for `#root` (one `<h1>`, summary, facts list, image `<img>` with alt, links, breadcrumbs) plus head tags. No `@/` imports (middleware bundle).
- [ ] SEO-0.5 Extend `ui/middleware.ts` matcher to all indexable registry routes plus `/llms.txt`, `/llms-full.txt`, IndexNow key file. Keep the "non-crawler returns `next()` immediately" fast path except for 301/404 handling (SEO-12.2, SEO-17.3).
- [ ] SEO-0.6 `check:seo-routes` script: registry vs router paths (every guest route classified), vs `STATIC_SITEMAP_PATHS`, vs `public/robots.txt`. Add to `ci:quality` and CI.
- [ ] SEO-0.7 Measure Vercel middleware invocations and latency after widening the matcher; set an alert if p95 adds more than 150 ms for crawler requests.

---

## 5. Execution order

Each phase is one or more PRs, merged to `main` and tested on the dev deploy before the next.

| Phase | Name                        | Tasks                                                                                                                         | Size | Depends on |
| ----- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---- | ---------- |
| 0     | Baseline                    | SEO-12.4 (crawl audit script first), SEO-14.8, SEO-19.3 on current prod, Lighthouse runs                                      | S    | none       |
| 1     | Foundation                  | SEO-0.1 to 0.7, SEO-4.2, SEO-4.3                                                                                              | L    | 0          |
| 2     | Crawl control               | Items 1, 2, 3, SEO-4.1, 4.4 to 4.9, SEO-12.1 to 12.3                                                                          | M    | 1          |
| 3     | Titles, descriptions, OG    | Items 5, 6 (6.1 to 6.5, 6.7, 6.8), 18 (18.1, 18.2, 18.5)                                                                      | M    | 1          |
| 4     | Snapshot content and schema | Items 10, 11 (crawler HTML for all routes, breadcrumbs JSON-LD, related links)                                                | L    | 1, 3       |
| 5     | Images                      | Items 9, 13                                                                                                                   | L    | 1          |
| 6     | Slugs and redirects         | Item 17, SEO-12.5, 12.6                                                                                                       | M    | 2          |
| 7     | HTTPS and CWV               | Items 16, 14 (14.1 to 14.7)                                                                                                   | M    | 5          |
| 8     | AI discovery and consoles   | Item 20, Item 19, SEO-2.4                                                                                                     | M    | 2, 4       |
| 9     | Optional host features      | SEO-6.6 (search preview override), SEO-18.3 (generated OG cards), SEO-18.4, SEO-11.7 (visible breadcrumbs, needs UI sign-off) | M    | 3, 4       |
| 10    | After report                | Re-run Phase 0, compare, write before/after in the evidence folder, schedule SEO-12.7                                         | S    | all        |

Production steps (Supabase migrations for SEO-17.1/17.2, edge deploys, backfills) need the
`kamewave` unlock as usual. Vercel env changes (SEO-0.2, SEO-13.1, SEO-19.5) are listed in each
PR's notes.

---

## 6. Verification per phase

| Gate                                                                                                                 | Applies to |
| -------------------------------------------------------------------------------------------------------------------- | ---------- |
| `bun run ci:quality`                                                                                                 | every PR   |
| Vitest `ui/src/lib/seo/**`                                                                                           | 1-6, 8     |
| `bun run test:edge` (`publicSitemap`, slug, IndexNow)                                                                | 2, 6, 8    |
| `check:seo-routes`, `check:public-image-budget`                                                                      | 1, 2, 5    |
| `seo:audit` against the Vercel preview with crawler UA (`GPTBot`, `Googlebot`, `facebookexternalhit`) and browser UA | 2-8        |
| Lighthouse public routes (SEO >= 95)                                                                                 | 3, 5, 7    |
| Rich Results Test + schema validator, one URL per type                                                               | 4          |
| Facebook Sharing Debugger re-scrape                                                                                  | 3, 4       |
| Search Console URL Inspection live test                                                                              | 2, 4, 8    |
| Playwright smoke: public pages still render, no visual change from snapshot HTML for browser UAs                     | 1, 4       |

Done when: every sitemap URL returns 200 with a unique title and description, apex canonical,
one `<h1>` and real links in crawler HTML, valid JSON-LD, content images with alt, no `http://`
URLs, Search Console and Bing show the sitemap processed with no robots or noindex surprises,
and `/llms.txt` serves.

---

## 7. Docs, rules and governance (same PRs as the code)

- [ ] `docs/architecture/overview.md` + `docs/PROJECT.md` (public listing search / SEO section): registry, snapshot rendering, canonical origin, llms.txt, IndexNow, slug redirects, new env vars.
- [ ] New `docs/architecture/seo.md`: how public SEO works end to end and how to add a public route.
- [ ] `docs/architecture/validation-and-env.md`: `VITE_PUBLIC_SITE_ORIGIN`, `VITE_SUPABASE_IMAGE_TRANSFORMS` (prod on), `INDEXNOW_KEY`.
- [ ] Route guides (`route-guides` skill): `index-landing.md`, `properties.md`, `parkings.md`, `developments.md`, `legal.md`, for-hosts and host page guides, property / parking settings guides for the alt text field and search preview.
- [ ] `docs/archive/operations/migration-runbook.md`: slug redirect migration, diacritic slug function, alt text and image backfills.
- [ ] `docs/archive/operations/seo-runbook.md` (SEO-19.7).
- [ ] Support content (`support-content` skill): host FAQ "How do guests find my listing on Google and AI search?", "What is alt text and do I need it?", "What happens to my link if I rename my listing?"; run `check:support-content` and `check:ai-knowledge-coverage`.
- [ ] New always-on rule `.cursor/rules/seo.mdc` + skill `seo` (Claude mirror): every new public route must be added to the registry; `check:seo-routes` enforces it.
- [ ] `docs/workflow/intake/_to-plan.md` status sync via `workflow-intake-scratchpads` when this starts.

Plans/RBAC: N/A for Phases 0-8 (platform-wide, no gated capability). Phase 9 host features:
decide in that PR (recommend all plans, existing public page edit permission).
Activity log: N/A for read-only SEO surfaces; slug change and alt text / search preview edits
must be covered (see SEO-9.3, item 17, SEO-6.6).

---

## 8. Risks

| Risk                                                         | Mitigation                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Snapshot HTML seen as cloaking                               | Same content source (SEO-0.3), crawl audit compares snapshot text to rendered page text. |
| Wider middleware matcher adds latency or cost                | Crawler-only rendering, fast `next()` for browsers, cache headers, SEO-0.7 alert.        |
| Trailing slash / redirect rules break PWA or deep links      | Test SW scope and Playwright smoke on preview before merging SEO-4.5.                    |
| Slug normalization renames live URLs                         | SEO-17.4: existing slugs untouched; history table covers renames.                        |
| AI alt text cost or bad output                               | AI limits apply, host can edit, deterministic fallback, backfill dry run first.          |
| HSTS preload locks a subdomain out                           | SEO-16.4 checks all subdomains before submission.                                        |
| `app.kamespace.com` redirect breaks the host dashboard entry | D3: confirm its role first; redirect public routes only.                                 |
