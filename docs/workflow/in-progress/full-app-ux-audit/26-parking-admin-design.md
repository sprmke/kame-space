---
title: 'Audit 26: parking and super admin design critique'
status: active
tags: [audit, design, parking, super-admin, mobile]
updated: 2026-11-18
---

# 26: Parking and super admin design critique

Design pass over the parking workspace (11 routes) and the platform panel (19 routes) at 1440, 1024 and
390, with interaction states. Functional defects for parking live in
[22](./22-parking-dashboard-pages.md); this file is about how the screens read and what to change.

Raw designer notes (page-by-page, 908 lines, 35 routes at three viewports):
`/tmp/audit/findings-design-admin.md`, captures in `/tmp/audit/design-admin/`.

---

## Critical problems

### P26-1 (P0 for mobile). Long pages have no section navigation on a phone, and Settings has no Save

Every multi-section page drops its section rail below `lg` and replaces it with nothing:

| Page                     | Mobile document height | Sections     | Section nav at 390         |
| ------------------------ | ---------------------- | ------------ | -------------------------- |
| Parking Settings         | **4,454px**            | 9            | none (0 visible nav items) |
| Admin org detail         | **6,428px**            | 8            | none                       |
| Admin development detail | **7,758px**            | 12           | none                       |
| Admin FAQs               | **8,728px**            | grouped list | none                       |

Worse: at 390 the parking settings form exposes **no Save, Discard or "Saved" control at all**, even
after editing a field. Verified twice: zero buttons matching save/discard/update, and the only fixed bar
is the bottom tab bar. A host who edits Basic Information cannot commit it, cannot tell whether it
saved, and cannot reach Amenities without scrolling four screens.

**Change:** below `lg`, a sticky section picker under the hero (`Section: Basic Information ▾`) opening
the existing `MobileChoiceSheet`, plus a `ContextualActionBar` carrying Save. One pattern fixes Settings,
org detail and development detail.

[screenshots/99](./screenshots/99-parking-settings-390-no-save.png)

### P26-2 (P1). At 1024 the table's action column is off-screen

The bookings table is 240px wider than the viewport: at 1024 the last column's right edge measures **1264**
(property) and **1264** (parking) against a 1024 viewport, inside a scroll container with no visible
affordance. `AMOUNT` and `ACTIONS` are cut off, so the only row action is unreachable unless the operator
discovers horizontal scrolling.

**Change:** two-up KPIs at `lg`, and either a right-edge fade + "more →" affordance on the table, or drop
`PAX`/`FLAGS` below 1200px. Never let `ACTIONS` be the clipped column.

### P26-3 (P1). Money does not reconcile on the pages that define money

Four surfaces, four different arithmetics:

1. **Pricing → Base rates:** `Guests pay ₱400` · `Platform fee (10%) −₱30` · `You receive ₱270`. Read top
   to bottom that is 400 − 30 = 370, not 270. The numbers come from two different bases and are stacked
   as one equation.
2. **Pricing → Direct booking link:** `Guests pay ₱400` then `you receive ₱285 instead of ₱270`, which
   implies a different base again.
3. **Parking payouts, example card:** `Guest pays 400.00` / `Commission (10%) −30.00` /
   `Processor (est.) −27.52` on the left; `Host gross 300.00` / `Host receives 270.00` /
   `Platform net 102.48` on the right. Two columns that read as one subtraction that does not compute.
4. **Parking payouts, ledger:** `Processor (est.) ₱0.00` and `Platform net ₱0.00` on every row while the
   settings say 10% commission and a 3.13% processor fee.

**Change:** one component, one equation, printed left to right with operators, and the guest-facing price
in a separate block ("What guests see"). Reconcile the ledger from the same function that renders a row.

### P26-4 (P1). Colour carries decoration and sometimes the wrong meaning

