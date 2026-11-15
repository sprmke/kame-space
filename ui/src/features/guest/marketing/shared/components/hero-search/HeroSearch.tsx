import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';

import {
  ActiveSegmentPill,
  FlexDateChips,
  GuestRow,
  SearchSegment,
  type SegmentPillBounds,
} from '@/features/guest/marketing/shared/components/hero-search/HeroSearchParts';
import type { MobileSearchRow } from '@/features/guest/marketing/shared/components/hero-search/MobileSearchOverlay';
import { MobileSearchPill } from '@/features/guest/marketing/shared/components/hero-search/MobileSearchPill';
import {
  heroSearchCalendarClassNames,
  heroSearchCalendarMonthCount,
  heroSearchWhenPanelWidth,
} from '@/features/guest/marketing/shared/lib/heroSearchCalendarClassNames';
import {
  buildSearchValues,
  computeDropdownLayout,
  estimatedPanelHeight,
  formatDateRange,
  formatGuestSummary,
  formatGuestSummaryCompact,
  normalizeStayRange,
  parseDateParam,
  parseGuestBreakdown,
  parseGuestsParam,
  readWhereParam,
  type DropdownLayout,
  type GuestCounts,
  type HeroSearchValues,
  type SearchField,
} from '@/features/guest/marketing/shared/lib/heroSearchState';
import { lerp, smoothstep } from '@/features/guest/marketing/shared/lib/listingScrollSearchEasing';
import { resolveListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingScrollSearchPaths';
import type { ListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';
import {
  categoryFromPreferType,
  formatStayRangeShort,
  mobilePillSummary,
  preferTypeFromCategory,
  readRecentSearches,
  saveRecentSearch,
  showsCategoryTabs,
  stepsForCategory,
  wherePlaceholderForCategory,
  whenStepTitle,
  type MobileSearchCategory,
  type MobileSearchStep,
  type RecentSearch,
} from '@/features/guest/marketing/shared/lib/mobileSearchState';
import {
  flexForRange,
  flexSummarySuffix,
  parseFlexDaysParam,
  type SearchFlexDays,
} from '@/features/guest/marketing/shared/lib/searchFlexDays';
import { SearchSuggestedEmptyPanel } from '@/features/guest/search/components/SearchSuggestedEmptyPanel';
import {
  flattenSuggestions,
  SearchSuggestionPanel,
  type SuggestionCategoryTarget,
} from '@/features/guest/search/components/SearchSuggestionPanel';
import { useSearchSuggestions } from '@/features/guest/search/hooks/useSearchSuggestions';
import type { SuggestedSearchItem } from '@/features/guest/search/hooks/useSuggestedCategoryListings';
import { requestGuestGeolocation } from '@/features/guest/search/lib/geolocation';
import {
  isConceptSuggestionId,
  isNearbyQuery,
  nearbyCategoryFromQuery,
  nearbyDisplayLabel,
  resolveClientSearchIntent,
} from '@/features/guest/search/lib/searchIntents';
import { buildSearchHref, parseSearchParams } from '@/features/guest/search/lib/searchParams';
import type {
  SearchListingsType,
  SearchSuggestionItem,
} from '@/features/guest/search/types/search';

import { Skeleton } from '@/components/ui/skeleton';
import { useHistoryBackDismiss } from '@/hooks/useHistoryBackDismiss';
import { cn } from '@/lib/utils';

import type { DateRange } from 'react-day-picker';

export type { HeroSearchValues };

export const HERO_SEARCH_FIELDS = ['where', 'when', 'who'] as const;
export type HeroSearchField = (typeof HERO_SEARCH_FIELDS)[number];

const DEFAULT_FIELD_ORDER: SearchField[] = ['where', 'when', 'who'];

/** Steppers stop here (matches the phone Who step); capacity is still checked per listing. */
const GUEST_MAX_PER_ROW = 16;
const GUEST_MAX_PETS = 5;

/** Panel position + size — keep width/height on the same spring so the calendar does not squash. */
const PANEL_SPRING = { type: 'spring' as const, stiffness: 400, damping: 38, mass: 0.88 };

/** react-day-picker + date-fns stay out of the landing entry chunk; prefetched when the hero is idle. */
const loadCalendar = () => import('@/components/ui/calendar');
const Calendar = lazy(() => loadCalendar().then((m) => ({ default: m.Calendar })));

/**
 * The phone full-screen search (sheet + steps) is only needed after a tap, so it stays out of
 * the landing entry chunk too. Prefetched when idle on narrow screens and on pill press/focus.
 */
const loadMobileSearchOverlay = () =>
  import('@/features/guest/marketing/shared/components/hero-search/MobileSearchOverlay');
const loadMobileSearchSteps = () =>
  import('@/features/guest/marketing/shared/components/hero-search/MobileSearchSteps');
const prefetchMobileSearch = () => {
  void loadMobileSearchOverlay();
  void loadMobileSearchSteps();
};
const MobileSearchOverlay = lazy(() =>
  loadMobileSearchOverlay().then((m) => ({ default: m.MobileSearchOverlay }))
);
const MobileWhereStep = lazy(() =>
  loadMobileSearchSteps().then((m) => ({ default: m.MobileWhereStep }))
);
const MobileWhenStep = lazy(() =>
  loadMobileSearchSteps().then((m) => ({ default: m.MobileWhenStep }))
);
const MobileWhoStep = lazy(() =>
  loadMobileSearchSteps().then((m) => ({ default: m.MobileWhoStep }))
);
const MobileRecentSearches = lazy(() =>
  loadMobileSearchSteps().then((m) => ({ default: m.MobileRecentSearches }))
);

function prefetchWhenIdle(load: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => load());
    return () => window.cancelIdleCallback(id);
  }
  const timer = globalThis.setTimeout(() => load(), 2000);
  return () => globalThis.clearTimeout(timer);
}

