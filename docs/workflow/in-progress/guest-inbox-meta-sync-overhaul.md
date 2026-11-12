---
title: 'Guest Inbox: complete, real-time Facebook and Instagram sync'
status: in-progress
stage: in-progress
kind: plan
tags:
  [
    workflow,
    in-progress,
    inbox,
    meta,
    messenger,
    instagram,
    webhooks,
    realtime,
    supabase,
    cost,
    reliability,
    ux,
  ]
updated: 2026-11-13
readiness: phase-1-verified
last_verified: 2026-11-10
---

# Guest Inbox: complete, real-time Facebook and Instagram sync

> **Revised 2026-11-10 (execute-plan):** Phase 1 audited against `origin/develop` and implemented.
> Findings confirmed: F7, F8, F9, F12, F15, F16, F18, F19, F21, F24, F25, F32 all reproduce on the
> current code. F32 confirmed against Meta's version table: **v21.0 expires 2027-01-21**, **v26.0 is
> current** (released 2026-07-29), so the version bump target is `v26.0`.
>
> Scope of this pass: **Phase 1 only** (items 1.1 to 1.12). Phases 2 to 8 remain, unmodified below.
> Reason recorded in the Decisions table.
>
> Plan corrections applied while implementing Phase 1:
>
> - 1.1 gains a transitional `meta_backfill_cursor` column. `meta_backfill_next_url` cannot be
>   reused for a cursor (the name promises a URL) and Phase 3 replaces both with `meta_sync_state`.
> - 1.3 gains an ordering constraint the original text left open: the dedupe row is written **after**
>   the message row, not merely "removed". Side effects key off a **newly inserted** message, which
>   needs `insertMessageIfNew` to report insertion, not just absence.
> - 1.5 gains a `host_last_read_at` guard on the unread increment. The original text only said
>   "atomic unread", which would resurrect a badge the host already cleared.
> - 1.9 gains `MetaGraphError` (typed `code` / `error_subcode`) so the caller can act on the code
>   instead of matching prose. Substring matching cannot express "code 10 with subcode 2018300".
> - 1.11 gains a named interim poll window and the rule that it stops the moment Phase 4 lands.

## Goal

Hosts run guest messaging from Kame Space and stop opening Meta Business Suite to check what they missed. Concretely:

1. Every Facebook Page and Instagram conversation that Meta lets an app read shows up in the Guest Inbox, with both sides of the conversation, in the right order.
2. New messages appear within seconds while the inbox is open, and the inbox catches up by itself after a phone sleeps, a laptop closes, or the network drops.
3. When Meta limits what we can show or do, the inbox says so at the point where the host meets the limit, instead of looking broken.
4. Cost grows with message volume, not with the number of open tabs or connected Pages. No single large Page, message burst, or cron run can degrade the platform for other hosts.

### Targets

