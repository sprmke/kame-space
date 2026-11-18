-- Multi-channel calendar sync Phase 1a — close grant residue and make the read counter atomic.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.4, §5 (M3)
--
-- The two new tables were created with RLS on and no policies, but `GRANT ALL TO service_role`
-- alone leaves the default `anon` / `authenticated` schema grants in place (TRUNCATE is not
-- affected by RLS). Same strict form as 20261326120100_meta_webhook_outbox.sql.

REVOKE ALL ON TABLE public.calendar_export_reads, public.calendar_sync_runs
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.calendar_export_reads, public.calendar_sync_runs TO service_role;

-- One statement instead of select + update + insert: no lost increments under concurrent channel
-- polls, and a losing insert race still lands as an update on the existing row.
CREATE OR REPLACE FUNCTION public.record_calendar_export_read(
  p_property_id uuid,
  p_channel text,
  p_ranges_hash text,
  p_ranges jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  INSERT INTO public.calendar_export_reads (property_id, channel, ranges_hash, ranges)
  VALUES (p_property_id, p_channel, p_ranges_hash, p_ranges)
  ON CONFLICT (property_id, channel, ranges_hash)
  DO UPDATE SET
    last_read_at = now(),
    read_count = public.calendar_export_reads.read_count + 1;
$fn$;

COMMENT ON FUNCTION public.record_calendar_export_read(uuid, text, text, jsonb) IS
  'Upserts one export read (date ranges only) for a property + channel. SECURITY DEFINER; '
  'service_role only.';

REVOKE ALL ON FUNCTION public.record_calendar_export_read(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_calendar_export_read(uuid, text, text, jsonb)
  TO service_role;
