-- Booking-linked urgent help (readiness SAFE-01).
--
-- A guest who cannot get in, finds the unit unsafe/not as described, or has another arrival
-- emergency needs one action that reaches the host and the platform, not a chat message that
-- may go unread. One open request per booking; the host is notified in-app/push and the ops
-- channel gets a P0/P1 alert (the dispatcher owns dedupe and throttling).

CREATE TABLE IF NOT EXISTS public.booking_help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.guest_submissions (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id uuid,
  guest_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('cant_get_in', 'not_as_described', 'unsafe', 'other')),
  note text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'host_replied', 'resolved', 'escalated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  escalated_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid
);

-- One open request per booking. A resolved case can be reopened with a new row.
CREATE UNIQUE INDEX IF NOT EXISTS booking_help_requests_open_key
  ON public.booking_help_requests (booking_id)
  WHERE status IN ('open', 'escalated');

CREATE INDEX IF NOT EXISTS booking_help_requests_property_open
  ON public.booking_help_requests (property_id, created_at DESC)
  WHERE status IN ('open', 'escalated');

CREATE INDEX IF NOT EXISTS booking_help_requests_escalation
  ON public.booking_help_requests (created_at)
  WHERE status = 'open';

ALTER TABLE public.booking_help_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.booking_help_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.booking_help_requests TO service_role;

COMMENT ON TABLE public.booking_help_requests IS
  'Guest arrival/help escalation linked to a booking (SAFE-01). Service-role only; the guest trip endpoint is the writer.';

CREATE OR REPLACE FUNCTION public.prune_booking_help_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.booking_help_requests
  WHERE status = 'resolved'
    AND resolved_at < now() - interval '365 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$fn$;

REVOKE ALL ON FUNCTION public.prune_booking_help_requests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_booking_help_requests() TO service_role;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'booking-help-retention-daily',
      '25 0 * * *',
      'SELECT public.prune_booking_help_requests();'
    );
  END IF;
END
$do$;
