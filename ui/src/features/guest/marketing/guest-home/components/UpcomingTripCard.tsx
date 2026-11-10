import { useState } from 'react';

import { Link } from 'react-router-dom';

import { Luggage, X } from 'lucide-react';

import { guestJourneyStatusWord } from '@/features/guest/trip/lib/guestJourneyCopy';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Button } from '@/components/ui/button';
import { formatStayDateRange } from '@/utils/format/dates';

const DISMISS_PREFIX = 'guest-upcoming-trip-dismissed:';

function readDismissed(bookingId: string): boolean {
  try {
    return sessionStorage.getItem(`${DISMISS_PREFIX}${bookingId}`) === '1';
  } catch {
    return false;
  }
}

function rememberDismissed(bookingId: string): void {
  try {
    sessionStorage.setItem(`${DISMISS_PREFIX}${bookingId}`, '1');
  } catch {
    // ignore quota / private mode
  }
}

/**
 * "Your trip" card on the home page for a signed-in guest (guest journey plan 2.7).
 *
 * The most useful thing a returning guest can see is the stay they already have. Dismissed
 * per booking for the session, so it does not get in the way of browsing for the next one.
 */
export function UpcomingTripCard({
  trip,
}: {
  trip: {
    bookingId: string;
    propertyName: string | null;
    imageUrl: string | null;
    checkInDate: string;
    checkOutDate: string;
    status: string;
    path: string | null;
  } | null;
}) {
  const [dismissed, setDismissed] = useState(() =>
    trip ? readDismissed(trip.bookingId) : false
  );

  if (!trip?.path || dismissed) return null;

  const dates = formatStayDateRange(trip.checkInDate, trip.checkOutDate);
  const statusWord = guestJourneyStatusWord(trip.status);

  return (
    <section
      aria-labelledby="upcoming-trip-title"
      className="container mx-auto px-4 pb-2 pt-6 sm:px-6"
    >
      <div className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3 shadow-sm">
        <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-xl">
          {trip.imageUrl ? (
            <MarketingImage src={trip.imageUrl} alt="" fill sizes="56px" className="object-cover" />
          ) : (
            <Luggage className="text-muted-foreground absolute inset-0 m-auto size-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p id="upcoming-trip-title" className="text-card-title truncate">
            {trip.propertyName ?? 'Your trip'}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {dates ? `${dates} · ` : ''}
            {statusWord}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to={trip.path}>View trip</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label="Dismiss trip card"
          onClick={() => {
            rememberDismissed(trip.bookingId);
            setDismissed(true);
          }}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
