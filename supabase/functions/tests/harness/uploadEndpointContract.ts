import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * Shared HTTP contract for the upload endpoints.
 *
 * Sixteen upload entrypoints share one shape: CORS preflight, then a scoped-access check, then
 * a storage write. Rather than sixteen copies of the same test bodies, each endpoint gets a
 * three-line `tests/handlers/<fn>.test.ts` that calls this helper, which keeps the naming
 * convention `check:edge-test-coverage` ratchets on.
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

/** Register the two contract cases for one upload endpoint. */
export function uploadEndpointContract(name: string): void {
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

  Deno.test(`${name} rejects an unauthenticated write before any I/O`, async () => {
    await import(`../../${name}/index.ts`);
    const handler = getMountedEdgeHandler(name);
    assert(handler, `${name} must mount through a serve wrapper`);
    calls = [];

    const response = await handler!(
      new Request(`${FUNCTIONS_URL}/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=x' },
        body: '--x--',
      })
    );

    // The invariant is the rejection plus the absence of work, not the exact code: nine
    // endpoints answer 401 and seven answer 400 because their scoped-access helper throws a
    // plain Error that `handleEdgeError` maps to 400. Recorded in the plan; changing those
    // seven response contracts is a separate decision.
    assert(
      [400, 401, 403].includes(response.status),
      `${name} must reject a caller with no session, got ${response.status}`
    );
    assertEquals(calls, [], 'an unauthenticated write must not reach storage or the database');
  });
}
