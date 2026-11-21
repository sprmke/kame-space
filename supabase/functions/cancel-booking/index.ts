/**
 * cancel-booking — host-initiated cancellation with a reason, refund preview and
 * optional override. Guest cancellations use `guest-cancel-booking` so the
 * public endpoint cannot borrow admin auth.
 */

import { WorkflowOrchestrator } from '../_shared/workflowOrchestrator.ts';
import { buildActorContext } from '../_shared/activityLog.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { notifyTelegramCancellation } from '../_shared/telegramMarketing.ts';
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { releaseAppliedVoucherOnCancel } from '../_shared/voucherRedemption.ts';
import {
  cancelBooking,
  isCancellationReasonCode,
  loadOpenCancellationRequest,
  loadPropertyCancellationContext,
  resolveHostCancellationInitiator,
  shouldNotifyGuestOnCancellation,
  type CancellationReasonCode,
} from '../_shared/cancellationService.ts';
import { raiseOpsAlertAfterResponse } from '../_shared/ops/opsAlert.ts';
import { manilaCheckInInstant } from '../_shared/cancellationRefund.ts';

serveAuthenticated('cancel-booking', async (req) => {
  requireHttpMethod(req, 'POST');
  const propertyAccess = await resolveScopedPropertyAccess(req, 'bookings.detail.workflow:edit');
  const { property } = propertyAccess;
  const propertyId = property.id;
  const body = await readJsonBody(req);
  const { bookingId, confirm, devControls = {} } = body;

  if (!bookingId) {
    return jsonError(req, 'Booking ID is required');
  }

  if (confirm !== true) {
    return jsonError(
      req,
      'Cancellation requires confirmation. Send { "confirm": true } in the request body.'
    );
  }

  await verifyBookingBelongsToProperty(String(bookingId), propertyId);

  const booking = await DatabaseService.getBookingById(String(bookingId));
  if (!booking) {
    return jsonError(req, 'Booking not found', 404);
  }

  const initiator = resolveHostCancellationInitiator({
    requested: body.initiator,
    hasOpenGuestRequest: Boolean(await loadOpenCancellationRequest(String(bookingId))),
  });
  if (body.initiator === 'guest' && initiator === 'host') {
    console.warn(
      '[cancel-booking] guest initiator ignored: no open cancellation request for this booking'
    );
  }
  const reasonCode: CancellationReasonCode = isCancellationReasonCode(body.reasonCode)
    ? body.reasonCode
    : 'other';
  const reasonNote = typeof body.reasonNote === 'string' ? body.reasonNote.trim() : '';
  const overrideRaw = body.refundOverridePhp;
  const refundOverridePhp =
    overrideRaw === null || overrideRaw === undefined || overrideRaw === ''
      ? null
      : Number(overrideRaw);
  const overrideNote = typeof body.overrideNote === 'string' ? body.overrideNote.trim() : '';

  if (refundOverridePhp != null && !Number.isFinite(refundOverridePhp)) {
    return jsonError(req, 'Refund override must be a valid amount');
  }
  if (refundOverridePhp != null) {
    if (!overrideNote) {
      return jsonError(req, 'Add a note explaining the refund override');
    }
  }
  if (initiator === 'host' && !reasonNote && reasonCode === 'other') {
    return jsonError(req, 'Add a short reason for the cancellation');
  }

  const actor = buildActorContext('dashboard', { propertyAccess }, req);

  const result = await cancelBooking({
    booking,
    initiator,
    reasonCode,
    reasonNote: reasonNote || null,
    overrideRefundPhp: refundOverridePhp,
    overrideNote: overrideNote || null,
    notifyGuest: shouldNotifyGuestOnCancellation({
      reasonCode,
      requested: body.notifyGuest,
    }),
    actor,
    devControls: (devControls ?? {}) as Record<string, boolean>,
  });

  // A late host cancel is the highest-harm cancellation: the guest may have no time to find
  // another place. Alert the ops channel (ids and reason only, no guest PII).
  if (initiator === 'host' && !result.alreadyCancelled) {
    try {
      const cancellationContext = await loadPropertyCancellationContext(propertyId);
      const checkIn = manilaCheckInInstant(
        String(booking.check_in_date ?? ''),
        cancellationContext.checkInTime
      );
      const msToCheckIn = checkIn ? checkIn.getTime() - Date.now() : Number.POSITIVE_INFINITY;
      if (msToCheckIn > 0 && msToCheckIn <= 24 * 60 * 60 * 1000) {
        await raiseOpsAlertAfterResponse({
          key: 'booking:host_cancel_within_24h',
          tier: 'p1',
          source: 'journey',
          title: 'Host cancelled inside 24 hours',
          summary: 'A guest lost their stay close to check-in. Review the reason and refund.',
          context: {
            booking_id: String(bookingId),
            property_id: propertyId,
            reason_code: reasonCode,
            hours_to_check_in: Math.round(msToCheckIn / (60 * 60 * 1000)),
          },
        });
      }
    } catch (alertErr) {
      console.error('[cancel-booking] late-cancel alert failed (non-fatal):', alertErr);
    }
  }

  try {
    await releaseAppliedVoucherOnCancel(createServiceClient(), {
      id: String(bookingId),
      applied_voucher_source_booking_id:
        (booking.applied_voucher_source_booking_id as string | null | undefined) ?? null,
    });
  } catch (voucherErr) {
    console.error('[cancel-booking] voucher release failed (non-fatal):', voucherErr);
  }

  try {
    await notifyTelegramCancellation(
      booking.check_in_date as string,
      booking.check_out_date as string,
      { propertyId: String(booking.property_id ?? propertyId) }
    );
  } catch (tgErr) {
    console.error('[cancel-booking] Telegram notify failed (non-fatal):', tgErr);
  }

  return jsonResponse(req, {
    success: true,
    message: result.alreadyCancelled
      ? 'Booking was already cancelled.'
      : 'Booking cancelled. Dates are now available.',
    bookingId,
    guestName: result.booking.primary_guest_name,
    alreadyCancelled: result.alreadyCancelled,
    outcome: result.outcome,
    refund: result.refund,
    data: result.booking,
  });
});
