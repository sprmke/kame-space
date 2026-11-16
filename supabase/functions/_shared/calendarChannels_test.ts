import {
  assertEquals,
  assertFalse,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  CALENDAR_CHANNELS,
  calendarChannel,
  connectableCalendarProviders,
  isCalendarProvider,
  hostMatchesChannelSuffix,
} from './calendarChannels.ts';

Deno.test('every channel entry has every field', () => {
  for (const channel of CALENDAR_CHANNELS) {
    assertEquals(typeof channel.provider, 'string');
    assertEquals(typeof channel.label, 'string');
    assertEquals(typeof channel.bookingSource, 'string');
    assertEquals(typeof channel.placeholderGuestName, 'string');
    assertEquals(typeof channel.enabledForNewConnections, 'boolean');
    assertEquals(typeof channel.pendingPhase0, 'boolean');
    assertEquals(Array.isArray(channel.hostSuffixes) && channel.hostSuffixes.length > 0, true);
  }
});

Deno.test('provider keys match the database CHECK lists', () => {
  // supabase/migrations: property_calendar_feeds.provider + guest_submissions.external_source
  const stored = ['airbnb', 'agoda', 'booking_com'];
  assertEquals(CALENDAR_CHANNELS.map((c) => c.provider).sort(), stored.slice().sort());
});

Deno.test('registry baseline: only Airbnb is connectable; the rollout env opens the rest', () => {
  assertEquals(connectableCalendarProviders(), ['airbnb']);
  assertFalse(calendarChannel('agoda').enabledForNewConnections);
});

Deno.test('agoda and booking_com keep a per-channel availability key', () => {
  assertEquals(calendarChannel('agoda').availabilityKey, 'pricing.channel_sync.agoda');
  assertEquals(calendarChannel('booking_com').availabilityKey, 'pricing.channel_sync.booking_com');
  assertEquals(calendarChannel('airbnb').availabilityKey, 'pricing.channel_sync.airbnb');
});

Deno.test('unknown provider throws instead of guessing', () => {
  assertThrows(() => calendarChannel('expedia' as never));
});

Deno.test('host matching accepts subdomains and rejects lookalikes', () => {
  assertEquals(hostMatchesChannelSuffix('ical.booking.com', ['booking.com']), true);
  assertFalse(hostMatchesChannelSuffix('booking.com.evil.io', ['booking.com']));
  assertFalse(hostMatchesChannelSuffix('evilbooking.com', ['booking.com']));
  assertFalse(hostMatchesChannelSuffix('anything.test', ['booking.com']));
});

Deno.test('only Airbnb, Agoda and Booking.com are supported channels', () => {
  assertEquals(
    CALENDAR_CHANNELS.map((c) => c.provider),
    ['airbnb', 'agoda', 'booking_com']
  );
  for (const gone of ['vrbo', 'other', 'expedia', '']) {
    assertFalse(isCalendarProvider(gone), gone);
  }
  assertThrows(() => calendarChannel('vrbo' as never));
});

Deno.test('only Airbnb creates bookings by default; Agoda and Booking.com cannot tell a closed date from a stay yet', () => {
  assertEquals(calendarChannel('airbnb').createBookingsDefault, true);
  assertEquals(calendarChannel('agoda').createBookingsDefault, false);
  assertEquals(calendarChannel('booking_com').createBookingsDefault, false);
});
