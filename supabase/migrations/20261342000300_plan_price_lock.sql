-- Grandfathered plan prices (D8). A subscription keeps the pricing it bought: the plan's rate,
-- discount, volume curve and ramp are snapshotted on the subscription, so editing a plan in the
-- catalog only affects new purchases. A super-admin "move subscribers to the current price"
-- migration (effective at least 30 days out, with notice) moves existing subscribers at their
-- next renewal on or after the effective date.
-- Plan: docs/workflow/for-testing/plans-billing-lifecycle-hardening.md (Phase 7)

ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;

COMMENT ON COLUMN public.org_subscriptions.pricing_snapshot IS
  'Plan pricing the subscription bought: {pricePhp, discountPercent, volumeDiscountTiers, volumeRampFloorPhp, volumeRampAtCount}. NULL = follow the plan row.';

CREATE TABLE IF NOT EXISTS public.plan_price_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.pricing_plans (id) ON DELETE CASCADE,
  effective_on TIMESTAMPTZ NOT NULL,
  -- Pricing the plan has at the time the migration was scheduled (what subscribers move to).
  new_pricing JSONB NOT NULL,
  notified_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plan_price_migrations_plan
  ON public.plan_price_migrations (plan_id, effective_on DESC)
  WHERE canceled_at IS NULL;

ALTER TABLE public.plan_price_migrations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.plan_price_migrations TO service_role;

COMMENT ON TABLE public.plan_price_migrations IS
  'Scheduled moves of existing subscribers to a plan''s current price. Applied at the first renewal on or after effective_on.';
