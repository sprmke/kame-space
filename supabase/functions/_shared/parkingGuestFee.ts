/**
 * Parking guest service fee and the no-loss check. Pure, so checkout, the super-admin save
 * guard and the UI preview all use the same numbers.
 *
 *   guestFee     = hostGross × guestFeePct + guestFeeFixed        (once per booking)
 *   guestCharge  = hostGross + guestFee
 *   platformNet  = guestFee + commission − processorFee(guestCharge)
 */

import { computeParkingSettlement, type ParkingSettlement } from './parkingSettlement.ts';

/** Lowest nightly rate a host can set. */
export const PARKING_MIN_NIGHTLY_RATE = 100;

export type ParkingFeeSettings = {
  commissionPct: number;
  directCommissionPct: number;
  guestFeePct: number;
  guestFeeFixed: number;
  paymentFeePct: number;
  paymentFeeFixed: number;
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

export function computeGuestFee(hostGross: number, guestFeePct: number, guestFeeFixed: number) {
  const gross = nonNegative(hostGross);
  if (gross === 0) return 0;
  return round2(gross * clampPct(guestFeePct) + nonNegative(guestFeeFixed));
}

export type ParkingAmountsInput = {
  hostGrossTotal: number;
  commissionPct: number;
  guestFeePct: number;
  guestFeeFixed: number;
  paymentFeePct: number;
  paymentFeeFixed: number;
};

export type ParkingChargeBreakdown = ParkingSettlement & {
  hostGrossTotal: number;
  guestFeeTotal: number;
  guestChargeTotal: number;
};

/** One booking's money, from the host gross to the platform net. */
export function computeParkingChargeBreakdown(input: ParkingAmountsInput): ParkingChargeBreakdown {
  const hostGrossTotal = round2(nonNegative(input.hostGrossTotal));
  const guestFeeTotal = computeGuestFee(hostGrossTotal, input.guestFeePct, input.guestFeeFixed);
  const guestChargeTotal = round2(hostGrossTotal + guestFeeTotal);
  const settlement = computeParkingSettlement({
    guestChargeTotal,
    hostGrossTotal,
    commissionPct: input.commissionPct,
    paymentFeePct: input.paymentFeePct,
    paymentFeeFixed: input.paymentFeeFixed,
  });
  return { hostGrossTotal, guestFeeTotal, guestChargeTotal, ...settlement };
}

export type ParkingNoLossResult =
  { ok: true } | { ok: false; channel: 'standard' | 'direct_link'; reason: string };

/**
 * Platform net is linear in the host gross (`slope × H + intercept`), so it is non-negative for
 * every rate at or above `minRate` when the slope is not negative and the net at `minRate` is
 * not negative. Checked for both booking channels.
 */
export function checkParkingNoLoss(
  settings: ParkingFeeSettings,
  minRate: number = PARKING_MIN_NIGHTLY_RATE
): ParkingNoLossResult {
  const channels: Array<['standard' | 'direct_link', number]> = [
    ['standard', settings.commissionPct],
    ['direct_link', settings.directCommissionPct],
  ];
  const f = clampPct(settings.guestFeePct);
  const p = clampPct(settings.paymentFeePct);

  for (const [channel, commission] of channels) {
    const label = channel === 'standard' ? 'standard' : 'direct link';
    const slope = clampPct(commission) + f - p * (1 + f);
    if (slope < -1e-9) {
      return {
        ok: false,
        channel,
        reason: `The ${label} commission plus guest fee is below the processor percentage, so the platform loses money on high rates.`,
      };
    }
    const net = computeParkingChargeBreakdown({
      hostGrossTotal: minRate,
      commissionPct: commission,
      guestFeePct: settings.guestFeePct,
      guestFeeFixed: settings.guestFeeFixed,
      paymentFeePct: settings.paymentFeePct,
      paymentFeeFixed: settings.paymentFeeFixed,
    }).platformNetTotal;
    if (net < 0) {
      return {
        ok: false,
        channel,
        reason: `A ₱${minRate} night on the ${label} channel would lose ₱${Math.abs(net).toFixed(2)} after processor fees.`,
      };
    }
  }
  return { ok: true };
}
