-- Plans & Billing lifecycle hardening (Phases 0, 1, 3, 4, 6).
-- Plan: docs/workflow/for-testing/plans-billing-lifecycle-hardening.md
--
-- Adds: scheduled downgrade / cancel-at-period-end intent, billing anchor + period-paid
-- tracking, price override, one pending checkout per org, payment intent snapshot + receipts,
-- account credit ledger, send-once billing notifications, billing details, new event types,
-- and a cancel RPC that records why a subscription ended.
-- No live paying customers exist yet, so no backfill beyond safe defaults.

-- ─── org_subscriptions: pending intent, anchor, paid basis, override ─────────────

ALTER TABLE public.org_subscriptions
  -- No FK on purpose: a second relationship to pricing_plans makes every PostgREST
  -- `pricing_plans(...)` embed on org_subscriptions ambiguous. Plans are never deleted.
  ADD COLUMN IF NOT EXISTS scheduled_plan_id UUID,
  ADD COLUMN IF NOT EXISTS scheduled_change_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_reason TEXT,
  ADD COLUMN IF NOT EXISTS billing_anchor_day SMALLINT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_paid_php NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_override_php NUMERIC;

ALTER TABLE public.org_subscriptions
  DROP CONSTRAINT IF EXISTS org_subscriptions_one_intent_check;
ALTER TABLE public.org_subscriptions
  ADD CONSTRAINT org_subscriptions_one_intent_check
  CHECK (NOT (scheduled_plan_id IS NOT NULL AND cancel_at_period_end));

ALTER TABLE public.org_subscriptions
  DROP CONSTRAINT IF EXISTS org_subscriptions_anchor_day_check;
ALTER TABLE public.org_subscriptions
  ADD CONSTRAINT org_subscriptions_anchor_day_check
  CHECK (billing_anchor_day IS NULL OR billing_anchor_day BETWEEN 1 AND 31);

ALTER TABLE public.org_subscriptions
  DROP CONSTRAINT IF EXISTS org_subscriptions_ended_reason_check;
ALTER TABLE public.org_subscriptions
  ADD CONSTRAINT org_subscriptions_ended_reason_check
  CHECK (
    ended_reason IS NULL OR ended_reason IN (
      'host_canceled', 'nonpayment', 'trial_ended', 'no_properties', 'admin', 'downgraded_to_free'
    )
  );

ALTER TABLE public.org_subscriptions
  DROP CONSTRAINT IF EXISTS org_subscriptions_cancel_reason_check;
ALTER TABLE public.org_subscriptions
  ADD CONSTRAINT org_subscriptions_cancel_reason_check
  CHECK (
    cancel_reason IS NULL OR cancel_reason IN (
      'too_expensive', 'missing_features', 'fewer_properties', 'switching_tool', 'temporary', 'other'
    )
  );

COMMENT ON COLUMN public.org_subscriptions.scheduled_plan_id IS
  'Paid plan the org moves to at scheduled_change_at (downgrade waiting for the period end). Mutually exclusive with cancel_at_period_end.';
COMMENT ON COLUMN public.org_subscriptions.period_paid_php IS
  'Full value of the current period (plan total at purchase). Basis for mid-period proration credit; 0 for trials and admin grants.';
COMMENT ON COLUMN public.org_subscriptions.price_override_php IS
  'Super-admin price for sales-assisted tiers (Managed). When set, renewals and property changes never recompute the total.';
COMMENT ON COLUMN public.org_subscriptions.billing_anchor_day IS
  'Day of month the subscription renews on (1-31). Short months clamp to the last day without moving the anchor.';

-- Keep an existing admin override: any live Managed/admin row keeps its snapshot as override.
UPDATE public.org_subscriptions s
SET price_override_php = s.price_php_snapshot
FROM public.pricing_plans p
WHERE s.plan_id = p.id
  AND p.code = 'managed'
  AND s.price_override_php IS NULL
  AND s.price_php_snapshot IS NOT NULL
  AND s.status IN ('active', 'trialing', 'past_due', 'suspended');

-- Backfill the anchor for periods that already exist.
UPDATE public.org_subscriptions
SET billing_anchor_day = EXTRACT(DAY FROM (current_period_end AT TIME ZONE 'Asia/Manila'))::SMALLINT
WHERE billing_anchor_day IS NULL
  AND current_period_end IS NOT NULL;

-- Paid-through subscriptions: the snapshot is what the host paid for this period.
UPDATE public.org_subscriptions
SET period_paid_php = COALESCE(price_php_snapshot, 0)
WHERE source = 'purchase'
  AND status IN ('active', 'past_due', 'suspended')
  AND period_paid_php = 0;

