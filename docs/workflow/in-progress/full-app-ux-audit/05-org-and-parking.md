---
title: 'Audit 05: org and parking host surfaces'
status: active
tags: [audit, org, parking, ux]
updated: 2026-11-19
---

# 05: Org-level modules and the parking vertical

Scope: org dashboard, bookings, reviews, analytics, properties, parkings, team, plans, announcements,
settings, help & support, and every parking module (dashboard, bookings, finance, pricing, team,
inbox, notifications, settings, announcements). Desktop 1440 and mobile 390. Two passes: this one and
a dedicated org/parking pass (161 screenshots in `/tmp/audit/org-parking-screens/`). Numbers below
were re-checked against the local DB after the pass; a few differ by one from the screenshot because a
parking reservation moved during the audit.

---

## P0

### O1. Org Parkings list hardcodes every metric to zero

Every parking card on `/org/kame-homes/parkings` shows `Reservations 0`, `Revenue ₱0`,
`Occupancy 0%`, and the KPI row shows `Total revenue ₱0`, `Avg monthly revenue ₱0`,
`Avg occupancy 0%`, for a slot that has 7 November bookings, ₱4,900 of booking revenue and 47%
occupancy on its own dashboard.

Root cause is in code, not data: `supabase/functions/_shared/listParkings.ts` line 44 maps every row
with `stats: emptyParkingStats()` and `emptyParkingStats()` returns all zeros.
[screenshots/60-org-parkings-zero-stats.png](./screenshots/60-org-parkings-zero-stats.png)

### O2. Org dashboard calendar has no reservations, and its cash flow says "no data"

`/org/kame-homes/parking/monaco-level-2-slot-27` for November 2026 shows `Total Reservations 14/30`,
`Revenue ₱1,890` and `Occupancy 47%`, while the calendar renders an empty grid for every day and both
Cash flow and Breakdown show their empty states. The bookings page lists seven November reservations
for the same slot. Same on the parking pricing calendar (no booked pills despite the legend).
[screenshots/53-parking-dashboard-empty-calendar.png](./screenshots/53-parking-dashboard-empty-calendar.png)

---

## P1

### O3. Three different revenue numbers for one period, none labelled

| Surface                               | Number                                          |
| ------------------------------------- | ----------------------------------------------- |
| Org dashboard "Total Revenue"         | ₱44,390.00                                      |
| Org Analytics "Revenue"               | ₱46,900.00                                      |
| Desktop dashboard's own Listings rows | ₱42,000 (property) + ₱4,900 (parking) = ₱46,900 |
| Parking dashboard "Total Revenue"     | ₱1,890.00                                       |
| Parking Finance "Total Income"        | ₱1,400.00                                       |
| Org Analytics parking row             | ₱4,900.00                                       |

The org dashboard card is bound to `kpis.netProfit` (`OrgDashboardStatCards.tsx:25`) under the label
"Total Revenue", whose tooltip describes net income, so it is net, not gross. The parking numbers mix
booking revenue, recorded cash income and net profit. No surface explains which is which.
[screenshots/61-org-analytics-revenue.png](./screenshots/61-org-analytics-revenue.png)

### O4. Booking Status donut totals 10, KPI says 13

`/org/kame-homes/dashboard` shows `Total Bookings 13` while the donut centre reads `10 Bookings` and
its six status rows also sum to 10. The three November rows in non-canonical statuses
(`NO_HOST_AVAILABLE`, `PENDING_PAYMENT`, `PENDING_HOST_ACCEPTANCE`) and the cancelled row never appear
in the chart. Either include an "Other" slice or make the centre equal the KPI.

### O5. Reviews → "About guests" says there are no reviews, but there are three

`/org/kame-homes/reviews?tab=written` renders "No guest reviews written yet" while
`host_guest_reviews` holds 3 rows for this org (5★, 4★, 5★, all with text). Hosts cannot see or edit
reviews they already wrote. Same empty state is produced after a reload.
[screenshots/62-reviews-about-guests-empty.png](./screenshots/62-reviews-about-guests-empty.png)

### O6. A paid host cannot manage, cancel or update payment for their subscription

On `/org/kame-homes/plans` → Billing, "Manage subscription" calls
`onManagePlans={() => setActiveTab('plans')}`, so it only switches to the plan grid. There is no
billing portal, no payment method update, no cancellation and no invoice download anywhere in the
plans feature (`grep` for `Cancel plan` / `payment method` in `features/dashboard/plans` returns
nothing). The label promises a management surface that does not exist.

### O7. Parking notifications attribute the wrong guest and leak import IDs

