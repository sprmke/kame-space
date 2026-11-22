import { cn } from '@/lib/utils';

/** Calendar + rates sidebar grid on property and parking pricing pages. */
export function pricingCalendarFormGridClassName(compactChrome: boolean): string {
  return cn(
    'grid grid-cols-1 gap-3 lg:items-start',
    compactChrome
      ? 'lg:grid-cols-[minmax(0,1fr)_minmax(12.5rem,16rem)] lg:gap-3'
      : 'lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5'
  );
}

export function pricingCalendarWeekGapClassName(compactChrome: boolean): string {
  return compactChrome ? 'gap-0.5 sm:gap-1' : 'gap-1.5 sm:gap-2';
}

/**
 * Leading/trailing adjacent-month pads. Same tile shape as in-month days
 * (price / markers / booked state live in the cell), dimmed below past
 * in-month opacity (`0.45`) so the focused month stays obvious.
 */
export function pricingCalendarOutsideCellClassName(compactChrome: boolean): string {
  return cn(
    'border-border/40 bg-card relative flex min-w-0 flex-col rounded-lg border text-left',
    'opacity-[0.36]',
    'sm:aspect-square',
    compactChrome
      ? 'min-h-[3rem] p-0.5 sm:min-h-[3.25rem]'
      : 'min-h-[3.5rem] p-1 sm:min-h-[4.5rem] sm:p-2'
  );
}

export function pricingRatesFormSurfaceClassName(compactChrome: boolean): string {
  return cn('surface-card', compactChrome ? 'p-3 sm:p-4' : 'p-4 sm:p-5');
}

export function pricingRatesFormStackClassName(compactChrome: boolean): string {
  return compactChrome ? 'space-y-4' : 'space-y-5';
}
