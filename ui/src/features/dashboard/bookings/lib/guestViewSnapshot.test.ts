import { describe, expect, it } from 'vitest';

import { guestViewSnapshot } from '@/features/dashboard/bookings/lib/guestViewSnapshot';

import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: 'b1',
    status: 'PENDING_REVIEW',
    booking_rate: 10000,
    down_payment: 0,
    security_deposit: 0,
    guest_balance_paid_amount: 0,
    guest_balance_payment_receipt_url: null,
    ...overrides,
  } as unknown as BookingRow;
}

describe('guestViewSnapshot', () => {
  it('says the guest is waiting for review while the booking is pending', () => {
    const snapshot = guestViewSnapshot(booking({ status: 'PENDING_REVIEW' }));
    expect(snapshot.statusWord).toBe('Request sent');
    expect(snapshot.nextAction).toBe('Waiting for your review');
  });

  it('uses the shared status word for a confirmed booking', () => {
    const snapshot = guestViewSnapshot(booking({ status: 'PENDING_DOCUMENTS' }));
    expect(snapshot.statusWord).toBe('Confirmed');
    expect(snapshot.nextAction).toBe('Waiting for their check-in details');
  });

  it('flags a missing balance receipt when money is owed', () => {
    const snapshot = guestViewSnapshot(booking({ status: 'PENDING_DOCUMENTS' }));
    expect(snapshot.hasBalanceDue).toBe(true);
    expect(snapshot.missing).toContain('Balance receipt');
  });

  it('drops the receipt once it has been uploaded', () => {
    const snapshot = guestViewSnapshot(
      booking({
        status: 'READY_FOR_CHECKIN',
        guest_balance_payment_receipt_url: 'https://example.com/r.jpg',
      })
    );
    expect(snapshot.missing).not.toContain('Balance receipt');
  });

  it('asks for payment on a ready booking that still owes', () => {
    const snapshot = guestViewSnapshot(booking({ status: 'READY_FOR_CHECKIN' }));
    expect(snapshot.statusWord).toBe('Ready for check-in');
    expect(snapshot.nextAction).toBe('Paying the remaining balance');
  });

  it('does not ask for payment when nothing is owed', () => {
    const snapshot = guestViewSnapshot(
      booking({ status: 'READY_FOR_CHECKIN', booking_rate: 0, down_payment: 0 })
    );
    expect(snapshot.hasBalanceDue).toBe(false);
    expect(snapshot.nextAction).toBe('Arriving');
  });

  it('lists check-in documents while they are pending', () => {
    const snapshot = guestViewSnapshot(booking({ status: 'PENDING_GAF' }));
    expect(snapshot.missing).toContain('Check-in documents');
  });

  it('uses the shared word and no next action after cancellation', () => {
    const snapshot = guestViewSnapshot(booking({ status: 'CANCELLED' }));
    expect(snapshot.statusWord).toBe('Cancelled');
    expect(snapshot.nextAction).toContain('cancelled');
  });

  it('says the stay is complete after completion', () => {
    const snapshot = guestViewSnapshot(booking({ status: 'COMPLETED' }));
    expect(snapshot.statusWord).toBe('Completed');
    expect(snapshot.nextAction).toContain('complete');
  });
});
