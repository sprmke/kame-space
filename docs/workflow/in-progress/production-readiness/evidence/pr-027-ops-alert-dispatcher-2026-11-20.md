---
title: 'PR-027 — ops alert dispatcher'
status: active
tags: [workflow, production-readiness, evidence, operations, alerting]
updated: 2026-11-20
stage: in-progress
kind: evidence
readiness: partial
launch_gate: F
---

# PR-027 — ops alert dispatcher

Phase 1 of `docs/workflow/planned/production-error-escalation.md` is implemented. The row stays
**operator-blocked** for the part only a human can do: create the ops bot/group, set the secrets,
run the drill, and name the on-call owner.

## What shipped

- `supabase/migrations/20261347000000_ops_alerts.sql` — `public.ops_alerts` (one open row per
  `alert_key`, occurrences, notify bookkeeping, ack/resolve state), partial unique index, service
  role only, `prune_ops_alerts()` for 180-day retention.
- `_shared/ops/opsAlert.ts` — `raiseOpsAlert` / `raiseOpsAlertAfterResponse` / `resolveOpsAlert`.
  Per-tier re-notify (P0 15 min, P1 1 h, P2 6 h, P3 24 h, drill always), storm guard (>10
  notifications in 5 min collapses to one message), Telegram primary + Resend email backup for
  P0/P1, 5 s timeouts, never throws, environment gate (`OPS_ALERTS_ENABLED` / production /
  `OPS_ALERTS_FORCE_SEND`).
- `_shared/ops/opsAlertIngest.ts` — HMAC-SHA256 over the raw body, timing-safe compare.
- `supabase/functions/ops-alert-ingest` — `POST` with `X-Ops-Signature: sha256=<hex>`, validates
  tier/source/title/links and calls the dispatcher. `verify_jwt = false` in `config.toml`.
- `_shared/httpResponse.ts#handleEdgeError` — every 5xx raises `edge:<fn>:5xx` (P0)
  fire-and-forget through `runAfterResponse`; 4xx never pages.
- Operator runbook: `docs/archive/operations/alerting-setup.md` §3 (env table + signed drill).

## Verification (2026-11-20, local stack)

| Check                                        | Result                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `_shared/ops/opsAlert_test.ts`               | 8 passed (tiers, throttle, storm, formatting, HTML escaping, scrub, env gate, HMAC)          |
| `tests/opsAlertDispatch.integration_test.ts` | 3 passed (first raise notifies, second aggregates, interval re-notify, resolve then re-open) |
| `bun run test:edge:ops-alerts`               | 11 passed, 0 failed                                                                          |
| Migration                                    | applied locally                                                                              |
| Edge 5xx wiring                              | type-checked; the drill path is the operator fire drill in the runbook                       |

## Still operator

1. Create the private ops Telegram group and a **separate** ops bot; get the chat id.
2. Set `OPS_ALERTS_ENABLED=true`, `TELEGRAM_OPS_BOT_TOKEN`, `TELEGRAM_OPS_CHAT_ID`,
   `OPS_ALERT_EMAILS`, `OPS_ALERT_INGEST_SECRET` in Supabase Edge secrets.
3. Run the signed drill in the runbook and confirm push + email.
4. Name the on-call owner and the runbook link per alert class in `incident-response.md`.

Residual (Phase 2+ of the plan, not in this change): the journey/job watchdog crons, the Sentry
email relay, and the GitHub Actions external probes that post to `ops-alert-ingest`.
