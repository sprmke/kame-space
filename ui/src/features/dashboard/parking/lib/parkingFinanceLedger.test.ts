import { describe, expect, it } from 'vitest';

import type { ParkingPaymentRow } from '@/features/dashboard/parking/hooks/useParkingPayments';
import {
  buildParkingPayoutLedgerEntries,
  buildParkingPayoutLedgerEntry,
  parkingPayoutLedgerStatus,
} from '@/features/dashboard/parking/lib/parkingFinanceLedger';

function row(partial: Partial<ParkingPaymentRow> & Pick<ParkingPaymentRow, 'id'>): ParkingPaymentRow {
  return {
    bookingId: 'b1',
    parkingId: 'p1',
    guestChargeTotal: 700,
    hostGrossTotal: 700,
    commissionPct: 0.1,
    hostNetTotal: 630,
    nights: 2,
    bookingChannel: 'marketplace',
    status: 'paid',
    paidAt: '2026-11-18T08:00:00.000Z',
    disbursedAt: null,
    disbursementReference: null,
    refundReviewAt: null,
    refundedAt: null,
    refundAmount: null,
    refundReason: null,
    failureReason: null,
    ...partial,
  };
}

describe('parkingPayoutLedgerStatus', () => {
  it('maps disbursed, awaiting, refund review, and refunded', () => {
    expect(parkingPayoutLedgerStatus(row({ id: '1', disbursedAt: '2026-11-19T00:00:00Z' }))).toEqual(
      { status: 'completed', statusLabel: 'Disbursed' }
    );
    expect(parkingPayoutLedgerStatus(row({ id: '2' }))).toEqual({
      status: 'pending',
      statusLabel: 'Awaiting payout',
    });
    expect(parkingPayoutLedgerStatus(row({ id: '3', status: 'refund_review' }))).toEqual({
      status: 'pending',
      statusLabel: 'Refund review',
    });
    expect(parkingPayoutLedgerStatus(row({ id: '4', status: 'refunded' }))).toEqual({
      status: 'canceled',
      statusLabel: 'Refunded',
    });
  });
});

describe('buildParkingPayoutLedgerEntry', () => {
  it('builds a read-only income row with fee subtitle', () => {
    const entry = buildParkingPayoutLedgerEntry(row({ id: 'pay-1' }));
    expect(entry).toMatchObject({
      id: 'payout:pay-1',
      source: 'parking_payout',
      date: '2026-11-18',
      description: 'Marketplace payout',
      category: 'Marketplace',
      type: 'income',
      status: 'pending',
      statusLabel: 'Awaiting payout',
      netAmount: 630,
    });
    expect(entry?.subDescription).toContain('Guest paid');
    expect(entry?.subDescription).toContain('Fee 10%');
    expect(entry?.transaction).toBeUndefined();
  });

  it('marks direct-link channel in the description', () => {
    const entry = buildParkingPayoutLedgerEntry(
      row({ id: 'pay-2', bookingChannel: 'direct_link' })
    );
    expect(entry?.description).toBe('Marketplace payout · Direct link');
  });

  it('returns null when there is no paid or disbursed date', () => {
    expect(buildParkingPayoutLedgerEntry(row({ id: 'x', paidAt: null, disbursedAt: null }))).toBeNull();
  });
});

describe('buildParkingPayoutLedgerEntries', () => {
  it('filters by date range', () => {
    const rows = [
      row({ id: 'a', paidAt: '2026-11-01T00:00:00Z' }),
      row({ id: 'b', paidAt: '2026-11-15T00:00:00Z' }),
      row({ id: 'c', paidAt: '2026-12-01T00:00:00Z' }),
    ];
    const entries = buildParkingPayoutLedgerEntries(rows, {
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(entries.map((e) => e.id)).toEqual(['payout:a', 'payout:b']);
  });
});
