import {
  computeTotalGuestBalance,
  guestBalancePaidRecorded,
} from '@/features/dashboard/bookings/lib/totalGuestBalance';
import { guestJourneyStatusWord } from '@/features/guest/trip/lib/guestJourneyCopy';

import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

/**
 * What the guest is looking at right now, for the host's "Guest view" card (plan 7.1).
 *
 * Derived from the booking row only — the same words the guest's trip page shows, so the
 * host is never reading a second, conflicting story. Read-only: it drives a summary, not a
 * workflow decision.
 */
export type GuestViewSnapshot = {
  /** The guest's status word, shared with the trip page and every email. */
  statusWord: string;
  /** The one thing the guest is waiting on or doing, in the host's words. */
  nextAction: string;
  /** Things still missing before arrival, if any. */
  missing: string[];
  /** True while the guest still owes money. */
  hasBalanceDue: boolean;
};

const CONFIRMED = new Set([
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
]);

export function guestViewSnapshot(booking: BookingRow): GuestViewSnapshot {
  const status = String(booking.status ?? '').trim();
  const total = computeTotalGuestBalance(booking);
  const paid = guestBalancePaidRecorded(booking);
  const amountDue =
    total == null ? 0 : Math.max(0, Math.round(total * 100) - Math.round(paid * 100)) / 100;
  const hasBalanceDue = amountDue > 0;
  const receiptUploaded = Boolean(String(booking.guest_balance_payment_receipt_url ?? '').trim());

  let nextAction: string;
  if (status === 'PENDING_REVIEW') nextAction = 'Waiting for your review';
  else if (status === 'CANCELLED') nextAction = 'Nothing. The booking is cancelled';
  else if (status === 'COMPLETED') nextAction = 'Nothing. The stay is complete';
  else if (status === 'PENDING_SD_REFUND') nextAction = 'Sending deposit refund details';
  else if (status === 'READY_FOR_CHECKOUT') nextAction = 'Checking out';
  else if (status === 'READY_FOR_CHECKIN') {
    nextAction = hasBalanceDue ? 'Paying the remaining balance' : 'Arriving';
  } else if (CONFIRMED.has(status)) {
    nextAction = 'Waiting for their check-in details';
  } else nextAction = 'Waiting';

  const missing: string[] = [];
  if (hasBalanceDue && !receiptUploaded) missing.push('Balance receipt');
  if (status === 'PENDING_DOCUMENTS' || status === 'PENDING_GAF') {
    missing.push('Check-in documents');
  }

  return {
    statusWord: guestJourneyStatusWord(status),
    nextAction,
    missing,
    hasBalanceDue,
  };
}
