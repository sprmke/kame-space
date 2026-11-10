/**
 * Host-facing nightly payout math. Mirrors `_shared/parkingSettlement.ts` for display only:
 * the server still snapshots the authoritative numbers on the transaction. Whole-peso display
 * is intentional here (rate fields are whole pesos).
 */

export type ParkingNightlyPayout = {
  guestPays: number;
  hostGross: number;
  commissionAmount: number;
  hostNet: number;
};

function roundPeso(value: number): number {
  return Math.round(value);
}

export function computeParkingNightlyPayout(input: {
  hostRate: number;
  guestRate: number;
  commissionPct: number;
}): ParkingNightlyPayout {
  const hostGross = Math.max(0, roundPeso(input.hostRate));
  const commissionAmount = Math.max(
    0,
    roundPeso(hostGross * Math.min(1, Math.max(0, input.commissionPct)))
  );
  return {
    guestPays: Math.max(0, roundPeso(input.guestRate)),
    hostGross,
    commissionAmount,
    hostNet: Math.max(0, hostGross - commissionAmount),
  };
}

/** Net per night for a booking sourced through the host's direct link. */
export function computeParkingDirectLinkNet(hostRate: number, commissionPct: number): number {
  return computeParkingNightlyPayout({
    hostRate,
    guestRate: hostRate,
    commissionPct,
  }).hostNet;
}

export type ParkingPlatformSettlement = {
  commissionAmount: number;
  hostNet: number;
  paymentFeeAmount: number;
  platformNetTotal: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Display mirror of `_shared/parkingSettlement.ts` for the super-admin preview. The server
 * snapshot remains the authority; this only powers a pre-save estimate.
 */
export function computeParkingPlatformSettlement(input: {
  guestChargeTotal: number;
  hostGrossTotal: number;
  commissionPct: number;
  paymentFeePct: number;
  paymentFeeFixed: number;
}): ParkingPlatformSettlement {
  const guest = Math.max(0, round2(input.guestChargeTotal));
  const gross = Math.max(0, round2(input.hostGrossTotal));
  const commissionAmount = round2(gross * Math.min(1, Math.max(0, input.commissionPct)));
  const hostNet = round2(Math.max(0, gross - commissionAmount));
  const paymentFeeAmount = Math.min(
    guest,
    round2(
      guest * Math.min(1, Math.max(0, input.paymentFeePct)) + Math.max(0, input.paymentFeeFixed)
    )
  );
  return {
    commissionAmount,
    hostNet,
    paymentFeeAmount,
    platformNetTotal: round2(guest - hostNet - paymentFeeAmount),
  };
}
