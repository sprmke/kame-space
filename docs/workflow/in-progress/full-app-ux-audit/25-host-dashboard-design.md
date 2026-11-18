---
title: 'Audit 25: host dashboard design critique'
status: active
tags: [audit, design, dashboard, org, property, mobile]
updated: 2026-11-19
---

# 25: Host dashboard design critique

Design critique of the org and property dashboards: hierarchy, density, tables, charts, settings, mobile
and tablet, copy. Functional findings stay in [20](./20-property-dashboard-pages.md) and
[21](./21-org-dashboard-pages.md).

Raw designer notes (674 lines, 27 routes × 1440/768/390): `/tmp/audit/findings-design-host.md`,
captures `/tmp/audit/design-host/` (90 files). Claims below were re-measured in the running app; two were
corrected and one was retracted (noted at the end).

---

## The one-sentence diagnosis

The product is not badly styled, it is **unranked**. Every screen presents five to eight equal-weight
blocks in identical card chrome, so the number or action that actually matters never wins the eye.

Measured on the property dashboard at 1440: **48 bordered surfaces, 38 of them above the fold, and zero
section headings above the fold.** The eye has no entry point and no path.

---

## Critical problems

### P25-1 (P1). Metric sludge: 17 of 27 pages open with four equal-weight stat cards

Org dashboard, bookings, reviews, analytics, properties, parkings, team (five), announcements, help,
property dashboard, property bookings, property reviews, finance, maintenance, property analytics,
notifications, property team. Identical chrome: 14px label, 24px value, 11px delta, a decorative icon well
in a grey circle.

On Bookings the row is irrelevant to the job (progress a booking) yet on a phone it consumes the first
screen. On the property dashboard four cards each carry a `?` hint **and** an icon: eight pieces of chrome
for four numbers.

The numbers also disagree across pages in the same session:

| Source                | Occupancy     | Revenue          |
| --------------------- | ------------- | ---------------- |
| Org Analytics header  | 41.67%        | ₱46,550.00       |
| the two rows under it | 40% / 43.33%  | ₱42,000 / ₱4,550 |
| Org → Parkings        | 0%            | ₱0               |
| Org dashboard         | 42% (rounded) | ₱44,740          |

**Change:** one stat band: two or three numbers that change a decision, one delta with a real baseline, no
icons, no hints. Publish one formatting contract (currency, percent, date, scope label) and use the same
aggregate endpoint for every surface that shows the same number.

### P25-2 (P1). The org bookings table is clipped at 1440

Measured: table 1162px inside a 1094px wrapper; the `ACTIONS` header sits at x=1385–1475 in a 1440
viewport. macOS hides scrollbars, so the last column is invisible with no cue. Property bookings (seven
columns, no `LISTING`) fits.

At 1024 both tables overflow by ~240px (`ACTIONS` right edge 1264), inside a scroll container.

**Change:** drop or nest `LISTING` at `xl`, pin the action column, and add a right-edge fade + "more →"
affordance. Never let `ACTIONS` be the clipped column.

[screenshots/100](./screenshots/100-bookings-1024-clipped-actions.png)

### P25-3 (P1). The Revenue Overview chart is missing below 1024px

At 768 and 390 the org dashboard's top chart card renders its header ("Revenue Overview", Revenue/Bookings
segment) and nothing else: DOM count of chart surfaces is **2 at 1440 and 1 at 390**. The most-viewed chart
in the product is blank on phone and tablet.

**Change:** render the chart at every breakpoint, or replace it below `md` with a compact stat + sparkline.

[screenshots/107](./screenshots/107-revenue-chart-missing-390.png)

### P25-4 (P1). Settings is 7-9 screens tall, and on a phone there is no way to save it

| Page              | 1440            | 390           |
| ----------------- | --------------- | ------------- |
| Property Settings | **7.2 screens** | **9 screens** |
| Org Settings      | 3.3 screens     | 3.8 screens   |

Property Settings stacks 19 cards, each with a `CardDescription`, and its section rail disappears below
`lg` with nothing replacing it.

Save state, measured:

- **1440:** no Save on load; editing a field makes **Save Changes** appear. Correct.
- **390:** editing a field produces **zero** save/discard/unsaved controls, and the only sticky element is
  the bottom tab bar. Verified twice, on both settings pages.

