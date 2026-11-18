-- PayMongo refund events reference the refunded payment (`payment_id`), not the checkout session
-- we store as provider_reference. Keep the paid payment's id so a refund can be matched to its
-- transaction (Plans & Billing lifecycle E36).
-- Plan: docs/workflow/in-progress/plans-billing-lifecycle-hardening.md (Phase 7)

ALTER TABLE public.org_payment_transactions
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_org_payment_transactions_provider_payment
  ON public.org_payment_transactions (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

COMMENT ON COLUMN public.org_payment_transactions.provider_payment_id IS
  'PayMongo payment id (pay_...) of the collected payment. Lets payment.refunded events find the transaction.';
