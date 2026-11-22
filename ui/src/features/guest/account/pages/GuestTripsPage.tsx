import { useEffect } from 'react';

import { Link } from 'react-router-dom';

import { Building2, Car, ChevronRight, Luggage, RefreshCw } from 'lucide-react';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GuestAccountEmptyState } from '@/features/guest/account/components/GuestAccountEmptyState';
import { useGuestTrips } from '@/features/guest/account/hooks/useGuestTrips';
import type { GuestTripListItemDto } from '@/features/guest/account/lib/guestAccountApi';
import {
  guestAccountListLayoutFromCount,
  guestAccountListLayoutStorageKey,
  readGuestAccountListLayoutHint,
  resolveGuestAccountListLoadState,
  writeGuestAccountListLayoutHint,
} from '@/features/guest/account/lib/guestAccountListLayout';
import { guestTripPath } from '@/features/guest/lib/guestPublicPaths';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';
import { GuestTripStatusPill } from '@/features/guest/trip/components/GuestTripStatusPill';
import {
  guestTripListGroup,
  guestTripStatusLabel,
  guestTripStatusTone,
} from '@/features/guest/trip/lib/guestTripPhase';

import { InstallInlineCard } from '@/components/pwa/InstallInlineCard';
import {
  GuestAccountEmptyStateSkeleton,
  GuestTripsPageSkeleton,
} from '@/components/skeletons/GuestAccountSkeletons';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';
import { formatStayDateRange, getManilaYmdToday } from '@/utils/format/dates';

const LAYOUT_KEY = guestAccountListLayoutStorageKey('trips');

const GROUPS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

function TripRow({ trip }: { trip: GuestTripListItemDto }) {
  const cancelled = trip.status === 'CANCELLED';
  const isParking = trip.kind === 'parking';
  const href = isParking
    ? `/parkings/requests/${trip.id}`
    : guestTripPath(trip.propertySlug ?? '', trip.id);
  const title = isParking ? (trip.parkingName ?? 'Parking request') : (trip.propertyName ?? 'Stay');
  return (
    <li>
      <Link
        to={href}
        className="hover:bg-muted/60 focus-visible:ring-ring flex min-h-[72px] items-center gap-3 rounded-xl p-2 transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-lg sm:size-16">
          {trip.imageUrl ? (
            <Image
              src={trip.imageUrl}
              alt=""
              fill
              sizes="64px"
              className={cn('object-cover', cancelled && 'grayscale')}
            />
          ) : isParking ? (
            <Car className="text-muted-foreground absolute inset-0 m-auto size-5" aria-hidden />
          ) : (
            <Luggage className="text-muted-foreground absolute inset-0 m-auto size-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-muted-foreground truncate text-xs">
            {formatStayDateRange(trip.checkInDate, trip.checkOutDate) ?? ''}
          </p>
          <GuestTripStatusPill
            className="mt-1.5"
            label={guestTripStatusLabel(trip.status)}
            tone={guestTripStatusTone(trip.status)}
          />
        </div>
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </Link>
    </li>
  );
}

export function GuestTripsPage() {
  usePageTitle(publicPageTitle('Trips'));
  const { data, isLoading, isError, refetch } = useGuestTrips();
  const trips = data ?? [];
  const today = getManilaYmdToday();
  const loadState = resolveGuestAccountListLoadState({
    isPending: isLoading,
    itemCount: data !== undefined ? data.length : undefined,
    hint: readGuestAccountListLayoutHint(LAYOUT_KEY),
    coldDefault: 'empty',
  });

  useEffect(() => {
    if (loadState !== 'ready') return;
    writeGuestAccountListLayoutHint(LAYOUT_KEY, guestAccountListLayoutFromCount(trips.length));
  }, [loadState, trips.length]);

  if (loadState === 'empty') {
    return <GuestAccountEmptyStateSkeleton mascotPose="arrival" ariaLabel="Loading trips" />;
  }

  if (loadState === 'list') {
    return (
      <GuestAccountContentCard>
        <GuestTripsPageSkeleton rows={3} />
      </GuestAccountContentCard>
    );
  }

  if (isError) {
    return (
      <GuestAccountEmptyState
        mascotPose="gentle-failure"
        title="Couldn't load trips"
        description="Check your connection and try again."
        actionLabel="Try again"
        actionIcon={RefreshCw}
        onAction={() => void refetch()}
      />
    );
  }

  const linkable = trips.filter((trip) => Boolean(trip.propertySlug) || trip.kind === 'parking');

  if (linkable.length === 0) {
    return (
      <GuestAccountEmptyState
        mascotPose="arrival"
        title="No trips yet"
        description="Book a stay and your upcoming trips will show up here."
        actionLabel="Browse properties"
        actionIcon={Building2}
        actionHref="/properties"
      />
    );
  }

  const grouped = GROUPS.map((group) => ({
    ...group,
    trips: linkable.filter(
      (trip) =>
        guestTripListGroup({
          status: trip.status,
          checkOutYmd: trip.checkOutDate,
          todayYmd: today,
        }) === group.key
    ),
  })).filter((group) => group.trips.length > 0);

  // Upcoming reads best soonest-first; the API returns newest check-in first.
  const upcoming = grouped.find((group) => group.key === 'upcoming');
  if (upcoming) upcoming.trips = [...upcoming.trips].reverse();

  return (
    <>
      <InstallInlineCard />
      <GuestAccountContentCard bodyClassName="p-2 sm:p-4">
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.key} aria-labelledby={`trips-${group.key}`} className="space-y-1">
              <h2
                id={`trips-${group.key}`}
                className="text-muted-foreground px-2 pt-2 text-xs font-semibold uppercase tracking-wider"
              >
                {group.label}
              </h2>
              <ul className="space-y-0.5">
                {group.trips.map((trip) => (
                  <TripRow key={trip.id} trip={trip} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </GuestAccountContentCard>
    </>
  );
}
