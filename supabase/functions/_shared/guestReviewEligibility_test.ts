import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { isOtaZeroSdBooking, resolveGuestReviewPath } from './guestReviewEligibility.ts';

Deno.test('zero-deposit OTA stays take the post-stay review path for every channel', () => {
  for (const source of ['Airbnb', 'Agoda', 'Booking.com']) {
    const row = { booking_source: source, security_deposit: 0, status: 'COMPLETED' };
    assertEquals(isOtaZeroSdBooking(row), true, source);
    assertEquals(resolveGuestReviewPath(row), 'airbnb_post_stay', source);
  }
});

Deno.test('direct stays and OTA stays with a deposit are not zero-deposit OTA stays', () => {
  assertEquals(isOtaZeroSdBooking({ booking_source: 'Direct', security_deposit: 0 }), false);
  assertEquals(isOtaZeroSdBooking({ booking_source: 'Agoda', security_deposit: 1500 }), false);
});
