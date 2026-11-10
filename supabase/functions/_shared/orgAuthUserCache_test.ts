/**
 * `verifyAuthenticatedUser` collapses the duplicate `getUser` inside one request.
 *
 * The contract that matters is that it still rejects a bad token and still returns the same
 * identity; the cache is an optimisation, never a way in.
 */

import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';

Deno.env.set('SUPABASE_URL', 'https://stub.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'stub-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'stub-anon-key');

const calls: string[] = [];

// Stub the Supabase client the module builds, before importing it.
const originalFetch = globalThis.fetch;

function reqWithToken(token: string): Request {
  return new Request('https://edge.example/fn', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

Deno.test('verifyAuthenticatedUser: second call with the same token skips the network', async () => {
  const { verifyAuthenticatedUser, resetVerifiedUserCacheForTests } = await import(
    './orgAuth.ts'
  );
  resetVerifiedUserCacheForTests();
  calls.length = 0;

  // `createServiceClient()` reaches Supabase over fetch; the stub answers the auth call.
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return Promise.resolve(
      new Response(
        JSON.stringify({ id: 'user-1', email: 'probe@example.com', aud: 'authenticated' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }) as typeof fetch;

  try {
    const first = await verifyAuthenticatedUser(reqWithToken('token-a'));
    const second = await verifyAuthenticatedUser(reqWithToken('token-a'));

    assertEquals(first, second);
    assertEquals(first.id, 'user-1');
  } finally {
    globalThis.fetch = originalFetch;
    resetVerifiedUserCacheForTests();
  }
});

Deno.test('verifyAuthenticatedUser: a different token is verified separately', async () => {
  const { verifyAuthenticatedUser, resetVerifiedUserCacheForTests } = await import(
    './orgAuth.ts'
  );
  resetVerifiedUserCacheForTests();
  calls.length = 0;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers ?? {});
    const token = (headers.get('Authorization') ?? '').includes('bad') ? 'bad' : 'good';
    calls.push(token);
    if (token === 'bad') {
      return Promise.resolve(
        new Response(JSON.stringify({ message: 'invalid' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ id: 'user-1', email: 'probe@example.com' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }) as typeof fetch;

  try {
    await verifyAuthenticatedUser(reqWithToken('good'));

    // The guard throws a `Response`, not an `Error`, so assert the throw directly rather
    // than through `assertRejects`, which expects an Error.
    let threw = false;
    try {
      await verifyAuthenticatedUser(reqWithToken('bad'));
    } catch {
      threw = true;
    }
    assert(threw, 'a bad token must not be accepted, cached or otherwise');
  } finally {
    globalThis.fetch = originalFetch;
    resetVerifiedUserCacheForTests();
  }
});
