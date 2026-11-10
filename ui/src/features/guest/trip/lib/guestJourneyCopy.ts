/**
 * Guest-facing vocabulary for a booking — client mirror of
 * `supabase/functions/_shared/guestJourneyCopy.ts`.
 *
 * Keep the body byte-for-byte aligned with the server copy (only this header differs).
 * `guestJourneyCopyParity.test.ts` fails on drift.
 *
 * Plan: docs/workflow/in-progress/guest-post-booking-journey.md §3.3
 */

export type GuestJourneyStatusWord =
  | 'Request sent'
  | 'Confirmed'
  | 'Ready for check-in'
  | 'Checked out'
  | 'Deposit refund'
  | 'Completed'
  | 'Cancelled';

const CONFIRMED_STATUSES = new Set([
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
]);

/** Status → guest word. Unknown statuses fall back to "Request sent" (never "Booked"). */
export function guestJourneyStatusWord(status: string): GuestJourneyStatusWord {
  const s = String(status ?? '').trim();
  if (s === 'CANCELLED') return 'Cancelled';
  if (s === 'PENDING_REVIEW') return 'Request sent';
  if (CONFIRMED_STATUSES.has(s)) return 'Confirmed';
  if (s === 'READY_FOR_CHECKIN') return 'Ready for check-in';
  if (s === 'READY_FOR_CHECKOUT') return 'Checked out';
  if (s === 'PENDING_SD_REFUND') return 'Deposit refund';
  if (s === 'COMPLETED') return 'Completed';
  return 'Request sent';
}

/**
 * How long a host usually takes to answer, from the property's own history.
 *
 * Needs at least `MIN_RESPONSE_SAMPLES` answered requests before it claims a number; below
 * that it falls back to the generic line. `medianHours` is the median time between a
 * request and the host's first reply.
 */
export const MIN_RESPONSE_SAMPLES = 5;

export function guestJourneyReviewExpectation(medianHours: number | null | undefined): string {
  if (medianHours == null || !Number.isFinite(Number(medianHours))) {
    return 'Most hosts reply within a day';
  }
  const hours = Number(medianHours);
  if (hours <= 0) return 'Most hosts reply within a few hours';
  if (hours < 24) {
    const rounded = Math.max(1, Math.round(hours));
    return `Hosts usually reply within ${rounded} hour${rounded === 1 ? '' : 's'}`;
  }
  const days = Math.max(1, Math.round(hours / 24));
  return `Hosts usually reply within ${days} day${days === 1 ? '' : 's'}`;
}
