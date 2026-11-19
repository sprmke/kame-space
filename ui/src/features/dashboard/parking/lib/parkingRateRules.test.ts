import { describe, expect, it } from 'vitest';

import { isValidParkingRate, PARKING_MIN_NIGHTLY_RATE } from './parkingRateRules';

describe('isValidParkingRate', () => {
  it('rejects empty drafts, zero, and anything below the minimum', () => {
    expect(isValidParkingRate(NaN)).toBe(false);
    expect(isValidParkingRate(0)).toBe(false);
    expect(isValidParkingRate(99)).toBe(false);
    expect(isValidParkingRate(-100)).toBe(false);
  });

  it('accepts the minimum and has no maximum', () => {
    expect(isValidParkingRate(PARKING_MIN_NIGHTLY_RATE)).toBe(true);
    expect(isValidParkingRate(325)).toBe(true);
    expect(isValidParkingRate(50_000)).toBe(true);
  });
});
