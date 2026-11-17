---
title: 'Audit 07: marketing site and guest account'
status: active
tags: [audit, marketing, guest-account, ux]
updated: 2026-11-18
---

# 07: Marketing site, auth and guest account

Scope: public marketing pages, auth, and `/account/*`, signed out then signed in as
`guest.demo@example.com`. Desktop 1440x900 and mobile 390x844. Screenshots in
`/tmp/audit/marketing-screens/` (112 files).

Findings below were re-checked by a second pass where marked **verified**. Where a claim could not be
reproduced it is called out explicitly rather than repeated.

---

## P1

### M1. The parking photo 404s on every parking surface (verified)

`images.unsplash.com/photo-1590674899484-f5649e4292cf` returns 404 and is used by the seed and by
`parkingSlotMedia.ts` / `mockListingImages.ts`. Result: blank hero on the parking detail page, blank
card on `/parkings` and `/search`, and on the request form a white circle with three wrapped lines of
`alt` text on top of the card header.

Worse than a missing image: the `alt` text is painted into the layout, so it overlaps badges and
titles. There is no `onError` fallback anywhere in the shared media component.
[screenshots/27-parking-form-broken-avatar.png](./screenshots/27-parking-form-broken-avatar.png)

### M2. The city landing route drops the city (verified)

`/properties/in/pampanga` redirects to `/properties` with no city filter, no heading and no notice.
The same pattern applies to `/parkings/in/:location` and `/developments/in/:location`. These are the
classic SEO and share entry points, so a visitor (or crawler) clicking "Pampanga" sees every listing
and nothing confirms the city.

### M3. `/search?q=` is ignored, only `?where=` filters (verified)

`/search?q=zzzzzz` returns the same three results as `/search`. The hero search writes `?where=`, so
internal links work, but any shared, bookmarked or externally linked `?q=` URL silently shows all
listings with an empty search bar. Accept `q` as an alias and echo the active query in an `<h1>`.

### M4. `/account/help` is empty while `/support` has the full FAQ (verified)

Signed in, `/account/help` renders "No help topics yet" plus a "Contact support" button. The public
`/support` page renders a populated FAQ (guest section plus host answers) from
`list-public-support-faqs`. A signed-in guest with a question is pushed to email for no reason.

### M5. Trip list groups a future stay under PAST and shows impossible statuses (verified)

`/account/trips` on 18 Nov 2026:

- UPCOMING: Nov 17-18 2026 (Request sent), Nov 20-21 parking (Request sent), Dec 12-15 2026 (Confirmed)
- PAST: **Jan 31-Feb 1 2027 (Completed)**, Oct 23-25 2026 (**Ready for check-in**)

A stay six weeks in the future is marked past and completed, and a stay that ended a month ago still
says "Ready for check-in". Either the grouping uses a non-date field (creation order?) or the seeded
statuses never advanced. Both are user-visible on the page a guest checks most.
[screenshots/47-trips-wrong-grouping.png](./screenshots/47-trips-wrong-grouping.png)

### M6. Mobile host pricing opens on the most expensive tier (verified)

`/for-hosts/pricing` at 390 opens the carousel on **Business ₱1,439** under a heading that says
"Start free on one listing". Free and Starter are off-screen with no dots or "1 of 5" indicator. On a
phone, the first thing a prospective host sees is the top tier, which reads as bait and hides the
free entry point. Start at index 0 and show position.
[screenshots/48-host-pricing-mobile-business-first.png](./screenshots/48-host-pricing-mobile-business-first.png)

### M7. Parking request rejects a different guest email with a generic toast

Signed in as guest A, entering guest B's email and submitting returns
`403 {"error":"Sign in with the guest email to submit this request"}` but the UI shows only "Could not
submit parking request". The recovery path (sign in as the other guest) is never surfaced. Either
prefill and lock the email to the signed-in account, or show the server message.

### M8. Public host profile exposes seed identity (verified)

`/hosts/kame-homes` says "Hosted by **seed-owner**" with the bio "**Local demo host for the canonical
seed dataset.**" This is a shareable public page. Use the org display name and a real bio in the seed.

## P2

