-- Data-subject export and deletion requests (ledger PR-145, RA 10173).
--
-- Decision recorded with this migration:
--   * Export is self-service and synchronous: the edge function assembles the caller's own
--     personal data as JSON and returns it as a download.
--   * Deletion is a reviewable request, not an automated eraser. Bookings are financial
--     records with a lawful retention basis, and a wrong delete cannot be undone. A request
--     gets a 15-day due date, the daily cron raises an ops alert when it is due, and an
--     operator executes the documented runbook (anonymise guest PII, delete profile and auth
--     user, keep dates/amounts/status for accounting).
--
-- Service-role only: guests never read this table directly.

CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email text,
  kind text NOT NULL CHECK (kind IN ('export', 'delete')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  note text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL DEFAULT now() + interval '15 days',
  processed_at timestamptz,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One open request per user and kind. A completed request can be repeated later.
CREATE UNIQUE INDEX IF NOT EXISTS data_subject_requests_open_key
  ON public.data_subject_requests (user_id, kind)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS data_subject_requests_due
  ON public.data_subject_requests (due_at)
  WHERE status = 'pending' AND kind = 'delete';

CREATE INDEX IF NOT EXISTS data_subject_requests_user
  ON public.data_subject_requests (user_id, requested_at DESC);

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.data_subject_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.data_subject_requests TO service_role;

COMMENT ON TABLE public.data_subject_requests IS
  'RA 10173 data-subject export/delete requests (PR-145). Service-role only; deletion is reviewed by an operator because bookings are retained financial records.';

CREATE OR REPLACE FUNCTION public.prune_data_subject_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_deleted integer := 0;
BEGIN
  -- The request itself is the audit record; keep completed ones for two years.
  DELETE FROM public.data_subject_requests
  WHERE status IN ('completed', 'rejected', 'cancelled')
    AND updated_at < now() - interval '2 years';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$fn$;

REVOKE ALL ON FUNCTION public.prune_data_subject_requests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_data_subject_requests() TO service_role;

-- Daily due-date check. Best-effort at deploy time; hosted environments call this after the
-- Vault secret `data_subject_requests_secret` exists (same pattern as the other cron syncs).
CREATE OR REPLACE FUNCTION public.sync_data_subject_requests_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cron_expr text := '10 0 * * *'; -- 08:10 Asia/Manila
  v_cmd text := $CMD$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/data-subject-requests-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'data_subject_requests_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Data-Subject-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'data_subject_requests_secret')
      )
      ELSE jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
      )
    END
  ),
  body := '{}'::jsonb
)
WHERE EXISTS (
  SELECT 1 FROM public.data_subject_requests
  WHERE status = 'pending' AND kind = 'delete' AND due_at <= now()
);
$CMD$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pg_cron is not installed');
  END IF;

  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname = 'data-subject-requests-daily';

  PERFORM cron.schedule('data-subject-requests-daily', cron_expr, v_cmd);
  PERFORM cron.schedule(
    'data-subject-requests-retention-weekly',
    '40 0 * * 0',
    'SELECT public.prune_data_subject_requests();'
  );
  RETURN jsonb_build_object('ok', true, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sync_data_subject_requests_cron: ' || sqlerrm);
END;
$$;

COMMENT ON FUNCTION public.sync_data_subject_requests_cron() IS
  'Schedules the daily due-date alert cron. Gated on a due deletion request, so idle days cost no invocation.';

REVOKE ALL ON FUNCTION public.sync_data_subject_requests_cron() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_data_subject_requests_cron() TO service_role;

-- Best effort at deploy time (operator can call the sync again after setting the Vault secret).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM public.sync_data_subject_requests_cron();
  END IF;
END
$do$;
