---
title: 'Audit 22: parking dashboard pages'
status: active
tags: [audit, dashboard, parking]
updated: 2026-11-18
---

# 22: Parking dashboard pages

Page-by-page functional pass over the parking workspace: dashboard, bookings, booking detail, finance,
pricing, team, inbox, notifications, settings, announcements, help. Desktop 1440 and mobile 390. Every
control exercised; writes reverted.

Screenshots: `/tmp/audit/parking-dash-screens/` (26 files).

---

## P0

### P0-1. Parking-only teammates are locked out of the entire workspace

`parking.demo@example.com` is a seeded, active `parking_members` row (role STAFF) with **no
`organization_members` row**. Every route renders "No organization access / You don't have access to
this organization" with only Sign out. `GET /functions/v1/list-parkings?orgSlug=…` returns **403**
because the shell resolves through the org permission `org.parkings:view`.

This is the same defect as [09-R3](./09-roles-and-permissions.md), confirmed from the parking side:
the data plane works (`parking-access` and `list-bookings?parking_id` return 200 with a granted
member), only the shell bootstrap is org-gated. The denial copy is also wrong: the user _does_ have
access to a listing.

---

## P1

### P1-1. Dashboard attention chips leave the parking tenant

"Pending review" and "Check-ins today" navigate to `/org/:org/property/kame-home/bookings` (property
bookings, 61 rows); "Low occupancy next 30 days" goes to the bare `/analytics`. "Total Reservations"
correctly goes to parking bookings. The hrefs are built with property helpers in the parking
`dashboard-stats` scope.

### P1-2. Cash flow, Breakdown, Transactions and Calendar are hardcoded empty

