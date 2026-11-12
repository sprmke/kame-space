---
stage: planned
title: 'Production error escalation and developer alerting'
status: planned
tags:
  [
    planning,
    observability,
    sentry,
    alerting,
    telegram,
    incident-response,
    vercel,
    supabase,
    super-admin,
  ]
updated: 2026-11-11
---

# Production error escalation and developer alerting

**Goal:** when something that blocks a guest, a host, or money breaks in production, a developer's
phone buzzes within minutes, with enough context to act, and keeps buzzing until someone owns it.
Everything less urgent lands in a digest instead of a pager.

**Scope:** every production failure source: browser (Sentry web), edge functions (Sentry edge),
"expected" 4xx responses that are actually blockers, pg_cron jobs, webhooks, Vercel deploys,
GitHub CI/CD, Supabase platform faults, uptime, and third-party vendor outages.

**Builds on, does not replace:**

- [`docs/architecture/observability.md`](../../architecture/observability.md): Sentry owns faults, PostHog owns outcomes. Unchanged.
- [`docs/archive/operations/sentry-runbook.md`](../../archive/operations/sentry-runbook.md): triage. Gets a tier section.
- [`docs/archive/operations/alerting-setup.md`](../../archive/operations/alerting-setup.md): operator setup. Rewritten by this plan.
- [`docs/archive/operations/incident-response.md`](../../archive/operations/incident-response.md): SEV levels. Mapped to tiers below.
- [`docs/architecture/ops-reports.md`](../../architecture/ops-reports.md): weekly report. Gets a tier rollup.
- [`../in-progress/supabase-capacity-and-operational-readiness.md`](../in-progress/supabase-capacity-and-operational-readiness.md) (alert thresholds, "route alerts to a channel a human watches"): this plan is that delivery channel.
- [`./super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md) (`service-health-alert-cron`): reuses the dispatcher built here instead of its own sender.

---

## 1. Why this exists: two findings from 2026-11-10/11

### 1.1 The guest form blocker was invisible to Sentry by design

`ed685af00` fixed a production regression where **every** guest booking submit for properties with a
pre-versioning cancellation policy returned **`409 policy_changed`**. Guests could not book.

The observability rule says a deliberate 4xx is an _outcome_, not a _fault_
(`handleEdgeError`: `isDeliberate4xx = status < 500`; `reportEdgeFailure`: only `status >= 500`).
So Sentry received nothing, and no notification setting anywhere would have fired.

**Lesson:** better notifications are half the fix. The other half is detecting a broken **journey**
(submits failing at an abnormal rate) regardless of the HTTP status the code chose. Phase 3 is that.

### 1.2 A secret is sitting in a Sentry issue title

Issue **`KAME-SPACE-EDGE-A`** (`cron:telegram-admin-cron`, first seen 2026-11-09) has a title that
contains the full `api.telegram.org/bot<token>/sendMessage` URL, bot token included. Deno's fetch
error message embeds the URL, and `scrubUrl` only strips **query** keys, not path segments or
free-text messages. The weekly ops report also copies Sentry issue titles into `ops_reports` and
its email, so the token may be there too. Phase 0 handles it.

---

## 2. Current state (verified 2026-11-11 against the live Sentry org and the repo)

| Area                      | What exists                                                                                                                                                                                  | Gap                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Sentry plan               | `kame-tech`, **Developer (free)**: 1 user, 5k errors/mo, 30-day lookback, **email alerts only**, no Slack/Discord/webhook integrations, 1 uptime monitor, 1 cron monitor                     | No push, no team routing, no metric alerts                                                                               |
| Sentry projects           | `kame-space-web`, `kame-space-edge`                                                                                                                                                          | -                                                                                                                        |
| Sentry alert rules        | 2 default "Send a notification for high priority issues" (one per project), email to issue owners, **no environment filter**; 1 unused "pull requests are ready"                             | Sentry decides "high priority", not us; preview events can email; nothing distinguishes a guest blocker from a host typo |
| Sentry uptime             | 1 monitor on `get-health` every 5 min, named "mt-dev" but the project serves production                                                                                                      | Only API liveness. A blank guest page or a JS crash is "up"                                                              |
| Sentry crons              | 1 monitor (`sd-refund-cron`)                                                                                                                                                                 | ~30 other jobs rely on `/admin/health` heartbeats that nobody is pushed about                                            |
| Edge capture              | `handleEdgeError`, `serveCronPost`, `captureSideEffectFailure`, `reportCronPartialFailure`, dedupe window                                                                                    | No severity; 4xx blockers invisible                                                                                      |
| Browser capture           | `@sentry/react`, boundaries, `reportQueryError`, `reportEdgeFailure`, `surface` tag                                                                                                          | `surface` emits **`guest_ops`** while the runbook says `guest_booking`; booking and ops pages share one tag              |
| Weekly ops report         | `ops-report-cron`, Monday email, Sentry issues pulled                                                                                                                                        | Weekly. Not an escalation path                                                                                           |
| `/admin/health`           | jobs registry, heartbeats, env/probe checks                                                                                                                                                  | Pull-only. Nobody is told when a check turns red                                                                         |
| Telegram                  | Mature per-property / per-parking bot infra (`telegramApi.ts`, `telegram-*-cron`)                                                                                                            | **No platform-level ops channel** (incident-response.md says so)                                                         |
| Vercel                    | Hobby plan, Git integration deploys `main` → production; `web-probe.yml` checks the live build after each push to `main`                                                                     | A failed probe or build only shows as a red GitHub run / an email to the commit author                                   |
| GitHub CI/CD              | `ci.yml`, `cd-prod.yml`, `cd-rollback.yml`, `migration-replay.yml`, `web-probe.yml`                                                                                                          | No failure notification step anywhere                                                                                    |
| Supabase                  | Pro plan, one project (`fwor…`) serves production **and** dev                                                                                                                                | Isolate kills (`WORKER_LIMIT`, 546), boot errors and DB errors that never reach handler code are not captured anywhere   |
| Current noise (prod, 30d) | `Property not found` (22, should be a 404 outcome), `Edge call failed: list-* (network failure)` x3 regressed (transport failures that the filter should drop), `captureError` (a bad title) | These would page under any rule. Fix before tightening alerts                                                            |

### Direct answers

| Question                                                           | Answer                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does Sentry already notify?                                        | **Yes, by email only**, and only for issues Sentry itself marks high priority. It is working (last triggered 2026-11-10 14:56 for the `update-booking-details` 500).                                                                                                                               |
| Is there a Sentry mobile app?                                      | **No official one** that I could find. Push to phone today means the Gmail app with a dedicated label + notification (Phase 0), or our own Telegram channel (Phase 1).                                                                                                                             |
| Can Sentry send to Slack / Discord / Telegram / a webhook?         | **Not on the free plan.** Team ($26/mo annual, $29 monthly) adds integrations, unlimited users and 50k errors. Sentry has no native Telegram integration on any plan; it needs a webhook relay either way.                                                                                         |
| Can Sentry rank urgency?                                           | Partly. It assigns issue **priority** (high/medium/low) and flags **escalating** / **regressed** issues; Seer "actionability" needs a paid plan. It cannot know that `submit-form` matters more than `marketing-publish`. We encode that in code (Phase 2) and pass it to Sentry as a tag + level. |
| Can Sentry see Vercel deploy failures or Supabase platform errors? | Not without help. Vercel build failures never reach Sentry. Supabase logs can reach Sentry Logs through a **log drain (Pro add-on, about $60/drain/month plus usage)**, and even then they become log alerts, not issues. Phases 4 and 6 cover both for free.                                      |

---

## 3. Design principles

1. **Severity is decided in our code, from a registry**, not by a vendor heuristic. One file says what a P0 is.
2. **One dispatcher, many sources.** Every source (edge fault, watchdog, CI, probe, Sentry relay) calls the same `ops-alert` path, so dedupe, throttling, acknowledgement and channel routing live in one place.
3. **Sentry stays the fault store.** The dispatcher sends a short message with a link back to Sentry, `/admin/health` or the GitHub run. It is not a second error tracker.
4. **Journeys, not just exceptions.** A blocker that returns 4xx must still page (Phase 3).
5. **Few alerts, each with an owner and a runbook link.** A P0 that fires twice a week for noise is a broken alert. Fix the fingerprint or the threshold, never mute the channel.
6. **Alerting must survive the thing it watches.** If Supabase is down, the dispatcher (an edge function) is down too, so external probes alert through GitHub Actions directly and a dead-man's switch watches the watchdog.
7. **No PII in any alert.** Ids, function names, error codes, counts, release SHA, links. Same scrub list as Sentry.
8. **Every alert path gets a fire drill** before it is relied on. One Supabase project serves production, so drills use an explicit `drill` flag, never a real broken request.

---

## 4. Severity model

Tiers map to the existing SEV levels in `incident-response.md`.

| Tier   | SEV  | Meaning                                                                          | Delivery                                                                                     | Re-notify while open + unacked | Quiet hours      |
| ------ | ---- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------ | ---------------- |
| **P0** | SEV1 | Guests cannot book or pay, hosts cannot log in, data or money at risk, site down | Telegram ops group (with sound) + email + optional Pushover emergency                        | every 30 min                   | Never            |
| **P1** | SEV2 | Core feature broken for a tenant or all tenants, with a workaround               | Telegram ops group + email                                                                   | every 4 h                      | Never            |
| **P2** | SEV3 | Degraded module, non-critical cron, rising new issue                             | Telegram ops group (silent) during 08:00-22:00 Manila, otherwise held for the morning digest | none, digest only              | Held 22:00-08:00 |
| **P3** | SEV4 | Everything else Sentry captures                                                  | Daily digest + weekly ops report                                                             | none                           | n/a              |

Rules:

- A tier comes from the **critical journey registry** (`_shared/ops/criticalJourneys.ts`, Phase 2), keyed by `fn`, cron job name, or watchdog rule id.
- Unknown functions default to **P2** for 5xx and **P3** for anything else, so a new endpoint is never silently P3 forever. CI fails if a function under `supabase/functions/` with a `servePublic`/`serveCronPost` wrapper has no registry row (same pattern as `jobsRegistry_test.ts`).
- **Preview traffic is downgraded one tier.** The one Supabase project serves both `kamespace.com` and `*.vercel.app` previews. The edge tags `client_env` from the request `Origin` (`production` | `preview` | `unknown`), and the dispatcher downgrades `preview`. Browser events already carry `environment`.
- **Drill** is a pseudo-tier: delivered on every channel with a `[DRILL]` prefix, never re-notified, never counted.

### Initial P0 / P1 registry (to confirm function names in Phase 2)

| Journey                      | Signals                                                                                                            | Tier |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---- |
| Guest booking submit         | `submit-form`, `submit-form-completion` 5xx; journey watchdog rules J1-J3                                          | P0   |
| Guest booking page loads     | synthetic probe S1 (property page + form render); `guest_booking` render crash relayed from Sentry                 | P0   |
| Guest availability / pricing | public property / availability endpoints 5xx used by the form calendar                                             | P0   |
| Payments                     | `paymongo-webhook` 5xx or signature failure spike; pay-parking checkout 5xx; `platform-billing-cron` failure       | P0   |
| Host sign-in and dashboard   | auth callback failures; `list-organizations` / `list-properties` 5xx (not transport)                               | P0   |
| Site and API up              | `get-health` uptime; `kamespace.com` uptime; web-probe stale chunks                                                | P0   |
| Security                     | secret pattern detected in an outgoing telemetry payload (Phase 0 scrub counter); auth failure spike               | P0   |
| Booking workflow             | `workflowOrchestrator#transition` fault; `update-booking-details` 5xx; status side-effect failure (email/calendar) | P1   |
| Guest documents              | `approval-email-webhook` 5xx; SD form submit 5xx; `sd-refund-cron` / `cancellation-refund-cron` failure            | P1   |
| Guest email delivery         | Resend send failure for confirmation templates (`captureSideEffectFailure` provider=resend)                        | P1   |
| Deploys                      | `cd-prod.yml` failure, Vercel production `deployment_status=failure`, `migration-replay.yml` failure               | P1   |
| Scheduled jobs               | any `jobsRegistry` job stale > 2x interval or failed twice in a row; `pg_cron` run `failed`                        | P1   |
| Inbox, calendar sync, Meta   | `meta-inbox-webhook` 5xx, `calendar-sync-cron` partial failure > 20%, `meta-inbox-webhook-healthcheck` red         | P2   |
| Marketing, AI, analytics     | publish/generation failures, AI provider errors                                                                    | P2   |
| Everything else              | -                                                                                                                  | P3   |

---

## 5. Target architecture

```
SOURCES                                         DISPATCHER (Supabase)                    CHANNELS
-------                                         ---------------------                    --------
Edge faults (handleEdgeError, serveCronPost,  ─┐
  captureSideEffectFailure) tier P0/P1/P2      │
Journey watchdog (ops-watchdog-cron, 5 min)   ─┤                                       ┌─> Telegram ops group (primary push)
  J-rules on ops_journey_counters              │   _shared/ops/opsAlert.ts             ├─> Email via Resend (backup + record)
Job watchdog (same cron): pg_cron failures,   ─┼─> raiseOpsAlert({tier, key, ...})  ───┼─> Slack incoming webhook (optional)
  stale heartbeats, /admin/health red          │     upsert ops_alerts (dedupe)        ├─> Discord webhook (optional)
ops-alert-ingest (HMAC) <── GitHub Actions    ─┤     throttle, storm guard             └─> Pushover emergency (optional, P0)
  CI/CD failure, Vercel deployment_status,     │     route by tier + quiet hours
  synthetic probes, log scan                   │     runAfterResponse, 5s timeouts
ops-alert-inbound <── Sentry alert email      ─┘
  (Gmail forward → Resend inbound) or Sentry
  webhook if on Team plan

OUT-OF-BAND (works when Supabase is down)
GitHub Actions probes ── if ingest unreachable ──> Telegram Bot API directly (GH secrets)
ops-watchdog-cron ── ping every 5 min ──> healthchecks.io dead-man's switch ──> email + Telegram
Sentry uptime (get-health) ──> email (existing)

ACK LOOP
Telegram inline buttons [Ack] [Mute 1h] [Resolve] ──> ops-telegram-webhook ──> ops_alerts + super-admin audit
```

### 5.1 Data model (one migration)

`public.ops_alerts`, service-role only (RLS on, no policies), same posture as `ops_reports`:

| Column                                               | Meaning                                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `id`                                                 | uuid                                                                              |
| `alert_key`                                          | deterministic dedupe key, e.g. `edge:submit-form:5xx`, `journey:J1:submit-form`   |
| `tier`                                               | `p0`..`p3`, `drill`                                                               |
| `source`                                             | `edge`, `journey`, `job`, `ci`, `deploy`, `probe`, `sentry`, `log_scan`, `vendor` |
| `title`, `summary`                                   | short, scrubbed text                                                              |
| `links`                                              | jsonb: Sentry issue, `/admin/health`, GitHub run, runbook anchor                  |
| `context`                                            | jsonb: `fn`, `code`, `status_bucket`, `release`, `client_env`, counts. Ids only   |
| `status`                                             | `open`, `acked`, `muted`, `resolved`                                              |
| `first_seen_at`, `last_seen_at`, `occurrences`       | aggregation                                                                       |
| `last_notified_at`, `notify_count`                   | re-notify bookkeeping                                                             |
| `acked_by`, `acked_at`, `muted_until`, `resolved_at` | ack loop                                                                          |
| unique                                               | partial unique index on `alert_key` where `status <> 'resolved'`                  |

`public.ops_journey_counters` (Phase 3): `(journey, fn, outcome, code, bucket_start)` primary key,
`count int`. 5-minute buckets, 14-day retention via the existing prune cron pattern. No ids beyond
`property_id` (to tell "one property" from "every property"), no guest data.

Retention for `ops_alerts`: 180 days, pruned by `activity-log-retention-cron`'s pattern.

### 5.2 Dispatcher behaviour (`_shared/ops/opsAlert.ts`)

- `raiseOpsAlert(input)` upserts by `alert_key`. New key → notify now. Existing open key → increment `occurrences`; notify again only when the re-notify interval for its tier has passed, with "x14 since 09:12".
- `resolveOpsAlert(key)` → one "Recovered after 23 min" message. Watchdog rules resolve automatically when their condition clears for two consecutive runs.
- **Storm guard:** more than 10 notifications in 5 minutes collapses into one "Alert storm: 37 alerts, top 5 keys…" message per channel until the rate drops.
- **Never breaks a request:** called through `runAfterResponse`, every channel call has a 5 s timeout and its own try/catch, failures go to `console.error` + one Sentry warning (fingerprint `ops_alert_delivery`, never recursive).
- **Channel fallback:** if Telegram fails, email is still sent for P0/P1, and the failure is shown on `/admin/health`.
- **Environment gate:** sends only when `APP_ENV`/deployment resolves to production, or when `drill`. Local `functions serve` never pages.
- **Message format (Telegram, HTML parse mode):**

  ```
  🔴 P0 · Guest booking submit failing
  submit-form · 409 policy_changed · 7 of 7 attempts in 30 min, 3 properties
  release 706e3b7 · first 14:02 · last 14:31 Manila
  Sentry · Health · Runbook
  [Ack] [Mute 1h] [Resolve]
  ```

  Tier markers are the only emoji (they carry meaning on a lock screen). No guest names, emails, booking references or message text.

### 5.3 Channels

| Channel                | Cost                             | Why                                                                                                                                                                | Ships in |
| ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **Telegram ops group** | Free                             | Already integrated, reliable push on iOS/Android, a group fits several developers, inline buttons give a real ack loop. **Separate bot** from the per-property bot | Phase 1  |
| **Email (Resend)**     | Inside current plan              | Backup + durable record; goes to `OPS_ALERT_EMAILS`                                                                                                                | Phase 1  |
| Slack incoming webhook | Free (90-day history)            | If the team moves to Slack. Adapter only                                                                                                                           | Optional |
| Discord webhook        | Free                             | Same, adapter only                                                                                                                                                 | Optional |
| **Pushover** emergency | ~$5 one-time per device platform | P0 only: repeats until acknowledged and can break through Do Not Disturb (iOS critical alerts). The "wake me up at 3 am" option                                    | Optional |
| SMS / voice call       | Paid per message/call            | Deferred. Telegram + Pushover cover phone push without per-message cost                                                                                            | Deferred |

Recommendation: **Telegram + email now, Pushover for whoever holds P0 at night.** Slack/Discord
only if the team already lives there; every extra channel is one more place to mute.

---

## 6. Phases

Each phase is shippable on its own. Phases 0-3 deliver most of the value.

### Phase 0: secure and use what already exists (operator, ~1 hour, no new code except the scrub fix)

- [ ] **Rotate the Telegram bot token** that appears in `KAME-SPACE-EDGE-A` (BotFather `/revoke`), update the stored token, and confirm the admin/finance/staff crons still deliver.
- [ ] Delete the Sentry issue and its events (Sentry → issue → Delete and discard future events). Check `ops_reports.markdown` / `summary` rows and the 2026-11-09+ ops report email for the same string; redact the row.
- [ ] **Scrub fix** (code, both copies + parity test): redact `/bot<digits>:<token>/` path segments in `scrubUrl`, and run a secret-pattern pass over exception `value`, `message` and breadcrumb text in both Sentry `beforeSend` hooks (Telegram bot tokens, `Bearer …`, `sk_…`, Resend `re_…`, JWT-shaped strings). Add a counter tag `scrubbed_secret=true` so it can alert (P0) if it ever fires again. Also wrap `fetchTelegramJson` errors so the URL never reaches the thrown message.
- [ ] **Phone push for Sentry email today:** in Gmail create a filter `from:(alerts@sentry.io OR noreply@md.getsentry.com)` → label `Sentry`, mark important, never spam; in the Gmail app enable notifications for that label only (Settings → account → Manage labels → Sentry → Label notifications). Verify the sender address on the next real alert and adjust the filter.
- [ ] **Sentry alert rules:** add environment filter `production` to both rules; keep "new high priority" + "existing high priority". Turn on Spike Protection (Settings → Spike Protection) so a crash loop cannot burn the 5k quota.
- [ ] Rename the uptime monitor to "Edge API liveness (production get-health)".
- [ ] **Vercel:** Account Settings → Notifications: confirm "Deployment failed" is on for email and web for the account that owns `kame-homes`. Also install the Vercel mobile push if available on the account; otherwise rely on Phase 4.
- [ ] **Vendor status pages:** subscribe by email to Supabase, Vercel, Resend, PayMongo, Meta and Sentry status pages (all free). Phase 6 forwards them into the ops channel.
- [ ] Run the existing fire drill (`/admin/health` → Send test error) and confirm the email arrives on the phone with sound.

**Acceptance:** token rotated, issue deleted, scrub test proves the Telegram URL shape and an error message containing it are redacted, a drill email buzzes the phone.

### Phase 1: ops dispatcher and Telegram ops channel

- [ ] Migration: `ops_alerts` (5.1).
- [ ] `_shared/ops/opsAlert.ts`: `raiseOpsAlert`, `resolveOpsAlert`, storm guard, tier routing, quiet hours (Asia/Manila), environment gate.
- [ ] `_shared/ops/channels/{telegram,email,slack,discord,pushover}.ts`: each a pure `send(message): Promise<Result>` with a 5 s timeout. Telegram reuses `telegramApi.ts` helpers with the ops bot token.
- [ ] Email template `ops-alert.html` via the existing branded shell; add the `static_files` entry in `config.toml` (email-sending functions throw `ENOENT` in production without it).
- [ ] `ops-alert-ingest` (new, `servePublic`, `verify_jwt = false`): accepts `POST` with `X-Ops-Signature: HMAC-SHA256(body, OPS_ALERT_INGEST_SECRET)` and a timestamp within 5 minutes. Schema-validated body (`tier`, `alert_key`, `source`, `title`, `summary`, `links`). Rate-limited. Used by GitHub Actions and future sources.
- [ ] `/admin/health` → new **Alerting** section: channel config status (set / missing, never values), last 50 alerts with status, "Send drill alert" button (super admin + step-up, writes `system.ops_alert_drill_sent` to the super-admin audit trail).
- [ ] Register new env vars in `_shared/systemHealth/envRegistry.ts`.
- [ ] Unit tests: dedupe, re-notify intervals per tier, quiet hours, storm collapse, preview downgrade, channel failure fallback, HMAC verification (valid, wrong secret, stale timestamp, replay).

| Env var (edge secret)                               | Purpose                                                    |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `OPS_TELEGRAM_BOT_TOKEN`                            | Dedicated ops bot (not the per-property bot)               |
| `OPS_TELEGRAM_CHAT_ID`                              | The developers' group chat id                              |
| `OPS_TELEGRAM_ALLOWED_USER_IDS`                     | Who may press Ack / Mute / Resolve (Phase 7)               |
| `OPS_ALERT_EMAILS`                                  | Comma list; falls back to `SUPER_ADMIN_EMAILS`             |
| `OPS_ALERT_INGEST_SECRET`                           | HMAC for `ops-alert-ingest`; same value as a GitHub secret |
| `OPS_SLACK_WEBHOOK_URL`                             | Optional                                                   |
| `OPS_DISCORD_WEBHOOK_URL`                           | Optional                                                   |
| `OPS_PUSHOVER_APP_TOKEN` / `OPS_PUSHOVER_USER_KEYS` | Optional, P0 only                                          |
| `OPS_ALERT_QUIET_HOURS`                             | Default `22-08`                                            |

**Acceptance:** drill alert reaches Telegram and email in under 30 s; a repeated drill within the window aggregates instead of sending twice; unset channels show "off" on `/admin/health` and never throw.

### Phase 2: severity in code and a cleaner Sentry signal

- [ ] `_shared/ops/criticalJourneys.ts` registry (section 4), plus `criticalJourneys_test.ts` that fails when a wrapped function has no row.
- [ ] `handleEdgeError` / `serveCronPost` / `captureSideEffectFailure`: look up the tier, add Sentry tags `tier` and `journey`, use Sentry level **`fatal`** for P0 (pushes Sentry priority to high), and call `raiseOpsAlert` for P0/P1 5xx with key `edge:<fn>:<statusBucket>`. P2 goes to the dispatcher only after 3 occurrences in 15 minutes.
- [ ] Tag `client_env` on edge events from `Origin`.
- [ ] Browser: split the surface tag. `/form`, `/sd-form`, `/properties/*`, `/calendar`, pay-parking guest routes → **`guest_booking`**; the rest of today's `guest_ops` stays `guest_ops`. Update `sentry-runbook.md` to match. Add `tier` to browser events from the same route map (`guest_booking` render crash = P0).
- [ ] Noise fixes before any alert is tightened:
  - `Property not found` (`KAME-SPACE-WEB-1K`): a missing property is a 404 outcome. Throw an `EdgeResponseError` with status 404 so `reportQueryError` drops it.
  - `Edge call failed: list-* (network failure)` (`WEB-A`, `WEB-16`, `WEB-17`, regressed): the transport filter is not catching this path. Find the caller that bypasses `reportEdgeFailure`'s status-0 rule and route it through the seam.
  - `captureError` (`WEB-X`): an issue titled with the helper name means something passes a non-Error. Normalize to an `Error` with a real message in `capture.ts`.
- [ ] Sentry alert rules (still email on free): add **rule "P0 any event"**: `tier:p0`, production, every event, action email. Keep the high-priority rules as the catch-all. If the free plan refuses tag-filtered rules, keep the default rules: level `fatal` already makes P0 high priority.
- [ ] Weekly ops report: group Sentry findings by `tier` and list open `ops_alerts`.

**Acceptance:** a drill 5xx on a registry-P0 function produces a Sentry event with `tier:p0`, level `fatal`, and a Telegram P0 message linking to it; the three noisy issues stop recurring in production for 7 days.

### Phase 3: journey watchdog (the detector the 409 blocker needed)

- [ ] Migration: `ops_journey_counters` + `increment_journey_counter(...)` RPC (single upsert, service role).
- [ ] `_shared/ops/journeyOutcome.ts#recordJourneyOutcome({journey, fn, outcome, code, propertyId})` called after the response via `runAfterResponse`. Outcome classes:
  - `success`
  - `rejected_user`: validation, captcha, anti-spam, date taken. Expected and frequent.
  - `rejected_system`: a 4xx the guest cannot fix by retrying (`policy_changed`, plan/entitlement codes, config-missing codes). Each code is classified in the registry; unknown 4xx codes default here.
  - `fault`: 5xx.
- [ ] Wire it into `submit-form` and `submit-form-completion` first. Both use a hand-rolled `serve()`, so either move them to `servePublic` (preferred, separate PR, also gains timings + correct capture) or call the helper at each return.
- [ ] Then: SD form submit, pay-parking checkout, `paymongo-webhook`, host Google sign-in callback.
- [ ] `ops-watchdog-cron` (`serveCronPost`, every 5 min via `pg_cron` + `pg_net`, registered in `jobsRegistry.ts`) evaluates rules and raises or resolves alerts:

| Rule   | Condition (30-min sliding window unless stated)                                                               | Tier | Would have caught the 409?  |
| ------ | ------------------------------------------------------------------------------------------------------------- | ---- | --------------------------- |
| **J1** | `fault` ≥ 2 for any P0 journey in 10 min                                                                      | P0   | No (it was not a 5xx)       |
| **J2** | `rejected_system` ≥ 3 for one journey, any property                                                           | P0   | **Yes**, on the third guest |
| **J3** | attempts ≥ 5 and `success` = 0 for one journey                                                                | P0   | **Yes**                     |
| **J4** | one `code` ≥ 5x its 7-day same-hour median and ≥ 5 events                                                     | P1   | Yes                         |
| **J5** | no `success` platform-wide for 6 h between 08:00 and 23:00 Manila while public property page views > baseline | P1   | Yes, slowly                 |
| **J6** | `rejected_user` rate > 60% with ≥ 10 attempts (form or validation regression that looks like guest error)     | P2   | -                           |

Thresholds are starting points; tune after two weeks of counter data and record changes in this doc.

- [ ] Each rule's alert text names the top `code`, how many distinct properties are affected, and the release SHA, so "one property misconfigured" reads differently from "every guest blocked".

**Acceptance:** replaying the `policy_changed` scenario on a local stack (a property without a policy version) raises J2 within one watchdog run, and recovery resolves it after two clean runs. A unit test pins every rule.

### Phase 4: deploys, CI/CD, probes and the dead-man's switch

- [ ] `.github/actions/ops-alert/action.yml` composite action: signs and posts to `ops-alert-ingest`; if that fails (Supabase down), posts straight to the Telegram Bot API with `OPS_TELEGRAM_BOT_TOKEN` / `OPS_TELEGRAM_CHAT_ID` GitHub secrets.
- [ ] Add `if: failure()` steps:
  - `cd-prod.yml` (backend deploy, which is production) → P1 `deploy:cd-prod`
  - `web-probe.yml` (stale chunks / broken ingest proxy after a release) → **P0** `probe:web`
  - `migration-replay.yml` → P1
  - `ci.yml` on push to `main` / `develop` only (not PRs) → P2
- [ ] New `vercel-deploy-status.yml`: `on: deployment_status`. Vercel's Git integration posts GitHub deployment statuses, so this works on the Hobby plan without Vercel webhooks. `state == 'failure' || 'error'` and environment Production → P1; Preview → P3.
- [ ] New `guest-journey-probe.yml`, scheduled every 15 min (GitHub cron is best effort; acceptable as a second line). Playwright headless against `https://kamespace.com`:
  - S1: open a real live property page and its booking form, assert the form fields render, no uncaught page errors, no failed chunk requests.
  - S2: the availability/pricing request the form makes returns 200 with a sane shape.
  - S3: `get-health` 200 and `kamespace.com` 200.
  - **Never submits.** The repo forbids a test-booking pipeline; a probe that writes to production is not allowed.
  - Failure twice in a row → P0 `probe:guest-journey`; success after failure → resolve.
- [ ] **Dead-man's switch:** a free healthchecks.io check pinged by `ops-watchdog-cron` at the end of every run. Missing pings for 15 min → healthchecks.io emails and posts to the ops Telegram group via its built-in integration. This catches "pg_cron stopped", "Supabase down" and "dispatcher broken".
- [ ] Second free uptime monitor outside Sentry for `kamespace.com` and a public property page (HetrixTools / UptimeRobot / Better Stack free tier, whichever allows commercial use and Telegram on its free plan at setup time; check their terms then).

**Acceptance:** a forced failure in a `workflow_dispatch` dry run of each workflow posts one message; disabling the watchdog job for 20 min on purpose triggers the dead-man's switch.

### Phase 5: Sentry → Telegram bridge

Sentry still sees things our code does not route itself (browser render crashes, unknown exceptions, regressions). Two options:

| Option                                       | Cost                  | How                                                                                                                                                                                                                                                                                                                                                                        | Pick when                                       |
| -------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **A. Email relay** (recommended now)         | Free                  | Gmail filter auto-forwards Sentry alert emails to an address on the existing Resend inbound domain (same path as `approval-email-webhook`). New `ops-alert-inbound` parses subject/headers for project, issue short id, level and `tier` tag, then calls `raiseOpsAlert` with key `sentry:<shortId>`. Unknown formats still forward as P2 with the raw subject (scrubbed). | Free plan, one developer                        |
| **B. Sentry webhook** (internal integration) | Team plan ($26-29/mo) | Sentry → Settings → Developer Settings → Internal Integration with issue + alert webhooks → `ops-sentry-webhook` (verify `Sentry-Hook-Signature`). Richer payload, resolves when the issue resolves, no email parsing. Team also brings native Slack/Discord, unlimited users, 50k errors                                                                                  | A second developer joins, or the 5k quota binds |

- [ ] Build A. Keep the parser behind one function so swapping to B later only changes the entry point.
- [ ] Dedupe against Phase 2: an edge P0 already raised `edge:<fn>:5xx`; the relay attaches the Sentry link to the open alert instead of opening a second one (match on `fn` + time window).

**Acceptance:** the `/admin/health` Sentry test error appears in the ops Telegram group within 2 minutes of Sentry's email.

### Phase 6: Supabase platform and vendor signals

- [ ] **Edge platform failures that never reach handler code** (isolate `WORKER_LIMIT`, status 546, boot errors, CPU/time limits): `ops-log-scan.yml` GitHub Action every 15 min queries the Supabase Management API logs endpoint (`function_edge_logs`, `postgres_logs`, `auth_logs`) with `SUPABASE_ACCESS_TOKEN` stored **only** as a GitHub secret (it is account-wide, never an edge secret). Counts by function and status; posts to `ops-alert-ingest`. Rules: any 546 / boot error on a P0 function → P0; Postgres `FATAL` / `PANIC` → P0; Auth 5xx > 1% for 10 min → P1 (from the capacity plan thresholds).
- [ ] **Job health:** `ops-watchdog-cron` also checks `cron.job_run_details` for `failed` runs, `net._http_response` for cron calls that returned ≥ 500 or timed out, and `collectSystemHealthChecks()` results. Alert only on a transition from ok to error (no repeat spam), tier from the registry.
- [ ] **Capacity:** feed the thresholds already listed in the capacity plan (memory, connections, disk IO, PostgREST pool) into the same dispatcher once that plan's metrics scraping exists. This plan provides delivery only.
- [ ] **Vendor status:** forward the status-page subscription emails from Phase 0 into `ops-alert-inbound` (same parser entry, `source: vendor`): Supabase / Vercel / Resend / PayMongo incidents → P1, others → P2.
- [ ] **Deferred: Supabase log drain to Sentry** (Pro add-on, about $60/month per drain plus usage). Revisit only if the log scan misses incidents; it would land in Sentry Logs, which needs log alerts, not issue alerts.

**Acceptance:** a deliberately slow local function that hits the wall-clock limit shows up in a log-scan dry run; a failed pg_cron run in a test schedule raises a P1 and resolves after a good run.

### Phase 7: acknowledgement, escalation and the human loop

- [ ] `ops-telegram-webhook` (Telegram `setWebhook` with `secret_token`; reject requests without the header, reject users not in `OPS_TELEGRAM_ALLOWED_USER_IDS`). Buttons: **Ack** (stops re-notify, shows "acked by …"), **Mute 1h**, **Resolve**. Each writes the super-admin audit trail (`system.ops_alert_acked` / `muted` / `resolved`).
- [ ] P0 unacked after 15 min → escalate: repeat in the group, Pushover emergency if configured, email again.
- [ ] Daily digest 09:00 Manila: open alerts, P2/P3 held overnight, top 5 new Sentry issues, watchdog rule hit counts.
- [ ] `/admin/health` → Alerting: open alerts list with the same actions for when Telegram is unavailable.
- [ ] Update `incident-response.md`: on-call = whoever holds the Telegram group; SEV ↔ tier map; first response starts from the alert's runbook link.
- [ ] Post-incident: every P0 gets a short write-up under `docs/archive/operations/incidents/` with the alert id and whether the alert fired early enough. A P0 found by a user before an alert is a **detection gap** and gets a registry or watchdog change.

---

## 7. Cost summary

| Item                                           | Cost                                                                                           | Decision                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Phases 0-7 as specified                        | **$0** (existing Supabase Pro, Resend, GitHub Actions minutes, Telegram, healthchecks.io free) | Recommended                                  |
| Pushover for the night P0 holder               | about $5 one-time per platform                                                                 | Recommended, optional                        |
| Sentry Team                                    | $26/mo annual, $29 monthly                                                                     | When a second developer joins or quota binds |
| Supabase log drain                             | about $60/mo per drain + usage                                                                 | Deferred                                     |
| SMS / voice paging (Twilio, Better Stack paid) | per message / monthly                                                                          | Deferred                                     |

Prices are as published on 2026-11-11 and change often. Recheck before buying.

---

## 8. Risks and how the design handles them

| Risk                                                       | Mitigation                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Alert fatigue makes the channel ignored                    | Tiers, quiet hours for P2, dedupe, storm guard, noise fixes in Phase 2 before rules tighten; review weekly |
| The dispatcher is down with Supabase                       | GitHub direct-to-Telegram fallback, healthchecks.io dead-man's switch, Sentry uptime email                 |
| Secrets or PII in alert text                               | Same scrub as Sentry, ids only, secret-pattern counter (Phase 0), HMAC on ingest, separate ops bot         |
| `ops-alert-ingest` abused to spam the team                 | HMAC + timestamp + rate limit; unsigned requests never reach the dispatcher                                |
| Preview traffic pages for production                       | `client_env` downgrade; browser `environment` filter on Sentry rules                                       |
| Watchdog thresholds wrong on day one                       | Start conservative, tune after 2 weeks of counters, record changes here                                    |
| A synthetic probe writes to production                     | Probes are read-only by contract; a review checklist item in the workflow file                             |
| Email relay parser breaks when Sentry changes its template | Unknown format still forwards as P2 with the scrubbed subject; Option B removes the parser                 |
| Single operator                                            | Telegram group + allowed-user list make adding a second developer a config change, not a code change       |

---

## 9. Repo checklist when implementing

- **Docs:** `observability.md` (tiers, dispatcher, journey counters), `sentry-runbook.md` (tier tags, `guest_booking` surface, bridge), `alerting-setup.md` (rewrite as the operator setup for every channel), `incident-response.md` (tier map, on-call), `ops-reports.md` (tier rollup), `docs/PROJECT.md` + `validation-and-env.md` (env vars), `edge-functions.md` (new functions + JWT policy), `scheduled-jobs-and-testing.md` (`ops-watchdog-cron`), `docs/guides/routes/admin/health.md` (Alerting section) via **`route-guides`**.
- **Migrations:** `ops_alerts`, `ops_journey_counters` + RPC, pg_cron job for `ops-watchdog-cron` (Vault secret pattern from `ops-report-cron`). Add rows to `migration-runbook.md`.
- **`config.toml`:** `verify_jwt = false` for `ops-alert-ingest`, `ops-alert-inbound`, `ops-telegram-webhook`, `ops-watchdog-cron`; `static_files` for the ops email template.
- **Plans/RBAC:** N/A. Platform-level, super-admin only, no host entitlement.
- **activity-log:** host `activity_log` N/A (no org/property state changes). Super-admin audit trail events: `system.ops_alert_drill_sent`, `system.ops_alert_acked`, `system.ops_alert_muted`, `system.ops_alert_resolved`.
- **support-content:** N/A. Nothing host- or guest-facing changes.
- **mobile-responsive:** applies to the `/admin/health` Alerting section only.
- **Production deploys** of migrations and functions need the `kamewave` unlock per `no-prod-deploy.mdc`, and with one Supabase project every deploy is a production deploy.

---

## 10. Decisions for the owner

1. **Primary push channel:** Telegram ops group (recommended) vs Slack vs Discord.
2. **Who is in the group** and who may Ack (Telegram user ids), and the `OPS_ALERT_EMAILS` list.
3. **Sentry plan:** stay free with the email relay (recommended for now) vs Team now for native webhooks/Slack and more seats.
4. **Night P0 escalation:** Pushover for one person (recommended) vs Telegram only.
5. **Quiet hours** for P2: default 22:00-08:00 Manila.
