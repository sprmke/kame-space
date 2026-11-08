-- 14 — Support.
--
-- Four host tickets across every status plus one guest ticket, each with a short
-- message thread. Safe to re-run.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_owner uuid := 'd74b9d44-6244-40f0-9160-7c281738e8c0';
  v_guest uuid := '5eed0000-0000-4000-8000-000000000001';
BEGIN
  DELETE FROM public.support_ticket_messages WHERE ticket_id::text LIKE '5eed8%';
  DELETE FROM public.support_tickets WHERE id::text LIKE '5eed8%';

  INSERT INTO public.support_tickets (
    id, organization_id, property_id, submitted_by_user_id, submitted_by_name,
    submitted_by_email, category, subject, status, priority, category_fields, channel
  )
  VALUES
    ('5eed8000-0000-4000-8000-000000000001', v_org, v_prop, v_owner, 'Demo Host',
     'host.demo@example.com', 'bug_report', 'Calendar shows a blocked date twice', 'open', 'high',
     '{"area":"pricing","steps":"Open Pricing calendar, then refresh"}'::jsonb, 'host'),
    ('5eed8000-0000-4000-8000-000000000002', v_org, v_prop, v_owner, 'Demo Host',
     'host.demo@example.com', 'feature_suggestion', 'Add a weekly maintenance digest', 'in_progress', 'medium',
     '{"area":"maintenance"}'::jsonb, 'host'),
    ('5eed8000-0000-4000-8000-000000000003', v_org, v_prop, v_owner, 'Demo Host',
     'host.demo@example.com', 'general_inquiry', 'How do I change the plan?', 'resolved', 'low',
     '{"area":"plans"}'::jsonb, 'host'),
    ('5eed8000-0000-4000-8000-000000000004', v_org, v_prop, v_owner, 'Demo Host',
     'host.demo@example.com', 'business_inquiry', 'Partnership for two more units', 'closed', 'medium',
     '{"area":"growth"}'::jsonb, 'host'),
    ('5eed8000-0000-4000-8000-000000000005', NULL, NULL, v_guest, 'Demo Guest',
     'guest.demo@example.com', 'general_inquiry', 'Where do I find my stay guide?', 'resolved', 'low',
     '{"area":"guest"}'::jsonb, 'guest')
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    priority = EXCLUDED.priority,
    subject = EXCLUDED.subject,
    category_fields = EXCLUDED.category_fields,
    updated_at = now();

  INSERT INTO public.support_ticket_messages (
    id, ticket_id, sender_type, sender_user_id, sender_name, body, created_at
  )
  VALUES
    ('5eed8100-0000-4000-8000-000000000001', '5eed8000-0000-4000-8000-000000000001', 'host', v_owner, 'Demo Host',
     'After a refresh the blocked date appears twice in the list.', now() - interval '2 days'),
    ('5eed8100-0000-4000-8000-000000000002', '5eed8000-0000-4000-8000-000000000001', 'admin', NULL, 'Kame Support',
     'Thanks, we can reproduce it and have a fix in review.', now() - interval '1 day'),
    ('5eed8100-0000-4000-8000-000000000003', '5eed8000-0000-4000-8000-000000000002', 'host', v_owner, 'Demo Host',
     'A weekly digest would save a lot of manual checking.', now() - interval '4 days'),
    ('5eed8100-0000-4000-8000-000000000004', '5eed8000-0000-4000-8000-000000000002', 'admin', NULL, 'Kame Support',
     'Added to the backlog for review.', now() - interval '3 days'),
    ('5eed8100-0000-4000-8000-000000000005', '5eed8000-0000-4000-8000-000000000003', 'admin', NULL, 'Kame Support',
     'Open Plans from the org sidebar and pick Change plan.', now() - interval '8 days'),
    ('5eed8100-0000-4000-8000-000000000006', '5eed8000-0000-4000-8000-000000000004', 'admin', NULL, 'Kame Support',
     'Closing this thread. Email us when you are ready to add the units.', now() - interval '15 days'),
    ('5eed8100-0000-4000-8000-000000000007', '5eed8000-0000-4000-8000-000000000005', 'admin', NULL, 'Kame Support',
     'Open your trip from Account, then tap Stay guide.', now() - interval '5 days')
  ON CONFLICT (id) DO UPDATE SET
    body = EXCLUDED.body,
    sender_name = EXCLUDED.sender_name;

  RAISE NOTICE 'local seed: support tickets seeded';
END $$;