| Surface       | What renders                                            | Problem                                      |
| ------------- | ------------------------------------------------------- | -------------------------------------------- |
| Team roles    | `Full Access` red, `Operations` amber, `Read Only` blue | the most privileged role looks like an error |
| Finance       | Total Expenses `↘ −70.9%` in **red**                    | expenses falling is good                     |
| Dashboard     | Average nightly rate `↗ 0.0%` in **green**              | no change at all                             |
| Payouts       | `Disbursed` and `Awaiting disbursement` both grey       | the one distinction that matters             |
| Announcements | 2px coloured rail + grey text                           | Critical and Info look identical             |
| Admin KPIs    | five pastel icon wells, no mapping                      | decoration                                   |

**Change:** publish one status token map in `DESIGN.md`; roles become neutral outlines with a weight
cue; percent deltas take a per-metric `invert` flag; payouts use success/warning/danger; severity becomes
a text badge.

### P26-5 (P1). KPI inflation: five pages open with four boxes reading "1"

Organizations, Hosts, Properties, Developments and Host detail each open with a 4-up KPI row where every
value is `1` (or `0`). Admin Overview goes further: **12 equal cards in a 4×3 grid**, including
`Orgs without plan 0`, `Trialing subs 0`, and `AI spend $1.13` (USD in a PHP row).

**Change:** replace the 4-up row with an inline summary (`1 org · 4 properties · 1 parking`) or a chip
strip. On Overview keep four numbers that need attention and move the rest behind "More numbers". Drop
cards whose value is zero on first paint.

### P26-6 (P1). Workflow actions fire instantly and the summary strip goes stale

Tapping **Approve for check-in** on a parking booking executed immediately: no confirmation, no reason
field, no statement of what would be sent, then a toast reading only **"Booking updated"**. The four KPI
tiles then read `0 / 0 / 0 / 0` while the table still listed seven bookings; a reload fixed them.

This happened during the audit (the reviewer expected a sheet), which is itself the finding: the control
looks like a sheet trigger and behaves like a switch. The booking was restored.

**Change:** confirm irreversible or guest-visible transitions, toast `Pending Review → Ready for
Check-in` with Undo, and invalidate the summary query in the same mutation.

### P26-7 (P2). Unlabelled controls, twelve times over

- The per-page selector renders a bare **`31`** on Organizations, Hosts, Properties, Developments,
  Approvals, Support, Playbook, FAQs, Audit, Pricing plans, Subscriptions.
- Playbook and FAQs rows carry an unlabelled toggle beside a pencil and a bin.
- Host detail shows `🏢 1` and `🔌 1` with no labels.
- Rate limits has a chip reading only `In review`.
- Pricing plans shows `₱399 · 20% off` with no list price.

**Change:** `Rows: 31 ▾`; `aria-label` on toggles ("Enabled for AI review"); `Properties 1 · Parking 1`;
`₱499 → ₱399 (20% off)`.

### P26-8 (P2). Raw engineering strings in human-facing UI

`GEMINI_API_KEYS or GEMINI_API_KEY` as the loudest text on a health row; `meta-inbox-oauth-*,
meta-inbox-resubscribe, meta-inbox-disconnect` as feature descriptions; `u:… or ip:…` as a placeholder;
`itest-0c3cc7f2: 2 imported reservations overlap…` six lines long in notifications; audit rows whose
title contradicts their action key (`Approved host verification` next to `org_subscription_changed`);
helper text saying "300 is a reasonable starting point" above a field containing 600.

**Change:** human sentence first, identifier as monospace on a second line or behind "Details". Never an
env var as a row title. Fix the audit title/key pairing at the data layer.

### P26-9 (P2). The mobile More sheet loses destinations

At 390 the sheet renders `OPERATIONS` (Dashboard, Bookings, Finance, Pricing), a **large empty band**
under `GUESTS`, then the plan card. Messages, Notifications, Team, Settings and Help exist in the DOM but
are not visible in the sheet, and the sheet overflows the viewport without internal scroll.

**Change:** size the sheet to `100dvh - safe-area`, scroll internally, and add a smoke test asserting
every bottom-nav destination is visible at 390.

[screenshots/106](./screenshots/106-mobile-more-sheet-truncated.png)

### P26-10 (P2). Empty states are oversized and inert

