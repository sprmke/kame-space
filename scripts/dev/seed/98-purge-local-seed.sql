-- 98 — Purge local seed rows.
--
-- Used by `bun run seed:refresh` on an existing local database. Removes only
-- rows created by this seed suite plus the retired Azure search fixtures, then
-- the numbered seed files rebuild them.
--
-- Never deletes reference/catalog data (plans, FAQs, playbook, AI knowledge
-- base, limit profiles) or rows that do not carry a local-seed marker.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
BEGIN
  DELETE FROM public.ai_dashboard_assistant_messages WHERE conversation_id::text LIKE '5eedb%';
  DELETE FROM public.ai_dashboard_assistant_conversations WHERE id::text LIKE '5eedb%';
  DELETE FROM public.ai_platform_usage_daily WHERE id::text LIKE '5eedb%';
  DELETE FROM public.ai_platform_org_credit_ledger WHERE id::text LIKE '5eedb%';
  DELETE FROM public.ai_limit_assignments WHERE id::text LIKE '5eedb%';

  DELETE FROM public.notification_reads WHERE notification_id::text LIKE '5eed9%';
  DELETE FROM public.notifications WHERE id::text LIKE '5eed9%';
  DELETE FROM public.property_page_views WHERE id::text LIKE '5eeda%';
  DELETE FROM public.property_analytics_reviews WHERE id::text LIKE '5eeda%';

  DELETE FROM public.support_ticket_messages WHERE ticket_id::text LIKE '5eed8%';
  DELETE FROM public.support_tickets WHERE id::text LIKE '5eed8%';

  DELETE FROM public.review_reports WHERE id::text LIKE '5eed6%';
  DELETE FROM public.host_guest_reviews WHERE id::text LIKE '5eed6%';
  DELETE FROM public.guest_reviews WHERE id::text LIKE '5eed6%';

  DELETE FROM public.inbox_thread_metrics WHERE conversation_id::text LIKE '5eed5%';
  DELETE FROM public.social_messages WHERE conversation_id::text LIKE '5eed5%';
  DELETE FROM public.social_conversations WHERE id::text LIKE '5eed5%';
  DELETE FROM public.social_channel_connections WHERE id::text LIKE '5eed5%';

  DELETE FROM public.marketing_publications WHERE id::text LIKE '5eed4%';
  DELETE FROM public.marketing_media_assets WHERE id::text LIKE '5eed4%';
  DELETE FROM public.marketing_templates WHERE id::text LIKE '5eed4%';
  DELETE FROM public.marketing_ai_sessions WHERE id::text LIKE '5eed4%';
  DELETE FROM public.marketing_themes WHERE id::text LIKE '5eed4%';

  DELETE FROM public.calendar_sync_events WHERE feed_id::text LIKE '5eed3%';
  DELETE FROM public.property_calendar_feeds WHERE id::text LIKE '5eed3%';
  DELETE FROM public.property_smart_pricing_recommendations WHERE property_id = v_prop;
  DELETE FROM public.property_smart_pricing_runs WHERE id::text LIKE '5eed3%';
  DELETE FROM public.property_smart_pricing_settings WHERE property_id = v_prop;
  DELETE FROM public.property_blocked_dates WHERE property_id = v_prop AND id::text LIKE '5eed3%';
  DELETE FROM public.parking_blocked_dates WHERE parking_id = v_park AND id::text LIKE '5eed3%';
  DELETE FROM public.property_pricing_date_overrides WHERE property_id = v_prop;
  DELETE FROM public.parking_pricing_date_overrides WHERE parking_id = v_park;

  DELETE FROM public.maintenance_items WHERE created_by = 'local_seed';
  DELETE FROM public.finance_line_items WHERE created_by = 'local_seed';
  DELETE FROM public.booking_cancellation_requests WHERE id::text LIKE '5eed2%';
  DELETE FROM public.booking_refunds WHERE id::text LIKE '5eed2%';
  DELETE FROM public.org_payment_transactions WHERE id::text LIKE '5eed2%';

  DELETE FROM public.parking_payment_transactions WHERE booking_id::text LIKE '5eed1%';
  DELETE FROM public.parking_booking_broadcasts WHERE booking_id::text LIKE '5eed1%';
  DELETE FROM public.guest_requests WHERE id::text LIKE '5eedd%';
  DELETE FROM public.guest_submissions WHERE parking_id = v_park AND booking_source = 'local_seed';
  DELETE FROM public.guest_submissions WHERE property_id = v_prop AND booking_source = 'local_seed';

  DELETE FROM public.custom_pages WHERE id::text LIKE '5eed7%';
  DELETE FROM public.public_page_configs WHERE id::text LIKE '5eed7%';

  DELETE FROM public.ops_reports WHERE id::text LIKE '5eedc%';
  DELETE FROM public.super_admin_audit_events WHERE id::text LIKE '5eedc%';
  DELETE FROM public.guest_saved_properties WHERE user_id::text LIKE '5eed0%';

  -- Retired Azure search fixtures (their demo bookings cascade).
  DELETE FROM public.properties WHERE id IN (
    'b2222222-2222-4222-8222-222222222201',
    'b2222222-2222-4222-8222-222222222202',
    'b2222222-2222-4222-8222-222222222203',
    'b2222222-2222-4222-8222-222222222204'
  );
  DELETE FROM public.parkings WHERE id IN (
    'c3333333-3333-4333-8333-333333333302',
    'c3333333-3333-4333-8333-333333333303',
    'c3333333-3333-4333-8333-333333333304'
  );
  DELETE FROM public.developments WHERE slug IN (
    'azure-urban-resort-residences',
    'azure-north-bay',
    'azure-north-phase-2'
  );

  RAISE NOTICE 'local seed: purged seed rows for org %', v_org;
END $$;

