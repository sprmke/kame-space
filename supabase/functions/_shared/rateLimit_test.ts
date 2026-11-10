/**
 * Deno tests for _shared/rateLimit.ts — run with `deno test --allow-env` (not Bun's runner).
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 6)
 *
 * The counter RPC needs Postgres, so these cover the pure identity helper and the
 * fail-open contract (a broken `bump_rate_limit` must never block a caller).
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  checkRateLimit,
  checkRateLimitInMemory,
  identityFromRequest,
  isIdentityBlocked,
  rateLimitGate,
  resetBlockedIdentitiesCacheForTests,
  resetInMemoryRateLimitForTests,
} from './rateLimit.ts';

const realFetch = globalThis.fetch;

function reqWith(headers: Record<string, string> = {}): Request {
  return new Request('https://edge.example/fn', { method: 'POST', headers });
}

Deno.test('identityFromRequest: prefers the authenticated user id', () => {
  const id = identityFromRequest(reqWith({ 'x-forwarded-for': '1.2.3.4' }), { id: 'user-abc' });
  assertEquals(id, 'u:user-abc');
});

Deno.test('identityFromRequest: falls back to client IP prefix', () => {
  const id = identityFromRequest(reqWith({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }));
  assertEquals(id.startsWith('ip:'), true);
});

Deno.test('identityFromRequest: null / blank user id falls through to IP', () => {
  assertEquals(identityFromRequest(reqWith(), { id: null }).startsWith('ip:'), true);
  assertEquals(identityFromRequest(reqWith(), { id: '   ' }).startsWith('ip:'), true);
});

Deno.test('checkRateLimit: fails OPEN when the counter backend is unreachable', async () => {
  Deno.env.set('SUPABASE_URL', 'https://127.0.0.1:1');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  globalThis.fetch = () =>
    Promise.reject(new Error('network down')) as unknown as ReturnType<typeof realFetch>;
  try {
    const decision = await checkRateLimit({
      scope: 'unit-test',
      identity: 'ip:1.1.1.1',
      limit: 3,
      windowSec: 60,
    });
    assertEquals(decision.allowed, true);
    assertEquals(decision.count, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('rateLimitGate: returns null (proceed) when the check fails open', async () => {
  Deno.env.set('SUPABASE_URL', 'https://127.0.0.1:1');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  globalThis.fetch = () =>
    Promise.reject(new Error('network down')) as unknown as ReturnType<typeof realFetch>;
  try {
    const res = await rateLimitGate(reqWith(), {
      scope: 'unit-test',
      identity: 'ip:1.1.1.1',
      limit: 1,
      windowSec: 60,
    });
    assertEquals(res, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test(
  'isIdentityBlocked: fails OPEN (not blocked) when the block-list read is unreachable',
  async () => {
    Deno.env.set('SUPABASE_URL', 'https://127.0.0.1:1');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
    resetBlockedIdentitiesCacheForTests();
    globalThis.fetch = () =>
      Promise.reject(new Error('network down')) as unknown as ReturnType<typeof realFetch>;
    try {
      const blocked = await isIdentityBlocked('u:some-user');
      assertEquals(blocked, false);
    } finally {
      globalThis.fetch = realFetch;
      resetBlockedIdentitiesCacheForTests();
    }
  }
);

// ─── In-isolate counter (the log-only path) ──────────────────────────────────────────

Deno.test('checkRateLimitInMemory: counts up and blocks exactly at the limit', () => {
  resetInMemoryRateLimitForTests();
  const options = { scope: 'wrapper-default:test', identity: 'u:a', limit: 3, windowSec: 60 };

  const counts = [1, 2, 3, 4].map(() => checkRateLimitInMemory(options));

  assertEquals(
    counts.map((decision) => decision.count),
    [1, 2, 3, 4]
  );
  assertEquals(
    counts.map((decision) => decision.allowed),
    [true, true, true, false]
  );
  assertEquals(counts[0].limit, 3);
  assertEquals(counts[0].retryAfterSec > 0, true);
});

Deno.test('checkRateLimitInMemory: identities and scopes never share a bucket', () => {
  resetInMemoryRateLimitForTests();
  const base = { limit: 10, windowSec: 60 };

  checkRateLimitInMemory({ ...base, scope: 's1', identity: 'u:a' });
  checkRateLimitInMemory({ ...base, scope: 's1', identity: 'u:a' });
  const otherIdentity = checkRateLimitInMemory({ ...base, scope: 's1', identity: 'u:b' });
  const otherScope = checkRateLimitInMemory({ ...base, scope: 's2', identity: 'u:a' });

  assertEquals(otherIdentity.count, 1);
  assertEquals(otherScope.count, 1);
});

Deno.test('checkRateLimitInMemory: a new window resets the count', () => {
  resetInMemoryRateLimitForTests();
  const options = { scope: 'wrapper-default:test', identity: 'u:a', limit: 1, windowSec: 1 };
  const realNow = Date.now;
  try {
    Date.now = () => 1_000_000;
    assertEquals(checkRateLimitInMemory(options).count, 1);
    assertEquals(checkRateLimitInMemory(options).allowed, false);

    // One window later the bucket is fresh again.
    Date.now = () => 1_001_500;
    const next = checkRateLimitInMemory(options);
    assertEquals(next.count, 1);
    assertEquals(next.allowed, true);
  } finally {
    Date.now = realNow;
  }
});

Deno.test('checkRateLimitInMemory: never throws and never needs the network', () => {
  resetInMemoryRateLimitForTests();
  let called = false;
  globalThis.fetch = () => {
    called = true;
    return Promise.reject(new Error('network should not be used'));
  };
  try {
    const decision = checkRateLimitInMemory({
      scope: 'wrapper-default:test',
      identity: 'u:a',
      limit: 5,
      windowSec: 60,
    });
    assertEquals(decision.count, 1);
    assertEquals(called, false, 'the log-only path must not touch the network');
  } finally {
    globalThis.fetch = realFetch;
  }
});
