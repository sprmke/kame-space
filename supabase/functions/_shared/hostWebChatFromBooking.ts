/**
 * Host opens (or creates) a web chat thread for a booking from the bookings list shortcut.
 * Platform is always `web` — never Facebook or Instagram.
 */

import { normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';
import { createServiceClient } from './orgAuth.ts';
import { upsertChannelConnection } from './socialInboxDb.ts';
import { upsertConversation } from './socialInboxService.ts';
import type { SocialConversationRow } from './socialInboxTypes.ts';
import {
  buildBookingWebThreadId,
  buildParkingWebThreadId,
  buildWebThreadId,
} from './webGuestChatIds.ts';

async function ensureWebChannelConnection(orgId: string) {
  return upsertChannelConnection({
    organization_id: orgId,
    platform: 'web',
    external_account_id: orgId,
    display_name: 'Website chat',
    status: 'connected',
  });
}

export type HostWebChatBooking = {
  id: string;
  property_id: string | null;
  parking_id: string | null;
  guest_user_id: string | null;
  guest_email: string | null;
  primary_guest_name: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
};

export type EnsureHostWebChatResult = {
  conversation: SocialConversationRow;
  created: boolean;
};

function participantLabel(booking: HostWebChatBooking): string {
  const name = booking.primary_guest_name?.trim();
  if (name) return name;
  const email = booking.guest_email?.trim();
  if (email) return email.split('@')[0] || email;
  return 'Guest';
}

function inquiryDates(booking: HostWebChatBooking): {
  checkIn: string | null;
  checkOut: string | null;
} {
  const checkInRaw = booking.check_in_date?.trim() || '';
  const checkOutRaw = booking.check_out_date?.trim() || '';
  return {
    checkIn: normalizeBookingDateToYmd(checkInRaw) || null,
    checkOut: normalizeBookingDateToYmd(checkOutRaw) || null,
  };
}

async function findWebByBookingId(
  orgId: string,
  bookingId: string,
  scope: { propertyId: string | null; parkingId: string | null }
): Promise<SocialConversationRow | null> {
  const sb = createServiceClient();
  let q = sb
    .from('social_conversations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('platform', 'web')
    .eq('booking_id', bookingId)
    .eq('conversation_type', 'dm');
  if (scope.propertyId) q = q.eq('property_id', scope.propertyId);
  if (scope.parkingId) q = q.eq('parking_id', scope.parkingId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SocialConversationRow | null) ?? null;
}

async function findWebByGuestUser(
  orgId: string,
  guestUserId: string,
  scope: { propertyId: string | null; parkingId: string | null }
): Promise<SocialConversationRow | null> {
  const sb = createServiceClient();
  let q = sb
    .from('social_conversations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('platform', 'web')
    .eq('guest_user_id', guestUserId)
    .eq('conversation_type', 'dm');
  if (scope.propertyId) q = q.eq('property_id', scope.propertyId);
  if (scope.parkingId) q = q.eq('parking_id', scope.parkingId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SocialConversationRow | null) ?? null;
}

/**
 * Open the booking's web thread, or create one so the host can message first.
 * Prefer an existing booking-linked or guest-identity thread; otherwise create Chat (web).
 */
export async function ensureHostWebChatForBooking(input: {
  orgId: string;
  propertyId: string | null;
  parkingId: string | null;
  booking: HostWebChatBooking;
}): Promise<EnsureHostWebChatResult> {
  const { orgId, propertyId, parkingId, booking } = input;
  if ((propertyId && parkingId) || (!propertyId && !parkingId)) {
    throw new Error('Exactly one of propertyId or parkingId is required');
  }
  if (propertyId && booking.property_id && booking.property_id !== propertyId) {
    throw new Error('Booking not found');
  }
  if (parkingId && booking.parking_id && booking.parking_id !== parkingId) {
    throw new Error('Booking not found');
  }

  const scope = { propertyId, parkingId };
  const existingByBooking = await findWebByBookingId(orgId, booking.id, scope);
  if (existingByBooking) {
    return { conversation: existingByBooking, created: false };
  }

  const guestUserId = booking.guest_user_id?.trim() || null;
  if (guestUserId) {
    const existingByGuest = await findWebByGuestUser(orgId, guestUserId, scope);
    if (existingByGuest) {
      if (!existingByGuest.booking_id) {
        const sb = createServiceClient();
        const { data, error } = await sb
          .from('social_conversations')
          .update({ booking_id: booking.id, updated_at: new Date().toISOString() })
          .eq('id', existingByGuest.id)
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        return { conversation: data as SocialConversationRow, created: false };
      }
      return { conversation: existingByGuest, created: false };
    }
  }

  const connection = await ensureWebChannelConnection(orgId);
  const dates = inquiryDates(booking);
  const name = participantLabel(booking);
  const now = new Date().toISOString();

  const threadId = guestUserId
    ? propertyId
      ? buildWebThreadId(propertyId, guestUserId)
      : buildParkingWebThreadId(parkingId!, guestUserId)
    : buildBookingWebThreadId(booking.id);

  const conversation = await upsertConversation({
    organization_id: orgId,
    connection_id: connection.id,
    platform: 'web',
    conversation_type: 'dm',
    external_thread_id: threadId,
    external_participant_id: guestUserId ?? `booking:${booking.id}`,
    participant_name: name,
    property_id: propertyId,
    parking_id: parkingId,
    guest_user_id: guestUserId,
    booking_id: booking.id,
    inquiry_check_in: dates.checkIn,
    inquiry_check_out: dates.checkOut,
    last_message_at: now,
    reply_status: 'none',
  });

  return { conversation, created: true };
}

/**
 * When a signed-in guest opens chat for a booking the host already started,
 * attach their account to that web thread so resume and email notify keep working.
 */
export async function claimHostOpenedWebChatForBooking(input: {
  orgId: string;
  propertyId: string | null;
  parkingId: string | null;
  bookingId: string;
  guestUserId: string;
  participantName: string;
  participantAvatarUrl: string | null;
  checkIn: string;
  checkOut: string;
}): Promise<SocialConversationRow | null> {
  const scope = { propertyId: input.propertyId, parkingId: input.parkingId };
  const existing = await findWebByBookingId(input.orgId, input.bookingId, scope);
  if (!existing) return null;

  const ownedByOther =
    existing.guest_user_id && existing.guest_user_id !== input.guestUserId;
  if (ownedByOther) return null;

  if (existing.guest_user_id === input.guestUserId) {
    return existing;
  }

  const sb = createServiceClient();
  const nextThreadId = input.propertyId
    ? buildWebThreadId(input.propertyId, input.guestUserId)
    : buildParkingWebThreadId(input.parkingId!, input.guestUserId);

  // Prefer the normal guest thread id once claimed, so resume by user still finds it.
  const { data, error } = await sb
    .from('social_conversations')
    .update({
      guest_user_id: input.guestUserId,
      external_participant_id: input.guestUserId,
      external_thread_id: nextThreadId,
      participant_name: input.participantName,
      participant_avatar_url: input.participantAvatarUrl,
      inquiry_check_in: input.checkIn,
      inquiry_check_out: input.checkOut,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) {
    // Unique conflict: guest already has a property/parking web thread — link booking on that one.
    if (error.code === '23505') {
      const byGuest = await findWebByGuestUser(input.orgId, input.guestUserId, scope);
      if (!byGuest) throw new Error(error.message);
      const { data: linked, error: linkError } = await sb
        .from('social_conversations')
        .update({
          booking_id: input.bookingId,
          inquiry_check_in: input.checkIn,
          inquiry_check_out: input.checkOut,
          updated_at: new Date().toISOString(),
        })
        .eq('id', byGuest.id)
        .select('*')
        .single();
      if (linkError) throw new Error(linkError.message);
      return linked as SocialConversationRow;
    }
    throw new Error(error.message);
  }

  return data as SocialConversationRow;
}