function prefetchCalendarWhenIdle(): () => void {
  return prefetchWhenIdle(() => void loadCalendar());
}

interface HeroSearchProps {
  className?: string;
  /** Navigate here on search when `onSearch` is not provided. Default: `/search` */
  redirectTo?: string;
  /**
   * Prefer this listing family in typeahead + `/search` All view (`focus` URL param).
   * Omit to resolve from the current pathname (or existing `focus` on `/search`).
   * “Search all results” always clears focus.
   */
  preferType?: ListingSearchPreferType | null;
  /** Pre-fill "Where" when no `?location=` query param (route-derived on listing pages). */
  defaultLocation?: string;
  /** Local filter mode — skips navigation */
  onSearch?: (values: HeroSearchValues) => void;
  /** Visible segments — omit `who` on parking, services, and other non-guest listings. Default: all three. */
  fields?: HeroSearchField[];
  /** First segment label — `What` on `/services`, default `Where`. */
  whereLabel?: string;
  wherePlaceholder?: string;
  whereCompactPlaceholder?: string;
  /** 0 = expanded hero, 1 = compact header. Scroll morph passes this for smooth interpolation. */
  morphProgress?: number;
  /** Raw scroll morph progress (0–1) for mobile width / dock behavior. */
  scrollProgress?: number;
  /** Compact header-docked style (instant; used when `morphProgress` is omitted). */
  variant?: 'default' | 'compact';
}

