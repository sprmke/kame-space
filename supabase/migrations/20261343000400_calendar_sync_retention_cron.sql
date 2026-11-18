-- Multi-channel calendar sync Phase 1a — retention for the new sync tables.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §5 (M5)
--
-- Mirrors public.prune_meta_webhook_events (20261326120200): SECURITY DEFINER, service_role only,
-- safe on environments without pg_cron.

CREATE OR REPLACE FUNCTION public.prune_calendar_sync_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_events int := 0;
  v_runs int := 0;
  v_reads int := 0;
BEGIN
  DELETE FROM public.calendar_sync_events
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_events = ROW_COUNT;

  DELETE FROM public.calendar_sync_runs
  WHERE started_at < now() - interval '14 days';
  GET DIAGNOSTICS v_runs = ROW_COUNT;

  DELETE FROM public.calendar_export_reads
  WHERE last_read_at < now() - interval '14 days';
  GET DIAGNOSTICS v_reads = ROW_COUNT;

  RETURN jsonb_build_object(
    'events_deleted', v_events, 'runs_deleted', v_runs, 'reads_deleted', v_reads
  );
END;
$fn$;

COMMENT ON FUNCTION public.prune_calendar_sync_history() IS
  'Calendar sync retention: events 90 days, runs 14 days, export reads 14 days. '
  'SECURITY DEFINER; service_role only.';

REVOKE ALL ON FUNCTION public.prune_calendar_sync_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_calendar_sync_history() TO service_role;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname = 'calendar-sync-retention-daily';
    PERFORM cron.schedule(
      'calendar-sync-retention-daily',
      '23 3 * * *',
      'SELECT public.prune_calendar_sync_history();'
    );
  END IF;
END
$do$;
