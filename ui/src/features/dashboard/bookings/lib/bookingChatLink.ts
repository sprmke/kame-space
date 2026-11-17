import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import type { BookingChatMatch } from '@/features/dashboard/inbox/types/inbox';
import { parkingInboxPath, propertyInboxPath } from '@/features/dashboard/org/lib/tenantPaths';

/** Where a booking's chat lives: always the property or parking Inbox, never an org inbox. */
export type BookingChatDestination = {
  kind: 'property' | 'parking';
  /** property id or parking id, used as the inbox API scope and to check `inbox:view`. */
  id: string;
  inboxPath: string;
};

type RouteFallback = {
  propertyId?: string | null;
  propertySlug?: string | null;
  parkingId?: string | null;
  parkingSlug?: string | null;
};

/**
 * Resolve the Inbox a booking row belongs to. Route context wins on a property or parking
 * dashboard; org-wide lists fall back to the slugs the list API puts on each row. Parking
 * takes precedence, matching `resolveBookingListHref`.
 */
export function resolveBookingChatDestination(
  row: Pick<
    BookingRow,
    'booking_kind' | 'property_id' | 'property_slug' | 'parking_id' | 'parking_slug'
  >,
  orgSlug: string | null | undefined,
  fallback: RouteFallback = {}
): BookingChatDestination | null {
  if (!orgSlug) return null;

  const isParking = row.booking_kind === 'parking' || Boolean(row.parking_id);
  if (isParking) {
    const id = row.parking_id ?? fallback.parkingId ?? null;
    const slug = row.parking_slug ?? fallback.parkingSlug ?? null;
    if (!id || !slug) return null;
    return { kind: 'parking', id, inboxPath: parkingInboxPath(orgSlug, slug) };
  }

  const id = row.property_id ?? fallback.propertyId ?? null;
  const slug = fallback.propertySlug ?? row.property_slug ?? null;
  if (!id || !slug) return null;
  return { kind: 'property', id, inboxPath: propertyInboxPath(orgSlug, slug) };
}

/** Inbox reads `conversationId` + `platform`; it ignores platforms it has no tab for. */
export function buildInboxConversationHref(
  inboxPath: string,
  match: Pick<BookingChatMatch, 'id' | 'platform'>
): string {
  const params = new URLSearchParams({ conversationId: match.id });
  if (match.platform === 'web' || match.platform === 'facebook' || match.platform === 'instagram') {
    params.set('platform', match.platform);
  }
  return `${inboxPath}?${params.toString()}`;
}

/** Inbox opened with the guest name already typed into search. */
export function buildInboxSearchHref(inboxPath: string, guestName: string): string {
  const name = guestName.trim();
  return name ? `${inboxPath}?${new URLSearchParams({ search: name }).toString()}` : inboxPath;
}

export function bookingChatGuestName(
  row: Pick<BookingRow, 'primary_guest_name' | 'guest_facebook_name' | 'guest_email'>
): string {
  return (
    row.primary_guest_name?.trim() ||
    row.guest_facebook_name?.trim() ||
    row.guest_email?.trim() ||
    'Guest'
  );
}

export type BookingChatOutcome =
  | { kind: 'none' }
  | { kind: 'open'; match: BookingChatMatch }
  | { kind: 'choose'; matches: BookingChatMatch[] };

export function bookingChatOutcome(matches: readonly BookingChatMatch[]): BookingChatOutcome {
  if (matches.length === 0) return { kind: 'none' };
  if (matches.length === 1) return { kind: 'open', match: matches[0]! };
  return { kind: 'choose', matches: [...matches] };
}
