/**
 * guest-trip-payment-receipt — the guest sends their balance payment receipt from the
 * trip page (plan 3.3 / D12).
 *
 * POST multipart/form-data: bookingId, file, optional access token
 * Auth: the booking's access token, or the signed-in guest who owns it — the same rule as
 * `get-guest-trip`. Never by booking id alone.
 *
 * Writes the same `guest_balance_payment_receipt_url` column the host dashboard reads, so
 * there is one receipt per booking and the host sees it where they already look. Never
 * changes the booking status: a receipt is evidence, not an approval.
 */

import {
  applyBookingAssetFromBytes,
  isBookingAssetType,
} from '../_shared/bookingAssetUpload.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { jsonError, jsonResponse, jsonSuccess } from '../_shared/httpResponse.ts';
import { createNotification } from '../_shared/notificationService.ts';
import { tryGetAuthenticatedUser } from '../_shared/orgAuth.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { authorizeGuestTripAccess } from '../_shared/guestTripAccess.ts';

const NOT_FOUND = {
  success: false,
  error: 'not_found',
  message: "We couldn't find this booking. Check the link or contact your host.",
};

/** Only the balance receipt may be written from the guest trip page. */
const ALLOWED_ASSET_TYPE = 'guest_balance_payment_receipt';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

servePublic('guest-trip-payment-receipt', async (req) => {
  if (req.method !== 'POST') return jsonError(req, 'Method not allowed', 405);

  const user = await tryGetAuthenticatedUser(req);

  const formData = await req.formData();
  const bookingId = String(formData.get('bookingId') ?? '').trim();
  const accessToken = String(formData.get('access') ?? '').trim() || null;
  const file = formData.get('file');
  const assetType = String(formData.get('assetType') ?? ALLOWED_ASSET_TYPE).trim();

  if (!UUID_RE.test(bookingId)) return jsonResponse(req, NOT_FOUND, 404);

  // Bot heuristics then a durable per-IP limit: an upload is expensive to accept.
  const blocked = await antiSpamGate(req, { bookingId }, {
    scope: 'guest-trip-payment-receipt',
    rateLimit: { limit: 10, windowSec: 600 },
  });
  if (blocked) return blocked;
  if (assetType !== ALLOWED_ASSET_TYPE) {
    return jsonError(req, 'Only a balance payment receipt can be uploaded here', 400);
  }
  if (!(file instanceof File) || file.size === 0) {
    return jsonError(req, 'Attach a photo or PDF of your receipt', 400);
  }

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking || !booking.property_id || booking.parking_id) {
    return jsonResponse(req, NOT_FOUND, 404);
  }

  const access = await authorizeGuestTripAccess({ booking, accessToken, user });
  if (!access.ok) {
    if (access.reason === 'sign_in_required') {
      return jsonError(req, 'Sign in with the email you booked with to send a receipt', 401);
    }
    // Signed in as someone else: same body as a missing booking (no existence leak).
    return jsonResponse(req, NOT_FOUND, 404);
  }

  const propertyId = String(booking.property_id);
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const result = await applyBookingAssetFromBytes({
      bookingId,
      propertyId,
      assetType: 'guest_balance_payment_receipt',
      fileName: file.name || 'receipt',
      mimeType: file.type || 'application/octet-stream',
      bytes,
      // `actorUserId` only attributes AI credit usage to a staff user. A guest upload has
      // none, so pass their own id when signed in and an empty value otherwise.
      actorUserId: user?.id ?? '',
      logPrefix: '[guest-trip-payment-receipt]',
    });

    // In-app notice for the host. Non-fatal: the receipt is already saved.
    await createNotification({
      organizationId: String(booking.organization_id ?? ''),
      propertyId,
      type: 'booking_receipt_uploaded',
      title: 'Balance receipt received',
      body: 'A guest sent their balance payment receipt from the trip page.',
      bookingId,
      dedupeKey: `booking_receipt_uploaded:${bookingId}:${Date.now()}`,
      metadata: { source: 'guest_trip', ai_verdict: result.receiptValidation?.verdict ?? null },
    });

    return jsonSuccess(req, {
      url: result.url,
      aiVerdict: result.receiptValidation?.verdict ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('[guest-trip-payment-receipt] upload failed:', message);
    return jsonError(req, message, 400);
  }
});