-- A suspended row must never coexist with a second live row (B21): collapse duplicates
-- (keep the most recently updated) before widening the unique index.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY organization_id
           ORDER BY CASE WHEN status = 'suspended' THEN 1 ELSE 0 END, updated_at DESC
         ) AS rn
  FROM public.org_subscriptions
  WHERE status IN ('active', 'trialing', 'past_due', 'suspended')
)
UPDATE public.org_subscriptions s
SET status = 'canceled', ended_reason = 'admin', canceled_at = NOW()
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

DROP INDEX IF EXISTS public.org_subscriptions_one_live_per_org_idx;
CREATE UNIQUE INDEX org_subscriptions_one_live_per_org_idx
  ON public.org_subscriptions (organization_id)
  WHERE status IN ('active', 'trialing', 'past_due', 'suspended');

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_billing_sweep
  ON public.org_subscriptions (current_period_end)
  WHERE status IN ('active', 'trialing', 'past_due', 'suspended');

-- ─── org_payment_transactions: purpose, intent, receipts, one pending per org ───

ALTER TABLE public.org_payment_transactions
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS credit_applied_php NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied BOOLEAN,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS intent JSONB,
  ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS apply_attempts SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE public.org_payment_transactions
  DROP CONSTRAINT IF EXISTS org_payment_transactions_purpose_check;
