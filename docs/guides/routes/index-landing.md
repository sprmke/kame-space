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

This is the main guest homepage: search, then one swipeable row each for stays, residences, and parking, the reasons to book here, how a booking goes, and a band inviting owners to host. Hosts rarely land here unless they switch back to "explore" mode.

**Common host questions**

- Q: Why does KameSpace have a new icon?
  A: The four-piece shell is the new KameSpace logo. Your account, bookings and organization branding stay the same. A saved home-screen icon or shared link preview may take longer to refresh than the website.
- Q: How often does the Featured stays row change?
  A: It refreshes every few minutes and always shows active homes with the best ratings first.
- Q: Will my listing appear on the home page automatically?
  A: The rows show live published listings, up to eight per type. A listing has to be approved and published first. Each row ends with a link to the full list, where every published listing appears.
- Q: How do guests get from here to my property?
  A: They search, or swipe a row and tap a card, or open the full list from the end of a row. From your listing they can reserve or contact you.
- Q: What does the home page tell guests about booking here?
  A: Five things: they book straight with the host and may find a better rate, hosts and listings are reviewed before going live, some properties answer questions through an AI receptionist, parking and building forms are part of the booking, and some hosts give a voucher for the next stay.
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

- **`SpotlightHero`:** rounded photo panel with the headline, one lead line, and the shared `ListingHeroSearch` (submits to `/search`). The panel art is theme-aware: a sunrise render in light mode and a matching moonlit render in dark mode, both at `ui/public/marketing/home/` (`hero-day.*` and `hero-night.*`, **1672×941** masters). A `<picture>` offers AVIF then WebP at **640 / 960 / 1280 / 1672** widths (`sizes` matches `.public-shell`), with JPEG as the last fallback. Phones take the small file; large and retina screens take the full master. Regenerate with `node scripts/media/generate-hero-variants.mjs`. Both layers stay mounted and the night layer dissolves over the day layer on theme change. No zoom or pan: the renders share a frame, so the dissolve is the whole transition. Reduced motion swaps with no animation. The hero has no stay chip; stay and price live in the catalog below.
- **`ExploreCatalog`:** "Find your next stay, home, or parking" with the line "Every listing is booked straight with its host." No tabs: one swipeable row per listing type (`ListingRail`), in the order Stays, Residences, Parking. Each row has a title and a one-line hint, up to 8 live cards in the compact photo-first `carousel` card variant (`PropertyCard`, `DevelopmentCard`, `ParkingSlotCard`), and a closing tile with a mascot that opens the full list ("See all N stays" when there are more than the row shows, otherwise "Browse stays"; "Search, filter, and map"). Cards snap; a phone shows most of one card with the next peeking, tablet 3 per row, desktop 4. When the row is wider than the screen it gets previous / next arrow buttons (`sm`+), a thin scroll-linked position bar, and the same "See all" text link in the row header; when everything fits, the closing tile grows to fill the line and is the only link. Cities are a plain line of text links under the Stays row ("Stays in A, B"), shown only when there are two or more cities; the old city chips and the centered outline "See all" button are gone. Per-row loading skeleton and `ListingLoadError` retry; a type with no listings shows no row.
- **`SpotlightHero` legibility scrim:** the sunrise render carries its own dark left vignette, so the panel uses two soft layers (`.hero-scrim-base` bottom lift, `.hero-scrim-copy` radial corner shade) plus a `.hero-copy` text shadow on the headline and lead. No straight-edged band across the photo, and the photo layer is still clipped on its own so the search dropdown can extend past the panel. The artwork's black point is lifted in the asset to 20% at the left edge (`hero-day.*`), so the corner no longer reads as a black slab against the light page. White copy clears AA at the p90 background pixel: headline 4.19:1 (needs 3:1), lead 4.52:1 (needs 4.5:1).
- **`BookingSteps` band:** the section sits on `--band` (light `220 14% 92%`, dark `0 0% 11%`) instead of the page canvas, so the full-width edge between the sections around it reads as a section boundary in both themes. `bg-muted/40` was too close to `--background` in light to show the edge.
- **`BookingSteps` (scroll story):** pinned for about five screens of scroll. The example trip is driven only by the scroll position: scroll down to play it, up to rewind it, stop to hold a frame. Nothing runs on a timer, so scrolling fast cannot skip a step (a light spring smooths the motion). All five scenes stay mounted and each reads its own 0..1 slice of the scroll through `lib/scrub.ts` + `ScrubParts.tsx` (`Rise`, `Tick`, `Swap`). Steps: Send a request, Your host confirms, Paperwork is handled, Check in, Get your deposit back. Desktop: a rail where every step title and body stays readable and the current one lights up, with a scroll-linked line (click a step to scroll to it). Phone: segmented step bar that fills with the scroll, plus the current title and body. The right side is a trip-page preview (up to 580px wide): property photo (first live stay, or a condo photo fallback), name, status pill (labels match `guestTripStatusLabel`), five-segment progress, then the scene for the step from `BookingStepScenes.tsx` (guest count and ID, email with a drawn check, "Approved" stamp and parking, key turn and stay guide, deposit refund timeline). Labeled "Example trip". Reduced motion: each step shows its finished state with no in-between frames.
- **`WhyBookHere`:** "Why book on Kame Space", now directly after the catalog and before the steps. Five flat panels on `--band` (two-up on tablet, a 7/5 then 5/4/3 grid on desktop, stacked on phone), each one reason with a small picture that plays with the panel's own scroll position and rewinds on scroll up: **Book straight with the host** (example price breakdown with a ₱0 platform cut), **Hosts and listings are checked first** (Government ID, Right to host the unit, Listing reviewed, plus the Recommended note), **Ask a question, get an answer** (AI receptionist chat with a hand-off to the host), **Parking, pets, and building passes** (mascot), **Come back for less** (voucher mascot). Ends with a "Find a stay" link to `/properties`. Wording follows the guest claims and guardrails in `docs/product-positioning.md` on branch `codex/core-product-advantages` ("may find a better rate", "some properties", "some hosts"); do not strengthen these claims. Reduced motion shows the finished state.
- **`HostBand`:** brand-gradient band for owners: "Have a unit? Host it on Kame Space." with one line, three plain points (one workspace, no commission on direct stay bookings, Airbnb calendar and reservations sync in), **Become a host** to `/for-hosts` and **See pricing** to `/for-hosts/pricing`. The Kame mascot (`dashboard-overview` pose) stands on the band's bottom edge and rises into place with the scroll; it sits beside the copy from `md` up and under it on phone.
- **Listings are live.** Sample content: the labeled example trip in `BookingSteps`, the condo photo fallback, and both hero renders.
- **Mascot art:** the home page uses WebP copies of the approved poses at `ui/public/marketing/home/mascot/` (`properties`, `developments`, `parking-listings`, `listening`, `voucher`, `dashboard-overview`, about 25 to 40 KB each), converted from the PNG masters in `ui/public/assets/mascot/`. Always decorative (`alt=""`). `hello`, `room-key` and `phone` are also converted but not used yet.
- **Shared page shell:** nav, footer and every home section use `.public-shell` (`ui/src/index.css`). One class owns both centering and the gutter: `max-width: 84rem` with `padding-inline` 1rem / 1.5rem / 2rem, so the content box is 80rem (1280px) at every width ≥ 1440px. The logo, hero photo panel, catalog cards, steps column and footer columns therefore share one left and right edge. Do not add `mx-auto max-w-*` or horizontal padding on top of it.
- **Shipped.** `/` renders this page. The earlier `guest-landing/` module, `GuestLandingPage`, and the `/v3` preview route were removed; `/v3` now 404s. `/v2` and `/explore-preview` remain as unlinked previews.
- **Legacy redirect:** `/?property=<slug>` still forwards to that property's calendar, so old shared links keep working.
- **SEO:** the page sets `usePageTitle(publicPageTitle('Home'))` and `usePageMeta({ canonicalPath: '/' })`.

---

## SEO

- Registry entry: `home` in `ui/src/lib/seo/publicRoutes.ts` (indexable, in sitemap).
- Canonical: `https://kamespace.com/` regardless of `www.` or preview host.
- Crawler HTML: semantic snapshot from `content/staticPageCopy.ts#STATIC_PAGE_COPY.home`, plus a
  global nav and footer of real links. Browsers never receive it.
- Home title and description come from the registry; the page only calls `usePageMeta({})`.
- Reference: [`architecture/seo.md`](../../architecture/seo.md).

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

## Platform branding

Shared platform chrome uses the approved F5 shell mark. Light and dark themes keep the teal icon; wordmark text adapts to the background. The public HTML includes a branded default share image, while listing links retain their property photos. Asset inventory and regeneration: [brand assets](../../architecture/brand-assets.md).
