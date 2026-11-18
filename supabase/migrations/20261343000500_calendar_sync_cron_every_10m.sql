-- Multi-channel calendar sync Phase 1a — sweep every 10 minutes, minimum interval stays 30.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.8, §5 (M6)
--
-- A feed claimed a few seconds into a sweep missed its next claim at the 30 minute mark, so most
-- feeds synced every 60 minutes while the UI said 30. The edge handler now claims with 2 minutes
-- of slack, and a 10 minute tick only takes due feeds, so load spreads instead of spiking.

CREATE OR REPLACE FUNCTION public.sync_calendar_sync_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '*/10 * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/calendar-sync-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'calendar_sync_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Calendar-Sync-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'calendar_sync_cron_secret')
      )
      ELSE jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
      )
    END
  ),
  body := '{}'::jsonb
);
$BODY$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pg_cron extension not installed');
  END IF;

  FOR r IN
    SELECT jobname
    FROM cron.job
    WHERE jobname IN ('calendar-sync-every-30m', 'calendar-sync-every-10m')
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('calendar-sync-every-10m', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_calendar_sync_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_calendar_sync_cron_job() IS
  'Rebuilds the calendar-sync-every-10m cron job (was every-30m). SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url + anon_key (see scheduled-jobs-and-testing.md); '
  'safe to call on environments missing pg_cron/pg_net/Vault — returns {ok:false, error}.';

REVOKE ALL ON FUNCTION public.sync_calendar_sync_cron_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_calendar_sync_cron_job() TO service_role;

SELECT public.sync_calendar_sync_cron_job();
