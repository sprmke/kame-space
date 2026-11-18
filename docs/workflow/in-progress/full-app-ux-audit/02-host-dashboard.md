---
title: 'Audit 02: host dashboard'
status: active
tags: [audit, host, ux, ui]
updated: 2026-11-19
---

# 02: Host dashboard (org + property modules)

Routes exercised at 1440 and 390: org dashboard, org bookings (table / kanban / calendar),
org properties, org parkings, org team, org plans, org announcements, org analytics, org settings,
org help & support (hub, docs, tickets, ticket detail, new ticket), property dashboard,
property bookings (all views), property detail (7 statuses), property finance, pricing & availability,
analytics, maintenance, notifications, templates, public pages, page editor, team, marketing,
inbox, settings, reviews, announcements, help & support. Parking modules are in
[05-org-and-parking.md](./05-org-and-parking.md); `/admin` is in
[04-platform-admin.md](./04-platform-admin.md).

---

## P1

### H1. "Total Bookings" on the property dashboard shows nights, not bookings

`DashboardStatCards.tsx:39` renders `${kpis.nightsBooked.value} / ${kpis.nightsBooked.periodDays}`,
so a host with 6 bookings and 12 occupied nights reads **"Total Bookings 12 / 30"**. The trend arrow
next to it is the _bookings_ percentage change, mixing two metrics in one card. Either rename to
"Occupied nights" with `12 of 30`, or show the booking count and put nights in the hint.
[screenshots/01-property-dashboard-desktop.png](./screenshots/01-property-dashboard-desktop.png)

### H2. "Low occupancy next 30 days" shows a percentage where a count belongs

The attention list renders `count` as a badge next to "Pending review 5" and "Check-outs today 1".
For `low-occupancy` the API sends `count = occupancyPct` (`_shared/dashboardService.ts:1031`), so the
badge reads "42" (42% occupancy) as if it were 42 bookings. Render it as `42%` or drop the badge and
put the percentage in the label.
[screenshots/02-org-dashboard-desktop.png](./screenshots/02-org-dashboard-desktop.png)

### H3. Occupancy printed twice per listing row

`OrgPropertiesPerformanceCard.tsx` renders `{asset.occupancy}%` both in the meta row and again under
the progress bar, so every row reads e.g. "6 bookings 40% … ₱42,000 40%". Remove one.

### H4. Read-only team members still see write affordances

A viewer with only `*:view` leaves sees an editable **Door code** input with **Save** and an
interactive "I manually reviewed…" checkbox on booking detail (server returns 403, so this is a UI
only defect). Same class of problem wherever a Save control is rendered before a permission check.
[screenshots/35-viewer-booking-readonly.png](./screenshots/35-viewer-booking-readonly.png)

### H5. Analytics is not gated on Free

On Free, the property Analytics page renders all KPIs and every chart, with a single "PRO" pill on
**Export PDF**. The plans matrix and route guide describe Analytics as Pro with a teaser for lower
tiers. A Free host either gets the feature for free (matrix needs updating) or sees a misleading
badge.
[screenshots/33-free-plan-analytics.png](./screenshots/33-free-plan-analytics.png)

### H6. Marketing creations render as empty gray boxes

Two seeded creations ("Lagoon hero image", "December weekend promo") show blank placeholders with a
broken-image glyph and no label. Root cause is seed data pointing at `marketing-media/seed/remote/*`
objects that do not exist, but the studio should also render a named fallback card so a failed media
load never looks like an empty design.
[screenshots/14-marketing-studio-blank-creations.png](./screenshots/14-marketing-studio-blank-creations.png)

### H7. Bookings list stage counts do not match the visible list

On the org Bookings page the stage cards read Action Required 9 / Pending Docs 0 / Confirmed Stays 2
/ History 2 while the table below lists six "Pending Review" rows plus more. The counts come from a
different scope than the list (date range, org vs property, hidden cancelled/completed). At minimum
label each card with its scope, or make clicking a card apply the exact filter it counted.
[screenshots/03-org-bookings-desktop.png](./screenshots/03-org-bookings-desktop.png)

---

## P2

### H8. Donut charts on Analytics and both dashboards have no legend or labels

Analytics ("Where bookings come from", "Listing visits") and both dashboards ("Booking Status")
render rings with no categories. "Where bookings come from" is a ring, a number and nothing else, so
the chart carries no information. Finance (property and parking) does show a legend under its donut,
which proves the pattern exists. Make it standard.
[screenshots/10-property-analytics-no-legends.png](./screenshots/10-property-analytics-no-legends.png)

