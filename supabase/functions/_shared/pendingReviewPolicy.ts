/**
 * Pending-review expiry policy — pure, no imports.
 *
 * Split from `pendingReviewExpiry.ts` so `emailService.ts` can quote the lead time without
 * importing the sweep (which imports `emailService`).
 *
 * A `PENDING_REVIEW` booking blocks its dates until it is cancelled: only `CANCELLED` frees a
 * night (`DatabaseService.checkOverlappingBookings`), and `get-booked-dates` stops returning the
 * row only once it is cancelled. A request the host never answers therefore locks the calendar
 * for the guest who wanted those nights and for every guest after them, and leaves the first
 * guest reading "your host is reviewing" forever.
 *
 *   day 0                    submission lands in PENDING_REVIEW
 *   day 5 (window - lead)    one chase email to the property mailbox
 *   day 7 (window)           still pending, and nothing paid → CANCELLED, reason `request_expired`
 *
 * Two invariants keep it safe:
 *
 * 1. **Never expire a booking that has money on it.** A paid request is a commitment; a human
 *    decides that one. It gets the chase and stays pending.
 * 2. **Never expire without the full lead.** Expiry needs the chase to have been sent at least
 *    `PENDING_REVIEW_CHASE_LEAD_DAYS` ago, not merely for the window to have elapsed. That is
 *    what makes the first run in an existing environment safe: every stale request is chased
 *    today and cancelled no earlier than two days from now, so no host loses a request they
 *    never had a chance to answer.
 */

/** Days after submission a request stops holding the calendar. */
export const PENDING_REVIEW_EXPIRY_DAYS = 7;

/** Notice the property mailbox gets before the request expires. */
export const PENDING_REVIEW_CHASE_LEAD_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PendingReviewAction = 'wait' | 'chase' | 'expire';

function ageMs(fromIso: string, now: Date): number | null {
  const from = Date.parse(fromIso);
  if (Number.isNaN(from)) return null;
  return now.getTime() - from;
}

/**
 * What the sweep should do with one request.
 *
 * Pure, so the window and the two invariants are tested with a fixed clock rather than by
 * waiting a week.
 */
export function decidePendingReviewAction(input: {
  status: string;
  createdAt: string | null | undefined;
  chasedAt: string | null | undefined;
  /** Everything the guest has paid: down payment plus settled balance. */
  amountPaidPhp: number;
  now?: Date;
}): PendingReviewAction {
  const now = input.now ?? new Date();
  if (String(input.status ?? '').trim() !== 'PENDING_REVIEW') return 'wait';

  const created = String(input.createdAt ?? '').trim();
  if (!created) return 'wait';

  const age = ageMs(created, now);
  if (age === null || age < 0) return 'wait';

  const hasPaid = Number(input.amountPaidPhp ?? 0) > 0;
  const chasedAt = String(input.chasedAt ?? '').trim();
  const chaseAtMs = (PENDING_REVIEW_EXPIRY_DAYS - PENDING_REVIEW_CHASE_LEAD_DAYS) * DAY_MS;
  const expireAtMs = PENDING_REVIEW_EXPIRY_DAYS * DAY_MS;

  if (!chasedAt) {
    return age >= chaseAtMs ? 'chase' : 'wait';
  }

  // A paid request is never expired automatically, and a request already chased never chases again.
  if (hasPaid) return 'wait';
  if (age < expireAtMs) return 'wait';

  const sinceChase = ageMs(chasedAt, now);
  if (sinceChase === null || sinceChase < PENDING_REVIEW_CHASE_LEAD_DAYS * DAY_MS) return 'wait';

  return 'expire';
}

/** Amount the guest has paid, in whole pesos. */
export function pendingReviewAmountPaid(row: {
  down_payment?: unknown;
  guest_balance_paid_amount?: unknown;
}): number {
  const sum = Number(row.down_payment ?? 0) + Number(row.guest_balance_paid_amount ?? 0);
  return Number.isFinite(sum) && sum > 0 ? sum : 0;
}
