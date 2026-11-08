-- 15 — Notifications.
--
-- 12 notifications across the main types (half unread), read receipts for the
-- owner and notification preferences. Safe to re-run.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_owner uuid := 'd74b9d44-6244-40f0-9160-7c281738e8c0';
  v_conv uuid := '5eed5100-0000-4000-8000-000000000001';
BEGIN
  DELETE FROM public.notification_reads WHERE notification_id::text LIKE '5eed9%';
  DELETE FROM public.notifications WHERE id::text LIKE '5eed9%';

  INSERT INTO public.notifications (
    id, organization_id, property_id, type, title, body, booking_id, conversation_id,
    metadata, dedupe_key, created_at
  )
  VALUES
    ('5eed9000-0000-4000-8000-000000000001', v_org, v_prop, 'booking_pending_review',
     'New booking request', 'June Vale requested 3 nights at Monaco 2604.',
     '5eed1000-0000-4000-8000-000000000028', NULL, '{}'::jsonb, 'seed-n-001', now() - interval '2 hours'),
    ('5eed9000-0000-4000-8000-000000000002', v_org, v_prop, 'inbox_new_message',
     'New guest message', 'Mika Santos asked about this weekend availability.',
     NULL, v_conv, '{}'::jsonb, 'seed-n-002', now() - interval '3 hours'),
    ('5eed9000-0000-4000-8000-000000000003', v_org, v_prop, 'booking_ready_for_checkin',
     'Guest arriving today', 'Lia Parks checked in today at 2pm.', NULL, NULL, '{}'::jsonb, 'seed-n-003', now() - interval '5 hours'),
    ('5eed9000-0000-4000-8000-000000000004', v_org, v_prop, 'booking_ready_for_checkout',
     'Checkout due today', 'Marco Diaz checks out at 11am.', NULL, NULL, '{}'::jsonb, 'seed-n-004', now() - interval '7 hours'),
    ('5eed9000-0000-4000-8000-000000000005', v_org, v_prop, 'booking_sd_refund_due',
     'Security deposit refund due', 'Owen Frost is waiting for a refund.', NULL, NULL, '{}'::jsonb, 'seed-n-005', now() - interval '1 day'),
    ('5eed9000-0000-4000-8000-000000000006', v_org, v_prop, 'booking_gaf_auto_approved',
     'GAF auto-approved', 'The uploaded GAF for Quinn Hale passed validation.', NULL, NULL, '{}'::jsonb, 'seed-n-006', now() - interval '2 days'),
    ('5eed9000-0000-4000-8000-000000000007', v_org, v_prop, 'review_received',
     'New 5-star review', 'June V. left a review on Monaco 2604.', NULL, NULL, '{}'::jsonb, 'seed-n-007', now() - interval '3 days'),
    ('5eed9000-0000-4000-8000-000000000008', v_org, v_prop, 'maintenance_guest_reported',
     'Guest reported a maintenance issue', 'Aircon in the second bedroom is noisy.', NULL, NULL, '{}'::jsonb, 'seed-n-008', now() - interval '4 days'),
    ('5eed9000-0000-4000-8000-000000000009', v_org, v_prop, 'smart_pricing_updated',
     'Smart pricing updated 12 nights', 'Rates changed for the next long weekend.', NULL, NULL, '{}'::jsonb, 'seed-n-009', now() - interval '5 days'),
    ('5eed9000-0000-4000-8000-000000000010', v_org, v_prop, 'calendar_sync_failing',
     'Airbnb calendar sync failing', 'The last three syncs returned an error.', NULL, NULL, '{}'::jsonb, 'seed-n-010', now() - interval '6 days'),
    ('5eed9000-0000-4000-8000-000000000011', v_org, v_prop, 'guest_request_submitted',
     'Guest requested late checkout', 'Request is waiting for your approval.', NULL, NULL, '{}'::jsonb, 'seed-n-011', now() - interval '7 days'),
    ('5eed9000-0000-4000-8000-000000000012', v_org, v_prop, 'analytics_review_updated',
     'AI performance review ready', 'The monthly analytics review was generated.', NULL, NULL, '{}'::jsonb, 'seed-n-012', now() - interval '8 days')
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    created_at = EXCLUDED.created_at;

  INSERT INTO public.notification_reads (id, notification_id, user_id, read_at)
  SELECT
    format('5eed9100-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    format('5eed9000-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_owner,
    now() - ((g.i + 1) || ' hours')::interval
  FROM generate_series(6, 11) AS g(i)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_preferences (
    user_id, muted_groups, quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
    quiet_hours_timezone
  )
  VALUES (
    v_owner, ARRAY['analytics']::text[], true, '22:00', '07:00', 'Asia/Manila'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    muted_groups = EXCLUDED.muted_groups,
    quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
    quiet_hours_start = EXCLUDED.quiet_hours_start,
    quiet_hours_end = EXCLUDED.quiet_hours_end,
    quiet_hours_timezone = EXCLUDED.quiet_hours_timezone,
    updated_at = now();

  RAISE NOTICE 'local seed: notifications seeded';
END $$;

