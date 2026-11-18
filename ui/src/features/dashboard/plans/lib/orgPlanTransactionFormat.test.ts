import { describe, expect, it } from 'vitest';

import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  paymentMethodLabel,
  transactionPeriodLabel,
  transactionPurposeLabel,
  transactionStatusMeta,
  transactionTitle,
} from '@/features/dashboard/plans/lib/orgPlanTransactionFormat';
import type { PlanFeatures } from '@/features/dashboard/plans/lib/planFeatures';

const GROWTH_PLAN: OrgBundlePlanDto = {
  id: 'plan-growth',
  code: 'growth',
  name: 'Pro',
  tagline: null,
  sortOrder: 2,
  pricingModel: 'subscription',
  pricePhp: 799,
  discountPercent: 20,
  volumeDiscountTiers: [],
  volumeRampFloorPhp: 500,
  volumeRampAtCount: 10,
  features: {} as PlanFeatures,
  isDefault: false,
};

describe('orgPlanTransactionFormat', () => {
  it('maps known payment statuses', () => {
    expect(transactionStatusMeta('paid')).toEqual({ label: 'Paid', tone: 'success' });
    expect(transactionStatusMeta('pending')).toEqual({ label: 'Pending', tone: 'secondary' });
    expect(transactionStatusMeta('failed')).toEqual({ label: 'Failed', tone: 'destructive' });
  });

  it('falls back for unknown statuses and knows refunds', () => {
    expect(transactionStatusMeta('refunded')).toEqual({ label: 'Refunded', tone: 'secondary' });
    expect(transactionStatusMeta('mystery')).toEqual({ label: 'mystery', tone: 'secondary' });
  });

  it('labels a payment kept as account credit', () => {
    expect(transactionStatusMeta('paid', { keptAsCredit: true }).label).toBe('Added as credit');
    expect(transactionStatusMeta('paid', { keptAsCredit: false }).label).toBe('Paid');
  });

  it('labels what a payment was for and its period', () => {
    expect(transactionPurposeLabel('renewal')).toBe('Renewal');
    expect(transactionPurposeLabel('change')).toBe('Plan change');
    expect(transactionPurposeLabel(null)).toBeNull();
    expect(
      transactionPeriodLabel({ periodStart: '2027-01-01', periodEnd: '2027-02-01' }, (iso) => iso)
    ).toBe('2027-01-01 to 2027-02-01');
    expect(transactionPeriodLabel({ periodStart: null, periodEnd: null }, (iso) => iso)).toBeNull();
  });

  it('formats payment method labels', () => {
    expect(paymentMethodLabel('qrph')).toBe('QR Ph');
    expect(paymentMethodLabel('gcash')).toBe('GCash');
    expect(paymentMethodLabel(null)).toBeNull();
  });

  it('resolves transaction titles from plan catalog', () => {
    expect(transactionTitle('plan-growth', [GROWTH_PLAN])).toBe('Pro plan');
    expect(transactionTitle('missing', [GROWTH_PLAN])).toBe('Subscription payment');
  });
});
