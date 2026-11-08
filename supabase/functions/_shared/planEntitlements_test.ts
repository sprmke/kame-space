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
