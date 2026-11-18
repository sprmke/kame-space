/**
 * Guest Inbox threads for one booking (bookings list chat shortcut).
 * GET ?booking_id=…&property_id=… | &parking_id=… — read-only, `inbox:view`.
 */

import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { findBookingChats, toBookingChatDto } from '../_shared/inboxBookingChats.ts';
import { resolveMetaConnectionIdsForScope } from '../_shared/metaInboxScope.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { isFeatureAvailable } from '../_shared/featureAvailability.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serveAuthenticated('social-inbox-booking-chats', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const bookingId = new URL(req.url).searchParams.get('booking_id')?.trim() ?? '';
  if (!UUID_RE.test(bookingId)) {
    return jsonError(req, 'booking_id must be a valid id', 400);
  }

  const ctx = await resolveInboxAccess(req, 'view');

  // The booking must live in the scope the caller proved access to. A booking from another
  // property answers 404 so its existence is not revealed.
  const sb = createServiceClient();
  const scopeColumn = ctx.propertyId ? 'property_id' : 'parking_id';
  const scopeId = ctx.propertyId ?? (ctx.parkingId as string);
  const { data: booking, error } = await sb
    .from('guest_submissions')
    .select('id, primary_guest_name, guest_facebook_name, guest_user_id')
    .eq('id', bookingId)
    .eq(scopeColumn, scopeId)
    .maybeSingle();
  if (error) return jsonError(req, error.message, 500);
  if (!booking) return jsonError(req, 'Booking not found', 404);

  // Meta threads only exist for property scope, and only while Meta is switched on.
  const includeMeta = ctx.kind === 'property' && (await isFeatureAvailable('inbox.meta'));
  const metaConnectionIds = includeMeta
    ? await resolveMetaConnectionIdsForScope(ctx.orgId, ctx.scope)
    : [];

  const rows = await findBookingChats({
    orgId: ctx.orgId,
    propertyId: ctx.propertyId,
    parkingId: ctx.parkingId,
    metaConnectionIds,
    booking: {
      id: booking.id as string,
      primary_guest_name: (booking.primary_guest_name as string | null) ?? null,
      guest_facebook_name: (booking.guest_facebook_name as string | null) ?? null,
      guest_user_id: (booking.guest_user_id as string | null) ?? null,
    },
  });

  return jsonSuccess(req, { conversations: rows.map(toBookingChatDto) });
});
