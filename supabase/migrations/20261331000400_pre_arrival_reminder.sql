-- Pre-arrival reminder: the T-48h guest email (guest journey plan 6.5 / D13).
--
-- `guest_submissions.pre_arrival_emailed_at` is the idempotency key, so a cron retry cannot
-- email the same guest twice.

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS pre_arrival_emailed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guest_submissions.pre_arrival_emailed_at IS
  'When the pre-arrival reminder email was sent. Idempotency key for the pre-arrival-reminders cron.';

CREATE INDEX IF NOT EXISTS guest_submissions_pre_arrival_pending_idx
  ON public.guest_submissions (check_in_date)
  WHERE pre_arrival_emailed_at IS NULL AND parking_id IS NULL;

-- Hourly sweep. Self-invokes at the bottom so a fresh environment schedules it without an
-- admin PATCH; safe on stacks without pg_cron/pg_net/Vault (returns ok:false).
CREATE OR REPLACE FUNCTION public.sync_pre_arrival_reminder_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '15 * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/pre-arrival-reminders',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'pre_arrival_reminder_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Pre-Arrival-Reminder-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pre_arrival_reminder_cron_secret')
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
  FOR r IN SELECT jobname FROM cron.job WHERE jobname = 'pre-arrival-reminders-hourly'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('pre-arrival-reminders-hourly', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_pre_arrival_reminder_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_pre_arrival_reminder_cron_job() IS
  'Rebuilds pre-arrival-reminders-hourly. SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url + anon_key; PRE_ARRIVAL_REMINDER_CRON_SECRET optional. '
  'See docs/archive/operations/scheduled-jobs-and-testing.md.';

REVOKE ALL ON FUNCTION public.sync_pre_arrival_reminder_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_pre_arrival_reminder_cron_job() TO service_role;

SELECT public.sync_pre_arrival_reminder_cron_job();
