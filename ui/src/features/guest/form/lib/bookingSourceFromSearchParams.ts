import { canonicalBookingSource } from '@/lib/bookingChannel';

/**
 * Public guest-form handoff for OTA-branded copy + `bookingSource` on submit.
 * Use **`?source=airbnb`** (case-insensitive). Legacy **`?from=airbnb`** is migrated in
 * `GuestForm` to `source=airbnb` and stripped from the URL.
 */
export const BOOKING_SOURCE_OPTIONS = ['Direct', 'Facebook', 'Airbnb'] as const;
export type BookingSource = (typeof BOOKING_SOURCE_OPTIONS)[number];

/** Browser URL keys that must never be preserved across guest navigations or share links. */
export const STRIPPED_GUEST_QUERY_KEYS = [
  'from',
  'dev',
  'testing',
  'saveToDatabase',
  'saveImagesToStorage',
  'sendEmail',
  'updateGoogleCalendar',
  'updateGoogleSheets',
] as const;

/**
 * Storage-safe source. Known aliases map to their label; an unknown value is kept instead of
 * collapsing to `Direct`, so saving the edit form can never turn an Agoda or Booking.com stay
 * into a direct booking (and silently change its money rules).
 */
export function normalizeBookingSource(value: string | null | undefined): string {
  return canonicalBookingSource(value);
}

export function bookingSourceFromUrlSearchParams(sp: URLSearchParams): BookingSource {
  const v = sp.get('source')?.trim().toLowerCase();
  if (v === 'airbnb') return 'Airbnb';
  if (v === 'facebook') return 'Facebook';
  return 'Direct';
}

/** True when the URL still carries a deprecated guest/dev control query key. */
export function hasStrippedGuestQueryKeys(sp: URLSearchParams): boolean {
  return STRIPPED_GUEST_QUERY_KEYS.some((key) => sp.has(key));
}

/**
 * Removes deprecated guest URL keys (`from`, `dev`, `testing`, submit-form control flags).
 * Does not touch legitimate params (`property`, `source`, dates, `bookingId`, …).
 */
export function stripLegacyFromQueryParam(sp: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(sp);
  for (const key of STRIPPED_GUEST_QUERY_KEYS) {
    next.delete(key);
  }
  return next;
}
