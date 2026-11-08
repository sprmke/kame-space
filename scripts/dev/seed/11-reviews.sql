-- 11 — Reviews.
--
-- 10 published guest reviews (2 with photos), 3 host reviews, 1 reported review
-- and one enabled review-automation rule.
--
-- Safe to re-run.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_owner uuid := 'd74b9d44-6244-40f0-9160-7c281738e8c0';
  v_review uuid := '5eed6000-0000-4000-8000-000000000001';
BEGIN
  DELETE FROM public.review_reports WHERE id::text LIKE '5eed6%';
  DELETE FROM public.host_guest_reviews WHERE id::text LIKE '5eed6%';
  DELETE FROM public.guest_reviews WHERE id::text LIKE '5eed6%';

  INSERT INTO public.guest_reviews (
    id, property_id, booking_id, star_rating, review_text, media_urls, guest_display_name,
    feedback_tags, organization_id, category_ratings, source, status, submitted_at, published_at
  )
  SELECT
    format('5eed6000-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_prop,
    format('5eed1000-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    4 + (g.i % 2),
    (ARRAY[
      'Spotless unit and the lagoon view is even better in person. Host replied within minutes.',
      'Easy self check-in, fast Wi-Fi, and the parking slot was a lifesaver. Would book again.',
      'Great location near the mall. Kitchen had everything we needed for a long weekend.',
      'Quiet floor and very comfortable beds. The balcony is perfect for coffee in the morning.',
      'Host was flexible with our late arrival and left clear instructions. Smooth stay overall.',
      'Clean, spacious, and exactly as pictured. The pool access made the trip for the kids.',
      'Good value for a two-bedroom unit. Aircon was cold and the water pressure was strong.',
      'We stayed for a week and the unit felt like home. Laundry area was a nice surprise.',
      'Responsive host and a very smooth turnover. The welcome snacks were a thoughtful touch.',
      'Second time staying here. Consistent quality and the building feels safe at night.'
    ])[g.i + 1],
    CASE WHEN g.i IN (0, 4) THEN jsonb_build_array(
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80'
    ) ELSE '[]'::jsonb END,
    (ARRAY['June V.','Lia P.','Marco D.','Owen F.','Quinn H.','Sam I.','Uma J.','Vince K.','Wendy L.','Xander M.'])[g.i + 1],
    (CASE g.i
      WHEN 0 THEN ARRAY['clean','location']
      WHEN 1 THEN ARRAY['checkin','parking']
      WHEN 2 THEN ARRAY['location','value']
      WHEN 3 THEN ARRAY['quiet','comfort']
      WHEN 4 THEN ARRAY['host','checkin']
      WHEN 5 THEN ARRAY['clean','pool']
      WHEN 6 THEN ARRAY['value','aircon']
      WHEN 7 THEN ARRAY['long-stay','laundry']
      WHEN 8 THEN ARRAY['host','welcome']
      ELSE ARRAY['returning','safety']
    END)::text[],
    v_org,
    jsonb_build_object('cleanliness', 5, 'communication', 5, 'location', 4 + (g.i % 2), 'value', 4),
    'trip',
    'published',
    now() - ((20 + g.i * 4) || ' days')::interval,
    now() - ((19 + g.i * 4) || ' days')::interval
  FROM generate_series(0, 9) AS g(i);

  INSERT INTO public.host_guest_reviews (
    id, booking_id, property_id, organization_id, guest_identity_key,
    overall_rating, cleanliness_rating, communication_rating, house_rules_rating,
    would_host_again, strength_tags, review_text, author_user_id, status, submitted_at, published_at
  )
  VALUES
    ('5eed6100-0000-4000-8000-000000000001', '5eed1000-0000-4000-8000-000000000002', v_prop, v_org,
     'lia.parks.demo@example.com', 5, 5, 5, 5, true, ARRAY['clean','respectful'],
     'Lia left the unit tidy and followed every house rule.', v_owner, 'published', now() - interval '25 days', now() - interval '24 days'),
    ('5eed6100-0000-4000-8000-000000000002', '5eed1000-0000-4000-8000-000000000003', v_prop, v_org,
     'marco.diaz.demo@example.com', 4, 4, 5, 5, true, ARRAY['communicative'],
     'Clear communication and an easy turnover.', v_owner, 'published', now() - interval '20 days', now() - interval '19 days'),
    ('5eed6100-0000-4000-8000-000000000003', '5eed1000-0000-4000-8000-000000000005', v_prop, v_org,
     'quinn.hale.demo@example.com', 5, 5, 4, 5, true, ARRAY['quiet','clean'],
     'Quiet guest, left the unit in great shape.', v_owner, 'submitted', now() - interval '12 days', NULL)
  ON CONFLICT (id) DO UPDATE SET
    review_text = EXCLUDED.review_text,
    status = EXCLUDED.status,
    published_at = EXCLUDED.published_at;

  INSERT INTO public.review_reports (
    id, review_kind, review_id, reporter_user_id, reporter_side, reason, details, status
  )
  VALUES (
    '5eed6200-0000-4000-8000-000000000001', 'guest_review', v_review, v_owner, 'host',
    'irrelevant', 'The review mentions a nearby restaurant and does not describe the stay at all.',
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    details = EXCLUDED.details,
    status = EXCLUDED.status;

  INSERT INTO public.review_automation_rules (
    property_id, organization_id, enabled, delay_days, overall_rating, cleanliness_rating,
    communication_rating, house_rules_rating, would_host_again, templates,
    skip_on_issue_tags, skip_on_open_maintenance, skip_on_sd_deduction, updated_by
  )
  VALUES (
    v_prop, v_org, true, 3, 4, 4, 4, 4, true,
    ARRAY[
      'Thank you for staying with us. We would love to host you again.',
      'It was a pleasure hosting you. Safe travels.',
      'Thanks for the kind review. Hope to see you on your next Pampanga trip.'
    ],
    true, true, true, v_owner
  )
  ON CONFLICT (property_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    delay_days = EXCLUDED.delay_days,
    templates = EXCLUDED.templates,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  RAISE NOTICE 'local seed: reviews seeded';
END $$;

