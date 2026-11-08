/**
 * transition-parking-booking — Simple status changes for parking-only reservations.
 * Does not invoke the stay workflow orchestrator (no calendar/sheet/email side effects).
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { sendParkingHostCancelledEmail } from '../_shared/parkingBroadcastEmail.ts';
import { createNotification } from '../_shared/notificationService.ts';
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { withIdempotency } from '../_shared/idempotency.ts';
import { verifyParkingTeamAccess } from '../_shared/orgAuth.ts';
import { buildActorContext } from '../_shared/activityLog.ts';
import { logParkingStatusChange } from '../_shared/parkingActivity.ts';
import { verifyBookingBelongsToParking } from '../_shared/parkingScope.ts';
import { canTransition, isParkingStatus } from '../_shared/parkingStatusMachine.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

// `withIdempotency`: an `Idempotency-Key` (PWA offline-outbox replay) runs this
// transition at most once.
serveAuthenticated(
  'transition-parking-booking',
  withIdempotency(async (req) => {
    requireHttpMethod(req, 'POST');
    const body = await readJsonBody(req);
    const bookingId = String(body.bookingId ?? '').trim();
    const toStatus = String(body.toStatus ?? '').trim();

    if (!bookingId || !toStatus) {
      return jsonError(req, 'bookingId and toStatus are required');
    }
    if (!isParkingStatus(toStatus)) {
      return jsonError(req, `Unknown parking status: ${toStatus}`);
    }

    const booking = await DatabaseService.getBookingById(bookingId);
    if (!booking?.parking_id) {
      return jsonError(req, 'Parking booking not found', 404);
    }

    const parkingId = String(booking.parking_id);
    const parkingAccess = await verifyParkingTeamAccess(req, parkingId, 'bookings:edit');
    await verifyBookingBelongsToParking(bookingId, parkingId);

    const fromStatus = String(booking.status ?? '');
    if (!isParkingStatus(fromStatus)) {
      return jsonError(req, `Unknown parking status: ${fromStatus}`);
    }
    const cancelReason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const cancelNote = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
    const wasPaid = fromStatus === 'PENDING_REVIEW' || fromStatus === 'READY_FOR_CHECKIN';
    if (toStatus === 'CANCELLED' && wasPaid && !cancelReason) {
      return jsonError(req, 'A cancellation reason is required after payment', 400);
    }
    // PENDING_HOST_ACCEPTANCE only resolves via claim/decline/expire; PENDING_PAYMENT only via
    // webhook fulfillment, payment-TTL release, or guest cancel — never a plain transition.
    if (fromStatus === 'PENDING_HOST_ACCEPTANCE' || fromStatus === 'PENDING_PAYMENT') {
      return jsonError(req, `Cannot transition from ${fromStatus} to ${toStatus}`);
    }
    if (!canTransition(fromStatus, toStatus)) {
      return jsonError(req, `Cannot transition from ${fromStatus} to ${toStatus}`);
    }

    const updated = await DatabaseService.updateBookingStatus(bookingId, toStatus, fromStatus);

    let refundReviewCreated = false;
    if (toStatus === 'CANCELLED' && wasPaid) {
      const supabase = createServiceClient();
      const nowIso = new Date().toISOString();

      const { data: refundRows } = await supabase
        .from('parking_payment_transactions')
        .update({
          status: 'refund_review',
          refund_review_at: nowIso,
          refund_reason: (cancelReason || cancelNote || 'Host cancelled after payment').slice(
            0,
            500
          ),
        })
        .eq('booking_id', bookingId)
        .eq('status', 'paid')
        // A ₱0 complimentary owner booking has nothing to refund; do not create a review row.
        .gt('guest_charge_total', 0)
        .select('id');
      refundReviewCreated = (refundRows?.length ?? 0) > 0;

      const guestEmail = String(booking.guest_email ?? '').trim();
      if (guestEmail) {
        try {
          const { data: parkingRow } = await supabase
            .from('parkings')
            .select('name, organization_id, residence_name, tower, level, slot_label')
            .eq('id', String(booking.parking_id))
            .maybeSingle();
          if (parkingRow) {
            await sendParkingHostCancelledEmail({
              to: guestEmail,
              parking: parkingRow,
              checkInDate: String(booking.parking_check_in_date ?? booking.check_in_date ?? ''),
              checkOutDate: String(booking.parking_check_out_date ?? booking.check_out_date ?? ''),
              bookingId,
            });
          }
        } catch (err) {
          console.error(
            '[transition-parking-booking] host-cancel guest email failed:',
            err instanceof Error ? err.message : err
          );
        }
      }

      // Tell the property host when this parking booking belonged to one of their stays.
      const linkedPropertyBookingId = String(booking.linked_property_booking_id ?? '').trim();
      if (linkedPropertyBookingId) {
        try {
          const { data: linked } = await supabase
            .from('guest_submissions')
            .select('property_id')
            .eq('id', linkedPropertyBookingId)
            .maybeSingle();
          const propertyId = String(linked?.property_id ?? '');
          if (propertyId) {
            const { data: property } = await supabase
              .from('properties')
              .select('organization_id')
              .eq('id', propertyId)
              .maybeSingle();
            if (property?.organization_id) {
              await createNotification({
                organizationId: String(property.organization_id),
                propertyId,
                type: 'parking_cancelled_by_host',
                title: 'Parking cancelled',
                body: 'The parking host cancelled a booking linked to this stay.',
                bookingId: linkedPropertyBookingId,
                dedupeKey: `parking-cancelled:${bookingId}`,
              });
            }
          }
        } catch (err) {
          console.error(
            '[transition-parking-booking] linked-stay notification failed:',
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    await logParkingStatusChange({
      booking,
      fromStatus,
      toStatus,
      actor: buildActorContext('dashboard', { parkingAccess }, req),
      ...(toStatus === 'CANCELLED' && wasPaid
        ? { action: 'parking.cancelled_by_host' as const }
        : {}),
      metadata: {
        ...(cancelReason ? { reason: cancelReason } : {}),
        ...(cancelNote ? { note: cancelNote } : {}),
        ...(refundReviewCreated ? { refund_review: true } : {}),
      },
    });

    return jsonResponse(req, { success: true, data: updated, refundReviewCreated });
  })
);
