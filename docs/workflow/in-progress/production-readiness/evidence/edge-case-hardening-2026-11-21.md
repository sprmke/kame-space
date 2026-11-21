---
title: 'Edge-case hardening pass — cancellations, refunds, billing, parking, safety'
status: active
tags:
  [workflow, production-readiness, evidence, cancellation, refunds, billing, parking, trust-safety]
updated: 2026-11-21
stage: in-progress
kind: evidence
readiness: partial
launch_gate: C
---

# Edge-case hardening pass (2026-11-21)

Branch `sprmke/readiness-cancellation-and-lifecycle`. This records the register rows that are
now fixed in code and the rows that deliberately remain.

## Fixed

| Register row              | What changed                                                                                                                                                                                                                       | Proof                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **CAN-01**                | `cancel-booking` accepts `initiator: guest` only when an open `booking_cancellation_requests` row exists; otherwise it records a host cancel.                                                                                      | `resolveHostCancellationInitiator` + service test                                   |
| **CAN-02**                | A host cancel always emails the guest. Only `duplicate_or_test` can opt out, in the API and the sheet.                                                                                                                             | `shouldNotifyGuestOnCancellation` + service test                                    |
| **CAN-03**                | Before check-in a host cancel refunds 100% of cash paid; an override below that floor is a 400. After check-in a partial override with a note stays allowed. The sheet hides the override where it cannot apply.                   | `assertHostRefundFloor` + service test; `cancelBooking`                             |
| **CAN-15**                | `transition-booking` rejects `CANCELLED` with **409 `use_cancel_booking`**. Cancellation can only go through `cancelBooking()`.                                                                                                    | handler guard                                                                       |
| **CAN-16**                | The AI assistant's `propose_cancel_booking` asks for a reason, then executes `cancelBooking()` with the host actor, full refund, guest email and refund row.                                                                       | `dashboardAssistantTools.ts`                                                        |
| **CAN-04 (partial)**      | Host cancels inside 24 hours raise the P1 `booking:host_cancel_within_24h` ops alert and the sheet shows a consequence warning. Host-only reason list. Typed confirmation is not added yet.                                        | `cancel-booking`, `CancelBookingSheet`                                              |
| **PAY-01**                | A `system` cancellation before check-in (the expired-request cron) refunds 100% of cash paid, while keeping `cancelled_by = 'system'`.                                                                                             | `computeCancellationOutcome` + test                                                 |
| **PAY-02 (first ladder)** | A pending refund past 7 days raises a P2 `refund:escalated_7d` alert; past 10 days a P1 `refund:overdue_10d`. Guest-side statuses never escalate.                                                                                  | `refundEscalation.ts` + test, `cancellation-refund-cron`                            |
| **BIL-01**                | `emailReadyForCheckin` and `emailSdRefundCheckout` are no longer plan-gated, so a downgrade or suspension cannot silence a guest who already booked.                                                                               | `propertyAutomationToggles.ts` + UI mirror + tests                                  |
| **BIL-02**                | Inbound calendar import keeps running for existing feeds on a downgraded/suspended plan; creating a feed, manual sync and export stay gated.                                                                                       | `calendar-sync-cron`                                                                |
| **PRK-01**                | A host stay cancel moves linked paid parking to `refund_review`, cancels the parking booking, expires open broadcasts and emails the guest.                                                                                        | `linkedParkingCancellation.ts` + `cancelBooking`                                    |
| **PRK-04 / PRK-07**       | Payout is held until 24 hours after the parking start. `mark_disbursed` returns 409 before then, shows "Eligible on" in the UI, allows an early disburse with a note, and cannot rewrite a disbursement (`disbursed_at` set once). | `parkingPayoutRules.ts` + test, `parking-payouts`, payouts page                     |
| **ACC-11**                | A stay whose check-out is after the listing contract end is refused at submit and at an admin reschedule; a check-out on the end date is allowed.                                                                                  | `stayContractWindow.ts` + test, `propertyLifecycle.ts`, `bookingDetailsPatch.ts`    |
| **SAFE-01 (first slice)** | **Get help now** on the trip page from 24h before check-in through check-out: four issue types, one open request per booking, host in-app/push notification, P0/P1 ops alert.                                                      | `booking_help_requests`, `bookingHelp.ts`, `guest-trip-help`, `GuestTripHelpButton` |
| **#161**                  | 19 red-team cases, including tool coercion, exfil links and system-prompt disclosure. The inbox guard now blocks external links and `data:`/`javascript:` URIs.                                                                    | `inboxAiSafetyGuard_test.ts`, `aiEvalsOffline.test.ts`                              |
| **#162**                  | Invite privilege ceiling for property, parking and org invites: a member cannot grant permissions they do not hold.                                                                                                                | `teamInvitePermissions.ts` + test, live local gate test                             |
| **#163**                  | Closed by the webhook claim-lease change in #553.                                                                                                                                                                                  | `paymongoEventDedupe`                                                               |

## Deliberately remaining

| Row                                      | Why it is not in this pass                                                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CAN-05 / 06 / 07 / 09 / 10 / 11 / 13** | Calendar block after host cancel, reliability scoring, super-admin cancellation queue, owner notice, rebooking help, mid-stay reason/refund and suspension handling are product decisions plus new admin surfaces. |
| **CAN-17**                               | Import revert still cancels moved rows with side effects off. The next step is to exclude paid moved rows and route them through `cancelBooking()`.                                                                |
| **PAY-02 (guest-facing)**                | The trip page does not yet show "We're following up with the host"; the ladder currently alerts support.                                                                                                           |
| **PRK-02 / 03 / 05 / 06 / 08 / 12**      | Parking date changes, re-broadcast, clawback netting, payout destination, parking issue path and a guest cancellation policy are separate parking hardening slices.                                                |
| **SAFE-01 (30-min escalation)**          | The alert fires immediately; the 30-minute "no host reply" escalation cron and the super-admin refund decision are the next slice.                                                                                 |
| **SAFE-02**                              | Extenuating-circumstances events need the super-admin declare-event UI, a waiver decision, and the reliability exclusion. The reason code alone would let a host self-declare, so it was not shipped.              |
| **#160 / #164**                          | The manual assistant walkthrough needs the paid AI key; the hosted re-run of the new probes needs a deploy.                                                                                                        |

## Verification

| Run                                                    | Result                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `test:edge`                                            | 2,169 passed                                                                                   |
| `test:edge:handlers`                                   | 1,500 passed                                                                                   |
| UI `vitest`                                            | 6,547 passed                                                                                   |
| `teamPermissionGatesLocal.integration_test.ts` (local) | 2/2, including the escalation refusal                                                          |
| `bun run type-check` / `check:edge-types` / `build`    | pass                                                                                           |
| Static guards                                          | select-star, unbounded select, auth matrix, wrapper, migration security, coverage ratchet pass |
