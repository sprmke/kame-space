import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE,
  DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE,
  FALLBACK_PARKING_PRICING_DEFAULTS,
  parkingPricingDefaultsFromDto,
} from '@/features/dashboard/parking/lib/parkingPricingDefaults';

describe('parkingPricingDefaultsFromDto', () => {
  it('falls back to the platform defaults when the DTO is missing', () => {
    expect(parkingPricingDefaultsFromDto(undefined)).toBe(FALLBACK_PARKING_PRICING_DEFAULTS);
    expect(parkingPricingDefaultsFromDto(null)).toBe(FALLBACK_PARKING_PRICING_DEFAULTS);
  });

  it('fills each missing rate independently', () => {
    expect(parkingPricingDefaultsFromDto({ weekdayNightlyRate: 250 })).toEqual({
      weekdayNightlyRate: 250,
      weekendNightlyRate: DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE,
    });

    expect(parkingPricingDefaultsFromDto({ weekendNightlyRate: 500 })).toEqual({
      weekdayNightlyRate: DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE,
      weekendNightlyRate: 500,
    });
  });

  it('keeps both supplied rates', () => {
    expect(parkingPricingDefaultsFromDto({ weekdayNightlyRate: 1, weekendNightlyRate: 2 })).toEqual({
      weekdayNightlyRate: 1,
      weekendNightlyRate: 2,
    });
  });

  it('ships a fallback pair that is safe to charge', () => {
    expect(FALLBACK_PARKING_PRICING_DEFAULTS.weekdayNightlyRate).toBeGreaterThan(0);
    expect(FALLBACK_PARKING_PRICING_DEFAULTS.weekendNightlyRate).toBeGreaterThan(0);
    expect(FALLBACK_PARKING_PRICING_DEFAULTS.weekendNightlyRate).toBeGreaterThanOrEqual(
      FALLBACK_PARKING_PRICING_DEFAULTS.weekdayNightlyRate
    );
  });
});
