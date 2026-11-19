import { platformDailyCostUsdCap } from './aiUsageService.ts';
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

Deno.test('platformDailyCostUsdCap defaults to 150', () => {
  Deno.env.delete('AI_PLATFORM_DAILY_COST_USD_CAP');
  assertEquals(platformDailyCostUsdCap(), 150);
});

Deno.test('platformDailyCostUsdCap reads env override', () => {
  Deno.env.set('AI_PLATFORM_DAILY_COST_USD_CAP', '200');
  assertEquals(platformDailyCostUsdCap(), 200);
  Deno.env.set('AI_PLATFORM_DAILY_COST_USD_CAP', '0');
  assertEquals(platformDailyCostUsdCap(), 0);
});

// ── PR-006: the platform ceiling is independent of the per-org quota switch ─────────────────

import { AiQuotaExceededError, assertPlatformSpendCeiling } from './aiUsageService.ts';

const realFetch = globalThis.fetch;

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AI_PLATFORM_DAILY_COST_USD_CAP'];
const savedEnv = new Map<string, string | undefined>();

/** Deno runs these files in one process, so a test must hand the environment back. */
function snapshotEnv() {
  for (const key of ENV_KEYS) savedEnv.set(key, Deno.env.get(key));
}

function restoreEnv() {
  globalThis.fetch = realFetch;
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) Deno.env.delete(key);
    else Deno.env.set(key, value);
  }
}

function stubSpend(rows: unknown, status = 200) {
  const calls: string[] = [];
  Deno.env.set('SUPABASE_URL', 'https://spend.test');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    return Promise.resolve(
      new Response(JSON.stringify(rows), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    );
  }) as typeof fetch;
  return calls;
}

Deno.test('assertPlatformSpendCeiling refuses at and above the cap', async () => {
  snapshotEnv();
  Deno.env.set('AI_PLATFORM_DAILY_COST_USD_CAP', '150');
  try {
    stubSpend([{ estimated_cost_usd: 100 }, { estimated_cost_usd: 50 }]);
    let error: unknown;
    try {
      await assertPlatformSpendCeiling();
    } catch (err) {
      error = err;
    }
    assertEquals(error instanceof AiQuotaExceededError, true);
    assertEquals((error as Error).message, 'Platform daily AI spend limit reached');
  } finally {
    restoreEnv();
  }
});

Deno.test('assertPlatformSpendCeiling allows spend under the cap', async () => {
  snapshotEnv();
  Deno.env.set('AI_PLATFORM_DAILY_COST_USD_CAP', '150');
  try {
    stubSpend([{ estimated_cost_usd: 149.99 }]);
    await assertPlatformSpendCeiling();
  } finally {
    restoreEnv();
  }
});

Deno.test('assertPlatformSpendCeiling fails closed when the spend cannot be read', async () => {
  snapshotEnv();
  Deno.env.set('AI_PLATFORM_DAILY_COST_USD_CAP', '150');
  try {
    stubSpend({ message: 'boom' }, 500);
    let threw = false;
    try {
      await assertPlatformSpendCeiling();
    } catch {
      threw = true;
    }
    assertEquals(threw, true);
  } finally {
    restoreEnv();
  }
});

Deno.test('a cap of 0 disables the ceiling and reads nothing', async () => {
  snapshotEnv();
  Deno.env.set('AI_PLATFORM_DAILY_COST_USD_CAP', '0');
  try {
    const calls = stubSpend([{ estimated_cost_usd: 99999 }]);
    await assertPlatformSpendCeiling();
    assertEquals(calls.length, 0);
  } finally {
    restoreEnv();
  }
});

Deno.test(
  'an unusable cap value falls back to the default instead of disabling the ceiling',
  () => {
    for (const raw of ['abc', '-5', 'NaN', 'Infinity']) {
      Deno.env.set('AI_PLATFORM_DAILY_COST_USD_CAP', raw);
      assertEquals(platformDailyCostUsdCap(), 150, raw);
    }
    Deno.env.delete('AI_PLATFORM_DAILY_COST_USD_CAP');
  }
);

Deno.test('the ceiling is checked before the per-org quota switch can return early', async () => {
  const source = await Deno.readTextFile(new URL('./aiUsageService.ts', import.meta.url));
  const inner = source.slice(source.indexOf('async function assertOrgAndPropertyAiQuotaInner'));
  const ceiling = inner.indexOf('await assertPlatformSpendCeiling()');
  const earlyReturn = inner.indexOf('if (!global.enforceQuotas) return;');
  assertEquals(ceiling > 0 && earlyReturn > 0 && ceiling < earlyReturn, true);
});

Deno.test('voice start checks the AI quota before it mints a token', async () => {
  const source = await Deno.readTextFile(
    new URL('../voice-receptionist-start/index.ts', import.meta.url)
  );
  const quota = source.indexOf(
    "assertOrgAndPropertyAiQuota(orgId, propertyId, 'voice_receptionist')"
  );
  const denial = source.indexOf('if (quotaGate) {');
  const mint = source.indexOf('await mintGeminiLiveEphemeralToken(');
  assertEquals(quota > 0 && denial > quota && mint > denial, true);
});
