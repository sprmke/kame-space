import { Fragment, type ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { DevelopmentCard } from '@/features/guest/marketing/developments/components/DevelopmentCard';
import { ParkingSlotCard } from '@/features/guest/marketing/developments/components/ParkingSlotCard';
import type { Development } from '@/features/guest/marketing/developments/types';
import { ListingRail } from '@/features/guest/marketing/guest-home/components/ListingRail';
import type { ParkingListEntry } from '@/features/guest/marketing/parkings/lib/parkingListEntries';
import { PropertyCard } from '@/features/guest/marketing/properties/components/PropertyCard';
import type { PublicPropertyListItem } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';
import type { PublicPlaceGroup } from '@/features/guest/marketing/shared/hooks/usePublicPlaceGroups';

type Feed<T> = {
  items: T[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
};

type ExploreCatalogProps = {
  stays: Feed<PublicPropertyListItem>;
  residences: Feed<Development>;
  parking: Feed<ParkingListEntry>;
  cities: PublicPlaceGroup<unknown>[];
};

/** "See all 24 stays" when there is more than the row shows, otherwise "Browse stays". */
function seeAll<T>(feed: Feed<T>, noun: string) {
  return feed.total > feed.items.length ? `See all ${feed.total} ${noun}` : `Browse ${noun}`;
}

/** The live catalog: one swipeable row per listing type, each ending in its full list page. */
export function ExploreCatalog({ stays, residences, parking, cities }: ExploreCatalogProps) {
  return (
    <section aria-labelledby="home-explore" className="public-section-y overflow-x-clip">
      <div className="public-shell">
        <div className="max-w-xl">
          <h2
            id="home-explore"
            className="public-section-title text-foreground text-balance font-semibold"
          >
            Find your next stay, home, or parking
          </h2>
          <p className="public-lead text-muted-foreground mt-2">
            Every listing is booked straight with its host.
          </p>
        </div>

        <div className="mt-8 space-y-10 lg:mt-10 lg:space-y-14">
          <Shelf feed={stays} noun="stays">
            <ListingRail
              id="home-stays"
              title="Stays"
              hint="Condos and homes, by the night"
              to="/properties"
              seeAllLabel={seeAll(stays, 'stays')}
              mascot="properties"
              itemsKey={stays.items}
              footer={<CityLinks cities={cities} />}
            >
              {stays.items.map((stay, i) => (
                <PropertyCard key={stay.id} property={stay} index={i} variant="carousel" />
              ))}
            </ListingRail>
          </Shelf>

          <Shelf feed={residences} noun="residences">
            <ListingRail
              id="home-residences"
              title="Residences"
              hint="Pick a building, then choose a unit"
              to="/developments"
              seeAllLabel={seeAll(residences, 'residences')}
              mascot="developments"
              itemsKey={residences.items}
            >
              {residences.items.map((development, i) => (
                <DevelopmentCard
                  key={development.id}
                  development={development}
                  index={i}
                  variant="carousel"
                />
              ))}
            </ListingRail>
          </Shelf>

          <Shelf feed={parking} noun="parking">
            <ListingRail
              id="home-parking"
              title="Parking"
              hint="Slots near where you are staying"
              to="/parkings"
              seeAllLabel={seeAll(parking, 'parking')}
              mascot="parking-listings"
              itemsKey={parking.items}
            >
              {parking.items.map((entry, i) => (
                <ParkingSlotCard
                  key={entry.slot.id}
                  slot={entry.slot}
                  developmentSlug={entry.developmentSlug}
                  developmentName={entry.developmentName}
                  city={entry.city}
                  detailSlug={entry.detailSlug}
                  index={i}
                  variant="carousel"
                />
              ))}
            </ListingRail>
          </Shelf>
        </div>
      </div>
    </section>
  );
}

/** Loading and error states for one row. A type with no listings leaves no row at all. */
function Shelf<T>({ feed, noun, children }: { feed: Feed<T>; noun: string; children: ReactNode }) {
  if (feed.isLoading) {
    return (
      <div aria-busy="true">
        <div className="bg-muted h-6 w-28 animate-pulse rounded" />
        <div className="mt-5 grid grid-cols-[72vw] gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className={i === 0 ? undefined : i === 3 ? 'hidden lg:block' : 'hidden sm:block'}
            >
              <div className="bg-muted aspect-[4/3] animate-pulse rounded-xl sm:aspect-square" />
              <div className="bg-muted mt-3 h-4 w-2/3 animate-pulse rounded" />
              <div className="bg-muted mt-2 h-3 w-1/3 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (feed.isError && feed.items.length === 0) {
    return <ListingLoadError noun={noun} onRetry={feed.refetch} retrying={feed.isFetching} />;
  }
  if (feed.items.length === 0) return null;
  return <>{children}</>;
}

/** Cities as one plain line of links. Shown once there is more than one place to choose from. */
function CityLinks({ cities }: { cities: PublicPlaceGroup<unknown>[] }) {
  if (cities.length < 2) return null;
  return (
    <nav aria-label="Stays by city" className="text-muted-foreground mt-4 text-sm leading-7">
      <span>Stays in </span>
      {cities.map((c, i) => (
        <Fragment key={c.locationSlug}>
          {i > 0 ? <span aria-hidden>, </span> : null}
          <Link
            to={`/properties/in/${c.locationSlug}`}
            className="text-foreground decoration-foreground/30 hover:decoration-foreground focus-visible:ring-ring rounded font-medium underline decoration-1 underline-offset-4 outline-none transition-colors focus-visible:ring-2"
          >
            {c.place}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