Two 430px dashed panels on the parking dashboard (46% of the viewport); two 170px cards on Rate limits;
five stacked 77px cards on AI; a 700px empty inbox pane reading "Select a conversation" with no way to
connect a channel anywhere on the page.

**Change:** one compact empty state per region: one line plus one action (`Add transaction`,
`Connect a channel`). On the dashboard, collapse Cash flow + Breakdown into a single first-run card.

---

## Parking page notes

### Dashboard

**Reads well at the top.** The full-width **Needs attention** band with three labelled chips is the best
pattern in the product and should replace the property dashboard's buried card.

- `Low occupancy next 30 days 47` sits beside counts (1, 1) with no unit. Two chips say counts, one says
  a percentage.
- `+100.0%`, `+550.0%`, `+36 pts` all derive from a near-zero base. A percent change from zero is not
  information.
- The calendar has **no occupancy marks**: every cell looks identical, so you cannot see which nights are
  booked. Its card still promises "Tap a date to open reservation details".
- `View Parking` is the loudest button on the page and goes to a public page, not the host's job.
- The Settings red dot has no explanation, on a page with no error.
- Sidebar identity is `ML2S27` / `A2`, an opaque code for "Monaco Level 2 Slot 27".
- A floating bell FAB duplicates the sidebar Notifications.

[screenshots/95](./screenshots/95-parking-dashboard-desktop.png)

**Changes:** `47 vacant nights in the next 30 days` linking to Pricing; hide deltas when the base is 0;
paint occupancy into calendar days with a 3-item legend; demote `View Parking` to an icon; promote
"Review 1 pending booking"; explain or remove the dot.

### Bookings

Strongest screen in the product on desktop: real density, readable status pills, a table that earns its
space.

- Four KPI cards duplicate the status filter, and one of them (`Pending 0`) is a card about nothing.
- `Status`, `Priority`, `31`, `Table` are four pills of equal weight; `FLAGS` is `-` in every row.
- Mobile: search + filter, then a full-width `Card | Calendar` toggle, then 2×2 KPIs: ~340px before the
  first booking. Calendar view of a booking list on a phone is a dead end.
- Avatars alternate between initials, photos and empty circles.

**Changes:** status chips with counts instead of KPI cards; hide `Pending 0` and `FLAGS`; drop
`Card | Calendar` on phone; deterministic initials fallback.

### Booking detail

- The stepper reads `MATCH · PAY · DONE` with all three segments teal and **3/3** while the status badge
  says `Pending Review` and the primary action is "Approve for check-in". A completed stepper above an
  unfinished step breaks trust in every other progress indicator.
- Mobile: payment rows are clipped behind the `ContextualActionBar` (`₱70.00` / `₱630.00` cut mid-line),
  and there is **no back affordance** in the hero.
- `Payment received. Endorsement sends automatically.` sits directly above
  `Endorsement: Not sent. No PMO email configured` — adjacent contradiction.
- `Cancel` is a peer of the primary action with no scope ("booking? edit? payment?").
- `Plate` and `Vehicle` are both `-`, occupying a full row. `Unit / tower` is property vocabulary.

**Changes:** derive the stepper from status; bottom clearance for the action bar; back chevron; one
factual endorsement line with a "Configure PMO email" link; `Cancel booking` into the overflow menu.

### Finance

- Expenses `↘ 70.9%` in red (best line on a P&L, shown as bad).
- Y-axis mixes `₱1k` and `₱900`; the top tick does not match the step.
- The Breakdown donut puts **income and expenses in one ring** (`Parking Maintenance 55%`, `Parking
Supplies 26%`, `Parking Income 18%`), so the chart has no meaning.
- Donut uses purple/indigo, banned by `DESIGN.md`.
- Payout rows show net, gross and fee but **no booking, date or reference**, so nothing reconciles.
- Every row repeats the seed subtitle `Local demo parking finance row`.

**Changes:** invert delta colour for expenses; split income/expense rings; add booking ref + date to
payouts; delete seed subtitles.

### Pricing

- The base-rate block is the arithmetic failure in P26-3.
- A ₱0 nightly rate saves without complaint (22-P2-11); booked nights have no "Booked" state.
- The direct booking link prints a full URL as body text, wrapping four lines on a phone.

