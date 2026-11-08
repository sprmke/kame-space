-- 00 — Reference guards.
--
-- Local seed must never invent the platform reference catalog. Plans, FAQs,
-- playbook articles, the AI knowledge base, AI limit profiles and reply
-- templates are all seeded by migrations. This file only asserts that they are
-- present so a broken migration chain fails loudly instead of producing a
-- half-empty dashboard.
--
-- Safe to re-run. Read-only.

DO $$
DECLARE
  v_plans integer;
  v_faqs integer;
  v_playbook integer;
  v_knowledge integer;
  v_limits integer;
BEGIN
  SELECT count(*) INTO v_plans FROM public.pricing_plans;
  SELECT count(*) INTO v_faqs FROM public.help_center_faqs;
  SELECT count(*) INTO v_playbook FROM public.host_playbook_articles;
  SELECT count(*) INTO v_knowledge FROM public.ai_dashboard_assistant_knowledge_base;
  SELECT count(*) INTO v_limits FROM public.ai_limit_profiles;

  IF v_plans < 7 THEN
    RAISE EXCEPTION 'local seed: expected at least 7 pricing plans, found %', v_plans;
  END IF;
  IF v_faqs < 1 THEN
    RAISE EXCEPTION 'local seed: help_center_faqs is empty — run migrations first';
  END IF;
  IF v_playbook < 1 THEN
    RAISE EXCEPTION 'local seed: host_playbook_articles is empty — run migrations first';
  END IF;
  IF v_limits < 1 THEN
    RAISE EXCEPTION 'local seed: ai_limit_profiles is empty — run migrations first';
  END IF;

  -- The assistant knowledge base is synced from docs by
  -- `bun run sync:ai-knowledge-base`, not by migrations. It may legitimately be
  -- empty on a fresh local reset.
  IF v_knowledge = 0 THEN
    RAISE NOTICE 'local seed: assistant knowledge base is empty (run bun run sync:ai-knowledge-base to populate it)';
  END IF;

  RAISE NOTICE 'local seed: reference guards passed (plans=%, faqs=%, playbook=%, knowledge=%, limits=%)',
    v_plans, v_faqs, v_playbook, v_knowledge, v_limits;
END $$;
