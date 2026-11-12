-- Marketing Planner schedules: the publish sweep every minute and the planner sweep every
-- quarter hour. Same self-healing Vault-secret pattern as cancellation-refund-cron: while the
-- optional cron secret is absent from Vault the job still runs without the header.
--
-- Plan: docs/workflow/in-progress/marketing-strategy-planner.md (§5.4)

CREATE OR REPLACE FUNCTION public.sync_marketing_publish_scheduler_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '* * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/marketing-publish-scheduler-cron',
  headers := (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM vault.decrypted_secrets ds
        WHERE ds.name = 'marketing_publish_cron_secret'
      )
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'x-marketing-publish-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'marketing_publish_cron_secret')
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
  FOR r IN
    SELECT jobname FROM cron.job
    WHERE jobname IN ('marketing-publish-scheduler', 'marketing-publish-scheduler-managed')
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('marketing-publish-scheduler-managed', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_marketing_publish_scheduler_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.sync_marketing_planner_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '*/15 * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/marketing-planner-cron',
  headers := (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM vault.decrypted_secrets ds
        WHERE ds.name = 'marketing_planner_cron_secret'
      )
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'x-marketing-planner-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'marketing_planner_cron_secret')
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
  FOR r IN
    SELECT jobname FROM cron.job
    WHERE jobname IN ('marketing-planner-quarter-hour', 'marketing-planner-quarter-hour-managed')
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('marketing-planner-quarter-hour-managed', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_marketing_planner_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_marketing_publish_scheduler_cron_job() IS
  'Rebuilds the every-minute marketing publish scheduler. SECURITY DEFINER; service_role only.';
COMMENT ON FUNCTION public.sync_marketing_planner_cron_job() IS
  'Rebuilds the quarter-hourly marketing planner sweep. SECURITY DEFINER; service_role only.';

REVOKE ALL ON FUNCTION public.sync_marketing_publish_scheduler_cron_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_marketing_planner_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_marketing_publish_scheduler_cron_job() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_marketing_planner_cron_job() TO service_role;

SELECT public.sync_marketing_publish_scheduler_cron_job();
SELECT public.sync_marketing_planner_cron_job();
