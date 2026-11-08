-- 18 — AI settings, credits and usage.
--
-- Enables the AI surfaces at org and property level, grants a credit balance,
-- records 30 days of usage and two assistant conversations.
--
-- Safe to re-run.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_owner uuid := 'd74b9d44-6244-40f0-9160-7c281738e8c0';
  v_profile uuid;
  v_conv uuid := '5eedb100-0000-4000-8000-000000000001';
BEGIN
  DELETE FROM public.ai_dashboard_assistant_messages WHERE conversation_id::text LIKE '5eedb%';
  DELETE FROM public.ai_dashboard_assistant_conversations WHERE id::text LIKE '5eedb%';
  DELETE FROM public.ai_platform_usage_daily WHERE id::text LIKE '5eedb%';
  DELETE FROM public.ai_platform_org_credit_ledger WHERE id::text LIKE '5eedb%';

  SELECT id INTO v_profile FROM public.ai_limit_profiles ORDER BY code LIMIT 1;

  INSERT INTO public.ai_platform_org_settings (
    organization_id, enabled, plan_tier, plan_credit_allowance, daily_credit_limit,
    monthly_credit_limit, updated_by
  )
  VALUES (v_org, true, 'pro', 25000, 2000, 25000, v_owner)
  ON CONFLICT (organization_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    plan_tier = EXCLUDED.plan_tier,
    plan_credit_allowance = EXCLUDED.plan_credit_allowance,
    daily_credit_limit = EXCLUDED.daily_credit_limit,
    monthly_credit_limit = EXCLUDED.monthly_credit_limit,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.ai_platform_property_settings (
    property_id, organization_id, enabled, feature_configs, updated_by
  )
  VALUES (v_prop, v_org, true, '{"assistant":true,"marketing":true,"validations":true}'::jsonb, v_owner)
  ON CONFLICT (property_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    feature_configs = EXCLUDED.feature_configs,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.ai_platform_org_credit_wallet (organization_id, balance_credits)
  VALUES (v_org, 18420)
  ON CONFLICT (organization_id) DO UPDATE SET
    balance_credits = EXCLUDED.balance_credits,
    updated_at = now();

  INSERT INTO public.ai_platform_org_credit_ledger (
    organization_id, entry_type, credits_delta, description, created_by
  )
  VALUES
    (v_org, 'manual_adjustment', 25000, 'Seeded local plan allowance', v_owner),
    (v_org, 'usage_debit', -6580, 'Seeded local AI usage', v_owner);

  INSERT INTO public.ai_platform_usage_daily (
    id, organization_id, usage_date, call_count, input_tokens, output_tokens,
    estimated_cost_usd, credits_consumed
  )
  SELECT
    format('5eedb000-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_org,
    CURRENT_DATE - g.i,
    3 + (g.i % 7),
    1200 + (g.i % 8) * 350,
    400 + (g.i % 5) * 120,
    (0.02 + (g.i % 6) * 0.007),
    20 + (g.i % 9) * 15
  FROM generate_series(0, 29) AS g(i);

  IF v_profile IS NOT NULL THEN
    INSERT INTO public.ai_limit_assignments (id, scope, scope_id, profile_id, assigned_by, note)
    VALUES (
      '5eedb200-0000-4000-8000-000000000001', 'organization', v_org, v_profile, v_owner,
      'Local seed profile assignment'
    )
    ON CONFLICT (id) DO UPDATE SET
      profile_id = EXCLUDED.profile_id,
      assigned_by = EXCLUDED.assigned_by,
      note = EXCLUDED.note,
      assigned_at = now();
  END IF;

  INSERT INTO public.ai_dashboard_assistant_org_settings (
    organization_id, enabled, daily_message_limit, monthly_message_limit,
    daily_write_action_limit, updated_by
  )
  VALUES (v_org, true, 100, 2000, 40, v_owner)
  ON CONFLICT (organization_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    daily_message_limit = EXCLUDED.daily_message_limit,
    monthly_message_limit = EXCLUDED.monthly_message_limit,
    daily_write_action_limit = EXCLUDED.daily_write_action_limit,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.ai_voice_receptionist_org_settings (
    organization_id, enabled, voice_id, persona_prompt, updated_by
  )
  VALUES (
    v_org, false, 'seed-voice-warm',
    'Answer stay questions in a warm, concise tone. Never promise a refund.',
    v_owner
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    voice_id = EXCLUDED.voice_id,
    persona_prompt = EXCLUDED.persona_prompt,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.ai_dashboard_assistant_conversations (
    id, organization_id, user_id, property_id, title, last_message_at
  )
  VALUES
    (v_conv, v_org, v_owner, v_prop, 'Weekend occupancy review', now() - interval '2 hours'),
    ('5eedb100-0000-4000-8000-000000000002', v_org, v_owner, v_prop, 'Draft a December promo', now() - interval '2 days')
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    last_message_at = EXCLUDED.last_message_at,
    updated_at = now();

  INSERT INTO public.ai_dashboard_assistant_messages (
    id, conversation_id, role, content_text, blocks, tool_calls, guard_mode, entity_refs
  )
  VALUES
    ('5eedb300-0000-4000-8000-000000000001', v_conv, 'user',
     'How is weekend occupancy looking for the next month?', '[]'::jsonb, '[]'::jsonb, 'llm', '{}'::jsonb),
    ('5eedb300-0000-4000-8000-000000000002', v_conv, 'assistant',
     'Weekend occupancy is 86% for the next four weekends, ahead of the portfolio average.',
     '[]'::jsonb, '[]'::jsonb, 'llm', '{}'::jsonb),
    ('5eedb300-0000-4000-8000-000000000003', '5eedb100-0000-4000-8000-000000000002', 'user',
     'Draft a December weekend promo for Instagram.', '[]'::jsonb, '[]'::jsonb, 'llm', '{}'::jsonb),
    ('5eedb300-0000-4000-8000-000000000004', '5eedb100-0000-4000-8000-000000000002', 'assistant',
     'Here is a caption and a two-image layout for the December weekend promo.',
     '[]'::jsonb, '[]'::jsonb, 'llm', '{}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET
    content_text = EXCLUDED.content_text;

  RAISE NOTICE 'local seed: AI settings, wallet and usage seeded';
END $$;

