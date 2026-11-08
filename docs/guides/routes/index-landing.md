---
title: 'Guest landing — operator guide'
status: active
tags: [guides, routes]
updated: 2026-11-04
---

# Guest landing — operator guide

Route: `/`

> **Status:** Documented — **Phase 1 (UI only)**. Redesigned guest explore landing; mock data; no public API yet.

## Progress overview

| Section          | E2E save | Validation | Docs       | Notes                                                 |
| ---------------- | -------- | ---------- | ---------- | ----------------------------------------------------- |
| Hero + search    | —        | —          | Documented | Search-first; optional dates                          |
| Interactive hero | —        | —          | Documented | Canvas + stacked stay cards (theme-aware)             |
| Stay categories  | —        | —          | Documented | Quick-filter chips → `/properties`                    |
| Featured stays   | —        | —          | Documented | Horizontal scroll carousel                            |
| Destinations     | —        | —          | Documented | 3 editorial destination tiles                         |
| Social proof     | —        | —          | Documented | Single review + trust stats                           |
| Preview redesign | —        | —          | Documented | `/explore-preview` — cinematic redesign, pending swap |
| Mobile shell     | —        | —          | Documented | `MarketingLayoutShell` bottom tabs — see below        |

---

## Overview

Public **guest explore home**. Wrapped in **`MarketingLayoutShell`** (nav, footer, theme toggle). Operational booking calendar lives at **`/properties/:propertySlug/calendar`**.

**Browser tab title:** `Kame Space - Home`. The HTML fallback before React hydrates is `Kame Space` (never `Stays`).

**Mobile shell (2026-09-10):** `MarketingLayoutShell` renders a 5-tab `BottomTabBar` (Explore/Properties/Parkings/Account/More, via `MarketingBottomNav.tsx`) on phone/tablet, replacing the old hamburger + full-screen overlay menu. **More** opens `MarketingMoreSheet` (Explore/For hosts/Company/Legal links, contact email and phone, socials, copyright, theme toggle, `ModeSwitcher`, **Dashboard** when signed in, sign out). `MarketingFooter` is desktop-only (`lg+`); phones have no page footer, the More sheet replaces it (both share `marketingSiteLinks.ts`). Top header stays fixed but is logo-only below `lg` — nav links/CTA/account move into the tab bar + sheet. This shell applies uniformly across every route under `MarketingLayoutShell` (this landing page, `/for-hosts*`, `/properties*`, `/parkings*`, `/developments*`, `/services`, `/about`, `/contact`, `/support`, legal pages, `/account/*`) — see [for-hosts.md](./for-hosts.md) and the `mobile-responsive` skill/rule §2b for the full pattern rather than repeating it on every page.

**Legacy compat:** `/?property=<slug>` redirects to **`/properties/<slug>/calendar`**.

### Design intent (vs template clutter)

Inspired by Airbnb/Agoda search-first patterns, but avoids common pain points:

- **Search is primary** — no promo banners blocking the hero
- **Progressive disclosure** — fewer sections; no long how-it-works / testimonial carousel on home
- **Visual hierarchy** — photography-led cards, horizontal scroll for stays (scan-friendly)
- **Optional dates** — guests can search by destination only. Picking a single day counts as a one-night stay, so the calendar never submits a range the edge rejects.
- **Light + dark** — semantic tokens + theme-aware hero canvas

---

## Host-facing knowledge

This is the main guest homepage: search, featured stays, and destination tiles that send people into the property catalog. Hosts rarely land here unless they switch back to "explore" mode.

**Common host questions**

- Q: How often does the Featured stays row change?
  A: It refreshes every few minutes and always shows active homes with the best ratings first.
- Q: Will my listing appear on the home page automatically?
  A: Not yet. Featured cards still use sample data until the public catalog is connected to live published properties.
- Q: How do guests get from here to my property?
  A: They search or tap a destination, browse the homes catalog, open your listing, then reserve or contact you from there.
- Q: Where does "Become a host?" take someone?
  A: It switches to host mode and the host marketing page, then sign-in. It doesn't go straight into your dashboard.
- Q: How do I get back to the host dashboard from explore?
  A: Open the avatar menu (desktop) or **More** (phone) and tap **Dashboard**.

---

## Sections

