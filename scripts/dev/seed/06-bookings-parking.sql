-- 06 — Parking bookings.
--
-- 14 bookings on monaco-level-2-slot-27 covering every parking status, plus
-- broadcast and payment rows. Safe to re-run: replaces parking bookings tagged
-- booking_source = 'local_seed' for this parking.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
  v_batch uuid;
BEGIN
  DELETE FROM public.parking_payment_transactions
  WHERE parking_id = v_park AND booking_id IN (
    SELECT id FROM public.guest_submissions WHERE parking_id = v_park AND booking_source = 'local_seed'
  );

  DELETE FROM public.parking_booking_broadcasts
  WHERE parking_id = v_park AND booking_id IN (
    SELECT id FROM public.guest_submissions WHERE parking_id = v_park AND booking_source = 'local_seed'
  );

  DELETE FROM public.guest_submissions
  WHERE parking_id = v_park AND booking_source = 'local_seed';

  INSERT INTO public.guest_submissions (
    id, parking_id, status, booking_source,
    guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
    check_in_date, check_out_date, parking_check_in_date, parking_check_out_date,
    check_in_time, check_out_time, nationality, number_of_adults, number_of_children, number_of_nights,
    find_us, payment_receipt_url, valid_id_url,
    unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
    booking_rate, parking_rate_guest, parking_rate_paid, parking_payment_receipt_url,
    parking_booking_channel, requested_vehicle_type, parking_broadcast_expires_at,
    parking_claimed_at, status_updated_at, created_at, updated_at
  )
  SELECT
    format('5eed1100-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_park,
    (ARRAY[
      'PENDING_HOST_ACCEPTANCE','PENDING_PAYMENT','PENDING_REVIEW','READY_FOR_CHECKIN',
      'READY_FOR_CHECKOUT','COMPLETED','CANCELLED','NO_HOST_AVAILABLE',
      'PENDING_HOST_ACCEPTANCE','PENDING_PAYMENT','COMPLETED','READY_FOR_CHECKIN',
      'COMPLETED','CANCELLED'
    ])[g.i + 1],
    'local_seed',
    (ARRAY['Paolo','Bea','Carlo','Dana','Eli','Faith','Gio','Hazel','Icko','Jade','Kian','Lulu','Migo','Nina'])[g.i + 1],
    (ARRAY['Paolo','Bea','Carlo','Dana','Eli','Faith','Gio','Hazel','Icko','Jade','Kian','Lulu','Migo','Nina'])[g.i + 1]
      || ' ' || (ARRAY['Reyes','Santos','Cruz','Bautista','Ong','Lim','Tan','Garcia','Flores','Ramos','Mendoza','Villanueva','Torres','Aquino'])[g.i + 1],
    'parking' || g.i || '.demo@example.com',
    '0918' || lpad((2000000 + g.i * 311)::text, 7, '0'),
    (20 + g.i) || ' Demo Avenue, San Fernando, Pampanga',
    to_char(CURRENT_DATE + ((g.i - 5) * 4), 'MM-DD-YYYY'),
    to_char(CURRENT_DATE + ((g.i - 5) * 4) + 2, 'MM-DD-YYYY'),
    to_char(CURRENT_DATE + ((g.i - 5) * 4), 'MM-DD-YYYY'),
    to_char(CURRENT_DATE + ((g.i - 5) * 4) + 2, 'MM-DD-YYYY'),
    '13:00', '12:00', 'Filipino', 1, 0, 2,
    (ARRAY['Facebook','Instagram','Google Search','Walk-in','Friend'])[1 + (g.i % 5)],
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',
    'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&q=80',
    'Demo Parking Host', 'Monaco L2-27', 'Demo Parking Host', '0917 555 0202',
    700, 350, CASE WHEN g.i IN (5, 6, 10, 12) THEN 350 END,
    CASE WHEN g.i IN (5, 6, 10, 12) THEN 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80' END,
    CASE WHEN g.i % 4 = 0 THEN 'direct_link' ELSE 'standard' END,
    CASE WHEN g.i % 3 = 0 THEN 'motorcycle' ELSE 'car' END,
    CASE WHEN g.i < 9 THEN now() + interval '2 days' END,
    CASE WHEN g.i IN (3, 5, 10, 12) THEN now() - interval '1 day' END,
    now() - ((g.i % 10) || ' days')::interval,
    now() - ((g.i % 10 + 3) || ' days')::interval,
    now()
  FROM generate_series(0, 13) AS g(i);

  ---------------------------------------------------------------------------
  -- Broadcasts (host notification fan-out)
  ---------------------------------------------------------------------------
  INSERT INTO public.parking_booking_broadcasts (
    id, booking_id, parking_id, notified_at, responded_at, response, batch_number, host_gross_at_broadcast
  )
  SELECT
    format('5eed1200-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    format('5eed1100-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_park,
    now() - ((g.i + 1) || ' days')::interval,
    CASE WHEN g.i IN (3, 5, 10, 12) THEN now() - interval '1 day' END,
    CASE
      WHEN g.i IN (3, 5, 10, 12) THEN 'claimed'
      WHEN g.i = 7 THEN 'declined'
      ELSE 'pending'
    END,
    1,
    700
  FROM generate_series(0, 7) AS g(i);

  ---------------------------------------------------------------------------
  -- Payment transactions (paid + pending)
  ---------------------------------------------------------------------------
  INSERT INTO public.parking_payment_transactions (
    booking_id, parking_id, organization_id, guest_charge_total, host_gross_total,
    commission_pct, host_net_total, nights, provider, provider_reference, checkout_url,
    payment_method_type, currency, status, paid_at, disbursed_at, disbursed_by,
    disbursement_reference, disbursement_method, booking_channel
  )
  SELECT
    format('5eed1100-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_park, v_org, 700, 700, 0.10, 630, 2, 'paymongo',
    'cs_local_seed_' || g.i, NULL, 'gcash', 'PHP',
    CASE WHEN g.i IN (5, 6, 10, 12) THEN 'paid' ELSE 'pending' END,
    CASE WHEN g.i IN (5, 6, 10, 12) THEN now() - interval '2 days' END,
    CASE WHEN g.i = 5 THEN now() - interval '1 day' END,
    CASE WHEN g.i = 5 THEN 'd74b9d44-6244-40f0-9160-7c281738e8c0'::uuid END,
    CASE WHEN g.i = 5 THEN 'PAYOUT-LOCAL-001' END,
    'manual',
    CASE WHEN g.i % 4 = 0 THEN 'direct_link' ELSE 'standard' END
  FROM generate_series(0, 13) AS g(i)
  WHERE g.i IN (1, 2, 5, 6, 10, 12);

  RAISE NOTICE 'local seed: % parking bookings', (SELECT count(*) FROM public.guest_submissions WHERE parking_id = v_park AND booking_source = 'local_seed');
END $$;

