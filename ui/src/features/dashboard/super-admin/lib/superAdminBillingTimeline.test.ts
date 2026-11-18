import { describe, expect, it } from 'vitest';

import {
  buildBillingTimeline,
  findUnappliedPayments,
} from '@/features/dashboard/super-admin/lib/superAdminBillingTimeline';

describe('buildBillingTimeline', () => {
  it('merges events, payments and credit newest first', () => {
    const timeline = buildBillingTimeline({
      events: [
        {
          id: 'e1',
          event_type: 'past_due',
          previous_status: 'active',
          new_status: 'past_due',
          created_at: '2027-04-02T00:00:00Z',
        },
      ],
      transactions: [
        {
          id: 't1',
          amount: 1600,
          status: 'paid',
          purpose: 'renewal',
          receipt_number: 'KS-R-2027-000001',
          created_at: '2027-03-01T00:00:00Z',
          paid_at: '2027-03-01T01:00:00Z',
          applied: true,
        },
      ],
      ledger: [
        {
          id: 'l1',
          amount_php: -300,
          kind: 'stale_payment',
          created_at: '2027-04-05T00:00:00Z',
          note: 'Plan changed',
        },
      ],
    });
    expect(timeline.map((entry) => entry.source)).toEqual(['credit', 'event', 'payment']);
    expect(timeline[0].title).toBe('Payment kept as credit: +₱300 credit');
    expect(timeline[1].title).toBe('Became past due');
    expect(timeline[1].detail).toBe('active to past_due');
    expect(timeline[1].tone).toBe('warn');
    expect(timeline[2].title).toBe('Payment of ₱1,600 received');
    expect(timeline[2].detail).toBe('renewal · KS-R-2027-000001');
  });

  it('flags a payment that was held instead of applied', () => {
    const [entry] = buildBillingTimeline({
      events: [],
      transactions: [
        {
          id: 't2',
          amount: 999,
          status: 'paid',
          applied: false,
          review_reason: 'stale: period_already_renewed',
          created_at: '2027-04-01T00:00:00Z',
        },
      ],
      ledger: [],
    });
    expect(entry.title).toBe('Payment of ₱999 held');
    expect(entry.tone).toBe('warn');
  });

  it('never prints undefined for an unknown event', () => {
    const [entry] = buildBillingTimeline({
      events: [{ id: 'e', event_type: 'some_new_event', created_at: '2027-04-01T00:00:00Z' }],
      transactions: [],
      ledger: [],
    });
    expect(entry.title).toBe('some new event');
  });
});

describe('findUnappliedPayments', () => {
  it('returns paid rows that were never applied', () => {
    const rows = findUnappliedPayments([
      { id: 'a', amount: 1, status: 'paid', applied: true, created_at: '' },
      { id: 'b', amount: 1, status: 'paid', applied: false, created_at: '' },
      { id: 'c', amount: 1, status: 'paid', applied: null, created_at: '' },
      { id: 'd', amount: 1, status: 'pending', applied: null, created_at: '' },
    ]);
    expect(rows.map((row) => row.id)).toEqual(['b', 'c']);
  });
});
