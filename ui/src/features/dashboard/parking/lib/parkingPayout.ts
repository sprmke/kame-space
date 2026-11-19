/**
 * Host-facing nightly payout math. Mirrors `_shared/parkingSettlement.ts` for display only:
 * the server still snapshots the authoritative numbers on the transaction. Whole-peso display
 * is intentional here (rate fields are whole pesos).
 */

export type ParkingNightlyPayout = {
  hostGross: number;
  commissionAmount: number;
  hostNet: number;
};

function roundPeso(value: number): number {
  return Math.round(value);
}

export function computeParkingNightlyPayout(input: {
  hostRate: number;
  commissionPct: number;
}): ParkingNightlyPayout {
  const hostGross = Math.max(0, roundPeso(input.hostRate));
  const commissionAmount = Math.max(
    0,
    roundPeso(hostGross * Math.min(1, Math.max(0, input.commissionPct)))
  );
  return {
    hostGross,
    commissionAmount,
    hostNet: Math.max(0, hostGross - commissionAmount),
  };
}

/** Net per night for a booking sourced through the host's direct link. */
export function computeParkingDirectLinkNet(hostRate: number, commissionPct: number): number {
  return computeParkingNightlyPayout({
    hostRate,
    commissionPct,
  }).hostNet;
}

export type ParkingBookingBreakdown = {
  hostGross: number;
  guestFee: number;
  guestCharge: number;
  commissionAmount: number;
  hostNet: number;
  paymentFeeAmount: number;
  platformNetTotal: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampPct(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Display mirror of `_shared/parkingGuestFee.ts#computeParkingChargeBreakdown` for the
 * super-admin preview. The guest pays the host gross plus a service fee; the platform keeps
 * the fee plus the commission minus the processor cost. The server snapshot is the authority.
 */
export function computeParkingBookingBreakdown(input: {
  hostGrossTotal: number;
  commissionPct: number;
  guestFeePct: number;
  guestFeeFixed: number;
  paymentFeePct: number;
  paymentFeeFixed: number;
}): ParkingBookingBreakdown {
  const hostGross = round2(nonNegative(input.hostGrossTotal));
  const guestFee =
    hostGross === 0
      ? 0
      : round2(hostGross * clampPct(input.guestFeePct) + nonNegative(input.guestFeeFixed));
  const guestCharge = round2(hostGross + guestFee);
  const commissionAmount = round2(hostGross * clampPct(input.commissionPct));
  const hostNet = round2(Math.max(0, hostGross - commissionAmount));
  const paymentFeeAmount = Math.min(
    guestCharge,
    round2(guestCharge * clampPct(input.paymentFeePct) + nonNegative(input.paymentFeeFixed))
  );
  return {
    hostGross,
    guestFee,
    guestCharge,
    commissionAmount,
    hostNet,
    paymentFeeAmount,
    platformNetTotal: round2(guestCharge - hostNet - paymentFeeAmount),
  };
}
