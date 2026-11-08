/**
 * Shared parking-broadcast claim/decline logic — single source of truth for
 * `claim-parking-booking` / `decline-parking-booking` and the AI dashboard assistant's
 * `propose_claim_parking_booking` / `propose_decline_parking_booking` tools.
 *
 * The guarded `.eq('status', 'PENDING_HOST_ACCEPTANCE')` UPDATE is the actual first-Accept-wins
 * safety mechanism (see `.cursor/rules/parking-workflow.mdc`) — it must not be reimplemented
 * per-caller, or a second implementation could silently diverge from the guard that makes this
 * race-safe.
 */

import { createServiceClient, type ParkingRow } from './orgAuth.ts';
import { type ActorContext } from './activityLog.ts';
import { logParkingStatusChange } from './parkingActivity.ts';
import { sendParkingAwaitingPaymentEmail } from './parkingBroadcastEmail.ts';
import { parkingAutomationEnabled } from './parkingAutomationToggles.ts';
import { advanceOrTerminateParkingBatch } from './parkingBroadcastExpireCron.ts';
import {
  assertParkingSlotAvailable,
  isParkingSlotUnavailableError,
  parkingBroadcastTtlMs,
} from './parkingBroadcast.ts';

export class ParkingBroadcastActionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function mmDdYyyyToYyyyMmDd(value: string): string {
  const [mm, dd, yyyy] = value.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Atomically claims a pending broadcast candidacy — sets `PENDING_PAYMENT` (not confirmed yet;
 * Phase 3 gates confirmation on the guest actually paying) with a fresh payment-window TTL, and
 * emails the guest a "pay to confirm" nudge instead of the old immediate confirmation.
 */
export async function claimParkingBooking(
  parkingId: string,
  bookingId: string,
  endorsementNote: string,
  parkingRow: ParkingRow,
  options?: { skipAwaitingPaymentEmail?: boolean; actor?: ActorContext }
): Promise<Record<string, unknown>> {
  if (endorsementNote.length > 2000) {
    throw new ParkingBroadcastActionError('endorsementNote must be 2000 characters or fewer');
  }

  const supabase = createServiceClient();

  const { data: preClaim } = await supabase
    .from('guest_submissions')
    .select(
      `id, status, parking_check_in_date, parking_check_out_date,
       check_in_date, check_out_date, parking_broadcast_batch_number`
    )
    .eq('id', bookingId)
    .maybeSingle();
  if (!preClaim) throw new ParkingBroadcastActionError('Booking not found', 404);
  if (preClaim.status !== 'PENDING_HOST_ACCEPTANCE') {
    throw new ParkingBroadcastActionError('already_claimed', 409);
  }

  const checkInDb = String(preClaim.parking_check_in_date ?? preClaim.check_in_date ?? '');
  const checkOutDb = String(preClaim.parking_check_out_date ?? preClaim.check_out_date ?? '');
  const batchNumber = Number(preClaim.parking_broadcast_batch_number ?? 1);
  const ttlMs = checkInDb ? parkingBroadcastTtlMs(mmDdYyyyToYyyyMmDd(checkInDb)) : 60 * 60_000;
  const paymentExpiresAtIso = new Date(Date.now() + ttlMs).toISOString();
  const trimmedNote = endorsementNote.trim();

  // Fast, friendly pre-check. The RPC below is the authority; if this read fails we still let
  // the database decide rather than blocking a legitimate claim.
  if (checkInDb && checkOutDb) {
    try {
      await assertParkingSlotAvailable(parkingId, checkInDb, checkOutDb, {
        excludeBookingId: bookingId,
      });
    } catch (err) {
      if (isParkingSlotUnavailableError(err)) {
        await declineForConflict(parkingId, bookingId, options?.actor);
        throw new ParkingBroadcastActionError('slot_unavailable', 409);
      }
      console.error(
        '[parkingBroadcastActions] availability pre-check failed, deferring to RPC:',
        err instanceof Error ? err.message : err
      );
    }
  }

  const { data, error } = await supabase.rpc('claim_parking_booking_slot', {
    p_booking_id: bookingId,
    p_parking_id: parkingId,
    p_endorsement_note: trimmedNote,
    p_payment_expires_at: paymentExpiresAtIso,
  });

  if (error) {
    const message = String(error.message ?? '');
    if (message.includes('offer_expired')) {
      await expireOffer(parkingId, bookingId, batchNumber);
      throw new ParkingBroadcastActionError('offer_expired', 410);
    }
    if (message.includes('slot_unavailable') || message.includes('parking_not_found')) {
      await declineForConflict(parkingId, bookingId, options?.actor);
      throw new ParkingBroadcastActionError('slot_unavailable', 409);
    }
    if (message.includes('already_claimed')) {
      throw new ParkingBroadcastActionError('already_claimed', 409);
    }
    console.error('[parkingBroadcastActions] claim RPC failed:', message);
    throw new ParkingBroadcastActionError('Failed to claim booking', 500);
  }

  const claimed = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!claimed) {
    throw new ParkingBroadcastActionError('Failed to claim booking', 500);
  }

