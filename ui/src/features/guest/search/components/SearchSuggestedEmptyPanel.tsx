import { Building2, Mountain, Navigation, Palmtree, Waves, type LucideIcon } from 'lucide-react';

import { suggestedDestinations } from '@/features/guest/marketing/shared/data/landingContent';
import type { ListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';
import {
  suggestedSectionTitle,
  type SuggestedSearchItem,
  useSuggestedCategoryListings,
} from '@/features/guest/search/hooks/useSuggestedCategoryListings';
import {
  SUGGESTION_LABEL_CLASS,
  SUGGESTION_LIST_CLASS,
  SUGGESTION_ROW_CLASS,
  SUGGESTION_SUBTITLE_CLASS,
  SUGGESTION_TILE_CLASS,
  SUGGESTION_TITLE_CLASS,
  type SuggestionLayout,
} from '@/features/guest/search/lib/suggestionRowStyles';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const DESTINATION_ICONS: Record<(typeof suggestedDestinations)[number]['icon'], LucideIcon> = {
  nearby: Navigation,
  city: Building2,
  beach: Waves,
  mountain: Mountain,
  island: Palmtree,
};

type Props = {
  preferType: ListingSearchPreferType | null;
  onPickNearby: (label: string) => void;
  onPickDestination: (label: string) => void;
  onPickListing: (item: SuggestedSearchItem) => void;
  /**
   * `dropdown` (desktop panel): capped height with its own scroll.
   * `sheet` (phone full-screen search): flows with the page, larger tap rows.
   */
  layout?: SuggestionLayout;
};

/**
 * Where empty-state suggestions: destinations on home, recommended listings on category pages.
 * Nearby is always first on category pages (category-tagged label).
 */
export function SearchSuggestedEmptyPanel({
  preferType,
  onPickNearby,
  onPickDestination,
  onPickListing,
  layout = 'dropdown',
}: Props) {
  const { items, isLoading } = useSuggestedCategoryListings(preferType);
  const title = suggestedSectionTitle(preferType);
  const iconClass = layout === 'sheet' ? 'size-5' : 'h-4 w-4';

  if (preferType) {
    return (
      <>
        <p className={SUGGESTION_TITLE_CLASS[layout]}>{title}</p>
        {isLoading && items.length <= 1 ? (
          <ul
            className="space-y-1"
            role="status"
            aria-live="polite"
            aria-label="Loading suggestions"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className={cn(
                  'flex items-center gap-3 px-2 py-2',
                  layout === 'sheet' ? 'min-h-[60px] gap-4' : 'min-h-[44px]'
                )}
                aria-hidden
              >
                <Skeleton
                  className={cn('shrink-0 rounded-xl', layout === 'sheet' ? 'size-12' : 'size-10')}
                />
                <Skeleton className="h-4 w-36 max-w-full" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className={SUGGESTION_LIST_CLASS[layout]}>
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.kind === 'nearby') onPickNearby(item.label);
                      else onPickListing(item);
                    }}
                    className={SUGGESTION_ROW_CLASS[layout]}
                  >
                    <span className={SUGGESTION_TILE_CLASS[layout]}>
                      <Icon className={iconClass} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className={SUGGESTION_LABEL_CLASS[layout]}>{item.label}</span>
                      <span className={SUGGESTION_SUBTITLE_CLASS[layout]}>{item.subtitle}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  return (
    <>
      <p className={SUGGESTION_TITLE_CLASS[layout]}>{title}</p>
      <ul className={SUGGESTION_LIST_CLASS[layout]}>
        {suggestedDestinations.map((destination) => {
          const Icon = DESTINATION_ICONS[destination.icon];
          return (
            <li key={destination.id}>
              <button
                type="button"
                onClick={() => {
                  if (destination.id === 'nearby') onPickNearby(destination.label);
                  else onPickDestination(destination.label);
                }}
                className={SUGGESTION_ROW_CLASS[layout]}
              >
                <span className={SUGGESTION_TILE_CLASS[layout]}>
                  <Icon className={iconClass} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={SUGGESTION_LABEL_CLASS[layout]}>{destination.label}</span>
                  <span className={SUGGESTION_SUBTITLE_CLASS[layout]}>{destination.subtitle}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
