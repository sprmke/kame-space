import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  addBillingMonths,
  computeUnusedCreditPhp,
  daysUntil,
  manilaDayOfMonth,
  nextPeriodEndAfter,
  periodRemaining,
} from './billingPeriod.ts';

// 12:00 Manila = 04:00Z
const manila = (iso: string) => new Date(`${iso}T12:00:00+08:00`);
const dayOf = (d: Date) => manilaDayOfMonth(d);

Deno.test('addBillingMonths keeps the anchor day through short months', () => {
  const jan31 = manila('2027-01-31');
  const feb = addBillingMonths(jan31, 31);
  assertEquals(dayOf(feb), 28);
  const mar = addBillingMonths(feb, 31);
  assertEquals(dayOf(mar), 31);
  const apr = addBillingMonths(mar, 31);
  assertEquals(dayOf(apr), 30);
});

Deno.test('addBillingMonths handles leap February and year rollover', () => {
  assertEquals(dayOf(addBillingMonths(manila('2028-01-31'), 31)), 29);
  const dec = manila('2026-12-15');
  const jan = addBillingMonths(dec, 15);
  assertEquals(jan.toISOString(), manila('2027-01-15').toISOString());
});

Deno.test('addBillingMonths without anchor uses the source day', () => {
  assertEquals(dayOf(addBillingMonths(manila('2027-03-10'))), 10);
});

Deno.test('addBillingMonths uses the Manila calendar day, not UTC', () => {
  // 2027-01-31 23:30 Manila is 2027-01-31 15:30Z; still the 31st in Manila.
  const lateManila = new Date('2027-01-31T15:30:00Z');
  assertEquals(manilaDayOfMonth(lateManila), 31);
  // 2027-01-31 17:00Z is already Feb 1 in Manila.
  assertEquals(manilaDayOfMonth(new Date('2027-01-31T17:00:00Z')), 1);
});

Deno.test('nextPeriodEndAfter catches up after an outage', () => {
  const start = manila('2027-01-10');
  const now = manila('2027-04-12');
  const end = nextPeriodEndAfter(start, 10, now);
  assertEquals(end.toISOString(), manila('2027-05-10').toISOString());
});

Deno.test('periodRemaining clamps and rounds up days', () => {
  const start = manila('2027-01-01');
  const end = manila('2027-01-31');
  const mid = periodRemaining(start, end, manila('2027-01-16'));
  assertEquals(mid.totalDays, 30);
  assertEquals(mid.remainingDays, 15);
  assertEquals(Math.round(mid.fraction * 100), 50);
  const before = periodRemaining(start, end, manila('2026-12-20'));
  assertEquals(before.fraction, 1);
  const after = periodRemaining(start, end, manila('2027-02-05'));
  assertEquals(after.fraction, 0);
  assertEquals(after.remainingDays, 0);
});

Deno.test('computeUnusedCreditPhp is proportional and never above what was paid', () => {
  const start = manila('2027-01-01');
  const end = manila('2027-01-31');
  assertEquals(
    computeUnusedCreditPhp({
      periodPaidPhp: 3000,
      periodStart: start,
      periodEnd: end,
      now: manila('2027-01-16'),
    }),
    1500
  );
  assertEquals(
    computeUnusedCreditPhp({
      periodPaidPhp: 3000,
      periodStart: start,
      periodEnd: end,
      now: manila('2026-12-01'),
    }),
    3000
  );
});

Deno.test('computeUnusedCreditPhp is zero for ended periods, trials and missing bounds', () => {
  const start = manila('2027-01-01');
  const end = manila('2027-01-31');
  const now = manila('2027-02-02');
  assertEquals(
    computeUnusedCreditPhp({ periodPaidPhp: 3000, periodStart: start, periodEnd: end, now }),
    0
  );
  assertEquals(
    computeUnusedCreditPhp({
      periodPaidPhp: 0,
      periodStart: start,
      periodEnd: end,
      now: manila('2027-01-10'),
    }),
    0
  );
  assertEquals(
    computeUnusedCreditPhp({ periodPaidPhp: 3000, periodStart: null, periodEnd: null, now }),
    0
  );
});

Deno.test('daysUntil rounds up partial days', () => {
  const now = new Date('2027-01-01T00:00:00Z');
  assertEquals(daysUntil(new Date('2027-01-01T06:00:00Z'), now), 1);
  assertEquals(daysUntil(new Date('2027-01-04T00:00:00Z'), now), 3);
  assertEquals(daysUntil(new Date('2026-12-30T00:00:00Z'), now), -2);
});
