-- Drop the state the outbox and the sync worker replaced.
--
-- `social_webhook_events` was the pre-outbox dedupe table. The outbox is
-- `meta_webhook_events` now, and nothing writes the old table.
--
-- `meta_backfill_next_url` held a Graph paging URL, which carries the Page access token. It
-- was cleared in phase 1; dropping it removes the chance of it being written again.
--
-- `meta_backfill_cursor` / `_phase` / `_done` stay for one more release: the legacy
-- `meta-inbox-backfill` endpoint is still reachable by an old cached bundle, and the
-- `metaHasMore` flag in the thread list reads them. Phase 8b removes them.
--
-- Phase 8 of docs/workflow/in-progress/guest-inbox-meta-sync-overhaul.md.

DROP TABLE IF EXISTS public.social_webhook_events;

ALTER TABLE public.social_channel_connections
  DROP COLUMN IF EXISTS meta_backfill_next_url;