### H9. "How you compare: No peer comparison yet" is a dead panel

A permanently empty card in a shipped analytics view. Either ship the benchmark or hide the card
behind a "coming soon" state that does not occupy prime space every visit.

### H10. Guest age is always empty in the seed

"Guest age: No age data for this range yet" with 10 seeded reviews and 60 bookings. Either the seed
should include ages or the empty state should explain how ages are collected.

### H11. Guest origins bars misrepresent the data

Six cities at 16.67% each render with a bar that fills the full track, so every row looks like 100%.
Bars are scaled to the largest value rather than to 100%, without saying so.

### H12. Maintenance rows show "-" for status

Most rows render a dash in the STATUS column while the KPI strip says "Pending 14". Either default
those rows to a Pending pill or label the column "Reminder" instead of "Status". Row actions ("Mark
as done") are not visible until hover, which is a problem on touch.

### H13. Save only exists while dirty (Templates, Settings)

Both Templates and Property Settings hide the primary Save button until the form is dirty. It is a
defensible pattern, but combined with autosave-like behaviour elsewhere it reads as "there is nothing
to save". A persistent disabled Save plus the existing dirty pill would be clearer.

### H14. Property Settings is one giant page

Every group (Basic Info, Details, Photos, Amenities, House Rules, Cancellation, Location, Socials,
Search preview, Guest Form, Guest experience, Reviews & vouchers, Payment, Building Forms, Email
Automations, Integrations, Activity, Listing status, and Danger zone) renders stacked on one route.
On desktop the left rail helps; on phone the rail disappears and there is no jump list or collapse,
so Payment and Building Forms are dozens of screens down. Destructive actions (Pause / Archive /
Delete) also live inline at the bottom of that same scroll rather than behind a separate danger
section.
[screenshots/15-property-settings.png](./screenshots/15-property-settings.png),
[screenshots/25-settings-mobile-long-page.png](./screenshots/25-settings-mobile-long-page.png)

### H15. Notifications page repeats the same one-page pattern

Five modules (Marketing, Staff, Operations, Finance, Maintenance) with independent Save/Reset in one
long page. Same mobile navigation problem as H14, plus 5 save buttons on one page makes "what did I
just save" ambiguous.

### H16. Inbox: "Importing chats" never finishes locally

The header spinner and label persist indefinitely when Meta is not connected, which reads as a stuck
job. Give it a terminal state ("Last synced 2h ago" or "Not connected").

### H17. Inbox: "7h 17m left" has no context

The conversation header shows "Facebook · 7h 17m left", which is the platform messaging window. No
label explains that. Add "Reply window" or a tooltip.

### H18. Inbox composer icon buttons are unlabeled

The lightning (quick reply) and sparkle (AI) buttons in the composer have no accessible name and no
tooltip, so their purpose is guesswork on desktop and invisible on a screen reader.

### H19. Public Pages thumbnails are inconsistent in quality

Showcase and Property render faithful previews, Stay Guide and Find parking render near-blank
wireframes. Once the stay-guide preview call works they should all be real previews; until then the
blank ones look broken.
[screenshots/12-public-pages-gallery.png](./screenshots/12-public-pages-gallery.png)

### H20. "Reviews responded 0%" with no way to respond from the list

The Reviews table shows a "-" in the RESPONSE column; the only affordance is the row "…" menu.
Responding is the primary job on that page, so it deserves a visible "Respond" action on the row.

### H21. Org dashboard "View" links drop the active date range

The attention rows correctly carry their own filter (`status=…&from=…&to=…`), but each card's
"View" / "View all" links to the bare org bookings list, so a host who has narrowed the dashboard to
August lands on the current default range. Preserve the active range on the view-all links.

### H22. Sidebar truncates at 900px and the account block collides with the cookie banner

At 1440x900 the nav list ends mid-item ("Settings" is partly hidden behind the Verification card) and
the account row is covered by the fixed cookie bar. Both are visible in
[screenshots/01-property-dashboard-desktop.png](./screenshots/01-property-dashboard-desktop.png) and
[screenshots/02-org-dashboard-desktop.png](./screenshots/02-org-dashboard-desktop.png).

---

### H23. The AI dashboard assistant is invisible on the plan that sells it

The org is on Business and `ai_dashboard_assistant_org_settings.enabled = true`, yet there is no
"Open AI assistant" launcher and no "AI mode" toggle on either the org or property dashboard. The
platform-level switch (`ai_platform_global_settings.enabled`) is `false` in the seed, so the feature
is hidden with no message. A host paying for "AI dashboard assistant" sees nothing and cannot tell
whether it is broken, unconfigured, or coming later. Show a disabled launcher with an explanation
(or an org notice) instead of silently dropping the feature.

Related: `/admin/ai` reports "Platform AI Enabled OFF" while still showing spend and calls (see
04 A4), so even an operator has to guess which state is true.

### H24. Notification panel is solid but hides affordances

The bell panel lists the five most recent events with unread dots, "Mark all as read" and "View all".
Rows are not visually clickable (no chevron or hover state) even though they navigate, the unread dot
sits at the far right edge, and "More notifications available on the Notifications page." duplicates
"View all".

## P3

- Currency in inputs is unformatted (`4500`) while read-only money is `₱4,500.00`; pick one style for
  editable money, or format on blur.
- Finance mobile chart y-axis: the top tick renders `10k` while the rest render `₱8k`, `₱5k`, `₱3k`.
  [screenshots/26-finance-mobile-axis.png](./screenshots/26-finance-mobile-axis.png)
- Pricing & availability: the right rail ends well above the fold leaving a large empty column, and
  the calendar card does not stretch to use the space.
- Pricing page KPI "Fixed Fees ₱4,850" is the sum of downpayment + deposit + pet + parking, which
  reads like revenue at a glance. Label it "Default fees".
- Revenue chart tooltips were not reachable by keyboard; the chart is a decorative SVG for
  assistive tech with no table alternative.
- The seed repeats identical monthly totals (₱42,000 in Sep/Oct/Nov, 6 bookings), which makes every
  trend read 0.0% and undermines demo credibility. Vary the monthly data.
- "View features." above the plan card in the sidebar is a sentence fragment used as a button label.

---

## What works

- The dashboard composition (KPIs, calendar, cash flow, attention list, listings performance) is
  dense without feeling crowded, and every block is deep-linked.
- Booking list views (table, card, kanban, calendar) all work and are genuinely different
  representations of the same data; state is preserved in the URL.
- The booking detail is the strongest screen in the product (see
  [03-booking-workflow.md](./03-booking-workflow.md)).
- Templates: rich editor, placeholders, preview, reset, per-group organisation, dirty pill, and a
  working unsaved-changes guard.
- Public Pages gallery and the Page Editor (template picker, live preview, device toggle, sections)
  feel like a real product.
- Settings inline validation, character counters, slug rename explainer and "requires attention"
  dots are all good.
- Help & support hub, docs, tickets and the new-ticket dialog are consistent and complete.
- Dark theme holds up across tables, charts and forms.

---

## Coverage

| Route                                          | Desktop | Mobile | Issues               |
| ---------------------------------------------- | ------- | ------ | -------------------- |
| `/org/kame-homes/dashboard`                    | yes     | yes    | H2, H3, H22          |
| `/org/kame-homes/bookings` (+kanban, calendar) | yes     | yes    | H7                   |
| `/org/kame-homes/reviews`                      | yes     | yes    | H20                  |
| `/org/kame-homes/analytics`                    | yes     | yes    | H8                   |
| `/org/kame-homes/properties`                   | yes     | yes    | see 05               |
| `/org/kame-homes/plans`                        | yes     | yes    | see 05               |
| `/org/kame-homes/settings`                     | yes     | yes    | see 05               |
| `/org/kame-homes/help-support*`                | yes     | yes    | none blocking        |
| `/org/…/property/kame-home`                    | yes     | yes    | H1, H2               |
| `/org/…/bookings` (4 views)                    | yes     | yes    | H4                   |
| `/org/…/bookings/:id` (7 statuses)             | yes     | yes    | see 03               |
| `/org/…/finance`                               | yes     | yes    | H8, P3 axis          |
| `/org/…/pricing`                               | yes     | yes    | P3                   |
| `/org/…/analytics`                             | yes     | yes    | H5, H8, H9, H10, H11 |
| `/org/…/maintenance`                           | yes     | yes    | H12                  |
| `/org/…/notifications`                         | yes     | yes    | H15                  |
| `/org/…/templates`                             | yes     | yes    | H13                  |
| `/org/…/public-pages`                          | yes     | yes    | H19                  |
| `/org/…/public-pages/:id/edit`                 | yes     | yes    | none blocking        |
| `/org/…/inbox`                                 | yes     | yes    | H16, H17, H18        |
| `/org/…/marketing`                             | yes     | yes    | H6                   |
| `/org/…/settings`                              | yes     | yes    | H14                  |
| `/org/…/team`                                  | yes     | yes    | see 05               |
| `/org/…/reviews`                               | yes     | yes    | H20                  |
