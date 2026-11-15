import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';

import { format, startOfDay, startOfMonth } from 'date-fns';
import { Clock, Search, X } from 'lucide-react';

import {
  FlexDateChips,
  GuestRow,
} from '@/features/guest/marketing/shared/components/hero-search/HeroSearchParts';
import {
  normalizeStayRange,
  type GuestCounts,
} from '@/features/guest/marketing/shared/lib/heroSearchState';
import {
  heroSearchMobileCalendarClassNames,
  MOBILE_SEARCH_CALENDAR_MONTHS,
} from '@/features/guest/marketing/shared/lib/mobileSearchCalendarClassNames';
import { formatRecentSearchMeta } from '@/features/guest/marketing/shared/lib/mobileSearchDisplay';
import type { RecentSearch } from '@/features/guest/marketing/shared/lib/mobileSearchState';
import type { SearchFlexDays } from '@/features/guest/marketing/shared/lib/searchFlexDays';
import {
  SUGGESTION_LABEL_CLASS,
  SUGGESTION_ROW_CLASS,
  SUGGESTION_SUBTITLE_CLASS,
  SUGGESTION_TILE_CLASS,
  SUGGESTION_TITLE_CLASS,
} from '@/features/guest/search/lib/suggestionRowStyles';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { DateRange } from 'react-day-picker';
import type { MonthCaptionProps } from 'react-day-picker';

/** Same lazy chunk as the desktop panel (`HeroSearch` prefetches it when idle). */
const Calendar = lazy(() =>
  import('@/components/ui/calendar').then((m) => ({ default: m.Calendar }))
);

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function MobileStepTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="text-foreground text-[1.375rem] font-semibold leading-tight tracking-[-0.02em]"
    >
      {children}
    </h2>
  );
}

/* --------------------------------------------------------------------------------------------- */

type WhereStepProps = {
  title: string;
  value: string;
  placeholder: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  activeDescendant?: string;
  /** Typeahead results (2+ characters typed). */
  liveContent: ReactNode | null;
  /** Recents + suggestions when the field is empty. */
  idleContent: ReactNode;
};

