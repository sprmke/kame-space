import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * Shared HTTP contracts for public reads.
 *
 * Two shapes exist:
 *   - `publicReadContract`: the read needs a capability token or an identifier (slug, booking
 *     id). Without one it must answer a plain 4xx, write nothing, and leak no guest data.
 *   - `publicDataContract`: the read is always available and must answer 200 with no writes and
 *     no guest data.
 *
 * Each endpoint gets a thin `tests/handlers/<fn>.test.ts`; endpoint-specific cases go below the
 * contract call.
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
  if (url.includes('/rest/v1/')) {
    return Promise.resolve(
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    );
  }
  return Promise.resolve(new Response('{}', { status: 599 }));
}) as typeof fetch;

const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

export function publicReadContract(name: string): void {
  Deno.test(`${name} answers a CORS preflight`, async () => {
    await import(`../../${name}/index.ts`);
    const handler = getMountedEdgeHandler(name);
    assert(handler, `${name} must mount through a public wrapper`);
    calls = [];

    const response = await handler!(
      new Request(`${FUNCTIONS_URL}/${name}`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://kamespace.com' },
      })
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get('access-control-allow-origin'), 'https://kamespace.com');
    assertEquals(calls, []);
  });

  Deno.test(`${name} answers a plain 4xx without the required token or identifier`, async () => {
    await import(`../../${name}/index.ts`);
    const handler = getMountedEdgeHandler(name);
    assert(handler, `${name} must mount through a public wrapper`);
    calls = [];

    const response = await handler!(new Request(`${FUNCTIONS_URL}/${name}`, { method: 'GET' }));
    const text = await response.text();

    assert(
      response.status >= 400 && response.status < 500,
      `${name} must refuse a read with no token or identifier, got ${response.status}`
    );
    assertEquals(
      calls.filter(
        (call) => /^(POST|PATCH|PUT|DELETE) /.test(call) && !call.includes('bump_rate_limit')
      ),
      [],
      'a refused read must not write'
    );
    assertEquals(text.includes('@'), false, 'a rejection must not echo guest contact data');
  });

  Deno.test(`${name} answers a CORS preflight`, async () => {
    await import(`../../${name}/index.ts`);
    const handler = getMountedEdgeHandler(name);
    assert(handler, `${name} must mount through a public wrapper`);
    calls = [];

    const response = await handler!(
      new Request(`${FUNCTIONS_URL}/${name}`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://kamespace.com' },
      })
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get('access-control-allow-origin'), 'https://kamespace.com');
    assertEquals(calls, []);
  });
}

/** Always-readable public data: 200, no writes, no guest contact data. */
export function publicDataContract(name: string): void {
  Deno.test(`${name} serves public data without writing`, async () => {
    await import(`../../${name}/index.ts`);
    const handler = getMountedEdgeHandler(name);
    assert(handler, `${name} must mount through a public wrapper`);
    calls = [];

    const response = await handler!(new Request(`${FUNCTIONS_URL}/${name}`, { method: 'GET' }));
    const text = await response.text();

    assertEquals(response.status, 200);
    assertEquals(
      calls.filter(
        (call) => /^(POST|PATCH|PUT|DELETE) /.test(call) && !call.includes('bump_rate_limit')
      ),
      [],
      'a public read must not write'
    );
    assertEquals(text.includes('@'), false, 'public data must not carry guest contact data');
  });
}