export function HeroSearch({
  className,
  redirectTo: _redirectTo = '/search',
  preferType: preferTypeProp,
  defaultLocation = '',
  onSearch,
  fields = DEFAULT_FIELD_ORDER,
  whereLabel = 'Where',
  wherePlaceholder = 'Search destinations',
  whereCompactPlaceholder = 'Anywhere',
  morphProgress,
  scrollProgress = 0,
  variant = 'default',
}: HeroSearchProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const preferType =
    preferTypeProp !== undefined
      ? preferTypeProp
      : (parseSearchParams(searchParams).focus ?? resolveListingSearchPreferType(pathname));
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const segmentRefs = useRef<Record<SearchField, HTMLButtonElement | null>>({
    where: null,
    when: null,
    who: null,
  });
  const segmentsRowRef = useRef<HTMLDivElement>(null);
  const prevFieldRef = useRef<SearchField | null>(null);
  const hasOpenedRef = useRef(false);
  const [pillBounds, setPillBounds] = useState<SegmentPillBounds | null>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);

  const [activeField, setActiveField] = useState<SearchField | null>(null);
  const [location, setLocation] = useState(() => readWhereParam(searchParams, defaultLocation));

  useEffect(() => {
    setLocation(readWhereParam(searchParams, defaultLocation));
  }, [pathname, defaultLocation, searchParams]);

  useEffect(() => prefetchCalendarWhenIdle(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = parseDateParam(searchParams.get('checkIn'));
    const to = parseDateParam(searchParams.get('checkOut'));
    if (!from) return undefined;
    return { from, to: to ?? from };
  });
  /** ± days around the stay; only sent and shown once both dates are picked. */
  const [dateFlex, setDateFlex] = useState<SearchFlexDays>(() =>
    flexForRange(
      parseFlexDaysParam(searchParams.get('flex')),
      searchParams.get('checkIn'),
      searchParams.get('checkOut')
    )
  );
  const [guests, setGuests] = useState<GuestCounts>(() => parseGuestBreakdown(searchParams));

  useEffect(() => {
    setGuests(parseGuestBreakdown(searchParams));
  }, [pathname, searchParams]);
  const [calendarMonths, setCalendarMonths] = useState(1);
  const [rootWidth, setRootWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [dropdownLayout, setDropdownLayout] = useState<DropdownLayout>({
    left: 0,
    top: 72,
    width: 400,
    height: 360,
  });

  const fieldOrder = fields;
  const showWho = fieldOrder.includes('who');

  useEffect(() => {
    if (!showWho && activeField === 'who') {
      setActiveField(null);
    }
  }, [showWho, activeField]);

  /* Phone full-screen search (below lg). Shares every value with the desktop bar. */
  const categoryTabs = showsCategoryTabs(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileStep, setMobileStep] = useState<MobileSearchStep>('where');
  const [mobileCategory, setMobileCategory] = useState<MobileSearchCategory>(() =>
    categoryFromPreferType(preferType)
  );
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  /** The lazy sheet mounts on first open and then stays mounted for its exit animation. */
  const [mobileSheetMounted, setMobileSheetMounted] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const overlayHistory = useHistoryBackDismiss(mobileOpen, closeMobile);
  const mobileSteps: MobileSearchStep[] = categoryTabs
    ? stepsForCategory(mobileCategory)
    : fieldOrder;
  const mobilePreferType = categoryTabs ? preferTypeFromCategory(mobileCategory) : preferType;
  /** Category that typeahead, Nearby and submit honor right now. */
  const activePreferType = mobileOpen ? mobilePreferType : preferType;

  const openMobile = () => {
    setMobileCategory(categoryFromPreferType(preferType));
    setMobileStep('where');
    setRecentSearches(readRecentSearches());
    setMobileSheetMounted(true);
    setMobileOpen(true);
  };

  const changeMobileCategory = (next: MobileSearchCategory) => {
    setMobileCategory(next);
    if (!stepsForCategory(next).includes(mobileStep)) setMobileStep('when');
  };

  const isExpanded = activeField !== null;
  const morph = morphProgress ?? (variant === 'compact' ? 1 : 0);
  const layoutWidth =
    rootWidth > 0 ? rootWidth : typeof window !== 'undefined' ? window.innerWidth : 1024;
  /** Use viewport — bar width is capped (~768px) and must not drive breakpoint logic. */
  const isNarrowViewport = viewportWidth < 1024;
  /** Desktop hero: labeled Airbnb segments. Header + mobile: compact single-line. */
  const useDesktopHeroBar = !isNarrowViewport && morph <= 0.38;
  const useCompactBar = !useDesktopHeroBar;
  const segmentMorph = morph;
  const effectiveCalendarMonths = heroSearchCalendarMonthCount(calendarMonths, rootWidth, morph);
  const mobileDocked = isNarrowViewport && scrollProgress > 0.65;
  const useTightGuestLabel = isNarrowViewport && (layoutWidth < 380 || mobileDocked);
  const guestSummary = useTightGuestLabel
    ? formatGuestSummaryCompact(guests) || formatGuestSummary(guests)
    : formatGuestSummary(guests);
  const searchButtonSize = isNarrowViewport
    ? mobileDocked
      ? 32
      : lerp(40, 32, segmentMorph)
    : lerp(48, 32, segmentMorph);
  const searchIconSize = lerp(16, 14, segmentMorph);
  const hasStaySpan = Boolean(
    dateRange?.from && dateRange.to && dateRange.to.getTime() > dateRange.from.getTime()
  );
  const activeFlex: SearchFlexDays = hasStaySpan ? dateFlex : 0;
  const flexSuffix = flexSummarySuffix(activeFlex);
  const rangeSummary = formatDateRange(dateRange);
  const dateSummary = rangeSummary ? rangeSummary + flexSuffix : '';
  const whenPanelWidth = heroSearchWhenPanelWidth(effectiveCalendarMonths, layoutWidth);
  const segmentPillRounded = useCompactBar ? 'rounded-full' : 'rounded-full';

  const measureActivePill = useCallback(() => {
    if (!activeField || !segmentsRowRef.current) {
      setPillBounds(null);
      return;
    }

    const segment = segmentRefs.current[activeField];
    if (!segment) return;

    const rowRect = segmentsRowRef.current.getBoundingClientRect();
    const segmentRect = segment.getBoundingClientRect();

    setPillBounds({
      left: segmentRect.left - rowRect.left,
      top: segmentRect.top - rowRect.top,
      width: segmentRect.width,
      height: segmentRect.height,
    });
  }, [activeField]);

  const slideDirection =
    activeField && prevFieldRef.current
      ? fieldOrder.indexOf(activeField) - fieldOrder.indexOf(prevFieldRef.current)
      : 0;

  const updateDropdownLayout = useCallback(() => {
    if (!activeField || !rootRef.current || !barRef.current) return;
    const segmentEl = segmentRefs.current[activeField];
    if (!segmentEl) return;

    const measured = contentRef.current?.scrollHeight;
    const height =
      measured && measured > 0
        ? measured
        : estimatedPanelHeight(activeField, effectiveCalendarMonths);

    setDropdownLayout(
      computeDropdownLayout(
        activeField,
        rootRef.current,
        barRef.current,
        segmentEl,
        effectiveCalendarMonths,
        height
      )
    );
  }, [activeField, effectiveCalendarMonths]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Rotating a tablet past `lg` swaps in the desktop bar; never leave a hidden modal behind.
  useEffect(() => {
    if (!isNarrowViewport && mobileOpen) setMobileOpen(false);
  }, [isNarrowViewport, mobileOpen]);

  useEffect(() => {
    // Opening the sheet is the strongest signal the date step is next.
    if (mobileOpen) void loadCalendar();
  }, [mobileOpen]);

  useEffect(() => {
    if (!isNarrowViewport) return;
    return prefetchWhenIdle(prefetchMobileSearch);
  }, [isNarrowViewport]);

  useEffect(() => {
    prevFieldRef.current = activeField;
  }, [activeField]);

  useLayoutEffect(() => {
    measureActivePill();
    const id = window.requestAnimationFrame(measureActivePill);
    return () => window.cancelAnimationFrame(id);
  }, [
    measureActivePill,
    segmentMorph,
    morph,
    location,
    dateSummary,
    guestSummary,
    rootWidth,
    useCompactBar,
    mobileDocked,
  ]);

  useEffect(() => {
    const row = segmentsRowRef.current;
    if (!row) return;

    const observer = new ResizeObserver(() => measureActivePill());
    observer.observe(row);
    for (const field of fieldOrder) {
      const segment = segmentRefs.current[field];
      if (segment) observer.observe(segment);
    }

    window.addEventListener('resize', measureActivePill);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureActivePill);
    };
  }, [measureActivePill, activeField, useCompactBar, fieldOrder]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setCalendarMonths(mq.matches ? 2 : 1);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const syncWidth = () => {
      const width = el.getBoundingClientRect().width;
      setRootWidth((prev) => (Math.abs(prev - width) < 0.5 ? prev : width));
    };

    syncWidth();
    const ro = new ResizeObserver(syncWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [morph]);

  useLayoutEffect(() => {
    if (!activeField) {
      hasOpenedRef.current = false;
      return;
    }

    const estimate = estimatedPanelHeight(activeField, effectiveCalendarMonths);
    const segmentEl = segmentRefs.current[activeField];
    if (rootRef.current && barRef.current && segmentEl) {
      setDropdownLayout(
        computeDropdownLayout(
          activeField,
          rootRef.current,
          barRef.current,
          segmentEl,
          effectiveCalendarMonths,
          estimate
        )
      );
    }

    const measureId = window.requestAnimationFrame(() => {
      updateDropdownLayout();
      window.requestAnimationFrame(updateDropdownLayout);
    });
    return () => window.cancelAnimationFrame(measureId);
  }, [activeField, effectiveCalendarMonths, morph, dateRange, guests, updateDropdownLayout]);

  useEffect(() => {
    if (!activeField) return;

    const onScroll = () => updateDropdownLayout();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeField, updateDropdownLayout]);

  useEffect(() => {
    if (!activeField || !contentRef.current) return;

    const observer = new ResizeObserver(() => {
      updateDropdownLayout();
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [activeField, updateDropdownLayout]);

  useEffect(() => {
    if (!activeField) return;

    const onResize = () => updateDropdownLayout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeField, updateDropdownLayout]);

  useEffect(() => {
    if (activeField !== 'where') return;
    const id = window.requestAnimationFrame(() => locationInputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [activeField]);

  useEffect(() => {
    if (!activeField) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveField(null);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeField]);

  useEffect(() => {
    if (!activeField) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setActiveField(null);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [activeField]);

  const activateField = useCallback((field: SearchField) => {
    setActiveField(field);
  }, []);

  const suggestionsEnabled = activeField === 'where' || (mobileOpen && mobileStep === 'where');
  const { data: suggestionData, isFetching: suggestionsLoading } = useSearchSuggestions(
    location,
    suggestionsEnabled
  );

  const flatSuggestions = flattenSuggestions({
    locations: suggestionData?.locations ?? [],
    developments: suggestionData?.developments ?? [],
    properties: suggestionData?.properties ?? [],
    parkings: suggestionData?.parkings ?? [],
    preferType: activePreferType,
  });

  useEffect(() => {
    setSuggestionIndex(-1);
  }, [location, suggestionData]);

  /**
   * Every navigation out of search goes through here. With the phone search open, the
   * destination replaces its history entry so Back returns to this page in one step.
   */
  const goTo = (href: string) => {
    navigate(href, { replace: overlayHistory.consume() });
    setActiveField(null);
    setMobileOpen(false);
  };

  const selectDestination = (label: string) => {
    setLocation(label);
    if (mobileOpen) {
      setMobileStep('when');
      return;
    }
    setActiveField('when');
  };

  const navigateToSearch = async (
    whereValue: string,
    options?: {
      clearFocus?: boolean;
      type?: SearchListingsType;
      focus?: ListingSearchPreferType | null;
      /** Re-running a recent search: state setters have not flushed yet. */
      dates?: DateRange | undefined;
      party?: GuestCounts;
    }
  ) => {
    const preferType = activePreferType;
    const replaying = Boolean(options && 'dates' in options);
    const stay = replaying ? options?.dates : dateRange;
    const party = options?.party ?? guests;
    const values = buildSearchValues(whereValue, stay, party);
    let lat: number | null = null;
    let lng: number | null = null;

    if (isNearbyQuery(whereValue)) {
      const geo = await requestGuestGeolocation();
      if (geo.ok) {
        lat = geo.latitude;
        lng = geo.longitude;
      }
      // Always land on /search — page shows Allow location when coords missing.
    }

    const nearbyCategory =
      options?.focus !== undefined
        ? options.focus
        : (nearbyCategoryFromQuery(whereValue) ?? (options?.clearFocus ? null : preferType));

    const type =
      options?.type ?? (isNearbyQuery(whereValue) && nearbyCategory ? nearbyCategory : 'all');
    const focus =
      options?.focus !== undefined
        ? options.focus
        : options?.clearFocus
          ? null
          : isNearbyQuery(whereValue)
            ? nearbyCategory
            : preferType;

    const whereParam = isNearbyQuery(whereValue)
      ? nearbyDisplayLabel(nearbyCategoryFromQuery(whereValue) ?? nearbyCategory)
      : values.location;

    setRecentSearches(
      saveRecentSearch({
        where: whereParam,
        checkIn: values.checkIn,
        checkOut: values.checkOut,
        adults: party.adults,
        children: party.children,
        pets: party.pets,
        type,
      })
    );

    goTo(
      buildSearchHref({
        where: whereParam,
        checkIn: values.checkIn,
        checkOut: values.checkOut,
        // A replayed recent search keeps its own exact dates.
        flex: replaying ? 0 : activeFlex,
        adults: party.adults,
        children: party.children,
        infants: 0,
        pets: party.pets,
        type,
        lat,
        lng,
        focus,
      })
    );
  };

  const viewSuggestionCategory = (target: SuggestionCategoryTarget) => {
    const whereValue = location.trim();
    if (target.type) {
      void navigateToSearch(whereValue, {
        type: target.type,
        focus: target.type,
        clearFocus: false,
      });
      return;
    }
    // Locations → All results for this where text
    void navigateToSearch(whereValue, { type: 'all', clearFocus: true });
  };

  const selectSuggestion = (item: SearchSuggestionItem) => {
    if (isConceptSuggestionId(item.id)) {
      const intent = resolveClientSearchIntent(item.label);
      const focus = intent.kind === 'concept' ? (intent.preferType ?? null) : null;
      void navigateToSearch(item.label, {
        type: 'all',
        focus,
        clearFocus: !focus,
      });
      return;
    }
    if (item.id === 'nearby' || (item.kind === 'location' && isNearbyQuery(item.label))) {
      void navigateToSearch(nearbyDisplayLabel(activePreferType), {
        type: activePreferType ?? 'all',
        focus: activePreferType,
      });
      return;
    }
    if (item.kind === 'property' && item.slug) {
      goTo(`/properties/${item.slug}`);
      return;
    }
    if (item.kind === 'development' && item.slug) {
      goTo(`/developments/${item.slug}`);
      return;
    }
    if (item.kind === 'parking' && item.slug) {
      goTo(`/parkings/${item.slug}`);
      return;
    }
    selectDestination(item.city || item.label);
  };

  const runSearchNavigation = (clearFocus: boolean) => {
    const values = buildSearchValues(location, dateRange, guests);

    if (onSearch && !clearFocus) {
      onSearch(values);
      setActiveField(null);
      setMobileOpen(false);
      return;
    }

    // Always use unified /search for real results (legacy redirectTo shells ignored).
    void navigateToSearch(values.location, { clearFocus });
  };

  const handleSearch = () => {
    runSearchNavigation(false);
  };

  /** Phone Search button: the selected tab scopes the results (type + focus). */
  const handleMobileSearch = () => {
    if (!categoryTabs || onSearch) {
      runSearchNavigation(false);
      return;
    }
    void navigateToSearch(location, {
      type: mobileCategory,
      focus: preferTypeFromCategory(mobileCategory),
    });
  };

  const pickRecentSearch = (entry: RecentSearch) => {
    const from = parseDateParam(entry.checkIn);
    const to = parseDateParam(entry.checkOut);
    const dates = from ? { from, to: to ?? from } : undefined;
    const party: GuestCounts = {
      adults: entry.adults,
      children: entry.children,
      infants: 0,
      pets: entry.pets,
    };
    setLocation(entry.where);
    setDateRange(dates);
    setGuests(party);
    void navigateToSearch(entry.where, {
      type: entry.type,
      focus: entry.type === 'all' ? null : entry.type,
      dates,
      party,
    });
  };

  const defaultGuests = parseGuestsParam(null);
  const canClearMobile =
    location.trim().length > 0 ||
    Boolean(dateRange?.from) ||
    guests.adults !== defaultGuests.adults ||
    guests.children !== defaultGuests.children ||
    guests.pets !== defaultGuests.pets;

  const clearMobile = () => {
    setLocation('');
    setDateRange(undefined);
    setDateFlex(0);
    setGuests(defaultGuests);
    setMobileStep('where');
  };

  const advanceFromWhen = () => {
    if (mobileSteps.includes('who')) setMobileStep('who');
    else handleMobileSearch();
  };

  /** Phone typeahead keys. Enter without a highlighted row falls through to the form submit. */
  const onMobileWhereKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (location.trim().length < 2) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSuggestionIndex((current) =>
        flatSuggestions.length === 0 ? -1 : Math.min(current + 1, flatSuggestions.length - 1)
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSuggestionIndex((current) => Math.max(current - 1, -1));
      return;
    }
    if (event.key === 'Enter' && suggestionIndex >= 0 && flatSuggestions[suggestionIndex]) {
      event.preventDefault();
      selectSuggestion(flatSuggestions[suggestionIndex]);
    }
  };

  /** Typeahead “Search all results for …” — unified /search without page focus. */
  const handleSearchAllResults = () => {
    runSearchNavigation(true);
  };

  const pickSuggestedNearby = (label: string) => {
    const category = nearbyCategoryFromQuery(label) ?? activePreferType;
    void navigateToSearch(nearbyDisplayLabel(category), {
      type: category ?? 'all',
      focus: category,
    });
  };

  const pickSuggestedDestination = (label: string) => {
    if (isNearbyQuery(label)) {
      pickSuggestedNearby(label);
      return;
    }
    selectDestination(label);
  };

  const pickSuggestedListing = (item: SuggestedSearchItem) => {
    if (!item.slug || !item.listingType) return;
    if (item.listingType === 'properties') goTo(`/properties/${item.slug}`);
    else if (item.listingType === 'developments') goTo(`/developments/${item.slug}`);
    else goTo(`/parkings/${item.slug}`);
  };

  const onWhereKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const liveMode = location.trim().length >= 2;
    if (!liveMode) {
      if (event.key === 'Enter') handleSearch();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSuggestionIndex((current) =>
        flatSuggestions.length === 0 ? -1 : Math.min(current + 1, flatSuggestions.length - 1)
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSuggestionIndex((current) => Math.max(current - 1, -1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (suggestionIndex >= 0 && flatSuggestions[suggestionIndex]) {
        selectSuggestion(flatSuggestions[suggestionIndex]);
        return;
      }
      handleSearch();
      return;
    }
    if (event.key === 'Escape') {
      setActiveField(null);
    }
  };

  const updateGuest = (key: keyof GuestCounts, delta: number) => {
    setGuests((current) => {
      const floor = key === 'adults' ? 1 : 0;
      const ceiling = key === 'pets' ? GUEST_MAX_PETS : GUEST_MAX_PER_ROW;
      const next = Math.min(ceiling, Math.max(floor, current[key] + delta));
      return { ...current, [key]: next };
    });
  };

  /** The 2-adult default alone is not "set"; URL guests or a stepper change are. */
  const hasGuestParams =
    ['adults', 'children', 'pets', 'guests'].some((key) => searchParams.has(key)) ||
    guests.adults !== defaultGuests.adults ||
    guests.children !== defaultGuests.children ||
    guests.pets !== defaultGuests.pets;
  const shortRange = formatStayRangeShort(dateRange?.from, dateRange?.to);
  const shortDates = shortRange ? shortRange + flexSuffix : '';

  if (isNarrowViewport) {
    const pillSummary = mobilePillSummary({
      where: location,
      dateSummary: shortDates,
      guestSummary: formatGuestSummary(guests),
      showWho,
      hasGuestParams,
    });
    const dockProgress = variant === 'compact' ? 1 : smoothstep(0.4, 0.95, scrollProgress);
    const liveSuggestions = location.trim().length >= 2;

    const rows: MobileSearchRow[] = mobileSteps.map((step) => {
      if (step === 'where') {
        return {
          step,
          label: whereLabel,
          value: location.trim() || (categoryTabs ? 'Anywhere' : whereCompactPlaceholder),
        };
      }
      if (step === 'when') return { step, label: 'When', value: shortDates || 'Add dates' };
      return { step, label: 'Who', value: formatGuestSummary(guests) || 'Add guests' };
    });

    const renderMobileStep = (step: MobileSearchStep) => {
      if (step === 'where') {
        return (
          <MobileWhereStep
            title={categoryTabs ? 'Where to?' : 'What are you looking for?'}
            value={location}
            placeholder={
              categoryTabs ? wherePlaceholderForCategory(mobileCategory) : wherePlaceholder
            }
            inputRef={mobileInputRef}
            onChange={setLocation}
            onKeyDown={onMobileWhereKeyDown}
            onSubmit={handleMobileSearch}
            activeDescendant={
              suggestionIndex >= 0 ? `search-suggestion-${suggestionIndex}` : undefined
            }
            liveContent={
              liveSuggestions ? (
                <SearchSuggestionPanel
                  locations={suggestionData?.locations ?? []}
                  developments={suggestionData?.developments ?? []}
                  properties={suggestionData?.properties ?? []}
                  parkings={suggestionData?.parkings ?? []}
                  isLoading={suggestionsLoading}
                  query={location}
                  activeIndex={suggestionIndex}
                  onHighlight={setSuggestionIndex}
                  onSelect={selectSuggestion}
                  onSearchAnyway={handleSearchAllResults}
                  onViewCategory={viewSuggestionCategory}
                  preferType={mobilePreferType}
                />
              ) : null
            }
            idleContent={
              <>
                <MobileRecentSearches items={recentSearches} onPick={pickRecentSearch} />
                <div>
                  <SearchSuggestedEmptyPanel
                    layout="sheet"
                    preferType={mobilePreferType}
                    onPickNearby={pickSuggestedNearby}
                    onPickDestination={pickSuggestedDestination}
                    onPickListing={pickSuggestedListing}
                  />
                </div>
              </>
            }
          />
        );
      }
      if (step === 'when') {
        return (
          <MobileWhenStep
            title={categoryTabs ? whenStepTitle(mobileCategory) : 'When do you need it?'}
            range={dateRange}
            onRangeChange={setDateRange}
            flex={dateFlex}
            onFlexChange={setDateFlex}
            nextLabel={mobileSteps.includes('who') ? 'Next' : 'Search'}
            onNext={advanceFromWhen}
            onSkip={advanceFromWhen}
          />
        );
      }
      return <MobileWhoStep guests={guests} onChange={updateGuest} />;
    };

    return (
      <div ref={rootRef} className={cn('relative w-full', className)}>
        <MobileSearchPill
          summary={pillSummary}
          emptyLabel={categoryTabs ? 'Start your search' : wherePlaceholder}
          dockProgress={dockProgress}
          expanded={mobileOpen}
          onOpen={openMobile}
          onIntent={prefetchMobileSearch}
        />
        {mobileSheetMounted ? (
          <Suspense fallback={null}>
            <MobileSearchOverlay
              open={mobileOpen}
              onClose={closeMobile}
              category={categoryTabs ? mobileCategory : null}
              onCategoryChange={changeMobileCategory}
              rows={rows}
              activeStep={mobileStep}
              onStepChange={setMobileStep}
              renderStep={renderMobileStep}
              showFooter={mobileStep !== 'when'}
              canClear={canClearMobile}
              onClearAll={clearMobile}
              onSearch={handleMobileSearch}
            />
          </Suspense>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative z-50 w-full', className)}>
      <AnimatePresence>
        {isExpanded ? (
          <motion.button
            type="button"
            aria-label="Close search panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            onClick={() => setActiveField(null)}
          />
        ) : null}
      </AnimatePresence>

      <div
        ref={barRef}
        className={cn(
          'border-border bg-muted/80 relative z-50 overflow-hidden rounded-full border shadow-sm',
          isExpanded && 'shadow-md',
          morph > 0.55 && 'shadow-md',
          !isExpanded && useCompactBar && 'overflow-hidden'
        )}
        style={{
          paddingTop: `${useCompactBar ? lerp(mobileDocked ? 4 : 8, 6, segmentMorph) : 8}px`,
          paddingBottom: `${useCompactBar ? lerp(mobileDocked ? 4 : 8, 6, segmentMorph) : 8}px`,
          paddingLeft: `${useCompactBar ? lerp(mobileDocked ? 6 : 8, 10, segmentMorph) : 16}px`,
          paddingRight: `${useCompactBar ? lerp(mobileDocked ? 4 : 8, 10, segmentMorph) : 16}px`,
        }}
      >
        <div ref={segmentsRowRef} className="relative w-full min-w-0">
          {useCompactBar ? (
            <div className="flex w-full min-w-0 items-center">
              {activeField && pillBounds ? (
                <ActiveSegmentPill bounds={pillBounds} roundedClass={segmentPillRounded} />
              ) : null}
              <SearchSegment
                ref={(node) => {
                  segmentRefs.current.where = node;
                }}
                field="where"
                label={whereLabel}
                value={location}
                placeholder={wherePlaceholder}
                compactPlaceholder={whereCompactPlaceholder}
                activeField={activeField}
                onActivate={activateField}
                morphProgress={segmentMorph}
                compactLine
              />

              <div className="bg-border mx-0.5 h-4 w-px shrink-0" aria-hidden />

              <SearchSegment
                ref={(node) => {
                  segmentRefs.current.when = node;
                }}
                field="when"
                label="When"
                value={dateSummary}
                placeholder="Add dates"
                compactPlaceholder="Anytime"
                activeField={activeField}
                onActivate={activateField}
                morphProgress={segmentMorph}
                compactLine
              />

              {showWho ? (
                <>
                  <div className="bg-border mx-0.5 h-4 w-px shrink-0" aria-hidden />

                  <SearchSegment
                    ref={(node) => {
                      segmentRefs.current.who = node;
                    }}
                    field="who"
                    label="Who"
                    value={guestSummary}
                    placeholder="Add guests"
                    compactPlaceholder="Add guests"
                    activeField={activeField}
                    onActivate={activateField}
                    morphProgress={segmentMorph}
                    compactLine
                  />
                </>
              ) : null}

              <button
                type="button"
                onClick={handleSearch}
                aria-label="Search"
                className={cn(
                  'bg-primary-strong text-primary-foreground z-[2] ml-0.5 flex shrink-0 items-center justify-center rounded-full font-semibold shadow-md sm:ml-2',
                  'transition-colors hover:opacity-95'
                )}
                style={{
                  width: searchButtonSize,
                  height: searchButtonSize,
                  minWidth: searchButtonSize,
                  minHeight: searchButtonSize,
                }}
              >
                <Search
                  className="shrink-0"
                  aria-hidden
                  style={{
                    width: searchIconSize,
                    height: searchIconSize,
                  }}
                />
              </button>
            </div>
          ) : (
            <div className="flex w-full min-w-0 items-center">
              {activeField && pillBounds ? (
                <ActiveSegmentPill bounds={pillBounds} roundedClass={segmentPillRounded} />
              ) : null}
              <SearchSegment
                ref={(node) => {
                  segmentRefs.current.where = node;
                }}
                field="where"
                label={whereLabel}
                value={location}
                placeholder={wherePlaceholder}
                compactPlaceholder={whereCompactPlaceholder}
                activeField={activeField}
                onActivate={activateField}
                morphProgress={segmentMorph}
              />

              <div className="bg-border mx-3 hidden h-8 w-px shrink-0 sm:block" aria-hidden />

              <SearchSegment
                ref={(node) => {
                  segmentRefs.current.when = node;
                }}
                field="when"
                label="When"
                value={dateSummary}
                placeholder="Add dates"
                compactPlaceholder="Anytime"
                activeField={activeField}
                onActivate={activateField}
                morphProgress={segmentMorph}
              />

              {showWho ? (
                <>
                  <div className="bg-border mx-3 hidden h-8 w-px shrink-0 sm:block" aria-hidden />

                  <SearchSegment
                    ref={(node) => {
                      segmentRefs.current.who = node;
                    }}
                    field="who"
                    label="Who"
                    value={guestSummary}
                    placeholder="Add guests"
                    compactPlaceholder="Add guests"
                    activeField={activeField}
                    onActivate={activateField}
                    morphProgress={segmentMorph}
                    className="max-w-[11rem] lg:max-w-none"
                  />
                </>
              ) : null}

              <button
                type="button"
                onClick={handleSearch}
                aria-label="Search"
                className={cn(
                  'bg-primary-strong text-primary-foreground z-[2] ml-2 flex shrink-0 items-center justify-center rounded-full font-semibold shadow-md',
                  'transition-colors hover:opacity-95'
                )}
                style={{
                  width: searchButtonSize,
                  height: searchButtonSize,
                  minWidth: searchButtonSize,
                  minHeight: searchButtonSize,
                }}
              >
                <Search
                  className="shrink-0"
                  aria-hidden
                  style={{
                    width: searchIconSize,
                    height: searchIconSize,
                  }}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {activeField ? (
          <motion.div
            initial={
              hasOpenedRef.current
                ? false
                : {
                    opacity: 0,
                    left: dropdownLayout.left,
                    top: dropdownLayout.top,
                    width: dropdownLayout.width,
                    height: dropdownLayout.height,
                  }
            }
            animate={{
              opacity: 1,
              left: dropdownLayout.left,
              top: dropdownLayout.top,
              width: dropdownLayout.width,
              height: dropdownLayout.height,
            }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={PANEL_SPRING}
            onAnimationComplete={() => {
              hasOpenedRef.current = true;
            }}
            className="border-border bg-card absolute z-50 overflow-hidden rounded-3xl border shadow-xl"
          >
            <div ref={contentRef} className="min-h-0 overflow-hidden">
              <motion.div
                key={activeField}
                className="shrink-0"
                style={
                  activeField === 'when' && layoutWidth >= 640
                    ? { width: whenPanelWidth, minWidth: whenPanelWidth }
                    : undefined
                }
                initial={{ opacity: 0, x: slideDirection >= 0 ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeField === 'where' ? (
                  <div className="p-4 sm:p-5">
                    <input
                      ref={locationInputRef}
                      type="text"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      onKeyDown={onWhereKeyDown}
                      placeholder={wherePlaceholder}
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={location.trim().length >= 2}
                      aria-controls="hero-search-suggestions"
                      aria-activedescendant={
                        suggestionIndex >= 0 ? `search-suggestion-${suggestionIndex}` : undefined
                      }
                      className="text-foreground placeholder:text-muted-foreground border-border focus:ring-primary/30 mb-4 w-full rounded-xl border bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2"
                    />
                    {location.trim().length >= 2 ? (
                      <div id="hero-search-suggestions" role="listbox">
                        <SearchSuggestionPanel
                          locations={suggestionData?.locations ?? []}
                          developments={suggestionData?.developments ?? []}
                          properties={suggestionData?.properties ?? []}
                          parkings={suggestionData?.parkings ?? []}
                          isLoading={suggestionsLoading}
                          query={location}
                          activeIndex={suggestionIndex}
                          onHighlight={setSuggestionIndex}
                          onSelect={selectSuggestion}
                          onSearchAnyway={handleSearchAllResults}
                          onViewCategory={viewSuggestionCategory}
                          preferType={preferType}
                        />
                      </div>
                    ) : (
                      <SearchSuggestedEmptyPanel
                        preferType={preferType}
                        onPickNearby={pickSuggestedNearby}
                        onPickDestination={pickSuggestedDestination}
                        onPickListing={pickSuggestedListing}
                      />
                    )}
                  </div>
                ) : null}

                {activeField === 'when' ? (
                  <div className="shrink-0 overflow-hidden">
                    <div className="px-4 py-4 sm:px-5">
                      <Suspense
                        fallback={
                          <Skeleton
                            className="h-[19rem] w-full rounded-xl"
                            aria-label="Loading calendar"
                          />
                        }
                      >
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={(range) => setDateRange(normalizeStayRange(range))}
                          numberOfMonths={effectiveCalendarMonths}
                          showOutsideDays={false}
                          navLayout="around"
                          weekStartsOn={0}
                          disabled={{ before: new Date() }}
                          className="hero-search-calendar"
                          classNames={heroSearchCalendarClassNames(effectiveCalendarMonths)}
                        />
                      </Suspense>
                    </div>
                    {hasStaySpan ? (
                      <FlexDateChips
                        value={dateFlex}
                        onChange={setDateFlex}
                        className="px-4 pb-3 sm:px-5"
                      />
                    ) : null}
                    <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
                      <button
                        type="button"
                        onClick={() => {
                          setDateRange(undefined);
                          setDateFlex(0);
                        }}
                        className="text-muted-foreground hover:text-foreground text-sm font-medium underline-offset-4 hover:underline"
                      >
                        Clear dates
                      </button>
                      <button
                        type="button"
                        onClick={() => (showWho ? setActiveField('who') : handleSearch())}
                        className="bg-primary-strong text-primary-foreground min-h-[44px] rounded-full px-5 text-sm font-semibold"
                      >
                        {showWho ? 'Next' : 'Search'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {activeField === 'who' && showWho ? (
                  <div className="divide-border divide-y px-5 pb-2">
                    <GuestRow
                      label="Adults"
                      subtitle="Ages 13 or above"
                      value={guests.adults}
                      min={1}
                      onDecrement={() => updateGuest('adults', -1)}
                      onIncrement={() => updateGuest('adults', 1)}
                    />
                    <GuestRow
                      label="Children"
                      subtitle="Ages 2 – 12"
                      value={guests.children}
                      onDecrement={() => updateGuest('children', -1)}
                      onIncrement={() => updateGuest('children', 1)}
                    />
                    <GuestRow
                      label="Pets"
                      value={guests.pets}
                      onDecrement={() => updateGuest('pets', -1)}
                      onIncrement={() => updateGuest('pets', 1)}
                    />
                  </div>
                ) : null}
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
