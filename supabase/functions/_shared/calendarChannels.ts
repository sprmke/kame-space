/**
 * One place for channel facts: iCal sync.
 * Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.2
 *
 * Hand-mirrored at `ui/src/features/dashboard/pricing/lib/calendarChannels.ts`
 * (`calendarChannelsParity.test.ts` enforces it).
 *
 * Kame Space supports exactly three channels: Airbnb, Agoda and Booking.com. Those are the
 * listing platforms Philippine hosts actually use. There is no Vrbo and no "other calendar":
 * every imported link must be on an allowlisted host, which also closes the open-fetch surface.
 *
 * `agoda` and `booking_com` are built but not connectable by default (`enabledForNewConnections:
 * false`); `calendarChannelRollout.ts` opens them per environment or per beta org.
 */

import type { FeatureAvailabilityKey } from './featureAvailabilityCatalog.ts';

/** The only channels Kame Space supports: the three that matter to Philippine hosts. */
export type CalendarFeedProvider = 'airbnb' | 'agoda' | 'booking_com';

export interface CalendarChannelDefinition {
  provider: CalendarFeedProvider;
  /** Display label, also used in host-facing strings. */
  label: string;
  /** Stored `booking_source` / `find_us` value for bookings imported from this channel. */
  bookingSource: string;
  /** Allowed host suffixes for the imported feed URL. Every channel has an allowlist. */
  hostSuffixes: string[];
  /** Feature availability child key, or `null` when the module-level switch is enough. */
  availabilityKey: FeatureAvailabilityKey | null;
  /** Placeholder guest name when the channel sends no guest data (dates only). */
  placeholderGuestName: string;
  /** True once a host may connect this channel from the UI. */
  enabledForNewConnections: boolean;
  /**
   * Whether a new feed turns imported stays into bookings. Only Airbnb tells a reservation from
   * a host block (`Reserved`). Agoda and Booking.com are off until Phase 0 shows they can, so a
   * closed date never becomes a placeholder booking by surprise.
   */
  createBookingsDefault: boolean;
  /** Facts the Phase 0 spike must still confirm with a real link. */
  pendingPhase0: boolean;
}

/** Active feeds allowed on one property (three channels plus headroom for a second listing). */
export const CALENDAR_FEED_LIMIT = 6;

export const CALENDAR_CHANNELS: readonly CalendarChannelDefinition[] = [
  {
    provider: 'airbnb',
    createBookingsDefault: true,
    label: 'Airbnb',
    bookingSource: 'Airbnb',
    hostSuffixes: ['airbnb.com', 'airbnb.co.uk', 'airbnb.ca', 'airbnb.com.au', 'muscache.com'],
    availabilityKey: 'pricing.channel_sync.airbnb',
    placeholderGuestName: 'Airbnb guest',
    enabledForNewConnections: true,
    pendingPhase0: false,
  },
  {
    provider: 'agoda',
    createBookingsDefault: false,
    label: 'Agoda',
    bookingSource: 'Agoda',
    hostSuffixes: ['agoda.com'],
    availabilityKey: 'pricing.channel_sync.agoda',
    placeholderGuestName: 'Agoda guest',
    enabledForNewConnections: false,
    pendingPhase0: true,
  },
  {
    provider: 'booking_com',
    createBookingsDefault: false,
    label: 'Booking.com',
    bookingSource: 'Booking.com',
    hostSuffixes: ['booking.com'],
    availabilityKey: 'pricing.channel_sync.booking_com',
    placeholderGuestName: 'Booking.com guest',
    enabledForNewConnections: false,
    pendingPhase0: true,
  },
];

/** Narrow an untrusted string (a stored row, a request body) to a supported channel. */
export function isCalendarProvider(value: unknown): value is CalendarFeedProvider {
  return CALENDAR_CHANNELS.some((c) => c.provider === value);
}

export function calendarChannel(provider: CalendarFeedProvider): CalendarChannelDefinition {
  const found = CALENDAR_CHANNELS.find((c) => c.provider === provider);
  if (!found) throw new Error(`Unknown calendar channel "${provider}"`);
  return found;
}

/** Providers a host may connect today. */
export function connectableCalendarProviders(): CalendarFeedProvider[] {
  return CALENDAR_CHANNELS.filter((c) => c.enabledForNewConnections).map((c) => c.provider);
}

export function hostMatchesChannelSuffix(host: string, suffixes: readonly string[]): boolean {
  const h = host.toLowerCase();
  return suffixes.some((s) => h === s || h.endsWith('.' + s));
}
