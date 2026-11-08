import { useState, type ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { ArrowRight } from 'lucide-react';

import { DevelopmentsGrid } from '@/features/guest/marketing/developments/components/DevelopmentsGrid';
import type { Development } from '@/features/guest/marketing/developments/types';
import { ParkingsEntriesGrid } from '@/features/guest/marketing/parkings/components/ParkingsEntriesGrid';
import type { ParkingListEntry } from '@/features/guest/marketing/parkings/lib/parkingListEntries';
import { PropertyCard } from '@/features/guest/marketing/properties/components/PropertyCard';
import type { PublicPropertyListItem } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';
import type { PublicPlaceGroup } from '@/features/guest/marketing/shared/hooks/usePublicPlaceGroups';

import { Button } from '@/components/ui/button';
import {
  SlidingTabs,
  SlidingTabsContent,
  SlidingTabsList,
  SlidingTabsTrigger,
} from '@/components/ui/sliding-tabs';

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

type TabKey = 'stays' | 'residences' | 'parking';

/** The live catalog, one tab per listing family. Every tab ends in its full list page. */
export function ExploreCatalog({ stays, residences, parking, cities }: ExploreCatalogProps) {
  const [tab, setTab] = useState<TabKey>('stays');

  const tabs: { key: TabKey; label: string; total: number }[] = [
    { key: 'stays', label: 'Stays', total: stays.total },
    { key: 'residences', label: 'Residences', total: residences.total },
    { key: 'parking', label: 'Parking', total: parking.total },
  ];

  return (
    <section aria-labelledby="home-explore" className="public-section-y">
      <div className="public-shell">
        <SlidingTabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
            <SlidingTabsList size="compact" aria-label="Listing type" className="w-full sm:w-fit">
              {tabs.map((t) => (
                <SlidingTabsTrigger key={t.key} value={t.key} className="flex-1 sm:flex-none">
                  {t.label}
                  {t.total > 0 ? (
                    <span className="text-muted-foreground ml-1.5 tabular-nums">{t.total}</span>
                  ) : null}
                </SlidingTabsTrigger>
              ))}
            </SlidingTabsList>
          </div>

          <SlidingTabsContent value="stays" className="mt-6 lg:mt-8">
            <FeedState feed={stays} noun="stays">
              <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                {stays.items.map((stay, i) => (
                  <PropertyCard key={stay.id} property={stay} index={i} />
                ))}
              </div>
            </FeedState>
            {cities.length > 0 && stays.items.length > 0 ? (
              <nav aria-label="Stays by city" className="mt-8 flex flex-wrap justify-center gap-2">
                {cities.map((c) => (
                  <Link
                    key={c.locationSlug}
                    to={`/properties/in/${c.locationSlug}`}
                    className="public-chip border-border text-foreground hover:border-foreground/30 hover:bg-muted focus-visible:ring-ring inline-flex items-center rounded-full border font-medium outline-none transition-colors focus-visible:ring-2"
                  >
                    {c.place}
                    <span className="text-muted-foreground ml-1.5 tabular-nums">{c.total}</span>
                  </Link>
                ))}
              </nav>
            ) : null}
            <SeeAll to="/properties" feed={stays} noun="stays" />
          </SlidingTabsContent>

          <SlidingTabsContent value="residences" className="mt-6 lg:mt-8">
            <FeedState feed={residences} noun="residences">
              <DevelopmentsGrid developments={residences.items} />
            </FeedState>
            <SeeAll to="/developments" feed={residences} noun="residences" />
          </SlidingTabsContent>

          <SlidingTabsContent value="parking" className="mt-6 lg:mt-8">
            <FeedState feed={parking} noun="parking">
              <ParkingsEntriesGrid entries={parking.items} />
            </FeedState>
            <SeeAll to="/parkings" feed={parking} noun="parking" />
          </SlidingTabsContent>
        </SlidingTabs>
      </div>
    </section>
  );
}

function FeedState<T>({
  feed,
  noun,
  children,
}: {
  feed: Feed<T>;
  noun: string;
  children: ReactNode;
}) {
  if (feed.isLoading) {
    return (
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={i > 0 ? 'hidden sm:block' : undefined}>
            <div className="bg-muted aspect-[4/3] animate-pulse rounded-2xl" />
            <div className="bg-muted mt-3 h-4 w-2/3 animate-pulse rounded" />
            <div className="bg-muted mt-2 h-3 w-1/3 animate-pulse rounded" />
          </div>
        ))}
      </div>
    );
  }
  if (feed.isError && feed.items.length === 0) {
    return <ListingLoadError noun={noun} onRetry={feed.refetch} retrying={feed.isFetching} />;
  }
  return <>{children}</>;
}

/** Centered under the grid, only once there is something to see more of. */
function SeeAll<T>({ to, feed, noun }: { to: string; feed: Feed<T>; noun: string }) {
  if (feed.isLoading || feed.items.length === 0) return null;
  const label =
    feed.total > feed.items.length ? `See all ${feed.total} ${noun}` : `Browse ${noun}`;

  return (
    <div className="mt-10 flex justify-center">
      <Button asChild variant="outline" className="public-cta w-full rounded-full px-6 sm:w-auto">
        <Link to={to}>
          {label}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