So a host on a phone can change the cancellation policy and has no way to commit it, no saved indicator,
and no way to reach the section four screens down.

**Change:** a sticky section picker (`Section: Basic Information ▾` → `MobileChoiceSheet`) plus a
`ContextualActionBar` with Save. One pattern for Settings, notifications and any long admin form.
Separately: split Property Settings into sub-routes (Basic / Photos / Policies / Guest form / Integrations /
Activity) so it is not one 6,500px document on any device.

### P25-5 (P1). A signed-in host can fall out of the product into the public 404

`/org/kame-homes/property/kame-home/dashboard` renders the **marketing 404** ("ERROR 404" with the public
nav and `Become a host?`), because org uses `/dashboard` and property uses `/`. A host who adds `/dashboard`
out of habit loses the app shell and has no "back to my dashboard" path.

**Change:** redirect `.../property/:slug/dashboard` to the property index, and give the 404 a "Back to your
dashboard" action when a session exists.

### P25-6 (P1). Two primary-data contrast failures caused by opacity

| Surface                    | Measured                     | Cause                   |
| -------------------------- | ---------------------------- | ----------------------- |
| Paused team members        | **2.26:1** name, 2.35:1 role | ancestor `opacity: .55` |
| Pricing calendar day rates | **1.93:1** at 12px           | ancestor `opacity: .45` |

Both are data, not decoration: a host reads paused teammates and day rates. Dimming a whole row below 4.5:1
is not a state, it is a deletion.

**Change:** express state with a badge or a strikethrough, and keep text ≥4.5:1. Add an opacity-aware
contrast check to the design guard.

### P25-7 (P2). Charts that cannot be read, in a palette that is not the brand

- Property Analytics is the only screen painted in raw Tailwind colours: measured fills
  `rgb(14,165,233)` sky, `rgb(16,185,129)` emerald, `rgb(245,158,11)` amber, `rgb(139,92,246)` violet,
  `rgb(236,72,153)` pink, `rgb(100,116,139)` slate, `rgb(239,68,68)` red. The org dashboard uses tokens
  (teal `rgb(20,184,166)`). Two chart languages in one product.
- "Where bookings come from" and "Listing visits" are donuts with **no legend and no labels**; neither has
  a text alternative.
- "Guest origins" lists six rows all at `16.67%` with six identical bars: a table pretending to be a chart.
- "Party size" bars have no y-axis and no value labels.
- Legends list categories unsorted (79, 6, 1 | 11, 2), so size does not map to order.
- "How you compare" is a permanent empty panel.

**Change:** one chart palette derived from the brand tokens; legends sorted by value; label or table-ise
donuts; delete panels that can never fill.

### P25-8 (P2). The notification feed is 13 near-identical rows of engineering copy

The property notifications page is dominated by rows reading
`itest-f4a390de: 2 imported reservations overlap existing bookings or blocks. Both are kept. Check Channel
sync → Recent activity, then resolve on the platform that should not have it.` The page total is **15
strings over 110 characters**, all from this one template, some dated 2027.

**Change:** collapse to one row per conflict type with a count (`13 calendar conflicts`), a single action
(`Review conflicts`), and the id behind a details expansion.

### P25-9 (P2). Mobile and tablet get a phone layout with phone density

- **Bookings at 390:** four KPI cards (~300px) plus two toolbars before the first booking; the first row
  starts at y≈390.
- **768:** the admin shell uses the stretched phone dock (bottom tab bar), phone cards instead of the
  table, one content column, 10px labels and 32-36px targets. A tablet has room for the table and the
  sidebar; it gets neither.
- **Booking detail at 390:** the workflow steps are six unlabelled dots, and the current-step action lives
  in the sticky bar with no step names.

**Change:** a real `md` layout (rail collapses to icons at 768, table stays a table), and a labelled
stepper on phone (`1 Guest · 2 Stay · 3 …`).

### P25-10 (P2). Copy that reads unfinished

Measured strings on live pages: `1 properties`, `Baserates`, `Copyhistory`, `AssociationDues`,
`Standard Standard: Free cancellation…`, `Jun21-22`, `Plan: Pro` on a Business plan, `Free seats or upgrade
your plan`, `Local demo finance row`, `LOCAL_SEED`, `Booking 5eed1000…`.

