/**
 * The booking-linked urgent help window (SAFE-01), kept pure so the trip DTO and the
 * write path in `bookingHelp.ts` read the same rule.
 *
 * The window is 24 hours before check-in through the check-out day (Manila). Check-in is
 * the platform default 14:00 and check-out end is 23:59.
 */

import { manilaCheckInInstant } from './cancellationRefund.ts';

export function isWithinBookingHelpWindow(input: {
  checkInDate: string | null | undefined;
  checkOutDate: string | null | undefined;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const checkIn = manilaCheckInInstant(String(input.checkInDate ?? ''), '14:00');
  const checkOut = manilaCheckInInstant(String(input.checkOutDate ?? ''), '23:59');
  if (!checkIn || !checkOut) return false;
  return (
    now.getTime() >= checkIn.getTime() - 24 * 60 * 60 * 1000 && now.getTime() <= checkOut.getTime()
  );
}
