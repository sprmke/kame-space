import { useMemo, useRef, useState } from 'react';

import { Navigate, Link, useParams } from 'react-router-dom';

import { AnimatePresence, motion } from 'framer-motion';
import { Car } from 'lucide-react';

import { useDevelopmentHasParking } from '@/features/guest/marketing/developments/hooks/useDevelopmentHasParking';
import { usePublicDevelopment } from '@/features/guest/marketing/developments/hooks/usePublicDevelopment';
import {
  PropertiesFilters,
  PropertiesHero,
  PropertiesMap,
  PropertiesToolbar,
  PropertyCard,
  PropertyListItem,
  type ViewMode,
} from '@/features/guest/marketing/properties/components';
import {
  usePrefetchPublicProperties,
  usePublicProperties,
} from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import {
  clearPropertyFilters,
  countActivePropertyFilters,
  EMPTY_PROPERTIES_FACETS,
  parsePropertiesQuery,
  toPropertyCard,
  writePropertiesQuery,
  type PropertiesListingQuery,
  type PropertiesSort,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { ListingFilteredEmpty } from '@/features/guest/marketing/shared/components/ListingFilteredEmpty';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';
import {
  ListingMapToggle,
  ListingMobileMapStage,
  ListingMobileResultsBar,
} from '@/features/guest/marketing/shared/components/ListingMobileResults';
import { ListingResultsPagination } from '@/features/guest/marketing/shared/components/ListingResultsPagination';
import { useListingUrlQuery } from '@/features/guest/marketing/shared/hooks/useListingUrlQuery';
import { formatListingCount } from '@/features/guest/marketing/shared/lib/listingCountLabel';
import { buildPropertyFilterChips } from '@/features/guest/marketing/shared/lib/listingFilterChips';

import { PublicListingBrowseSkeleton } from '@/components/skeletons/GuestMarketingSkeleton';
import { ListingGridSkeleton } from '@/components/skeletons/ListingGridSkeleton';
import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { buildPageTitle } from '@/lib/seo/seoMeta';
import { usePageMeta } from '@/lib/seo/usePageMeta';

export function DevelopmentPropertiesPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const developmentResult = usePublicDevelopment(slug);
  const { data: development, isLoading, isError } = developmentResult;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const developmentScope = useMemo(() => [slug.trim().toLowerCase()], [slug]);
  const {
    query: listingQuery,
    setFilters,
    patchQuery,
    goToPage,
    viewParam,
    setViewParam,
  } = useListingUrlQuery<PropertiesListingQuery>({
    parse: parsePropertiesQuery,
    write: writePropertiesQuery,
    scope: { development: developmentScope },
    unscope: { development: [] },
  });
  const prefetchPage = usePrefetchPublicProperties();
  const viewMode: ViewMode = viewParam === 'list' || viewParam === 'map' ? viewParam : 'grid';

  const propertiesResult = usePublicProperties(listingQuery, Boolean(slug));
  const hasParking = useDevelopmentHasParking(slug);
  const homesTitle = development
    ? buildPageTitle(`Homes at ${development.name}`)
    : publicPageTitle('Homes');
  usePageTitle(homesTitle);
  usePageMeta(
    {
      title: homesTitle,
      description: development
        ? `Homes for rent at ${development.name}. Check dates and book online.`
        : null,
      canonicalPath: `/developments/${slug}/properties`,
    },
    Boolean(development)
  );

  const properties = useMemo(
    () => (propertiesResult.data?.data ?? []).map(toPropertyCard),
    [propertiesResult.data?.data]
  );
  // The development comes from the route, so it never counts as a guest filter.
  const guestFilters = useMemo(() => ({ ...listingQuery, development: [] }), [listingQuery]);
  const hasGuestFilters = countActivePropertyFilters(guestFilters) > 0;
  const totalResults = propertiesResult.data?.total ?? properties.length;
  const countLabel = formatListingCount(totalResults, 'home', 'homes');
  const setViewMode = (mode: ViewMode) => setViewParam(mode === 'grid' ? null : mode);

  if (isLoading) {
    return <PublicListingBrowseSkeleton />;
  }

  if (isError) {
    return (
      <ListingLoadError
        noun="this development"
        retrying={developmentResult.isFetching}
        onRetry={() => void developmentResult.refetch()}
      />
    );
  }

  if (!development) {
    return <Navigate to="/developments" replace />;
  }

  return (
    <div className="bg-background min-h-screen">
      <PropertiesHero />

      <ListingMobileResultsBar
        countLabel={propertiesResult.data ? countLabel : null}
        activeFilterCount={buildPropertyFilterChips(guestFilters).length}
        onOpenFilters={() => setMobileFiltersOpen(true)}
      />

      <div className="flex min-w-0">
        <PropertiesFilters
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          isMobile={false}
          value={listingQuery}
          onChange={setFilters}
          facets={propertiesResult.data?.facets ?? EMPTY_PROPERTIES_FACETS}
        />

        <PropertiesFilters
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          isMobile={true}
          value={listingQuery}
          onChange={setFilters}
          facets={propertiesResult.data?.facets ?? EMPTY_PROPERTIES_FACETS}
          sortBy={listingQuery.sort}
          onSortChange={(next) => patchQuery({ sort: next as PropertiesSort })}
        />

        <main
          ref={resultsRef}
          className="min-w-0 flex-1 scroll-mt-36 overflow-x-hidden lg:scroll-mt-16"
        >
          <PropertiesToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortBy={listingQuery.sort}
            onSortChange={(next) => patchQuery({ sort: next as PropertiesSort })}
            totalResults={totalResults}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />

          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
            <h1 className="text-foreground min-w-0 text-lg font-semibold tracking-tight sm:text-xl">
              Homes in {development.name}
            </h1>
            {hasParking ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-border hover:bg-muted min-h-[44px] shrink-0 gap-1.5 rounded-xl sm:gap-2"
              >
                <Link to={`/developments/${development.slug}/parking`}>
                  <Car className="h-4 w-4" aria-hidden />
                  View Parking
                </Link>
              </Button>
            ) : null}
          </div>

          <AnimatePresence mode="wait">
            {viewMode === 'map' ? (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 pt-4 lg:p-6"
              >
                <ListingMobileMapStage
                  countLabel={countLabel}
                  loading={propertiesResult.isFetching}
                  onShowList={() => setViewMode('grid')}
                >
                  <PropertiesMap properties={properties} />
                </ListingMobileMapStage>
              </motion.div>
            ) : (
              <motion.div
                key={`${slug}-${viewMode}-${listingQuery.page}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 p-4 sm:p-6"
              >
                {propertiesResult.isError ? (
                  <ListingLoadError
                    noun="homes"
                    retrying={propertiesResult.isFetching}
                    onRetry={() => void propertiesResult.refetch()}
                  />
                ) : propertiesResult.isLoading ? (
                  <ListingGridSkeleton
                    columnsClassName="grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                    imageAspectClassName="aspect-[4/3]"
                  />
                ) : properties.length === 0 && hasGuestFilters ? (
                  <ListingFilteredEmpty
                    noun="homes"
                    onClearFilters={() => setFilters(clearPropertyFilters(listingQuery))}
                  />
                ) : properties.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="text-muted-foreground">No homes listed here yet.</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {properties.map((property, index) => (
                      <PropertyCard key={property.id} property={property} index={index} />
                    ))}
                  </div>
                ) : (
                  <div className="mx-auto max-w-4xl space-y-4">
                    {properties.map((property, index) => (
                      <PropertyListItem key={property.id} property={property} index={index} />
                    ))}
                  </div>
                )}
                <ListingResultsPagination
                  onPrefetchPage={(page) => prefetchPage({ ...listingQuery, page })}
                  page={propertiesResult.data?.page ?? listingQuery.page}
                  total={propertiesResult.data?.total ?? 0}
                  pageSize={propertiesResult.data?.pageSize ?? listingQuery.pageSize}
                  disabled={propertiesResult.isFetching}
                  onPageChange={goToPage}
                  scrollTargetRef={resultsRef}
                />
                {properties.length > 0 ? (
                  <ListingMapToggle onShowMap={() => setViewMode('map')} />
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
