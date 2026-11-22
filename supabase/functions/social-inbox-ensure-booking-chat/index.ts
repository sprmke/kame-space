/**
 * social-inbox-ensure-booking-chat — Open or create the web (Chat) thread for a booking.
 *
 * Hosts use this from the bookings list chat shortcut when no conversation exists yet.
 * Always creates platform=web — never Facebook or Instagram.
 *
 * POST { booking_id } + property_id|parking_id scope. Requires inbox:reply.
 */

import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import {
  ensureHostWebChatForBooking,
  type HostWebChatBooking,
} from '../_shared/hostWebChatFromBooking.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serveAuthenticated('social-inbox-ensure-booking-chat', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = typeof body.booking_id === 'string' ? body.booking_id.trim() : '';
  if (!UUID_RE.test(bookingId)) {
    return jsonError(req, 'booking_id must be a valid id', 400);
  }

  const ctx = await resolveInboxAccess(req, 'reply', body);

  const sb = createServiceClient();
  const scopeColumn = ctx.propertyId ? 'property_id' : 'parking_id';
  const scopeId = ctx.propertyId ?? (ctx.parkingId as string);
  const { data: booking, error } = await sb
    .from('guest_submissions')
    .select(
      'id, property_id, parking_id, guest_user_id, guest_email, primary_guest_name, check_in_date, check_out_date'
    )
    .eq('id', bookingId)
    .eq(scopeColumn, scopeId)
    .maybeSingle();
  if (error) return jsonError(req, error.message, 500);
  if (!booking) return jsonError(req, 'Booking not found', 404);

  try {
    const result = await ensureHostWebChatForBooking({
      orgId: ctx.orgId,
      propertyId: ctx.propertyId,
      parkingId: ctx.parkingId,
      booking: booking as HostWebChatBooking,
    });

    return jsonSuccess(req, {
      conversation: {
        id: result.conversation.id,
        platform: 'web',
        participant_name: result.conversation.participant_name,
        booking_id: result.conversation.booking_id,
        match: 'booking' as const,
      },
      created: result.created,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not open chat';
    if (message === 'Booking not found') return jsonError(req, message, 404);
    return jsonError(req, message, 500);
  }
});
