-- Host-set parking pricing: hosts set the nightly rate, the guest pays host rate + a service fee.
-- The fee keeps platform net positive at every legal host rate (see
-- docs/workflow/in-progress/host-set-parking-pricing.md). guest_rate_* columns stay in place but
-- are no longer read; drop them in a later migration after one release.

ALTER TABLE public.platform_parking_settings
  ADD COLUMN IF NOT EXISTS guest_fee_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS guest_fee_fixed NUMERIC(12, 2) NOT NULL DEFAULT 15;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_parking_settings_guest_fee_range'
  ) THEN
    ALTER TABLE public.platform_parking_settings
      ADD CONSTRAINT platform_parking_settings_guest_fee_range CHECK (
        guest_fee_pct >= 0 AND guest_fee_pct <= 1 AND guest_fee_fixed >= 0
      );
  END IF;
END $$;

COMMENT ON COLUMN public.platform_parking_settings.guest_fee_pct IS
  'Guest service fee as a fraction of the host gross, added on top of the host rate at checkout.';
COMMENT ON COLUMN public.platform_parking_settings.guest_fee_fixed IS
  'Flat guest service fee in pesos per booking (not per night); passes the processor fixed fee through.';

-- Snapshot of the fee the guest paid. Historical rows stay 0 (they were priced with the old
-- platform guest rate and never had a separate fee line).
ALTER TABLE public.parking_payment_transactions
  ADD COLUMN IF NOT EXISTS guest_fee_total NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.parking_payment_transactions.guest_fee_total IS
  'Guest service fee included in guest_charge_total (guest_charge_total = host_gross_total + guest_fee_total for new rows).';
