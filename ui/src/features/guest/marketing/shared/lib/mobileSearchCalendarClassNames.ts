import { cn } from '@/lib/utils';

/**
 * Phone full-screen search calendar classes. Only the lazy `MobileSearchSteps` chunk imports
 * this module, so it stays out of the landing entry (the desktop panel classes live in
 * `heroSearchCalendarClassNames.ts`, which the eager hero needs).
 */

/** Months stacked in the phone full-screen search. */
export const MOBILE_SEARCH_CALENDAR_MONTHS = 12;

const mobileEndpoint = cn(
  '[&>button]:bg-primary-strong [&>button]:text-primary-foreground',
  '[&>button:hover]:ring-0'
);

/**
 * One column of months that scrolls vertically under a sticky weekday row (rendered by the
 * caller, so `weekdays` is hidden here). Range ends are filled circles on the strong brand
 * token; the nights in between sit on a light band that runs into the end circles. Pass
 * `hasSpan` only when check-in and check-out differ, so a lone check-in pick does not draw a
 * half band to nowhere.
 */
export function heroSearchMobileCalendarClassNames(hasSpan: boolean) {
  return {
    root: 'w-full',
    months: 'flex flex-col gap-7',
    month: 'flex flex-col gap-1',
    month_caption: 'flex h-11 items-center px-1.5',
    caption_label: 'text-foreground text-base font-semibold',
    nav: 'hidden',
    month_grid: 'w-full border-collapse',
    weekdays: 'hidden',
    weeks: 'flex flex-col gap-1',
    week: 'grid grid-cols-7',
    day: 'relative flex h-12 items-center justify-center p-0 text-center',
    day_button: cn(
      'text-foreground relative z-[1] inline-flex size-11 items-center justify-center rounded-full',
      'text-[15px] font-medium transition-[background-color,box-shadow] duration-150',
      'hover:ring-foreground hover:ring-1',
      'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2'
    ),
    selected: '',
    range_start: cn(
      mobileEndpoint,
      hasSpan && 'bg-[linear-gradient(to_right,transparent_50%,hsl(var(--primary)/0.12)_50%)]'
    ),
    range_end: cn(
      mobileEndpoint,
      hasSpan && 'bg-[linear-gradient(to_left,transparent_50%,hsl(var(--primary)/0.12)_50%)]'
    ),
    range_middle: 'bg-primary/[0.12]',
    today: '[&>button]:font-bold',
    outside: 'pointer-events-none invisible',
    disabled: cn(
      'pointer-events-none',
      '[&>button]:text-muted-foreground/50 [&>button]:line-through [&>button]:decoration-1'
    ),
    hidden: 'invisible',
  };
}