### Settings

- No Save at 390 (P26-1). No section nav. Sections are four screens apart.
- Brand-colour swatches include a rainbow gradient chip among the 12; the palette is the brand system.
- Slug renders in an editable-looking input; `Parking type`, `Residence`, `Tower`, `Level`, `Slot` are
  marked `*` and readonly.
- `Save Changes` is disabled globally when 0 amenities are selected (22-P2-18).

### Team, Inbox, Notifications, Announcements, Help

- Team: invite has no required markers and no reason for a disabled Send.
- Inbox: disconnected state is a dead end with Quick replies and Automation for a channel that does not
  exist; the page has no Channels entry although announcements point to "Inbox → Channels".
- Announcements: page title reads "Dashboard"; `SCHEDULE` column is `-` on every row; detail is a dead end.
- Help: page can crash to the boundary (`useParkingContext must be used within RequireParkingContext`).

---

## Super admin

### First impression

`/admin` opens on 12 equal KPI cards, a Growth chart flat at zero for eleven months with one spike, and a
Plan-mix donut with one slice. Honest, complete, and unreadable at a glance.

[screenshots/93](./screenshots/93-admin-twelve-cards-usd.png)
[screenshots/96](./screenshots/96-admin-overview-mobile-twelve-cards.png)

### Page notes

| Page                              | What it does                                        | Main design problem                                                       |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| Overview                          | 12 KPIs, Growth, Plan mix, AI cost, Needs attention | 12 equal cards; 3 of them duplicated in Needs attention                   |
| Organizations                     | 4 KPIs, search, table/cards                         | 4 cards all reading `1`; description truncates to "approvals, an…" at 390 |
| Org detail                        | 70 surfaces, 3,831 chars, 6,428px at 390            | everything expanded; no tabs                                              |
| Hosts / Properties / Developments | 4 KPIs + list                                       | same 4×1 pattern; bare `31`; icon+number cells unlabelled                 |
| Approvals                         | 4 KPIs, table                                       | `Invalid Date` in a cell; two status pairs stacked; no bulk action        |
| Support                           | 4 KPIs, 4-stat header, table                        | severity/status compete in one column                                     |
| Health                            | red error count + live checks                       | "Live checks 9d ago" presented as current; no freshness badge             |
| AI                                | 5 empty cards, one nearly-empty plot                | empty plot with one floating rotated label; purple series                 |
| Feature availability              | **24 toggle cards**, raw ids                        | a wall of switches with engineering names                                 |
| Platform settings                 | **25 cards, 13 inputs**                             | no grouping; the 300-vs-600 contradiction                                 |
| Pricing plans / Subscriptions     | carousel + table                                    | `20% off` with no list price                                              |
| Parking payouts                   | **56 surfaces**                                     | unreconciled ledger (P26-3)                                               |
| Audit log                         | 2,315 chars of cards                                | title contradicts action key                                              |
| Announcements                     | list + detail                                       | severity indistinguishable; empty SCHEDULE                                |

[screenshots/97](./screenshots/97-admin-approvals-invalid-date.png)
[screenshots/98](./screenshots/98-admin-organizations-mobile-truncated.png)

### Information architecture

The sidebar has 11 items and the route set has 19, so 8 destinations are reachable only by URL or an
in-page link. The group labels (ORGANIZATIONS, BILLING & CATALOG, OPERATIONS, CONTENT) are good and
should be kept, but AI, Health and Audit do not appear anywhere in the nav.

**Proposed five groups (18 items):**

| Group      | Items                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| Today      | Overview, Approvals, Health                                                      |
| Tenants    | Organizations, Hosts, Developments, Properties                                   |
| Money      | Pricing plans, Subscriptions, Payment settings, Parking payouts, Billing history |
| Operations | Support tickets, Audit log, Rate limits, Ops reports                             |
| Platform   | AI, Feature availability, Platform settings, Announcements                       |

Add a ⌘K search across orgs, hosts and tickets, and a mobile tab bar of `Overview / Approvals / Health /
More`.

