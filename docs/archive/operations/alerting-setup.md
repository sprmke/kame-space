---
title: 'Alerting setup'
status: active
tags: [operations, observability, alerting]
updated: 2026-09-22
---

# Alerting setup

**Operator task.** The code is shipped and inert; it stays a no-op until the two accounts below exist and their values are set. Until then nothing pages when production breaks.

Context: production-readiness [`30-availability-and-recovery.md`](../../workflow/in-progress/production-readiness/checklist/30-availability-and-recovery.md) records that no pager, uptime monitor or watched channel exists today, and [`incident-response.md`](./incident-response.md) states on-call is "whoever is awake." This closes the detection half of that gap.

---

## 1. Uptime monitor (no code, do this first)

`get-health` already ships and needs nothing added. It returns `200` with `{status, version, db}` and `503` when the DB probe fails, is rate-limited to 60/min, and leaks nothing.

| Setting      | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| URL          | `https://<project-ref>.supabase.co/functions/v1/get-health`          |
| Method       | `GET`                                                                |
| Interval     | 1–5 min (stay under the 60/min limit)                                |
| Up condition | HTTP `200`                                                           |
| Alert after  | 2 consecutive failures (one blip on a cold isolate is not an outage) |

Any provider works (Better Stack, UptimeRobot, Pingdom). Point it at hosted dev first to confirm the alert path delivers before relying on it for production.

**Verify it works:** the alert must fire when the endpoint is down. An untested monitor is an assumption, not coverage — the same trap [`30-availability-and-recovery.md`](../../workflow/in-progress/production-readiness/checklist/30-availability-and-recovery.md) flags for the never-rehearsed restore.

---

## 2. Sentry

Create **two** projects so a browser crash loop cannot drown out edge alerts:

| Project        | Platform       | DSN goes in                        |
| -------------- | -------------- | ---------------------------------- |
| Edge functions | Deno / generic | Supabase Edge secret `SENTRY_DSN`  |
| Browser SPA    | JavaScript     | Vercel build env `VITE_SENTRY_DSN` |

Setting each secret is all that is required — no redeploy of application logic, though the browser DSN is read at build time so the UI needs a rebuild to pick it up.

### Three alert rules, deliberately few

Alert fatigue is the failure mode that makes alerting worthless. Start here and add only when a real incident proves a gap:

1. **Health check down** — from the uptime monitor above, not Sentry.
2. **Edge 5xx spike** — Sentry, edge project: new issue, or issue rate above your normal baseline. Note that after the `EdgeError` change, unexpected faults correctly report as 500; routine validation stays 400 and will not page.
3. **Browser exception spike** — Sentry, browser project. Expect noise from extensions and old cached bundles; tune the threshold after a week of real data rather than guessing now.

### What the code already guarantees

- **Both are optional.** Unset DSN → no-op. Malformed DSN → logged once, disabled, never throws.
- **Telemetry cannot break a request.** Every entry point swallows its own errors; the edge settles PostHog and Sentry in parallel so a slow vendor cannot delay a response.
- **PII is stripped** via the shared denylist (`posthogSanitize.ts`), reused rather than duplicated so the two cannot drift. URLs are redacted before they leave (`sanitizeUrlForTelemetry`) — capability tokens live in query strings on guest routes.
- **CSP is ready** — `ui/vercel.json` `connect-src` allows `*.ingest.sentry.io` (plus the `us`/`de` regional hosts). A DSN on any other host needs a matching entry, or it will break when CSP moves from Report-Only to enforcing (doc 22).

---

## 3. Ops dispatcher (PR-027)

The code is shipped and inert until the environment below is set. It adds one watched channel
instead of relying on four vendor dashboards.

**What ships**

| Piece                     | Role                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `public.ops_alerts`       | One open row per `alert_key`; occurrences, `last_notified_at`, ack/resolved state. Service-role only, 180-day retention (`prune_ops_alerts()`).                                                              |
| `_shared/ops/opsAlert.ts` | `raiseOpsAlert` / `resolveOpsAlert`: dedupe, per-tier re-notify (P0 15 min, P1 1 h, P2 6 h, P3 24 h), storm guard (>10 notifications in 5 min collapses to one message), 5 s channel timeouts, never throws. |
| `ops-alert-ingest`        | `POST`, HMAC-SHA256 over the raw body in `X-Ops-Signature: sha256=<hex>`, validates and calls the dispatcher. `verify_jwt = false`.                                                                          |
| `handleEdgeError`         | Every **5xx** raises `edge:<fn>:5xx` (P0) fire-and-forget. 4xx stays a normal outcome and never pages.                                                                                                       |

**Environment (Supabase Edge secrets)**

| Variable                  | Required     | Meaning                                                                                                                                             |
| ------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPS_ALERTS_ENABLED`      | yes (`true`) | Master switch. Production also auto-enables when `ENVIRONMENT=production`; local `functions serve` never pages unless `OPS_ALERTS_FORCE_SEND=true`. |
| `TELEGRAM_OPS_BOT_TOKEN`  | yes          | **Separate** ops bot from the per-property bot (BotFather).                                                                                         |
| `TELEGRAM_OPS_CHAT_ID`    | yes          | Private ops group chat id (add the bot to the group first).                                                                                         |
| `OPS_ALERT_EMAILS`        | recommended  | Comma-separated, P0/P1 only, Resend backup + durable record.                                                                                        |
| `OPS_ALERT_FROM_EMAIL`    | optional     | Default `Kame Space Ops <ops@kamespace.com>`.                                                                                                       |
| `OPS_ALERT_INGEST_SECRET` | yes          | Shared with GitHub Actions / probes; 32+ random bytes.                                                                                              |

**Fire drill** (an untested pager is an assumption):

```bash
BODY='{"key":"drill:ops-alert","tier":"drill","source":"probe","title":"Ops alert drill","summary":"manual drill"}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$OPS_ALERT_INGEST_SECRET" -r | cut -d' ' -f1)"
curl -sS -X POST "https://<project-ref>.supabase.co/functions/v1/ops-alert-ingest" \
  -H "Content-Type: application/json" -H "X-Ops-Signature: $SIG" -d "$BODY"
```

Expect `202 { "accepted": true, "notified": true }` and a 🧪 DRILL message in the ops group
(plus email when `OPS_ALERT_EMAILS` is set). Re-running the same key inside the storm/throttle
window returns `notified: false` without sending — that is the dedupe working.

**What still needs a human:** create the group and bot, set the secrets, run the drill, and name
the on-call owner in [`incident-response.md`](./incident-response.md). Until then the dispatcher
writes rows but nobody is paged.

---

## Why Sentry when PostHog already captures exceptions

PostHog keeps the exception history and stays the product-analytics system of record. It is not the alerting path here because PostHog alert configuration is operator-blocked ([doc 28](../../workflow/in-progress/production-readiness/checklist/28-analytics.md)). Both receive every captured error from the same choke point, so this is additive — if PostHog alerting is configured later, the Sentry rules can be retired without touching handler code.

---

## Related

- [`incident-response.md`](./incident-response.md) — what to do once an alert fires
- [`docs/architecture/edge-functions.md`](../../architecture/edge-functions.md) — error status contract and the logging/correlation-id contract
- [`docs/architecture/validation-and-env.md`](../../architecture/validation-and-env.md) — `SENTRY_DSN` / `VITE_SENTRY_DSN` reference
