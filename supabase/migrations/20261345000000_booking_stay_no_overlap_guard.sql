-- DB-level double-booking guard (ledger PR-032).
--
-- Why a trigger and not an EXCLUDE constraint:
--   * `guest_submissions` holds real production rows. An exclusion constraint validates every
--     existing row when it is added, and PostgreSQL has no `NOT VALID` form for exclusion
--     constraints, so one legacy overlap would abort a deploy.
--   * OTA imports are recorded even when they overlap a direct booking. That overlap is the
--     conflict a host must resolve, not a reason to drop the reservation, so those rows are
--     exempt from the guard.
-- The trigger still enforces at write time inside the database, which closes the check-then-
-- insert race the app-level check leaves open. A per-property advisory lock serializes the
-- overlap check so two concurrent inserts cannot both pass.
--
-- Occupied range is half-open [check-in, check-out) and a same-day stay occupies one night
-- ([check-in, check-in + 1)), matching `DatabaseService.checkOverlappingBookings` and the
-- public search SQL.

-- IMMUTABLE mirror of the `check_in_date_sql` / `check_out_date_sql` generated expression.
-- Generated columns are computed after BEFORE triggers run, so the trigger cannot read the
-- NEW row's generated values and has to parse the text columns itself.
CREATE OR REPLACE FUNCTION public.booking_text_to_date(p_value text)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_value ~ '^\d{4}-\d{2}-\d{2}$'
      AND substring(p_value FROM 6 FOR 2)::int BETWEEN 1 AND 12
      AND substring(p_value FROM 9 FOR 2)::int BETWEEN 1 AND
        extract(day FROM (
          make_date(substring(p_value FROM 1 FOR 4)::int, substring(p_value FROM 6 FOR 2)::int, 1)
          + interval '1 month' - interval '1 day'
        ))::int
    THEN
      make_date(
        substring(p_value FROM 1 FOR 4)::int,
        substring(p_value FROM 6 FOR 2)::int,
        substring(p_value FROM 9 FOR 2)::int
      )
    WHEN p_value ~ '^\d{2}-\d{2}-\d{4}$'
      AND substring(p_value FROM 1 FOR 2)::int BETWEEN 1 AND 12
      AND substring(p_value FROM 4 FOR 2)::int BETWEEN 1 AND
        extract(day FROM (
          make_date(substring(p_value FROM 7 FOR 4)::int, substring(p_value FROM 1 FOR 2)::int, 1)
          + interval '1 month' - interval '1 day'
        ))::int
    THEN
      make_date(
        substring(p_value FROM 7 FOR 4)::int,
        substring(p_value FROM 1 FOR 2)::int,
        substring(p_value FROM 4 FOR 2)::int
      )
    ELSE NULL
  END
$$;

COMMENT ON FUNCTION public.booking_text_to_date(text) IS
  'Parses a guest_submissions stay date (MM-DD-YYYY or YYYY-MM-DD) to a date, NULL when malformed. Matches the check_in_date_sql / check_out_date_sql generated columns.';

REVOKE ALL ON FUNCTION public.booking_text_to_date(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_text_to_date(text) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_booking_stay_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_in date;
  v_check_out date;
  v_conflict_id uuid;
BEGIN
  -- Only direct stays with a property and parseable dates are guarded.
  IF NEW.property_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('CANCELLED', 'IMPORTED') THEN
    RETURN NEW;
  END IF;
  -- OTA feed imports are recorded on purpose; the calendar conflict flow surfaces the overlap
  -- to the host instead of losing the reservation.
  IF NEW.external_feed_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_check_in := COALESCE(public.booking_text_to_date(NEW.check_in_date), NEW.check_in_date_sql);
  v_check_out := COALESCE(public.booking_text_to_date(NEW.check_out_date), NEW.check_out_date_sql);
  IF v_check_in IS NULL OR v_check_out IS NULL THEN
    RETURN NEW;
  END IF;

  -- An update that does not touch the stay or the blocking status cannot create a new overlap.
  IF TG_OP = 'UPDATE'
    AND OLD.property_id = NEW.property_id
    AND OLD.check_in_date IS NOT DISTINCT FROM NEW.check_in_date
    AND OLD.check_out_date IS NOT DISTINCT FROM NEW.check_out_date
    AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('booking_stay_no_overlap:' || NEW.property_id::text));

  SELECT b.id
  INTO v_conflict_id
  FROM public.guest_submissions b
  WHERE b.property_id = NEW.property_id
    AND b.id <> NEW.id
    AND b.status NOT IN ('CANCELLED', 'IMPORTED')
    AND b.check_in_date_sql IS NOT NULL
    AND b.check_out_date_sql IS NOT NULL
    AND daterange(
          b.check_in_date_sql,
          GREATEST(b.check_out_date_sql, b.check_in_date_sql + 1),
          '[)'
        )
        && daterange(
          v_check_in,
          GREATEST(v_check_out, v_check_in + 1),
          '[)'
        )
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'BOOKING_DATE_CONFLICT: stay overlaps booking %', v_conflict_id
      USING ERRCODE = '23P01',
            CONSTRAINT = 'guest_submissions_no_overlapping_stays',
            DETAIL = 'Requested dates overlap an existing booking for this property.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_booking_stay_no_overlap() IS
  'Rejects a direct stay that overlaps another non-cancelled stay on the same property. Serialized per property with an advisory lock. OTA imports bypass and are surfaced through the calendar conflict flow.';

REVOKE ALL ON FUNCTION public.enforce_booking_stay_no_overlap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guest_submissions_no_overlap ON public.guest_submissions;
CREATE TRIGGER trg_guest_submissions_no_overlap
  BEFORE INSERT OR UPDATE OF property_id, check_in_date, check_out_date, status
  ON public.guest_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_stay_no_overlap();