---

## Mobile change lists

**Parking**

| Route          | Remove                                              | Merge                       | Move                                   |
| -------------- | --------------------------------------------------- | --------------------------- | -------------------------------------- |
| Dashboard      | second chart panel                                  | 4 KPIs → 2×2, deltas hidden | calendar → agenda                      |
| Bookings       | `Card \| Calendar` toggle, `FLAGS` (`-` everywhere) | stage cards → chips         | filters → sheet                        |
| Booking detail | duplicate payment summary, empty Plate/Vehicle row  | note + payment → one block  | actions → sticky bar, add back chevron |
| Finance        | marketplace payouts block                           | KPIs → 2×2                  | add transaction → labelled CTA         |
| Pricing        | base-rate maths block                               | legend → inline hint        | day editor → full-screen sheet         |
| Settings       | readonly identity fields                            | 5 cards → 3                 | section picker + sticky Save           |

**Super admin**

| Route                              | Change                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| Overview                           | 3 stats + "All stats" sheet; one chart                                         |
| Organizations / Hosts / Properties | keep card lists; KPI row into a collapsible header; label the page-size select |
| Org detail                         | tab it (Overview / Billing / Listings / Team / Support)                        |
| Feature availability               | grouped accordions with counts, human names                                    |
| Platform settings                  | section index sheet, 4 groups                                                  |
| Parking payouts                    | tabbed Unpaid / Paid / Disputes, with references                               |
| Audit log                          | table on desktop, timeline on mobile                                           |
| Health                             | freshness badge per check, group by failing subsystem                          |

---

## Top 20 by impact

| #   | Change                                                                            | Where                                                    |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Mobile section picker (bottom sheet) for Settings, org detail, development detail | parking/settings, admin details                          |
| 2   | Sticky Save bar on all long forms                                                 | settings, platform settings, development detail          |
| 3   | Fix 1024: 2-up KPIs, visible table overflow                                       | bookings, org detail, admin tables                       |
| 4   | One money reconciliation component                                                | pricing, payouts, booking detail                         |
| 5   | Kill KPI inflation (cap at 3-4 meaningful numbers)                                | 5 admin lists + Overview                                 |
| 6   | Publish one status/colour token map                                               | badges, deltas, payouts                                  |
| 7   | Confirm + undo on transitions; invalidate stats                                   | booking detail                                           |
| 8   | Label every control (`31`, toggles, icon counts)                                  | toolbars, Playbook, FAQs                                 |
| 9   | Remove raw identifiers from human UI                                              | health, feature availability, rate limits, notifications |
| 10  | Rebuild the AI page around health and cost                                        | `/admin/ai`                                              |
| 11  | Health: freshness badge + grouping                                                | `/admin/health`                                          |
| 12  | Chart fixes (ticks, income/expense split, brand colours)                          | finance, AI                                              |
| 13  | Inbox connect-channel empty state                                                 | parking inbox                                            |
| 14  | Approvals row model (`Invalid Date`, double status)                               | `/admin/approvals`                                       |
| 15  | Mobile More sheet: visible groups, internal scroll                                | mobile shell                                             |
| 16  | Copy pass: delete restating subtitles, rewrite dev-facing text                    | everywhere                                               |
| 17  | Contrast and fill fixes (primary-strong, darker destructive)                      | settings, org detail, payouts                            |
| 18  | Announcements: severity as text badge; fill or drop SCHEDULE                      | admin + parking                                          |
| 19  | Super admin IA regroup + ⌘K                                                       | admin shell                                              |
| 20  | Standardise tab heights, focus ring colour, badge casing                          | admin shell, health, AI                                  |

---

## Coverage

| Surface                 | 1440 | 1024    | 390 |
| ----------------------- | ---- | ------- | --- |
| Parking (11 routes)     | yes  | yes     | yes |
| Super admin (19 routes) | yes  | partial | yes |

Metrics: bordered-surface count, above-fold surfaces, page height in screens, horizontal overflow,
contrast, tap targets, copy length, and interaction states (sheets, menus, modals, toasts).
