import { describe, expect, it } from 'vitest';

import {
  formatWeekendPremiumPercent,
  weekendPremiumPercent,
} from '@/features/dashboard/pricing/lib/weekendPremium';

describe('weekendPremiumPercent', () => {
  it('returns the rounded percent when weekday is positive', () => {
    expect(weekendPremiumPercent(300, 350)).toBe(17);
    expect(weekendPremiumPercent(400, 400)).toBe(0);
    expect(weekendPremiumPercent(400, 300)).toBe(-25);
  });

  it('returns 0 for empty, zero, or non-finite weekday', () => {
    expect(weekendPremiumPercent(0, 350)).toBe(0);
    expect(weekendPremiumPercent(-10, 350)).toBe(0);
    expect(weekendPremiumPercent(Number.NaN, 350)).toBe(0);
    expect(weekendPremiumPercent(300, Number.NaN)).toBe(0);
  });
});

describe('formatWeekendPremiumPercent', () => {
  it('formats zero, positive, and negative values', () => {
    expect(formatWeekendPremiumPercent(0)).toBe('0%');
    expect(formatWeekendPremiumPercent(17)).toBe('+17%');
    expect(formatWeekendPremiumPercent(-25)).toBe('-25%');
  });
});
