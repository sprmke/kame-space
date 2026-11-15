import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { Loader2, Map as MapIcon, SlidersHorizontal } from 'lucide-react';

import { useListingScrollSearchOptional } from '@/features/guest/marketing/shared/context/ListingScrollSearchContext';

import { cn } from '@/lib/utils';

/** Drag the map sheet up this far (px), or flick it, to open the list. */
const SHEET_EXPAND_OFFSET = 36;
const SHEET_EXPAND_VELOCITY = 350;
const PHONE_QUERY = '(max-width: 1023px)';

function readRemVar(name: string, fallbackPx: number): number {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const rem = parseFloat(styles.getPropertyValue(name));
  const rootPx = parseFloat(styles.fontSize) || 16;
  return Number.isFinite(rem) && rem > 0 ? rem * rootPx : fallbackPx;
}

type BarProps = {
  /** `null` while the first page loads: shows a placeholder instead of "0 homes". */
  countLabel: string | null;
  activeFilterCount: number;
  onOpenFilters: () => void;
  /** Accessible name of the filter button. */
  filterLabel?: string;
  /** Replaces the count (for example category chips on `/search`). */
  children?: ReactNode;
  /** Fade the trailing edge when `children` scroll under the filter button. */
  fadeTrailingEdge?: boolean;
};

/**
 * Listing results below `lg`: one sticky row under the header. Count (or chips) on the
 * left, a round filter button with an applied-filter badge on the right. Sort, view and
 * every filter live in the sheet the button opens.
 */
export function ListingMobileResultsBar({
  countLabel,
  activeFilterCount,
  onOpenFilters,
  filterLabel = 'Filters and sort',
  children,
  fadeTrailingEdge = false,
}: BarProps) {
  return (
    <div
      data-listing-mobile-bar
      className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky top-[var(--public-nav-h)] z-30 h-[var(--listing-mobile-bar-h)] border-b backdrop-blur-md lg:hidden"
    >
      <div className="flex h-full items-center gap-3 pl-4 pr-3 sm:pl-6 sm:pr-5">
        <div
          className={cn(
            'min-w-0 flex-1',
            fadeTrailingEdge &&
              '[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]'
          )}
        >
          {children ??
            (countLabel ? (
              <p className="text-foreground truncate text-sm font-semibold tabular-nums">
                {countLabel}
              </p>
            ) : (
              <span aria-hidden className="bg-muted block h-4 w-24 animate-pulse rounded" />
            ))}
        </div>
        <button
          type="button"
          onClick={onOpenFilters}
          aria-label={
            activeFilterCount > 0 ? `${filterLabel}, ${activeFilterCount} applied` : filterLabel
          }
          className={cn(
            'native-press relative flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors',
            activeFilterCount > 0
              ? 'border-foreground bg-background text-foreground'
              : 'border-border bg-background text-foreground hover:border-foreground/40'
          )}
        >
          <SlidersHorizontal className="size-[18px]" aria-hidden />
          {activeFilterCount > 0 ? (
            <span
              aria-hidden
              className="bg-foreground text-background absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums"
            >
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}

/**
 * Floating "Map" pill above the tab bar while the list shows (phone + tablet). Renders an
 * in-flow spacer too, so the last card and the pagination clear the pill. Place it at the
 * end of the results column.
 */
export function ListingMapToggle({ onShowMap }: { onShowMap: () => void }) {
  return (
    <>
      <div aria-hidden className="h-16 lg:hidden" />
      <button
        type="button"
        onClick={onShowMap}
        className={cn(
          'bg-foreground text-background native-press fixed left-1/2 z-30 inline-flex h-12 -translate-x-1/2 items-center gap-2 rounded-full px-5 text-sm font-semibold lg:hidden',
          'bottom-[calc(var(--mobile-bottom-bar-h)+1rem)]',
          'shadow-[0_10px_28px_-8px_hsl(var(--foreground)/0.5)] transition-opacity hover:opacity-95'
        )}
      >
        Map
        <MapIcon className="size-4" aria-hidden />
      </button>
    </>
  );
}

type StageProps = {
  /** Count shown on the sheet handle, e.g. "12 properties". */
  countLabel: string;
  loading?: boolean;
  onShowList: () => void;
  children: ReactNode;
};

/**
 * Map view below `lg`: the map fills the screen between the results bar and the tab bar,
 * with a sheet handle at the bottom. Drag the handle up, flick it, or tap it to go back to
 * the list. `lg+` renders the map exactly as before (no stage, no handle).
 */
export function ListingMobileMapStage({ countLabel, loading, onShowList, children }: StageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const setDockLocked = useListingScrollSearchOptional()?.setDockLocked;

  // A short hero would leave the header search half-docked over the logo; hold it docked.
  useEffect(() => {
    if (!setDockLocked || !window.matchMedia(PHONE_QUERY).matches) return;
    setDockLocked(true);
    return () => setDockLocked(false);
  }, [setDockLocked]);

  // Park the stage right under the sticky bar so the map owns the whole viewport.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !window.matchMedia(PHONE_QUERY).matches) return;
    const offset = readRemVar('--public-nav-h', 56) + readRemVar('--listing-mobile-bar-h', 60);
    const top = stage.getBoundingClientRect().top + window.scrollY - offset;
    if (Math.abs(top - window.scrollY) > 1) window.scrollTo({ top: Math.max(0, top) });
  }, []);

  return (
    <div ref={stageRef} className="listing-map-stage" data-listing-map-stage>
      <div className="listing-map-stage__map">{children}</div>
      <MapSheetHandle countLabel={countLabel} loading={loading} onExpand={onShowList} />
    </div>
  );
}

function MapSheetHandle({
  countLabel,
  loading,
  onExpand,
}: {
  countLabel: string;
  loading?: boolean;
  onExpand: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const draggedRef = useRef(false);

  const onDragEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (info.offset.y < -SHEET_EXPAND_OFFSET || info.velocity.y < -SHEET_EXPAND_VELOCITY) {
      onExpand();
    }
    // The click that ends a drag must not count as a tap.
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  return (
    <motion.button
      type="button"
      drag={reduceMotion ? false : 'y'}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.45, bottom: 0.08 }}
      dragSnapToOrigin
      onDragStart={() => {
        draggedRef.current = true;
      }}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (draggedRef.current) return;
        onExpand();
      }}
      aria-label={`${countLabel}. Show list`}
      className={cn(
        'bg-background border-border relative z-10 flex h-16 w-full shrink-0 touch-none select-none flex-col items-center justify-center gap-2 border-t lg:hidden',
        'shadow-[0_-12px_28px_-20px_hsl(var(--foreground)/0.55)]',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset'
      )}
    >
      <span aria-hidden className="bg-muted-foreground/35 h-1 w-9 rounded-full" />
      <span className="text-foreground inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
        {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        {countLabel}
      </span>
    </motion.button>
  );
}
