---
title: 'Edge-case hardening pass — cancellations, refunds, billing, parking, safety'
status: active
tags:
  [workflow, production-readiness, evidence, cancellation, refunds, billing, parking, trust-safety]
updated: 2026-11-22
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

## Self-review follow-ups (2026-11-22)

The pre-merge self-review found two P0s and a cluster of P1s. All are fixed in the same PR.

| Finding                                                                        | Fix                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host/system cancel on a property with **no policy** refunded ₱0                | The host/system full-refund branch now runs before the unset-policy return; guest cancels still ask the host. Tests for host, system and guest.                                                                        |
| `guest-trip-help` / `data-subject-request` had no `verify_jwt = false`         | Added in `config.toml` (plus the new `booking-help`) and both handlers are now in the edge type gate.                                                                                                                  |
| A guest edit could extend a stay past the contract end                         | `submit-form` now runs `assertStayWithinContract` for existing bookings too.                                                                                                                                           |
| Urgent help push could be muted or silenced by quiet hours                     | New `booking_help_requested` type marks the push critical and bypasses mutes and quiet hours; test.                                                                                                                    |
| Host notification was **silently rejected** by the DB                          | The `notifications_type_check` had drifted; migration `20261350000000` restores the 37-type catalog, and `notificationTypeCatalog_test.ts` prevents another drift. The integration test now proves the row is written. |
| Help case could never be closed                                                | `booking-help` GET/POST + **Mark resolved** on the booking overview; a new case can open after resolution.                                                                                                             |
| One global help alert key could throttle a second guest's P0                   | Key is now per booking; the storm guard handles volume.                                                                                                                                                                |
| Assistant cancel confirm did not show the refund amount                        | The proposal computes and includes the peso amount.                                                                                                                                                                    |
| Payout with a missing start date was treated as eligible                       | It is now held for review, with the existing early-disburse note override.                                                                                                                                             |
| Protocol-relative links bypassed the inbox guard                               | `//host` is now detected and blocked; test.                                                                                                                                                                            |
| Refund alerts were never resolved                                              | `cancellation-refund-cron` resolves the 7-day/10-day keys when nothing is overdue, and clears the 7-day key once a case is overdue.                                                                                    |
| Resending an old escalated invite bypassed the new ceiling                     | Property, parking and org resend now re-check the stored permissions.                                                                                                                                                  |
| Stale "check-in and SD emails are paid" copy                                   | Updated in plan copy, plan matrix, settings route guide, booking-detail guide, workflow effect preview, automation triggers and tooltip.                                                                               |
| Trip guide had two Host-facing sections and a false "on-call at night" promise | Merged into one section; the copy now says critical push + support alert when alerting is enabled.                                                                                                                     |

**New verification:** `test:edge:help` (create → one open case → resolve → reopen, with the real notification insert), `notificationTypeCatalog_test`, `notificationPreferences` critical-push test, host/system unset-policy tests, protocol-relative link test, missing-date payout test. `test:edge` 2176, handlers 1506, UI 6,577 + 86, edge types, type-check and build all pass.

## UI critique follow-ups (2026-11-22)

Impeccable critique (Assessment A: 27/40, Assessment B: detector clean on all 9 changed UI files) found a product gap and some polish issues. Applied in the same PR:

- **Token-only guests can see Get help now.** The action is no longer hidden when the trip page was opened from an email link; sending asks them to sign in with the booking email. This is a sign-in prompt, not token-native help yet; SAFE-06 remains the follow-up.
- **After sending, the guest sees a timestamp and "The host has been notified"**, and the **Unsafe or emergency** branch shows "If anyone is in danger, call 911 first."
- **The host case is now the first card in the booking Overview**, polls every 30 seconds while open, and is visible to read-only members (`bookings:view`); only `bookings.detail.workflow:edit` can mark it resolved.
- **Approve mode is labelled honestly**: "Approve cancellation" / "Approve and cancel" / "Go back" instead of the host-cancel wording, and the 24h note now says support will help the guest find another place instead of "reviewed by support".
- **Payout dialog**: the trigger reads **Review payout** when held, the early-disbursement reason is required with a visible hint, the draft is guarded, and the held banner uses the `--warning` tokens.
- **A11y**: grouped choice sets with labels, the orphan "Who asked?" label replaced, the decline textarea labelled, and the help card uses a heading.
