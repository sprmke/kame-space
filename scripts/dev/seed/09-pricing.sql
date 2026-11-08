-- 09 — Pricing and calendar.
--
-- Property: 12 date overrides, 6 blocked dates, smart-pricing settings and one
-- completed run with recommendations, plus a calendar feed and sync events.
-- Parking: 8 date overrides and 4 blocked dates.
--
-- Safe to re-run.


DO $$
DECLARE
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
  v_run uuid := '5eed3100-0000-4000-8000-000000000001';
  v_feed uuid := '5eed3200-0000-4000-8000-000000000001';
BEGIN
  DELETE FROM public.property_pricing_date_overrides WHERE property_id = v_prop;
  DELETE FROM public.parking_pricing_date_overrides WHERE parking_id = v_park;
  DELETE FROM public.property_blocked_dates WHERE property_id = v_prop;
  DELETE FROM public.parking_blocked_dates WHERE parking_id = v_park;
  DELETE FROM public.property_smart_pricing_recommendations WHERE property_id = v_prop;
  DELETE FROM public.property_smart_pricing_runs WHERE property_id = v_prop;
  DELETE FROM public.calendar_sync_events WHERE feed_id = v_feed;

  INSERT INTO public.property_pricing_date_overrides (property_id, pricing_date, nightly_rate)
  SELECT v_prop, CURRENT_DATE + g.i, CASE WHEN g.i % 3 = 0 THEN 6200 WHEN g.i % 3 = 1 THEN 5400 ELSE 4800 END
  FROM generate_series(1, 12) AS g(i)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.property_blocked_dates (id, property_id, start_date, end_date, note, source)
  VALUES
    ('5eed3300-0000-4000-8000-000000000001', v_prop, CURRENT_DATE + 20, CURRENT_DATE + 22, 'Owner stay', 'manual'),
    ('5eed3300-0000-4000-8000-000000000002', v_prop, CURRENT_DATE + 35, CURRENT_DATE + 36, 'Deep cleaning', 'manual'),
    ('5eed3300-0000-4000-8000-000000000003', v_prop, CURRENT_DATE + 48, CURRENT_DATE + 51, 'Unit repairs', 'manual'),
    ('5eed3300-0000-4000-8000-000000000004', v_prop, CURRENT_DATE + 70, CURRENT_DATE + 71, 'Holiday hold', 'manual'),
    ('5eed3300-0000-4000-8000-000000000005', v_prop, CURRENT_DATE + 90, CURRENT_DATE + 92, 'Owner stay', 'manual'),
    ('5eed3300-0000-4000-8000-000000000006', v_prop, CURRENT_DATE + 110, CURRENT_DATE + 111, 'Maintenance', 'manual')
  ON CONFLICT (id) DO UPDATE SET
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    note = EXCLUDED.note;

  INSERT INTO public.parking_pricing_date_overrides (parking_id, pricing_date, nightly_rate)
  SELECT v_park, CURRENT_DATE + g.i, CASE WHEN g.i % 2 = 0 THEN 400 ELSE 380 END
  FROM generate_series(1, 8) AS g(i)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.parking_blocked_dates (id, parking_id, start_date, end_date, note)
  VALUES
    ('5eed3400-0000-4000-8000-000000000001', v_park, CURRENT_DATE + 15, CURRENT_DATE + 16, 'Slot resealing'),
    ('5eed3400-0000-4000-8000-000000000002', v_park, CURRENT_DATE + 30, CURRENT_DATE + 31, 'Owner use'),
    ('5eed3400-0000-4000-8000-000000000003', v_park, CURRENT_DATE + 45, CURRENT_DATE + 46, 'Building maintenance'),
    ('5eed3400-0000-4000-8000-000000000004', v_park, CURRENT_DATE + 60, CURRENT_DATE + 61, 'Owner use')
  ON CONFLICT (id) DO UPDATE SET
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    note = EXCLUDED.note;

  INSERT INTO public.property_smart_pricing_settings (
    property_id, enabled, mode, base_source, base_weekday, base_weekend, min_price, max_price,
    aggressiveness, dow_adjust, season_rules, lead_time, orphan_gap_discount_pct,
    occupancy_tilt_enabled, los_discounts, rounding, window_days, ai_rationale_enabled, last_run_at
  )
  VALUES (
    v_prop, true, 'review_only', 'custom', 4500, 5200, 3800, 7500, 'balanced',
    '{"mon":0,"tue":0,"wed":0,"thu":0,"fri":10,"sat":15,"sun":10}'::jsonb,
    '[]'::jsonb,
    '[{"days":0,"adjustPct":0},{"days":3,"adjustPct":-5},{"days":14,"adjustPct":-10}]'::jsonb,
    15, true,
    '[{"nights":2,"discountPct":0},{"nights":4,"discountPct":5},{"nights":7,"discountPct":12}]'::jsonb,
    'r100', 90, true, now() - interval '2 days'
  )
  ON CONFLICT (property_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    mode = EXCLUDED.mode,
    base_weekday = EXCLUDED.base_weekday,
    base_weekend = EXCLUDED.base_weekend,
    min_price = EXCLUDED.min_price,
    max_price = EXCLUDED.max_price,
    updated_at = now();

  INSERT INTO public.property_smart_pricing_runs (
    id, property_id, trigger, window_start, window_end, nights_computed, nights_changed,
    avg_delta_pct, ai_used, credits_consumed, payload, ai_rationales
  )
  VALUES (
    v_run, v_prop, 'manual_apply', CURRENT_DATE, CURRENT_DATE + 90, 90, 12, 6.5, true, 120,
    '{"source":"local_seed"}'::jsonb,
    '[{"date":"next-weekend","rationale":"Long weekend demand in Pampanga"}]'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    window_start = EXCLUDED.window_start,
    window_end = EXCLUDED.window_end,
    nights_computed = EXCLUDED.nights_computed,
    nights_changed = EXCLUDED.nights_changed;

  INSERT INTO public.property_smart_pricing_recommendations (
    property_id, pricing_date, base_rate, recommended_rate, factors, applied, source, run_id
  )
  SELECT
    v_prop, CURRENT_DATE + g.i, 4500, 4500 + (g.i % 3) * 300,
    jsonb_build_object('occupancy', 0.72, 'leadTimeDays', g.i, 'weekend', g.i % 7 < 2),
    false, 'engine_ai', v_run
  FROM generate_series(1, 3) AS g(i)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.property_calendar_feeds (
    id, property_id, provider, label, ics_url_encrypted, is_active, create_bookings
  )
  VALUES (
    v_feed, v_prop, 'airbnb', 'Airbnb calendar', 'local-seed-placeholder-ics', false, false
  )
  ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label,
    is_active = EXCLUDED.is_active;

  INSERT INTO public.calendar_sync_events (
    feed_id, run_id, external_uid, action, start_date, end_date, summary, detail
  )
  SELECT
    v_feed, v_run,
    'seed-event-' || g.i,
    (ARRAY['block_created','block_updated','skipped','conflict_detected','booking_created','skipped'])[g.i + 1],
    CURRENT_DATE + 10 + g.i,
    CURRENT_DATE + 11 + g.i,
    'Airbnb reservation ' || g.i,
    '{"source":"local_seed"}'::jsonb
  FROM generate_series(0, 5) AS g(i);

  RAISE NOTICE 'local seed: pricing and calendar seeded';
END $$;

