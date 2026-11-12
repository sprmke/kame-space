-- Pending-review request expiry (guest journey plan §13 follow-up).
--
-- Why this exists: only `CANCELLED` frees a night for new bookings
-- (`DatabaseService.checkOverlappingBookings`) and `get-booked-dates` stops returning a row only
-- once it is cancelled. A request the host never answers therefore holds the calendar forever
-- and leaves the guest on "your host is reviewing".
--
-- `guest_submissions.pending_review_chased_at` is the idempotency key for the single warning the
-- property mailbox gets before the request expires, and the age of that stamp is what guarantees
-- a full notice period. See `_shared/pendingReviewPolicy.ts`.

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS pending_review_chased_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guest_submissions.pending_review_chased_at IS
  'When the pending-review chase email was sent. Idempotency key and notice-period anchor for the pending-review-expiry cron.';

CREATE INDEX IF NOT EXISTS guest_submissions_pending_review_sweep_idx
  ON public.guest_submissions (created_at)
  WHERE status = 'PENDING_REVIEW' AND parking_id IS NULL;

-- Hourly sweep. Self-invokes at the bottom so a fresh environment schedules it without an admin
-- PATCH; safe on stacks without pg_cron/pg_net/Vault (returns ok:false).
CREATE OR REPLACE FUNCTION public.sync_pending_review_expiry_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '45 * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/pending-review-expiry',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'pending_review_expiry_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Pending-Review-Expiry-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pending_review_expiry_cron_secret')
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
  FOR r IN SELECT jobname FROM cron.job WHERE jobname = 'pending-review-expiry-hourly'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('pending-review-expiry-hourly', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_pending_review_expiry_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_pending_review_expiry_cron_job() IS
  'Rebuilds pending-review-expiry-hourly. SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url + anon_key; PENDING_REVIEW_EXPIRY_CRON_SECRET optional. '
  'See docs/archive/operations/scheduled-jobs-and-testing.md.';

REVOKE ALL ON FUNCTION public.sync_pending_review_expiry_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_pending_review_expiry_cron_job() TO service_role;

SELECT public.sync_pending_review_expiry_cron_job();
