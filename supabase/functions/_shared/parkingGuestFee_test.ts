import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  checkParkingNoLoss,
  computeGuestFee,
  computeParkingChargeBreakdown,
  type ParkingFeeSettings,
} from './parkingGuestFee.ts';

const DEFAULTS: ParkingFeeSettings = {
  commissionPct: 0.1,
  directCommissionPct: 0.05,
  guestFeePct: 0.05,
  guestFeeFixed: 15,
  paymentFeePct: 0.03125,
  paymentFeeFixed: 15,
};

function breakdown(hostGross: number, commissionPct = DEFAULTS.commissionPct) {
  return computeParkingChargeBreakdown({ ...DEFAULTS, hostGrossTotal: hostGross, commissionPct });
}

Deno.test('guest pays host gross plus the fee, host nets gross minus commission', () => {
  const b = breakdown(300);
  assertEquals(b.guestFeeTotal, 30);
  assertEquals(b.guestChargeTotal, 330);
  assertEquals(b.commissionAmount, 30);
  assertEquals(b.hostNetTotal, 270);
  assertEquals(b.paymentFeeAmount, 25.31);
  assertEquals(b.platformNetTotal, 34.69);
});

Deno.test('platform net is positive at the ₱100 minimum on both channels', () => {
  assertEquals(breakdown(100).platformNetTotal, 11.25);
  assertEquals(breakdown(100, DEFAULTS.directCommissionPct).platformNetTotal, 6.25);
});

Deno.test('platform net stays positive across rates with default settings', () => {
  for (const rate of [100, 150, 250, 400, 999, 5000, 50_000, 999_999]) {
    assert(breakdown(rate).platformNetTotal > 0, `std ${rate}`);
    assert(breakdown(rate, DEFAULTS.directCommissionPct).platformNetTotal > 0, `direct ${rate}`);
  }
});

Deno.test('the fixed fee is charged once per booking, not per night', () => {
  // 3 nights at ₱300 is one ₱900 gross: fee = 900 × 5% + 15 = 60.
  assertEquals(breakdown(900).guestFeeTotal, 60);
});

Deno.test('no fee on a zero gross', () => {
  assertEquals(computeGuestFee(0, 0.05, 15), 0);
  assertEquals(breakdown(0).guestChargeTotal, 0);
});

Deno.test('defaults pass the no-loss check', () => {
  assertEquals(checkParkingNoLoss(DEFAULTS), { ok: true });
});

Deno.test('commission only (no guest fee) is a loss at ₱100', () => {
  const result = checkParkingNoLoss({ ...DEFAULTS, guestFeePct: 0, guestFeeFixed: 0 });
  assertEquals(result.ok, false);
});

Deno.test('a negative slope is rejected even when the minimum rate is fine', () => {
  const result = checkParkingNoLoss({
    ...DEFAULTS,
    commissionPct: 0,
    directCommissionPct: 0,
    guestFeePct: 0.01,
    guestFeeFixed: 500,
  });
  assertEquals(result.ok, false);
});

Deno.test('a lower direct commission is checked on its own channel', () => {
  // Standard still clears ₱100 (+₱6.41); direct with no commission loses ₱3.59.
  const result = checkParkingNoLoss({ ...DEFAULTS, directCommissionPct: 0, guestFeeFixed: 10 });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.channel, 'direct_link');
});

Deno.test('host nightly rate: below ₱100 is rejected, ₱100 and very high rates are accepted', async () => {
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
  const { validateMoneyField } = await import('./parkingPricing.ts');
  assertEquals(validateMoneyField(99, 'Weekday rate'), 'Weekday rate must be at least ₱100');
  assertEquals(validateMoneyField(0, 'Weekday rate'), 'Weekday rate must be at least ₱100');
  assertEquals(validateMoneyField(-5, 'Weekday rate'), 'Weekday rate must be at least ₱100');
  assertEquals(validateMoneyField('abc', 'Weekday rate'), 'Weekday rate must be a number');
  assertEquals(validateMoneyField(100, 'Weekday rate'), 100);
  assertEquals(validateMoneyField(325, 'Weekday rate'), 325);
  assertEquals(validateMoneyField(50_000, 'Weekday rate'), 50_000);
  assertEquals(validateMoneyField(undefined, 'Weekday rate'), null);
});

Deno.test('the PayMongo amount equals host gross plus the guest fee, to the centavo', async () => {
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
  const { phpToCentavos } = await import('./paymongoClient.ts');
  // One night, multi-night totals and an odd host rate.
  for (const hostGross of [100, 325, 900, 1_237, 4_800, 50_000]) {
    const b = breakdown(hostGross);
    assertEquals(
      phpToCentavos(b.guestChargeTotal),
      phpToCentavos(b.hostGrossTotal) + phpToCentavos(b.guestFeeTotal),
      `charge ${hostGross}`
    );
    assertEquals(b.hostGrossTotal + b.guestFeeTotal, b.guestChargeTotal, `sum ${hostGross}`);
  }
});
