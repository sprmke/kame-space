import { useEffect, useRef, useState } from 'react';

import { Search, X } from 'lucide-react';

import {
  AdminListDesktopToolbar,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';

import {
  ReviewsHostAgainFilter,
  ReviewsListingFilter,
  ReviewsRatingFilter,
  ReviewsResponseFilter,
} from '@/features/reviews/components/ReviewsFilters';
import {
  ReviewsViewMenu,
  ReviewsViewToggle,
} from '@/features/reviews/components/ReviewsViewToggle';
import {
  activeReviewsFilterCount,
  REVIEWS_SORTS_BY_TAB,
  REVIEWS_SORT_LABELS,
  type ReviewListTab,
  type ReviewsQuery,
  type ReviewsSort,
} from '@/features/reviews/lib/propertyReviewsApi';

import {
  AdminListRefineSection,
  AdminListRefineSheet,
  AdminMobileSearchFilterRow,
} from '@/components/mobile/AdminListRefineSheet';
import { AdminListRefinePopover } from '@/components/navigation/AdminListRefinePopover';
import { AdminSortMenu } from '@/components/navigation/AdminSortMenu';
import { cn } from '@/lib/utils';

const SEARCH_PLACEHOLDER: Record<ReviewListTab, string> = {
  received: 'Search guests or review text…',
  written: 'Search guests or review text…',
  to_write: 'Search guests…',
};

export type ReviewsListingOption = { value: string; label: string };

type Props = {
  tab: ReviewListTab;
  query: ReviewsQuery;
  onChange: (next: ReviewsQuery) => void;
  hideTableView?: boolean;
  /** Org rollup only — every listing the caller can see. */
  listingOptions?: ReviewsListingOption[];
};

export function ReviewsToolbar({
  tab,
  query,
  onChange,
  hideTableView = false,
  listingOptions,
}: Props) {
  const [searchDraft, setSearchDraft] = useState(query.q);
  const [refineOpen, setRefineOpen] = useState(false);
  const [desktopRefineOpen, setDesktopRefineOpen] = useState(false);
  const searchMount = useRef(true);

  const showListingFilter = Boolean(listingOptions && listingOptions.length > 1);
  const filterCount =
    activeReviewsFilterCount(tab, query) + (showListingFilter ? query.properties.length : 0);

  useEffect(() => {
    if (searchMount.current) {
      searchMount.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (searchDraft !== query.q) onChange({ ...query, page: 1, q: searchDraft });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft, query, onChange]);

  useEffect(() => {
    setSearchDraft(query.q);
  }, [query.q]);

  function clearFilters() {
    onChange({
      ...query,
      page: 1,
      ratings: [],
      responded: 'all',
      hostAgain: 'all',
      properties: [],
    });
  }

  const searchField = (
    <div className="relative w-full min-w-0">
      <Search
        className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        role="searchbox"
        inputMode="search"
        enterKeyHint="search"
        placeholder={SEARCH_PLACEHOLDER[tab]}
        aria-label="Search reviews"
        className={cn(
          'border-border bg-card text-foreground field-focus h-11 min-h-[44px] w-full rounded-2xl border py-2.5 pl-11 text-[13px]',
          'lg:h-10 lg:min-h-[44px] lg:rounded-lg lg:pl-10 lg:text-sm',
          searchDraft ? 'pr-11' : 'pr-3',
          'placeholder:text-muted-foreground placeholder:text-[13px] lg:placeholder:text-sm'
        )}
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
      />
      {searchDraft ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg"
          aria-label="Clear search"
          onClick={() => setSearchDraft('')}
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );

  const showRatingFilter = tab !== 'to_write';

  /**
   * Only one facet sits beside Filters, or the search field is squeezed to a
   * few characters. Listings win that slot on the org rollup — it is the one
   * control that changes what the page is about — and rating moves inside.
   */
  const leadingFilter = showListingFilter ? (
    <ReviewsListingFilter
      options={listingOptions ?? []}
      value={query.properties}
      onChange={(properties) => onChange({ ...query, page: 1, properties })}
    />
  ) : showRatingFilter ? (
    <ReviewsRatingFilter
      value={query.ratings}
      onChange={(ratings) => onChange({ ...query, page: 1, ratings })}
    />
  ) : null;

  const popoverFilters = (
    <>
      {showListingFilter && showRatingFilter ? (
        <ReviewsRatingFilter
          nestedInPopover
          value={query.ratings}
          onChange={(ratings) => onChange({ ...query, page: 1, ratings })}
        />
      ) : null}
      {tab === 'received' ? (
        <ReviewsResponseFilter
          nestedInPopover
          value={query.responded}
          onChange={(responded) => onChange({ ...query, page: 1, responded })}
        />
      ) : null}
      {tab === 'written' ? (
        <ReviewsHostAgainFilter
          nestedInPopover
          value={query.hostAgain}
          onChange={(hostAgain) => onChange({ ...query, page: 1, hostAgain })}
        />
      ) : null}
    </>
  );

  const hasPopoverFilters =
    (showListingFilter && showRatingFilter) || tab === 'received' || tab === 'written';

  const popoverCount =
    (showListingFilter ? query.ratings.length : 0) +
    ((tab === 'received' && query.responded !== 'all') ||
    (tab === 'written' && query.hostAgain !== 'all')
      ? 1
      : 0);

  const sortMenu = (
    <AdminSortMenu
      sort={query.sort}
      onChange={(sort: ReviewsSort) => onChange({ ...query, sort, page: 1 })}
      options={REVIEWS_SORTS_BY_TAB[tab].map((value) => ({
        value,
        label: REVIEWS_SORT_LABELS[tab][value] ?? value,
      }))}
      ariaLabel="Sort reviews"
      menuWidthClass="w-[min(calc(100vw-24px),14rem)]"
    />
  );

  const perPage = (
    <AdminListPerPageSelect
      limit={query.limit}
      onChange={(limit) => onChange({ ...query, limit, page: 1 })}
    />
  );

  const mobileRefineBody = (
    <>
      <AdminListRefineSection title="Filters">
        <div className="flex flex-col gap-2 [&_button]:w-full">
          {showListingFilter ? (
            <ReviewsListingFilter
              options={listingOptions ?? []}
              value={query.properties}
              onChange={(properties) => onChange({ ...query, page: 1, properties })}
            />
          ) : null}
          {showRatingFilter ? (
            <ReviewsRatingFilter
              value={query.ratings}
              onChange={(ratings) => onChange({ ...query, page: 1, ratings })}
            />
          ) : null}
          {tab === 'received' ? (
            <ReviewsResponseFilter
              value={query.responded}
              onChange={(responded) => onChange({ ...query, page: 1, responded })}
            />
          ) : null}
          {tab === 'written' ? (
            <ReviewsHostAgainFilter
              value={query.hostAgain}
              onChange={(hostAgain) => onChange({ ...query, page: 1, hostAgain })}
            />
          ) : null}
        </div>
      </AdminListRefineSection>
      <AdminListRefineSection title="Sort">{sortMenu}</AdminListRefineSection>
      <AdminListRefineSection title="Per page">{perPage}</AdminListRefineSection>
    </>
  );

  return (
    <>
      <div className="space-y-2.5 lg:hidden">
        <AdminMobileSearchFilterRow
          search={searchField}
          filterCount={filterCount}
          filtersOpen={refineOpen}
          onFiltersOpenChange={setRefineOpen}
          filterAriaLabel="Refine reviews"
        />
        {/* Card is the only phone view, so a one-option toggle is left out. */}
        {hideTableView ? null : (
          <ReviewsViewToggle
            value={query.view}
            onChange={(view) => onChange({ ...query, view, page: 1 })}
          />
        )}
        <AdminListRefineSheet
          open={refineOpen}
          onOpenChange={setRefineOpen}
          title="Refine"
          activeCount={filterCount}
          onClear={clearFilters}
        >
          {mobileRefineBody}
        </AdminListRefineSheet>
      </div>

      <AdminListDesktopToolbar
        aria-label="Review filters"
        search={searchField}
        leading={leadingFilter ?? undefined}
        refine={
          hasPopoverFilters ? (
            <AdminListRefinePopover
              open={desktopRefineOpen}
              onOpenChange={setDesktopRefineOpen}
              activeCount={popoverCount}
              onClear={() =>
                onChange({
                  ...query,
                  page: 1,
                  ratings: showListingFilter ? [] : query.ratings,
                  responded: 'all',
                  hostAgain: 'all',
                })
              }
              aria-label="More review filters"
            >
              <div className="flex w-full min-w-0 flex-col gap-2 px-2 py-1.5">{popoverFilters}</div>
            </AdminListRefinePopover>
          ) : undefined
        }
        sort={sortMenu}
        perPage={perPage}
        view={
          <ReviewsViewMenu
            value={query.view}
            onChange={(view) => onChange({ ...query, view, page: 1 })}
          />
        }
      />
    </>
  );
}
