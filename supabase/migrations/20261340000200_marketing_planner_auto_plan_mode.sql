-- Marketing Planner: opt-in weekly AI plan with a weekly credit cap.
--
-- Default is `rules` with a cap of 0, so nothing spends credits until a host explicitly turns
-- the AI plan on in the setup wizard. The cron also checks the `aiMarketingPlanner` entitlement
-- and the rolling 7-day spend before it asks for an AI plan.
--
-- Plan: docs/workflow/in-progress/marketing-strategy-planner.md (§Phase 6.1)

ALTER TABLE public.marketing_planner_settings
  ADD COLUMN IF NOT EXISTS auto_plan_mode TEXT NOT NULL DEFAULT 'rules',
  ADD COLUMN IF NOT EXISTS weekly_ai_credit_cap INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.marketing_planner_settings
  DROP CONSTRAINT IF EXISTS marketing_planner_settings_auto_plan_mode_check;
ALTER TABLE public.marketing_planner_settings
  ADD CONSTRAINT marketing_planner_settings_auto_plan_mode_check CHECK (
    auto_plan_mode IN ('rules', 'ai')
  );

ALTER TABLE public.marketing_planner_settings
  DROP CONSTRAINT IF EXISTS marketing_planner_settings_ai_cap_check;
ALTER TABLE public.marketing_planner_settings
  ADD CONSTRAINT marketing_planner_settings_ai_cap_check CHECK (
    weekly_ai_credit_cap >= 0 AND weekly_ai_credit_cap <= 1000
  );

COMMENT ON COLUMN public.marketing_planner_settings.auto_plan_mode IS
  'rules = free weekly plan; ai = weekly AI briefs, capped by weekly_ai_credit_cap';
COMMENT ON COLUMN public.marketing_planner_settings.weekly_ai_credit_cap IS
  'Credits the weekly AI plan may spend per rolling 7 days. 0 disables AI planning.';
