-- Keep the nightly retention function valid after `social_webhook_events` was dropped.
--
-- The table that held webhook dedupe rows before the outbox is gone, and its own retention
-- now lives in `prune_meta_webhook_events()` on an hourly schedule.

CREATE OR REPLACE FUNCTION public.prune_operational_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_started_at TIMESTAMPTZ := clock_timestamp();
  v_rate_limits INTEGER := 0;
  v_processed_emails INTEGER := 0;
  v_telegram_admin INTEGER := 0;
  v_telegram_staff INTEGER := 0;
  v_finance_reminders INTEGER := 0;
  v_maintenance_reminders INTEGER := 0;
BEGIN
  DELETE FROM public.request_rate_limits
  WHERE window_start < now() - interval '2 days';
  GET DIAGNOSTICS v_rate_limits = ROW_COUNT;

  DELETE FROM public.processed_emails
  WHERE processed_at < now() - interval '120 days';
  GET DIAGNOSTICS v_processed_emails = ROW_COUNT;

  DELETE FROM public.telegram_admin_notification_log
  WHERE sent_at < now() - interval '180 days';
  GET DIAGNOSTICS v_telegram_admin = ROW_COUNT;

  DELETE FROM public.telegram_staff_notification_log
  WHERE sent_at < now() - interval '180 days';
  GET DIAGNOSTICS v_telegram_staff = ROW_COUNT;

  DELETE FROM public.finance_telegram_reminder_log
  WHERE sent_at < now() - interval '180 days';
  GET DIAGNOSTICS v_finance_reminders = ROW_COUNT;

  DELETE FROM public.maintenance_telegram_reminder_log
  WHERE sent_at < now() - interval '180 days';
  GET DIAGNOSTICS v_maintenance_reminders = ROW_COUNT;

  -- Audit log: N/A (platform retention only; no organization, property, or
  -- guest state is touched). The health console still needs a heartbeat.
  INSERT INTO public.system_job_heartbeats AS t (
    job_name, last_started_at, last_finished_at, last_success_at, last_status,
    last_duration_ms, consecutive_failures, total_runs, updated_at
  )
  VALUES (
    'operational-retention', v_started_at, clock_timestamp(), clock_timestamp(), 'ok',
    (EXTRACT(EPOCH FROM (clock_timestamp() - v_started_at)) * 1000)::int, 0, 1, now()
  )
  ON CONFLICT (job_name) DO UPDATE SET
    last_started_at = EXCLUDED.last_started_at,
    last_finished_at = EXCLUDED.last_finished_at,
    last_success_at = EXCLUDED.last_success_at,
    last_status = 'ok',
    last_duration_ms = EXCLUDED.last_duration_ms,
    consecutive_failures = 0,
    total_runs = t.total_runs + 1,
    updated_at = now();

  RETURN jsonb_build_object(
    'request_rate_limits', v_rate_limits,
    'processed_emails', v_processed_emails,
    'telegram_admin_notification_log', v_telegram_admin,
    'telegram_staff_notification_log', v_telegram_staff,
    'finance_telegram_reminder_log', v_finance_reminders,
    'maintenance_telegram_reminder_log', v_maintenance_reminders
  );
END;
$fn$;


-- `CREATE OR REPLACE` keeps the old grants, but the guard requires an explicit statement in
-- every migration that defines a SECURITY DEFINER function.
REVOKE ALL ON FUNCTION public.prune_operational_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_operational_tables() TO service_role;
