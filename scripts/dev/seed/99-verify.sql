-- 99 — Verify the canonical local dataset.
--
-- Fails the seed run (and therefore db reset) when the dataset drifts. This is
-- the contract every later change must keep.
--
-- Safe to re-run. Read-only.

DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
  v_errors text[] := ARRAY[]::text[];
  v_n integer;
  v_tables text[] := ARRAY[
    'org_subscriptions','org_subscription_properties','organization_custom_roles','organization_invitations',
    'property_members','property_custom_roles','property_invitations',
    'parking_members','parking_custom_roles','parking_invitations',
    'finance_line_items','maintenance_items',
    'property_pricing_date_overrides','property_blocked_dates','property_smart_pricing_settings',
    'property_smart_pricing_runs','property_smart_pricing_recommendations','property_calendar_feeds',
    'calendar_sync_events','parking_pricing_date_overrides','parking_blocked_dates','parking_settings',
    'marketing_themes','marketing_templates','marketing_media_assets','marketing_publications','marketing_ai_sessions',
    'guest_reviews','host_guest_reviews','review_reports','review_automation_rules',
    'social_channel_connections','social_conversations','social_messages','inbox_thread_metrics',
    'custom_pages','public_page_configs','support_tickets','support_ticket_messages',
    'notifications','notification_preferences','activity_log',
    'property_page_views','property_analytics_reviews',
    'ai_platform_org_settings','ai_platform_org_credit_wallet','ai_platform_usage_daily',
    'ai_dashboard_assistant_conversations','ai_voice_receptionist_org_settings',
    'ops_reports','super_admin_audit_events',
    'guest_profiles','guest_saved_properties','guest_requests'
  ];
  v_table text;
BEGIN
  SELECT count(*) INTO v_n FROM public.organizations;
  IF v_n <> 1 THEN
    v_errors := array_append(v_errors, format('expected 1 organization, found %s', v_n));
  END IF;

  SELECT count(*) INTO v_n FROM public.properties WHERE status = 'ACTIVE';
  IF v_n <> 1 THEN
    v_errors := array_append(v_errors, format('expected 1 ACTIVE property, found %s', v_n));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = v_prop AND slug = 'kame-home') THEN
    v_errors := array_append(v_errors, 'kame-home property missing');
  END IF;

  SELECT count(*) INTO v_n FROM public.parkings WHERE status = 'ACTIVE';
  IF v_n <> 1 THEN
    v_errors := array_append(v_errors, format('expected 1 ACTIVE parking, found %s', v_n));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parkings WHERE id = v_park AND slug = 'monaco-level-2-slot-27') THEN
    v_errors := array_append(v_errors, 'monaco-level-2-slot-27 parking missing');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.org_subscriptions s
    JOIN public.pricing_plans p ON p.id = s.plan_id
    WHERE s.organization_id = v_org AND s.status = 'active' AND p.code = 'pro'
  ) THEN
    v_errors := array_append(v_errors, 'org is not on an active Business (pro) subscription');
  END IF;

  SELECT count(DISTINCT status) INTO v_n
  FROM public.guest_submissions
  WHERE property_id = v_prop AND booking_source = 'local_seed';
  IF v_n < 11 THEN
    v_errors := array_append(v_errors, format('property booking status coverage is %s of 11', v_n));
  END IF;

  SELECT count(DISTINCT status) INTO v_n
  FROM public.guest_submissions
  WHERE parking_id = v_park AND booking_source = 'local_seed';
  IF v_n < 8 THEN
    v_errors := array_append(v_errors, format('parking booking status coverage is %s of 8', v_n));
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_table) INTO v_n;
    IF v_n = 0 THEN
      v_errors := array_append(v_errors, format('%s is empty', v_table));
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.public_listing_search WHERE slug = 'kame-home') THEN
    v_errors := array_append(v_errors, 'kame-home is missing from public_listing_search');
  END IF;

  IF (SELECT count(*) FROM public.pricing_plans) < 7 THEN
    v_errors := array_append(v_errors, 'pricing_plans lost rows');
  END IF;
  IF (SELECT count(*) FROM public.help_center_faqs) < 1 THEN
    v_errors := array_append(v_errors, 'help_center_faqs is empty');
  END IF;
  IF (SELECT count(*) FROM public.host_playbook_articles) < 1 THEN
    v_errors := array_append(v_errors, 'host_playbook_articles is empty');
  END IF;

  -- Marketing Trends: one published run with a today list and a week window, so the
  -- rail and the sheet render offline.
  IF NOT EXISTS (
    SELECT 1 FROM public.marketing_trend_runs r
    WHERE r.status = 'published'
      AND r.run_date = (now() AT TIME ZONE 'Asia/Manila')::date
  ) THEN
    v_errors := array_append(v_errors, 'marketing trends has no published run for today');
  END IF;
  SELECT count(*) INTO v_n
  FROM public.marketing_trend_topics t
  JOIN public.marketing_trend_runs r ON r.id = t.run_id
  WHERE r.status = 'published' AND t.window = 'today';
  IF v_n < 5 THEN
    v_errors := array_append(v_errors, format('marketing trends today list has %s topics (5+)', v_n));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.marketing_trend_topics t
    JOIN public.marketing_trend_runs r ON r.id = t.run_id
    WHERE r.status = 'published' AND t.window = 'week'
  ) THEN
    v_errors := array_append(v_errors, 'marketing trends week window is empty');
  END IF;

  IF array_length(v_errors, 1) > 0 THEN
    RAISE EXCEPTION E'local seed verification failed:\n  - %', array_to_string(v_errors, E'\n  - ');
  END IF;

  RAISE NOTICE 'local seed: verification passed (1 org, 1 property, 1 parking, all modules populated)';
END $$;
