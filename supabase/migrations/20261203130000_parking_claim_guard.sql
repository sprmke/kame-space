-- Parking hardening (2026-11-07):
--   1. Atomic claim guard: one slot, one overlapping booking, even under concurrent Accepts.
--   2. Broadcast response reason (conflict vs ordinary decline).
--   3. Refund-review bookkeeping on the payment ledger.
--
-- The claim RPC is the database authority for P0-3. App-level availability checks are a
-- friendly pre-check only; two concurrent claims can pass them at the same time.

BEGIN;

-- 1) Why a broadcast row was declined/expired. Kept separate from `response` so the existing
--    four-value CHECK (and every query that depends on it) stays intact.
ALTER TABLE public.parking_booking_broadcasts
  ADD COLUMN IF NOT EXISTS response_reason TEXT;

COMMENT ON COLUMN public.parking_booking_broadcasts.response_reason IS
  'Optional detail for a declined/expired row: conflict, offer_expired, no_response, cancelled.';

-- 2) Refund-review columns. The guest was charged, the host cancelled: the payout is blocked
--    until a super admin records the manual refund.
ALTER TABLE public.parking_payment_transactions
  ADD COLUMN IF NOT EXISTS refund_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS refund_reference TEXT,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refunded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.parking_payment_transactions
  DROP CONSTRAINT IF EXISTS parking_payment_transactions_status_check;

ALTER TABLE public.parking_payment_transactions
  ADD CONSTRAINT parking_payment_transactions_status_check
  CHECK (status IN (
    'pending',
    'paid',
    'failed',
    'expired',
    'cancelled',
    'refund_review',
    'refunded'
  ));

COMMENT ON COLUMN public.parking_payment_transactions.refund_review_at IS
  'Host cancelled after payment; guest refund is owed. Blocks mark_disbursed until recorded.';
COMMENT ON COLUMN public.parking_payment_transactions.refund_amount IS
  'Manual refund recorded by a super admin (refund itself is issued in the PayMongo dashboard).';

-- 3) Atomic claim.
--
-- Why a function: a check-then-update in an edge function is two round trips with no lock
-- between them. This runs the availability check and the PENDING_HOST_ACCEPTANCE ->
-- PENDING_PAYMENT write inside one transaction, serialized per parking slot by an advisory
-- lock. It also owns the offer-TTL check (M-5) and the broadcast-row resolution so no caller
-- can claim after expiry.
CREATE OR REPLACE FUNCTION public.claim_parking_booking_slot(
  p_booking_id UUID,
  p_parking_id UUID,
  p_endorsement_note TEXT,
  p_payment_expires_at TIMESTAMPTZ
)
RETURNS public.guest_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_parking public.parkings%ROWTYPE;
  v_booking public.guest_submissions%ROWTYPE;
  v_check_in DATE;
  v_check_out DATE;
  v_now TIMESTAMPTZ := now();
  v_gap_minutes NUMERIC;
  v_check_in_time TIME;
  v_check_out_time TIME;
  v_turnover_minutes CONSTANT INTEGER := 30;
  v_row public.guest_submissions%ROWTYPE;
