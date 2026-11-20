-- Ops alert dispatcher (ledger PR-027 / plan production-error-escalation Phase 1).
--
-- One row per open alert key. The dispatcher (`_shared/ops/opsAlert.ts`) upserts by
-- `alert_key`, aggregates occurrences, throttles re-notification per tier and collapses a
-- storm into one message. Service-role only, same posture as `ops_reports`.

CREATE TABLE IF NOT EXISTS public.ops_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('p0', 'p1', 'p2', 'p3', 'drill')),
  source text NOT NULL CHECK (
    source IN ('edge', 'journey', 'job', 'ci', 'deploy', 'probe', 'sentry', 'log_scan', 'vendor')
  ),
  title text NOT NULL,
  summary text,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acked', 'muted', 'resolved')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrences integer NOT NULL DEFAULT 1 CHECK (occurrences > 0),
  last_notified_at timestamptz,
  notify_count integer NOT NULL DEFAULT 0,
  acked_by text,
  acked_at timestamptz,
  muted_until timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One open row per key. Resolved rows are kept for history, so the index is partial.
CREATE UNIQUE INDEX IF NOT EXISTS ops_alerts_open_key
  ON public.ops_alerts (alert_key)
  WHERE status <> 'resolved';

CREATE INDEX IF NOT EXISTS ops_alerts_open_tier
  ON public.ops_alerts (tier, last_seen_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS ops_alerts_notified
  ON public.ops_alerts (last_notified_at DESC)
  WHERE last_notified_at IS NOT NULL;

ALTER TABLE public.ops_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ops_alerts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ops_alerts TO service_role;

COMMENT ON TABLE public.ops_alerts IS
  'Ops alert state and dedupe for PR-027. Service-role only; the dispatcher is the only writer.';
COMMENT ON COLUMN public.ops_alerts.alert_key IS
  'Deterministic dedupe key, e.g. edge:submit-form:5xx. One open row per key.';
COMMENT ON COLUMN public.ops_alerts.last_notified_at IS
  'Last time any channel was notified. Re-notify is throttled per tier.';

-- 180-day retention, matching the plan.
CREATE OR REPLACE FUNCTION public.prune_ops_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.ops_alerts
  WHERE status = 'resolved'
    AND resolved_at < now() - interval '180 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$fn$;

REVOKE ALL ON FUNCTION public.prune_ops_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_ops_alerts() TO service_role;

-- Daily retention. Plain SQL, so no Vault secret is needed.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ops-alerts-retention-daily',
      '30 0 * * *',
      'SELECT public.prune_ops_alerts();'
    );
  END IF;
END
$do$;
