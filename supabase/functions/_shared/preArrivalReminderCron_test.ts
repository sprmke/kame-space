/**
 * Pre-arrival reminder — the T-48h window.
 * Run: deno test supabase/functions/_shared/preArrivalReminderCron_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { addDaysYmd, isPreArrivalReminderDue, PRE_ARRIVAL_LEAD_DAYS } from './preArrivalReminderCron.ts';

Deno.test('the reminder leads check-in by two days', () => {
  assertEquals(PRE_ARRIVAL_LEAD_DAYS, 2);
});

Deno.test('isPreArrivalReminderDue - true exactly two days out', () => {
  assertEquals(isPreArrivalReminderDue('2026-12-12', '2026-12-10'), true);
});

Deno.test('isPreArrivalReminderDue - false a day either side', () => {
  assertEquals(isPreArrivalReminderDue('2026-12-11', '2026-12-10'), false);
  assertEquals(isPreArrivalReminderDue('2026-12-13', '2026-12-10'), false);
});

Deno.test('isPreArrivalReminderDue - accepts the stored MM-DD-YYYY form', () => {
  assertEquals(isPreArrivalReminderDue('12-12-2026', '2026-12-10'), true);
});

Deno.test('isPreArrivalReminderDue - unreadable dates are never due', () => {
  assertEquals(isPreArrivalReminderDue('', '2026-12-10'), false);
  assertEquals(isPreArrivalReminderDue('not-a-date', '2026-12-10'), false);
});

Deno.test('addDaysYmd - crosses a month and a year boundary', () => {
  assertEquals(addDaysYmd('2026-12-30', 2), '2027-01-01');
  assertEquals(addDaysYmd('2026-02-27', 2), '2026-03-01');
  assertEquals(addDaysYmd('garbage', 2), null);
});
