/** Parking stay-date overlap helpers. Dates are stored MM-DD-YYYY (see `guest_submissions`). */

/**
 * Normalizes either storage format to `YYYY-MM-DD`.
 * Parking guest rows are `MM-DD-YYYY`; blocked-date tables and UI query params are
 * `YYYY-MM-DD`. Passing the wrong one to `hasParkingBlockedNightsInRange` silently returns
 * `false` (its parser rejects the format), which is how owner blocks were skipped.
 */
export function toIsoParkingDate(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const [mm, dd, yyyy] = trimmed.split('-');
  if (!mm || !dd || !yyyy) return trimmed;
  return `${yyyy}-${mm}-${dd}`;
}

function parseMmDdYyyy(value: string): number {
  const [mm, dd, yyyy] = value.split('-');
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`).getTime();
}

/** Half-open interval overlap: [checkIn, checkOut). A same-day checkout/check-in does not conflict. */
export function parkingDatesOverlap(
  aCheckIn: string,
  aCheckOut: string,
  bCheckIn: string,
  bCheckOut: string
): boolean {
  const aStart = parseMmDdYyyy(aCheckIn);
  const aEnd = parseMmDdYyyy(aCheckOut);
  const bStart = parseMmDdYyyy(bCheckIn);
  const bEnd = parseMmDdYyyy(bCheckOut);
  return aStart < bEnd && aEnd > bStart;
}
