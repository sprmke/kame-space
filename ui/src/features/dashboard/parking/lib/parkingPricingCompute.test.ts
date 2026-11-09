import { describe, expect, it } from 'vitest';

import {
  computeParkingStayTotal,
  resolveParkingNightlyRateForDate,
} from '@/features/dashboard/parking/lib/parkingPricingCompute';
import type { ParkingPricingDefaults } from '@/features/dashboard/parking/lib/parkingPricingDefaults';

/*
 * Parking nights are priced by the admin rule (weekday / weekend) with per-date overrides.
 * These numbers are what a guest pays, so an off-by-one on the loop or a flipped weekend
 * boundary is a money bug.
 */

const RATES: ParkingPricingDefaults = { weekdayNightlyRate: 300, weekendNightlyRate: 400 };

/** Local-time date, which is how `toMidnight` and `dateKey` read it. */
function day(year: number, month1: number, date: number): Date {
  return new Date(year, month1 - 1, date);
}

describe('resolveParkingNightlyRateForDate', () => {
  it('uses the weekday rate Monday to Thursday', () => {
    // November 2026: the 2nd is a Monday.
    expect(resolveParkingNightlyRateForDate(day(2026, 11, 2), RATES)).toBe(300);
    expect(resolveParkingNightlyRateForDate(day(2026, 11, 5), RATES)).toBe(300);
  });

  it('treats Friday, Saturday and Sunday as weekend nights', () => {
    expect(resolveParkingNightlyRateForDate(day(2026, 11, 6), RATES)).toBe(400);
    expect(resolveParkingNightlyRateForDate(day(2026, 11, 7), RATES)).toBe(400);
    expect(resolveParkingNightlyRateForDate(day(2026, 11, 8), RATES)).toBe(400);
  });

  it('lets a date override win over the weekend rule', () => {
    expect(
      resolveParkingNightlyRateForDate(day(2026, 11, 7), RATES, { '2026-11-07': 999 })
    ).toBe(999);
  });

  it('accepts a zero override instead of falling back to the rule', () => {
    expect(
      resolveParkingNightlyRateForDate(day(2026, 11, 2), RATES, { '2026-11-02': 0 })
    ).toBe(0);
  });
});

describe('computeParkingStayTotal', () => {
  it('charges one rate per occupied night, not per calendar day touched', () => {
    // Monday to Wednesday is two nights.
    expect(computeParkingStayTotal(day(2026, 11, 2), day(2026, 11, 4), RATES)).toBe(600);
  });

  it('is zero for a same-day stay', () => {
    expect(computeParkingStayTotal(day(2026, 11, 2), day(2026, 11, 2), RATES)).toBe(0);
  });

  it('is zero when the checkout is before the check-in', () => {
    expect(computeParkingStayTotal(day(2026, 11, 4), day(2026, 11, 2), RATES)).toBe(0);
  });

  it('sums a weekend block Friday to Monday as three weekend nights', () => {
    expect(computeParkingStayTotal(day(2026, 11, 6), day(2026, 11, 9), RATES)).toBe(1200);
  });

  it('mixes weekday and weekend nights across a week', () => {
    // Monday to Monday: Mon Tue Wed Thu weekday (4 x 300), Fri Sat Sun weekend (3 x 400).
    expect(computeParkingStayTotal(day(2026, 11, 2), day(2026, 11, 9), RATES)).toBe(2400);
  });

  it('applies overrides only to their own night', () => {
    const total = computeParkingStayTotal(day(2026, 11, 2), day(2026, 11, 4), RATES, {
      '2026-11-03': 1000,
    });

    expect(total).toBe(1300);
  });

  it('ignores the time of day on both ends', () => {
    const checkIn = new Date(2026, 10, 2, 23, 45);
    const checkOut = new Date(2026, 10, 4, 0, 5);

    expect(computeParkingStayTotal(checkIn, checkOut, RATES)).toBe(600);
  });
});
