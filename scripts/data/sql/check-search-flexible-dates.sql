-- Check: flexible dates in public search (migration 20261341000000_search_flexible_dates).
--
-- Read-only in effect: everything runs in one transaction that is rolled back.
-- Local:
--   docker exec -i supabase_db_<project> psql -U postgres -d postgres -At \
--     < scripts/data/sql/check-search-flexible-dates.sql
-- Every row should read `pass`. Needs at least one indexed property and parking.

BEGIN;

CREATE TEMP TABLE flex_results (label text, expected integer, actual integer) ON COMMIT DROP;

DO $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
  -- Far enough out that seed data is unlikely to be booked.
  d date := (now() AT TIME ZONE 'Asia/Manila')::date + 200;
  prop uuid := (SELECT id FROM public.public_listing_search WHERE family = 'property' ORDER BY id LIMIT 1);
  park uuid := (SELECT id FROM public.public_listing_search WHERE family = 'parking' ORDER BY id LIMIT 1);
  q jsonb;
  base_exact integer;
  base_shift integer;
BEGIN
  IF prop IS NULL OR park IS NULL THEN
    RAISE EXCEPTION 'Need at least one indexed property and one parking to run this check';
  END IF;

  -- Baselines before any block: the requested night and the night two days earlier.
  q := jsonb_build_object('checkIn', d + 1, 'checkOut', d + 2, 'limit', 1);
  base_exact := (public.search_public_properties(q) ->> 'total')::int;
  base_shift := (public.search_public_properties(
    jsonb_build_object('checkIn', d - 1, 'checkOut', d, 'limit', 1)) ->> 'total')::int;

  -- Block the property on [d, d+3): every shift of up to 1 day is blocked, -2 is free.
  INSERT INTO public.property_blocked_dates (property_id, start_date, end_date, note)
  VALUES (prop, d, d + 3, 'flex check');

  INSERT INTO flex_results SELECT 'property exact drops the blocked listing', base_exact - 1,
    (public.search_public_properties(q) ->> 'total')::int;
  INSERT INTO flex_results SELECT 'property flexDays 0 is exact', base_exact - 1,
    (public.search_public_properties(q || '{"flexDays":0}') ->> 'total')::int;
  INSERT INTO flex_results SELECT 'property flexDays 1 still blocked', base_exact - 1,
    (public.search_public_properties(q || '{"flexDays":1}') ->> 'total')::int;
  INSERT INTO flex_results SELECT 'property flexDays 2 finds the free shift', GREATEST(base_exact, base_shift),
    (public.search_public_properties(q || '{"flexDays":2}') ->> 'total')::int;

  -- Today guard: block [today, today+5) and ask for today+1 with 3 days of flex. The only
  -- free shifts start before today, which flexible search never offers.
  DELETE FROM public.property_blocked_dates WHERE property_id = prop AND note = 'flex check';
  q := jsonb_build_object('checkIn', v_today + 1, 'checkOut', v_today + 2, 'flexDays', 3, 'limit', 1);
  base_exact := (public.search_public_properties(q) ->> 'total')::int;
  INSERT INTO public.property_blocked_dates (property_id, start_date, end_date, note)
  VALUES (prop, v_today, v_today + 5, 'flex check');
  INSERT INTO flex_results SELECT 'property flex never shifts before today', base_exact - 1,
    (public.search_public_properties(q) ->> 'total')::int;

  -- Flexible results always include the exact ones, on any data: for one-night stays from a
  -- week ago to a week out, at every offered flex, count windows where flex returns fewer.
  INSERT INTO flex_results
  SELECT 'flex never returns fewer than exact (properties + parkings)', 0, count(*)::int
  FROM generate_series(-7, 7) AS w(offset_days)
  CROSS JOIN unnest(ARRAY[1, 2, 3, 7]) AS f(days)
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'checkIn', v_today + w.offset_days, 'checkOut', v_today + w.offset_days + 1, 'limit', 1
    ) AS exact_q
  ) AS q1
  WHERE (public.search_public_properties(q1.exact_q || jsonb_build_object('flexDays', f.days)) ->> 'total')::int
          < (public.search_public_properties(q1.exact_q) ->> 'total')::int
     OR (public.search_public_parkings(q1.exact_q || jsonb_build_object('flexDays', f.days)) ->> 'total')::int
          < (public.search_public_parkings(q1.exact_q) ->> 'total')::int;

  -- Parking: same window rules.
  q := jsonb_build_object('checkIn', d + 1, 'checkOut', d + 2, 'limit', 1);
  base_exact := (public.search_public_parkings(q) ->> 'total')::int;
  INSERT INTO public.parking_blocked_dates (parking_id, start_date, end_date, note)
  VALUES (park, d, d + 3, 'flex check');
  INSERT INTO flex_results SELECT 'parking exact drops the blocked slot', base_exact - 1,
    (public.search_public_parkings(q) ->> 'total')::int;
  INSERT INTO flex_results SELECT 'parking flexDays 2 finds the free shift', base_exact,
    (public.search_public_parkings(q || '{"flexDays":2}') ->> 'total')::int;
END;
$$;

SELECT label, expected, actual, CASE WHEN expected = actual THEN 'pass' ELSE 'FAIL' END AS result
FROM flex_results;

ROLLBACK;
