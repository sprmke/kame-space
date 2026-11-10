/**
 * The booking a guest's conversation with a property is about.
 *
 * A signed-in guest can have several stays at one property, so the link is resolved
 * deterministically. Used to set `social_conversations.booking_id` (plan D9) and to build
 * the trip path a chat thread offers the guest.
 *
 * Only property bookings count — parking marketplace rows keep their own flow.
 */

import { manilaTodayYmd, normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';
import { createServiceClient } from './orgAuth.ts';

export type GuestBookingLink = {
  bookingId: string;
  /** YYYY-MM-DD */
  checkInDate: string;
  /** YYYY-MM-DD */
  checkOutDate: string;
  status: string;
};

/** Online bookings a guest can still talk about. Cancelled stays are excluded. */
const LINKABLE_STATUS = /^(?!CANCELLED$)/;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toLink(row: Record<string, unknown>): GuestBookingLink | null {
  const bookingId = str(row.id);
  const status = str(row.status);
  if (!bookingId || !status || !LINKABLE_STATUS.test(status)) return null;
  const checkInDate =
    normalizeBookingDateToYmd(str(row.check_in_date)) ?? str(row.check_in_date);
  const checkOutDate =
    normalizeBookingDateToYmd(str(row.check_out_date)) ?? str(row.check_out_date);
  if (!checkInDate || !checkOutDate) return null;
  return { bookingId, checkInDate, checkOutDate, status };
}

/** The guest either owns the booking by user id, or matched it by email before signing in. */
export function guestOwnsBookingRow(
  row: Record<string, unknown>,
  user: { id: string; email: string }
): boolean {
  const ownerId = str(row.guest_user_id);
  if (ownerId) return ownerId === user.id;
  const ownerEmail = str(row.guest_email).toLowerCase();
  return ownerEmail !== '' && ownerEmail === str(user.email).toLowerCase();
}

/**
 * The signed-in guest's most relevant booking at a property.
 *
 * A stay in progress wins over an upcoming one; a stay that has already ended is not
 * returned. `nowYmd` is Manila today.
 */
export async function resolveGuestBookingForProperty(
  user: { id: string; email: string },
  propertyId: string,
  nowYmd: string = manilaTodayYmd()
): Promise<GuestBookingLink | null> {
  const id = str(propertyId);
  const email = str(user.email).toLowerCase();
  if (!id || !email) return null;

  const { data, error } = await createServiceClient()
    .from('guest_submissions')
    .select('id, status, check_in_date, check_out_date')
    .eq('property_id', id)
    .is('parking_id', null)
    .neq('status', 'CANCELLED')
    .or(`guest_user_id.eq.${user.id},and(guest_user_id.is.null,guest_email.eq.${email})`)
    .limit(50);

  if (error) {
    console.warn('[guestBookingLink] resolve failed:', error.message);
    return null;
  }

  const live = (data ?? [])
    .map((row) => toLink(row as Record<string, unknown>))
    .filter((row): row is GuestBookingLink => row !== null)
    .filter((row) => row.checkOutDate >= nowYmd)
    .sort((a, b) => {
      // A stay in progress comes first, then the closest upcoming one.
      const aCurrent = a.checkInDate <= nowYmd ? 0 : 1;
      const bCurrent = b.checkInDate <= nowYmd ? 0 : 1;
      if (aCurrent !== bCurrent) return aCurrent - bCurrent;
      return a.checkInDate.localeCompare(b.checkInDate);
    });

  return live[0] ?? null;
}

/**
 * The booking the guest is asking about, if they own it.
 *
 * Used when a guest opens chat from their trip with an explicit `bookingId`. Returns
 * `null` when the booking is not theirs, so the thread never links to someone else's stay.
 */
export async function loadGuestBookingById(
  user: { id: string; email: string },
  bookingId: string
): Promise<GuestBookingLink | null> {
  const id = str(bookingId);
  if (!id) return null;

  const { data, error } = await createServiceClient()
    .from('guest_submissions')
    .select('id, status, check_in_date, check_out_date, guest_user_id, guest_email')
    .eq('id', id)
    .is('parking_id', null)
    .maybeSingle();

  if (error) {
    console.warn('[guestBookingLink] load by id failed:', error.message);
    return null;
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  if (!guestOwnsBookingRow(row, user)) return null;
  return toLink(row);
}
