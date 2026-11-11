import { Eye, ExternalLink } from 'lucide-react';

import { GuestTripStatusPill } from '@/features/guest/trip/components/GuestTripStatusPill';
import { guestTripStatusTone } from '@/features/guest/trip/lib/guestTripPhase';

import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import { GuestAccessCodeField } from '@/features/dashboard/bookings/components/booking-detail/GuestAccessCodeField';
import { useBookingTripLink } from '@/features/dashboard/bookings/hooks/useBookingTripLink';
import { guestViewSnapshot } from '@/features/dashboard/bookings/lib/guestViewSnapshot';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { Button } from '@/components/ui/button';

/**
 * What the guest sees right now (guest journey plan 7.1).
 *
 * The host's view of a booking and the guest's trip page used to tell different stories.
 * This mirrors the guest's own words, read-only, so a host can answer "what is my guest
 * waiting on?" without opening the trip link.
 */
export function GuestViewCard({ booking }: { booking: BookingRow }) {
  const tripLink = useBookingTripLink(booking);
  if (booking.parking_id) return null;

  const snapshot = guestViewSnapshot(booking);

  return (
    <BookingDetailCard
      title="Guest view"
      action={
        tripLink.url ? (
          <Button type="button" variant="outline" size="sm" onClick={tripLink.open}>
            <ExternalLink className="size-4" aria-hidden />
            Open trip
          </Button>
        ) : null
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <GuestTripStatusPill
            label={snapshot.statusWord}
            tone={guestTripStatusTone(String(booking.status ?? ''))}
          />
          <span className="text-muted-foreground text-sm">{snapshot.nextAction}</span>
        </div>

        {snapshot.missing.length > 0 ? (
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Still open: {snapshot.missing.join(', ')}</span>
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">Nothing is outstanding for the guest.</p>
        )}

        <GuestAccessCodeField booking={booking} />
      </div>
    </BookingDetailCard>
  );
}
