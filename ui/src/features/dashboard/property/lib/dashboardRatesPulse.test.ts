import { describe, expect, it } from 'vitest';

import { FALLBACK_PROPERTY_PRICING_DEFAULTS } from '@/features/dashboard/pricing/lib/pricingCompute';
import {
  buildOpenRateHorizon,
  dashboardRatesMonthKeys,
  groupOpenNightsByWeek,
} from '@/features/dashboard/property/lib/dashboardRatesPulse';

describe('dashboardRatesMonthKeys', () => {
  it('spans into the next month when needed', () => {
    expect(dashboardRatesMonthKeys('2026-01-30', 5)).toEqual(['2026-01', '2026-02']);
  });
});

describe('buildOpenRateHorizon', () => {
  it('skips booked and blocked nights and caps the open list', () => {
    const nights = buildOpenRateHorizon({
      startIso: '2026-11-23',
      horizonDays: 10,
      limit: 3,
      defaults: {
        ...FALLBACK_PROPERTY_PRICING_DEFAULTS,
        weekdayNightlyRate: 2500,
        weekendNightlyRate: 3000,
      },
      bookedDateKeys: ['2026-11-23', '2026-11-25'],
      blockedDateKeys: ['2026-11-24'],
      dateOverrides: { '2026-11-26': 2750 },
    });

    expect(nights.map((night) => night.dateKey)).toEqual([
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
    ]);
    expect(nights[0]?.rate).toBe(2750);
    expect(nights[0]?.baseRate).toBe(2500);
  });

  it('surfaces smart rates when enabled and different from base', () => {
    const nights = buildOpenRateHorizon({
      startIso: '2026-11-23',
      horizonDays: 3,
      limit: 2,
      defaults: FALLBACK_PROPERTY_PRICING_DEFAULTS,
      smartPricingEnabled: true,
      smartRecommendations: { '2026-11-23': 9999 },
    });
    expect(nights[0]?.smartRate).toBe(9999);
    expect(nights[0]?.rate).toBe(9999);
  });
});

describe('groupOpenNightsByWeek', () => {
  it('buckets open nights into this week, next week, and later', () => {
    const nights = buildOpenRateHorizon({
      startIso: '2026-11-23',
      horizonDays: 21,
      limit: 6,
      defaults: FALLBACK_PROPERTY_PRICING_DEFAULTS,
      bookedDateKeys: [],
      blockedDateKeys: [],
    });
    const buckets = groupOpenNightsByWeek(nights, '2026-11-23');
    expect(buckets.map((bucket) => bucket.id)).toContain('this-week');
    expect(buckets.every((bucket) => bucket.nights.length > 0)).toBe(true);
  });
});
