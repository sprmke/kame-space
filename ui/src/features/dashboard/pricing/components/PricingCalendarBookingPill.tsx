import type { CalendarOccupancySpanPosition } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { occupancySpanRoundedClass } from '@/features/dashboard/bookings/components/calendar/OccupancyCalendarView';
import { GuestAvatar } from '@/features/dashboard/bookings/components/GuestAvatar';
import { statusToneStyle } from '@/features/dashboard/bookings/components/StatusBadge';
import { statusLabel } from '@/features/dashboard/bookings/lib/bookingStatus';

import { cn } from '@/lib/utils';

type Props = {
  status: string;
  label: string;
  title?: string;
  spanPosition?: CalendarOccupancySpanPosition;
  showLabel?: boolean;
  guestName?: string;
  validIdUrl?: string | null;
};

/**
 * Booked stay pill on Pricing: same status-tone badge chrome as Bookings /
 * dashboard occupancy, with guest avatar + name kept for rate-calendar scan.
 */
export function PricingCalendarBookingPill({
  status,
  label,
  title,
  spanPosition = 'single',
  showLabel = true,
  guestName,
  validIdUrl,
}: Props) {
  const tone = statusToneStyle(status);
  const roundedClass = occupancySpanRoundedClass(spanPosition, false);
  const visibleLabel = showLabel && label.trim().length > 0;

  return (
    <div
      className={cn(
        /* Phone cells are short — keep pills in the ~20–22px band used by bookings calendar. */
        'flex h-5 w-full min-w-0 items-center overflow-hidden border shadow-sm sm:h-[22px]',
        tone.badge,
        roundedClass,
        /* Multi-week fragments: keep status border on outer edges only (no join seams) */
        spanPosition === 'middle' && 'border-x-0 shadow-none',
        spanPosition === 'start' && 'border-r-0',
        spanPosition === 'end' && 'border-l-0'
      )}
      title={title ?? `${label} · ${statusLabel(status)}`}
    >
      {visibleLabel ? (
        <span className="flex min-w-0 items-center gap-1 px-1.5 py-0 sm:gap-1.5 sm:px-2">
          <span
            aria-hidden
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              tone.dot,
              tone.pulse && 'motion-safe:animate-pulse'
            )}
          />
          <GuestAvatar
            name={guestName || label}
            validIdUrl={validIdUrl}
            size="xs"
            className="!size-3.5 !text-[8px] shadow-sm ring-1 ring-border/70 sm:!size-4 sm:!text-[9px]"
          />
          <span className="truncate text-[10px] font-semibold leading-none tracking-tight sm:text-[11px]">
            {label}
          </span>
        </span>
      ) : (
        <span aria-hidden className="block h-full w-full min-w-[0.5rem]" />
      )}
    </div>
  );
}
