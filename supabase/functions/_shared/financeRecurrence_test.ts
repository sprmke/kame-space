import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  addDaysToIso,
  addRecurrenceInterval,
  generateRecurrenceDates,
} from './financeRecurrence.ts';

Deno.test('addRecurrenceInterval advances monthly', () => {
  assertEquals(addRecurrenceInterval('2026-01-15', 'monthly'), '2026-02-15');
});

Deno.test('generateRecurrenceDates produces inclusive range', () => {
  const dates = generateRecurrenceDates('2026-01-01', 'monthly', '2026-03-01');
  assertEquals(dates, ['2026-01-01', '2026-02-01', '2026-03-01']);
});

Deno.test('addDaysToIso shifts calendar days', () => {
  assertEquals(addDaysToIso('2026-01-31', 1), '2026-02-01');
});

// Month-end series must clamp to the last day of a short month, not roll over and skip it.
// The same dates are pinned in `ui/src/features/dashboard/finance/lib/recurrence.test.ts`;
// keep the two lists identical so the client preview and the real schedule cannot drift.
Deno.test('generateRecurrenceDates keeps every month of a series started on the 31st', () => {
  assertEquals(generateRecurrenceDates('2026-03-31', 'monthly', '2026-08-31'), [
    '2026-03-31',
    '2026-04-30',
    '2026-05-31',
    '2026-06-30',
    '2026-07-31',
    '2026-08-31',
  ]);
});

Deno.test('generateRecurrenceDates clamps quarterly and every-2-months series', () => {
  assertEquals(generateRecurrenceDates('2026-01-31', 'quarterly', '2026-10-31'), [
    '2026-01-31',
    '2026-04-30',
    '2026-07-31',
    '2026-10-31',
  ]);
  assertEquals(generateRecurrenceDates('2026-01-31', 'every_2_months', '2026-07-31'), [
    '2026-01-31',
    '2026-03-31',
    '2026-05-31',
    '2026-07-31',
  ]);
});

Deno.test('generateRecurrenceDates clamps every-6-months and leap-day yearly series', () => {
  assertEquals(generateRecurrenceDates('2026-01-31', 'every_6_months', '2027-01-31'), [
    '2026-01-31',
    '2026-07-31',
    '2027-01-31',
  ]);
  assertEquals(generateRecurrenceDates('2024-02-29', 'yearly', '2028-02-29'), [
    '2024-02-29',
    '2025-02-28',
    '2026-02-28',
    '2027-02-28',
    '2028-02-29',
  ]);
});