BEGIN
  -- Serialize every claim for this slot. Two different slots never block each other.
  PERFORM pg_advisory_xact_lock(hashtext(p_parking_id::text));

  SELECT * INTO v_parking
  FROM public.parkings
  WHERE id = p_parking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'parking_not_found';
  END IF;
  IF v_parking.status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;

  SELECT * INTO v_booking
  FROM public.guest_submissions
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found';
  END IF;
  IF v_booking.status IS DISTINCT FROM 'PENDING_HOST_ACCEPTANCE' THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;
  IF v_booking.parking_broadcast_expires_at IS NOT NULL
     AND v_booking.parking_broadcast_expires_at <= v_now THEN
    RAISE EXCEPTION 'offer_expired';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.parking_booking_broadcasts b
    WHERE b.booking_id = p_booking_id
      AND b.parking_id = p_parking_id
      AND b.response = 'pending'
  ) THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  v_check_in := to_date(
    COALESCE(v_booking.parking_check_in_date, v_booking.check_in_date),
    'MM-DD-YYYY'
  );
  v_check_out := to_date(
    COALESCE(v_booking.parking_check_out_date, v_booking.check_out_date),
    'MM-DD-YYYY'
  );
  IF v_check_in IS NULL OR v_check_out IS NULL OR v_check_out <= v_check_in THEN
    RAISE EXCEPTION 'invalid_dates';
  END IF;

  -- Occupancy: any non-terminal booking that still holds these nights.
  IF EXISTS (
    SELECT 1
    FROM public.guest_submissions gs
    WHERE gs.parking_id = p_parking_id
      AND gs.id <> p_booking_id
      AND gs.status IN (
        'PENDING_PAYMENT',
        'PENDING_REVIEW',
        'READY_FOR_CHECKIN',
        'COMPLETED'
      )
      AND daterange(
            to_date(COALESCE(gs.parking_check_in_date, gs.check_in_date), 'MM-DD-YYYY'),
            to_date(COALESCE(gs.parking_check_out_date, gs.check_out_date), 'MM-DD-YYYY'),
            '[)'
          ) && daterange(v_check_in, v_check_out, '[)')
  ) THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;

  -- Owner blocks: [start_date, end_date) overlaps the requested nights.
  IF EXISTS (
    SELECT 1
    FROM public.parking_blocked_dates pb
    WHERE pb.parking_id = p_parking_id
      AND pb.start_date < v_check_out
      AND pb.end_date > v_check_in
  ) THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;

  -- Same-day turnover buffer, sourced from the listing's own standard times (matches
  -- parkingBroadcast.ts / parkingBroadcastRanking.ts).
  v_check_in_time := COALESCE(
    NULLIF(v_parking.settings->>'checkInTime', '')::time,
    '14:00'::time
  );
  v_check_out_time := COALESCE(
    NULLIF(v_parking.settings->>'checkOutTime', '')::time,
    '12:00'::time
  );
  v_gap_minutes := EXTRACT(EPOCH FROM (v_check_in_time - v_check_out_time)) / 60.0;

  IF v_gap_minutes < v_turnover_minutes AND EXISTS (
    SELECT 1
    FROM public.guest_submissions gs
    WHERE gs.parking_id = p_parking_id
      AND gs.id <> p_booking_id
      AND gs.status IN (
        'PENDING_PAYMENT',
        'PENDING_REVIEW',
        'READY_FOR_CHECKIN',
        'COMPLETED'
      )
      AND (
        to_date(COALESCE(gs.parking_check_in_date, gs.check_in_date), 'MM-DD-YYYY') = v_check_out
        OR to_date(COALESCE(gs.parking_check_out_date, gs.check_out_date), 'MM-DD-YYYY') = v_check_in
      )
  ) THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;

  UPDATE public.guest_submissions
  SET status = 'PENDING_PAYMENT',
      status_updated_at = v_now,
      parking_id = p_parking_id,
      parking_claimed_at = v_now,
      parking_endorsement_note = NULLIF(btrim(COALESCE(p_endorsement_note, '')), ''),
      parking_payment_expires_at = p_payment_expires_at,
      updated_at = v_now
  WHERE id = p_booking_id
    AND status = 'PENDING_HOST_ACCEPTANCE'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  UPDATE public.parking_booking_broadcasts
  SET response = 'claimed', responded_at = v_now, response_reason = NULL
  WHERE booking_id = p_booking_id
    AND parking_id = p_parking_id;

  UPDATE public.parking_booking_broadcasts
  SET response = 'expired', responded_at = v_now, response_reason = 'other_host_claimed'
  WHERE booking_id = p_booking_id
    AND response = 'pending';

  RETURN v_row;
END;
$fn$;

COMMENT ON FUNCTION public.claim_parking_booking_slot(uuid, uuid, text, timestamptz) IS
  'Atomic first-Accept-wins claim. Serializes per parking with pg_advisory_xact_lock, re-checks '
  'occupancy, blocked nights, the 30-minute turnover buffer, listing status and the offer TTL, '
  'then writes PENDING_PAYMENT. Raises slot_unavailable / offer_expired / already_claimed.';

REVOKE ALL ON FUNCTION public.claim_parking_booking_slot(uuid, uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_parking_booking_slot(uuid, uuid, text, timestamptz)
  TO service_role;

-- 4) Host-on-behalf audit. Null for a guest self-submission; the host user id when a host
--    used the dashboard "New booking" flow (R-4).
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS created_by_host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.guest_submissions.created_by_host_user_id IS
  'Host user who submitted a parking request on a guest behalf. Null for guest self-service.';

COMMIT;
