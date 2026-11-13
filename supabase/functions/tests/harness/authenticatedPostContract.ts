import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * Shared HTTP contract for an authenticated (host) POST endpoint.
 *
 * Every `serveAuthenticated` write must answer a preflight, reject a caller with no session,
 * and never touch the database on either path. Those three cases are the same for the whole
 * family, so each endpoint gets a two-line `tests/handlers/<fn>.test.ts` and the family lives
 * here. Endpoint-specific cases still belong in that file, below the contract call.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

let calls: string[] = [];
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push(`${init?.method ?? 'GET'} ${url}`);
  return Promise.resolve(
    new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
  );
}) as typeof fetch;

const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

export function authenticatedPostContract(name: string): void {
  Deno.test(`${name} answers a CORS preflight without a session`, async () => {
    await import(`../../${name}/index.ts`);
    const handler = getMountedEdgeHandler(name);
    assert(handler, `${name} must mount through a serve wrapper`);
    calls = [];

    const response = await handler!(
      new Request(`${FUNCTIONS_URL}/${name}`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://kamespace.com' },
      })
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get('access-control-allow-origin'), 'https://kamespace.com');
    assertEquals(calls, [], 'a preflight must not touch the network');
  });

  Deno.test(`${name} rejects a write with no session before any I/O`, async () => {
    await import(`../../${name}/index.ts`);
    const handler = getMountedEdgeHandler(name);
    assert(handler, `${name} must mount through a serve wrapper`);
    calls = [];

    const response = await handler!(
      new Request(`${FUNCTIONS_URL}/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    );

    assertEquals(response.status, 401);
    assertEquals(calls, [], 'an unauthenticated write must not reach the database');
  });

  Deno.test(`${name} rejects a read with no session`, async () => {
    await import(`../../${name}/index.ts`);
    const handler = getMountedEdgeHandler(name);
    assert(handler, `${name} must mount through a serve wrapper`);
    calls = [];

    const response = await handler!(
      new Request(`${FUNCTIONS_URL}/${name}`, { method: 'GET' })
    );

    // The wrapper authenticates before the handler's method guard, so a wrong verb from an
    // anonymous caller is a 401, not a 405. That ordering is the point: no handler code runs.
    assertEquals(response.status, 401);
    assertEquals(calls, []);
  });
}
