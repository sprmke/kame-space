import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  didStampFirstView,
  guestTripViewGuestLabel,
  guestTripViewedNotification,
} from './guestTripView.ts';

Deno.test('guestTripViewGuestLabel - first name only, never a full name', () => {
  assertEquals(guestTripViewGuestLabel('Maria Santos'), 'Maria');
  assertEquals(guestTripViewGuestLabel('  Juan   Dela Cruz '), 'Juan');
  assertEquals(guestTripViewGuestLabel('Cher'), 'Cher');
});

Deno.test('guestTripViewGuestLabel - falls back when the booking has no name', () => {
  assertEquals(guestTripViewGuestLabel(null), 'Your guest');
  assertEquals(guestTripViewGuestLabel(undefined), 'Your guest');
  assertEquals(guestTripViewGuestLabel(''), 'Your guest');
  assertEquals(guestTripViewGuestLabel('   '), 'Your guest');
});

Deno.test('guestTripViewedNotification - names the guest and says what they can see', () => {
  const copy = guestTripViewedNotification({ guestName: 'Maria Santos' });
  assertEquals(copy.title, 'Maria opened their trip');
  assertEquals(copy.body, 'Dates, directions and balance are all on their trip page.');
});

Deno.test('guestTripViewedNotification - reads correctly without a name on file', () => {
  const copy = guestTripViewedNotification({ guestName: null });
  assertEquals(copy.title, 'Your guest opened their trip');
});

Deno.test('didStampFirstView - only the read that changed a row counts', () => {
  // PostgREST returns the changed rows: one row means this read established the first view.
  assertEquals(didStampFirstView([{ id: 'booking-1' }]), true);
  // Someone else stamped it first, so this is a revisit.
  assertEquals(didStampFirstView([]), false);
  assertEquals(didStampFirstView(null), false);
  assertEquals(didStampFirstView(undefined), false);
  assertEquals(didStampFirstView({ id: 'booking-1' }), false);
});
