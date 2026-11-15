/**
 * One place for channel facts: iCal sync.
 * Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.2
 *
 * Hand-mirrored at `ui/src/features/dashboard/pricing/lib/calendarChannels.ts`
 * (`calendarChannelsParity.test.ts` enforces it). Adding Vrbo later is one entry plus fixtures.
 *
 * Phase 1a ships Airbnb only. `agoda` is storeable and allowlisted but not connectable
 * (`enabledForNewConnections: false`) until Phase 0 answers its link format; Booking.com keeps
 * its existing allowlist and is equally not connectable from the UI.
 */

import type { FeatureAvailabilityKey } from './featureAvailabilityCatalog.ts';

export type CalendarFeedProvider = 'airbnb' | 'agoda' | 'booking_com' | 'vrbo' | 'other';

export interface CalendarChannelDefinition {
  provider: CalendarFeedProvider;
  /** Display label, also used in host-facing strings. */
  label: string;
  /** Stored `booking_source` / `find_us` value for bookings imported from this channel. */
  bookingSource: string;
  /** Allowed host suffixes for the imported feed URL. `null` = any public host (SSRF guard only). */
  hostSuffixes: string[] | null;
  /** Feature availability child key, or `null` when the module-level switch is enough. */
  availabilityKey: FeatureAvailabilityKey | null;
  /** Placeholder guest name when the channel sends no guest data (dates only). */
  placeholderGuestName: string;
  /** True once a host may connect this channel from the UI. */
  enabledForNewConnections: boolean;
  /** Facts the Phase 0 spike must still confirm with a real link. */
  pendingPhase0: boolean;
}

/** Active feeds allowed on one property (three channels plus headroom for a second listing). */
export const CALENDAR_FEED_LIMIT = 6;

export const CALENDAR_CHANNELS: readonly CalendarChannelDefinition[] = [
  {
    provider: 'airbnb',
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
    label: 'Booking.com',
    bookingSource: 'Booking.com',
    hostSuffixes: ['booking.com', 'admin.booking.com', 'ical.booking.com'],
    availabilityKey: 'pricing.channel_sync.booking_com',
    placeholderGuestName: 'Booking.com guest',
    enabledForNewConnections: false,
    pendingPhase0: true,
  },
  {
    provider: 'vrbo',
    label: 'Vrbo',
    bookingSource: 'Vrbo',
    hostSuffixes: ['vrbo.com', 'homeaway.com', 'abritel.fr', 'expediagroup.com'],
    availabilityKey: null,
    placeholderGuestName: 'Vrbo guest',
    enabledForNewConnections: false,
    pendingPhase0: true,
  },
  {
    provider: 'other',
    label: 'Other calendar',
    bookingSource: 'Direct',
    hostSuffixes: null,
    availabilityKey: null,
    placeholderGuestName: 'OTA guest',
    enabledForNewConnections: false,
    pendingPhase0: true,
  },
];

export function calendarChannel(provider: CalendarFeedProvider): CalendarChannelDefinition {
  const found = CALENDAR_CHANNELS.find((c) => c.provider === provider);
  if (!found) throw new Error(`Unknown calendar channel "${provider}"`);
  return found;
}

/** Providers a host may connect today. */
export function connectableCalendarProviders(): CalendarFeedProvider[] {
  return CALENDAR_CHANNELS.filter((c) => c.enabledForNewConnections).map((c) => c.provider);
}

export function hostMatchesChannelSuffix(
  host: string,
  suffixes: readonly string[] | null
): boolean {
  if (!suffixes) return true;
  const h = host.toLowerCase();
  return suffixes.some((s) => h === s || h.endsWith('.' + s));
}
