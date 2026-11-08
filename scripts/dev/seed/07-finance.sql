-- 07 — Finance.
--
-- 45 line items across property and parking, six months of history, plus a
-- cancellation request, two refunds and a paid subscription transaction.
--
-- Safe to re-run: replaces rows tagged created_by = 'local_seed'.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
  v_cancel_booking uuid := '5eed1000-0000-4000-8000-000000000016';
  v_sd_booking uuid := '5eed1000-0000-4000-8000-000000000018';
  v_sub uuid;
  v_plan uuid;
BEGIN
  DELETE FROM public.finance_line_items WHERE created_by = 'local_seed';

  INSERT INTO public.finance_line_items (
    kind, label, amount, category, occurred_on, notes, property_id, paid_at, created_by
  )
  SELECT
    CASE WHEN g.i % 3 = 0 THEN 'income' ELSE 'expense' END,
    (ARRAY[
      'Guest booking payment','Cleaning fee','Electricity bill','Water bill','Internet bill',
      'Association dues','Consumables restock','Laundry service','Aircon cleaning','Plumbing repair',
      'Guest additional fee','Platform payout','Condo insurance','Pest control','Deep cleaning',
      'Booking balance','Towels and linens','Kitchen supplies','Wi-Fi upgrade','Elevator maintenance'
    ])[1 + (g.i % 20)],
    CASE WHEN g.i % 3 = 0 THEN 3500 + (g.i % 5) * 750 ELSE 450 + (g.i % 9) * 320 END,
    (ARRAY['Guest Income','Cleaning','Utilities','Association Dues','Supplies','Maintenance','Repairs','Platform Fees'])[1 + (g.i % 8)],
    CURRENT_DATE - (g.i * 5),
    'Local demo finance row',
    v_prop,
    CASE WHEN g.i % 4 <> 0 THEN now() - (g.i || ' days')::interval END,
    'local_seed'
  FROM generate_series(0, 29) AS g(i);

  INSERT INTO public.finance_line_items (
    kind, label, amount, category, occurred_on, notes, parking_id, paid_at, created_by
  )
  SELECT
    CASE WHEN g.i % 3 = 1 THEN 'expense' ELSE 'income' END,
    (ARRAY[
      'Parking nightly rate','Parking supplies','Slot signage','Floor cleaning','Payout transfer',
      'Guest parking fee','Barrier repair','Lighting replacement'
    ])[1 + (g.i % 8)],
    CASE WHEN g.i % 3 = 1 THEN 320 + (g.i % 5) * 180 ELSE 350 + (g.i % 4) * 350 END,
    (ARRAY['Parking Income','Parking Supplies','Parking Maintenance','Parking Payout'])[1 + (g.i % 4)],
    CURRENT_DATE - (g.i * 6),
    'Local demo parking finance row',
    v_park,
    CASE WHEN g.i % 3 <> 0 THEN now() - (g.i || ' days')::interval END,
    'local_seed'
  FROM generate_series(0, 14) AS g(i);

  ---------------------------------------------------------------------------
  -- Cancellation request + refunds on seeded bookings
  ---------------------------------------------------------------------------
  INSERT INTO public.booking_cancellation_requests (
    id, booking_id, property_id, status, reason_code, reason_note, host_message,
    requested_at, resolved_at, resolved_by
  )
  VALUES (
    '5eed2100-0000-4000-8000-000000000001', v_cancel_booking, v_prop, 'approved',
    'guest_emergency', 'Family emergency, unable to travel.', 'Approved, refund processed.',
    now() - interval '9 days', now() - interval '8 days',
    'd74b9d44-6244-40f0-9160-7c281738e8c0'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    reason_code = EXCLUDED.reason_code,
    reason_note = EXCLUDED.reason_note,
    host_message = EXCLUDED.host_message,
    resolved_at = EXCLUDED.resolved_at,
    resolved_by = EXCLUDED.resolved_by,
    updated_at = now();

  INSERT INTO public.booking_refunds (
    id, booking_id, property_id, organization_id, kind, amount_due_php, amount_paid_php,
    breakdown, status, method, notes, created_by
  )
  VALUES
    (
      '5eed2200-0000-4000-8000-000000000001', v_cancel_booking, v_prop, v_org, 'cancellation',
      3500, 3500,
      '{"bookingRate":3500,"downPayment":2000,"balance":1500,"securityDeposit":0}'::jsonb,
      'sent', 'same_phone', 'Approved cancellation refund', 'd74b9d44-6244-40f0-9160-7c281738e8c0'
    ),
    (
      '5eed2200-0000-4000-8000-000000000002', v_sd_booking, v_prop, v_org, 'goodwill',
      500, NULL,
      '{"securityDeposit":2000,"deduction":1500,"refund":500}'::jsonb,
      'awaiting_guest_details', 'other_bank', 'Guest has not sent bank details yet',
      'd74b9d44-6244-40f0-9160-7c281738e8c0'
    )
  ON CONFLICT (id) DO UPDATE SET
    amount_due_php = EXCLUDED.amount_due_php,
    amount_paid_php = EXCLUDED.amount_paid_php,
    breakdown = EXCLUDED.breakdown,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    updated_at = now();

  ---------------------------------------------------------------------------
  -- Subscription payment (paid)
  ---------------------------------------------------------------------------
  SELECT id INTO v_sub FROM public.org_subscriptions WHERE organization_id = v_org LIMIT 1;
  SELECT id INTO v_plan FROM public.pricing_plans WHERE code = 'pro' LIMIT 1;

  INSERT INTO public.org_payment_transactions (
    id, organization_id, org_subscription_id, plan_id, property_ids, provider,
    provider_reference, checkout_url, payment_method_type, amount, currency, status, paid_at
  )
  VALUES (
    '5eed2300-0000-4000-8000-000000000001', v_org, v_sub, v_plan,
    jsonb_build_array(v_prop), 'paymongo', 'cs_local_seed_subscription',
    NULL, 'card', 1799, 'PHP', 'paid', now() - interval '30 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    paid_at = EXCLUDED.paid_at;

  RAISE NOTICE 'local seed: finance seeded (% line items)', (SELECT count(*) FROM public.finance_line_items WHERE created_by = 'local_seed');
END $$;

