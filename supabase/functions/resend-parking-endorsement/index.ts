/**
 * resend-parking-endorsement — host action to retry the PMO endorsement email after an
 * automatic send failed (for example a missing development PMO address).
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  resolveScopedParkingTeamAccess,
  verifyBookingBelongsToParking,
} from '../_shared/parkingScope.ts';
import {
  ParkingEndorsementRequestError,
  resendParkingEndorsementAsHost,
} from '../_shared/parkingEndorsementEmail.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('resend-parking-endorsement', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId ?? '').trim();
  if (!bookingId) return jsonError(req, 'bookingId is required');

  const { parkingRow } = await resolveScopedParkingTeamAccess(req, 'bookings:edit');
  await verifyBookingBelongsToParking(bookingId, String(parkingRow.id));

  try {
    const result = await resendParkingEndorsementAsHost(bookingId);
    return jsonSuccess(req, result);
  } catch (err) {
    if (err instanceof ParkingEndorsementRequestError) {
      return jsonError(req, err.message, err.status);
    }
    const message = err instanceof Error ? err.message : 'Failed to resend endorsement';
    console.error('[resend-parking-endorsement]', message);
    return jsonError(req, message, 500);
  }
});
