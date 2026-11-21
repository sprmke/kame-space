---
title: 'Edge cases: parking'
status: active
tags: [workflow, in-progress, production-readiness, edge-cases, parking, payouts]
updated: 2026-11-21
stage: in-progress
kind: plan
readiness: untracked
launch_gate: C
launch_blocker: tbd
last_verified: none
---

# Parking (`PRK`)

**Owned elsewhere:** [`parking-module-hardening.md`](../../parking-module-hardening.md) already covers the claim race (P0-3), stale checkout links (P0-2), host cancel of a paid booking moving to `refund_review` (M-1), the super-admin `record_refund` action (M-2), past-date and 60-night caps (M-7), parking RBAC and anti-spam. Ledger: PR-030 (PayMongo E2E), PR-031 (refund path), PR-035 (payout scale). PayMongo Platforms split payout and host KYC stay in `audits/parking-e2e-production-readiness.md`.

This file covers what sits **between** parking and the rest of the app, and the payout side.

## How it works today

- Parking is paid through PayMongo; the platform holds the money and a super-admin disburses to the parking host by hand (`parking-payouts`, `mark_disbursed`).
- A paid parking booking cannot be cancelled by the guest (`parkingCancellation.ts`). The parking host can cancel; the transaction goes to `refund_review`.
- A stay cancellation warns the property host about a linked parking booking but does not touch it (cancellation plan E40, E41, §7).

## Gaps

| ID     | Scenario                                                                                | Today                                                                                                         | Target                                                                                                                                                                                                            | Sev | Tag |
| ------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| PRK-01 | Stay is cancelled (by anyone) but the guest already paid for linked marketplace parking | Warn only. Guest keeps a paid parking booking for a stay that no longer exists and has no self-service cancel | Stay cancel offers the guest "Cancel my parking too" on the trip page; that creates a `refund_review` with reason `stay_cancelled`. Host-initiated stay cancels refund the parking in full automatically          | P0  | 🧭  |
| PRK-02 | Stay is rescheduled; linked parking keeps the old dates                                 | **Confirmed.** The `reschedule` branch of `bookingDetailsPatch.ts` only writes stay dates                     | Reschedule shows the linked parking and asks the parking host to move it (or re-broadcast if the slot is taken). Guest is told                                                                                    | P1  | 🆕  |
| PRK-03 | Parking host cancels a paid booking close to arrival                                    | `refund_review`, guest email (M-1)                                                                            | Inside 48h: re-broadcast the request to other hosts automatically with the same dates and price cap, so the guest is not left without a slot. Counts against the parking host's reliability (same idea as CAN-06) | P1  | 🆕  |
| PRK-04 | Payout disbursed before the guest actually parked                                       | **Confirmed.** `mark_disbursed` checks only `status = 'paid'`; no booking status or date check                | Payout becomes eligible 24h after the parking start date (Airbnb-style hold). The payouts page shows "Eligible on" and blocks earlier disbursement unless overridden with a note                                  | P0  | 🧭  |
| PRK-05 | Refund needed after the payout was already sent                                         | `record_clawback` records it; nothing recovers the money                                                      | Clawback creates a negative balance on the parking host that is netted from the next payout, shown on the host's Finance page                                                                                     | P1  | 🧭  |
| PRK-06 | Where the payout goes                                                                   | No payout account columns found in migrations                                                                 | Parking host payout destination (GCash / bank, account name) captured in parking settings with step-up verification on change and a 7-day hold after a change (account-takeover guard, SAFE-07)                   | P0  | 🟡  |
| PRK-07 | `mark_disbursed` called twice                                                           | Second call overwrites `disbursed_at` and reference                                                           | Only update when `disbursed_at is null`; second call returns the existing record                                                                                                                                  | P2  | 🆕  |
| PRK-08 | Guest arrives and the slot is occupied, or the building refuses the endorsement         | No guest issue path                                                                                           | Shares SAFE-01: "Problem with my parking" on the trip / parking status page, notifies the parking host and super-admin, offers re-broadcast or refund                                                             | P1  | 🆕  |
| PRK-09 | Guest changes car or plate after the endorsement was sent                               | `resend-parking-endorsement` exists; plate edit path not verified                                             | Guest can edit the plate until 24h before start; the edit re-sends the endorsement and tells the host                                                                                                             | P2  | 🟡  |
| PRK-10 | Guest overstays the parking end date                                                    | No state                                                                                                      | Parking host can log an overstay with extra nights at the host rate; collected by a new PayMongo link                                                                                                             | P2  | 🆕  |
| PRK-11 | Guest disputes the parking charge with their card / e-wallet (chargeback)               | No `dispute` handling in `paymongo-webhook` or `subscriptionOrchestrator.ts`                                  | Handle PayMongo dispute events (if the account receives them) by freezing the payout and adding the case to the super-admin queue; otherwise document the manual process                                          | P1  | 🟡  |
| PRK-12 | Guest wants to cancel a paid parking booking well before the date                       | Not self-service once paid                                                                                    | Parking cancellation policy (simple: full refund until 48h before start, minus the guest service fee) with a guest cancel button that lands in `refund_review`                                                    | P1  | 🧭  |

## Decisions needed (Phase 0)

1. Payout hold rule (suggest 24h after start date).
2. Parking cancellation policy for guests and whether the guest service fee is refundable.
3. Do stay cancellations auto-cancel linked paid parking? (Reverses cancellation plan §7 "out of scope".)