export function MobileWhereStep({
  title,
  value,
  placeholder,
  inputRef,
  onChange,
  onKeyDown,
  onSubmit,
  activeDescendant,
  liveContent,
  idleContent,
}: WhereStepProps) {
  return (
    <div className="flex flex-col gap-4 px-4 pb-3 pt-5">
      <div className="px-1">
        <MobileStepTitle id="mobile-search-where-title">{title}</MobileStepTitle>
      </div>
      <form
        role="search"
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Search
          className="text-foreground pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-labelledby="mobile-search-where-title"
          aria-expanded={liveContent !== null}
          aria-controls="mobile-search-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={activeDescendant}
          className={cn(
            'border-border bg-background text-foreground h-14 w-full rounded-xl border pl-11 pr-12',
            'placeholder:text-muted-foreground text-base font-medium placeholder:font-normal',
            'focus:border-foreground transition-[border-color,box-shadow] focus:outline-none',
            'focus-visible:ring-foreground/10 focus-visible:ring-4'
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            aria-label="Clear"
            className="bg-muted text-foreground hover:bg-muted/70 absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors before:absolute before:-inset-1.5 before:content-['']"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </form>
      {liveContent !== null ? (
        <div id="mobile-search-suggestions" role="listbox" aria-label="Suggestions">
          {liveContent}
        </div>
      ) : (
        <div className="-mx-1 flex flex-col gap-4">{idleContent}</div>
      )}
    </div>
  );
}

export function MobileRecentSearches({
  items,
  onPick,
}: {
  items: RecentSearch[];
  onPick: (item: RecentSearch) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="mobile-recent-searches">
      <p id="mobile-recent-searches" className={SUGGESTION_TITLE_CLASS.sheet}>
        Recent searches
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={`${item.where}|${item.checkIn}|${item.checkOut}|${item.type}`}>
            <button
              type="button"
              onClick={() => onPick(item)}
              className={SUGGESTION_ROW_CLASS.sheet}
            >
              <span className={SUGGESTION_TILE_CLASS.sheet}>
                <Clock className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className={SUGGESTION_LABEL_CLASS.sheet}>{item.where || 'Anywhere'}</span>
                <span className={SUGGESTION_SUBTITLE_CLASS.sheet}>
                  {formatRecentSearchMeta(item)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------------------------------------------- */

function MonthCaption({ calendarMonth, displayIndex: _displayIndex, ...rest }: MonthCaptionProps) {
  return <div {...rest} data-month={format(calendarMonth.date, 'yyyy-MM')} />;
}

type WhenStepProps = {
  title: string;
  range: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  /** ± days chips, shown once a full stay is picked. */
  flex: SearchFlexDays;
  onFlexChange: (next: SearchFlexDays) => void;
  /** Right action: `Next` when a guest step follows, otherwise `Search`. */
  nextLabel: string;
  onNext: () => void;
  onSkip: () => void;
};

export function MobileWhenStep({
  title,
  range,
  onRangeChange,
  flex,
  onFlexChange,
  nextLabel,
  onNext,
  onSkip,
}: WhenStepProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => startOfDay(new Date()), []);
  const firstMonth = useMemo(() => startOfMonth(today), [today]);
  const hasSpan = Boolean(range?.from && range.to && range.to.getTime() > range.from.getTime());
  const classNames = useMemo(() => heroSearchMobileCalendarClassNames(hasSpan), [hasSpan]);
  const initialMonthRef = useRef(range?.from ? format(range.from, 'yyyy-MM') : null);

  // Reopening with dates already picked: start the scroll at the check-in month.
  useEffect(() => {
    const target = initialMonthRef.current;
    if (!target) return;
    let frame = 0;
    let attempts = 0;
    const seek = () => {
      const root = scrollRef.current;
      const caption = root?.querySelector<HTMLElement>(`[data-month="${target}"]`);
      if (root && caption) {
        root.scrollTop = Math.max(0, caption.offsetTop - root.offsetTop - 8);
        return;
      }
      // The calendar chunk may still be loading.
      if ((attempts += 1) < 60) frame = window.requestAnimationFrame(seek);
    };
    frame = window.requestAnimationFrame(seek);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pt-5">
        <MobileStepTitle id="mobile-search-when-title">{title}</MobileStepTitle>
      </div>
      <div
        aria-hidden
        className="border-border text-muted-foreground mt-3 grid grid-cols-7 border-b px-4 pb-2 text-center text-xs font-medium"
      >
        {WEEKDAY_INITIALS.map((day, index) => (
          <span key={WEEKDAY_NAMES[index]}>{day}</span>
        ))}
      </div>
      <div
        ref={scrollRef}
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-1"
      >
        <Suspense
          fallback={
            <div className="space-y-3 pt-3" aria-label="Loading calendar" role="status">
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-[17rem] w-full rounded-2xl" />
            </div>
          }
        >
          <Calendar
            mode="range"
            resetOnSelect
            selected={range}
            onSelect={(next) => onRangeChange(normalizeStayRange(next))}
            numberOfMonths={MOBILE_SEARCH_CALENDAR_MONTHS}
            startMonth={firstMonth}
            defaultMonth={firstMonth}
            hideNavigation
            hideWeekdays
            showOutsideDays={false}
            weekStartsOn={0}
            disabled={{ before: today }}
            aria-labelledby="mobile-search-when-title"
            classNames={classNames}
            components={{ MonthCaption }}
          />
        </Suspense>
      </div>
      {hasSpan ? (
        <FlexDateChips
          value={flex}
          onChange={onFlexChange}
          className="border-border border-t px-5 py-3"
        />
      ) : null}
      <div className="border-border flex items-center justify-between gap-3 border-t px-5 py-3">
        {range?.from ? (
          <button
            type="button"
            onClick={() => onRangeChange(undefined)}
            className="text-foreground -ml-1 min-h-[44px] px-1 text-[15px] font-semibold underline underline-offset-4"
          >
            Reset
          </button>
        ) : (
          <button
            type="button"
            onClick={onSkip}
            className="text-foreground -ml-1 min-h-[44px] px-1 text-[15px] font-semibold underline underline-offset-4"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="bg-foreground text-background native-press h-12 min-w-[6.5rem] rounded-xl px-6 text-[15px] font-semibold transition-opacity hover:opacity-90"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- */

type WhoStepProps = {
  guests: GuestCounts;
  onChange: (key: 'adults' | 'children' | 'pets', delta: number) => void;
};

export function MobileWhoStep({ guests, onChange }: WhoStepProps) {
  return (
    <div className="px-5 pb-2 pt-5">
      <MobileStepTitle>Who&apos;s coming?</MobileStepTitle>
      <div className="divide-border mt-1 divide-y">
        <GuestRow
          size="lg"
          label="Adults"
          subtitle="Ages 13 or above"
          value={guests.adults}
          min={1}
          onDecrement={() => onChange('adults', -1)}
          onIncrement={() => onChange('adults', 1)}
        />
        <GuestRow
          size="lg"
          label="Children"
          subtitle="Ages 2 to 12"
          value={guests.children}
          onDecrement={() => onChange('children', -1)}
          onIncrement={() => onChange('children', 1)}
        />
        <GuestRow
          size="lg"
          label="Pets"
          value={guests.pets}
          max={5}
          onDecrement={() => onChange('pets', -1)}
          onIncrement={() => onChange('pets', 1)}
        />
      </div>
    </div>
  );
}
