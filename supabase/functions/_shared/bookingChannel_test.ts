import { assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  BOOKING_SOURCES,
  OTA_PREPAID_SOURCES,
  bookingChannelLabel,
  canonicalBookingSource,
  isOtaPrepaidSource,
} from './bookingChannel.ts';

Deno.test('BOOKING_SOURCES holds every channel once', () => {
  assertEquals(BOOKING_SOURCES, ['Direct', 'Facebook', 'Airbnb', 'Agoda', 'Booking.com', 'Vrbo']);
  assertEquals(new Set(BOOKING_SOURCES).size, BOOKING_SOURCES.length);
});

Deno.test('canonicalBookingSource maps aliases and keeps unknown values', () => {
  assertEquals(canonicalBookingSource('airbnb'), 'Airbnb');
  assertEquals(canonicalBookingSource(' booking_com '), 'Booking.com');
  assertEquals(canonicalBookingSource('bookingcom'), 'Booking.com');
  // G4 regression: an unknown OTA must not become a direct booking on save.
  assertEquals(canonicalBookingSource('Expedia'), 'Expedia');
  assertEquals(canonicalBookingSource(null), 'Direct');
  assertEquals(canonicalBookingSource(''), 'Direct');
});

Deno.test('isOtaPrepaidSource covers every prepaid channel', () => {
  for (const source of OTA_PREPAID_SOURCES) {
    assertEquals(isOtaPrepaidSource(source), true);
    assertEquals(isOtaPrepaidSource(source.toUpperCase()), true);
  }
  assertFalse(isOtaPrepaidSource('Direct'));
  assertFalse(isOtaPrepaidSource('Facebook'));
  assertFalse(isOtaPrepaidSource(null));
});

Deno.test('bookingChannelLabel is the canonical label', () => {
  assertEquals(bookingChannelLabel('agoda'), 'Agoda');
  assertEquals(bookingChannelLabel('Booking.com'), 'Booking.com');
});
