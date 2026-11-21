/**
 * Stay window vs the host's listing contract end (readiness ACC-11).
 *
 * `settings.listingAuthorization.contractEndDate` is the last night the host is authorized to
 * let. A stay whose **check-out** is after that date would run past the authorization, so it is
 * refused at submit and at an admin reschedule. A check-out on the contract end date is fine.
 */

import { checkInDateToIso } from './bookingsListSort.ts';
import { readListingAuthorizationFromSettings } from './listingAuthorization.ts';

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const iso = checkInDateToIso(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/** The contract end date as `YYYY-MM-DD`, or null when the listing has no contract window. */
export function contractEndDateForStay(
  settings: Record<string, unknown> | null | undefined
): string | null {
  return isoDate(readListingAuthorizationFromSettings(settings).contractEndDate);
}

/**
 * Null when the stay fits, otherwise the contract end date it exceeds. Malformed dates never
 * block a booking; the date validators own that error.
 */
export function stayBeyondContractEnd(input: {
  settings: Record<string, unknown> | null | undefined;
  checkOutDate: string | null | undefined;
}): string | null {
  const contractEnd = contractEndDateForStay(input.settings);
  const checkOut = isoDate(input.checkOutDate);
  if (!contractEnd || !checkOut) return null;
  return checkOut > contractEnd ? contractEnd : null;
}
