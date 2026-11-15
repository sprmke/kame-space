import { assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { isOtaPrepaidSource } from './bookingChannel.ts';
import { computeTotalGuestBalanceFromBooking } from './totalGuestBalance.ts';

Deno.test('every prepaid channel uses the OTA-prepaid balance rule', () => {
  assertEquals(isOtaPrepaidSource(' Airbnb '), true);
  assertEquals(isOtaPrepaidSource('Agoda'), true);
  assertEquals(isOtaPrepaidSource('booking_com'), true);
  assertEquals(isOtaPrepaidSource('Vrbo'), true);
  assertFalse(isOtaPrepaidSource('Facebook'));
  assertFalse(isOtaPrepaidSource(null));
});

Deno.test('Airbnb total excludes rate, down payment, and security deposit', () => {
  assertEquals(
    computeTotalGuestBalanceFromBooking({
      booking_rate: 10000,
      down_payment: 2000,
      security_deposit: 3000,
      guest_additional_fee: 200,
      booking_source: 'airbnb',
    }),
    200
  );
});
