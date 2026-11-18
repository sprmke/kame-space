import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * `planEntitlements.ts` pulls in the Supabase client through `databaseService.ts`, which
 * builds it in a static initializer. Placeholders only: nothing here connects.
 */
Deno.env.set('SUPABASE_URL', Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'test-key');
Deno.env.set('SUPABASE_ANON_KEY', Deno.env.get('SUPABASE_ANON_KEY') ?? 'test-anon-key');

const { PlanFeatureRequiredError, catchPlanFeatureError } = await import(
  '../_shared/planEntitlements.ts'
);

const REQ = new Request('http://127.0.0.1:54321/functions/v1/finance-ledger', { method: 'POST' });

Deno.test('PlanFeatureRequiredError marks the response as an upgrade hook', async () => {
  const error = new PlanFeatureRequiredError('financeReporting');

  assertEquals(error.upgradeHook, true);
  assertEquals(error.feature, 'financeReporting');
  assertEquals(error.name, 'PlanFeatureRequiredError');
  assertEquals(error.message.includes('financeReporting'), true);

  const response = catchPlanFeatureError(REQ, error);
  assertEquals(response?.status, 429);

  const body = (await response!.json()) as Record<string, unknown>;
  assertEquals(body.success, false);
  assertEquals(body.upgradeHook, true);
  assertEquals(body.feature, 'financeReporting');
});

Deno.test('PlanFeatureRequiredError keeps a caller-supplied message', async () => {
  const response = catchPlanFeatureError(REQ, new PlanFeatureRequiredError('calendarSync', 'Upgrade to sync'));

  const body = (await response!.json()) as Record<string, unknown>;
  assertEquals(body.error, 'Upgrade to sync');
});

Deno.test('catchPlanFeatureError ignores every other error', () => {
  assertEquals(catchPlanFeatureError(REQ, new Error('boom')), null);
  assertEquals(catchPlanFeatureError(REQ, { upgradeHook: true }), null);
  assertEquals(catchPlanFeatureError(REQ, null), null);
  assertEquals(catchPlanFeatureError(REQ, undefined), null);
});

// ─── Adding a property mid-period (preview and enrol share this math) ────────────

const { computeAddPropertyQuote } = await import('../_shared/planEntitlements.ts');
const { computePlanTotalPhp } = await import('../_shared/planPricing.ts');

const quotePlan = {
  price_php: 1000,
  discount_percent: 0,
  volume_discount_tiers: [],
  volume_ramp_floor_php: null,
  volume_ramp_at_count: null,
} as unknown as Parameters<typeof computeAddPropertyQuote>[0]['plan'];

const period = {
  periodStart: '2027-03-01T00:00:00.000Z',
  periodEnd: '2027-03-31T00:00:00.000Z',
};

Deno.test('add property: pays the prorated increase for the rest of a paid period', () => {
  const quote = computeAddPropertyQuote({
    priceOverridePhp: null,
    pricingSnapshot: null,
    plan: quotePlan,
    enrolledCount: 1,
    periodPaidPhp: 1000,
    ...period,
    now: new Date('2027-03-16T00:00:00.000Z'),
  });
  // Totals come from the shared pricing curve (volume ramp included), not a flat multiple.
  assertEquals(quote.totalBeforePhp, computePlanTotalPhp(quotePlan, 1));
  assertEquals(quote.totalAfterPhp, computePlanTotalPhp(quotePlan, 2));
  assertEquals(quote.totalAfterPhp > quote.totalBeforePhp, true);
  // Half the period is left, so half of the increase joins the next payment.
  assertEquals(quote.trueUpPhp, Math.round((quote.totalAfterPhp - quote.totalBeforePhp) / 2));
});

Deno.test('add property: no true-up for trials, admin grants or overridden prices', () => {
  const base = {
    pricingSnapshot: null,
    plan: quotePlan,
    enrolledCount: 1,
    ...period,
    now: new Date('2027-03-16T00:00:00.000Z'),
  };
  assertEquals(
    computeAddPropertyQuote({ ...base, priceOverridePhp: null, periodPaidPhp: 0 }).trueUpPhp,
    0
  );
  assertEquals(
    computeAddPropertyQuote({ ...base, priceOverridePhp: 5000, periodPaidPhp: 5000 }).trueUpPhp,
    0
  );
  // The override stays the price: adding a property never reprices a sales-assisted plan.
  assertEquals(
    computeAddPropertyQuote({ ...base, priceOverridePhp: 5000, periodPaidPhp: 5000 })
      .totalAfterPhp,
    5000
  );
});

Deno.test('add property: a period that already ended adds nothing to this payment', () => {
  const quote = computeAddPropertyQuote({
    priceOverridePhp: null,
    pricingSnapshot: null,
    plan: quotePlan,
    enrolledCount: 1,
    periodPaidPhp: 1000,
    ...period,
    now: new Date('2027-04-05T00:00:00.000Z'),
  });
  assertEquals(quote.trueUpPhp, 0);
});