**Change:** a copy sweep for missing spaces and duplicated words (these look like a broken join in a
template), plus a guard that blocks `LOCAL_SEED`, `example.com` and raw UUIDs from rendering.

### P25-11 (P2). Badge inflation: nine styles across six pages

Badges vary in size (10-12px), casing (UPPER / Title), shape and colour (pink, teal, grey, amber, blue,
outline, red). Compare a status pill on Bookings, a plan badge in the sidebar, and a role badge in Team:
three visual languages for "a short label with a state".

**Change:** one badge component with `status | meta | plan` variants and a documented colour map.

### P25-12 (P3). Duplicated content on single screens

Property Settings renders **two `Guest experience` cards** (one with a `CardDescription`, one without).
Reviews shows "Guest reputation" and "Review guest" as separate blocks. Analytics has two permanently empty
cards. Marketing shows `Nothing saved yet` four times.

---

## Page-level notes

### Property dashboard

- Eight equal panels. No focal point. `Total Bookings 12 / 30` is nights, not bookings.
- `+0.0%` with a green up arrow; `Low occupancy next 30 days 40` reads as 40 items.
- Calendar: pills truncate to `• R…` at 390, and the card promises "Tap a date to open booking details"
  while free dates are disabled and booked cells do nothing (only the name pill navigates).
- Sidebar: "Public Pages" clips behind the plan card at 900px height.

[screenshots/89](./screenshots/89-mobile-dashboard-calendar-pills.png)

### Bookings

- Stage cards: counts do not match the list (Action Required 5 while the list shows six Pending Review).
- No bulk actions: no row selection, no bulk status change, no export.
- Switching to Calendar or Kanban silently adds `showCompletedBookings=true&limit=100` and nothing removes
  it on return, so the table shows completed rows with no control to hide them.
- Status-filter checkboxes are `<button role="checkbox">` inside an unassociated `<label>`, so they have no
  accessible name.
- Import without an AI key matches 0 of 8 obvious headers and asks for full manual mapping.

### Booking detail

- The tab set changes with status (`Parking` present on Pending Review, absent on Pending Documents) with
  no explanation.
- No "message guest" action; the only route to a conversation is Inbox search.
- Files tab is text buttons: no thumbnail, size, date or AI verdict inline.

### Finance

- Net profit includes unpaid pipeline (UI ₱49,890 vs API ₱7,390 vs Analytics ₱42,500).
- Export opens an unexplained chooser (Full report / Overview / Ledger / Transactions) with no size hint.
- Recurrence is a 4th wizard step for a one-off expense, and "Does not repeat" prints twice.

### Pricing

- No upper bound on rates: `46004500` saved (verified during the audit).
- Day cells render at 45% opacity, 12px rates → 1.93:1 (P25-6).
- Money inputs unformatted (`4500`) while read-only values are `₱4,500.00`.

### Maintenance, Analytics, Reviews, Marketing, Inbox, Templates, Public pages, Team

- Maintenance: status column shows "-" for 12 of 18 rows because the badge is gated on
  `telegram_reminder_enabled`, not completion.
- Analytics: Export PDF fails with a raw JS error (19-D3-1); charts have no legends.
- Reviews: an empty Respond save silently deletes the response.
- Templates: Save opens an OTP modal whose only other control is "Discard changes".
- Public pages: no publish/unpublish control; 36 `role="tab"` nodes without accessible names.
- Marketing: saved creations render as blank boxes (missing storage objects).

---

## Mobile change list

| Route              | Remove                                     | Merge                             | Move                                        |
| ------------------ | ------------------------------------------ | --------------------------------- | ------------------------------------------- |
| Org dashboard      | 4 KPI cards → 2                            | Needs-attention into a 3-row list | revenue chart → sparkline                   |
| Property dashboard | month grid                                 | KPIs → 2×2, hide zero deltas      | calendar → agenda list                      |
| Bookings           | second toolbar (Card/Calendar)             | stage cards → chips               | filters + sort into one sheet               |
| Booking detail     | six unlabelled dots                        | pricing summary + payment block   | workflow action → sticky bar with step name |
| Finance            | recurrence step for one-off                | KPIs → 2×2                        | Add transaction → labelled CTA              |
| Pricing            | 7-column month grid                        | legend → inline hint              | day editor → full-screen sheet              |
| Maintenance        | hover-only row actions                     | export menu                       | mark-done → swipe or explicit button        |
| Settings           | 12 setting cards not reachable in a glance | 19 cards → 6 sub-routes           | section picker + sticky Save                |
| Notifications      | 13 duplicate conflict rows                 | module settings behind "Manage"   | per-module deep links                       |
| Team               | 5 KPI cards                                | role counts                       | invite → header CTA                         |

