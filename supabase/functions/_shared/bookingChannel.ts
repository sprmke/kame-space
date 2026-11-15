/**
 * One booking-channel vocabulary for the whole app.
 * Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.6
 *
 * Hand-mirrored at `ui/src/lib/bookingChannel.ts` (`bookingChannelParity.test.ts` enforces it).
 *
 * The old `normalizeBookingSource` collapsed anything it did not recognise to `Direct`, which is
 * how an OTA booking becomes a direct booking on the first admin save and silently changes its
 * money rules. `canonicalBookingSource` keeps unknown values instead.
 */

export const BOOKING_SOURCES = [
  'Direct',
  'Facebook',
  'Airbnb',
  'Agoda',
  'Booking.com',
  'Vrbo',
] as const;

export type BookingChannelSource = (typeof BOOKING_SOURCES)[number];

/** Stored label -> OTA-prepaid behaviour. Airbnb was the only entry before this plan. */
export const OTA_PREPAID_SOURCES: readonly BookingChannelSource[] = [
  'Airbnb',
  'Agoda',
  'Booking.com',
  'Vrbo',
];

const ALIASES: Record<string, BookingChannelSource> = {
  direct: 'Direct',
  facebook: 'Facebook',
  fb: 'Facebook',
  airbnb: 'Airbnb',
  agoda: 'Agoda',
  'booking.com': 'Booking.com',
  booking_com: 'Booking.com',
  bookingcom: 'Booking.com',
  booking: 'Booking.com',
  vrbo: 'Vrbo',
};

/**
 * Canonical display/storage value. Blank -> `Direct`. A known alias -> its canonical label.
 * Anything else is returned trimmed and unchanged, never silently rewritten.
 */
export function canonicalBookingSource(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return 'Direct';
  const alias = ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
}

/** True when the guest already paid the channel, so no down payment or security deposit applies. */
export function isOtaPrepaidSource(source: unknown): boolean {
  const canonical = canonicalBookingSource(typeof source === 'string' ? source : null);
  return (OTA_PREPAID_SOURCES as readonly string[]).includes(canonical);
}

/** Host-facing label for a stored source. Unknown values pass through unchanged. */
export function bookingChannelLabel(source: string | null | undefined): string {
  return canonicalBookingSource(source);
}
