import { describe, expect, it } from 'vitest';

import {
  stayLedgerStatus,
  transactionLedgerStatus,
  buildStayLedgerEntry,
  buildTransactionLedgerEntry,
  buildFinanceLedgerEntries,
  filterFinanceLedgerEntries,
  sortFinanceLedgerEntries,
  paginateFinanceLedgerEntries,
  collectLedgerCategories,
  ledgerAmountTone,
  ledgerAmountClassName,
} from '@/features/dashboard/finance/lib/financeLedger';

describe('stayLedgerStatus', () => {
  it('stayLedgerStatus is exported', () => {
    expect(typeof stayLedgerStatus).toBe('function');
  });
});

describe('transactionLedgerStatus', () => {
  it('transactionLedgerStatus is exported', () => {
    expect(typeof transactionLedgerStatus).toBe('function');
  });
});

describe('buildStayLedgerEntry', () => {
  it('buildStayLedgerEntry is exported', () => {
    expect(typeof buildStayLedgerEntry).toBe('function');
  });
});

describe('buildTransactionLedgerEntry', () => {
  it('buildTransactionLedgerEntry is exported', () => {
    expect(typeof buildTransactionLedgerEntry).toBe('function');
  });
});

describe('buildFinanceLedgerEntries', () => {
  it('buildFinanceLedgerEntries is exported', () => {
    expect(typeof buildFinanceLedgerEntries).toBe('function');
  });
});

describe('filterFinanceLedgerEntries', () => {
  it('filterFinanceLedgerEntries is exported', () => {
    expect(typeof filterFinanceLedgerEntries).toBe('function');
  });
});

describe('sortFinanceLedgerEntries', () => {
  it('sortFinanceLedgerEntries is exported', () => {
    expect(typeof sortFinanceLedgerEntries).toBe('function');
  });
});

describe('paginateFinanceLedgerEntries', () => {
  it('paginateFinanceLedgerEntries is exported', () => {
    expect(typeof paginateFinanceLedgerEntries).toBe('function');
  });
});

describe('collectLedgerCategories', () => {
  it('collectLedgerCategories is exported', () => {
    expect(typeof collectLedgerCategories).toBe('function');
  });
});

describe('ledgerAmountTone', () => {
  const base = {
    id: 'entry-1',
    source: 'transaction' as const,
    date: '2026-03-01',
    description: 'Electricity bill',
    category: 'Utilities',
    type: 'income' as const,
    netAmount: 100,
  };

  it('does not present pending money as collected income', () => {
    expect(ledgerAmountTone({ ...base, status: 'pending' })).toBe('pending');
    expect(ledgerAmountTone({ ...base, status: 'canceled' })).toBe('canceled');
  });

  it('uses the income and expense tones only for completed entries', () => {
    expect(ledgerAmountTone({ ...base, status: 'completed' })).toBe('income');
    expect(ledgerAmountTone({ ...base, status: 'completed', type: 'expense' })).toBe('expense');
  });

  it('renders pending amounts in amber, not green', () => {
    expect(ledgerAmountClassName('pending')).toContain('amber');
    expect(ledgerAmountClassName('income')).not.toContain('amber');
  });
});
