/**
 * guest-trip-help — booking-linked "Get help now" for the signed-in guest (SAFE-01).
 *
 * POST { bookingId, kind, note? }
 * Kinds: cant_get_in | not_as_described | unsafe | other.
 * One open request per booking; the host is notified and the ops channel is paged.
 */

import {
  BookingHelpError,
  createBookingHelpRequest,
  isBookingHelpKind,
} from '../_shared/bookingHelp.ts';
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('guest-trip-help', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
  if (!bookingId) return jsonError(req, 'bookingId is required');
  if (!isBookingHelpKind(body.kind)) {
    return jsonError(req, "kind must be 'cant_get_in', 'not_as_described', 'unsafe' or 'other'");
  }

  const limited = await rateLimitGate(req, {
    scope: 'guest-trip-help',
    identity: user.id,
    limit: 5,
    windowSec: 60 * 60,
  });
  if (limited) return limited;

  try {
    const result = await createBookingHelpRequest({
      userId: user.id,
      userEmail: user.email,
      bookingId,
      kind: body.kind,
      note: typeof body.note === 'string' ? body.note : null,
    });
    return jsonResponse(
      req,
      {
        success: true,
        data: {
          request: result.request,
          alreadyOpen: result.alreadyOpen,
        },
      },
      result.alreadyOpen ? 200 : 201
    );
  } catch (error) {
    if (error instanceof BookingHelpError) {
      return jsonError(req, error.message, error.status);
    }
    throw error;
  }
});
