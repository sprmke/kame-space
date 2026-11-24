/**
 * booking-help — host read and close for a guest's urgent help request (SAFE-01).
 *
 * GET  ?booking_id=&property_id=  → the open request, or null
 * POST { bookingId, helpRequestId } → mark the case resolved
 *
 * Reading needs `bookings:view` so any teammate who can open the booking sees a guest in
 * trouble. Resolving needs `bookings.detail.workflow:edit`. The request row is the audit
 * record; resolving it lets the guest open a new case if another issue appears.
 */

import {
  BookingHelpError,
  loadOpenBookingHelp,
  resolveBookingHelp,
} from '../_shared/bookingHelp.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('booking-help', async (req, user) => {
  const url = new URL(req.url);
  const body = req.method === 'GET' ? {} : await readJsonBody(req);
  const bookingId = String(
    url.searchParams.get('booking_id') ?? (body as Record<string, unknown>).bookingId ?? ''
  ).trim();
  if (!bookingId) return jsonError(req, 'bookingId is required');

  const requiredPermission =
    req.method === 'GET' ? ('bookings:view' as const) : ('bookings.detail.workflow:edit' as const);
  const propertyAccess = await resolveScopedPropertyAccess(req, requiredPermission);
  await verifyBookingBelongsToProperty(bookingId, propertyAccess.property.id);

  try {
    if (req.method === 'GET') {
      return jsonSuccess(req, { request: await loadOpenBookingHelp(bookingId) });
    }

    if (req.method === 'POST') {
      requireHttpMethod(req, 'POST');
      const helpRequestId = String((body as Record<string, unknown>).helpRequestId ?? '').trim();
      if (!helpRequestId) return jsonError(req, 'helpRequestId is required');
      const request = await resolveBookingHelp({
        bookingId,
        helpRequestId,
        userId: user.id,
      });
      if (!request) return jsonError(req, 'Help request not found or already resolved', 404);
      return jsonSuccess(req, { request });
    }

    return jsonError(req, 'Method not allowed', 405);
  } catch (error) {
    if (error instanceof BookingHelpError) {
      return jsonError(req, error.message, error.status);
    }
    throw error;
  }
});
