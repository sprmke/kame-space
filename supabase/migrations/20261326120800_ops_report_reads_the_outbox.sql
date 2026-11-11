-- Keep the weekly ops report valid after `social_webhook_events` was dropped.
--
-- The outbox is the same signal, so the report counts settled and dead events from
-- `meta_webhook_events`. The dead count is new: it is the one metric that says the pipeline
-- is losing events rather than just passing fewer through.

CREATE OR REPLACE FUNCTION public.get_ops_weekly_metrics(
  p_since timestamptz,
  p_until timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'bookings', jsonb_build_object(
      'created', (SELECT count(*) FROM public.guest_submissions WHERE created_at >= p_since AND created_at < p_until),
      'completed', (SELECT count(*) FROM public.guest_submissions WHERE status = 'COMPLETED' AND status_updated_at >= p_since AND status_updated_at < p_until),
      'cancelled', (SELECT count(*) FROM public.guest_submissions WHERE status = 'CANCELLED' AND status_updated_at >= p_since AND status_updated_at < p_until),
      'pending_review', (SELECT count(*) FROM public.guest_submissions WHERE status = 'PENDING_REVIEW'),
      'pending_documents', (SELECT count(*) FROM public.guest_submissions WHERE status = 'PENDING_DOCUMENTS'),
      'ready_for_checkin', (SELECT count(*) FROM public.guest_submissions WHERE status = 'READY_FOR_CHECKIN'),
      'ready_for_checkout', (SELECT count(*) FROM public.guest_submissions WHERE status = 'READY_FOR_CHECKOUT')
    ),
    'emails', jsonb_build_object(
      'processed', (SELECT count(*) FROM public.processed_emails WHERE processed_at >= p_since AND processed_at < p_until),
      'suppressed', (SELECT count(*) FROM public.email_suppressions WHERE suppressed_at >= p_since AND suppressed_at < p_until)
    ),
    'payments', jsonb_build_object(
      'parking_paid', (SELECT count(*) FROM public.parking_payment_transactions WHERE status = 'paid' AND created_at >= p_since AND created_at < p_until),
      'parking_failed', (SELECT count(*) FROM public.parking_payment_transactions WHERE status = 'failed' AND created_at >= p_since AND created_at < p_until),
      'org_paid', (SELECT count(*) FROM public.org_payment_transactions WHERE status = 'paid' AND created_at >= p_since AND created_at < p_until),
      'org_failed', (SELECT count(*) FROM public.org_payment_transactions WHERE status = 'failed' AND created_at >= p_since AND created_at < p_until)
    ),
    'support', jsonb_build_object(
      'opened', (SELECT count(*) FROM public.support_tickets WHERE created_at >= p_since AND created_at < p_until),
      'open_now', (SELECT count(*) FROM public.support_tickets WHERE status IN ('open', 'in_progress'))
    ),
    'social', jsonb_build_object(
      'webhook_events', (SELECT count(*) FROM public.meta_webhook_events WHERE processed_at >= p_since AND processed_at < p_until),
      'webhook_dead', (SELECT count(*) FROM public.meta_webhook_events WHERE status = 'dead' AND received_at >= p_since AND received_at < p_until)
    ),
    'ai', jsonb_build_object(
      'requests', (SELECT count(*) FROM public.ai_platform_usage_events WHERE created_at >= p_since AND created_at < p_until),
      'errors', (SELECT count(*) FROM public.ai_platform_usage_events WHERE status = 'error' AND created_at >= p_since AND created_at < p_until),
      'credits', (SELECT COALESCE(sum(credits_consumed), 0) FROM public.ai_platform_usage_events WHERE created_at >= p_since AND created_at < p_until)
    ),
    'activity', jsonb_build_object(
      'total', (SELECT count(*) FROM public.activity_log WHERE created_at >= p_since AND created_at < p_until),
      'destructive', (SELECT count(*) FROM public.activity_log WHERE severity = 'destructive' AND created_at >= p_since AND created_at < p_until)
    ),
    'ops', jsonb_build_object(
      'rate_limit_rows', (SELECT count(*) FROM public.request_rate_limits),
      'failing_jobs', (SELECT count(*) FROM public.system_job_heartbeats WHERE consecutive_failures > 0),
      'db_size_bytes', pg_database_size(current_database())
    )
  );
$fn$;

COMMENT ON FUNCTION public.get_ops_weekly_metrics(timestamptz, timestamptz) IS
  'Database-only weekly aggregates for the operations report. service_role only.';

REVOKE ALL ON FUNCTION public.get_ops_weekly_metrics(timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ops_weekly_metrics(timestamptz, timestamptz)
  TO service_role;

-- Schedule the weekly job only when operators have provisioned the Vault secret.
-- The edge function still verifies the same secret, so a missing secret is a no-op,
-- never an unauthenticated generation path.

REVOKE ALL ON FUNCTION public.get_ops_weekly_metrics(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ops_weekly_metrics(timestamptz, timestamptz) TO service_role;