| Section        | Component             | Behavior                                                                                                                                                                                                                         |
| -------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero           | `GuestHero`           | Split layout: search + category chips. Chips are a horizontal snap-scroll strip below `sm` (hidden scrollbar, `snap-x`) and wrap to multiple rows from `sm` up                                                                   |
| Hero animation | `HeroCanvas`          | Pointer-reactive canvas + card stack; animation and card rotation pause while the hero is off screen; card photos use `MarketingImage` (srcset sized to the ≤384px card, front card eager + `fetchpriority=high`, the rest lazy) |
| Search bar     | `HeroSearch`          | Where / dates / guests → `/properties`                                                                                                                                                                                           |
| Featured stays | `FeaturedProperties`  | Live catalog in a horizontal snap-scroll; hidden if empty                                                                                                                                                                        |
| Destinations   | `PopularDestinations` | 3 large editorial tiles                                                                                                                                                                                                          |
| Trust + review | `LandingSocialProof`  | Compact stats + one guest quote                                                                                                                                                                                                  |

Removed from home (still in codebase for reuse): `HowItWorks`, `Testimonials`, `TrustIndicators`, `FeaturedDevelopments`.

---

## Preview redesign — `/explore-preview`

A ground-up redesign of the guest explore landing, served at **`/explore-preview`** for manual review before it replaces `/`. Not linked from nav.

Page component `ExplorePreviewPage.tsx`; all sections under `ui/src/features/guest/marketing/explore-preview/`, all copy in `explore-preview/data/explorePreviewContent.ts` (photos, nightly rates, and the guest review are sample content, flagged in a page footnote).

- **Direction:** cinematic arrival + editorial spine. Full-bleed cross-dissolving destination hero with the real `HeroSearch` in a floating console; then an editorial route through stays, a destination mosaic, a 3-step "how a stay comes together" strip, one guest voice, and a brand-gradient closing CTA. No layout family repeats.
- **Constraints honored:** Plus Jakarta Sans only, existing HSL tokens (teal `--primary` the sole accent; gradient only on the closing band), Lucide icons, framer-motion. One authored motion idea (content rises in) plus the hero dissolve and hover zoom; every motion gated on `prefers-reduced-motion`.
- **Reuses:** `HeroSearch` (unchanged), `MarketingLayoutShell` nav + footer.
- **To ship it:** point `/` at `ExplorePreviewPage`, drop the `/explore-preview` route, and update this guide. (Superseded for now by the current `guest-home` landing.)

Sections: `ExploreHero`, `ExploreTrustRibbon`, `ExploreFeaturedStays`, `ExploreDestinationAtlas`, `ExploreStayJourney`, `ExploreGuestVoice`, `ExploreClosingCta`.

---

## Home: `/`

The guest landing at **`/`**. One job: get a visitor into the catalog. Built entirely on `DESIGN.md` tokens (theme-aware light and dark), Plus Jakarta Sans, the `public-*` type and spacing scale, and the shared listing cards.

Page `ui/src/features/guest/marketing/pages/MarketingHomePage.tsx`; sections under `ui/src/features/guest/marketing/guest-home/components/`. Shared search primitives live in `ui/src/features/guest/marketing/shared/components/hero-search/`.

