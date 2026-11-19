export const DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE = 300;
export const DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE = 400;

/** Fallback-only defaults, used before the real `parking-pricing` GET response loads. */
export const STUB_COMMISSION_PCT = 0.1;
/** Phase 8 fallback — half the standard stub, matches the platform_parking_settings default. */
export const STUB_DIRECT_COMMISSION_PCT = 0.05;
export const STUB_GUEST_FEE_PCT = 0.05;
export const STUB_GUEST_FEE_FIXED = 15;

export type ParkingPricingDefaults = {
  weekdayNightlyRate: number;
  weekendNightlyRate: number;
};

export const FALLBACK_PARKING_PRICING_DEFAULTS: ParkingPricingDefaults = {
  weekdayNightlyRate: DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE,
  weekendNightlyRate: DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE,
};

export function parkingPricingDefaultsFromDto(
  dto?: Partial<ParkingPricingDefaults> | null
): ParkingPricingDefaults {
  if (!dto) return FALLBACK_PARKING_PRICING_DEFAULTS;
  return {
    weekdayNightlyRate:
      dto.weekdayNightlyRate ?? FALLBACK_PARKING_PRICING_DEFAULTS.weekdayNightlyRate,
    weekendNightlyRate:
      dto.weekendNightlyRate ?? FALLBACK_PARKING_PRICING_DEFAULTS.weekendNightlyRate,
  };
}
