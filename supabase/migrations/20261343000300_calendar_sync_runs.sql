-- Multi-channel calendar sync Phase 1a — one row per feed run.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §5 (M4)
--
-- Nothing records how often a feed is really attempted, so the 30 vs 60 minute cadence question
-- cannot be answered. `calendar_sync_events` only holds actions, and unchanged pulls write nothing.

CREATE TABLE IF NOT EXISTS public.calendar_sync_runs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feed_id     uuid NOT NULL REFERENCES public.property_calendar_feeds(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  provider    text NOT NULL,
  status      text NOT NULL,
  error_code  text,
  duration_ms integer NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_sync_runs_feed_idx
  ON public.calendar_sync_runs (feed_id, started_at DESC);
CREATE INDEX IF NOT EXISTS calendar_sync_runs_provider_idx
  ON public.calendar_sync_runs (provider, started_at DESC);
CREATE INDEX IF NOT EXISTS calendar_sync_runs_property_idx
  ON public.calendar_sync_runs (property_id, started_at DESC);

ALTER TABLE public.calendar_sync_runs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.calendar_sync_runs TO service_role;

COMMENT ON TABLE public.calendar_sync_runs IS
  'One row per feed run (synced | not_modified | unchanged | skipped | error). Source for cadence, '
  'p95 duration and per-channel failure rate.';
