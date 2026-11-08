-- 20 — Guest portal.
--
-- Signed-in guest profile, saved listings, two requests and review ownership.
-- Guest trips and vouchers come from the seeded bookings (guest.demo@example.com
-- and the next_stay_voucher_* columns).
--
-- Safe to re-run.


DO $$
DECLARE
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_guest uuid := '5eed0000-0000-4000-8000-000000000001';
  v_voucher_booking uuid := '5eed1000-0000-4000-8000-000000000025';
BEGIN
  INSERT INTO public.guest_profiles (
    user_id, display_name, bio, avatar_url, phone, location_label
  )
  VALUES (
    v_guest, 'Demo Guest', 'Frequent Pampanga weekend traveler.',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80',
    '0917 555 0303', 'Metro Manila, Philippines'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    bio = EXCLUDED.bio,
    avatar_url = EXCLUDED.avatar_url,
    phone = EXCLUDED.phone,
    location_label = EXCLUDED.location_label,
    updated_at = now();

  DELETE FROM public.guest_saved_properties WHERE user_id = v_guest;
  INSERT INTO public.guest_saved_properties (user_id, property_slug)
  VALUES (v_guest, 'kame-home')
  ON CONFLICT DO NOTHING;

  DELETE FROM public.guest_requests WHERE guest_user_id = v_guest;

  INSERT INTO public.guest_requests (
    id, organization_id, property_id, guest_user_id, booking_id, kind, status, payload
  )
  VALUES
    ('5eedd100-0000-4000-8000-000000000001', v_org, v_prop, v_guest,
     '5eed1000-0000-4000-8000-000000000025', 'early_checkin_late_checkout', 'pending',
     '{"requestedCheckIn":"12:00","reason":"Flight arrives early"}'::jsonb),
    ('5eedd100-0000-4000-8000-000000000002', v_org, v_prop, v_guest,
     '5eed1000-0000-4000-8000-000000000030', 'booking_inquiry', 'approved',
     '{"question":"Is the pool open on weekdays?","answer":"Yes, 6am to 10pm."}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    payload = EXCLUDED.payload;

  UPDATE public.guest_reviews
  SET guest_user_id = v_guest
  WHERE id IN (
    '5eed6000-0000-4000-8000-000000000001',
    '5eed6000-0000-4000-8000-000000000005'
  );

  UPDATE public.guest_submissions
  SET next_stay_voucher_code = 'STAY10',
      next_stay_voucher_amount = 10,
      next_stay_voucher_awarded_at = now() - interval '10 days'
  WHERE id = v_voucher_booking;

  UPDATE public.guest_submissions
  SET next_stay_voucher_code = 'STAY15',
      next_stay_voucher_amount = 15,
      next_stay_voucher_awarded_at = now() - interval '25 days'
  WHERE id = '5eed1000-0000-4000-8000-000000000026';

  UPDATE public.guest_submissions
  SET next_stay_voucher_code = 'STAY20',
      next_stay_voucher_amount = 20,
      next_stay_voucher_awarded_at = now() - interval '40 days',
      next_stay_voucher_redeemed_at = now() - interval '5 days'
  WHERE id = '5eed1000-0000-4000-8000-000000000027';

  RAISE NOTICE 'local seed: guest portal seeded';
END $$;

