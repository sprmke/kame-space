-- Multi-channel calendar sync Phase 1a — remember which imported blocks are real stays.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §5 (M2)
--
-- Hub relay (Phase 1b) publishes an imported *reservation* to every channel except the one it
-- came from, and never publishes an imported *block* (host blocks, prep time and echoes are
-- indistinguishable). Storing the kind at ingest time is cheaper and safer than re-deriving it
-- from SUMMARY later.

ALTER TABLE public.property_blocked_dates
  ADD COLUMN IF NOT EXISTS external_kind text
    CHECK (external_kind IN ('reservation', 'block'));

COMMENT ON COLUMN public.property_blocked_dates.external_kind IS
  'For source=ical_import rows: reservation (a real stay) or block (host block / unavailable). '
  'NULL on manual and legacy rows.';

-- Backfill: the UI was Airbnb-only until this plan, so every existing imported row came from an
-- Airbnb feed where only SUMMARY = "Reserved" is a stay (calendarSyncService#classifyEventKind).
UPDATE public.property_blocked_dates b
SET external_kind = CASE
    WHEN lower(trim(b.external_summary)) = 'reserved' THEN 'reservation'
    ELSE 'block'
  END
FROM public.property_calendar_feeds f
WHERE b.feed_id = f.id
  AND b.source = 'ical_import'
  AND b.external_kind IS NULL;
