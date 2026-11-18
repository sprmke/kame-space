-- Billing cycle runs hourly (was daily at 06:00 UTC) so period-end transitions land within the
-- hour instead of up to a day late. The job is fully idempotent: transitions are compare-and-set
-- and every reminder is send-once. Plan: docs/workflow/for-testing/plans-billing-lifecycle-hardening.md

CREATE OR REPLACE FUNCTION public.sync_platform_billing_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '7 * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/platform-billing-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'platform_billing_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Platform-Billing-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'platform_billing_cron_secret')
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
    WHERE jobname IN ('platform-billing-daily', 'platform-billing-hourly')
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('platform-billing-hourly', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_platform_billing_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_platform_billing_cron_job() IS
  'Rebuilds platform-billing-hourly cron (minute 7 of every hour). SECURITY DEFINER; service_role only.';

REVOKE ALL ON FUNCTION public.sync_platform_billing_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_platform_billing_cron_job() TO service_role;

SELECT public.sync_platform_billing_cron_job();
