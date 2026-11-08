-- 16 — Activity log.
--
-- 40 rows across org, property and parking scopes, all actor types and
-- severities, spread over 30 days. Safe to re-run.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
  v_owner uuid := 'd74b9d44-6244-40f0-9160-7c281738e8c0';
BEGIN
  INSERT INTO public.activity_log (
    id, organization_id, property_id, parking_id, scope, actor_type, actor_user_id,
    actor_email, actor_display_name, actor_role, action, category, severity,
    target_type, target_id, target_label, summary, changes, metadata, source, created_at
  )
  SELECT
    format('5eed7000-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_org,
    CASE WHEN g.i % 3 = 2 THEN v_prop END,
    CASE WHEN g.i % 3 = 1 THEN v_park END,
    CASE WHEN g.i % 3 = 0 THEN 'org' WHEN g.i % 3 = 1 THEN 'parking' ELSE 'property' END,
    (ARRAY['org_owner','team_member','system','cron','guest','public','ai_assistant'])[1 + (g.i % 7)],
    CASE WHEN g.i % 7 IN (0, 1) THEN v_owner END,
    CASE WHEN g.i % 7 IN (0, 1) THEN 'seed-owner@example.com' END,
    CASE WHEN g.i % 7 IN (0, 1) THEN 'Demo Host' END,
    CASE WHEN g.i % 7 = 0 THEN 'OWNER' WHEN g.i % 7 = 1 THEN 'ADMIN' END,
    (ARRAY[
      'booking.status_changed','booking.cancelled','finance.line_item.created',
      'maintenance.item.completed','pricing.override.created','settings.updated',
      'team.member.added','marketing.publication.published','inbox.message.sent',
      'review.reply.sent','plan.changed','property.created','parking.status_changed',
      'guest.form_submitted','system.cron_run','ai.settings_updated','support.ticket_filed',
      'review.received','import.batch.committed','pricing.smart_pricing_applied'
    ])[1 + (g.i % 20)],
    (ARRAY['booking','finance','maintenance','pricing','settings','team','marketing','inbox','reviews','plans','property','parking','guest','system','ai','support'])[1 + (g.i % 16)],
    (ARRAY['info','info','info','notice','warning','destructive'])[1 + (g.i % 6)],
    CASE WHEN g.i % 4 = 0 THEN 'booking' WHEN g.i % 4 = 1 THEN 'finance' WHEN g.i % 4 = 2 THEN 'property' ELSE 'parking' END,
    (CASE WHEN g.i % 4 = 0 THEN '5eed1000-0000-4000-8000-00000000000' || (g.i % 9)
          WHEN g.i % 4 = 1 THEN '5eed2200-0000-4000-8000-000000000001'
          ELSE v_prop::text END),
    (ARRAY['June Vale booking','Water bill','Monaco 2604','Slot 27','Smart pricing run','Marketing post'])[1 + (g.i % 6)],
    (ARRAY[
      'Booking status moved to READY_FOR_CHECKIN',
      'Finance line item created',
      'Maintenance item completed',
      'Price override created for a weekend',
      'Property settings updated',
      'Team member added',
      'Marketing post published',
      'Inbox message sent',
      'Review reply sent',
      'Plan changed to Business',
      'Cron run completed',
      'Guest form submitted',
      'Support ticket filed',
      'Parking booking claimed',
      'Import batch committed'
    ])[1 + (g.i % 15)],
    jsonb_build_object('from', 'PENDING_REVIEW', 'to', 'READY_FOR_CHECKIN'),
    jsonb_build_object('seed', true, 'index', g.i),
    (ARRAY['dashboard','public_form','ai_assistant','cron','webhook','telegram','email_inbound','db_trigger'])[1 + (g.i % 8)],
    now() - ((g.i || ' days')::interval) - ((g.i * 7 % 24 || ' hours')::interval)
  FROM generate_series(0, 39) AS g(i)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.activity_log al
    WHERE al.id = format('5eed7000-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid
  );

  RAISE NOTICE 'local seed: activity log seeded';
END $$;

