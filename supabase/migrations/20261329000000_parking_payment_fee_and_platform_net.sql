-- Parking payments: make the platform's real margin visible.
--
-- Until now the ledger stopped at `host_net_total`, so the platform had no number for
-- "what did we actually keep after paying the host AND the payment processor". The guest is
-- charged the platform guest rate, the host is paid `host_net_total`, and PayMongo keeps a
-- processing cut of the guest charge. `platform_net_total` is the remainder.
--
-- The processor cut is configurable (it varies by payment method and negotiated rate) and is
-- snapshotted onto each transaction at checkout-creation time, same discipline as
-- `commission_pct`. Changing the settings never rewrites an existing booking.

ALTER TABLE public.platform_parking_settings
  ADD COLUMN IF NOT EXISTS payment_fee_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.03125,
  ADD COLUMN IF NOT EXISTS payment_fee_fixed NUMERIC(12, 2) NOT NULL DEFAULT 15;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_parking_settings_payment_fee_pct_range'
  ) THEN
    ALTER TABLE public.platform_parking_settings
      ADD CONSTRAINT platform_parking_settings_payment_fee_pct_range
      CHECK (payment_fee_pct >= 0 AND payment_fee_pct <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_parking_settings_payment_fee_fixed_nonnegative'
  ) THEN
    ALTER TABLE public.platform_parking_settings
      ADD CONSTRAINT platform_parking_settings_payment_fee_fixed_nonnegative
      CHECK (payment_fee_fixed >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.platform_parking_settings.payment_fee_pct IS
  'Estimated payment-processor cut of the guest charge (e.g. PayMongo local card 3.125%). '
  'Configurable because the real rate varies by payment method. Used only to estimate '
  'platform net margin, never to compute the host payout.';
COMMENT ON COLUMN public.platform_parking_settings.payment_fee_fixed IS
  'Fixed per-transaction processor fee in pesos (e.g. PayMongo ₱15). Added on top of '
  'payment_fee_pct when estimating platform net margin.';

ALTER TABLE public.parking_payment_transactions
  ADD COLUMN IF NOT EXISTS payment_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_net_total NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.parking_payment_transactions.payment_fee_amount IS
  'Estimated processor fee snapshotted at checkout creation (guest_charge_total × '
  'payment_fee_pct + payment_fee_fixed). 0 for offline and complimentary bookings.';
COMMENT ON COLUMN public.parking_payment_transactions.platform_net_total IS
  'What the platform actually keeps: guest_charge_total − host_net_total − '
  'payment_fee_amount. Snapshotted at checkout creation so later config changes never move it.';

-- Historical rows predate the fee model. We cannot reconstruct the processor cut, so record
-- the spread only and leave the fee at 0. New rows carry the full picture.
UPDATE public.parking_payment_transactions
SET platform_net_total = GREATEST(0, guest_charge_total - host_net_total)
WHERE platform_net_total = 0
  AND guest_charge_total > 0;