---

## Copy rewrites

| Current                                                 | Proposed                                                               | Why                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------- |
| "Overview of your property's performance and activity." | _(delete)_                                                             | restates the H1         |
| "Manage and track all bookings for this property."      | _(delete)_                                                             | restates the H1 and nav |
| "Low occupancy next 30 days 40"                         | "Low occupancy · 40%"                                                  | unit missing            |
| "Total Bookings 12 / 30"                                | "Nights booked 12 of 30"                                               | wrong noun              |
| "↑ +0.0% vs last period"                                | "No change"                                                            | 0 growth is not up      |
| "Standard Standard: Free cancellation…"                 | "Standard: Free cancellation…"                                         | duplicated word         |
| "Baserates" / "Copyhistory" / "AssociationDues"         | "Base rates" / "Copy history" / "Association dues"                     | missing spaces          |
| "Plan: Pro" on Business                                 | plan name from the plan catalogue                                      | wrong label             |
| "Nothing saved yet" ×4                                  | one empty state on the section that owns the data                      | repetition              |
| "Email is not configured"                               | "We can't email a code right now. Try again later or contact support." | raw provider error      |

---

## Corrections to the raw notes

- **"Two `<h1>` per page everywhere"** — measured: two `h1` elements exist in the DOM, but one is the mobile
  brand-hero title and is `display:none` at desktop. Screen readers see one. Kept as a semantics tidy-up
  (render one h1 and style it per breakpoint), not an a11y defect.
- **"No Save anywhere on Settings"** — half right. At 1440 Save Changes appears after an edit; at **390 it
  never renders**. The finding stands as a mobile defect (P25-4).
- **Retracted:** none for this pass.

---

## Top 20 by impact

| #   | Change                                                                               |
| --- | ------------------------------------------------------------------------------------ |
| 1   | Fix the org bookings table at 1440 (drop/nest `LISTING`, pin actions)                |
| 2   | Render the Revenue Overview chart below 1024                                         |
| 3   | Replace the 4-card KPI row with one ranked stat band                                 |
| 4   | One formatting contract for money, percent, dates, and month scope                   |
| 5   | Rebuild property Analytics on the brand palette with legends                         |
| 6   | Split Settings into sub-routes; section picker + sticky Save on mobile               |
| 7   | Fix the two opacity contrast failures (team rows, pricing day rates)                 |
| 8   | Purge seed and internal strings from every host surface                              |
| 9   | Fix `/property/:slug/dashboard` → property index, and the 404 recovery path          |
| 10  | Group the notification feed by conflict type with a count                            |
| 11  | Mobile Bookings: one chip row and one toolbar before the first booking               |
| 12  | Labelled workflow stepper + sticky action on booking detail                          |
| 13  | Pricing on phone: agenda view + rate editor sheet; bound the rate input              |
| 14  | Brand colour picker: current colour, hex, `aria-pressed`, collapse the row           |
| 15  | One badge component with a documented colour map                                     |
| 16  | One table primitive: sticky header, pinned actions, 44px rows, labelled ⋯            |
| 17  | Delete duplicated cards (Guest experience ×2, empty analytics panes, ×4 empty saves) |
| 18  | Copy sweep for missing spaces and duplicated words, plus a seed-string guard         |
| 19  | A11y shell pass: one h1, consistent focus ring, 44px icon actions                    |
| 20  | A real 768 layout: icon rail + table, not a stretched phone dock                     |

---

## Coverage

| Group              | Routes | 1440 | 768 | 390 |
| ------------------ | ------ | ---- | --- | --- |
| Org dashboard      | 11     | yes  | yes | yes |
| Property dashboard | 16     | yes  | yes | yes |

Metrics: bordered-surface count and above-fold count, page height in screens, table geometry, chart
surface count, contrast with opacity blending, tap targets, heading outline, focus styles, copy strings.
