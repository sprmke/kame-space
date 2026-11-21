import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  bookingHelpKindLabel,
  isBookingHelpKind,
  isWithinBookingHelpWindow,
} from './bookingHelp.ts';

Deno.test('booking help kinds are a closed set', () => {
  for (const kind of ['cant_get_in', 'not_as_described', 'unsafe', 'other']) {
    assertEquals(isBookingHelpKind(kind), true);
  }
  assertEquals(isBookingHelpKind('emergency'), false);
  assertEquals(isBookingHelpKind(null), false);
  assertEquals(bookingHelpKindLabel('cant_get_in'), "I can't get in");
  assertEquals(bookingHelpKindLabel('unsafe'), 'Unsafe or emergency');
});

Deno.test('the help window opens 24h before check-in and closes at check-out end', () => {
  // Check-in 2026-11-20 14:00 Manila = 06:00Z.
  const checkIn = new Date('2026-11-20T06:00:00.000Z');
  const dayBefore = new Date(checkIn.getTime() - 24 * 60 * 60 * 1000);
  const justBefore = new Date(dayBefore.getTime() - 1000);
  const checkOutEnd = new Date('2026-11-23T15:59:00.000Z'); // 23:59 Manila
  const afterCheckout = new Date('2026-11-23T16:00:00.000Z');

  assertEquals(
    isWithinBookingHelpWindow({
      checkInDate: '2026-11-20',
      checkOutDate: '2026-11-23',
      now: justBefore,
    }),
    false
  );
  assertEquals(
    isWithinBookingHelpWindow({
      checkInDate: '2026-11-20',
      checkOutDate: '2026-11-23',
      now: dayBefore,
    }),
    true
  );
  assertEquals(
    isWithinBookingHelpWindow({
      checkInDate: '2026-11-20',
      checkOutDate: '2026-11-23',
      now: checkIn,
    }),
    true
  );
  assertEquals(
    isWithinBookingHelpWindow({
      checkInDate: '2026-11-20',
      checkOutDate: '2026-11-23',
      now: checkOutEnd,
    }),
    true
  );
  assertEquals(
    isWithinBookingHelpWindow({
      checkInDate: '2026-11-20',
      checkOutDate: '2026-11-23',
      now: afterCheckout,
    }),
    false
  );
});

Deno.test('an unparseable booking window stays closed', () => {
  assertEquals(isWithinBookingHelpWindow({ checkInDate: '', checkOutDate: '' }), false);
  assertEquals(isWithinBookingHelpWindow({ checkInDate: 'bad', checkOutDate: 'bad' }), false);
});
