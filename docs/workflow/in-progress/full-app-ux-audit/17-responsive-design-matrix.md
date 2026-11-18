---
title: 'Audit 17: responsive and interaction matrix'
status: active
tags: [audit, responsive, mobile, accessibility]
updated: 2026-11-18
---

# 17: Responsive and interaction matrix

52 routes (19 guest, 33 host/admin) x 10 viewports = **520 page loads**, plus targeted walkthroughs for
forms, modals, nav sheets, tables, charts, zoom, keyboard and sticky bars.

Viewports: 320x568, 375x667, 390x844, 430x932, 768x1024, 1024x768, 1280x800, 1440x900, 1920x1080,
2560x1440; plus 150% and 200% zoom emulation and a 400px visual-viewport keyboard case.

Screenshots: `/tmp/audit/responsive-screens/` (`<route>-<w>x<h>.png`).

Note: host routes were measured on the org slug present in the DB at the time (`kame-space`); property
and parking dashboards are index routes (no `/dashboard` segment). Admin shells scroll an inner
container, so `document.scrollWidth` is always the viewport width; clipping was measured on that
inner scrollport.

---

## P0

### V1. The guest form's mobile Continue bar is not pinned

On `/properties/kame-home/form` the `Continue` action bar is `position: fixed` but renders **below the
fold**: measured `top 2972` on an 844px viewport (and 1,300px below at 320x568). It is the primary
action of the entire money path, and at the top of every step the user sees no way to advance.

Cause: `.guest-inner-enter` (`ui/src/index.css:1909`) uses `animation: … both` whose final keyframe is
`transform: translate3d(0,0,0)`. `animation-fill-mode: both` keeps that non-`none` transform forever,
which makes the wrapper the containing block for `position: fixed` descendants; an ancestor
`surface-card` with `will-change: transform` compounds it. The other 12 guest routes pin correctly at
`top: 787`.

Why it was missed: the same stylesheet disables the animation under `prefers-reduced-motion`, so anyone
testing with reduced motion enabled sees the correct layout.

Fix: remove `both` (use `backwards` and clear the transform after the animation, or animate only
`opacity`/`translate`), or portal the action bar to `body`. Add a Playwright assertion that the primary
CTA's bounding box is inside the viewport at 390 and 320.

---

## P1

### V2. More sheet at 320 hides 12 of 15 modules

The nav list inside the More sheet gets `clientHeight 151 / scrollHeight 853` at 320x568 (268px at
390x844) because the plan card, install prompt, persona switch, verification and legal footer take
the rest. Only Dashboard, Bookings and Finance are visible; there is no scroll affordance.
Give the nav the flexible height and pin the footer to its content, or let the whole sheet scroll.

### V3. Admin org hub at 1024 truncates MRR to "₱1…"

Two stacked navs (240px admin + 200px org sub-nav) leave ~580px for a 4-up KPI row; the revenue value
is clipped and the row heights go ragged. Collapse the sub-nav to tabs below `xl` and step the KPI
grid 4 → 2.

### V4. Bookings table at 1024 needs undisclosed horizontal scroll

The content column is `scrollWidth 913 / clientWidth 744`; the Amount column starts off-screen with
no fade or scrollbar hint. At 1024 the table should either drop columns (the card view exists) or show
a scroll affordance.

### V5. The guest home showcase overflows at 320 and is clipped

The text column measures 325px at `left: 16` (right edge 341) and an `h2` measures 339px on a 320px
viewport. Copy is cut mid-sentence by an `overflow-hidden` ancestor, so the document reports no
overflow and nothing can be scrolled. Add `min-w-0` to the grid child and stack below `sm`.

### V6. 320px phone: no booking row above the fold

Hero + month picker + 2x2 KPI cards + search + view toggle consume all 568px on Bookings. The first
row starts below the fold on the smallest supported phone. Collapse the KPI cards to a single row of
chips on `<sm`.

---

## P2

| #   | Finding                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V7  | **Touch targets below 40px**: calendar day cells are 30x30 at 320; recurring `h-6 w-6` (24x24) icon buttons with no hit pad on pricing; 45 of 58 targets under 40px on the property pricing page, 32 of 47 on admin org. |
| V8  | **Bottom tab labels truncate at 320** ("Dashb…", "Bookin…", "Notific…") and a 6th Assistant tab makes it worse.                                                                                                          |
| V9  | **Fixed layers collide**: the notification FAB (40 badge) overlaps PAX cells at 1024 and the Pending Actions card at 1440/2560; on the guest form the bar and the toast can overlap.                                     |
| V10 | **Content under the tab bar**: the inbox's last row sits 40px above the bottom while the bar is 57px, and settings has a 38px gap against the same bar (the page adds `pb-72` plus a sticky footer).                     |
| V11 | **1920/2560 leave ~40% of the screen unused**: a 202px sidebar, a 913-962px content band and ~1,000px of empty canvas, not centred. Either raise `max-width` per module or add a right rail.                             |
| V12 | **Sidebar tail is clipped with no cue**: Help & Support sits 115px below the fold at 1024x768 and 83px at 1280x800 (the nav scroller is 481/810).                                                                        |
| V13 | **Booking Status donut has no legend at any width**, including 2560 where there is room.                                                                                                                                 |
| V14 | **Admin org listings truncate names to 48px** ("Monaco 2604" needs 94) with no `title`; same page still renders "Property + Parking·Invalid Date".                                                                       |
| V15 | **`/search` at 320**: broken parking images with alt text over grey boxes; a development card priced "From ₱0 /night"; filter chips clip mid-word.                                                                       |
| V16 | **Plans at 390**: the Marketing Planner banner clips behind the hero. Parking form at 390: the sign-in sheet renders over a second card with a stray input visible beneath.                                              |
| V17 | **Guest form on a small visual viewport (400px)**: same off-screen bar as V1, so the keyboard case is doubly broken.                                                                                                     |

---

## What holds up

- **Zero horizontal document overflow across all 520 combinations**; zero overflow at 150% and 200%
  zoom (CSS-viewport emulation, `deviceScaleFactor: 2`).
- Tables correctly become 720px card grids at 768.
- Sheets vs popovers split correctly at `lg`; modals become bottom sheets on phone.
- 12 of 13 guest sticky bars pin exactly at `top 787` on 844.
- All guest-form inputs have real labels and the iOS 16px rule is applied.
- Focus rings are visible on every interactive element tested; keyboard order follows the visual order.
- Dark mode holds at every breakpoint.

## Coverage

52 routes x 10 viewports measured for document overflow, inner-scroll overflow, clipped text,
fixed-layer collisions, touch-target size and above-the-fold content, plus walkthroughs for the guest
form (5 steps), date picker, notifications sheet, More sheet, modals, bookings table/card/calendar,
inbox thread, pricing calendar day editor, and zoom.

Not covered: real iOS Safari (safe-area/`dvh` behaviour), Android Chrome, and landscape phones below
568px height.
