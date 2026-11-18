import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  computePlanTotalPhp,
  computeTotalFromPricingParams,
  parsePricingSnapshot,
  pricingParamsFromPlan,
} from './planPricing.ts';

const plan = {
  price_php: 999,
  discount_percent: 20,
  volume_discount_tiers: [{ minProperties: 10, discountPercent: 37 }],
  volume_ramp_floor_php: 500,
  volume_ramp_at_count: 10,
};

Deno.test('snapshot params price the same as the plan row', () => {
  const params = pricingParamsFromPlan(plan);
  for (const count of [1, 2, 5, 10, 11, 25]) {
    assertEquals(computeTotalFromPricingParams(params, count), computePlanTotalPhp(plan, count));
  }
});

Deno.test('a locked snapshot keeps its price after the plan row changes', () => {
  const locked = pricingParamsFromPlan(plan);
  const repriced = { ...plan, price_php: 1299 };
  assertEquals(computeTotalFromPricingParams(locked, 2) < computePlanTotalPhp(repriced, 2), true);
});

Deno.test('parsePricingSnapshot round-trips and rejects junk', () => {
  const params = pricingParamsFromPlan(plan);
  assertEquals(parsePricingSnapshot(JSON.parse(JSON.stringify(params))), params);
  assertEquals(parsePricingSnapshot(null), null);
  assertEquals(parsePricingSnapshot({ pricePhp: 'x' }), null);
  assertEquals(parsePricingSnapshot({ pricePhp: -5 }), null);
});
