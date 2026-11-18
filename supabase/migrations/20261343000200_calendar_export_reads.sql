-- Multi-channel calendar sync Phase 1a — per-channel export read health and echo memory.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §5 (M3), §4.4
--
-- `property_calendar_export.last_served_at` is one timestamp per property and is only stamped on
-- a 200, while most channel reads are 304s. It cannot answer "did Agoda read our link", and it
-- cannot support echo detection. One upsert per served request fixes both, and stores date ranges
-- only: no ids, no PII.

CREATE TABLE IF NOT EXISTS public.calendar_export_reads (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id   uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  channel       text NOT NULL CHECK (channel IN ('all', 'airbnb', 'agoda', 'booking_com', 'vrbo', 'other')),
  ranges_hash   text NOT NULL,
  ranges        jsonb NOT NULL,
  first_read_at timestamptz NOT NULL DEFAULT now(),
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  read_count    integer NOT NULL DEFAULT 1,
  UNIQUE (property_id, channel, ranges_hash)
);

CREATE INDEX IF NOT EXISTS calendar_export_reads_recent_idx
  ON public.calendar_export_reads (property_id, channel, last_read_at DESC);

ALTER TABLE public.calendar_export_reads ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.calendar_export_reads TO service_role;

COMMENT ON TABLE public.calendar_export_reads IS
  'Served export ranges per property and channel (200 and 304). Drives per-channel read health and '
  'echo detection. Date ranges only, never guest data.';
