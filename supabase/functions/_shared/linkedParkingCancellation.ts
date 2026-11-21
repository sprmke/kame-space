/**
 * Linked parking on a stay cancellation (readiness PRK-01).
 *
 * A host cancelling a stay must not leave the guest holding a paid parking booking for a stay
 * that no longer exists. Paid parking moves to `refund_review` (the super admin records the
 * refund, same as a host parking cancel); an unpaid request is simply cancelled and its open
 * broadcasts expire. Guest cancellations keep the self-service option and do not call this.
 *
 * Every step is best effort: the stay cancellation has already committed, so a parking failure
 * must never fail the request. The caller logs it.
 */

import { buildActorContext, type ActorContext } from './activityLog.ts';
import { createServiceClient } from './orgAuth.ts';
import { logParkingStatusChange } from './parkingActivity.ts';
import { sendParkingHostCancelledEmail } from './parkingBroadcastEmail.ts';

export type LinkedParkingCancelResult = {
  bookings: number;
  refundsInReview: number;
};

const TERMINAL_PARKING_STATUSES = new Set(['CANCELLED', 'COMPLETED', 'NO_HOST_AVAILABLE']);

export async function cancelLinkedParkingForStay(input: {
  stayBookingId: string;
  actor?: ActorContext;
}): Promise<LinkedParkingCancelResult> {
  const supabase = createServiceClient();
  const stayBookingId = String(input.stayBookingId ?? '').trim();
  if (!stayBookingId) return { bookings: 0, refundsInReview: 0 };

  const { data: rows, error } = await supabase
    .from('guest_submissions')
    .select(
      `id, status, parking_id, guest_email, primary_guest_name,
       parking_check_in_date, parking_check_out_date, check_in_date, check_out_date`
    )
    .eq('linked_property_booking_id', stayBookingId)
    .not('parking_id', 'is', null)
    .limit(50);
  if (error) throw new Error(`Could not load linked parking: ${error.message}`);

  const actor = input.actor ?? buildActorContext('cron', { cron: 'cancel-booking' });
  const nowIso = new Date().toISOString();
  let bookings = 0;
  let refundsInReview = 0;

  for (const row of rows ?? []) {
    const parkingBookingId = String(row.id);
    const status = String(row.status ?? '');
    if (TERMINAL_PARKING_STATUSES.has(status)) continue;

    // A paid parking charge must be refunded, not silently dropped.
    const { data: refundRows } = await supabase
      .from('parking_payment_transactions')
      .update({
        status: 'refund_review',
        refund_review_at: nowIso,
        refund_reason: 'Stay cancelled by the host',
      })
      .eq('booking_id', parkingBookingId)
      .eq('status', 'paid')
      .gt('guest_charge_total', 0)
      .select('id');
    if ((refundRows?.length ?? 0) > 0) refundsInReview += 1;

    const { data: cancelled, error: cancelError } = await supabase
      .from('guest_submissions')
      .update({ status: 'CANCELLED', status_updated_at: nowIso, updated_at: nowIso })
      .eq('id', parkingBookingId)
      .neq('status', 'CANCELLED')
      .select('id')
      .maybeSingle();
    if (cancelError || !cancelled) continue;

    await supabase
      .from('parking_booking_broadcasts')
      .update({ response: 'expired', responded_at: nowIso })
      .eq('booking_id', parkingBookingId)
      .eq('response', 'pending');

    bookings += 1;

    await logParkingStatusChange({
      booking: row as Record<string, unknown>,
      fromStatus: status,
      toStatus: 'CANCELLED',
      actor,
      action: 'parking.cancelled_by_host',
      metadata: { reason: 'linked_stay_cancelled', stay_booking_id: stayBookingId },
    });

    const guestEmail = String(row.guest_email ?? '').trim();
    if (guestEmail) {
      try {
        const { data: parking } = await supabase
          .from('parkings')
          .select('name, organization_id, residence_name, tower, level, slot_label')
          .eq('id', String(row.parking_id))
          .maybeSingle();
        if (parking) {
          await sendParkingHostCancelledEmail({
            to: guestEmail,
            parking,
            checkInDate: String(row.parking_check_in_date ?? row.check_in_date ?? ''),
            checkOutDate: String(row.parking_check_out_date ?? row.check_out_date ?? ''),
            bookingId: parkingBookingId,
          });
        }
      } catch (emailError) {
        console.error(
          '[linked-parking] cancelled email failed:',
          emailError instanceof Error ? emailError.message : emailError
        );
      }
    }
  }

  return { bookings, refundsInReview };
}
