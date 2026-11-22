import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  parkingPayoutEligibleAt,
  parkingPayoutHoldError,
  parkingRefundAmountError,
} from './parkingPayoutRules.ts';

Deno.test('parking refund rejects non-positive and over-charge amounts', () => {
  assertEquals(parkingRefundAmountError(0, 700), 'amount must be a positive number');
  assertEquals(parkingRefundAmountError(-1, 700), 'amount must be a positive number');
  assertEquals(parkingRefundAmountError(700.01, 700), 'amount cannot exceed the guest charge');
  assertEquals(parkingRefundAmountError(700, 700), null);
  assertEquals(parkingRefundAmountError(350, 700), null);
});

Deno.test('parking payout: eligible 24 hours after a Manila 14:00 start', () => {
  const eligible = parkingPayoutEligibleAt('2026-11-20');
  assertEquals(eligible?.toISOString(), '2026-11-21T06:00:00.000Z');
  assertEquals(parkingPayoutEligibleAt('11-20-2026')?.toISOString(), '2026-11-21T06:00:00.000Z');
});

Deno.test('parking payout: hold error before eligibility, cleared after', () => {
  const before = new Date('2026-11-21T05:59:59.000Z');
  const after = new Date('2026-11-21T06:00:00.000Z');
  assertEquals(
    parkingPayoutHoldError({ startDate: '2026-11-20', now: before })?.includes('held until'),
    true
  );
  assertEquals(parkingPayoutHoldError({ startDate: '2026-11-20', now: after }), null);
});

Deno.test('parking payout: a missing or malformed start date is held for review', () => {
  assertEquals(parkingPayoutEligibleAt(null), null);
  assertEquals(parkingPayoutEligibleAt('not-a-date'), null);
  assertEquals(
    parkingPayoutHoldError({ startDate: null })?.includes('start date is recorded'),
    true
  );
  assertEquals(
    parkingPayoutHoldError({ startDate: 'not-a-date' })?.includes('could not be read'),
    true
  );
});
