import { appendParkingId } from '@/features/dashboard/org/lib/adminParkingScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { ParkingPricingDefaults } from '@/features/dashboard/parking/lib/parkingPricingDefaults';

export type ParkingPricingDto = ParkingPricingDefaults & {
  dateOverrides: Record<string, number>;
  bookedDateKeys: string[];
  blockedDateKeys: string[];
  commissionPct: number;
  /** Phase 8 — direct-booking link commission + link-building fields. */
  directCommissionPct: number;
  /** Service fee guests pay on top of the host rate at checkout. */
  guestFeePct: number;
  guestFeeFixed: number;
  directBookingToken: string;
  directBookingSlug: string;
};

export type ParkingPricingPatch = Partial<ParkingPricingDefaults> & {
  dateOverrides?: Record<string, number>;
  blockRange?: { startDate: string; endDate: string; note?: string };
  unblockDateKeys?: string[];
};

export const PARKING_PRICING_QUERY_KEY = 'parking-pricing';

function parkingPricingPath(parkingId: string, month?: string): string {
  const params = new URLSearchParams();
  appendParkingId(params, parkingId);
  if (month) params.set('month', month);
  return `parking-pricing?${params.toString()}`;
}

export async function fetchParkingPricing(
  parkingId: string,
  month?: string
): Promise<ParkingPricingDto> {
  return callEdgeFunction<ParkingPricingDto>(parkingPricingPath(parkingId, month));
}

export async function saveParkingPricing(
  parkingId: string,
  patch: ParkingPricingPatch
): Promise<ParkingPricingDto> {
  return callEdgeFunction<ParkingPricingDto>(parkingPricingPath(parkingId), {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