| #   | Finding                                                                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M9  | **Parking is labelled "Parking in Other"**, including the public URL `/parkings/in/other` and the page title "Parking for rent in Other". "Other" is an internal fallback bucket leaking into copy and links.                                                                                                                                       |
| M10 | **Development cards** are titled "Condo in San Fernando" (type + city) with the building name as subtitle, and show **"₱0 / night · 1 home"**. Title the card with the building, derive a "From ₱x" price, and omit price when unknown.                                                                                                             |
| M11 | **`/account/stays` is not a page**: it redirects to `/account/messages`, and the account nav has no Stays entry. The route guide still describes `/account/stays` as the stay messaging hub (and says `/account/messages` redirects there), which is now inverted. Update the guide and decide whether a Stay guide entry belongs inside each trip. |
| M12 | **Trip reference is a raw hex fragment** ("Booking details 5EED1000"), not a human booking code. Generate a short reference.                                                                                                                                                                                                                        |
| M13 | **Home "Where" typeahead opens below the fold** at 1440x900 (results clipped), and is covered by the cookie banner and the floating trip card until both are dismissed.                                                                                                                                                                             |
| M14 | **Property cards have three different designs** across `/properties`, `/search`, development pages and favourites. The stripped variant hides capacity and amenities, which are the facts guests compare on.                                                                                                                                        |
| M15 | **Saved-favourite state is inconsistent**: the same saved property shows a filled rose heart on `/search` but an empty outline heart on `/properties` while both report `aria-pressed="true"`.                                                                                                                                                      |
| M16 | **Contact/ticket modal on mobile hides the Details field under the fixed submit bar**, and the attachment control is off-screen.                                                                                                                                                                                                                    |
| M17 | **Services is a primary nav item** that opens "Coming Soon" with a search bar and seven category chips that do nothing. Remove from nav until launch or replace with a waitlist.                                                                                                                                                                    |
| M18 | **`/accept-invite` invalid state is a dead end**: centered card, no nav, no home/sign-in link, no "request a new invite".                                                                                                                                                                                                                           |
| M19 | **`/for-hosts` video has no poster frame**, so the biggest proof element on the host page is a ~540px blank panel until played.                                                                                                                                                                                                                     |
| M20 | **`/for-hosts/v3` has three failed Unsplash images and a solid black block** above the footer. If the variant is ever promoted it ships visibly broken.                                                                                                                                                                                             |
| M21 | **`/for-hosts/preview` silently redirects to `/for-hosts/v2`**, and v2/v3 have no "preview variant" banner or way back.                                                                                                                                                                                                                             |
| M22 | **Parking form**: Continue/Submit stay disabled with no explanation until fields are touched; dates use `MM/DD/YYYY` while the rest of the flow says "Nov 20-21, 2026"; the "Which stay?" step lists three rows with identical subtitles ("· Monaco 2604"), so repeat guests cannot tell which booking they are attaching parking to.               |
| M23 | **Missing `<h1>`** on `/search`, `/properties`, `/parkings`, `/developments`, and most `/account/*` pages. Multiple `<h1>`s on all three `/for-hosts` variants (one of them inside a dashboard mock).                                                                                                                                               |
| M24 | **Ticket timestamps are impossible**: the Nov 17 ticket's only reply is dated "Nov 12, 3:48 PM". Seed the reply after the ticket. Dates also omit the year.                                                                                                                                                                                         |
| M25 | **Account tab grid at 390 is cramped**: eight items in a 4x2 grid, 52px pills with a 1px row gap, labels touching the pill edge.                                                                                                                                                                                                                    |
| M26 | **Property detail mobile**: the sticky Reserve bar overs the self check-in and cancellation cards.                                                                                                                                                                                                                                                  |
| M27 | **Parking list mobile card is 266px wide** inside a 390 viewport (90px dead space), while the same card is full-bleed on `/search`.                                                                                                                                                                                                                 |
| M28 | **Filter chips truncate mid-word on desktop** ("Air…", "Balcony/Pat", "Fire…", "24/7…") in the two-column sidebar, despite available width.                                                                                                                                                                                                         |
| M29 | **Guest profile leaks implementation detail**: bare counter "465" with no unit, "Version — Local build", "Offline 228 KB used".                                                                                                                                                                                                                     |
| M30 | **The SPA shell ships `noindex, nofollow`** in `ui/index.html`. Per-route meta is injected by `seoMiddleware` for crawlers on Vercel, so this only matters if that path is bypassed. Verify on a preview with `curl -A Googlebot`; in Vite dev every page reports noindex.                                                                          |

## P3 (copy)

- "Become a host?" as a button label reads as a question.
- "Sign in with your explore account…" uses internal brand language; the rest of the app says "guest account".
- "1 booking workflow" in the host stats strip is a tautology that looks like an empty stat.
- Eyebrow casing is inconsistent: `condo`, `CONDO`, `Condo`, `CONDO in San Fernando`.
- "No choice yet" in the Cookie Policy settings card reads like an error.
- Support copy tells guests to "tap Stay guide", but no such entry exists (the trip page calls it "Getting there").

## Reported by the first pass, not reproduced on re-check

- A rating mismatch on `/properties/kame-home` (4.6 in the booking card vs 4.5 in the reviews
  section). Re-checked twice: both surfaces now read 4.5. Worth a unit test on the two aggregates,
  but do not treat it as confirmed.
- Host pricing "3 of 5 cards reachable by pointer on desktop". Not re-measured.

## What works well

- Guest OTP login: inline email validation, "We sent a code to …", live resend countdown, no dead ends.
- Trip detail page is the strongest guest surface: progress, what happens next, cancellation policy
  with an exact deadline, directions, parking shortcut and three clear actions.
- Property detail desktop IA: gallery, breadcrumb, rating, capacity, amenities, house rules,
  cancellation, reviews with category scores, sticky price card.
- Contact to ticket: four category cards open a pre-selected ticket sheet, submit disabled until
  valid, works on phone as a bottom sheet.
- Search typeahead groups Properties / Parkings with "See all results".
- Accessibility baseline: named icon buttons, `aria-pressed` on favourites, full calendar day names,
  real `<label for>` on fields, `aria-labelledby` on dialogs.
- 404 page, legal pages, about and contact are clean and consistent.

## Coverage (42 route/viewport combinations)

Full table in `/tmp/audit/findings-marketing-guest.md`. Every route listed in that report was loaded at
both viewports; the issues per route are summarised there. The only routes not fully exercised were
`/parkings/requests/:id` beyond its rendered state and the host auth modal's Google branch.
