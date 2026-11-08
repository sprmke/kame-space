---
title: 'Parking bookings — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-08-27
---

# Parking bookings — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug/bookings`  
Detail: `/org/:orgSlug/parking/:parkingSlug/bookings/:bookingId`

> **Status:** Documented — guest broadcast/claim flow (Phase 1) plus ranked batched dispatch (Phase 2) are live. Dashboard **New booking** opens an in-dashboard modal embedding the same parking registration form (same pattern as property bookings). Canonical spec: `.cursor/rules/parking-workflow.mdc`.

## Overview

Parking-slot **reservations** for one slot — separate from stay `need_parking` on property bookings. On **phone/tablet**, uses the shared **brand hero** shell (`AdminMobilePage`) with **New booking** as a hero icon and filters in an overlapping toolbar.

- Summary stage cards (Needs action · Pending · Active · Completed labels) — `PENDING_HOST_ACCEPTANCE` buckets into **Needs action**, `NO_HOST_AVAILABLE` into **Completed** (history)
- Search, status filters (including explicit **Finding host** / **No host** chips aligned with guest copy), table / card / calendar (no kanban). Card view on phone uses the same dense booking list rows as property bookings (name + amount; status + dates; no email). Calendar shares property **Month \| Week \| Day** periods (hourly grid on week/day; multi-night continuous blocks + pricing-style hover tips).
- **New booking** → opens `AdminParkingNewBookingModal` (title **New booking**, flat shell — no icon chrome), embedding `ParkingRegistrationForm` (the same component the public parking form uses) — submits through `submit-parking-booking-request`, the same live broadcast/claim flow a guest submission would use

---

## New booking (modal)

**Entry:** **New booking** button in the page header (desktop) or hero icon (mobile). Opens `AdminParkingNewBookingModal` — no route change, target parking slot fixed from the current page context; **Tower** is pre-filled read-only from the slot's record. Rendered as a **`ResponsiveModal`** (`sheetLayout="split"`): centered dialog on desktop, **full-width bottom sheet** with a sticky header + scrolling body on phone/tablet.

`submit-parking-booking-request` is guest-authenticated. A caller may submit with a guest email that is not their own only when they hold `bookings:edit` on the pinned parking; otherwise the caller must use their own email. This is what separates a host creating a booking for a guest from a guest trying to skip the per-account request limits. The row records `created_by_host_user_id`.

Payment and cancel ownership initially binds to the host account. The guest recovers access by signing in with the booking email (the ownership check rebinds on an email match), after which they can pay or cancel from the status page. If that is not practical, collect payment the way you would outside this flow.

**Paid outside Kame Space:** a host with `bookings:edit` can tick that option in the New booking modal for cash or bank transfer. The request auto-claims, records a ₱0 offline ledger row, and confirms without a payment link. No platform fee is taken. The guest still receives the confirmation and the PMO endorsement.

On success, the modal shows an inline summary (dates, guest, email, phone, vehicle) instead of navigating to the public request-status page, with two actions: **Add another booking** (resets the form for another entry, same modal) and **View booking** (closes the modal and opens the new booking's detail page). The bookings list refreshes in the background so the new booking appears without a manual reload.

---

## Booking detail (`/bookings/:bookingId`)

**`ParkingBookingDetailPage`** — flat guest grid (email, phone, plate, vehicle) without bordered stat boxes. Shared **Match · Pay · Done** stepper (`ParkingFlowStepper` — same trail + fraction + segmented bars as guest status/form) on pending/payment/review. Status-specific strips:

- **Respond to claim** — amber urgency strip + countdown when this host's broadcast is still pending (`PENDING_HOST_ACCEPTANCE`)
- **Awaiting guest payment** — muted strip + payment countdown when status is `PENDING_PAYMENT` (`parking_payment_expires_at`)
- Context line from shared `PARKING_HOST_STATUS_NOTE` for non-actionable states
- **Access instructions** textarea (500 chars) on accept; saved **Your access note** collapses after claim
- **Payment card** — guest paid, your rate, fee, net payout, payout/refund status, direct-link marker
- **Endorsement card** — sent, not sent with the failure reason, and **Resend endorsement** for hosts with `bookings:edit`
- **Message guest** → parking Inbox once endorsement sent

Status badge labels match guest surfaces via `parkingFlowCopy.ts` (e.g. **Finding host**, **Awaiting payment**). Claim/payment urgency strips animate in/out on status change (`parkingFlowMotion.ts`, `motion-reduce`-aware).

---

## Host-facing knowledge

Manage guests who booked **this parking slot only**. If a guest's parking is bundled into their condo stay, that booking still lives on the **property's** bookings page, not here.

**Common host questions**

- Q: How do bookings end up on this page?
  A: Either you use **New booking** to submit one on the guest's behalf right from the dashboard, or a guest sends a broadcast request without picking a specific slot. Broadcast requests go to a small group of eligible slots at a time - the cheapest-priced eligible slots first - and whichever host accepts first gets the booking.
- Q: Why didn't I get notified about a broadcast request right away?
  A: Requests aren't sent to every eligible slot at once. They go out in small rounds, cheapest-priced first. If your slot isn't among the cheapest eligible ones for that request, you'll only be notified in a later round - and only if nobody in an earlier round accepted in time.
- Q: What happens if I don't respond to a broadcast request in time?
  A: You'll have about 15 minutes to Accept or Decline if check-in is today, or an hour otherwise, and a live countdown shows how much time is left. If nobody in your round accepts in time, or everyone in it declines, the request either moves on to the next round of hosts or closes with no host found once every eligible slot has had a turn.
- Q: I own more than one parking slot - could I get notified twice for the same request?
  A: No. Even if more than one of your slots would qualify, you'll only ever be offered your cheapest eligible one for a given request.
- Q: Can I leave a note for the guest when I accept a request?
  A: Yes. Accepting lets you add a short access instructions note (up to 500 characters) that the guest sees once their payment goes through.
- Q: What if another host claims a broadcast request before I do?
  A: You'll see "Already claimed" if you click Accept after someone else got there first, and the page updates automatically, so you're never left staring at a stuck button.
- Q: Does Accept confirm the booking right away?
  A: Not anymore. Accepting reserves the slot for that guest and sends them a "pay to confirm" prompt with a time limit. The booking only becomes confirmed once the guest actually pays - you'll see the status change to **Awaiting Payment** after you accept, then to **Pending Review** once they've paid.
- Q: What happens if the guest never pays?
  A: If they don't pay within the window, the slot is automatically released and the request goes back to searching for another host (or closes if no one else is eligible) - you don't need to do anything.
- Q: What happens once the guest pays?
  A: The platform automatically sends an endorsement email to your development's PMO (CC'd to the guest) so the guest's vehicle is authorized for entry - you don't need to send anything yourself. Once that's sent, a **Message guest** button appears on the booking detail page linking to this parking's Inbox.
