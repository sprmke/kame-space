import { ListingMobileResultsBar } from '@/features/guest/marketing/shared/components/ListingMobileResults';
import { SearchResultsTabs } from '@/features/guest/search/components/SearchResultsTabs';
import type {
  SearchListingsTotals,
  SearchListingsType,
} from '@/features/guest/search/types/search';

type CategoryId = Exclude<SearchListingsType, 'all'>;

type BarProps = {
  showTabs: boolean;
  active: SearchListingsType;
  totals: SearchListingsTotals;
  focus: CategoryId | null;
  onTabChange: (type: SearchListingsType) => void;
  /** Shown instead of the tabs when only one category has results (`1 property`). */
  countLabel: string;
  filterLabel: string;
  activeFilterCount: number;
  onOpenFilters: () => void;
};

/**
 * `/search` below `lg`: the shared listing results bar with category chips in place of the
 * count when more than one category has results.
 */
export function SearchMobileResultsBar({
  showTabs,
  active,
  totals,
  focus,
  onTabChange,
  countLabel,
  filterLabel,
  activeFilterCount,
  onOpenFilters,
}: BarProps) {
  return (
    <ListingMobileResultsBar
      countLabel={countLabel}
      filterLabel={filterLabel}
      activeFilterCount={activeFilterCount}
      onOpenFilters={onOpenFilters}
      fadeTrailingEdge={showTabs}
    >
      {showTabs ? (
        <SearchResultsTabs active={active} totals={totals} focus={focus} onChange={onTabChange} />
      ) : undefined}
    </ListingMobileResultsBar>
  );
}
