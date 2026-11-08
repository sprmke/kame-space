---
title: 'Guest sign-in: shared auth shell + animated feature showcase'
status: active
tags: [workflow, planned, auth, guest, marketing]
updated: 2026-11-08
stage: planned
kind: plan
---

# Guest sign-in: shared auth shell + animated feature showcase

Routes: `/for-guests/login` (host routes keep their content, only the shell is shared). `/register` on either audience is a redirect to that audience's `/login`.

## Problem

Host and guest auth pages share `AuthLayout` and the form, but the left panel drifted:

|            | Host (`HostWorkspaceSidePanel`)                         | Guest (legacy `GuestAuthBrandingPanel`)       |
| ---------- | ------------------------------------------------------- | --------------------------------------------- |
| Background | solid `bg-primary-strong`                               | brand gradient + blur blobs + grid            |
| Logo       | inset top-left (`left-4 top-4`, matches `MarketingNav`) | inside `p-10` padding                         |
| Heading    | left-aligned title + one line                           | centered display headline + paragraph + badge |
| Content    | interactive tour card                                   | static 2x2 feature cards                      |
| Proof      | none                                                    | invented stats (`500+`, `4.9`, `10k+`)        |

Phone (< `lg`) shows nothing for guests beyond the form, so guests never learn why an account helps.

## Goals

1. One panel shell for both audiences: same background, logo position, heading scale and column width. Only the content slot differs.
2. Guest content: an animated product showcase, not a video. Built from live DOM mock UI (framer-motion), so it stays crisp, themable, light and accessible.
3. Answer "why sign in" with real features only. Remove invented numbers.
4. Short comparison against typical booking apps, without naming brands (no claims we cannot back up).
5. Works at 375 / 768 / 1024 / 1440 and short laptop heights (768px tall).

## Research notes (what converts on auth pages)

- Auth side panels that convert show the product, not adjectives (Linear, Notion, Airbnb host signup). A moving mock UI beats a feature list.
- Show the user's own journey in order (find, book, talk, prepare, stay, come back). People map it to their next trip.
- Keep motion short and looping per scene (4 to 6s), user-controllable, and stop autoplay under `prefers-reduced-motion`.
- Comparisons work best as a short "us vs the usual" checklist with concrete pain points, not a feature matrix.

## Guest feature inventory (verified in route guides)

| Chapter    | Feature                                                                            | Source                     |
| ---------- | ---------------------------------------------------------------------------------- | -------------------------- |
| Search     | Smart search (intents, nearby), properties + parkings + developments, map          | `search.md`                |
| Book       | Pick dates, book straight with the host, pay a down payment first                  | `properties.md`, `trip.md` |
| Chat       | Message the host, FAQ starters, AI voice receptionist where enabled                | `properties/chat.md`       |
| Trip       | One trip page: status progress, approved documents, parking, balance, cancellation | `trip.md`                  |
| Stay guide | Private stay guide: check-in steps, Wi-Fi, house rules, host contact               | `stay-guide.md`            |
| Perks      | Next-stay vouchers, favorites, reviews, deposit refund tracking                    | `account/*.md`             |

## Design

**Shared shell:** `AuthSidePanelShell` (marketing/shared) owns `aside` + `bg-primary-strong`, the inset logo link, title + description and a centered `max-w-xl` column. `HostWorkspaceSidePanel` and the new `GuestExperienceSidePanel` both render through it.

**Guest showcase card** (`GuestFeatureShowcase`):

- Card matches the host tour card (`bg-card/95`, `rounded-xl`, border, shadow).
- Stage: one animated mock scene per chapter, cross-faded with `AnimatePresence`.
- Chapter rail: 6 icon tabs (`role="tablist"`), active tab shows a progress fill, title + one-line description under the stage.
- Autoplay 6s per chapter; pauses on hover / focus / hidden tab; click or arrow keys to jump.
- Reduced motion: no autoplay, scenes render in their final state.

**Comparison strip** (`GuestComparison`): 4 rows, "Kame Space" check vs "Usual booking apps" cross. Hidden on short desktop viewports (< 820px tall) so the panel never scrolls.

**Phone / tablet (< `lg`):** under the form, a "Why sign in" section with the same showcase (compact) and the comparison. Host phone layout unchanged.

## Phases

1. Extract `AuthSidePanelShell`, move host panel onto it (no visual change for host).
2. Guest panel: chapters data, 6 scenes, showcase card, comparison.
3. Mobile section in `AuthLayout` for guest routes.
4. Verify in browser at 375 / 768 / 1024x768 / 1440x900, light + dark, reduced motion.
5. Docs: `docs/guides/routes/auth.md` layout section + implementation map.

## Out of scope

- Plans / RBAC: N/A (public page).
- activity-log: N/A (no mutation).
- Host tour film content.
- Named competitor comparisons.

## Revision 2 (2026-11-08): scene polish + Compare chapter

Feedback: some scenes looked broken or static, and the comparison table under the card broke parity with the host panel.

- Comparison table removed. It is now the 7th chapter, **Compare**: a draggable before/after wipe from scattered "usual apps" messages to the one-page trip.
- Every scene now tells a short story on a shared clock (`useShowcaseSteps`): a fingertip tap on the real control, a state change, then the result. No free-floating cursor, so nothing can drift out of alignment at different widths.
- Fixes: calendar range is one continuous band; voucher notches are real mask cut-outs; chat bubbles have contrast; map pins sit on land; shadows stay neutral in dark mode; brand fills behind white text use `bg-primary-strong` (DESIGN.md rule).
- Per-chapter durations (5.5 to 8s); phone stages drop the map, the price breakdown and the callouts instead of shrinking text.

## Revision 3 (2026-11-08): receptionist, wheel, stronger Compare

- **Chat** gains a voice act: the real 3D turtle receptionist (`ReceptionistAvatar`) in the booth ring, with captions. Lazy-loaded; WebGL probe + error boundary fall back to the idle image (headless Chrome hit a WebGL crash that took down the route before this guard).
- **Perks** is the real voucher wheel (same prize pool and colors as the after-stay reveal), landing on 15% off, then **Book again** and the deposit payout.
- **Compare** maps five moments of one trip row by row (usual chore vs the trip page), matched with a cross, a link across the divider and a check, then a tally. Keeps the draggable wipe.
