# Meta inbox sync runbook

Operator guide for the Guest Inbox Meta pipeline: what breaks, how to tell, and what to do.
Design and phasing live in
[`docs/workflow/in-progress/guest-inbox-meta-sync-overhaul.md`](../../workflow/in-progress/guest-inbox-meta-sync-overhaul.md).

## How it fits together

```
Meta (Page, Instagram)
  signed POST, batched, unordered
        |
meta-inbox-webhook  verify -> meta_webhook_enqueue -> 200
        |                                   (outbox)
        +-- runAfterResponse --> metaInboxProcessor
                                    claim -> inbox_apply_meta_* -> social_conversations
                                                                   social_messages
                                                                   -> realtime.send('inbox:org:<id>')

pg_cron every minute (SQL-gated on due work)
        +--> meta-inbox-worker --> drain outbox, then import / reconcile for meta_sync_state rows
```

Two invariants worth remembering:

- **The dedupe row is written after the message lands.** Marking first is what lost messages.
- **`inbox_apply_meta_message` is the only writer.** Webhook, reconcile, import and Kame sends
  all go through it, so the message and the conversation cannot disagree.

## Health check, in order

1. **`/admin/health`** — Meta inbox panel: outbox backlog, dead letters, last reconcile per
   connection, highest rate-limit percentage.
2. **`meta_webhook_events`** — the outbox:
   ```sql
   select status, count(*), min(next_attempt_at), max(attempts)
   from public.meta_webhook_events
   group by status order by status;
   ```
   A growing `pending` means the worker is not running. `dead` rows need a replay.
3. **`meta_sync_state`** — per connection:
   ```sql
   select c.display_name, s.platform, s.import_completed_at, s.consecutive_failures,
          s.last_error_code, s.next_run_at, s.rate_limit_pct
   from public.meta_sync_state s
   join public.social_channel_connections c on c.id = s.connection_id
   order by s.consecutive_failures desc, s.next_run_at;
   ```
4. **`system_job_heartbeats`** — is `meta-inbox-worker` actually firing?
   ```sql
   select job_name, last_ok_at, consecutive_failures, last_error
   from public.system_job_health where job_name = 'meta-inbox-worker';
   ```

## Playbook

### Webhooks stopped arriving

Symptom: threads are stale, `meta_sync_state.last_checked_at` moves but no new messages.

1. Channels → **Fix connection** on the affected account. It re-verifies and re-subscribes
   `/subscribed_apps` in place, without disconnecting or wiping history.
2. If re-subscribe succeeds, reconciliation backfills the gap on the next cycle. Nothing is
   lost: Meta never resends, but the Conversations API still has the latest 20 per chat.
3. If Meta unsubscribed the app after an hour of failed deliveries, re-subscribing is the
   fix, and the worker's next reconcile picks up the window.

### Invalid token

Symptom: `social_channel_connections.status = 'error'`, `error_message` mentions the session,
sends fail with the reconnect copy, and `meta_sync_state` stops scheduling.

Reconnect from Channels. A new OAuth grant is the only fix; a token cannot be repaired.

### App Review downgraded

Symptom: only the owner's own messages arrive. Webhooks and the Conversations API are limited
to people with a role on the app.

This is configuration, not code. See
[`meta-app-review.md`](./meta-app-review.md). Reconciliation cannot recover conversations Meta
will not return.

### Business AI owns a chat

Symptom: the thread shows the Business AI banner, and sending fails with the take-over copy.

Meta routes the chat to its own agent. Take it over in Business Suite, or remove the app's
chat routing. Sends are rejected by design (error code 10, subcode 2018300).

### Replaying dead outbox rows

A dead row means six attempts failed. Fix the cause first (token, connection, Graph incident),
then replay:

```sql
update public.meta_webhook_events
set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null
where status = 'dead' and id = '<row id>';
```

The next worker tick picks it up. The write is idempotent, so a replay cannot duplicate a
message.

### Forcing a reconcile now

```sql
update public.meta_sync_state set next_run_at = now() where connection_id = '<id>';
```

Or ask the host to open the inbox, which does the same through `check_now` (throttled to once
per minute per connection).

### Rate limits

`meta_sync_state.rate_limit_pct` is the highest `call_count` Meta reported. At 75% the
interval doubles. At 90% only `check_now` runs, so a host opening the inbox still gets a fresh
check while background work pauses.

## Sentry alerts to configure

| Alert                 | Trigger                                                               |
| --------------------- | --------------------------------------------------------------------- |
| Dead letter           | Any `meta_webhook_events.status = 'dead'` (the processor captures it) |
| Outbox lag            | Oldest `pending` row older than 60 seconds for 10 minutes             |
| Miss rate             | Reconciliation inserts more than 2% of a Page's messages in a day     |
| Subscription inactive | `meta_inbox_outbox_due()` false for 15 minutes while rows exist       |
| Callback mismatch     | App-level subscription callback is not the production URL             |

`meta-inbox-webhook` and `meta-inbox-worker` both capture faults to Sentry already. Alerts are
dashboard configuration on those existing issue fingerprints.

## Environment

| Variable                   | Where                                               | Purpose                           |
| -------------------------- | --------------------------------------------------- | --------------------------------- |
| `META_INBOX_WORKER_SECRET` | Supabase secrets + Vault `meta_inbox_worker_secret` | Cron auth for `meta-inbox-worker` |
| `META_GRAPH_VERSION`       | `_shared/metaInboxConfig.ts` (not env)              | Single source for every Graph URL |

Cron jobs are created by `20261326120200_meta_inbox_worker_cron.sql`
(`meta-inbox-worker-every-minute`, `meta-inbox-outbox-retention-hourly`). Re-run
`select public.sync_meta_inbox_worker_cron();` after adding the Vault secret.