- **`SpotlightHero`:** rounded photo panel with the headline, one lead line, and the shared `ListingHeroSearch` (submits to `/search`). The panel art is theme-aware: a sunrise render in light mode and a matching moonlit render in dark mode, both at `ui/public/marketing/home/` (`hero-day.*` and `hero-night.*`, 1672×941, WebP with a JPEG fallback). Both layers stay mounted and the night layer dissolves over the day layer on theme change. No zoom or pan: the renders share a frame, so the dissolve is the whole transition. Reduced motion swaps with no animation. The hero has no stay chip; stay and price live in the catalog below.
- **`ExploreCatalog`:** "Find your next stay, home, or parking" with the line "Every listing is booked straight with its host." and Stays / Residences / Parking tabs (live totals). Up to 8 real cards per tab using `PropertyCard`, `DevelopmentsGrid`, `ParkingsEntriesGrid`. Stays tab adds centered city chips into `/properties/in/:location`. A centered "See all N ..." button (or "Browse ...") sits under the grid only when the tab has listings; it is hidden while loading, on error, and when empty. Loading skeletons and `ListingLoadError` retry per tab.
- **`SpotlightHero` legibility scrim:** the sunrise render carries its own dark left vignette, so the panel uses two soft layers (`.hero-scrim-base` bottom lift, `.hero-scrim-copy` radial corner shade) plus a `.hero-copy` text shadow on the headline and lead. No straight-edged band across the photo, and the photo layer is still clipped on its own so the search dropdown can extend past the panel. The artwork's black point is lifted in the asset to 20% at the left edge (`hero-day.*`), so the corner no longer reads as a black slab against the light page. White copy clears AA at the p90 background pixel: headline 4.19:1 (needs 3:1), lead 4.52:1 (needs 4.5:1).
- **`BookingSteps` band:** the section sits on `--band` (light `220 14% 92%`, dark `0 0% 11%`) instead of the page canvas, so the full-width edge between the catalog and the steps reads as a section boundary in both themes. `bg-muted/40` was too close to `--background` in light to show the edge.
- **`BookingSteps` (scroll story):** pinned for about five screens of scroll; scrolling down or up moves an example trip through five steps (request, host confirms, building paperwork, check-in, deposit back). Desktop: step rail with a scroll-linked progress line (click a step to scroll to it). Phone: segmented step bar with the current title and body. The right side is a large trip-page preview (up to 580px wide): property photo inset at the top (first live stay, or a condo photo fallback; no overlay or gradient), name and status pill below it (labels match `guestTripStatusLabel`), five-segment progress, then a scene per step from `BookingStepScenes.tsx` (guest counter and ID slide-in, email drop-in with drawn check, "Approved" stamp and parking, key turn and stay guide, deposit refund timeline). Labeled "Example trip". Reduced motion: scenes render without animation.
- **`WhyBookHere`:** "The messages you won't have to send". Centered heading over a before/after stage. Desktop: one "Booked on Kame Space" card in the middle with five rows (parking, building pass, booking status, check-in details, security deposit), flanked by the chat message a guest would usually send a host for each one on other sites, alternating left and right. As each row passes about 62% of the viewport height, a line draws from its message into the card, the message is crossed out ("No need to ask"), and the row fills in with a check. The header pill counts down from "5 messages to send" to "Nothing to send". Hovering a row highlights its message. Phone: each message covers its row and slides off when handled. Scroll back up to reverse; reduced motion shows the final state. Ends with a "Find a stay" link to `/properties`. Messages name no other brand.
- **`HostBand`:** brand-gradient band for owners: "Have a unit? Start earning from it." plus one line, **Become a host** to `/for-hosts` and **See pricing** to `/for-hosts/pricing`.
- **Listings are live.** Sample content: the labeled example trip in `BookingSteps`, the condo photo fallback, and both hero renders.
- **Shared page shell:** nav, footer and every home section use `.public-shell` (`ui/src/index.css`). One class owns both centering and the gutter: `max-width: 84rem` with `padding-inline` 1rem / 1.5rem / 2rem, so the content box is 80rem (1280px) at every width ≥ 1440px. The logo, hero photo panel, catalog cards, steps column and footer columns therefore share one left and right edge. Do not add `mx-auto max-w-*` or horizontal padding on top of it.
- **Shipped.** `/` renders this page. The earlier `guest-landing/` module, `GuestLandingPage`, and the `/v3` preview route were removed; `/v3` now 404s. `/v2` and `/explore-preview` remain as unlinked previews.
- **Legacy redirect:** `/?property=<slug>` still forwards to that property's calendar, so old shared links keep working.
- **SEO:** the page sets `usePageTitle(publicPageTitle('Home'))` and `usePageMeta({ canonicalPath: '/' })`.

---

## Implementation map

| Concern  | Path                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| Page     | `ui/src/features/guest/marketing/pages/MarketingHomePage.tsx`                  |
| Sections | `ui/src/features/guest/marketing/guest-home/components/`                       |
| Hero art | `ui/public/marketing/home/` (`hero-day.*`, `hero-night.*`)                     |
| Search   | `ui/src/features/guest/marketing/shared/components/hero-search/HeroSearch.tsx` |
| Content  | `ui/src/features/guest/marketing/shared/data/landingContent.ts`                |
| Layout   | `ui/src/features/guest/marketing/shared/components/MarketingLayoutShell.tsx`   |
| Routes   | `ui/src/features/guest/marketing/routes/index.tsx`                             |

---

## Pending / follow-ups

- [ ] Wire hero search to real property list filters / API
- [ ] Replace mock featured cards with live published properties
- [ ] Re-introduce developments block when catalog API exists (secondary section)