`ParkingDashboardCalendarSection.tsx` passes `rows={[]}`, `items={[]}` and
`buildFinanceChartData([], [], …)` (lines 39, 83-94, 115). So with ₱1,400 income on Finance and 14
bookings in the DB, the dashboard says "No cash flow in this period", "No breakdown data available",
"Nothing due in this period", and every calendar day is a disabled button ("November 18, 2026 – no
bookings"). The same cards are populated on Finance, which proves the data exists.

The calendar card still promises "Tap a date to open reservation details".

[screenshots/82](./screenshots/82-parking-dashboard-empty-cards.png)

### P1-3. Approve and Complete fire on one click, with no confirmation and no undo

On a PENDING_REVIEW parking booking, "Approve for check-in" immediately flips the status (DB
`updated_at` changed) and sends the guest email; "Complete" does the same. Every other destructive
action here (cancel, decline, archive) has a confirmation dialog. This is the action that emails the
guest and locks the payout.

### P1-4. A live "Finding host" offer cannot be opened or accepted

Booking 000008 (Icko Flores, `PENDING_HOST_ACCEPTANCE`, list shows "Finding host · Expires 1d 23h")
has no `parking_booking_broadcasts` row, so the detail page renders "Could not load booking" with no
Accept/Decline. The list advertises a countdown for an offer that does not exist server-side.

### P1-5. A parking Facebook thread is invisible in the parking inbox

`social_conversations` has a parking-scoped Facebook conversation (Dana Ong, 5 messages, unread), but
`social-inbox-threads?parking_id=…` returns `[]` for both `platform=all` and `platform=facebook`, so
the page says "No messages yet". Quick replies and Automation work.

[screenshots/83](./screenshots/83-parking-inbox-empty.png)

### P1-6. The parking notification feed shows property events

Items include "June Vale requested 3 nights at **Monaco 2604**", Lia Parks check-in, Marco Diaz
checkout and Owen Frost SD refund. Plus 17+ OTA "calendar conflict" cards with raw `itest-*` ids, in a
vertical that has no Channel sync.

---

## P2

| #     | Page           | Finding                                                                                                                                                  |
| ----- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-1  | Bookings       | Stage-card centre click is intercepted by the InfoHint hit pad: the tooltip opens and the filter does not apply (left-edge click works).                 |
| P2-2  | Bookings       | The status filter offers property-only statuses (Pending Documents, GAF, Pet, SD Refund, Imported). Selecting one gives "No bookings found".             |
| P2-3  | Bookings       | A `READY_FOR_CHECKOUT` parking row (seeded property status drift) has no next action; the detail page offers only Cancel.                                |
| P2-4  | Bookings       | Stage counts are computed from at most 31 rows, so they undercount with more bookings.                                                                   |
| P2-5  | Booking detail | "Guest paid ₱700.00" while payment status is Pending and `paid_at IS NULL`; the number is the amount owed.                                               |
| P2-6  | Booking detail | The host note says "Payment received. Endorsement sends automatically" while the panel says Pending and endorsement is not sent.                         |
| P2-7  | Booking detail | Endorsement failure ("No PMO email configured for development") has no link to configure it, and the button says "Resend" when nothing was ever sent.    |
| P2-8  | Booking detail | Guest email/phone are visible to every parking member before the broadcast offer is claimed.                                                             |
| P2-9  | Finance        | Add Transaction only offers property categories; the seeded parking categories (Parking Income, Parking Supplies, Parking Maintenance) cannot be chosen. |
| P2-10 | Finance        | "Pending Payments ₱0.00" while the payout card lists three "Awaiting payout" bookings.                                                                   |
| P2-11 | Pricing        | A **₱0 nightly rate is accepted and saved** ("Pricing saved", Custom Dates 8→9).                                                                         |
| P2-12 | Pricing        | Clearing the base rate shows "You receive ₱0" and still offers Save.                                                                                     |
| P2-13 | Pricing        | Booked nights render as blank cards, have no "Booked" state and swallow clicks, although the legend advertises Booked.                                   |
| P2-14 | Pricing        | Base-rate maths mixes two prices: "Guests pay ₱400 · Platform fee (10%) −₱30 · You receive ₱270" does not add up.                                        |
| P2-15 | Team           | Invite has no required markers and no reason for a disabled Send; Resend fails with a generic "Failed to send invitation email".                         |
| P2-16 | Inbox          | The disconnected state is silent; there is no Channels entry on the page although announcements tell hosts to use "Inbox → Channels".                    |
| P2-17 | Settings       | Google Maps fails with `RefererNotAllowedMapError` and dumps a full-width "Oops! Something went wrong" panel; the map pin cannot be set.                 |
| P2-18 | Settings       | Save Changes is **globally disabled** when 0 amenities are selected, blocking unrelated edits; the reason is a tooltip only.                             |

[screenshots/84](./screenshots/84-parking-settings-save-disabled.png)|
| P2-19 | Settings | Parking type / Residence / Tower / Level / Slot are `readonly` but marked required, with no edit path (a mistyped identity is permanent). |
| P2-20 | Settings | "Done" in the Amenities dialog does not save; the header Save is still required. |
| P2-21 | Announcements | Page title says "Dashboard"; detail is a dead end (no back link). |
| P2-22 | Help | The page can crash to the global error boundary (`useParkingContext must be used within RequireParkingContext`) via `ParkingSettingsIssuesSync`. |
| P2-23 | Cross | A backend outage is a silent hang on "Loading" with no error, retry or timeout. |
| P2-24 | Cross | The Settings sidebar dot never clears while Notifications reports 0 unread; the bell shows 38 globally. Three counters, three meanings. |

---

## P3

- "Canceled" (finance filter) vs "Cancelled" everywhere else.
- "Choose stays view" is the accessible name of the parking transactions view toggle.
- Duplicate `id="parking-settings-heading"` (mobile and desktop headers).
- Per-page control renders a bare "31".
- Two empty states at once in inbox ("No messages yet" + "Select a conversation").
- Check-out defaults to 12:00 while property bookings use 11:00; label it "slot must be vacated by".
- Hotel vocabulary on parking surfaces: "Average Nightly Rate", "pax", `{{property_name}}` placeholders.
- The parking FAQ set is 3 questions for a whole vertical; the Billing group label says "1 questions".
- Stepper shows `3/3` for an unstarted booking.
- No back affordance on the booking detail (desktop or mobile).

---

## What works

- Booking list scoping, search, stage filters, card/calendar views, and the New booking wizard
  (validation, past-date disable, checkout-after-check-in rule, unsaved-changes guard).
- Booking detail cancel/decline dialogs: reason required, consequence copy, unsaved guard.
- Payment panel reconciles with `parking_payment_transactions`; endorsement failures are surfaced.
- Finance: export menu (valid PDF), Add Transaction 4-step wizard with preview and delete, search, sort,
  status filter, marketplace payouts including the direct-link row.
- Pricing: day editor, block/unblock, base-rate scope dialog, direct booking link with the 5% fee copy.
- Settings: dirty-state Save, unsaved-changes guard, parking-specific amenities, excellent archive copy
  ("6 pending offers will be declined. 3 upcoming bookings will stay in place"), delete blocked for a
  slot with history, complete Activity log with CSV export.
- Mobile: cards not tables, sheets, sticky action bar, no horizontal scroll.

## Coverage

| Page           | Desktop | Mobile | Notes                                                    |
| -------------- | ------- | ------ | -------------------------------------------------------- |
| Dashboard      | yes     | yes    | chips, KPIs, stepper, empty cards confirmed hardcoded    |
| Bookings       | yes     | yes    | filters, search, 3 views, wizard, stage cards            |
| Booking detail | yes     | yes    | 3 statuses, accept/decline, cancel, endorsement, payment |
| Finance        | yes     | yes    | export PDF, add/delete transaction, payouts              |
| Pricing        | yes     | yes    | day editor, block, base rates, direct link               |
| Team           | yes     | yes    | members, invitations, permissions, invite                |
| Inbox          | yes     | yes    | threads, quick replies, automation                       |
| Notifications  | yes     | yes    | feed, Telegram toggles, push state                       |
| Settings       | yes     | yes    | every card, amenities, archive/delete, activity          |
| Announcements  | yes     | yes    | list + detail                                            |
| Help & Support | yes     | yes    | FAQ search; Guides/Tickets blocked by a crash            |

Not exercised: broadcast accept end to end (the seeded offer has no broadcast row), real Meta send,
real Maps geocoding, invite acceptance.