| Metric                                                          | Today                               | Target                                        | Measured by                                         |
| --------------------------------------------------------------- | ----------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| Messages sent after connect that reach Kame (vs Business Suite) | unknown, reported as "some missing" | ≥ 99.5%                                       | Phase 0 parity sample, then the reconcile miss rate |
| Webhook acknowledgement p95                                     | unknown (all work runs inline)      | < 300 ms (Meta requires < 5 s)                | edge logs                                           |
| Guest message to inbox screen p95, inbox open                   | unknown                             | < 3 s                                         | Meta timestamp vs client render                     |
| Catch-up after sleep, offline, or socket drop                   | none until pull-to-refresh          | < 5 s after the tab is visible and online     | Playwright + manual                                 |
| Time to recover from a silent webhook failure                   | never (only disconnect + reconnect) | ≤ 10 min for active Pages, ≤ 2 min while open | reconcile metrics                                   |
| Host replies sent from Business Suite or Meta apps shown        | only when an echo arrives intact    | 100%                                          | parity sample                                       |
| Messages per imported thread                                    | 1 to 10                             | up to 20 (Meta's maximum)                     | Appendix A2                                         |
| Edge invocations per 1,000 guest messages                       | ~5,750 (estimate)                   | ~3,650 (estimate)                             | Phase 8 re-measure                                  |
| DB requests per 1,000 guest messages                            | ~57,500 (estimate)                  | ~17,500 (estimate)                            | `pg_stat_statements`                                |
| Inbox Postgres Changes bindings per host tab                    | 2 org-wide + 2 per open thread      | 0                                             | capacity capture script                             |
| Property-level team members receiving live updates              | no                                  | yes                                           | Playwright                                          |

Phase 0 replaces every "unknown" and every estimate with a measured number before code changes start.

## Short answer: why it feels broken

Three layers fail together, so fixing one alone will not make the inbox trustworthy.

- **Meta may not be sending us the messages.** Webhooks and history for people without a role on the Meta app need Advanced Access through App Review, and nothing in the repo records that we have it. Instagram is subscribed to `messages` only. `standby`, which Meta uses when its Business AI or another app owns a chat, is not subscribed at all. The local testing runbook also tells developers to repoint the shared webhook URL to ngrok.
- **When Meta does send them, we lose or misfile some.** We mark an event as processed before processing it, guess Instagram vs Facebook from the first two digits of an ID, do all the work before answering Meta's 5-second deadline, and drop every event type except plain messages and reads. History import stores 1 to 10 messages per chat (Meta allows 20) and records Instagram host replies as guest messages.
- **When we have them, the screen often does not show them.** RLS excludes property-level team members from realtime, nothing refetches after the socket drops, and each change refetches every page of every inbox query, which is slow and costly.

The fix is a rework of **ingestion, sync, and realtime**, plus honest UI. The OAuth connect flow, the org/property/parking scope model, AI suggest and auto-reply, quick replies, templates, and the Insert menu stay as they are. Phase 1 also closes a security hole: the Facebook Page access token is sent to the browser.

## What we found

Severity: **P0** loses data or exposes a secret. **P1** visible breakage or a major cost. **P2** minor.

Code links point at the state of the repo on 2026-11-09.

### A. Meta never sends us the event

| #   | Finding                                                                                                                                                                                                                                                                                                                                                      | Evidence                                                                                                                                                                                     | Sev | Phase |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----- |
| F1  | **App access level is unrecorded.** Without Advanced Access, Meta only delivers webhooks for, and only returns conversations with, people who have a role on the app. Real guests would never arrive while the host's own test messages do, which matches "some chats are missing".                                                                          | [`meta-app-review.md`](../../archive/operations/meta-app-review.md) says "Submit when inbox + marketing flows work" and records no outcome                                                   | P0  | 0     |
| F2  | **Most event types are not subscribed.** Page fields are `messages, messaging_postbacks, message_deliveries, message_reads, message_echoes`. Instagram is documented with `messages` only. Missing: `standby`, `messaging_handovers`, `message_reactions`, `message_edits`, `messaging_referrals`, and Instagram `messaging_seen` and `messaging_postbacks`. | [`metaInboxConfig.ts:51`](../../../supabase/functions/_shared/metaInboxConfig.ts#L51), [`meta-app-review.md:204`](../../archive/operations/meta-app-review.md#L204)                          | P1  | 2     |
| F3  | **Chats owned by Meta Business AI or another routing app are invisible.** They arrive only on `standby`, which we neither subscribe to nor read (the handler loops `entry.messaging` only). Replies fail with error `10` / subcode `2018300`, which our mapper reports as a missing permission.                                                              | [`meta-inbox-webhook/index.ts:72`](../../../supabase/functions/meta-inbox-webhook/index.ts#L72), [`metaInboxSendErrors.ts:8`](../../../supabase/functions/_shared/metaInboxSendErrors.ts#L8) | P1  | 1, 2  |
| F4  | **Local testing can switch off production webhooks.** The runbook tells developers to set the Meta app's Page webhook callback to their ngrok URL. A Meta app has one callback per object, so if local and production share the app, every host stops receiving messages until someone switches it back.                                                     | [`inbox-e2e-runbook.md:60`](../../archive/operations/inbox-e2e-runbook.md#L60)                                                                                                               | P1  | 0, 3  |
| F5  | **Outages are never backfilled.** After 1 hour of failed deliveries Meta unsubscribes the app from the Page and never resends those events. Our 10-minute health check re-subscribes, but nothing fetches what was missed.                                                                                                                                   | [`metaInboxWebhookHealth.ts:153`](../../../supabase/functions/_shared/metaInboxWebhookHealth.ts#L153)                                                                                        | P0  | 3     |
| F6  | **Instagram account settings are never checked or explained.** The Instagram professional account must allow connected tools to access messages. Nothing detects or explains it.                                                                                                                                                                             | no code path                                                                                                                                                                                 | P1  | 0, 5  |

### B. We receive the event but lose or misfile it

| #   | Finding                                                                                                                                                                                                                                                                                           | Evidence                                                                                                                                                                                       | Sev | Phase |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----- |
| F7  | **Events are marked processed before processing.** `recordWebhookEvent(mid)` runs first. If anything after it throws, or the connection lookup misses, Meta's retry is treated as a duplicate and the message is lost for good.                                                                   | [`metaInboxWebhookHandler.ts:47`](../../../supabase/functions/_shared/metaInboxWebhookHandler.ts#L47)                                                                                          | P0  | 1     |
| F8  | **Platform is guessed from the ID prefix.** `payload.object === 'instagram' \|\| recipientId?.startsWith('17')`. Facebook Page IDs and guest PSIDs can start with 17, so those Messenger messages and Business Suite echoes are filed under Instagram, or dropped when the Page has no Instagram. | [`meta-inbox-webhook/index.ts:78`](../../../supabase/functions/meta-inbox-webhook/index.ts#L78)                                                                                                | P0  | 1     |
| F9  | **All work runs before the 200.** Connection lookups, a Graph profile call for new guests, conversation upsert, Telegram and in-app notifications all run inline. Meta wants a response within 5 seconds. One failing event returns 500 for the whole batch, and with F7 the retry then skips it. | [`meta-inbox-webhook/index.ts:72-110`](../../../supabase/functions/meta-inbox-webhook/index.ts#L72-L110)                                                                                       | P0  | 2     |
| F10 | **Unhandled event types are dropped.** Postbacks (ice breakers and Get Started taps that open many conversations), reactions, guest edits, Instagram unsends (`is_deleted`), story replies, unsupported types, handovers, and standby are all ignored.                                            | no matches for `postback`, `standby`, `reaction`, `is_deleted`, `reply_to` in the handler                                                                                                      | P1  | 2, 6  |
| F11 | **Echo race strips Kame metadata.** If a Kame reply's echo lands before `social-inbox-send` inserts its row, the echo wins and the later insert is swallowed as a duplicate, losing `sent_by_user_id`, the AI flag, the message tag, and the reply link.                                          | [`socialInboxService.ts:485-515`](../../../supabase/functions/_shared/socialInboxService.ts#L485-L515), [`social-inbox-send/index.ts`](../../../supabase/functions/social-inbox-send/index.ts) | P2  | 2     |

### C. We store it, but the thread is wrong or incomplete

| #   | Finding                                                                                                                                                                                                                                                                                                                                                          | Evidence                                                                                                                                                                                                                                                                 | Sev | Phase |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ----- |
| F12 | **Imported Instagram host replies are stored as guest messages.** `isOutbound = msg.from?.id === pageId` uses the Facebook Page ID, but Instagram messages carry the Instagram account ID. Reply status and the 24-hour window are derived the same way, so imported Instagram threads always show "Needs reply".                                                | [`metaInboxBackfill.ts:134`](../../../supabase/functions/_shared/metaInboxBackfill.ts#L134), [`:105-106`](../../../supabase/functions/_shared/metaInboxBackfill.ts#L105-L106)                                                                                            | P0  | 1, 3  |
| F13 | **Most threads hold one message.** The first chunk imports 10 messages per chat. Every later page loads only when the host scrolls to the end, in "light" mode, which stores just the latest message. Opening a thread never fetches more. Meta allows 20.                                                                                                       | [`useInbox.ts:541`](../../../ui/src/features/dashboard/inbox/hooks/useInbox.ts#L541), [`metaInboxBackfill.ts:131`](../../../supabase/functions/_shared/metaInboxBackfill.ts#L131), [`metaInboxGraph.ts:434`](../../../supabase/functions/_shared/metaInboxGraph.ts#L434) | P0  | 3     |
| F14 | **Out-of-order and repeated events rewrite the thread summary.** Every event overwrites `last_message_at`, `subject_preview`, and `reply_status`, and resets `unread_count` to 0 before adding 1 in a separate read-then-write. Meta does not guarantee order. Threads jump around, previews show older text, unread never passes 1, and concurrent events race. | [`metaInboxWebhookHandler.ts:96-110`](../../../supabase/functions/_shared/metaInboxWebhookHandler.ts#L96-L110), [`socialInboxService.ts:552-558`](../../../supabase/functions/_shared/socialInboxService.ts#L552-L558)                                                   | P1  | 1     |
| F15 | **Guest read receipts clear the host's unread badge.** `message_reads` means the guest read our message, but the handler sets the host's `unread_count` to 0.                                                                                                                                                                                                    | [`metaInboxWebhookHandler.ts:168-182`](../../../supabase/functions/_shared/metaInboxWebhookHandler.ts#L168-L182)                                                                                                                                                         | P1  | 1     |
| F16 | **Property and parking override Pages are never imported, and import crashes once one exists.** Backfill state lives only on the org-default Facebook row. `meta-inbox-backfill` loads Facebook connections with `.maybeSingle()` across every scope, which errors as soon as an org has an override.                                                            | [`metaInboxBackfill.ts:249`](../../../supabase/functions/_shared/metaInboxBackfill.ts#L249), [`meta-inbox-backfill/index.ts:22-33`](../../../supabase/functions/meta-inbox-backfill/index.ts#L22-L33)                                                                    | P1  | 1, 3  |
| F17 | **Disconnect always deletes every Meta thread and message.** `deleteMessages` was made opt-in by the August hardening plan, then hard-coded to `true` the same day (`7fb872508`). Because Meta only returns the latest 20 messages per chat, anything older is gone for good after a reconnect.                                                                  | [`meta-inbox-disconnect/index.ts:29`](../../../supabase/functions/meta-inbox-disconnect/index.ts#L29)                                                                                                                                                                    | P1  | D2    |

### D. We have it, but the screen does not show it

| #   | Finding                                                                                                                                                                                                                                                                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                         | Sev | Phase |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ----- |
| F18 | **Property-level team members get no live updates.** Realtime uses Postgres Changes gated by `user_can_access_org_inbox`, which admits only the org owner and org ADMIN members. A property manager with `inbox:view` sees a frozen list.                                                    | [`20260912120000_inbox_rls_permissions.sql:19`](../../../supabase/migrations/20260912120000_inbox_rls_permissions.sql#L19)                                                                                                                                                                                                                                                                       | P1  | 1, 4  |
| F19 | **No catch-up after the socket drops.** `refetchOnWindowFocus` is off app-wide, the thread list has `refetchInterval: false`, and nothing refetches when the channel resubscribes. After a phone sleeps or the network changes, the inbox stays stale until pull-to-refresh.                 | [`App.tsx:50`](../../../ui/src/App.tsx#L50), [`useInbox.ts:574`](../../../ui/src/features/dashboard/inbox/hooks/useInbox.ts#L574)                                                                                                                                                                                                                                                                | P0  | 1, 4  |
| F20 | **Refetch storms make "live" feel slow.** Any message or conversation change in the org invalidates every loaded thread page and every open message query, and the per-thread channel refetches again. Each thread open runs up to 12 sequential Graph attachment calls plus a profile call. | [`useInbox.ts:146-153`](../../../ui/src/features/dashboard/inbox/hooks/useInbox.ts#L146-L153), [`useInbox.ts:746`](../../../ui/src/features/dashboard/inbox/hooks/useInbox.ts#L746), [`social-inbox-messages/index.ts:77-79`](../../../supabase/functions/social-inbox-messages/index.ts#L77-L79), [`socialInboxService.ts:434`](../../../supabase/functions/_shared/socialInboxService.ts#L434) | P1  | 4     |

### E. The UI promises what Meta does not allow, or hides the limits

| #   | Finding                                                                                                                                                                                                                          | Evidence                                                                                                                                                                                                                          | Sev | Phase |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----- |
| F21 | **Edit and Unsend appear on Messenger and Instagram messages.** Meta has no API to edit or unsend a Page message, so only Kame's copy changes. The guest still sees the original. The server check has no platform guard either. | [`InboxConversationView.tsx:836-847`](../../../ui/src/features/dashboard/inbox/components/InboxConversationView.tsx#L836-L847), [`chatMessageLifecycle.ts:144`](../../../supabase/functions/_shared/chatMessageLifecycle.ts#L144) | P1  | 1     |
| F22 | **Sync depends on the browser tab.** A blocking modal says "Keep this page open". The import chunk is driven by the client.                                                                                                      | [`MetaInboxOperationModal.tsx:18`](../../../ui/src/features/dashboard/inbox/components/MetaInboxOperationModal.tsx#L18), [`useInbox.ts:217`](../../../ui/src/features/dashboard/inbox/hooks/useInbox.ts#L217)                     | P1  | 3, 5  |
| F23 | **Nothing explains what the inbox is, how fresh it is, or what Meta limits.** Hosts read Meta's rules (24-hour window, 20-message history, old message requests, unsupported types, Business AI) as bugs.                        | page subtitle only                                                                                                                                                                                                                | P1  | 5     |
| F24 | **Error copy misleads.** Any `(#10)` becomes "Missing Meta permission", including Business AI ownership and other code-10 errors.                                                                                                | [`metaInboxSendErrors.ts:8`](../../../supabase/functions/_shared/metaInboxSendErrors.ts#L8)                                                                                                                                       | P2  | 1     |

### F. Security

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                           | Evidence                                                                                                                                                                                                                                                       | Sev | Phase |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----- |
| F25 | **The Page access token reaches the browser and is stored unencrypted.** Graph `paging.next` URLs carry `access_token`. We return that URL to the client as `nextUrl`, persist it in `meta_backfill_next_url` (bypassing the token encryption), and fetch whatever URL the client posts back. Any member with `inbox:view` can call the `light` path, read the token, and make the server fetch an arbitrary URL. | [`metaInboxGraph.ts:449`](../../../supabase/functions/_shared/metaInboxGraph.ts#L449), [`:460`](../../../supabase/functions/_shared/metaInboxGraph.ts#L460), [`meta-inbox-backfill/index.ts:59`](../../../supabase/functions/meta-inbox-backfill/index.ts#L59) | P0  | 1     |
| F26 | **Read-receipt broadcast channel is public.** `chat-sync:<conversationId>` is not a private channel.                                                                                                                                                                                                                                                                                                              | [`useChatReadReceiptSync.ts:99`](../../../ui/src/lib/chat/useChatReadReceiptSync.ts#L99)                                                                                                                                                                       | P2  | 4     |
| F27 | **Search text is interpolated into PostgREST filter strings.** Org scope still applies, but commas or parentheses break the query.                                                                                                                                                                                                                                                                                | [`socialInboxService.ts:184`](../../../supabase/functions/_shared/socialInboxService.ts#L184), [`:747`](../../../supabase/functions/_shared/socialInboxService.ts#L747)                                                                                        | P2  | 4     |

### G. Cost, scale, and upkeep

| #   | Finding                                                                                                                                                                                                              | Evidence                                                                                                                                                                        | Sev | Phase |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----- |
| F28 | **Postgres Changes polling is 84% of DB time.** The inbox holds 2 org-wide bindings per host tab plus 2 per open thread, with `REPLICA IDENTITY FULL` on both tables so every update writes the full old row to WAL. | [`supabase-capacity.md:43`](../../architecture/supabase-capacity.md#L43), [`20260914120000_inbox_realtime.sql`](../../../supabase/migrations/20260914120000_inbox_realtime.sql) | P1  | 4, 8  |
| F29 | **About 25 database round trips per inbound webhook**, plus a second connection lookup in the entrypoint.                                                                                                            | [`meta-inbox-webhook/index.ts:89-91`](../../../supabase/functions/meta-inbox-webhook/index.ts#L89-L91)                                                                          | P1  | 2     |
| F30 | **`message_deliveries` is subscribed but ignored**, roughly a quarter of webhook invocations for nothing.                                                                                                            | [`metaInboxConfig.ts:51-57`](../../../supabase/functions/_shared/metaInboxConfig.ts#L51-L57)                                                                                    | P2  | 2     |
| F31 | **`social_webhook_events` adds a row per message** for 30 days, used only for the dedupe in F7.                                                                                                                      | `prune_operational_tables()` in `20261318170000_capacity_hardening.sql`                                                                                                         | P2  | 2, 8  |
| F32 | **Graph API v21.0 is reported to stop working on 2027-01-21**, after which Meta silently upgrades calls. The OAuth dialog URL also hard-codes `v21.0`.                                                               | [`metaInboxConfig.ts:5`](../../../supabase/functions/_shared/metaInboxConfig.ts#L5), [`metaInboxGraph.ts:508`](../../../supabase/functions/_shared/metaInboxGraph.ts#L508)      | P1  | 1     |
| F33 | **No tests cover webhook ingestion, import, or the thread summary.** Only signature verification and send-error mapping are tested.                                                                                  | `_shared/metaWebhookVerify_test.ts`, `_shared/metaInboxSendErrors_test.ts`                                                                                                      | P1  | all   |

## Meta platform rules (checked 2026-11-09)

These rules shape both the design and the host-facing copy.

| Rule                                                                                                                                                                                                                                                            | What it means for us                                                                                                                     | Source                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Webhook POSTs need a `200 OK` within 5 seconds. Failures are retried "a few more times". After 15 minutes the developer gets an alert. After 1 hour the app is unsubscribed from the Page or Instagram account.                                                 | Acknowledge fast and process later. Re-subscribing alone is not enough: events from the outage are never resent, so we must reconcile.   | [Messenger webhooks](https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks)                                                                                                                                                 |
| Events may arrive out of order. Use the event `timestamp`.                                                                                                                                                                                                      | Thread summary updates must only move forward.                                                                                           | same                                                                                                                                                                                                                                                               |
| Advanced Access (App Review) is required to receive webhooks from, and read conversations with, people who have no role on the app.                                                                                                                             | Without it, real guests never appear. This is configuration, not code.                                                                   | same, and [Conversations API](https://developers.facebook.com/documentation/business-messaging/messenger-platform/conversations)                                                                                                                                   |
| The Conversations API returns details for only the 20 most recent messages in a conversation. Older ones return a "deleted" error.                                                                                                                              | History from before connect is capped at 20 per chat. After connect we capture everything live, so the cap only matters for old history. | Conversations API, [Conversation reference](https://developers.facebook.com/docs/graph-api/reference/conversation/)                                                                                                                                                |
| Conversations in the Requests folder that have been inactive for 30 days are not returned.                                                                                                                                                                      | Old Instagram message requests do not import.                                                                                            | Conversations API                                                                                                                                                                                                                                                  |
| Instagram messaging requires the app to be owned by a verified business.                                                                                                                                                                                        | Check Business Verification in Phase 0.                                                                                                  | Conversations API                                                                                                                                                                                                                                                  |
| With no routing configured, every connected app receives messaging webhooks. When Meta Business AI owns a chat, other apps receive it on `standby`, and untagged sends fail with error `10` / subcode `2018300`. `GET /{page-id}/thread_owner` shows the owner. | Subscribe to and store `standby`. Explain ownership in the thread. Map the error.                                                        | [Conversation routing](https://developers.facebook.com/documentation/business-messaging/messenger-platform/conversation-routing)                                                                                                                                   |
| Instagram sends `messaging_seen` for reads and `is_deleted: true` when a guest unsends. In Development Mode, webhooks go only to people with a role on the app.                                                                                                 | Handle both. Phase 0 confirms the app mode.                                                                                              | [Instagram messaging webhooks](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/webhooks)                                                                                                                                      |
| Available fields include `standby`, `messaging_handovers`, `message_reactions`, `message_edits`, `messaging_postbacks`, `messaging_referrals`, `message_reads`, `message_deliveries`. App-level subscriptions can be managed with `/app/subscriptions`.         | Subscribe to what we use, drop what we do not, and keep the dashboard configuration in code.                                             | Messenger webhooks                                                                                                                                                                                                                                                 |
| Graph API v21.0 is reported to stop working on 2027-01-21. v26.0 shipped on 2026-07-29, and its removals apply to every supported version from 2026-10-27.                                                                                                      | Bump the version in Phase 1, after reading the Messenger and Instagram entries in the changelog.                                         | [Versions](https://developers.facebook.com/docs/graph-api/changelog/versions) (the date comes from secondary sources, confirm on the live page), [v26 post](https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/) |
| Standard 24-hour reply window. The `HUMAN_AGENT` tag allows non-promotional replies up to 7 days.                                                                                                                                                               | Existing behavior. Confirm the app is approved for the tag before showing the toggle.                                                    | existing route guide                                                                                                                                                                                                                                               |

**Still to verify in Phase 0:** the exact name and location of Instagram's message access setting (expected: Instagram app, Settings, Privacy, Messages, Connected tools, "Allow access to messages"), whether the app is approved for `HUMAN_AGENT`, which conversation fields exist per platform (`message_count`, `unread_count`, `can_reply`, `link`), and whether multi-ID reads (`GET /?ids=`) work for conversations.

## Target design

### Principles

1. **Webhooks are the fast path. Reconciliation is the safety net.** This amends the rule "Conversations API backfill on connect only; do not poll in a loop" ([`social-inbox.mdc:57`](../../../.cursor/rules/social-inbox.mdc#L57)) to: webhook-first, plus a bounded, adaptive reconciliation per Page that scans `updated_time` cheaply. No unbounded polling, and no Graph paging driven by the browser.
2. **Persist before acknowledging, acknowledge before working.**
3. **One writer.** Webhooks, reconciliation, import, and Kame sends all write through the same idempotent database function.
4. **The server owns sync state.** The browser never holds a Graph URL and never drives paging.
5. **Signals, not rows, over realtime.** Broadcast payloads carry ids and timestamps. Content is always read through the permission-checked edge path, the same model as the activity log broadcast.
6. **Patch, do not refetch.**
7. **Honest UI.** Show what Meta allows, label gaps, never fake an edit.

### Flow

```
Meta (Page, Instagram)
  │  signed POST, batched, unordered
  ▼
meta-inbox-webhook ── verify signature ── meta_webhook_events (one row per event,
  │                                        ON CONFLICT (event_key) DO NOTHING) ── 200 OK
  │ waitUntil
  ▼
processor ── claim (SKIP LOCKED) ── inbox_apply_meta_*() ──► social_conversations
  ▲             │ retry, backoff, dead letter      │          social_messages
  │             │                                  ├─► notifications, Telegram, auto-reply
pg_cron 1 min   │                                  │    (only for newly inserted inbound)
(SQL-gated)     ▼                                  └─► realtime.send('inbox:org:<id>', ids only)
  └──► meta-inbox-worker ── import / reconcile / deepen / repair            │
           │  (Conversations API, cursor + watermark in meta_sync_state)   ▼
           └──────────────────────────────────────────────────► browser: private channel
                                                                 → delta fetch → patch cache
                                                                 + catch-up on focus, online,
                                                                   resubscribe
```

### 1. Ingestion

`meta-inbox-webhook` keeps GET verification and the signature check. The POST path becomes:

1. Verify `X-Hub-Signature-256` (unchanged).
2. Map `object` to platform: `page` to `facebook`, `instagram` to `instagram`. Anything else is logged and acknowledged.
3. Flatten `entry[].messaging[]` and `entry[].standby[]` into one row per event: `entry_id`, `channel` (`messaging` or `standby`), `event_type`, `event_key` (Appendix C), `event_time`, and the raw event JSON.
4. One RPC, `meta_webhook_enqueue(events jsonb)`, inserts all rows with `ON CONFLICT (event_key) DO NOTHING` and returns the new ids.
5. Return 200. If the insert itself fails (database down), return 500 so Meta retries. Reconciliation covers anything Meta gives up on.
6. `runAfterResponse` processes the new ids.

Static imports in the entrypoint shrink to config, signature check, and the enqueue call. The processor, which pulls in AI, Telegram, and notifications, is imported dynamically inside the background task so cold starts stay small.

### 2. Processing and the single writer

- **Claim:** `meta_webhook_claim(ids, limit)` locks due rows with `FOR UPDATE SKIP LOCKED` and sets `status = 'processing'` with a 2-minute lock.
- **Route by type:** message, echo, postback, read (Messenger watermark), seen (Instagram message id), reaction, edit, handover, referral. Deliveries are no longer subscribed. Unknown types are kept as `skipped` for analysis.
- **Connection lookup** by `(entry_id, platform)`, cached per isolate for 60 seconds.
- **Own-app echoes** (`message.app_id` equals our app id) wait 15 seconds before first processing, so the send path's row exists first. The merge handles either order anyway.
- **Side effects** (in-app and push notification, Telegram, auto-reply) run only when the write reports a newly inserted inbound message. Retries and reconciliation never notify twice. `standby` messages never trigger auto-reply.
- **Failures:** `attempts + 1`, `status = 'retry'`, backoff of 30 s, 2 min, 10 min, 1 h, 6 h. After 6 attempts the row becomes `dead` with a Sentry capture fingerprinted by error code. Dead rows can be replayed from `/admin/health`.
- **Guest names and avatars** for new threads are fetched in the same background task (at most 4 in flight), never before the acknowledgement. Meta CDN avatar URLs expire, so they refresh lazily when older than 7 days.

**`inbox_apply_meta_message(p jsonb)`**, `SECURITY DEFINER`, executable by `service_role` only:

- Inputs: org, connection, platform, thread key, guest id, direction, Meta message id, text, normalized attachments, kind, `sent_at`, `source` (`webhook`, `reconcile`, `import`, `kame_send`), `sender_app` (`kame`, `meta`, `other`), `routing` (`messaging`, `standby`), and optional Kame metadata (`sent_by_user_id`, `is_ai_generated`, `message_tag`, reply fields, template fields, `client_message_id`).
- **Message:** `INSERT ... ON CONFLICT (external_message_id) DO UPDATE` that only fills metadata still null, and attachments only when the stored copy has none. Stored text never regresses.
- **Conversation:** `INSERT ... ON CONFLICT (organization_id, platform, external_thread_id) DO UPDATE` with:
  - `last_message_at = GREATEST(old, new.sent_at)`
  - `subject_preview`, `reply_status`, and `last_message_direction` change only when the new message is the newest
  - inbound: `last_inbound_at` and `messaging_window_expires_at` move forward only; `unread_count + 1` only when the message was newly inserted and is newer than `host_last_read_at`
  - outbound: `reply_status = 'replied'` when newest, unread unchanged
  - guest name and avatar only when empty
  - `external_updated_at = GREATEST(...)`, the per-thread watermark for reconciliation
- Returns `{ conversation_id, message_id, inserted, conversation_created }`.
- Companion functions: `inbox_apply_meta_read` (Messenger watermark sets `read_at` on outbound messages up to it, plus `guest_last_read_at`), `inbox_apply_meta_seen` (Instagram), `inbox_apply_meta_reaction`, `inbox_apply_meta_edit`, `inbox_apply_meta_unsend`, and `inbox_mark_host_read` (replaces the two-update read path).

Phase 1 ships a smaller `inbox_bump_conversation` (forward-only summary plus atomic unread) used by every current writer, web chat included. Phase 2 folds it into the full function.

### 3. Import and reconciliation

A `meta_sync_state` row exists for each Meta connection: Facebook and Instagram separately, in every scope (org default, property override, parking override).

| Job        | Trigger                                                   | What it does                                                                                                                                                                                                                                                                        | Graph calls                         |
| ---------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| import     | connect, reconnect                                        | Newest-first conversation pages (25 per call, stepping down to 10 then 5 when Meta says the request is too large) with `messages.limit(20)` expanded inline, back to the lookback window (decision D1). Saves only the opaque `after` cursor. Updates progress counters for the UI. | about 1 per 25 conversations        |
| load older | host taps "Load older chats" at the end of the list       | Continues the import cursor past the lookback, one page per tap.                                                                                                                                                                                                                    | 1 per tap                           |
| reconcile  | schedule below, `check_now`, after a webhook re-subscribe | Scans `fields=id,updated_time` 25 at a time until `updated_time` is older than the watermark minus 10 minutes. Changed threads are read with one multi-ID request (`?ids=`, up to 25) using `messages.limit(20)`, then applied through the same function.                           | 1 per platform when nothing changed |
| deepen     | once, after the Phase 3 deploy                            | Brings every existing thread with fewer than 20 messages up to Meta's 20.                                                                                                                                                                                                           | about 1 per 25 threads              |
| repair     | once                                                      | Re-derives direction for the latest 20 messages of each Instagram thread (F12) and merges Facebook threads misfiled as Instagram (F8). Dry-run counts first.                                                                                                                        | as deepen                           |

**Gap rule:** if the latest 20 messages from a reconcile contain none we already have, and the thread had earlier messages, set `history_gap_at`. The thread shows a divider, because Meta will not return anything older.

**Schedule**, stored as `next_run_at`:

| Page state                                   | Reconcile every                  | Notes                                                                    |
| -------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Inbox open in any tab (viewer ping in 2 min) | 2 min                            | plus `check_now` on open and focus, at most once per 60 s per connection |
| Message in the last 24 hours                 | 10 min                           |                                                                          |
| Message in the last 7 days                   | 30 min                           |                                                                          |
| Quiet for longer                             | 6 h                              |                                                                          |
| Just re-subscribed, or webhook unhealthy     | now, then every 2 min for 30 min | looks back 72 hours                                                      |
| Token invalid or permissions removed         | stopped                          | resumes after reconnect                                                  |

**Worker:** `meta-inbox-worker`, called by pg_cron every minute through a SQL gate. The cron job calls `net.http_post` only when outbox rows or sync rows are due, so idle minutes cost no invocations. Connect and `check_now` also kick it directly. Each run has a 40-second budget, claims up to 20 due rows ordered by `next_run_at` with `FOR UPDATE SKIP LOCKED`, allows one active job per connection, rotates across orgs, and keeps 4 Graph calls in flight.

**Rate limits:** read `X-Business-Use-Case-Usage` and `X-App-Usage` on every response. At 75% the Page's intervals double. At 90% everything except `check_now` pauses for that Page until Meta's reported regain time. The value is stored as `rate_limit_pct` and feeds the `meta_graph` metering in [`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md).

**Errors:** token and permission errors set the connection to `status = 'error'` with a reason code and stop scheduling. Transient errors back off.

### 4. Read APIs

- `social-inbox-threads` is backed by one function, `inbox_list_threads(...)`: scope, filters, parameterized search, keyset pagination on `(last_message_at, id)`, connection status, and property name in a single query. A new `changed_since` mode returns only threads updated after a cursor, plus `server_time`. `resolveMetaHasMore` and its "more than 80 local threads" heuristic go away.
- `social-inbox-messages` gains an `after` mode with a cursor on `(updated_at, id)`, which covers inserts and updates such as reads, edits, and reactions. GET never calls Graph. A new `refresh_media` action re-fetches one message's attachment URLs when an image fails to load.
- `meta-inbox-sync` (new) replaces `meta-inbox-backfill` with `status`, `check_now`, and `load_older`. It never accepts or returns a Graph URL. `meta-inbox-backfill` stays for one release as a shim for cached PWA bundles and ignores any `nextUrl` it receives.
- `meta-inbox-status` adds the sync summary the status pill needs: import progress, last check with Meta, health, whether Business AI or another app owns chats, and whether an Instagram message-access error was seen.
- Delta cursors overlap by 30 seconds and the client patch is idempotent. `updated_at` comes from `now()` at transaction start and commits can land out of order, so a strict cursor would miss rows.

### 5. Realtime and catch-up

- **One private Broadcast topic per org,** `inbox:org:<org_id>`, emitted by triggers through `realtime.send`, following `activity_log_broadcast` and wrapped so it can never fail a write. Payload: `{ v, kind, conversation_id, connection_id, property_id, parking_id, platform, at }`. No names or message text. Realtime keeps a short-lived copy in `realtime.messages`, so this keeps guest content out of it.
- **Triggers:** AFTER INSERT or UPDATE on `social_conversations` (every new message updates the summary, so one signal per message) and AFTER UPDATE on `social_messages` (read, edit, reaction, unsend).
- **Authorization:** `private.user_can_read_inbox_broadcast(topic)` admits the org owner, active org members, and active property or parking members in that org, following the `user_can_access_guest_submission_*` helpers. Coarse access is fine because the payload carries no content. The follow-up fetch enforces `inbox:view` for the scope. This also fixes F18.
- **Client:** one channel per tab. Signals outside the tab's scope are ignored. In-scope signals are debounced 250 ms, then one `changed_since` call patches the thread list. If the signal's thread is open, one `after` call patches the messages.
- **Catch-up:** on channel resubscribe, on `visibilitychange` to visible, on `online`, and a 5-minute safety delta while the tab is visible.
- **Degrade:** three channel errors within five minutes switch the tab to a 30-second delta poll while visible, until the channel recovers. This is the fallback the cost plan's A16 degrade mode already describes.
- **Removed:** host-side Postgres Changes bindings (org and per-thread) and the public `chat-sync:<id>` channel for the host inbox. Read receipts ride the org signal.

### 6. Sending

- **Insert first.** The send path writes the outbound row (`delivery_status = 'sending'`, `client_message_id` from the composer or the offline outbox) before calling the Send API, then sets `external_message_id` and `sent`, or `failed` with the Graph error code. The echo merges into the same row.
- **Errors mapped by `code` and `error_subcode`,** not by substring: window closed, Business AI owns the chat (`10` / `2018300`), person unavailable (`551`), token invalid (`190`, which also flags the connection), rate limits, missing permission or App Review.
- **No automatic retry after Meta may have accepted the message.** Today a 5xx response is retried, which can double-send. Retry only on network errors before a response and on explicit rate-limit codes. Otherwise the message shows "Not sent" with a Retry button.
- **Edit and Unsend are removed for Facebook and Instagram,** and the server rejects them.
- **The `HUMAN_AGENT` toggle shows only when the app is approved,** based on a server flag set from Phase 0 findings.

## Data model changes

All changes are new migrations. Shipped migrations are never edited.

| Object                                                | Change                                                                                                                                                                                                                                                                                                                          | Phase  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `social_channel_connections.meta_backfill_next_url`   | set to null everywhere (it holds tokens)                                                                                                                                                                                                                                                                                        | 1      |
| `inbox_bump_conversation()`                           | new function: forward-only summary and atomic unread                                                                                                                                                                                                                                                                            | 1      |
| `meta_webhook_events`                                 | new outbox: `event_key` unique, `entry_id`, `object`, `channel`, `event_type`, `payload`, `status`, `attempts`, `next_attempt_at`, `locked_until`, `last_error`, `received_at`, `processed_at`. Deny-all RLS, service role grants                                                                                               | 2      |
| `meta_webhook_enqueue/claim/complete/fail()`          | new functions                                                                                                                                                                                                                                                                                                                   | 2      |
| `inbox_apply_meta_*()`                                | new functions (section 2)                                                                                                                                                                                                                                                                                                       | 2      |
| `social_messages`                                     | `client_message_id` (unique), `source`, `sender_app`, `routing`, `reactions jsonb`, `send_error_code`; wider `message_kind` values (`postback`, `unsupported`, `story_reply`, `share`)                                                                                                                                          | 2      |
| `meta-inbox-worker-every-minute` cron                 | new, SQL-gated, heartbeat row in `system_job_heartbeats`                                                                                                                                                                                                                                                                        | 2      |
| `meta_sync_state`                                     | new: `connection_id` unique, `platform`, import cursor and counters, `watermark`, `next_run_at`, `lock_until`, `consecutive_failures`, `last_error_code`, `rate_limit_pct`, `last_viewed_at`                                                                                                                                    | 3      |
| `social_conversations`                                | `external_updated_at`, `history_imported_at`, `history_gap_at`, `meta_message_count`, `thread_owner`, `last_message_direction`, `profile_refreshed_at`                                                                                                                                                                          | 3      |
| `social_messages.updated_at`                          | new column and trigger                                                                                                                                                                                                                                                                                                          | 4      |
| Indexes                                               | conversations `(organization_id, updated_at)` and `(connection_id, last_message_at DESC, id)`; messages `(conversation_id, updated_at, id)`; `meta_webhook_events (status, next_attempt_at)`; `meta_sync_state (next_run_at)`; trigram on `participant_name` and `subject_preview` (measure before adding a message-body index) | 2 to 4 |
| Broadcast trigger, `realtime.messages` policy, helper | new                                                                                                                                                                                                                                                                                                                             | 4      |
| `inbox_list_threads()`                                | new function                                                                                                                                                                                                                                                                                                                    | 4      |
| Legacy                                                | drop `meta_backfill_*` columns and `social_webhook_events`. After guest web chat moves to Broadcast: `REPLICA IDENTITY DEFAULT` and remove both tables from `supabase_realtime`                                                                                                                                                 | 8      |

## Cost and scale

### Estimated load per 1,000 guest messages

Assumptions: 1,000 guest messages and 1,000 host replies, a quarter of messages land while the org has an inbox tab open, one tab. These are estimates from reading the code. Phase 0 replaces them with measurements and Phase 8 re-measures.

| Item                                         | Today                          | Target  | Why                                                                                                |
| -------------------------------------------- | ------------------------------ | ------- | -------------------------------------------------------------------------------------------------- |
| Webhook invocations                          | ~4,000                         | ~3,000  | `message_deliveries` no longer subscribed                                                          |
| DB requests on the webhook path              | ~40,000                        | ~15,000 | about 25 calls per message become enqueue, claim, and one function call, plus notification fan-out |
| Edge calls from open tabs                    | ~1,750                         | ~650    | refetching every loaded page becomes one small delta call, two when the thread is open             |
| DB requests from open tabs                   | ~17,500                        | ~2,500  | one list function, no per-call enrichment                                                          |
| Graph calls when a thread opens              | up to 13                       | 0       | enrichment moves to ingestion; media refreshes only when an image fails                            |
| Inbox Postgres Changes bindings per host tab | 2 org-wide + 2 per open thread | 0       | Broadcast instead; removes inbox load from `realtime.list_changes`                                 |

Reconciliation is time-based, not per message. For 100 active Pages on both platforms at a 10-minute interval, that is about 29,000 Graph calls a day (free, rate-limited per Page) and at most 1,440 worker invocations a day platform-wide, about 2% of the 2M monthly invocations included in Pro. Included quotas for reference ([`supabase-capacity.md`](../../architecture/supabase-capacity.md)): 2M edge invocations, 5M Realtime messages, 500 peak Realtime connections, 60 database connections on Micro.

### Guardrails

| Risk                                  | Guardrail                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Burst of webhooks (promo, viral post) | The outbox absorbs it. Each invocation processes a bounded batch. Lag alert in Phase 7.                                                                                               |
| One very large Page                   | Import is paced (at most 4 Graph pages per run, at most 5 imports in flight platform-wide), bounded by the lookback, and older chats load on demand.                                  |
| Many Pages due at the same minute     | SQL gate, claim limit, rotation across orgs, 40-second budget. The next minute picks up the rest.                                                                                     |
| Meta rate limits                      | Header-driven backoff per Page.                                                                                                                                                       |
| Retried or duplicated events          | Idempotent writes. Side effects only on first insert.                                                                                                                                 |
| Realtime connections                  | One channel per tab, no per-thread channels.                                                                                                                                          |
| Database connections (60 on Micro)    | Fewer round trips through functions. Bounded concurrency in the worker.                                                                                                               |
| Storage                               | Outbox payloads stripped after 24 hours and rows deleted after 14 days (dead rows kept 30 days). Message retention is decision D5.                                                    |
| Runaway cost or a bad deploy          | `inbox.meta.sync` availability key pauses import and reconciliation (webhooks keep storing). An interval multiplier setting. `META_INBOX_PIPELINE=legacy` rolls back for one release. |
| Webhook cold starts                   | Minimal static imports in the entrypoint.                                                                                                                                             |

### Caching

- **Per isolate:** connection by `(entry_id, platform)` for 60 seconds, feature availability (existing), and the inbox access context reused within a request.
- **Database as the cache for Meta data:** guest names and avatars with `profile_refreshed_at`. Attachment URLs refresh only when they fail.
- **Client:** TanStack Query cache patched in place from deltas. The PWA persisted cache stays. No invalidate-all.
- **Not cached:** anything permission-sensitive across users.

### Not adding

- **Redis or another cache or queue service.** Rejected in the 2026-09-21 modernization plan. Postgres handles this volume.
- **pgmq.** A plain outbox table is enough at expected volume and is easier to inspect and replay. Revisit above roughly 1M events a day.
- **Polling as the main path, or client-driven Graph paging.**

## Phases

Sizes are rough: S is 1 to 2 days, M is 3 to 5, L is 5 to 8.

### Phase 0: Confirm causes and baseline (S, mostly operator work, no product code)

- [ ] **0.1** Meta app audit (needs Meta dashboard access): app mode; access level for `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`, `instagram_basic`, `instagram_manage_messages`, `business_management`; Business Verification; `HUMAN_AGENT` approval; app-level webhook subscriptions for `page` and `instagram` (callback URL, fields, active) from the dashboard or `GET /app/subscriptions` with the app token; whether local development uses the same app (F1, F2, F4).
- [ ] **0.2** For the owner's own Page first, then each connected Page: Conversation Routing default app, Meta Business AI status, other connected messaging apps, the Instagram message access setting, `GET /{page-id}/subscribed_apps` fields, and `/debug_token` scopes and `data_access_expires_at` (F3, F6).
- [ ] **0.3** Parity sample: 10 recent Business Suite threads (5 Facebook, 5 Instagram). For each, compare message count, last message time, direction of each message, and whether the thread exists in Kame. Record a baseline parity score.
- [ ] **0.4** Run the aggregate queries in Appendix A on production through a read-only role. Counts only, no message text, names, or ids.
- [ ] **0.5** Edge logs for the last 7 days: `meta-inbox-webhook` invocations per day, p50 and p95 duration, non-2xx count; `meta-inbox-backfill` errors; `social-inbox-threads` and `social-inbox-messages` invocations and p95.
- [ ] **0.6** Graph spike against a test Page and Instagram account: conversation fields per platform; multi-ID reads; `GET /{page-id}/thread_owner`; payloads for `messaging_seen`, `is_deleted`, `message_edits`, `message_reactions`, postbacks, and `standby`; error codes for a closed window, Business AI ownership, an invalid token, and rate limits; confirm `paging.next` carries `access_token`.
- [ ] **0.7** Save scrubbed payloads from 0.6 as fixtures under `supabase/functions/_shared/fixtures/meta/`.
- [ ] **0.8** Fill the Evidence table below, mark each finding confirmed or refuted, and re-rank.

**Done when:** every finding F1 to F33 is confirmed or refuted with evidence, and the baseline parity score and webhook metrics are recorded.

**If 0.1 shows Standard Access or Development mode:** App Review comes first (screencast steps are in [`meta-app-review.md`](../../archive/operations/meta-app-review.md)). Phases 1 and 2 still go ahead in parallel, because they fix real loss and the token leak regardless.

### Phase 1: Stop data loss and close the token leak (M, on the current design)

- [x] **1.1 (F25, P0)** Never expose Graph URLs. `fetchMetaConversationsPage` returns the `after` cursor only and the server builds every URL. `meta-inbox-backfill` drops `nextUrl` from its response and ignores it in requests. A migration nulls `meta_backfill_next_url`. Rate-limit the `light` path. Then act on decision D6.
- [x] **1.2 (F8)** Platform comes from `payload.object` only.
- [x] **1.3 (F7, F9)** Stop marking events before processing. `insertMessageIfNew` is already idempotent on `external_message_id`, so the pre-mark can go. Wrap each event in its own try/catch with a Sentry capture so one bad event cannot fail the batch.
- [x] **1.4 (F12)** Outbound detection uses the account's own ids (`meta_page_id`, `meta_ig_user_id`, `external_account_id`) for direction, reply status, and last inbound time.
- [x] **1.5 (F14)** Add `inbox_bump_conversation` and use it from the webhook, import, send, web chat, and AI auto-reply paths. Remove `unread_count: 0` from upsert payloads.
- [x] **1.6 (F15)** Messenger reads set `read_at` on outbound messages up to the watermark and set `guest_last_read_at`. They never touch the host's unread count.
- [x] **1.7 (F21)** Hide Edit and Unsend for Facebook and Instagram in the conversation view, and reject them in `social-inbox-messages`.
- [x] **1.8 (F16)** `meta-inbox-backfill` loads the org-default connection through the scoped helper instead of `.maybeSingle()` across all rows.
- [x] **1.9 (F3, F24)** Map send errors by `code` and `error_subcode`, including `10` / `2018300` (Business AI), closed window, `190` (also sets the connection to `error`), `551`, and rate limits. Keep the text fallback.
- [x] **1.10 (F32)** Bump `META_GRAPH_VERSION` to the current version after reading the Messenger and Instagram changelog entries since v21.0. Build the OAuth dialog URL from the constant. Coordinate with Marketing publishing, which shares the connection.
- [x] **1.11 (F18, F19, interim)** Inbox queries refetch on window focus and on `online`. When the realtime channel reports `SUBSCRIBED` after an error, invalidate the thread list. For users who are neither org owner nor org admin, poll the thread list every 60 seconds while the tab is visible, until Phase 4 replaces this.
- [x] **1.12** Deno tests with fixtures for 1.2 to 1.6 and 1.9.

**Acceptance (Phase 1):**

| Check                       | Command                                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| Deno unit + handler tests   | `bun run test:edge` and `bun run test:edge:handlers`                              |
| Type check                  | `bun run type-check`                                                              |
| Lint                        | `bun run lint` (0 errors)                                                         |
| Filenames                   | `bun run check:filenames`                                                         |
| No Graph URL leaves the API | `bun run test:edge` — assertion in `metaInboxGraph_test.ts` and a handler test    |
| Token column is empty       | migration `20261325120000_meta_inbox_cursor_and_token_scrub.sql` nulls the column |

**Done when:** tests pass; the fixture scenarios produce no misfiled or duplicated messages; no API response contains a Graph URL (asserted in a test); `meta_backfill_next_url` holds no tokens in production.

**Phase 1 outcome (2026-11-10).** Shipped. Notes on what actually landed:

| Item | What shipped                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | `metaInboxGraphPaging.ts` builds every Graph URL and returns only the `after` cursor. `extractMetaPagingCursor` refuses a paging URL that is not on `graph.facebook.com`. The cursor lives on **`social_channel_connections.meta_backfill_cursor`**. The endpoint takes and returns no Graph URL. The `light` path has its own rate-limit budget. |
| 1.2  | `metaInboxEvents.ts#platformFromMetaObject` maps `page` to Facebook and `instagram` to Instagram. An unknown object is acknowledged and dropped.                                                                                                                                                                                                  |
| 1.3  | The dedupe row is written after the message lands. `insertMessageIfNew` returns the inserted row so a redelivery is distinguishable from a first delivery. Each event is wrapped and captured, so one bad event cannot fail the batch.                                                                                                            |
| 1.4  | `metaSelfAccountIds` collects `meta_page_id`, `meta_ig_user_id` and `external_account_id`. Used by the webhook handler and the import.                                                                                                                                                                                                            |
| 1.5  | `inbox_bump_conversation` is the single writer for the summary. Every writer (webhook, import, send, web chat, AI auto-reply) goes through it. `unread_count: 0` is gone from the upsert payloads.                                                                                                                                                |
| 1.6  | The read watermark marks the host's outbound messages read and moves `guest_last_read_at`. The host's unread badge is untouched.                                                                                                                                                                                                                  |
| 1.7  | Edit and Unsend are hidden on Meta threads and rejected by the server. Website chat keeps both.                                                                                                                                                                                                                                                   |
| 1.8  | The org-default connection resolves through `getOrgDefaultFacebookConnection`, so a property or parking override no longer breaks the lookup.                                                                                                                                                                                                     |
| 1.9  | `MetaGraphError` carries the Graph `code` and `error_subcode`. Business AI (code 10, subcode 2018300) has its own copy. An invalid token sets the connection to `error`. A 5xx is no longer retried, because Meta may already have accepted the message.                                                                                          |
| 1.10 | `META_GRAPH_VERSION` is `v26.0`. The OAuth dialog URL is built from the same constant.                                                                                                                                                                                                                                                            |
| 1.11 | The threads endpoint returns `realtimeSupported`. The list refetches on focus, on reconnect and on a channel re-subscribe. A caller without org-wide realtime polls every 60 s while the tab is visible.                                                                                                                                          |
| 1.12 | 28 new Deno tests across `metaInboxEvents_test.ts`, `metaInboxGraphError_test.ts`, `metaInboxGraphPaging_test.ts`, `metaInboxBackfill_test.ts` and `metaInboxSendErrors_test.ts`.                                                                                                                                                                 |

**Known cost of the interim poll.** The threads query is an infinite query, so the 60-second fallback poll refetches every loaded page, not just the first. A member with one page of 40 threads pays one request a minute; a member who has scrolled to five pages pays five. Phase 4 replaces the whole mechanism with one Broadcast signal plus a delta fetch, so this is deliberately not optimised further here.

**Still open from Phase 1:** D6 (ask the affected orgs to reconnect after the token leak) is operator work and needs the edge logs for `light` backfill calls by non-owner users. Phase 0 (the Meta app audit and the parity sample) is still operator work and blocks the parity target, not the code.

### Phase 2: Durable webhook pipeline (L)

- [x] **2.1** Migration for `meta_webhook_events` and the enqueue, claim, complete, and fail functions.
- [x] **2.2** `meta-inbox-webhook`: verify, flatten `messaging` and `standby`, enqueue, return 200. Trim static imports and load the processor dynamically in `runAfterResponse`.
- [x] **2.3** `_shared/metaInboxEvents.ts`: pure parsers per event type that turn raw payloads into one normalized event type. Fully unit-tested against fixtures.
- [x] **2.4** `_shared/metaInboxProcessor.ts`: claim, route, apply, retry with backoff, dead letter, own-app echo delay, guest profile queue, notifications only on insert.
- [x] **2.5** `inbox_apply_meta_message` and companions (section 2). Fold in `inbox_bump_conversation`.
- [x] **2.6** Insert-first sends with `client_message_id`, echo merge, failure codes, and no retry after Meta may have accepted (section 6). Inline "Not sent" with Retry in the thread.
- [x] **2.7** Webhook fields. Page: `messages`, `message_echoes`, `messaging_postbacks`, `message_reads`, `message_reactions`, `message_edits`, `standby`, `messaging_handovers`, `messaging_referrals` (drop `message_deliveries`). Instagram: the equivalents confirmed in 0.6 (`messages`, `messaging_postbacks`, `messaging_seen`, `message_reactions`, `messaging_referral`, `standby`, `messaging_handover`). Add `scripts/meta/sync-app-subscriptions.ts`, which applies the app-level subscription through `/app/subscriptions` with the app token, and update [`meta-app-review.md`](../../archive/operations/meta-app-review.md) to match.
- [x] **2.8** `meta-inbox-worker-every-minute` cron with the SQL gate, plus a heartbeat in `system_job_heartbeats`.
- [x] **2.9** Retention in `prune_operational_tables()`: strip payloads from done and skipped rows after 24 hours, delete them after 14 days, keep dead rows 30 days.
- [x] **2.10** One-time migration that re-keys any legacy thread ids, so the per-event `migrateLegacyDmThreadId` calls can be removed.
- [ ] **2.11** Tests: parser fixtures for every type; processor retry, dead letter, echo delay, duplicate delivery, out-of-order delivery; database function behavior against the local stack; the burst test in Appendix D.

**Done when:** webhook acknowledgement p95 is under 300 ms on hosted; a forced processor failure is retried and applied with nothing lost; a duplicate POST changes nothing; standby and postback messages appear in threads; the burst test sends 3,000 events in 60 seconds with none lost and processing lag p95 under 10 seconds.

### Phase 3: Server-owned import and reconciliation (L)

- [x] **3.1** Migration for `meta_sync_state`, the new `social_conversations` columns, and indexes. Create a state row for every existing Meta connection.
- [x] **3.2** `meta-inbox-worker` runs `import`, `reconcile`, `deepen`, and `repair` within its time budget (section 3).
- [x] **3.3** Import for every scope, property and parking overrides included: newest first, lookback from D1, 20 messages per chat, progress counters. "Load older chats" continues the same cursor.
- [x] **3.4** Reconciliation: header scan, multi-ID message read, gap rule, adaptive `next_run_at`, rate-limit headers, connection errors.
- [x] **3.5** `meta-inbox-sync` with `status`, `check_now` (at most once per 60 seconds per connection), and `load_older`. Turn `meta-inbox-backfill` into a shim.
- [x] **3.6 (F4, F5)** Health check additions: the app-level subscription is active and its callback URL is the production URL. After any re-subscribe, schedule an immediate 72-hour look-back reconcile.
- [ ] **3.7** One-time jobs for existing data: deepen every Meta thread with fewer than 20 messages; repair Instagram direction for the latest 20 messages per thread; detect and merge Facebook threads misfiled as Instagram. Report dry-run counts before writing.
- [x] **3.8** Client: remove the `useMetaInboxSync` chunk driver and the light scroll sync. Call `check_now` on inbox open and on focus.
- [x] **3.9** Metrics per run: Pages checked, threads changed, messages inserted by reconciliation (which the webhooks missed), Graph errors by code, highest rate-limit percentage.
- [x] **3.10** Tests with a Graph fake (`fetch` stub): no changes costs one call; a changed set; paging stops at the watermark; the 20-message gap; rate-limit backoff; invalid token; Instagram self ids; an override Page import.

**Done when:** connecting a Page with the tab closed completes the import; a webhook outage, simulated by unsubscribing the app, is fully recovered after re-subscribe without a reconnect; the parity sample scores at least 99%.

### Phase 4: Realtime v2 and catch-up (L)

- [x] **4.1** Migration for the broadcast trigger function (wrapped so it never fails a write), the private `inbox:org:<org_id>` topic, `private.user_can_read_inbox_broadcast(topic)`, and the `realtime.messages` policy.
- [x] **4.2** `social_messages.updated_at` with a trigger, and the delta indexes.
- [x] **4.3** Delta APIs: `changed_since` for threads (returns `server_time`) and `after` for messages, with the 30-second overlap.
- [ ] **4.4 (F27)** `inbox_list_threads` replaces the PostgREST chains and per-call enrichment. Search becomes a parameter.
- [x] **4.5** `useInboxRealtime` v2: one private channel, signal to debounced delta to cache patch, open-thread delta, catch-up triggers, 5-minute safety delta, degrade to a 30-second delta poll.
- [ ] **4.6 (F26)** Remove host-side Postgres Changes bindings. Move host read receipts off the public `chat-sync` channel onto the org signal.
- [x] **4.7 (F20)** No Graph calls in `social-inbox-messages` GET. Add `refresh_media` and retry it when an image fails to load.
- [ ] **4.8** Measure before and after: Realtime messages per day, the inbox share of `realtime.list_changes`, edge calls per message, message-to-screen p95.
- [x] **4.9** Tests: Vitest for the cache patch reducers (pure functions); Playwright with mocked APIs for a signal moving a row to the top, offline-to-online catch-up, and a property member receiving live updates.

**Done when:** property members get live updates; cutting the socket for 2 minutes and restoring it shows every missed message within 5 seconds; host inbox pages hold zero Postgres Changes bindings.

### Phase 5: Host clarity: how it works, status, and limits (M)

Takes over [`dashboard-contextual-help.md`](../in-progress/dashboard-contextual-help.md) items P7.1 and P7.2 for the inbox. Mark them there in the same PR.

- [ ] **5.1** Sync status pill in the page header at every breakpoint (states in the Host experience spec).
- [ ] **5.2** Channels health card per account, with one action per problem row.
- [ ] **5.3** "How this inbox works" sheet, a bottom sheet on phones.
- [ ] **5.4** In the thread: history divider, gap divider, source chips, Seen state, cards for unsupported types with an open-in-Meta link, a Business AI or other-app banner, inline "Not sent" with Retry, clearer reply window chip.
- [ ] **5.5** Replace the blocking sync modal with a non-blocking import banner and progress in Channels.
- [ ] **5.6** Empty states per platform: not connected, importing, connected with no messages, filtered empty, paused by super-admin (existing).
- [ ] **5.7** Show the support follow-up toggle only when the app is approved for `HUMAN_AGENT`.
- [ ] **5.8** Copy pass with `human-copy` and `minimal-ui-copy`. Mobile pass with `mobile-responsive`.
- [ ] **5.9** Playwright with mocked states for every pill state, the sheet, dividers, and chips. Accessibility: status changes announced in a polite live region, sheet focus handling.

**Done when:** every limit in "Meta platform rules" has an accurate, visible explanation where the host meets it; route guides and the FAQ are updated.

### Phase 6: Messaging parity details (M)

- [x] **6.1** Postbacks and ice breakers stored as guest messages (`message_kind = 'postback'`).
- [x] **6.2** Reactions, guest edits, Instagram unsends, reply-to links, story replies and mentions, shares, stickers, and likes as normalized kinds with display rules.
- [x] **6.3** Send images and files to Messenger and Instagram through Send API attachment URLs, reusing `upload-inbox-chat-asset`, with URLs that stay valid long enough for Meta to fetch them.
- [x] **6.4** Optional `mark_seen` when the host opens a thread (decision D3).
- [x] **6.5** Store the referral source (ads, `m.me` links) on the conversation for later attribution.
- [x] **6.6** Clear Kame's unread count when Meta reports a Messenger thread as read elsewhere, if 0.6 confirms `unread_count` is available.
- [x] **6.7** Fixture tests per kind and UI rendering tests.

**Done when:** the parity sample finds no message type that Business Suite shows and Kame hides without a placeholder.

### Phase 7: Observability and alerting (S to M)

- [ ] **7.1** `/admin/health` Meta inbox panel: app subscription state, Pages with webhook problems, token errors, outbox backlog and lag, dead letters with Replay, reconciliation miss rate, highest Graph rate-limit percentage.
- [ ] **7.2** Sentry alerts: any dead letter; lag p95 over 60 seconds for 10 minutes; miss rate over 2% for a Page in a day; app subscription inactive; callback URL mismatch.
- [x] **7.3** Activity log: `integrations.meta_sync_degraded` and `integrations.meta_sync_recovered` (system actor, debounced per connection) and `integrations.meta_import_completed`. Guest messages themselves are not audit events.
- [x] **7.4** A section in the existing weekly ops report: parity and miss rate, lag, backlog, top Graph error codes.
- [x] **7.5** Runbook `docs/archive/operations/meta-inbox-sync-runbook.md`: webhooks disabled, invalid token, App Review downgrade, Business AI conflict, replaying dead letters, forcing a reconcile.

**Done when:** an injected failure in each category raises the right alert within 15 minutes.

### Phase 8: Cleanup, cost check, docs (S)

- [x] **8.1** Drop `meta_backfill_*` columns, `social_webhook_events`, the `meta-inbox-backfill` shim (after one release), and the Meta scroll-sync helpers in `inboxThreadPagination.ts`.
- [ ] **8.2** Move guest web chat realtime (`useGuestChat.ts`) to Broadcast, then set `REPLICA IDENTITY DEFAULT` and remove both tables from `supabase_realtime`.
- [ ] **8.3** Re-measure the cost table and compare against targets. Tune intervals.
- [x] **8.4** Decide message retention (D5) with a storage projection.
- [x] **8.5** Docs (list below), then `check:support-content` and `check:ai-knowledge-coverage`.
- [ ] **8.6** `/workflow-done` and intake scratchpad sync.

### Order and parallel work

Phase 0 and Phase 1 start together. Phase 2, then 3, then 4. Phase 5 can start once Phase 3 exposes sync status; the "How this inbox works" sheet and hiding Edit and Unsend do not need to wait. Phase 7 alerts can start with Phase 2. Phase 6 follows Phase 2. Phase 8 is last.

## Host experience spec

Copy below is a draft for the Phase 5 copy pass: short, plain, no em dashes.

### Status pill

| State           | When                                                                   | Pill                | Detail (tap or hover)                                                                                             | Action         |
| --------------- | ---------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------- |
| Live            | channel connected, webhooks healthy, last check with Meta under 15 min | Live                | New messages arrive in seconds. Last checked with Meta 2 min ago.                                                 | none           |
| Importing       | import running                                                         | Importing 120 chats | Bringing in your recent chats. You can keep working.                                                              | none           |
| Updating        | catch-up or `check_now` running                                        | Updating            | none                                                                                                              | none           |
| Delayed         | webhooks unhealthy, reconciliation working                             | Delayed             | Meta isn't sending live updates right now. We check every few minutes, so new messages can take up to 10 minutes. | Fix connection |
| Offline         | browser offline                                                        | Offline             | You're offline. Replies send when you're back online.                                                             | none           |
| Needs attention | invalid token, permissions removed, or re-subscribe failed             | Reconnect           | We can't read your messages. Reconnect Facebook to fix it.                                                        | Reconnect      |
| Paused          | `inbox.meta.sync` off                                                  | Paused              | existing feature availability copy                                                                                | none           |

### "How this inbox works" sheet

- **What it is:** One place to read and answer guest messages from your Facebook Page, Instagram, and your booking page chat.
- **How messages arrive:** New messages show up here within seconds. We also check with Meta every few minutes, so a missed update gets picked up.
- **Replies:** Replies you send here go out from your Page or Instagram account. Replies you send from Meta Business Suite or the Instagram app show up here too.
- **Meta's limits:**
  - You can reply for 24 hours after the guest's last message. (When approved: up to 7 days, you can send a support follow-up that isn't promotional.)
  - For chats that started before you connected, Meta shares only the latest 20 messages. Older messages stay in Messenger or Instagram.
  - Instagram message requests older than 30 days don't come through.
  - Some message types only open in Meta's apps.
  - Messages sent to Messenger or Instagram can't be edited or unsent.
  - If Meta's Business AI or another app is answering a chat, you'll see it here, but you may need to take over in Business Suite before you can reply.
- **Setup check:** Instagram: turn on Allow access to messages (Instagram app, Settings, Privacy, Messages, Connected tools). Wording confirmed in Phase 0.

### Channels health card (per account)

| Row                | Healthy                                     | Problem                                       | Action              |
| ------------------ | ------------------------------------------- | --------------------------------------------- | ------------------- |
| Account            | Page or Instagram name and photo            | none                                          | none                |
| New messages       | Arriving live                               | Delayed / Stopped                             | Fix connection      |
| Last check         | 2 min ago                                   | Failed, with a plain reason                   | Check now           |
| Chat history       | 340 chats from the last 90 days             | Import paused                                 | Resume              |
| Instagram messages | On                                          | Turn on Allow access to messages in Instagram | How to              |
| Other apps         | hidden                                      | Meta Business AI is answering some chats      | Open Business Suite |
| Replies            | Within 24 hours of the guest's last message | none                                          | How it works        |

### In the thread

| Element            | Copy                                                                                       | Shown when                                             |
| ------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| History divider    | Earlier messages are in Messenger · Open (or Instagram)                                    | thread existed before connect and has more than 20     |
| Gap divider        | Some messages may be missing here · Open in Messenger                                      | `history_gap_at` set                                   |
| Source chip        | Sent from Meta                                                                             | outbound not sent through Kame                         |
| Source chip        | Sent by AI                                                                                 | `is_ai_generated` (existing)                           |
| Seen               | Seen                                                                                       | read receipt covers the message                        |
| Unsupported card   | This message only opens in Instagram · Open                                                | unsupported or partial types                           |
| Business AI banner | Meta Business AI is answering this chat. Take over in Business Suite to reply here. · Open | `thread_owner` is Business AI, or send error `2018300` |
| Failed send        | Not sent · Retry                                                                           | `delivery_status = 'failed'`                           |
| Guest unsent       | Guest unsent a message                                                                     | Instagram `is_deleted`                                 |

### Empty states

| Case                       | Copy                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| Connected, no messages yet | No messages yet. Message your Page from another account to test it. |
| Importing                  | Importing your recent chats                                         |
| Not connected              | existing connect state                                              |

### Mobile

Pill sits in the large-title header. Tapping it opens a bottom sheet with the detail and the action. The Channels health card and the "How this inbox works" sheet are bottom sheets. Dividers and banners stay single-line with a trailing action. Follow `mobile-native-ui.mdc` and the `mobile-responsive` skill.

## Testing

| Layer               | What                                                                                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixtures            | Scrubbed real payloads from Phase 0.6: Messenger inbound text and image, Business Suite echo, Kame echo, Instagram inbound and echo, read watermark, Instagram seen, reaction add and remove, edit, Instagram unsend, postback, story reply, share, unsupported, standby, handover, referral, multi-entry batch. |
| Deno unit           | Parsers, platform mapping, event keys, self-id detection, error mapping, backoff, cursor handling (never a URL), gap rule, schedule calculation, rate-limit header parsing.                                                                                                                                      |
| Database functions  | Forward-only summary, unread counting, idempotency, echo merge, out-of-order inserts, read watermark. Deno integration tests against the local stack, or pgTAP if [`full-app-test-architecture.md`](./full-app-test-architecture.md) lands first.                                                                |
| Worker              | Graph fake covering every Phase 3.10 scenario, time budget, fairness across orgs.                                                                                                                                                                                                                                |
| Vitest              | Cache patch reducers, status pill state derivation, divider placement.                                                                                                                                                                                                                                           |
| Playwright (mocked) | `ui/e2e/features/inbox/`: every pill state, the sheet, dividers, chips, failed send and retry, no Edit or Unsend on Meta threads, catch-up after offline, property member live updates.                                                                                                                          |
| Load                | Appendix D.                                                                                                                                                                                                                                                                                                      |
| Manual              | Appendix B parity checklist with a real Page and Instagram account, at the end of Phases 1, 3, and 6.                                                                                                                                                                                                            |

## Rollout and rollback

- One Supabase project serves production ([`deployment.md`](../../architecture/deployment.md)), so there is no staging database. Develop and test locally against a **separate Meta test app** and test Page (decision D4), then ship to production behind flags.
- Flags: `META_INBOX_PIPELINE` (`legacy` or `v2`) selects the webhook handler for one release; `inbox.meta.sync` pauses import and reconciliation; an interval multiplier slows reconciliation under pressure.
- Migrations stay additive until Phase 8, so rolling back code never needs a down migration.
- Cached PWA bundles keep calling old endpoints for a while. Keep `meta-inbox-backfill` as a shim and keep existing response fields for one release.
- One-time repair jobs (3.7) run with dry-run counts first, and the counts are recorded in this doc.
- Production deploys need the `kamewave` unlock ([`no-prod-deploy.mdc`](../../../.cursor/rules/no-prod-deploy.mdc)).

## Risks

| Risk                                     | Mitigation                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The app lacks Advanced Access            | Phase 0 finds it. App Review is operator work and is the first step if so. Code phases still proceed. |
| Meta changes fields, limits, or versions | Fixtures from real payloads, version bump in Phase 1, health check on app subscriptions.              |
| Rate limits on large Pages               | Adaptive intervals, header backoff, multi-ID reads, paced import.                                     |
| Duplicate notifications during cutover   | Side effects only on first insert, keyed by Meta message id.                                          |
| Broadcast policy mistake                 | Payload holds ids only. Policy tests for allowed and denied users.                                    |
| Realtime silently drops a signal         | Catch-up triggers plus the 5-minute safety delta.                                                     |
| Huge import on an old Page               | Lookback window, pacing, on-demand older chats.                                                       |
| Repair writes something wrong            | Dry run first, limited to the latest 20 messages Meta returns, logged counts.                         |
| Cost higher than estimated               | Phase 0 baseline, Phase 8 re-measure, kill switch, interval multiplier.                               |

## Decisions needed

| #   | Decision                                    | Options                                                                       | Recommendation                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | How much history to import on connect       | all conversations; last 90 days in the background with older chats on demand  | **90 days, older on demand.** Bounded cost on old Pages, and every chat is still reachable.                                                                                                                                                                               |
| D2  | What Disconnect does with history           | always delete (today); keep by default with an explicit "Also delete" option  | **Keep by default, delete as an explicit option.** Meta only re-imports the latest 20 messages per chat, so deleting is permanent loss. This reverses `7fb872508`. Keep the data-deletion path Meta's review expects.                                                     |
| D3  | Mark chats as seen on Meta when opened here | off; on with an org setting to turn it off                                    | **On, with a setting.** Matches what Business Suite does when a host reads a chat.                                                                                                                                                                                        |
| D4  | Meta app for local development              | share the production app; separate test app                                   | **Separate test app.** Removes F4 entirely.                                                                                                                                                                                                                               |
| D5  | Message retention                           | keep everything; fixed window                                                 | **Keep everything for now.** Revisit in Phase 8 when the database passes 50% of the plan's size.                                                                                                                                                                          |
| D6  | Response to the token exposure (F25)        | do nothing beyond the fix; ask every org to reconnect; ask only affected orgs | **Affected orgs only.** After 1.1 ships, check edge logs for `light` backfill calls by users who are not the org owner. Ask those orgs to remove the app in Facebook Business Integrations and reconnect, because a new connection does not invalidate an old Page token. |

## Decisions (execute-plan, 2026-11-10)

Choices made while executing. Each one is reversible except where noted.

| #   | Decision                                                  | Choice                                                                                         | Why                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | How much of the plan one pass covers                      | **Phase 1 only** (1.1 to 1.12)                                                                 | Phases 2 to 8 are L-sized structural reworks (outbox, worker, Broadcast realtime, host copy, parity, observability). Shipping them half-verified is worse than not shipping them. Phase 1 is the P0 phase: it stops message loss and closes the Page-token leak. |
| E2  | Whether Phase 0 blocks Phase 1                            | **No**                                                                                         | Phase 0 is operator work on the Meta dashboard and a production parity sample. The code-level P0 defects (F7, F8, F12, F25) reproduce without it, and the plan already says Phases 1 and 2 proceed in parallel.                                                  |
| E3  | Where the import cursor lives in Phase 1                  | **New `social_channel_connections.meta_backfill_cursor` column**                               | `meta_backfill_next_url` must not hold a URL (it held a token-bearing Graph URL). Reusing it for a cursor leaves a misleading name; Phase 3 replaces both with `meta_sync_state` and Phase 8 drops them.                                                         |
| E4  | How the webhook dedupe row is ordered                     | **Write the dedupe row after the message row**                                                 | Writing it first is exactly F7: a later throw makes Meta's retry look like a duplicate and the message is lost. Writing it last means a failed event is retried, and a duplicate delivery is caught by the message unique index.                                 |
| E5  | How side effects avoid double-firing                      | **`insertMessageIfNew` returns the inserted row, `null` on duplicate**                         | Side effects must run only for a newly inserted inbound message. The current function returns `null` on both paths, so callers cannot tell them apart.                                                                                                           |
| E6  | Graph API version target                                  | **`v26.0`**                                                                                    | Meta's version table confirms v21.0 expires 2027-01-21 and v26.0 (released 2026-07-29) is current. The OAuth dialog URL is built from the same constant so it cannot drift again.                                                                                |
| E7  | How send errors are classified                            | **Typed `MetaGraphError` with `code` and `error_subcode`**                                     | "Business AI owns this chat" is code 10 **with subcode 2018300**. Substring matching cannot express that, and F24 is caused by exactly that. A typed error also lets the caller flag an invalid token (190).                                                     |
| E8  | Where the interim catch-up poll lives                     | **Inbox thread query, 60 s, visible tab only, for members who are not org owner or org admin** | Realtime is gated to org owner and org ADMIN members (F18), so property-level members see a frozen list. Phase 4 replaces this with Broadcast plus delta fetch.                                                                                                  |
| E9  | Unread increment rule in `inbox_bump_conversation`        | **Increment only, never reset, and only past `host_last_read_at`**                             | The current code resets `unread_count` to 0 on every upsert and then adds 1 in a separate read-then-write, so the badge never passes 1 (F14). Guarding on `host_last_read_at` stops a cleared badge from coming back.                                            |
| E11 | Where the guest read watermark is applied                 | **One `inbox_apply_meta_read` function**                                                       | The TypeScript path needed four round trips (connection, conversation, message update, conversation update) and had a read-then-write race. One statement is fewer round trips and correct under concurrency.                                                    |
| E12 | What happens when a webhook write fails mid-batch         | **A bad event is captured and acknowledged; an infrastructure failure returns 500**            | Acknowledging a database outage loses every guest message in the batch with no retry. Every write on this path is idempotent, so letting Meta retry a transient failure is safe.                                                                                 |
| E13 | Which copy wins when a Graph code is ambiguous            | **The message text, for the closed window**                                                    | Meta returns code 10 for a missing permission **and** for a closed 24-hour window. Checking the code first reported a routine expiry as a missing permission, which is the same class of bug F24 describes.                                                      |
| E14 | Whether the import bumps the summary when nothing was new | **Only when at least one message was newly stored**                                            | A scroll-sync page of 25 already-stored threads would otherwise pay 25 summary writes for no change.                                                                                                                                                             |
| E15 | Where the import phase comes from                         | **The connection row, unless the caller forces one**                                           | The client always sent `phase: 'messenger'`, so the stored phase was never used and a scroll-sync never continued into the Instagram pass.                                                                                                                       |
| E10 | Disconnect behaviour                                      | **Unchanged in Phase 1**                                                                       | D2 reverses it, but reversing it is a destructive-path decision for the operator and belongs with Phase 3's `meta_sync_state`, not with a P0 leak fix.                                                                                                           |

## Edge cases

| Case                                                         | Handling                                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meta delivers the same event twice                           | Message insert is unique on `external_message_id`; the second delivery inserts nothing and fires no side effect (E5).                                                     |
| The process dies between storing the message and notifying   | The message is kept but the notification is lost, because side effects run only for a newly stored message. Phase 2's outbox carries a status column and closes this gap. |
| Meta delivers events out of order                            | `inbox_bump_conversation` moves `last_message_at`, `subject_preview` and `reply_status` forward only, so an older event cannot rewind a thread.                           |
| A guest message arrives with no `entry.id` match             | No connection resolves, the event is recorded as skipped, and nothing is written. No orphan thread is created.                                                            |
| The Page access token is invalid (code 190)                  | The send surfaces "Reconnect Facebook", and the connection row is set to `status = 'error'` so the Channels card shows it (1.9).                                          |
| Business AI owns the chat (code 10, subcode 2018300)         | The send explains that the host must take over in Business Suite, and it is not reported as a missing permission (F24).                                                   |
| A guest reads the host's message                             | `read_at` moves on the outbound rows and `guest_last_read_at` moves on the conversation. The host's unread badge is untouched (F15).                                      |
| The host opens a Meta thread                                 | Edit and Unsend are hidden in the UI and rejected by the server, because Meta has no API for either (F21).                                                                |
| An Instagram Business Suite reply arrives                    | Direction is resolved against the account's own ids (`meta_page_id`, `meta_ig_user_id`, `external_account_id`), so it is outbound, not a guest message (F12).             |
| The Graph `paging.next` host is not Meta                     | The cursor is only read from a `graph.facebook.com` URL; anything else is dropped rather than fetched.                                                                    |
| The client posts a `nextUrl`                                 | The server ignores it. The cursor lives on the connection row, so a stale PWA bundle cannot steer the server (F25).                                                       |
| The org has a property-scoped Page as well as an org default | The scoped helper resolves the org default, so the backfill no longer crashes on a multi-row `maybeSingle` (F16).                                                         |

## Status after this pass (2026-11-10)

Phases 1 to 6 are implemented, plus the observability items and most of the cleanup. Phase 0
is operator work and still blocks the parity target, not the code.

| Phase | State                       | What is left                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | done                        | D6 (ask affected orgs to reconnect after the token leak) needs the edge logs.                                                                                                                                                                                                                                                                                                              |
| 2     | done except the load test   | Durable outbox, parser per event type, processor with backoff and dead letters, `inbox_apply_meta_message` and companions, insert-first sends, webhook fields, worker cron, outbox retention, legacy thread-id backfill and unit tests. The Appendix D burst test needs a deployed stack.                                                                                                  |
| 3     | done except one item        | Import and reconcile are server-owned per connection, adaptive schedule, rate-limit headers, `meta-inbox-sync`, the client chunk driver removed, and the app-level subscription is audited with a 72-hour look-back after any re-subscribe. **3.7** (one-time deepen/repair jobs) still needs a production dry run.                                                                        |
| 4     | done except three items     | Broadcast topic with its RLS helper, delta reads with a 30-second overlap, `social_messages.updated_at`, one client channel with catch-up and degrade, and the cache patchers extracted to tested pure functions. **4.4** (`inbox_list_threads`) is a query-count optimisation and is deferred. **4.6** kept `useChatReadReceiptSync` for web chat. **4.8** needs live traffic to measure. |
| 5     | done                        | Sync status pill, How this inbox works sheet, non-blocking import banner, thread dividers, source chips, Not sent with Retry, Business AI banner, gap divider. The 5.9 Playwright suite is not written.                                                                                                                                                                                    |
| 6     | done except rendering tests | Postbacks, reactions, guest edits, Instagram unsends, story replies, shares and stickers are stored with a kind, the mapper is unit-tested, and images and files reach Meta. `mark_seen` on open, referral stored, host badge clears when the host reads elsewhere. Component rendering tests for each kind are not written.                                                               |
| 7     | partial                     | `integrations.meta_sync_degraded` / `_recovered` / `_meta_import_completed` are emitted. The `/admin/health` panel, the Sentry alert rules and the weekly ops section still need the dashboard. The runbook shipped: `docs/archive/operations/meta-inbox-sync-runbook.md`.                                                                                                                 |
| 8     | partial                     | **8.1** dropped `social_webhook_events`, `meta_backfill_next_url`, the legacy `meta-inbox-backfill` endpoint and its client caller. **8.4** decided: keep everything for now, revisit at 50% of plan storage. **8.5** docs shipped. **8.2** guest web chat still uses Postgres Changes, so `meta_backfill_cursor`/`_phase`/`_done` stay. **8.3** needs a deploy to measure.                |

## Verification results

Recorded 2026-11-10, on `feat/guest-inbox-meta-sync` from `origin/develop`.

| Gate                                                  | Result                                                                                                                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run type-check`                                  | pass                                                                                                                                                                             |
| `bun run lint`                                        | pass, 0 errors (630 pre-existing warnings)                                                                                                                                       |
| `bun run test`                                        | pass, 5825 passed / 6 skipped                                                                                                                                                    |
| `bun run test:edge`                                   | pass, 1486 passed / 0 failed                                                                                                                                                     |
| `bun run check:filenames`                             | pass                                                                                                                                                                             |
| `deno check` on the changed edge functions            | pass, except one pre-existing error in `social-inbox-send` (`connection.meta_page_id` is `string \| null`) that also fails on `origin/develop`                                   |
| Migration applied to the local Postgres               | pass, `20261326120000` applied, 0 rows holding a token-bearing paging URL                                                                                                        |
| `inbox_bump_conversation` behaviour on local Postgres | pass, 5 scenarios: forward-only summary, no rewind on an older message, the window follows the last inbound, the badge respects `host_last_read_at`, a bad direction is rejected |
| `bun run test:e2e:smoke`                              | not run, no Playwright journey changed                                                                                                                                           |
| Hosted acknowledgement p95 under 300 ms               | not run, needs a deploy and hosted logs                                                                                                                                          |
| Parity sample against Business Suite                  | not run, needs the Meta app audit and a real Page                                                                                                                                |

## Relationship to existing work

| Doc                                                                                                               | Relationship                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`guest-inbox-meta-hardening.md`](../done/guest-inbox-meta-hardening.md) (done 2026-08-20)                        | Keeps its health check, Fix connection, `HUMAN_AGENT`, and token debug. Revisits its disconnect decision through D2. |
| [`dashboard-contextual-help.md`](../in-progress/dashboard-contextual-help.md)                                     | Phase 5 takes over P7.1 and P7.2 for the inbox.                                                                      |
| [`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md)                              | Phase 3 supplies `rate_limit_pct` for `meta_graph` metering. Phase 4's degrade poll is its A16 mode.                 |
| [`supabase-capacity-and-operational-readiness.md`](../in-progress/supabase-capacity-and-operational-readiness.md) | Builds on the Realtime binding merge. Phase 4 removes the inbox bindings, and Phase 8 reports the result there.      |
| Architecture modernization plan (approved 2026-09-21)                                                             | Follows its choices: plain outbox, Sentry alerts, no Redis.                                                          |
| [`full-app-test-architecture.md`](./full-app-test-architecture.md)                                                | Tests land in its layout if it ships first.                                                                          |
| [`app-speed-root-cause-overhaul.md`](./app-speed-root-cause-overhaul.md)                                          | The list function and removing Graph calls from GETs help its edge p95 targets.                                      |
| [`marketing-meta-publishing-gaps.md`](./marketing-meta-publishing-gaps.md)                                        | Shares the Meta connection and the Graph version bump in 1.10.                                                       |

## Plans, permissions, audit

- **Plans:** no new gate. `metaChatChannel` stays as it is. Sync reliability is not tiered.
- **Permissions:** `check_now` and `load_older` need `inbox:view` and are throttled on the server. Fix connection keeps `channels_add`. Re-import keeps `channels_add`. Parking stays on the coarse `inbox:*` leaves.
- **Activity log:** Phase 7.3 events. Message ingestion is N/A because guest messages are not audit events.

## Docs to update (in the same PRs as the code)

- Rule [`social-inbox.mdc`](../../../.cursor/rules/social-inbox.mdc): webhook-first plus reconciliation, the pipeline, Broadcast realtime.
- Skills `social-inbox` and `meta-messaging` (in `.agent/skills/`): subscription fields, Graph version, sync design.
- [`docs/architecture/overview.md`](../../architecture/overview.md), [`docs/PROJECT.md`](../../PROJECT.md), [`integrations.md`](../../architecture/integrations.md), [`edge-functions.md`](../../architecture/edge-functions.md), [`data-model.md`](../../architecture/data-model.md), [`supabase-capacity.md`](../../architecture/supabase-capacity.md).
- [`meta-app-review.md`](../../archive/operations/meta-app-review.md) (fields, test app), [`inbox-e2e-runbook.md`](../../archive/operations/inbox-e2e-runbook.md) (test app instead of repointing), [`scheduled-jobs-and-testing.md`](../../archive/operations/scheduled-jobs-and-testing.md) (worker cron), the new sync runbook.
- Route guides [`org/property/inbox.md`](../../guides/routes/org/property/inbox.md) and [`org/parking/inbox.md`](../../guides/routes/org/parking/inbox.md), including Host-facing knowledge.
- [`faqs.md`](../../guides/support/faqs.md): missing chats, older messages, Live and Delayed, why edit is not available, Business AI, Instagram message access, the 24-hour window.

## Evidence (filled in Phase 0)

| Check                                       | Result | Date |
| ------------------------------------------- | ------ | ---- |
| App mode and access levels (0.1)            |        |      |
| App-level subscriptions and callback (0.1)  |        |      |
| Owner Page routing, Business AI, IG setting |        |      |
| Parity sample score (0.3)                   |        |      |
| Appendix A results (0.4)                    |        |      |
| Webhook invocations, p95, errors (0.5)      |        |      |
| Graph spike results (0.6)                   |        |      |

## Appendix A: Phase 0 SQL (aggregates only)

```sql
-- A1. Connection states, including token-bearing next URLs (F25)
select platform, status,
       (property_id is null and parking_id is null) as org_default,
       count(*) as n,
       count(*) filter (where meta_backfill_done) as backfill_done,
       count(*) filter (where meta_backfill_next_url ilike '%access_token=%') as next_url_with_token,
       count(*) filter (where last_sync_at is null) as never_synced,
       count(*) filter (where error_message is not null) as with_error,
       count(*) filter (where webhook_subscribed_at is not null) as webhook_subscribed,
       max(webhook_verify_attempts) as max_verify_attempts
from public.social_channel_connections
where platform in ('facebook', 'instagram')
group by 1, 2, 3
order by 1, 2, 3;

-- A2. Messages per thread (F13)
with per_conv as (
  select c.platform, c.id, count(m.id) as msgs
  from public.social_conversations c
  left join public.social_messages m on m.conversation_id = c.id
  where c.platform in ('facebook', 'instagram')
  group by c.platform, c.id
)
select platform, count(*) as threads,
       count(*) filter (where msgs = 0) as zero,
       count(*) filter (where msgs = 1) as one,
       count(*) filter (where msgs between 2 and 10) as two_to_ten,
       count(*) filter (where msgs between 11 and 20) as eleven_to_twenty,
       count(*) filter (where msgs > 20) as over_twenty
from per_conv
group by platform;

-- A3. Threads with no host messages, and pending share (F12)
select c.platform, count(*) as threads,
       count(*) filter (where not exists (
         select 1 from public.social_messages m
         where m.conversation_id = c.id and m.direction = 'outbound')) as no_outbound,
       count(*) filter (where c.reply_status = 'pending') as pending
from public.social_conversations c
where c.platform in ('facebook', 'instagram')
group by c.platform;

-- A4. Unknown or missing guest ids (F8)
select platform, count(*)
from public.social_conversations
where platform in ('facebook', 'instagram')
  and (external_participant_id is null
       or external_participant_id = 'unknown'
       or external_thread_id like '%:unknown')
group by platform;

-- A5. Unread never above 1 (F14)
select platform, max(unread_count) as max_unread,
       count(*) filter (where unread_count > 1) as above_one
from public.social_conversations
where platform in ('facebook', 'instagram')
group by platform;

-- A6. Webhook events per day, last 30 days
select date_trunc('day', processed_at) as day, count(*)
from public.social_webhook_events
where processed_at > now() - interval '30 days'
group by 1
order by 1;

-- A7. Ingestion delay for guest messages, last 14 days (large p95 means messages
--     arrived through import or reconnect rather than webhooks)
select c.platform, count(*) as n,
       percentile_cont(0.5) within group (order by extract(epoch from (m.created_at - m.sent_at))) as p50_s,
       percentile_cont(0.95) within group (order by extract(epoch from (m.created_at - m.sent_at))) as p95_s
from public.social_messages m
join public.social_conversations c on c.id = m.conversation_id
where c.platform in ('facebook', 'instagram')
  and m.direction = 'inbound'
  and m.created_at > now() - interval '14 days'
group by c.platform;

-- A8. Host messages sent through Kame vs elsewhere, last 30 days
select c.platform,
       count(*) filter (where m.sent_by_user_id is not null) as sent_in_kame,
       count(*) filter (where m.sent_by_user_id is null and not m.is_ai_generated) as sent_elsewhere_or_unknown,
       count(*) filter (where m.is_ai_generated) as sent_by_ai
from public.social_messages m
join public.social_conversations c on c.id = m.conversation_id
where c.platform in ('facebook', 'instagram')
  and m.direction = 'outbound'
  and m.created_at > now() - interval '30 days'
group by c.platform;
```

## Appendix B: Parity checklist (real accounts)

Run with a test Page and Instagram account, a separate personal account as the guest, and Business Suite open side by side.

1. Guest sends text on Messenger. It appears in Kame within 3 seconds.
2. Guest sends a photo. It renders, and still renders after 7 days.
3. Host replies in Kame. Guest receives it once. No duplicate after the echo.
4. Host replies in Business Suite on desktop. It appears in Kame marked "Sent from Meta".
5. Host replies in the Messenger or Pages app on a phone. Same as 4.
6. Guest taps an ice breaker. The question appears as a guest message.
7. Guest reacts to a host message. The reaction shows.
8. Guest edits a Messenger message. The new text and an edited marker show.
9. Guest unsends on Instagram. "Guest unsent a message" shows.
10. Guest replies to an Instagram story. A story reply card shows.
11. Guest sends a sticker or an unsupported type. A placeholder with an Open link shows.
12. Guest reads a host message. "Seen" shows.
13. Inbox open, laptop asleep for 10 minutes, guest sends 3 messages. All appear within 5 seconds of waking.
14. App unsubscribed from the Page for 15 minutes while the guest sends 5 messages. After re-subscribe, all 5 appear within one reconcile cycle, without a reconnect.
15. A property manager (property member) has the inbox open. Updates arrive live.
16. Guest sends two messages a second apart. Order follows sent time and the preview shows the newest.
17. Reply window closed. The composer explains it. The 7-day follow-up appears only when approved.
18. Business AI owns a chat. The banner shows and the send error copy is correct.
19. Connect a Page with 300 chats, then close the tab. Import completes. Threads hold up to 20 messages with the history divider where needed.
20. A property override Page is connected. Its threads import and stay in that property's inbox.
21. Disconnect and reconnect. History behaves as decided in D2.
22. An Instagram message request under 30 days old appears.

## Appendix C: Event keys

| Event                                     | `event_key`                                 |
| ----------------------------------------- | ------------------------------------------- |
| Message, echo, postback with a message id | `msg:<mid>`                                 |
| Postback without a message id             | `pb:<sender>:<timestamp>:<payload hash>`    |
| Messenger read                            | `read:<entry_id>:<sender>:<watermark>`      |
| Instagram seen                            | `seen:<mid>`                                |
| Reaction                                  | `react:<mid>:<sender>:<action>:<timestamp>` |
| Edit                                      | `edit:<mid>:<timestamp>`                    |
| Instagram unsend                          | `del:<mid>`                                 |
| Handover                                  | `hand:<entry_id>:<sender>:<timestamp>`      |
| Referral                                  | `ref:<entry_id>:<sender>:<timestamp>`       |

A message delivered on both `messaging` and `standby` shares `msg:<mid>` and is stored once.

## Appendix D: Webhook burst test

Against the local stack with the Meta test app secret: a k6 script signs synthetic payloads (40% guest messages, 30% echoes, 30% reads) and posts 50 requests per second for 60 seconds. Pass when acknowledgement p95 is under 300 ms, every event is applied, there are no dead letters, and processing lag p95 is under 10 seconds. Re-run after Phases 2 and 3, and after any change to the processor.
