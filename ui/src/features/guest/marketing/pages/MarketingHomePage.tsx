import { useMemo } from 'react';

import { Navigate, useSearchParams } from 'react-router-dom';

import { useGuestNextTrip } from '@/features/guest/account/hooks/useGuestNextTrip';
import { stripLegacyFromQueryParam } from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import { readGuestPropertySlug } from '@/features/guest/form/lib/guestPropertyScope';
import { guestCalendarPath } from '@/features/guest/lib/guestPublicPaths';
import { usePublicDevelopments } from '@/features/guest/marketing/developments/hooks/usePublicDevelopments';
import {
  DEFAULT_DEVELOPMENTS_QUERY,
  toDevelopmentCard,
} from '@/features/guest/marketing/developments/lib/developmentsQuery';
import { BookingSteps } from '@/features/guest/marketing/guest-home/components/BookingSteps';
import { ExploreCatalog } from '@/features/guest/marketing/guest-home/components/ExploreCatalog';
import { HostBand } from '@/features/guest/marketing/guest-home/components/HostBand';
import { SpotlightHero } from '@/features/guest/marketing/guest-home/components/SpotlightHero';
import { UpcomingTripCard } from '@/features/guest/marketing/guest-home/components/UpcomingTripCard';
import { WhyBookHere } from '@/features/guest/marketing/guest-home/components/WhyBookHere';
import { usePublicParkings } from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import {
  DEFAULT_PARKINGS_QUERY,
  toParkingListEntry,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import { usePublicProperties } from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import { DEFAULT_PROPERTIES_QUERY } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { usePublicPlaceGroups } from '@/features/guest/marketing/shared/hooks/usePublicPlaceGroups';

import { useRouteContentReady } from '@/hooks/useRouteContentReady';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

const PREVIEW_SIZE = 8;
const STAYS_QUERY = { ...DEFAULT_PROPERTIES_QUERY, pageSize: PREVIEW_SIZE };
const PARKINGS_QUERY = { ...DEFAULT_PARKINGS_QUERY, pageSize: PREVIEW_SIZE };
const DEVELOPMENTS_QUERY = { ...DEFAULT_DEVELOPMENTS_QUERY, pageSize: PREVIEW_SIZE };

/**
 * Marketing home. Job: get a visitor into the catalog.
 * Theme-aware hero with the shared search, then the live catalog by type.
 */
export function MarketingHomePage() {
  const stays = usePublicProperties(STAYS_QUERY, true, { staleTime: 60_000 });
  const parkings = usePublicParkings(PARKINGS_QUERY);
  const developments = usePublicDevelopments(DEVELOPMENTS_QUERY);
  const places = usePublicPlaceGroups<unknown>('properties', true, 12, 1);

  usePageTitle(publicPageTitle('Home'));
  usePageMeta({ canonicalPath: '/' });

  const [searchParams] = useSearchParams();
  const property = readGuestPropertySlug(searchParams);
  // The hero is static markup, so its content exists at first commit. The catalog
  // below loads independently and is deliberately not part of this mark.
  useRouteContentReady(!property);

  // A returning guest with a stay within 30 days sees it above the catalogue (plan 2.7).
  const nextTripRaw = useGuestNextTrip();
  const nextTrip = useMemo(() => {
    if (!nextTripRaw || !nextTripRaw.path) return null;
    if (!nextTripRaw.isCurrent && nextTripRaw.daysUntil > 30) return null;
    return {
      bookingId: nextTripRaw.bookingId,
      propertyName: nextTripRaw.propertyName,
      imageUrl: nextTripRaw.imageUrl,
      checkInDate: nextTripRaw.checkInDate,
      checkOutDate: nextTripRaw.checkOutDate,
      status: nextTripRaw.status,
      path: nextTripRaw.path,
    };
  }, [nextTripRaw]);

  const stayItems = useMemo(() => stays.data?.data ?? [], [stays.data]);
  const residenceItems = useMemo(
    () => (developments.data?.data ?? []).map(toDevelopmentCard),
    [developments.data]
  );
  const parkingItems = useMemo(
    () => (parkings.data?.data ?? []).map(toParkingListEntry),
    [parkings.data]
  );

  // Legacy property-scoped links (`/?property=slug`) go straight to that property's calendar.
  if (property) {
    const next = stripLegacyFromQueryParam(new URLSearchParams(searchParams));
    next.delete('property');
    next.delete('property_slug');
    return <Navigate to={guestCalendarPath(property, next)} replace />;
  }

  return (
    <div className="bg-background text-foreground">
      <SpotlightHero />
      <UpcomingTripCard trip={nextTrip} />
      <ExploreCatalog
        stays={{
          items: stayItems,
          total: stays.data?.total ?? 0,
          isLoading: stays.isLoading,
          isError: stays.isError,
          isFetching: stays.isFetching,
          refetch: () => void stays.refetch(),
        }}
        residences={{
          items: residenceItems,
          total: developments.data?.total ?? 0,
          isLoading: developments.isLoading,
          isError: developments.isError,
          isFetching: developments.isFetching,
          refetch: () => void developments.refetch(),
        }}
        parking={{
          items: parkingItems,
          total: parkings.data?.total ?? 0,
          isLoading: parkings.isLoading,
          isError: parkings.isError,
          isFetching: parkings.isFetching,
          refetch: () => void parkings.refetch(),
        }}
        cities={places.data?.pages[0]?.groups ?? []}
      />
      <BookingSteps stay={stayItems[0]} />
      <WhyBookHere />
      <HostBand />
    </div>
  );
}
