import { describe, expect, it } from 'vitest';

import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import type { PlanFeatures } from '@/features/dashboard/plans/lib/planFeatures';
import { isPlanDowngrade } from '@/features/dashboard/plans/lib/planPresentation';

const emptyFeatures = {} as PlanFeatures;

function plan(
  overrides: Partial<OrgBundlePlanDto> & Pick<OrgBundlePlanDto, 'id' | 'code' | 'sortOrder'>
): OrgBundlePlanDto {
  return {
    name: overrides.code,
    tagline: null,
    pricingModel: 'subscription',
    pricePhp: 0,
    discountPercent: 0,
    volumeDiscountTiers: [],
    volumeRampFloorPhp: 0,
    volumeRampAtCount: 10,
    features: emptyFeatures,
    isDefault: false,
    ...overrides,
  };
}

describe('isPlanDowngrade', () => {
  const pro = plan({ id: 'pro', code: 'pro', sortOrder: 30, pricePhp: 1439 });
  const starter = plan({ id: 'starter', code: 'starter', sortOrder: 10, pricePhp: 399 });
  const free = plan({ id: 'free', code: 'free', sortOrder: 0, isDefault: true });

  it('detects paid to lower paid', () => {
    expect(isPlanDowngrade(pro, starter)).toBe(true);
  });

  it('detects paid to Free', () => {
    expect(isPlanDowngrade(pro, free)).toBe(true);
  });

  it('rejects upgrades', () => {
    expect(isPlanDowngrade(starter, pro)).toBe(false);
  });
});
