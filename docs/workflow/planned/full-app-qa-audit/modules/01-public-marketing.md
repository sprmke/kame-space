---
title: 'QA packet 01: public and marketing pages'
status: planned
stage: planned
kind: reference
tags: [qa, audit, public, seo]
updated: 2026-11-13
---

# 01 Public and marketing

**Rows:** PUB-01 to PUB-23 · **Personas:** `anon` (phone, slow network first), `crawler`, `guest`, `owner` (signed-in host visiting public pages) · **Environments:** L for behavior, B for performance and PWA, P read-only for SEO, real data shapes and deployed headers.

## References

Guides: `index-landing.md`, `search.md`, `properties.md`, `parkings.md`, `developments.md`, `property-showcase.md`, `for-hosts.md`, `services.md`, `legal.md`, `app.md`. Architecture: `seo.md`, `pwa.md`, `third-party-origins.md`, `performance-before-after.md`. Manual guides: `public-marketing-playwright.md`, `property-showcase-manual.md`, `smart-search-intents-manual.md`. Skills: `public-ui`, `seo`, `frontend-design`, `impeccable`, `performance`. Specs: `ui/e2e/features/public` (2), `brand`, `responsive`, `a11y`, `observability`. Readiness cards: `landing-explore`, `search-listings`, `property-detail`, `for-hosts`, `legal`, `seo`. In-progress plans that change these pages: `seo-and-ai-search-visibility`, `mobile-app-chrome-header-and-tab-bar`, `public-native-density` (for-testing), `legal-and-privacy-coverage`.

## Probe beyond the generic lenses

**Landing (PUB-01)**

- Every section, carousel, CTA and card: destination correct, scroll and swipe behavior, autoplay media respects reduced motion and data saver.
- Hero search: each field, typeahead results, "See all" state (needs `bun run seed:search-fixtures`), keyboard navigation, empty query, location with no listings.
- Signed-in variants: guest, host. Existing-trip banner _(confirm)_.
- LCP element and preload (`check:landing-preload`), CLS from late images and fonts.

**Search and lists (PUB-02, 03, 06, 08)**

- Every filter, sort option, tab, map interaction and pagination control, alone and combined; each reflected in the URL and restorable from the URL.
- Smart search intents per the manual guide; nonsense queries; very long queries; special characters.
- Zero results, one result, 300+ results (`seed:mock-listings`), listing with missing photo or price.
- Location pages `…/in/:location`: valid, unknown, mixed case, encoded characters.
- Map: loads without the key gracefully, pins match the list, clustering, pin to card sync.
- Prices shown match the pricing engine for the selected dates (C08) and availability filter matches the calendar (C09).
- Listing lifecycle: paused, suspended, archived, pending and test-tenant listings never appear (C12).

**Listing detail and showcase (PUB-04, 05, 07)**

- Gallery (swipe, zoom, video, keyboard), amenities, rules, map, reviews, host card, price breakdown, date picker, guest count, book CTA into the calendar and form with dates carried over.
- Favorite heart signed-out (auth prompt, returns to the action) and signed-in (C32).
- Share, report _(planned feature, confirm absent)_, chat entry point into `/messages`.
- Every setting from property settings and public-pages editor is reflected (C10, C11). Pick five settings and trace each.
- Not found, paused, and unpublished listing states. Showcase plan gate (`propertyShowcase`).
- Parking detail: availability, price, request CTA into the parking form, linked development.

**Developments (PUB-08 to 11)**

- List, location browse, detail sections (unit types, amenities, towers, pool, announcements), properties tab, parking list and category, redirect from `parking/list`. Data traced back to `/admin/developments/:slug` (C30).

**Host profile (PUB-12)**: no dedicated guide; document it. Org identity, verification and superhost badges, listings, reviews (C34, C07).

**For hosts and pricing (PUB-13, 14)**

- Tour film, feature sections, every CTA into register and login.
- Pricing page reads the live plan catalog: tier names, prices, features and limits equal `/admin/pricing/plans`, the org Plans page and `plans-feature-matrix.md` (C17). Monthly vs annual toggle math.

**Static and legal (PUB-15 to 19)**

- Contact and support forms: validation, captcha, rate limit, where the message lands (C33), confirmation. On P these are viewed only.
- Legal text matches actual product behavior (data collected, retention, cookies actually set). Cookie page vs real cookies and the consent banner.

**Not found, launch, dev routes (PUB-20 to 22)**

- Unknown URL at each depth shows the right not-found with a way out, correct status semantics for crawlers.
- `/app` with `?source=pwa` and each `?shortcut=` for signed-out, guest, host with one org, host with several.
- Dev and preview routes: unreachable or `noindex` on P; absent from sitemap and PWA registry.

**Global chrome (PUB-23)**

- Header and footer links (every one), mobile tab bar docking and safe area, auth side panel, account menu states, cookie consent accept, reject and reopen, install prompt, offline banner, scroll restoration between list and detail.

## Hidden surfaces

Public read functions (`get-public-*`, `list-public-*`, `search-*`), `public_listing_search` index and its triggers, `property-page-views-prune-cron`, `indexnow`, sitemap and robots generation, prerender or meta injection, edge caching and `query-cache-sweep-cron`, analytics page views (C36), captcha and rate limits on public writes.

## Connections and journeys

C08, C09, C10, C11, C12, C17, C29, C30, C34 as reader. J01, J05, J09, J10, J12, J13, J26, J27, J30.

## Known risks

- SEO work is mid-flight (H1, heading order and mobile layout items were skipped in the SEO plan); check F23 strictly.
- Listing map needs the Maps key; without it the state must be graceful.
- Bundle budget was over; verify public route chunks do not import dashboard or editor code (Konva / Polotno).
- No green-on-green and other palette rules from the marketing palette decisions apply to public brand surfaces.
