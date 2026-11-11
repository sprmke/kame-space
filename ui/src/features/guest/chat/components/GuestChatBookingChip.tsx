import { Link } from 'react-router-dom';

import { guestJourneyStatusWord } from '@/features/guest/trip/lib/guestJourneyCopy';

import { formatStayDateRange } from '@/utils/format/dates';

/**
 * "Dec 3-5 · Confirmed · View trip" under the host name.
 *
 * The guest always knows which stay a conversation is about, using the same status word as
 * the trip page and every email (plan 5.3).
 */
export function GuestChatBookingChip({
  tripPath,
  checkInDate,
  checkOutDate,
  status,
}: {
  /** Relative trip path. The chip renders nothing without it. */
  tripPath: string | null;
  /** YYYY-MM-DD */
  checkInDate: string | null;
  /** YYYY-MM-DD */
  checkOutDate: string | null;
  status: string | null;
}) {
  const path = tripPath?.trim() ?? '';
  if (!path) return null;

  const dates = checkInDate && checkOutDate ? formatStayDateRange(checkInDate, checkOutDate) : '';
  const statusWord = status ? guestJourneyStatusWord(status) : '';

  return (
    <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1">
      {dates ? <span className="truncate">{dates}</span> : null}
      {dates && statusWord ? <span aria-hidden>·</span> : null}
      {statusWord ? <span className="shrink-0">{statusWord}</span> : null}
      <span aria-hidden>·</span>
      <Link to={path} className="text-foreground shrink-0 font-medium underline underline-offset-2">
        View trip
      </Link>
    </span>
  );
}
