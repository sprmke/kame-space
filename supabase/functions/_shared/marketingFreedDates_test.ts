import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  FREED_DATES_HORIZON_DAYS,
  freedNightsInWindow,
  freedWindowDays,
  manilaMinuteOfDay,
  nextFreedDatesSlot,
} from './marketingFreedDates.ts';

Deno.test('freedNightsInWindow: half-open, check-out exclusive', () => {
  assertEquals(
    freedNightsInWindow({
      checkInYmd: '2026-11-13',
      checkOutYmd: '2026-11-16',
      todayYmd: '2026-11-09',
    }),
    ['2026-11-13', '2026-11-14', '2026-11-15']
  );
});

Deno.test('freedNightsInWindow: drops nights already in the past', () => {
  assertEquals(
    freedNightsInWindow({
      checkInYmd: '2026-11-05',
      checkOutYmd: '2026-11-12',
      todayYmd: '2026-11-09',
    }),
    ['2026-11-09', '2026-11-10', '2026-11-11']
  );
});

Deno.test('freedNightsInWindow: drops nights past the horizon', () => {
  const nights = freedNightsInWindow({
    checkInYmd: '2026-11-09',
    checkOutYmd: '2027-02-01',
    todayYmd: '2026-11-09',
  });
  assertEquals(nights.length, FREED_DATES_HORIZON_DAYS + 1);
  assert(nights[nights.length - 1] <= '2026-12-09');
});

Deno.test('freedNightsInWindow: an already-past stay frees nothing', () => {
  assertEquals(
    freedNightsInWindow({
      checkInYmd: '2026-10-01',
      checkOutYmd: '2026-10-05',
      todayYmd: '2026-11-09',
    }),
    []
  );
});

Deno.test('nextFreedDatesSlot: morning goes out at 09:00 today', () => {
  // 00:30 UTC = 08:30 Manila
  assertEquals(nextFreedDatesSlot(new Date('2026-11-09T00:30:00.000Z')), '2026-11-09T09:00:00+08:00');
});

Deno.test('nextFreedDatesSlot: afternoon goes out at 19:00 today', () => {
  // 06:00 UTC = 14:00 Manila
  assertEquals(nextFreedDatesSlot(new Date('2026-11-09T06:00:00.000Z')), '2026-11-09T19:00:00+08:00');
});

Deno.test('nextFreedDatesSlot: after the evening window goes out tomorrow morning', () => {
  // 12:30 UTC = 20:30 Manila
  assertEquals(nextFreedDatesSlot(new Date('2026-11-09T12:30:00.000Z')), '2026-11-10T09:00:00+08:00');
});

Deno.test('manilaMinuteOfDay: converts to the Manila clock', () => {
  assertEquals(manilaMinuteOfDay(new Date('2026-11-09T00:00:00.000Z')), 8 * 60);
});

Deno.test('freedWindowDays: days from today to the last freed night', () => {
  assertEquals(freedWindowDays(['2026-11-13', '2026-11-15'], '2026-11-09'), 6);
  assertEquals(freedWindowDays([], '2026-11-09'), 0);
});
