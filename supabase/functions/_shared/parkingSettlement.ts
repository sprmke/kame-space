/**
 * Parking settlement math — the single place that turns the two sides of a booking (what the
 * guest is charged, what the host asked for) into the three numbers that matter:
 *
 *   hostNetTotal     = hostGrossTotal − commissionAmount          (paid out to the host)
 *   paymentFeeAmount = guestChargeTotal × paymentFeePct + fixed   (kept by the processor)
 *   platformNetTotal = guestChargeTotal − hostNetTotal − paymentFeeAmount
 *
 * Pure and side-effect free so the same numbers can be unit-tested, snapshotted onto a
 * transaction, and previewed in the dashboard without drifting.
 */

export type ParkingSettlementInput = {
  guestChargeTotal: number;
  hostGrossTotal: number;
  /** Host fee, 0..1. */
  commissionPct: number;
  /** Processor fee, 0..1. */
  paymentFeePct: number;
  /** Processor fixed fee in pesos. */
  paymentFeeFixed: number;
  /** Offline and complimentary bookings never touch a processor. Defaults to true. */
  chargePaymentFee?: boolean;
};

export type ParkingSettlement = {
  commissionAmount: number;
  hostNetTotal: number;
  paymentFeeAmount: number;
  platformNetTotal: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function computeParkingSettlement(
  input: ParkingSettlementInput,
): ParkingSettlement {
  const guestCharge = round2(nonNegative(input.guestChargeTotal));
  const hostGross = round2(nonNegative(input.hostGrossTotal));

  const commissionAmount = round2(hostGross * clampPct(input.commissionPct));
  const hostNetTotal = round2(Math.max(0, hostGross - commissionAmount));

  const rawPaymentFee = input.chargePaymentFee === false ? 0 : round2(
    guestCharge * clampPct(input.paymentFeePct) +
      nonNegative(input.paymentFeeFixed),
  );
  // A processor fee can never exceed the amount charged.
  const paymentFeeAmount = Math.min(rawPaymentFee, guestCharge);

  const platformNetTotal = round2(
    guestCharge - hostNetTotal - paymentFeeAmount,
  );

  return {
    commissionAmount,
    hostNetTotal,
    paymentFeeAmount,
    platformNetTotal,
  };
}
