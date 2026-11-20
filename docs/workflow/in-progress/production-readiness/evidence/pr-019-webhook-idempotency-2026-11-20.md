---
title: 'PR-019 / PR-036 — webhook idempotency'
status: active
tags: [workflow, production-readiness, evidence, money, reliability]
updated: 2026-11-20
stage: in-progress
kind: evidence
readiness: verified
launch_gate: C
---

# PR-019 / PR-036 — webhook idempotency and replay safety

## Coverage after this change

| Provider / retryable write           | Mechanism                                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PayMongo webhook                     | `processed_paymongo_events` claim with a 2-minute lease (`processed_at NULL` = in flight, timestamp = done)                                                            |
| Meta / Messenger / Instagram webhook | `meta_webhook_events` outbox, unique `event_key`, retry/dead states, worker cron                                                                                       |
| Resend inbound approval email        | `processed_emails` keyed on the Resend `message_id`                                                                                                                    |
| PWA offline replay                   | `Idempotency-Key` + `withIdempotency` on `transition-booking`, `transition-parking-booking`, `social-inbox-send`, `guest-web-chat-messages`, `notifications-mark-read` |
| Plan checkout                        | `idempotencyKey` on `create-org-subscription-checkout` and one open checkout per org                                                                                   |

## The defect this fixed

`paymongo-webhook` inserted the dedupe row before handling and never removed it. If the handler
threw (transient database error) or the function crashed, the row stayed behind and PayMongo's
retry was answered `{ duplicate: true }`. The payment event was lost: no receipt, no endorsement,
no plan activation.

## What shipped

- `supabase/migrations/20261346000000_paymongo_webhook_claim_lease.sql` — adds
  `processed_paymongo_events.processed_at` (backfilled for existing rows), an open-claim index.
- `_shared/paymongoEventDedupe.ts` — `claimPaymongoEvent` / `completePaymongoEvent` /
  `releasePaymongoEvent`. A duplicate in flight or done is a no-op; an abandoned claim older than
  2 minutes is taken over; a failed handler releases its claim.
- `paymongo-webhook` uses the claim around processing. The Sentry capture stays inside the
  handler, and the claim is released before the 500 so the retry is processed.
- `tests/paymongoEventDedupe.integration_test.ts` + `bun run test:edge:paymongo-dedupe`.

## Verification (2026-11-20, local stack)

| Check                               | Result                 |
| ----------------------------------- | ---------------------- |
| `bun run test:edge:paymongo-dedupe` | 4 passed, 0 failed     |
| New event claim                     | `claimed`              |
| Immediate replay                    | `duplicate`            |
| Replay after complete               | `duplicate`            |
| Released claim                      | retryable (`claimed`)  |
| 10-minute-old abandoned claim       | taken over (`claimed`) |
| Old completed event                 | `duplicate`            |

Residual: `approval-email-webhook` still checks `processed_emails` before applying and records
after. A crash between apply and record re-applies on retry; the apply path is status-guarded, but
moving it to the same claim-lease shape is tracked in `edge-cases/README.md` (`MSG-*`). No provider
was left without event-id dedupe.