  await logParkingStatusChange({
    booking: claimed,
    fromStatus: 'PENDING_HOST_ACCEPTANCE',
    toStatus: 'PENDING_PAYMENT',
    action: 'parking.claimed',
    actor: options?.actor ?? { actorType: 'system', source: 'dashboard' },
  });

  const guestEmail = String(claimed.guest_email ?? '').trim();
  if (guestEmail && options?.skipAwaitingPaymentEmail !== true) {
    const checkInDate = String(claimed.parking_check_in_date ?? claimed.check_in_date ?? '');
    const checkOutDate = String(claimed.parking_check_out_date ?? claimed.check_out_date ?? '');
    try {
      const emailEnabled = await parkingAutomationEnabled(parkingId, 'emailParkingGuestConfirmed');
      if (emailEnabled) {
        await sendParkingAwaitingPaymentEmail({
          to: guestEmail,
          parking: parkingRow,
          checkInDate,
          checkOutDate,
          expiresAtIso: paymentExpiresAtIso,
          bookingId,
        });
      }
    } catch (err) {
      console.error(
        '[parkingBroadcastActions] claim awaiting-payment email failed:',
        err instanceof Error ? err.message : err
      );
    }
  }

  return claimed;
}

/** Declines this host's offer as a slot conflict; never masks the caller's 409. */
async function declineForConflict(
  parkingId: string,
  bookingId: string,
  actor?: ActorContext
): Promise<void> {
  try {
    await declineParkingBooking(parkingId, bookingId, { reason: 'conflict', actor });
  } catch (err) {
    console.error(
      '[parkingBroadcastActions] conflict decline failed:',
      err instanceof Error ? err.message : err
    );
  }
}

/** Marks this offer expired and asks the shared batch brain what happens next. */
async function expireOffer(
  parkingId: string,
  bookingId: string,
  batchNumber: number
): Promise<void> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  await supabase
    .from('parking_booking_broadcasts')
    .update({ response: 'expired', responded_at: nowIso, response_reason: 'offer_expired' })
    .eq('booking_id', bookingId)
    .eq('parking_id', parkingId)
    .eq('response', 'pending');
  await advanceOrTerminateParkingBatch(bookingId, batchNumber);
}

/**
 * Records a decline; if every candidate *in this batch* has now declined, dispatches the
 * next ranked batch or terminates to NO_HOST_AVAILABLE (via `advanceOrTerminateParkingBatch`
 * — never reimplement that guard here, see its docstring).
 */
export async function declineParkingBooking(
  parkingId: string,
  bookingId: string,
  options?: { actor?: ActorContext; reason?: string }
): Promise<{ bookingTerminated: boolean }> {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('guest_submissions')
    .select(
      `id, parking_broadcast_batch_number, parking_id, parking_request_organization_id,
       primary_guest_name, guest_facebook_name, parking_check_in_date, check_in_date`
    )
    .eq('id', bookingId)
    .maybeSingle();
  const batchNumber = Number(booking?.parking_broadcast_batch_number ?? 1);

  const { data: declined, error: declineError } = await supabase
    .from('parking_booking_broadcasts')
    .update({
      response: 'declined',
      responded_at: new Date().toISOString(),
      response_reason: options?.reason ?? null,
    })
    .eq('booking_id', bookingId)
    .eq('parking_id', parkingId)
    .eq('response', 'pending')
    .select('id')
    .maybeSingle();

  if (declineError) {
    throw new ParkingBroadcastActionError('Failed to decline booking', 500);
  }
  if (!declined) {
    throw new ParkingBroadcastActionError('Already responded to this request', 409);
  }

  if (booking) {
    await logParkingStatusChange({
      booking: { ...booking, parking_id: booking.parking_id ?? parkingId },
      fromStatus: 'PENDING_HOST_ACCEPTANCE',
      toStatus: 'PENDING_HOST_ACCEPTANCE',
      action: 'parking.declined',
      actor: options?.actor ?? { actorType: 'system', source: 'dashboard' },
      metadata: { parking_id: parkingId, batch_number: batchNumber },
    });
  }

  const { data: remainingPending } = await supabase
    .from('parking_booking_broadcasts')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('batch_number', batchNumber)
    .eq('response', 'pending')
    .limit(1);

  if ((remainingPending?.length ?? 0) > 0) {
    return { bookingTerminated: false };
  }

  const result = await advanceOrTerminateParkingBatch(bookingId, batchNumber);
  return { bookingTerminated: result.terminated };
}
