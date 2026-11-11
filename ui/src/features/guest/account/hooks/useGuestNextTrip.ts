import { useMemo } from 'react';

import type { GuestTripListItemDto } from '@/features/guest/account/lib/guestAccountApi';
import { useGuestTrips } from '@/features/guest/account/hooks/useGuestTrips';
import { guestTripPath } from '@/features/guest/lib/guestPublicPaths';

import { getManilaYmdToday } from '@/utils/format/dates';

/**
 * The signed-in guest's next trip: the stay they are in, or the closest one still to come.
 *
 * Used by the bottom nav dot, the home "upcoming trip" card and the listing banner, so all
 * three point at the same booking. Reuses the cached `guest-trips` query — no extra request.
 */

export type GuestNextTrip = {
  bookingId: string;
  propertySlug: string | null;
  propertyName: string | null;
  imageUrl: string | null;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  /** Trip path, or `null` when the booking is a parking request. */
  path: string | null;
  /** True when the stay covers today. */
  isCurrent: boolean;
  /** Days until check-in (0 when the stay covers today). */
  daysUntil: number;
};

function daysBetween(fromYmd: string, toYmd: string): number {
  const from = Date.parse(`${fromYmd}T00:00:00Z`);
  const to = Date.parse(`${toYmd}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function toNextTrip(trip: GuestTripListItemDto, todayYmd: string): GuestNextTrip {
  const isCurrent = trip.checkInDate <= todayYmd && todayYmd < trip.checkOutDate;
  return {
    bookingId: trip.id,
    propertySlug: trip.propertySlug,
    propertyName: trip.propertyName,
    imageUrl: trip.imageUrl,
    checkInDate: trip.checkInDate,
    checkOutDate: trip.checkOutDate,
    status: trip.status,
    path:
      trip.kind === 'property' && trip.propertySlug
        ? guestTripPath(trip.propertySlug, trip.id)
        : null,
    isCurrent,
    daysUntil: Math.max(0, daysBetween(todayYmd, trip.checkInDate)),
  };
}

/**
 * Picks the next trip from a list of trips.
 *
 * A stay in progress wins over an upcoming one. Otherwise the closest upcoming stay wins.
 * Cancelled bookings are ignored. Parking requests are ignored — they keep their own status
 * page and are not a "trip".
 */
export function pickGuestNextTrip(
  trips: GuestTripListItemDto[],
  todayYmd: string = getManilaYmdToday()
): GuestNextTrip | null {
  const stays = trips.filter(
    (trip) => trip.kind === 'property' && trip.status !== 'CANCELLED' && trip.checkOutDate >= todayYmd
  );
  if (stays.length === 0) return null;

  const current = stays
    .filter((trip) => trip.checkInDate <= todayYmd)
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))[0];
  if (current) return toNextTrip(current, todayYmd);

  const upcoming = stays.sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))[0];
  return upcoming ? toNextTrip(upcoming, todayYmd) : null;
}

/** The next trip for the signed-in guest, or `null` when they have none. */
export function useGuestNextTrip(): GuestNextTrip | null {
  const { data } = useGuestTrips();
  const trips = useMemo(() => data ?? [], [data]);
  return useMemo(() => pickGuestNextTrip(trips), [trips]);
}

/**
 * The signed-in guest's trip at one property, if they have one.
 *
 * Used by the listing banner so a guest who already booked sees their trip instead of
 * only a Reserve button (plan 2.6, finding A5).
 */
export function useGuestTripAtProperty(propertySlug: string | null | undefined) {
  const { data } = useGuestTrips();
  const trips = useMemo(() => data ?? [], [data]);
  const slug = (propertySlug ?? '').trim();
  return useMemo(() => {
    if (!slug) return null;
    const match = trips.find(
      (trip) =>
        trip.kind === 'property' &&
        trip.propertySlug === slug &&
        trip.status !== 'CANCELLED' &&
        trip.checkOutDate >= getManilaYmdToday()
    );
    if (!match) return null;
    return {
      bookingId: match.id,
      propertySlug: match.propertySlug,
      checkInDate: match.checkInDate,
      checkOutDate: match.checkOutDate,
      path: match.propertySlug ? guestTripPath(match.propertySlug, match.id) : null,
    };
  }, [trips, slug]);
}
