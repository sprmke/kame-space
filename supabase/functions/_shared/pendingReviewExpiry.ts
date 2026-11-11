/**
 * Pending-review request expiry — the sweep.
 *
 * Policy (window, invariants, the decision itself) lives in `pendingReviewPolicy.ts`, which has
 * no imports so the email copy can quote the lead time without a cycle.
 */

import { buildActorContext } from './activityLog.ts';
import { cancelBooking } from './cancellationService.ts';
import { verifyCronSecret } from './cronSecretGate.ts';
import { DatabaseService } from './databaseService.ts';
import { sendPendingReviewChaseHost } from './emailService.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  PENDING_REVIEW_CHASE_LEAD_DAYS,
  PENDING_REVIEW_EXPIRY_DAYS,
  decidePendingReviewAction,
  pendingReviewAmountPaid,
} from './pendingReviewPolicy.ts';

export function verifyPendingReviewExpiryCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'PENDING_REVIEW_EXPIRY_CRON_SECRET',
    headerName: 'x-pending-review-expiry-cron-secret',
  });
}

export type PendingReviewCandidate = {
  id: string;
  property_id: string | null;
  status: string;
  created_at: string | null;
  pending_review_chased_at: string | null;
  down_payment: number | null;
  guest_balance_paid_amount: number | null;
  guest_email: string | null;
  external_source: string | null;
  parking_id: string | null;
};

export type PendingReviewSweepResult = {
  candidates: number;
  chased: number;
  expired: number;
  skipped: number;
  failed: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Loads every pending request old enough to matter.
 *
 * Bounded, and scoped to property bookings: parking bookings live on the same table with a
 * `parking_id` and have their own lifecycle, and imported/OTA rows are not ours to cancel.
 */
export async function loadPendingReviewCandidates(
  now: Date = new Date()
): Promise<PendingReviewCandidate[]> {
  const cutoff = new Date(
    now.getTime() - (PENDING_REVIEW_EXPIRY_DAYS - PENDING_REVIEW_CHASE_LEAD_DAYS) * DAY_MS
  ).toISOString();

  const { data, error } = await createServiceClient()
    .from('guest_submissions')
    .select(
      'id, property_id, status, created_at, pending_review_chased_at, down_payment, guest_balance_paid_amount, guest_email, external_source, parking_id'
    )
    .eq('status', 'PENDING_REVIEW')
    .lte('created_at', cutoff)
    .is('parking_id', null)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[pendingReviewExpiry] candidate query failed:', error.message);
    return [];
  }

  return (data ?? []) as PendingReviewCandidate[];
}

async function chase(row: PendingReviewCandidate, now: Date): Promise<boolean> {
  const booking = await DatabaseService.getBookingById(row.id);
  if (!booking) return false;

  await sendPendingReviewChaseHost(booking as never);

  // Stamp after a successful send, the same reasoning as the pre-arrival reminder: stamping
  // first would silence the only warning a host gets if the send throws.
  await createServiceClient()
    .from('guest_submissions')
    .update({ pending_review_chased_at: now.toISOString() })
    .eq('id', row.id)
    .is('pending_review_chased_at', null);

  return true;
}

async function expire(row: PendingReviewCandidate): Promise<boolean> {
  const booking = await DatabaseService.getBookingById(row.id);
  if (!booking) return false;

  // Re-check on the fresh row: the guest may have cancelled, or the host accepted, between the
  // candidate query and here.
  if (String((booking as { status?: unknown }).status ?? '') !== 'PENDING_REVIEW') return false;

  const result = await cancelBooking({
    booking: booking as never,
    initiator: 'system',
    reasonCode: 'request_expired',
    reasonNote: `No host response within ${PENDING_REVIEW_EXPIRY_DAYS} days.`,
    actor: buildActorContext('cron', { cron: 'pending-review-expiry' }),
  });

  return !result.alreadyCancelled;
}

/** One sweep. Safe to re-run: the chase stamp and the status re-check make it converge. */
export async function runPendingReviewExpirySweep(
  now: Date = new Date()
): Promise<PendingReviewSweepResult> {
  const candidates = await loadPendingReviewCandidates(now);
  const result: PendingReviewSweepResult = {
    candidates: candidates.length,
    chased: 0,
    expired: 0,
    skipped: 0,
    failed: 0,
  };

  for (const row of candidates) {
    const action = decidePendingReviewAction({
      status: row.status,
      createdAt: row.created_at,
      chasedAt: row.pending_review_chased_at,
      amountPaidPhp: pendingReviewAmountPaid(row),
      now,
    });

    if (action === 'wait') {
      result.skipped += 1;
      continue;
    }

    // An OTA row is the channel's to cancel, not ours.
    if (String(row.external_source ?? '').trim()) {
      result.skipped += 1;
      continue;
    }

    try {
      const done = action === 'chase' ? await chase(row, now) : await expire(row);
      if (!done) {
        result.skipped += 1;
        continue;
      }
      if (action === 'chase') result.chased += 1;
      else result.expired += 1;
    } catch (err) {
      console.error(`[pendingReviewExpiry] ${action} failed for ${row.id}:`, err);
      result.failed += 1;
    }
  }

  return result;
}

/** Re-exported so callers keep one import for the feature. */
export { PENDING_REVIEW_CHASE_LEAD_DAYS, PENDING_REVIEW_EXPIRY_DAYS };