- Q: Is there a way to skip manually accepting requests?
  A: Yes. An **Auto-accept top match** toggle in Settings → Booking Automation. When on, your slot claims the top-ranked request automatically instead of waiting for you to tap Accept; the guest still has to pay before the endorsement fires.

---

## API

`GET list-bookings?parking_id=…` — parking team `bookings:view`

`POST transition-parking-booking?parking_id=…` — `{ bookingId, toStatus, reason?, note? }` (rejects `PENDING_HOST_ACCEPTANCE` and `PENDING_PAYMENT` — use claim/decline below; `PENDING_PAYMENT` only resolves via guest payment, timeout, or guest cancel). Cancelling a paid booking (`PENDING_REVIEW` / `READY_FOR_CHECKIN`) requires `reason`; the guest is emailed, the ledger row moves to `refund_review`, and the payout is blocked until a super admin records the refund.

`POST claim-parking-booking?parking_id=…` — `{ bookingId, parkingId, endorsementNote? }` — `bookings:edit` — sets `PENDING_PAYMENT` (not confirmed yet), guest gets a pay-to-confirm email. A taken slot returns `409 slot_unavailable`; a lapsed offer returns `410 offer_expired`.

`POST resend-parking-endorsement?parking_id=…` — `{ bookingId }` — `bookings:edit` — retries the PMO email while `endorsement_sent_at` is still null.

`GET parking-payments?parking_id=…&bookingId=…` — `finance:view` — payment card data for one booking; omit `bookingId` for the Marketplace payouts list.

`POST decline-parking-booking?parking_id=…` — `{ bookingId, parkingId }` — `bookings:edit`

`GET get-parking-broadcast-status?bookingId=&parkingId=` — this host's own candidacy (`pending`\|`claimed`\|`declined`\|`expired`) — `bookings:view`

Rows live on `guest_submissions` with `parking_id` set (or null while broadcast-pending) and `property_id` null.

---

## Implementation map

| Concern                                  | Path                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| List page                                | `ui/src/features/dashboard/parking/pages/ParkingBookingsPage.tsx`                                                                                      |
| Loading skeleton                         | `ParkingBookingsRouteSkeleton` → `BookingsListBodySkeleton` (`RouteSkeletons.tsx`) — stage cards, toolbar, table (desktop) / cards (phone) or calendar |
| New booking modal                        | `ui/src/features/dashboard/parking/components/AdminParkingNewBookingModal.tsx`                                                                         |
| Success summary (shared)                 | `ui/src/features/dashboard/bookings/components/AdminBookingSuccessSummary.tsx`                                                                         |
| Registration form (embedded)             | `ui/src/features/guest/marketing/parkings/components/ParkingRegistrationForm.tsx`                                                                      |
| Detail (Accept/Decline, countdown)       | `ui/src/features/dashboard/parking/pages/ParkingBookingDetailPage.tsx`                                                                                 |
| Shared status copy (guest/host/property) | `ui/src/lib/parking/parkingFlowCopy.ts`                                                                                                                |
| Claim / decline / transition hooks       | `ui/src/features/dashboard/parking/hooks/useParkingBookingMutations.ts`                                                                                |
| Countdown component                      | `ui/src/features/dashboard/bookings/components/ParkingBroadcastCountdown.tsx`                                                                          |
| Guest submit + status                    | `ui/src/features/guest/marketing/pages/ParkingFormPage.tsx`, `ui/src/features/guest/marketing/parkings/pages/ParkingRequestStatusPage.tsx`             |
| Ranking / batching (backend)             | `supabase/functions/_shared/parkingBroadcastRanking.ts`, `supabase/functions/_shared/parkingBroadcastExpireCron.ts`                                    |
| Payment orchestration (backend)          | `supabase/functions/_shared/parkingPaymentOrchestrator.ts`, `supabase/functions/_shared/parkingCancellation.ts`                                        |
| Backend spec                             | `.cursor/rules/parking-workflow.mdc`                                                                                                                   |

---

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`                                               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |
