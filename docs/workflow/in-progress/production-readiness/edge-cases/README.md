---
title: 'Edge-case gap register'
status: active
tags: [workflow, in-progress, production-readiness, edge-cases, money, trust-safety]
updated: 2026-11-21
stage: in-progress
kind: plan
origin_stage: untracked
readiness: untracked
launch_gate: C
launch_blocker: tbd
last_verified: none
---

# Edge-case gap register

End-to-end edge cases across every role (guest, host, team member, super-admin, developer) that the app either does not handle, handles in a way that can lose money or strand a guest, or handles without telling anyone. Ledger row: **PR-162**.

This register is **additive**. It does not repeat what other plans already track. Each domain file links the plan that owns overlapping work and only lists the cases nobody owns yet.

## How this was built (2026-11-20)

- Read the server paths end to end: `cancel-booking`, `_shared/cancellationService.ts`, `_shared/cancellationRefund.ts`, `_shared/workflowOrchestrator.ts`, `_shared/bookingDetailsPatch.ts`, `submit-form`, `_shared/pendingReviewExpiry.ts`, `_shared/guestPush.ts`, `_shared/propertyAutomationToggles.ts`, `transition-parking-booking`, `parking-payouts`, `_shared/subscriptionOrchestrator.ts`, `delete-organization`, `submit-support-ticket`.
- Checked against existing plans so nothing is duplicated (table below).
- Second pass (same day) across public, dashboard and super-admin surfaces: `transition-booking`, `dashboardAssistantTools.ts`, `import-commit` / `import-revert`, `publicPropertyService.ts`, `guestProfileService.ts`, `voucher.ts`, `contractExpiryCron.ts`, `identity-verification-review`, `notificationPreferences.ts`, `sentryCron.ts`, `approve-org-verification`, `hostVerificationReward.ts`, maintenance mode gates.
- Compared with how Airbnb, Agoda / Booking.com and Vrbo handle the same situation (host cancellation penalties, rebooking help, extenuating circumstances, resolution centre, payout holds).

Every row says whether the gap is **confirmed in code** (file named) or **needs verification** (behavior inferred, prove it before building).

## Domain files

| File                                                                             | Prefix | Covers                                                                       |
| -------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| [`01-cancellations-host-reliability.md`](./01-cancellations-host-reliability.md) | `CAN`  | Host cancellations, same-day cancels, guest protection, rebooking, penalties |
| [`02-guest-payments-refunds.md`](./02-guest-payments-refunds.md)                 | `PAY`  | Down payment, balance, receipts, refunds, security deposit                   |
| [`03-availability-double-booking.md`](./03-availability-double-booking.md)       | `AVL`  | Overlaps, reschedules, holds, OTA lag, blocked dates                         |
| [`04-stay-changes-and-lifecycle.md`](./04-stay-changes-and-lifecycle.md)         | `STAY` | Date / rate / party changes, check-in day, no-show, early leave, reviews     |
| [`05-parking.md`](./05-parking.md)                                               | `PRK`  | Stay and parking linkage, payouts, clawbacks, slot problems                  |
| [`06-subscriptions-billing.md`](./06-subscriptions-billing.md)                   | `BIL`  | Suspension side effects, downgrades, disputes, ownership                     |
| [`07-messaging-notifications.md`](./07-messaging-notifications.md)               | `MSG`  | Who gets told what, on which channel, when a channel fails                   |
| [`08-trust-safety-emergencies.md`](./08-trust-safety-emergencies.md)             | `SAFE` | Arrival problems, emergencies, typhoons, fraud, disputes, account takeover   |
| [`09-accounts-teams-tenancy.md`](./09-accounts-teams-tenancy.md)                 | `ACC`  | Account deletion, ownership transfer, team removal, property moves           |
| [`10-automation-ai-and-admin.md`](./10-automation-ai-and-admin.md)               | `PLAT` | AI tool writes, dev flags, cron alerting, super-admin actions                |

## Severity

| Sev  | Meaning                                                                                  |
| ---- | ---------------------------------------------------------------------------------------- |
| `P0` | Guest can lose money or be stranded, a host can avoid a refund, or data integrity breaks |
| `P1` | A real situation with no flow; support has to fix it by hand or in SQL                   |
| `P2` | Rough edge; workaround exists but is not obvious                                         |

Status tags reuse the readiness legend in [`../README.md`](../README.md): 🆕 untracked gap · 🧭 product decision needed · 🟡 needs verification · ⏸️ deferred with reason.

## 2026-11-21 hardening pass

Branch `sprmke/readiness-cancellation-and-lifecycle` fixed the first wave. Evidence:
[`../evidence/edge-case-hardening-2026-11-21.md`](../evidence/edge-case-hardening-2026-11-21.md).

| Fixed                                                             | Register row        |
| ----------------------------------------------------------------- | ------------------- |
| Guest-initiated label needs an open request                       | CAN-01              |
| Host cancel always emails the guest                               | CAN-02              |
| Pre-check-in host refund cannot be overridden down                | CAN-03              |
| `transition-booking` rejects `CANCELLED`                          | CAN-15              |
| AI assistant cancel uses the cancellation service                 | CAN-16              |
| Late host cancel raises a P1 alert (typed confirm pending)        | CAN-04 partial      |
| Expired request refunds 100%                                      | PAY-01              |
| Refund escalation at 7 / 10 days                                  | PAY-02 first ladder |
| Check-in and SD refund emails never plan-gated                    | BIL-01              |
| Calendar import keeps running on downgrade                        | BIL-02              |
| Host stay cancel refunds linked parking                           | PRK-01              |
| Payout held 24h after parking start, disbursement set once        | PRK-04 / 07         |
| Check-out after the contract end refused at submit and reschedule | ACC-11              |
| Get help now (host + ops alert); 30-min escalation pending        | SAFE-01 first slice |
| Link / data-URI exfil guard, 19 red-team cases                    | #161                |
| Invite privilege ceiling                                          | #162                |

Still open from the P0 shortlist: **CAN-05–14**, **CAN-17**, **PAY-14**, **PRK-06**, **SAFE-02**, and the remaining rows in each domain file.

## P0 shortlist (build first)

"Confirmed" means the behavior was read in the named file on 2026-11-20. "Verify" rows need a probe before building.

| ID      | Gap                                                                                                        | Evidence                                                               |
| ------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| CAN-01  | Host can label their own cancellation as "guest asked" and skip the full refund and the host-cancel metric | Confirmed: `cancel-booking/index.ts` reads `initiator` from the body   |
| CAN-02  | Host can cancel and switch off the guest email, so the guest is never told                                 | Confirmed: `notifyGuest: body.notifyGuest !== false`                   |
| CAN-03  | Host-initiated refund can be overridden down to ₱0 before check-in                                         | Confirmed: `cancellationRefund.ts` override applies to every initiator |
| CAN-04  | No guardrail, penalty or super-admin alert for host cancels inside 24h or on arrival day                   | Confirmed: `isHostCancellable` has no time check                       |
| PAY-01  | A request that expires because the host never answered refunds by policy, not in full                      | Confirmed: `pendingReviewExpiry.ts` cancels as `system`                |
| PAY-02  | Refunds rely on the host paying by hand; nothing escalates a refund that is never sent                     | Confirmed: host reminder cron only                                     |
| AVL-01  | Host reschedule writes new dates without an overlap or cleaning-buffer check                               | Confirmed: `bookingDetailsPatch.ts` `reschedule` branch                |
| AVL-02  | Double booking still relies on an app-level check                                                          | Owned by ledger PR-032; listed for priority                            |
| AVL-09  | Host may approve two overlapping pending requests                                                          | Verify                                                                 |
| STAY-02 | Host changes rate, fees or dates after booking with no guest notice or consent                             | Confirmed: `bookingDetailsPatch.ts` sends nothing                      |
| BIL-01  | Downgrade or suspension stops check-in and SD refund emails for guests who already booked                  | Confirmed: `PLAN_GATED_AUTOMATION_TOGGLE_KEYS`                         |
| BIL-02  | Downgrade or suspension stops Airbnb / Agoda calendar import while direct bookings stay open               | Confirmed: `calendar-sync-cron` entitlement filter                     |
| PRK-01  | Stay cancelled but the guest's paid linked parking stays booked with no self-service cancel                | Confirmed: cancellation plan §7 leaves it out                          |
| PRK-04  | Parking payout can be disbursed before the guest parks                                                     | Confirmed: `mark_disbursed` checks `status = 'paid'` only              |
| PRK-06  | No recorded payout destination for parking hosts                                                           | Verify                                                                 |
| MSG-01  | Host cancellation reaches the guest by email only (no push, no chat note)                                  | Confirmed: `guestPush.ts` statuses                                     |
| SAFE-01 | No "can't get in / not as described / occupied on arrival" help flow for guests                            | Confirmed: no guest issue path                                         |
| SAFE-02 | No extenuating-circumstances path (typhoon signal 3+, earthquake, travel restrictions)                     | Confirmed: no policy, reason code or waiver                            |
| SAFE-07 | Account takeover could redirect guest payments or parking payouts                                          | Verify step-up coverage on payment settings                            |
| CAN-15  | Host can cancel through `transition-booking`, skipping refund, reason, voucher release and guest email     | Confirmed: `transition-booking` accepts `CANCELLED`                    |
| CAN-16  | AI assistant cancel skips the cancellation service (no reason, refund row or guest email)                  | Confirmed: `propose_cancel_booking` in `dashboardAssistantTools.ts`    |
| PAY-14  | Guest pays a down payment against an unsaved estimate; host sets the real rate later with no guest consent | Confirmed: no quote stored by `submit-form`                            |
| ACC-11  | Guests can book nights after the host's sublease / authorization ends                                      | Confirmed: no contract-end check in booking or availability            |

## Already owned elsewhere (do not duplicate)

| Plan                                                                                                                    | Owns                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [`cancellation-policy-and-process.md`](../../cancellation-policy-and-process.md)                                        | Policy engine, snapshot, guest cancel / request, refund calculator, edge cases E1 to E49                      |
| [`calendar-sync-conflict-resolution.md`](../../../planned/calendar-sync-conflict-resolution.md)                         | iCal conflicts and host resolution sheet                                                                      |
| [`parking-module-hardening.md`](../../parking-module-hardening.md)                                                      | Parking claim race, stale checkout links, parking RBAC, parking anti-spam                                     |
| [`property-archive-and-delete-lifecycle.md`](../../property-archive-and-delete-lifecycle.md)                            | Archive / restore / delete guardrails and guest impact                                                        |
| [`guest-trust-safety-reporting.md`](../../../planned/guest-trust-safety-reporting.md)                                   | Reporting listings / hosts / chats, enforcement, appeals                                                      |
| [`guest-journey-followups.md`](../../../planned/guest-journey-followups.md)                                             | Guest push milestones (J2), per-property request expiry (J3), stale requests (J4), SMS (J5)                   |
| [`guest-form-saved-progress-and-submit-recovery.md`](../../../planned/guest-form-saved-progress-and-submit-recovery.md) | Booking form drafts and failed submits                                                                        |
| [`checklist/35-business-logic-integrity.md`](../checklist/35-business-logic-integrity.md)                               | Races: double booking, voucher double claim, AI wallet, amount tampering, TZ                                  |
| Ledger PR-030 / 031 / 032 / 035 / 036 / 145                                                                             | PayMongo E2E, parking refund path, DB exclusion constraint, payout scale, webhook replay, data-subject delete |

## Delivery plan

Each phase is one or more PRs into `develop`. Every phase runs the repo gates (documentation-maintenance, route-guides, audit-logging, support-content, mobile-responsive when UI changes) and needs `kamewave` only for the production deploy.

| Phase | Scope                                                                                                                                              | Rows                                                              |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0     | Product decisions in one sitting (every 🧭 row; list at the end of each domain file)                                                               | All 🧭 rows                                                       |
| 1     | Server hotfixes, no new UI: initiator proof, forced guest notice, host refund floor, expired-request refund, reschedule and approve overlap checks | CAN-01..03, CAN-15, CAN-16, PAY-01, AVL-01, AVL-09, PLAT-02       |
| 2     | Host-side state must not hurt booked guests: grandfather guest emails, keep calendar import running, contract end dates                            | BIL-01, BIL-02, ACC-11, PLAT-03                                   |
| 3     | Host cancellation guardrails: lead-time tiers, calendar block, super-admin list, reliability score                                                 | CAN-04..09, CAN-11, CAN-13                                        |
| 4     | Guest protection: Get help now, rebooking help, refund escalation, resolution cases                                                                | SAFE-01, SAFE-05, SAFE-06, CAN-10, CAN-14, PAY-02, PAY-03, PAY-08 |
| 5     | Messaging coverage: push, chat note, email fallback and urgent bypass for every money or date event                                                | MSG-*                                                             |
| 6     | Stay changes: quote snapshot and rate consent, change requests, extensions, check-in day failures                                                  | STAY-*, AVL-03..08                                                |
| 7     | Parking linkage and payouts                                                                                                                        | PRK-*                                                             |
| 8     | Payment destination safety and fraud signals                                                                                                       | SAFE-07, PAY-04, PAY-09, PRK-06, SAFE-08, SAFE-09                 |
| 9     | Accounts and tenancy                                                                                                                               | ACC-*                                                             |
| 10    | Extenuating circumstances and remaining safety rows                                                                                                | SAFE-02, SAFE-03, SAFE-04, SAFE-10, SAFE-11                       |
| 11    | Automation and super-admin tooling: AI payload allow-list, super-admin booking actions, step-up gaps                                               | PLAT-01, PLAT-04..09                                              |

## Exit gate

- [ ] Every P0 row is fixed with a Deno or Vitest test that reproduces the old behavior, or has a written product decision accepting the risk.
- [ ] Every P1 row has a flow, a named owner, or a ⏸️ with reason.
- [ ] Host and guest FAQs (`docs/guides/support/faqs.md`) answer "the host cancelled on me", "my refund never came", "I can't get in" and "a typhoon cancelled my trip".
- [ ] Manual QA script in `docs/guides/testing/` walks the P0 rows on hosted dev.
