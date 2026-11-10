import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { parkingRefundAmountError } from './parkingPayoutRules.ts';

Deno.test('parking refund rejects non-positive and over-charge amounts', () => {
  assertEquals(parkingRefundAmountError(0, 700), 'amount must be a positive number');
  assertEquals(parkingRefundAmountError(-1, 700), 'amount must be a positive number');
  assertEquals(parkingRefundAmountError(700.01, 700), 'amount cannot exceed the guest charge');
  assertEquals(parkingRefundAmountError(700, 700), null);
  assertEquals(parkingRefundAmountError(350, 700), null);
});
