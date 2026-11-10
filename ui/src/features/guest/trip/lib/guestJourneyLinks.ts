import {
  guestBookingDocumentPath,
  guestMessagesPath,
  guestPropertyPath,
  guestReviewPath,
  guestSdFormPath,
  guestStayGuidePath,
  guestTripPath,
} from '@/features/guest/lib/guestPublicPaths';

import type { GuestTrip } from '@/features/guest/trip/lib/guestTripApi';

/**
 * Every place a guest can go for one booking, resolved from the trip payload.
 *
 * One resolver so no surface invents its own link: the trip page, the chat header, the
 * booking-scoped shell tabs and the guest banner all ask the same question and get the same
 * answer.
 */
export type GuestJourneyLinks = {
  /** The trip page itself — the canonical home for this booking. */
  trip: string;
  /** Property chat. Carries the stay dates so a booked guest never re-picks them. */
  chat: string;
  /** Stay guide, when the booking has one and the guest may open it. */
  stayGuide: string | null;
  /** Guest-facing document pages (GAF, pet approval). */
  documents: Array<{ id: string; label: string; href: string }>;
  /** Marketplace parking entry bound to this stay. */
  parking: string | null;
  /** Security deposit refund form. */
  refund: string;
  /** Post-stay review page. */
  review: string;
  /** The property listing. */
  listing: string;
  /** Edit the booking request. */
  edit: string;
};

export function guestJourneyLinks(trip: GuestTrip): GuestJourneyLinks {
  const slug = trip.property.slug;
  return {
    trip: guestTripPath(slug, trip.bookingId),
    chat: guestMessagesPath(
      slug,
      new URLSearchParams({
        checkInDate: trip.stay.checkInDate,
        checkOutDate: trip.stay.checkOutDate,
      })
    ),
    stayGuide: trip.stayGuidePath,
    documents: trip.documents
      .filter((doc) => doc.status === 'ready' && doc.href)
      .map((doc) => ({ id: doc.id, label: doc.label, href: doc.href as string })),
    parking: trip.parking.findPath,
    refund: guestSdFormPath(slug, trip.bookingId),
    review: guestReviewPath(slug, trip.bookingId),
    listing: guestPropertyPath(slug),
    edit: `${guestPropertyPath(slug)}/form?bookingId=${encodeURIComponent(trip.bookingId)}`,
  };
}

/** Property chat path for a guest who has a booking there: the booking wins over inquiry dates. */
export function guestJourneyChatPath(trip: GuestTrip, bookingId?: string | null): string {
  const slug = trip.property.slug;
  const id = (bookingId ?? trip.bookingId).trim();
  if (!id) {
    return guestMessagesPath(
      slug,
      new URLSearchParams({
        checkInDate: trip.stay.checkInDate,
        checkOutDate: trip.stay.checkOutDate,
      })
    );
  }
  return guestMessagesPath(slug, new URLSearchParams({ bookingId: id }));
}

export { guestBookingDocumentPath, guestStayGuidePath };
