/**
 * Guest-initiated parking request cancellation (Phase 3, overview decision D7/#5) — allowed any
 * time before payment succeeds: while still searching (`PENDING_HOST_ACCEPTANCE`) or while a
 * payment window is open (`PENDING_PAYMENT`). Once paid, cancellation is not self-service.
 */

import { createServiceClient } from './orgAuth.ts';
import { buildActorContext } from './activityLog.ts';
import { logParkingStatusChange } from './parkingActivity.ts';
import {
  assertParkingGuestOwnership,
  ParkingGuestOwnershipError,
} from './parkingGuestOwnership.ts';
import { expirePendingParkingTransactions } from './parkingPaymentOrchestrator.ts';
import { createNotification } from './notificationService.ts';

export class ParkingCancellationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function cancelParkingBooking(
  bookingId: string,
  userId: string,
  userEmail?: string | null
): Promise<{ cancelled: boolean }> {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('guest_submissions')
    .select(
      `id, status, guest_auth_user_id, parking_broadcast_batch_number, guest_email,
       parking_id, parking_request_organization_id, primary_guest_name, guest_facebook_name,
       parking_check_in_date`
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) throw new ParkingCancellationError('Booking not found', 404);
  try {
    await assertParkingGuestOwnership(supabase, booking, { id: userId, email: userEmail });
  } catch (err) {
    if (err instanceof ParkingGuestOwnershipError) {
      throw new ParkingCancellationError(err.message, err.status);
    }
    throw err;
  }

  const nowIso = new Date().toISOString();

  if (booking.status === 'PENDING_HOST_ACCEPTANCE') {
    const { data: pendingOffers } = await supabase
      .from('parking_booking_broadcasts')
      .select('parking_id')
      .eq('booking_id', bookingId)
      .eq('response', 'pending')
      .limit(10);

    const { data: cancelled, error } = await supabase
      .from('guest_submissions')
      .update({ status: 'CANCELLED', status_updated_at: nowIso, updated_at: nowIso })
      .eq('id', bookingId)
      .eq('status', 'PENDING_HOST_ACCEPTANCE')
      .select('id')
      .maybeSingle();
    if (error) throw new ParkingCancellationError('Failed to cancel booking', 500);
    if (!cancelled) throw new ParkingCancellationError('Nothing to cancel', 409);

    await supabase
      .from('parking_booking_broadcasts')
      .update({ response: 'expired', responded_at: nowIso })
      .eq('booking_id', bookingId)
      .eq('batch_number', Number(booking.parking_broadcast_batch_number ?? 1))
      .eq('response', 'pending');

    await logParkingStatusChange({
      booking,
      fromStatus: 'PENDING_HOST_ACCEPTANCE',
      toStatus: 'CANCELLED',
      actor: buildActorContext('public_form', {
        guest: { email: userEmail ?? (booking.guest_email as string | null) },
      }),
      metadata: { initiated_by: 'guest' },
    });

    await notifyHostsOfCancellation(
      supabase,
      bookingId,
      [...new Set((pendingOffers ?? []).map((row) => String(row.parking_id)))],
      String(booking.primary_guest_name ?? booking.guest_facebook_name ?? 'The guest')
    );

    return { cancelled: true };
  }

  if (booking.status === 'PENDING_PAYMENT') {
    // One guarded write, not release-then-cancel: a half state between the two writes let the
    // expire cron re-broadcast a request the guest was already cancelling (M-4).
    const { data: cancelled, error } = await supabase
      .from('guest_submissions')
      .update({
        status: 'CANCELLED',
        parking_id: null,
        parking_claimed_at: null,
        parking_endorsement_note: null,
        parking_payment_expires_at: null,
        status_updated_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', bookingId)
      .eq('status', 'PENDING_PAYMENT')
      .select('id')
      .maybeSingle();
    if (error) throw new ParkingCancellationError('Failed to cancel booking', 500);
    if (!cancelled) throw new ParkingCancellationError('Nothing to cancel', 409);

    await supabase
      .from('parking_booking_broadcasts')
      .update({ response: 'expired', responded_at: nowIso })
      .eq('booking_id', bookingId)
      .eq('response', 'claimed');

    await expirePendingParkingTransactions(bookingId, 'Guest cancelled while awaiting payment');

    await logParkingStatusChange({
      booking,
      fromStatus: 'PENDING_PAYMENT',
      toStatus: 'CANCELLED',
      actor: buildActorContext('public_form', {
        guest: { email: userEmail ?? (booking.guest_email as string | null) },
      }),
      metadata: { initiated_by: 'guest' },
    });

    await notifyHostsOfCancellation(
      supabase,
      bookingId,
      booking.parking_id ? [String(booking.parking_id)] : [],
      String(booking.primary_guest_name ?? booking.guest_facebook_name ?? 'The guest')
    );

    return { cancelled: true };
  }

  throw new ParkingCancellationError('This request can no longer be cancelled', 409);
}

/** In-app notice to each host whose offer/claim was dropped, never one per team member. */
async function notifyHostsOfCancellation(
  supabase: ReturnType<typeof createServiceClient>,
  bookingId: string,
  parkingIds: string[],
  guestName: string
): Promise<void> {
  if (parkingIds.length === 0) return;
  const { data: parkings } = await supabase
    .from('parkings')
    .select('id, organization_id')
    .in('id', parkingIds)
    .limit(20);

  for (const parking of parkings ?? []) {
    try {
      await createNotification({
        organizationId: String(parking.organization_id),
        parkingId: String(parking.id),
        type: 'parking_request_cancelled',
        title: 'Guest cancelled a request',
        body: `${guestName} cancelled the parking request.`,
        bookingId,
        dedupeKey: `parking-request-cancelled:${bookingId}:${parking.id}`,
      });
    } catch (err) {
      console.error(
        '[parkingCancellation] host notification failed:',
        err instanceof Error ? err.message : err
      );
    }
  }
}
