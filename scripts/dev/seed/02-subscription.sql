-- 02 — Subscription.
--
-- One active Business (`pro`) subscription so every gated module is available.
-- Plan tier testing happens through /admin/pricing/subscriptions or
-- `bun run seed:plan`, never by editing this file.
--
-- Safe to re-run.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_plan uuid;
  v_sub uuid;
BEGIN
  SELECT id INTO v_plan FROM public.pricing_plans WHERE code = 'pro' AND is_active LIMIT 1;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'local seed: Business (pro) plan not found';
  END IF;

  SELECT id INTO v_sub
  FROM public.org_subscriptions
  WHERE organization_id = v_org
    AND status IN ('active', 'trialing', 'past_due')
  LIMIT 1;

  IF v_sub IS NULL THEN
    INSERT INTO public.org_subscriptions (
      organization_id, plan_id, pricing_model, price_php_snapshot, status,
      current_period_start, current_period_end, source
    )
    VALUES (
      v_org, v_plan, 'subscription', 1799, 'active',
      date_trunc('day', now()), date_trunc('day', now()) + interval '1 year', 'admin'
    )
    RETURNING id INTO v_sub;

    INSERT INTO public.org_subscription_events (
      org_subscription_id, event_type, new_plan_id, new_status, note
    )
    VALUES (v_sub, 'plan_changed', v_plan, 'active', 'Seeded local demo subscription');
  ELSE
    UPDATE public.org_subscriptions
    SET plan_id = v_plan,
        pricing_model = 'subscription',
        price_php_snapshot = 1799,
        status = 'active',
        current_period_start = coalesce(current_period_start, date_trunc('day', now())),
        current_period_end = coalesce(current_period_end, date_trunc('day', now()) + interval '1 year'),
        grace_period_ends_at = NULL,
        updated_at = now()
    WHERE id = v_sub;
  END IF;

  INSERT INTO public.org_subscription_properties (org_subscription_id, property_id)
  SELECT v_sub, v_prop
  WHERE NOT EXISTS (
    SELECT 1 FROM public.org_subscription_properties
    WHERE org_subscription_id = v_sub AND property_id = v_prop
  );

  RAISE NOTICE 'local seed: subscription % on plan %', v_sub, v_plan;
END $$;

