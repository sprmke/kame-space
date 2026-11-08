-- 12 — Inbox.
--
-- Facebook, Instagram and web-chat threads for the property and parking, with
-- unread counts, a handoff, an AI reply and thread metrics. Safe to re-run.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
  v_guest uuid := '5eed0000-0000-4000-8000-000000000001';
  v_fb uuid := '5eed5000-0000-4000-8000-000000000001';
  v_ig uuid := '5eed5000-0000-4000-8000-000000000002';
  v_web uuid := '5eed5000-0000-4000-8000-000000000003';
BEGIN
  DELETE FROM public.inbox_thread_metrics WHERE conversation_id::text LIKE '5eed5%';
  DELETE FROM public.social_messages WHERE conversation_id::text LIKE '5eed5%';
  DELETE FROM public.social_conversations WHERE id::text LIKE '5eed5%';

  INSERT INTO public.social_channel_connections (
    id, organization_id, platform, external_account_id, display_name, status, property_id,
    webhook_subscribed_at, last_sync_at
  )
  VALUES
    (v_fb, v_org, 'facebook', 'seed-fb-page-001', 'Kame Space Demo Page', 'connected', v_prop,
     now() - interval '40 days', now() - interval '2 hours'),
    (v_ig, v_org, 'instagram', 'seed-ig-account-001', '@kamespace.demo', 'connected', v_prop,
     now() - interval '40 days', now() - interval '1 hour'),
    (v_web, v_org, 'web', 'local-web-chat', 'Web chat', 'connected', v_prop,
     NULL, now() - interval '30 minutes')
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    status = EXCLUDED.status,
    property_id = EXCLUDED.property_id,
    last_sync_at = EXCLUDED.last_sync_at,
    updated_at = now();

  INSERT INTO public.social_conversations (
    id, organization_id, connection_id, platform, conversation_type, external_thread_id,
    external_participant_id, participant_name, subject_preview, last_message_at,
    last_inbound_at, unread_count, reply_status, property_id, parking_id, guest_user_id,
    inquiry_check_in, inquiry_check_out, ai_handoff_at, ai_handoff_reason
  )
  VALUES
    ('5eed5100-0000-4000-8000-000000000001', v_org, v_fb, 'facebook', 'dm', 'fb-thread-001',
     'fb-user-001', 'Mika Santos', 'Hi, is the unit available this weekend?', now() - interval '2 hours',
     now() - interval '2 hours', 2, 'pending', v_prop, NULL, NULL,
     CURRENT_DATE + 3, CURRENT_DATE + 5, NULL, NULL),
    ('5eed5100-0000-4000-8000-000000000002', v_org, v_ig, 'instagram', 'dm', 'ig-thread-002',
     'ig-user-002', 'Paolo Reyes', 'How much is the parking slot per night?', now() - interval '5 hours',
     now() - interval '6 hours', 1, 'replied', v_prop, NULL, NULL,
     NULL, NULL, NULL, NULL),
    ('5eed5100-0000-4000-8000-000000000003', v_org, v_web, 'web', 'dm', 'web-thread-003',
     'web-guest-003', 'Demo Guest', 'Can I check in early?', now() - interval '30 minutes',
     now() - interval '35 minutes', 0, 'replied', v_prop, NULL, v_guest,
     CURRENT_DATE, CURRENT_DATE + 2, NULL, NULL),
    ('5eed5100-0000-4000-8000-000000000004', v_org, v_fb, 'facebook', 'comment', 'fb-thread-004',
     'fb-user-004', 'Bea Cruz', 'Comment on the lagoon photo', now() - interval '1 day',
     now() - interval '1 day', 0, 'none', v_prop, NULL, NULL, NULL, NULL,
     now() - interval '1 day', 'Asked about a refund policy, needs a human'),
    ('5eed5100-0000-4000-8000-000000000005', v_org, v_ig, 'instagram', 'dm', 'ig-thread-005',
     'ig-user-005', 'Carlo Lim', 'Do you accept pets?', now() - interval '2 days',
     now() - interval '2 days', 0, 'replied', v_prop, NULL, NULL, NULL, NULL, NULL, NULL),
    ('5eed5100-0000-4000-8000-000000000006', v_org, v_fb, 'facebook', 'dm', 'fb-thread-006',
     'fb-user-006', 'Dana Ong', 'Parking slot for next week?', now() - interval '3 days',
     now() - interval '3 days', 1, 'pending', NULL, v_park, NULL,
     CURRENT_DATE + 7, CURRENT_DATE + 9, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET
    last_message_at = EXCLUDED.last_message_at,
    unread_count = EXCLUDED.unread_count,
    reply_status = EXCLUDED.reply_status,
    ai_handoff_at = EXCLUDED.ai_handoff_at,
    ai_handoff_reason = EXCLUDED.ai_handoff_reason;

  INSERT INTO public.social_messages (
    id, organization_id, conversation_id, direction, external_message_id, body_text,
    sent_at, delivery_status, sent_by_user_id, is_ai_generated, source_mode, message_kind
  )
  SELECT
    format('5eed5200-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_org,
    (ARRAY[
      '5eed5100-0000-4000-8000-000000000001','5eed5100-0000-4000-8000-000000000001',
      '5eed5100-0000-4000-8000-000000000002','5eed5100-0000-4000-8000-000000000002',
      '5eed5100-0000-4000-8000-000000000003','5eed5100-0000-4000-8000-000000000003',
      '5eed5100-0000-4000-8000-000000000004','5eed5100-0000-4000-8000-000000000004',
      '5eed5100-0000-4000-8000-000000000005','5eed5100-0000-4000-8000-000000000005',
      '5eed5100-0000-4000-8000-000000000006','5eed5100-0000-4000-8000-000000000006',
      '5eed5100-0000-4000-8000-000000000001','5eed5100-0000-4000-8000-000000000001',
      '5eed5100-0000-4000-8000-000000000002','5eed5100-0000-4000-8000-000000000002',
      '5eed5100-0000-4000-8000-000000000003','5eed5100-0000-4000-8000-000000000003',
      '5eed5100-0000-4000-8000-000000000004','5eed5100-0000-4000-8000-000000000004',
      '5eed5100-0000-4000-8000-000000000005','5eed5100-0000-4000-8000-000000000005',
      '5eed5100-0000-4000-8000-000000000006','5eed5100-0000-4000-8000-000000000006',
      '5eed5100-0000-4000-8000-000000000001','5eed5100-0000-4000-8000-000000000003',
      '5eed5100-0000-4000-8000-000000000005','5eed5100-0000-4000-8000-000000000002',
      '5eed5100-0000-4000-8000-000000000004','5eed5100-0000-4000-8000-000000000006'
    ])[g.i + 1]::uuid,
    CASE WHEN g.i % 2 = 0 THEN 'inbound' ELSE 'outbound' END,
    'msg-' || g.i,
    (ARRAY[
      'Hi, is the unit available this weekend?',
      'Yes, we have Friday to Sunday open. Sending you the booking link now.',
      'How much is the parking slot per night?',
      'It is 350 per night, covered and beside the lobby lift.',
      'Can I check in early?',
      'Early check-in is free if the unit is ready. We will confirm on the day.',
      'Love the lagoon photo!',
      'Thank you! The view is even better at sunset.',
      'Do you accept pets?',
      'Yes, small pets are welcome with a 500 pet fee and vaccination record.',
      'Parking slot for next week?',
      'Yes, slot 27 is open Tuesday to Thursday. Want me to reserve it?',
      'We are arriving around 2pm.',
      'Perfect, see you then. I will send the check-in guide.',
      'Is the pool open?',
      'The lagoon pool is open 6am to 10pm daily.',
      'Thanks for the quick reply!',
      'You are welcome. Let us know if you need anything else.',
      'Do you have a parking slot?',
      'Yes, we can add one for the whole stay.',
      'Great, please add it.',
      'Done. I updated your booking total.',
      'Can we get extra towels?',
      'Already noted for housekeeping.',
      'Is late check-out possible?',
      'Until 1pm subject to the next booking.',
      'Any restaurant recommendations?',
      'There are several options at the nearby mall.',
      'See you tomorrow!',
      'Safe travels!',
      'One more question about the pool.',
      'Of course, happy to help.',
      'Is the gym open 24 hours?',
      'Yes, residents and guests have 24-hour access.',
      'Can I extend one more night?',
      'Checking availability now.'
    ])[g.i + 1],
    now() - ((30 - g.i) || ' hours')::interval,
    CASE WHEN g.i % 2 = 0 THEN 'delivered' ELSE 'sent' END,
    CASE WHEN g.i % 2 = 1 THEN 'd74b9d44-6244-40f0-9160-7c281738e8c0'::uuid END,
    (g.i IN (18, 20)),
    'text',
    CASE WHEN g.i IN (18, 20) THEN 'template' ELSE 'text' END
  FROM generate_series(0, 29) AS g(i);

  INSERT INTO public.inbox_thread_metrics (
    id, organization_id, conversation_id, first_guest_message_at, first_host_reply_at,
    responded_within_24h
  )
  VALUES
    ('5eed5300-0000-4000-8000-000000000001', v_org, '5eed5100-0000-4000-8000-000000000001', now() - interval '2 hours', NULL, NULL),
    ('5eed5300-0000-4000-8000-000000000002', v_org, '5eed5100-0000-4000-8000-000000000002', now() - interval '6 hours', now() - interval '5 hours', true),
    ('5eed5300-0000-4000-8000-000000000003', v_org, '5eed5100-0000-4000-8000-000000000003', now() - interval '35 minutes', now() - interval '30 minutes', true),
    ('5eed5300-0000-4000-8000-000000000004', v_org, '5eed5100-0000-4000-8000-000000000004', now() - interval '1 day', NULL, NULL),
    ('5eed5300-0000-4000-8000-000000000005', v_org, '5eed5100-0000-4000-8000-000000000005', now() - interval '2 days', now() - interval '2 days', true),
    ('5eed5300-0000-4000-8000-000000000006', v_org, '5eed5100-0000-4000-8000-000000000006', now() - interval '3 days', NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET
    first_guest_message_at = EXCLUDED.first_guest_message_at,
    first_host_reply_at = EXCLUDED.first_host_reply_at,
    responded_within_24h = EXCLUDED.responded_within_24h,
    updated_at = now();

  INSERT INTO public.social_inbox_settings (
    organization_id, auto_reply_enabled, auto_reply_mode, ai_system_prompt,
    platform_toggles, parking_id
  )
  VALUES (
    v_org, true, 'draft',
    'You are the reservations assistant for Kame Space. Answer in a warm, concise tone. Never confirm a refund.',
    '{"facebook":true,"instagram":true,"web":true}'::jsonb, NULL
  )
  ON CONFLICT (organization_id) WHERE parking_id IS NULL DO UPDATE SET
    auto_reply_enabled = EXCLUDED.auto_reply_enabled,
    auto_reply_mode = EXCLUDED.auto_reply_mode,
    ai_system_prompt = EXCLUDED.ai_system_prompt,
    platform_toggles = EXCLUDED.platform_toggles,
    updated_at = now();

  INSERT INTO public.social_inbox_settings (
    organization_id, auto_reply_enabled, auto_reply_mode, ai_system_prompt,
    platform_toggles, parking_id
  )
  VALUES (
    v_org, false, 'draft',
    'Parking assistant. Answer availability and rate questions only.',
    '{"facebook":true,"instagram":false,"web":false}'::jsonb, v_park
  )
  ON CONFLICT (organization_id, parking_id) WHERE parking_id IS NOT NULL DO UPDATE SET
    auto_reply_enabled = EXCLUDED.auto_reply_enabled,
    auto_reply_mode = EXCLUDED.auto_reply_mode,
    ai_system_prompt = EXCLUDED.ai_system_prompt,
    platform_toggles = EXCLUDED.platform_toggles,
    updated_at = now();

  RAISE NOTICE 'local seed: inbox seeded (6 threads, 30 messages)';
END $$;

