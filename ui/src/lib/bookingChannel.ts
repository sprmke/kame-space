/**
 * One booking-channel vocabulary for the whole app.
 * Hand mirror of `supabase/functions/_shared/bookingChannel.ts`.
 * Keep in sync — enforced by `bookingChannelParity.test.ts`.
 *
 * Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.6
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

export function canonicalBookingSource(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return 'Direct';
  const alias = ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
}

export function isOtaPrepaidSource(source: unknown): boolean {
  const canonical = canonicalBookingSource(typeof source === 'string' ? source : null);
  return (OTA_PREPAID_SOURCES as readonly string[]).includes(canonical);
}

export function bookingChannelLabel(source: string | null | undefined): string {
  return canonicalBookingSource(source);
}
