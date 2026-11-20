---
title: 'PR-031 — parking refund/override path re-verified'
status: active
tags: [workflow, production-readiness, evidence, money, parking]
updated: 2026-11-20
stage: in-progress
kind: evidence
readiness: verified
launch_gate: C
---

# PR-031 — parking refund/override path

The row was tracked as a product decision. The decision was taken and the path is already in the
code; this note records the re-verification rather than a new build.

## What exists

- Host cancels a paid parking booking (`transition-parking-booking`) → requires a reason, moves the
  ledger row to `refund_review`, and stops payout eligibility
  (`_shared/parkingPaymentOrchestrator.ts#isRefundTerminal`).
- Super admin records the refund on `/admin/parking/payouts` (`parking-payouts`
  `action = 'record_refund'`): amount capped at the guest charge, `status = 'refunded'`,
  `refunded_at`, reference, reason and the acting admin are stored, and
  `parking.refund_recorded` + `parking_payout.refund` activity rows are written.
- The host-facing payment card and the super-admin payout page both render the refund state.
- Repeat/duplicate provider webhooks cannot move a `refund_review`/`refunded` row back to `paid`.

## Verification (2026-11-20)

| Check                                 | Result                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `tests/parkingHardeningGates.test.ts` | passes (`record_refund`, `refund_review`, payout block assertions)                                              |
| Route guides                          | `docs/guides/routes/org/parking/bookings.md`, `finance.md`, and the super-admin payouts guide describe the flow |
| Residual                              | the actual PayMongo refund call stays manual by design; provider-side reconciliation is PR-030/PR-097           |

No code change was needed for this row.
