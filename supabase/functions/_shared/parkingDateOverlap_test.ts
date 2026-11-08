import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { parkingDatesOverlap, toIsoParkingDate } from './parkingDateOverlap.ts';

Deno.test('parkingDatesOverlap: same-day turnover is not an overlap', () => {
  assertEquals(parkingDatesOverlap('08-25-2026', '08-27-2026', '08-27-2026', '08-29-2026'), false);
});

Deno.test('parkingDatesOverlap: shared night is an overlap', () => {
  assert(parkingDatesOverlap('08-25-2026', '08-27-2026', '08-26-2026', '08-28-2026'));
});

Deno.test('toIsoParkingDate: converts the storage format', () => {
  assertEquals(toIsoParkingDate('08-25-2026'), '2026-08-25');
  assertEquals(toIsoParkingDate('2026-08-25'), '2026-08-25');
});

Deno.test('toIsoParkingDate: blocked-date checks receive a parseable key', () => {
  // Regression: the broadcast candidate check passed MM-DD-YYYY straight into a helper that
  // only accepts YYYY-MM-DD, so owner blocks were silently ignored.
  assertEquals(toIsoParkingDate('12-31-2026'), '2026-12-31');
});
