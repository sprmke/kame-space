import { describe, expect, it } from 'vitest';

import { v5Fees } from '@/features/guest/marketing/for-hosts/v5/data/hostLandingV5';
import {
  nightFeeComparison,
  feeSavings,
} from '@/features/guest/marketing/for-hosts/v5/lib/feeSavings';

import { GOLDEN_SOLD_PLANS } from '@/features/dashboard/plans/lib/planTierGolden';

describe('feeSavings', () => {
  it('adds up the fee for the month and subtracts the plan', () => {
    expect(feeSavings({ rate: 3500, nights: 12, planPhp: 999, feePercent: 15.5 })).toEqual({
      fee: 6510,
      keep: 5511,
      coverNights: 2,
    });
  });

  it('rounds the cover nights up to a whole night', () => {
    // ₱155 of fee a night: ₱999 needs 6.4 nights, so 7.
    expect(feeSavings({ rate: 1000, nights: 30, planPhp: 999, feePercent: 15.5 }).coverNights).toBe(
      7
    );
    // Exactly covered: ₱500 a night against ₱1,500.
    expect(feeSavings({ rate: 5000, nights: 3, planPhp: 1500, feePercent: 10 }).coverNights).toBe(
      3
    );
  });

  it('reports a negative keep when the plan costs more than the fee', () => {
    const result = feeSavings({ rate: 1000, nights: 2, planPhp: 999, feePercent: 15.5 });
    expect(result.fee).toBe(310);
    expect(result.keep).toBe(-689);
    expect(result.coverNights).toBeGreaterThan(2);
  });

  it('needs no nights to cover a free plan', () => {
    expect(feeSavings({ rate: 3500, nights: 12, planPhp: 0, feePercent: 15.5 }).coverNights).toBe(
      0
    );
  });
});

describe('v5Fees fallback prices', () => {
  it('match the list price and name of each sold plan', () => {
    for (const plan of v5Fees.plans) {
      const golden = GOLDEN_SOLD_PLANS.find((item) => item.code === plan.code);
      expect(golden, plan.code).toBeDefined();
      expect(plan.listPhp).toBe(golden?.pricePhp);
      expect(plan.label).toBe(golden?.displayName);
    }
  });
});

describe('nightFeeComparison', () => {
  it('shows what the host gets under each side', () => {
    expect(nightFeeComparison({ rate: 3500, nights: 6, planPhp: 799, feePercent: 15.5 })).toEqual({
      feePerNight: 543,
      gross: 21000,
      fee: 3255,
      feeNet: 17745,
      planNet: 20201,
      save: 2456,
      coverNights: 2,
    });
  });

  it('rounds the cover nights up to a whole night', () => {
    // ₱155 of fee a night: ₱799 needs 5.2 nights, so 6.
    expect(
      nightFeeComparison({ rate: 1000, nights: 10, planPhp: 799, feePercent: 15.5 }).coverNights
    ).toBe(6);
  });

  it('reports a negative save when the plan costs more than the fee', () => {
    const result = nightFeeComparison({ rate: 1000, nights: 1, planPhp: 799, feePercent: 15.5 });
    expect(result.feeNet).toBe(845);
    expect(result.planNet).toBe(201);
    expect(result.save).toBe(-644);
  });

  it('needs no nights to cover a free plan', () => {
    expect(
      nightFeeComparison({ rate: 3500, nights: 6, planPhp: 0, feePercent: 15.5 }).coverNights
    ).toBe(0);
  });
});