The parking notifications list shows a row titled **Rafa Mercado** whose body reads
"**June Vale** requested 3 nights at Monaco 2604." Other rows mention the property (not the parking)
inside a parking-scoped inbox, and calendar-conflict copy prints raw import ids
(`itest-f4a390de`). Wrong attribution on a booking notification is a data-trust bug.
[screenshots/65-parking-notifications-wrong-guest.png](./screenshots/65-parking-notifications-wrong-guest.png)

### O8. Parking Announcements highlights Dashboard and has no nav entry

`/org/…/parking/…/announcements` renders org announcements but the sidebar marks **Dashboard** as
active, and Announcements is not in the parking nav at all. Org `/announcements` correctly highlights
Announcements.

### O9. Activity log shows raw enums, garbled sentences and wrong targets

`/org/kame-homes/settings` → Activity shows rows like "Booking status moved to
**READY_FOR_CHECKIN**", "Payment received (**₱1799**) for change", "**Plan changed to Business**" with
target **Slot 27**, "Support ticket filed" attributed to **Public**, and "Marketing post published"
attributed to **AI assistant**. The activity log is the trust surface for who did what.
[screenshots/63-activity-log-copy.png](./screenshots/63-activity-log-copy.png)

### O10. Mobile "More" sheet hides primary navigation

On a 390 viewport the More sheet's nav list gets a **268px** scroll window because the Business plan
card, install prompt, persona switch, verification, sign-out and legal footer are pinned inside the
sheet. At rest only the plan card is visible, so **Properties and Parkings are hidden until the user
scrolls**, and Plans / Settings / Help need a second scroll. Measured content 624px vs 268px.
[screenshots/64-mobile-more-sheet-cramped.png](./screenshots/64-mobile-more-sheet-cramped.png)

### O11. Mobile parking pricing: tapping a day opens nothing

At 1440 clicking a day opens "Set nightly rate". At 390 tapping a day (and a synthetic click) opens no
sheet. The 7-column grid also compresses to ~43px cells, clips prices ("P300"), and cuts the last
week. Per-date pricing is impossible on a phone.

### O12. Ticket composer loses a draft without warning and has no close on mobile

Typing a subject then closing the new-ticket modal discards it with no guard (the shared
unsaved-changes guard is not wired here). At 390 the sheet exposes no close control at all (desktop
does), so the only dismissal is a swipe. The 1440 modal is also taller than the viewport, hiding the
attachment dropzone behind the footer.

### O13. Parking team and org team disagree about the same people

Parking Team shows `Team access 1` while four members carry a Full Access badge, and
`From Organization 1` while three org admins are listed. `Full Access` is red on parking and blue on
org; `Operations` is amber on parking and neutral on org. Org Team's KPIs also sum past the total
(`Total 5` = `Full Access 1` + `Operations 5`), and the owner's row action menu is clipped to ~24px by
the card.

### O14. Disabled AI entries with no reason

`/org/kame-homes/settings` lists "AI" and "AI features" greyed out and unclickable because the
platform AI switch is off. On a Business plan that advertises the AI assistant, the host sees two dead
entries and no explanation (see H23).

---

## P2

