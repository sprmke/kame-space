import { Search } from 'lucide-react';

import { lerp } from '@/features/guest/marketing/shared/lib/listingScrollSearchEasing';
import type { MobilePillSummary } from '@/features/guest/marketing/shared/lib/mobileSearchState';

import { cn } from '@/lib/utils';

/** Hero size and header-docked size; the header anchor and floater math assume these. */
export const MOBILE_SEARCH_PILL_HEIGHT = 56;
export const MOBILE_SEARCH_PILL_DOCKED_HEIGHT = 44;

type Props = {
  summary: MobilePillSummary;
  /** Empty-state label, e.g. `Start your search` (or `Search services`). */
  emptyLabel: string;
  /** 0 = hero size, 1 = docked in the 56px header row. Interpolated during the scroll morph. */
  dockProgress?: number;
  expanded: boolean;
  onOpen: () => void;
  className?: string;
};

/**
 * Phone/tablet entry to search (below `lg`). One target instead of three tiny segments:
 * empty it reads `Start your search`; with a search it shows the place on top and
 * `dates · guests` underneath. Tapping opens `MobileSearchOverlay`.
 */
export function MobileSearchPill({
  summary,
  emptyLabel,
  dockProgress = 0,
  expanded,
  onOpen,
  className,
}: Props) {
  const label = summary ? `${summary.primary}, ${summary.secondary}. Edit search` : emptyLabel;
  const docked = dockProgress > 0.5;
  const height = lerp(MOBILE_SEARCH_PILL_HEIGHT, MOBILE_SEARCH_PILL_DOCKED_HEIGHT, dockProgress);
  const paddingX = lerp(20, 14, dockProgress);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      data-mobile-search-pill
      style={{ height, paddingLeft: paddingX, paddingRight: paddingX }}
      className={cn(
        'bg-background text-foreground native-press flex w-full min-w-0 items-center gap-3 rounded-full',
        'dark:ring-border transition-shadow duration-300 dark:ring-1',
        docked
          ? 'shadow-[0_1px_6px_-1px_hsl(var(--foreground)/0.16),0_0_0_1px_hsl(var(--foreground)/0.04)]'
          : 'shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.32),0_1px_3px_hsl(var(--foreground)/0.08)]',
        className
      )}
    >
      {summary ? (
        <>
          <Search className="size-[18px] shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col items-start text-left">
            <span className="w-full truncate text-sm font-semibold leading-[1.15rem]">
              {summary.primary}
            </span>
            <span className="text-muted-foreground w-full truncate text-xs leading-4">
              {summary.secondary}
            </span>
          </span>
        </>
      ) : (
        <span className="flex min-w-0 flex-1 items-center justify-center gap-2.5">
          <Search className="size-[18px] shrink-0" aria-hidden />
          <span className="truncate text-sm font-semibold">{emptyLabel}</span>
        </span>
      )}
    </button>
  );
}
