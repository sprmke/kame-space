import { Link } from 'react-router-dom';

import { Luggage } from 'lucide-react';

import { formatStayDateRange } from '@/utils/format/dates';

import { cn } from '@/lib/utils';

/**
 * "You have a trip here" banner on a property listing.
 *
 * A signed-in guest with a stay at this property sees where their booking is and a link to
 * it, instead of only a Reserve button (plan 2.6, finding A5). Reserve stays for new dates.
 */
export function PropertyExistingTripBanner({
  tripPath,
  checkInDate,
  checkOutDate,
  className,
}: {
  /** Trip page path. The banner is hidden when there is nothing to link to. */
  tripPath: string | null;
  /** YYYY-MM-DD */
  checkInDate: string;
  /** YYYY-MM-DD */
  checkOutDate: string;
  className?: string;
}) {
  const path = tripPath?.trim() ?? '';
  if (!path) return null;
  const dates = formatStayDateRange(checkInDate, checkOutDate);

  return (
    <div
      className={cn(
        'border-primary/25 bg-primary/[0.06] flex items-center gap-3 rounded-2xl border px-4 py-3',
        className
      )}
    >
      <Luggage className="text-primary size-5 shrink-0" aria-hidden />
      {/* Two lines: a date range kept on one line reads better than breaking at the dash. */}
      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-sm font-semibold">You have a trip here</span>
        {dates ? (
          <span className="text-muted-foreground block truncate text-xs">{dates}</span>
        ) : null}
      </span>
      <Link
        to={path}
        className="text-primary inline-flex min-h-[44px] shrink-0 items-center text-sm font-semibold"
      >
        View trip
      </Link>
    </div>
  );
}