ALTER TABLE public.org_payment_transactions
  ADD CONSTRAINT org_payment_transactions_purpose_check
  CHECK (
    purpose IS NULL OR purpose IN (
      'initial', 'renewal', 'change', 'retry', 'reactivation', 'credit'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS org_payment_transactions_receipt_number_idx
  ON public.org_payment_transactions (receipt_number)
  WHERE receipt_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS org_payment_transactions_idempotency_idx
  ON public.org_payment_transactions (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- One pending checkout per org (B19). Expire all but the newest first.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at DESC) AS rn
  FROM public.org_payment_transactions
  WHERE status = 'pending'
)
UPDATE public.org_payment_transactions t
SET status = 'expired'
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

DROP INDEX IF EXISTS public.org_payment_transactions_one_pending_per_org_plan_idx;
CREATE UNIQUE INDEX IF NOT EXISTS org_payment_transactions_one_pending_per_org_idx
  ON public.org_payment_transactions (organization_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_org_payment_transactions_pending_sweep
  ON public.org_payment_transactions (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_org_payment_transactions_unapplied
  ON public.org_payment_transactions (created_at DESC)
  WHERE status = 'paid' AND applied = FALSE;

-- Receipt numbers: KS-R-<year in Manila>-<6 digit sequence>, assigned once per paid row.
CREATE SEQUENCE IF NOT EXISTS public.org_payment_receipt_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_org_payment_receipt(p_transaction_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number TEXT;
BEGIN
  UPDATE public.org_payment_transactions
  SET receipt_number = 'KS-R-'
      || TO_CHAR(NOW() AT TIME ZONE 'Asia/Manila', 'YYYY')
      || '-'
      || LPAD(NEXTVAL('public.org_payment_receipt_seq')::TEXT, 6, '0')
  WHERE id = p_transaction_id
    AND receipt_number IS NULL
    AND status = 'paid'
  RETURNING receipt_number INTO v_number;

  IF v_number IS NULL THEN
    SELECT receipt_number INTO v_number
    FROM public.org_payment_transactions
    WHERE id = p_transaction_id;
  END IF;

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_org_payment_receipt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_org_payment_receipt(UUID) TO service_role;

-- ─── Account credit ledger ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  -- Signed: positive = the org owes this, negative = account credit. Balance = SUM(amount_php).
  amount_php NUMERIC NOT NULL,
  kind TEXT NOT NULL,
  transaction_id UUID REFERENCES public.org_payment_transactions (id) ON DELETE SET NULL,
  org_subscription_id UUID REFERENCES public.org_subscriptions (id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_billing_ledger_kind_check CHECK (
    kind IN (
      'proration_credit', 'true_up', 'overpayment', 'stale_payment',
      'admin_adjustment', 'applied_to_renewal', 'refund'
    )
  ),
  CONSTRAINT org_billing_ledger_nonzero CHECK (amount_php <> 0)
);

CREATE INDEX IF NOT EXISTS idx_org_billing_ledger_org
  ON public.org_billing_ledger (organization_id, created_at DESC);

COMMENT ON TABLE public.org_billing_ledger IS
  'Append-only account credit ledger. Leftover proration credit, true-ups, duplicate or stale payments and admin adjustments. Applied automatically at the next payment; never paid out as cash.';

-- One settle entry and one new-credit entry per payment, so applying a payment twice is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS org_billing_ledger_txn_kind_idx
  ON public.org_billing_ledger (transaction_id, kind)
  WHERE transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.org_billing_balance(p_organization_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_php), 0)
  FROM public.org_billing_ledger
  WHERE organization_id = p_organization_id;
$$;

REVOKE ALL ON FUNCTION public.org_billing_balance(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_billing_balance(UUID) TO service_role;

-- ─── Send-once billing notifications ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_billing_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  org_subscription_id UUID REFERENCES public.org_subscriptions (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  -- Distinguishes one billing period (or one event) from the next, e.g. the period end ISO date.
  period_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_billing_notifications_once_idx
  ON public.org_billing_notifications (organization_id, kind, period_key);

CREATE INDEX IF NOT EXISTS idx_org_billing_notifications_unsent
  ON public.org_billing_notifications (created_at)
  WHERE sent_at IS NULL;

-- ─── Billing details ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_billing_details (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  legal_name TEXT,
  address TEXT,
  tin TEXT,
  billing_email TEXT,
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_org_billing_details_updated_at ON public.org_billing_details;
CREATE TRIGGER update_org_billing_details_updated_at
  BEFORE UPDATE ON public.org_billing_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.org_billing_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_billing_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_billing_details ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.org_billing_ledger TO service_role;
GRANT ALL ON public.org_billing_notifications TO service_role;
GRANT ALL ON public.org_billing_details TO service_role;

-- ─── Platform settings ───────────────────────────────────────────────────────────

ALTER TABLE public.platform_payment_settings
  ADD COLUMN IF NOT EXISTS suspension_cancel_days INTEGER NOT NULL DEFAULT 30
    CHECK (suspension_cancel_days BETWEEN 1 AND 365),
  ADD COLUMN IF NOT EXISTS pending_checkout_ttl_hours INTEGER NOT NULL DEFAULT 24
    CHECK (pending_checkout_ttl_hours BETWEEN 1 AND 168);

-- ─── Subscription event types ────────────────────────────────────────────────────

ALTER TABLE public.org_subscription_events
  DROP CONSTRAINT IF EXISTS org_subscription_events_event_type_check;
ALTER TABLE public.org_subscription_events
  ADD CONSTRAINT org_subscription_events_event_type_check
  CHECK (
    event_type IN (
      'assigned', 'plan_changed', 'status_changed', 'property_added', 'property_removed',
      'reward_granted', 'reward_expired', 'reward_revoked',
      'change_scheduled', 'change_canceled', 'change_applied',
      'cancel_scheduled', 'cancel_reverted',
      'renewed', 'past_due', 'suspended', 'canceled', 'reactivated',
      'ledger_entry', 'payment_unapplied', 'price_migrated'
    )
  );

-- ─── Cancel RPC: records why the subscription ended ──────────────────────────────

DROP FUNCTION IF EXISTS public.cancel_org_subscription_to_free(UUID, UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.cancel_org_subscription_to_free(
  p_org_subscription_id UUID,
  p_target_plan_id UUID,
  p_previous_status TEXT,
  p_changed_by UUID DEFAULT NULL,
  p_ended_reason TEXT DEFAULT 'downgraded_to_free',
  p_note TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id UUID;
  v_previous_plan_id UUID;
  v_status TEXT;
BEGIN
  SELECT plan_id, status
  INTO v_previous_plan_id, v_status
  FROM public.org_subscriptions
  WHERE id = p_org_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Org subscription not found';
  END IF;

  -- Idempotent: a second call (double click, cron + host race) is a no-op.
  IF v_status = 'canceled' THEN
    RETURN;
  END IF;

  FOR v_property_id IN
    SELECT property_id
    FROM public.org_subscription_properties
    WHERE org_subscription_id = p_org_subscription_id
  LOOP
    INSERT INTO public.org_subscription_events (
      org_subscription_id, event_type, property_id, created_by
    ) VALUES (
      p_org_subscription_id, 'property_removed', v_property_id, p_changed_by
    );
  END LOOP;

  DELETE FROM public.org_subscription_properties
  WHERE org_subscription_id = p_org_subscription_id;

  UPDATE public.org_subscriptions
  SET status = 'canceled',
      price_php_snapshot = 0,
      period_paid_php = 0,
      canceled_at = NOW(),
      ended_reason = COALESCE(p_ended_reason, 'downgraded_to_free'),
      scheduled_plan_id = NULL,
      scheduled_change_at = NULL,
      scheduled_by = NULL,
      cancel_at_period_end = FALSE
  WHERE id = p_org_subscription_id;

  INSERT INTO public.org_subscription_events (
    org_subscription_id, event_type, previous_plan_id, new_plan_id,
    previous_status, new_status, note, created_by
  ) VALUES (
    p_org_subscription_id,
    'canceled',
    v_previous_plan_id,
    p_target_plan_id,
    COALESCE(NULLIF(p_previous_status, ''), v_status),
    'canceled',
    COALESCE(p_note, 'Moved to Free'),
    p_changed_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_org_subscription_to_free(UUID, UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_org_subscription_to_free(UUID, UUID, TEXT, UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.cancel_org_subscription_to_free IS
  'Atomic paid-to-Free move: unenrolls every property, clears pending intent, cancels the subscription and records why. Idempotent.';
