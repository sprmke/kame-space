-- 17 — Analytics.
--
-- 180 page views over 90 days plus one AI performance review.
-- Safe to re-run.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_owner uuid := 'd74b9d44-6244-40f0-9160-7c281738e8c0';
BEGIN
  DELETE FROM public.property_page_views WHERE id::text LIKE '5eeda%';
  DELETE FROM public.property_analytics_reviews WHERE id::text LIKE '5eeda%';

  INSERT INTO public.property_page_views (
    id, property_id, viewed_at, session_id, referrer_host, utm_source, utm_medium,
    utm_campaign, device_class, is_bot
  )
  SELECT
    format('5eeda000-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_prop,
    now() - ((g.i / 2) || ' days')::interval - ((g.i % 2) * 7 || ' hours')::interval,
    'seed-session-' || (g.i / 2),
    (ARRAY['www.google.com','www.facebook.com','l.facebook.com','www.instagram.com','direct',NULL])[1 + (g.i % 6)],
    (ARRAY['google','facebook','instagram',NULL,NULL,NULL])[1 + (g.i % 6)],
    (ARRAY['organic','social','social',NULL,NULL,NULL])[1 + (g.i % 6)],
    CASE WHEN g.i % 12 = 0 THEN 'december-promo' END,
    (ARRAY['mobile','mobile','desktop','tablet'])[1 + (g.i % 4)],
    (g.i % 23 = 0)
  FROM generate_series(0, 179) AS g(i);

  INSERT INTO public.property_analytics_reviews (
    id, property_id, organization_id, period_start, period_end, generated_by, model,
    headline, score, score_delta, payload, is_latest
  )
  VALUES (
    '5eeda100-0000-4000-8000-000000000001', v_prop, v_org,
    CURRENT_DATE - 30, CURRENT_DATE, v_owner, 'local_seed',
    'Strong weekend demand, weak midweek conversion',
    78, 4,
    jsonb_build_object(
      'summary', 'Weekend occupancy is strong. Midweek stays convert below the portfolio average, mostly from a longer lead time.',
      'wins', jsonb_build_array('Weekend occupancy at 86%', 'Review score steady at 4.8'),
      'risks', jsonb_build_array('Midweek lead time is 18 days', 'Two cancellations mentioned price'),
      'actions', jsonb_build_array('Add a 2-night midweek discount', 'Refresh the first gallery photo')
    ),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    headline = EXCLUDED.headline,
    score = EXCLUDED.score,
    score_delta = EXCLUDED.score_delta,
    payload = EXCLUDED.payload,
    is_latest = true;

  -- Benchmark peer sample for the "How you compare" card.
  INSERT INTO public.platform_analytics_benchmark_cache (
    id, computed_at, sample_size, occupancy_values, adr_values,
    median_occupancy_rate, median_adr
  )
  VALUES (
    'local_seed_benchmark', now(), 48,
    '[0.42,0.55,0.61,0.67,0.72,0.78,0.81,0.86]'::jsonb,
    '[2800,3200,3600,4200,4600,5000,5400,5900]'::jsonb,
    0.72, 4500
  )
  ON CONFLICT (id) DO UPDATE SET
    computed_at = EXCLUDED.computed_at,
    sample_size = EXCLUDED.sample_size,
    occupancy_values = EXCLUDED.occupancy_values,
    adr_values = EXCLUDED.adr_values,
    median_occupancy_rate = EXCLUDED.median_occupancy_rate,
    median_adr = EXCLUDED.median_adr;

  RAISE NOTICE 'local seed: analytics seeded (% page views)', (SELECT count(*) FROM public.property_page_views WHERE property_id = v_prop AND id::text LIKE '5eeda%');
END $$;

