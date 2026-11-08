import { useMemo } from 'react';

import { usePublicDevelopments } from '@/features/guest/marketing/developments/hooks/usePublicDevelopments';
import {
  DEFAULT_DEVELOPMENTS_QUERY,
  toDevelopmentCard,
} from '@/features/guest/marketing/developments/lib/developmentsQuery';
import { BookingSteps } from '@/features/guest/marketing/guest-landing-v3/components/BookingSteps';
import { ExploreCatalog } from '@/features/guest/marketing/guest-landing-v3/components/ExploreCatalog';
import { HostBand } from '@/features/guest/marketing/guest-landing-v3/components/HostBand';
import { SpotlightHero } from '@/features/guest/marketing/guest-landing-v3/components/SpotlightHero';
import { WhyBookHere } from '@/features/guest/marketing/guest-landing-v3/components/WhyBookHere';
import { usePublicParkings } from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import {
  DEFAULT_PARKINGS_QUERY,
  toParkingListEntry,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import { usePublicProperties } from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import { DEFAULT_PROPERTIES_QUERY } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { usePublicPlaceGroups } from '@/features/guest/marketing/shared/hooks/usePublicPlaceGroups';

const PREVIEW_SIZE = 8;
const STAYS_QUERY = { ...DEFAULT_PROPERTIES_QUERY, pageSize: PREVIEW_SIZE };
const PARKINGS_QUERY = { ...DEFAULT_PARKINGS_QUERY, pageSize: PREVIEW_SIZE };
const DEVELOPMENTS_QUERY = { ...DEFAULT_DEVELOPMENTS_QUERY, pageSize: PREVIEW_SIZE };

/**
 * `/v3` guest landing preview. Job: get a visitor into the catalog.
 * Real stay in the hero with the shared search, then the live catalog by type.
 */
export function GuestLandingV3Page() {
  const stays = usePublicProperties(STAYS_QUERY, true, { staleTime: 60_000 });
  const parkings = usePublicParkings(PARKINGS_QUERY);
  const developments = usePublicDevelopments(DEVELOPMENTS_QUERY);
  const places = usePublicPlaceGroups<unknown>('properties', true, 12, 1);

  const stayItems = useMemo(() => stays.data?.data ?? [], [stays.data]);
  const residenceItems = useMemo(
    () => (developments.data?.data ?? []).map(toDevelopmentCard),
    [developments.data]
  );
  const parkingItems = useMemo(
    () => (parkings.data?.data ?? []).map(toParkingListEntry),
    [parkings.data]
  );

  return (
    <div className="bg-background text-foreground">
      <SpotlightHero stays={stayItems} isLoading={stays.isLoading} />
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
