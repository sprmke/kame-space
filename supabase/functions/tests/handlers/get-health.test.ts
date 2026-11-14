import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the health probe.
 *
 * Uptime monitors and the deploy smoke read this, so the contract is: GET only, a stable
 * shape, never a 200 when the database is unreachable, and no infrastructure detail beyond a
 * single status word.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

type StubState = { dbReachable: boolean };
let state: StubState = { dbReachable: true };
let calls: string[] = [];

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push(`${init?.method ?? 'GET'} ${url}`);

  if (url.includes('/rest/v1/')) {
    // A rejected promise here can surface as an unhandled rejection in the runner and fail an
    // unrelated test, so model the outage as a 503 the client sees.
    if (!state.dbReachable) {
      return Promise.resolve(
        new Response(JSON.stringify({ message: 'database unavailable' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return Promise.resolve(
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    );
  }

  return Promise.resolve(
    new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
  );
}) as typeof fetch;

await import('../../get-health/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('get-health');
assert(handler, 'servePublic must mount get-health in test mode');

type Envelope = { success?: boolean; status?: string; db?: string; version?: number };

function reset(dbReachable: boolean) {
  state = { dbReachable };
  calls = [];
}

Deno.test('get-health reports ok with a stable shape', async () => {
  reset(true);
  const response = await handler!(new Request(`${FUNCTIONS_URL}/get-health`));

  assertEquals(response.status, 200);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, true);
  assertEquals(body.status, 'ok');
  assertEquals(body.db, 'ok');
  // The contract version is a number the monitors can compare, not a label.
  assertEquals(body.version, 1);
  assertEquals(response.headers.get('cache-control')?.includes('private'), true);
});

Deno.test('get-health never reports 200 while the database is unreachable', async () => {
  reset(false);
  const response = await handler!(new Request(`${FUNCTIONS_URL}/get-health`));

  assertEquals(response.status, 503);
  const body = (await response.json()) as Envelope;
  assertEquals(body.status, 'degraded');
  assertEquals(body.db, 'unreachable');
});

Deno.test('get-health leaks no host, key or connection detail', async () => {
  reset(false);
  const body = JSON.stringify(await (await handler!(new Request(`${FUNCTIONS_URL}/get-health`))).json());

  assertEquals(body.includes('SUPABASE'), false);
  assertEquals(body.includes('127.0.0.1'), false);
  assertEquals(body.includes('key'), false);
});

Deno.test('get-health rejects a non-GET verb', async () => {
  reset(true);
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/get-health`, { method: 'POST' })
  );

  assertEquals(response.status, 405);
});