| #   | Finding                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O15 | **Dashboard drill-downs for "Unpaid guest balance" and "Low occupancy" go to an unfiltered bookings list.** Both point at `/bookings?from=…&to=…`; only "Pending review" adds `status=`.                                           |
| O16 | **Parking pricing math does not add up**: banner says guests pay ₱400, the rail shows "Guests pay ₱400 / Platform fee (10%) −₱30 / You receive ₱270". 400−30 is 370; 270 comes from the ₱300 host base rate.                       |
| O17 | **Parking calendar shows prices on only some dates** with no explanation (past days blank, default-rate days blank, overridden days filled).                                                                                       |
| O18 | **Parking Finance "Breakdown" mixes income and expenses** in one donut (Maintenance 55%, Supplies 26%, Income 18%) while the headline is income; axis ticks are uneven (₱0, ₱300, ₱600, ₱900, ₱1k).                                |
| O19 | **`?view=kanban` is accepted but ignored on org Bookings.** The view switcher offers Table / Card / Calendar / Table (duplicate), no board, and the URL keeps `view=kanban` while rendering a table.                               |
| O20 | **"Add parking" reuses the property modal**: titled "New listing / Add to Kame Space", bare `-` placeholders, slot placeholder `26`.                                                                                               |
| O21 | **Announcement "Action required" has no action**: "Open Finance if you see a banner" with no banner and no link.                                                                                                                   |
| O22 | **Parking inbox "Not connected" chip does nothing** (no sheet, no route), shows two empty states at once, and Quick replies / Automation stay enabled while disconnected.                                                          |
| O23 | **Developer copy on host settings**: "Add VITE_GOOGLE_MAPS_API_KEY to enable the map picker" and "No API keys configured" in red. Location promises a map pin but renders only an address.                                         |
| O24 | **Parking reservation detail**: no back link, `Approve for check-in` mutates and emails with no confirmation, stepper says `MATCH · PAY · DONE 3/3` while status is Pending Review, and "Payment received" sits next to "Pending". |
| O25 | **Parking settings shows check-out 2:00 PM → 12:00 PM** with no date context, reading like leaving before arriving.                                                                                                                |
| O26 | **Settings has no section nav on mobile**: org settings is a 3,248px scroll and parking settings 4,268px, with zero mobile nav buttons.                                                                                            |
| O27 | **Analytics "Outlook: Building · 40%"** is unexplained and just repeats occupancy with different rounding.                                                                                                                         |
| O28 | **Org properties card mixes windows**: `Bookings 37` (all-time) next to `Revenue ₱42,000` / `Occupancy 40%` (current period).                                                                                                      |
| O29 | **Money formatting varies within one screen**: ₱44,390.00, ₱42,000, ₱1,799, ₱700.00, ₱300, ₱0.                                                                                                                                     |
| O30 | **Dates use three separators and two orders**: `Nov 17 → Nov 18, 2026`, `Nov 29-Dec 1, 2026`, `Nov 7–9, 2026`, `Nov 15, 3:48 PM`, `about 17 hours ago`.                                                                            |
| O31 | **"Reservation" vs "booking" vs "stay"** is inconsistent (org says Bookings/Confirmed Stays, parking says Total Reservations).                                                                                                     |
| O32 | **Nav sets differ by scope**: parking has no Reviews/Analytics/Plans and org has no Inbox/Notifications; parking Announcements exists but is unlinked.                                                                             |
| O33 | **"Messages" vs "Inbox"**: route `/inbox`, page title "Messages", folder `inbox`.                                                                                                                                                  |
| O34 | **Same role, different colours** org vs parking (Full Access blue vs red, Operations neutral vs amber).                                                                                                                            |
| O35 | **Expired `?tab=` deep links** on Reviews/Plans are state-only, so refresh or sharing loses the tab.                                                                                                                               |
| O36 | **Parking booking amounts show `-` when zero** instead of "Included".                                                                                                                                                              |
| O37 | **Workspace identity reads "A2 / ML2S27"**, initials of "Monaco Level 2 Slot 27", because the parking has no image. Use the slot name or a parking icon.                                                                           |

---

## P3

- Parking dashboard leaves ~350px of empty column below the pricing rail at 1440x1200.
- The "Expires 36:17" countdown has no unit and no date; the next row uses "Expires 1d 8h".
- "New booking" is the primary CTA on a parking slot, which a host should not do.
- Guest avatars are yellow on most rows, teal on one, with no meaning.
- Org settings description leaks seed copy ("Local demo host for the canonical seed dataset.") and is
  published on `/hosts/:orgSlug`.
- Announcements' sidebar red dot has no count or accessible name.

---

## What works

- Unsaved-changes guard works on org Settings, parking Settings and the Team invite flow (Save & leave
  / Discard / Keep editing, and Save persists after reload).
- Destructive deletes (org, property, parking) confirm with the object name; CSV export works.
- Parking pricing explains platform rate vs host payout and per-night math in one banner.
- Parking bookings list carries status, expiry, guest, stay, pax and amount.
- Org Plans & Billing separates Billing / Plans / Compare / FAQs and shows renewal and since-date.
- Org Settings groups Profile / AI / Account with a persistent desktop rail.
- Org dashboard aggregates property + parking into one Listings Performance card.

---

## Coverage

| Route                                                                                                                      | Desktop | Mobile |
| -------------------------------------------------------------------------------------------------------------------------- | ------- | ------ |
| `/org/kame-homes` and `/dashboard`                                                                                         | yes     | yes    |
| `/org/kame-homes/bookings` (+kanban, calendar)                                                                             | yes     | yes    |
| `/org/kame-homes/reviews` (3 tabs)                                                                                         | yes     | yes    |
| `/org/kame-homes/analytics`                                                                                                | yes     | yes    |
| `/org/kame-homes/properties` (+add)                                                                                        | yes     | yes    |
| `/org/kame-homes/parkings` (+add)                                                                                          | yes     | yes    |
| `/org/kame-homes/team` (+invite, manage)                                                                                   | yes     | yes    |
| `/org/kame-homes/plans` (4 tabs)                                                                                           | yes     | yes    |
| `/org/kame-homes/announcements` (+detail)                                                                                  | yes     | yes    |
| `/org/kame-homes/settings` (all cards, Activity modal, Danger zone)                                                        | yes     | yes    |
| `/org/kame-homes/help-support*`                                                                                            | yes     | yes    |
| Parking dashboard / bookings / detail / finance / pricing / team / inbox / notifications / settings / announcements / help | yes     | yes    |

Not exercised: PayMongo checkout, team invite acceptance end to end, parking broadcast/reminder crons,
Meta reconnection.
