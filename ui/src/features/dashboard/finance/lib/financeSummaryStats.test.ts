import { describe, expect, it } from 'vitest';

import {
  calculatePercentageChange,
  computeFinanceSummaryCardStats,
  withPeriodComparison,
} from '@/features/dashboard/finance/lib/financeSummaryStats';
import type {
  FinanceLineItem,
  FinanceStaysSummary,
  FinanceSummary,
} from '@/features/dashboard/finance/lib/types';

function stays(overrides: Partial<FinanceStaysSummary> = {}): FinanceStaysSummary {
  return {
    count: 0,
    completedCount: 0,
    bookingRate: 0,
    otherFees: 0,
    parkingMargin: 0,
    sdExpenses: 0,
    hostNetCompleted: 0,
    projectedNetPipeline: 0,
    outstandingGuestBalance: 0,
    ...overrides,
  };
}

function summary(overrides: Partial<FinanceSummary> = {}): FinanceSummary {
  return {
    period: { basis: 'check_in', from: '2026-11-01', to: '2026-11-30' },
    stays: stays(),
    operating: { income: 0, expenses: 0, net: 0 },
    grandNet: 0,
    ...overrides,
  };
}

function lineItem(overrides: Partial<FinanceLineItem> = {}): FinanceLineItem {
  return {
    id: 'item-1',
    kind: 'expense',
    label: 'Cleaning',
    amount: 500,
    category: 'cleaning',
    occurred_on: '2026-11-05',
    notes: null,
    receipt_path: null,
    recurrence_series_id: null,
    recurrence_interval: null,
    telegram_reminder_enabled: true,
    paid_at: null,
    created_by: 'user-1',
    created_at: '2026-11-05T00:00:00Z',
    updated_at: '2026-11-05T00:00:00Z',
    ...overrides,
  } as FinanceLineItem;
}

describe('computeFinanceSummaryCardStats', () => {
  it('adds completed stay net and pipeline to operating income', () => {
    const stats = computeFinanceSummaryCardStats(
      summary({
        operating: { income: 1000, expenses: 0, net: 1000 },
        stays: stays({ hostNetCompleted: 4000, projectedNetPipeline: 1500 }),
      })
    );

    expect(stats.totalIncome).toBe(6500);
    expect(stats.totalExpenses).toBe(0);
    expect(stats.netProfit).toBe(6500);
  });

  it('does not let a negative completed net reduce income; it becomes an expense', () => {
    const stats = computeFinanceSummaryCardStats(
      summary({
        stays: stays({ hostNetCompleted: -800, sdExpenses: 200 }),
      })
    );

    expect(stats.totalIncome).toBe(0);
    expect(stats.totalExpenses).toBe(1000);
    expect(stats.netProfit).toBe(-1000);
  });

  it('ignores a negative pipeline projection instead of subtracting it', () => {
    const stats = computeFinanceSummaryCardStats(
      summary({ stays: stays({ projectedNetPipeline: -500, hostNetCompleted: 300 }) })
    );

    expect(stats.totalIncome).toBe(300);
  });

  it('adds operating expenses to stay expenses', () => {
    const stats = computeFinanceSummaryCardStats(
      summary({
        operating: { income: 2000, expenses: 300, net: 1700 },
        stays: stays({ sdExpenses: 700 }),
      })
    );

    expect(stats.totalExpenses).toBe(1000);
    expect(stats.netProfit).toBe(1000);
  });

  it('counts only pending ledger items toward pending amount', () => {
    const stats = computeFinanceSummaryCardStats(
      summary({ stays: stays({ outstandingGuestBalance: 2000 }) }),
      [
        lineItem({ id: 'a', amount: 500 }),
        lineItem({ id: 'b', amount: 300 }),
        lineItem({ id: 'c', amount: 999, paid_at: '2026-11-06T00:00:00Z' }),
        lineItem({ id: 'd', amount: 100, telegram_reminder_enabled: false }),
      ]
    );

    expect(stats.pendingAmount).toBe(2800);
  });

  it('reports zero pending for an empty ledger and no outstanding balance', () => {
    const stats = computeFinanceSummaryCardStats(summary());

    expect(stats).toEqual({
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      pendingAmount: 0,
    });
  });
});

describe('calculatePercentageChange', () => {
  it('treats growth from zero as 100%', () => {
    expect(calculatePercentageChange(500, 0)).toBe(100);
    expect(calculatePercentageChange(0, 0)).toBe(0);
  });

  it('uses the absolute previous value so a loss does not flip the sign', () => {
    expect(calculatePercentageChange(-50, -100)).toBe(50);
    expect(calculatePercentageChange(50, -100)).toBe(150);
  });

  it('computes a normal change', () => {
    expect(calculatePercentageChange(150, 100)).toBeCloseTo(50, 6);
    expect(calculatePercentageChange(50, 100)).toBeCloseTo(-50, 6);
  });
});

describe('withPeriodComparison', () => {
  const current = { totalIncome: 200, totalExpenses: 100, netProfit: 100, pendingAmount: 0 };

  it('returns the current stats untouched without a previous period', () => {
    expect(withPeriodComparison(current)).toBe(current);
  });

  it('adds income, expense and net changes', () => {
    const previous = { totalIncome: 100, totalExpenses: 100, netProfit: 50, pendingAmount: 0 };
    const compared = withPeriodComparison(current, previous);

    expect(compared.incomeChange).toBeCloseTo(100, 6);
    expect(compared.expensesChange).toBeCloseTo(0, 6);
    expect(compared.netChange).toBeCloseTo(100, 6);
  });
});
