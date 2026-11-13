import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the OTA completion link (`<origin>/form?complete=<token>`).
 *
 * The guest fills the normal form for a booking that arrived from calendar sync. The handler
 * must never insert a row and must never transition status, so the guards that run before the
 * booking lookup are the contract worth pinning.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

type StubState = { maintenance: boolean };
let state: StubState = { maintenance: false };
let calls: string[] = [];

/** One stub, installed before the import: the Supabase client caches `fetch`. */
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push(`${init?.method ?? 'GET'} ${url}`);

  if (url.includes('/rest/v1/platform_settings')) {
    const row = {
      signups_enabled: true,
      maintenance_mode: state.maintenance,
      maintenance_message: 'Back at 6pm.',
      public_rate_limit_per_min: 120,
      authenticated_rate_limit_enforce: false,
      authenticated_rate_limit_per_min: 300,
      default_plan_code: null,
      migration_cutover_at: null,
    };
    return Promise.resolve(
      new Response(JSON.stringify([row]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  }

  if (url.includes('/rest/v1/rpc/bump_rate_limit')) {
    return Promise.resolve(
      new Response('1', { status: 200, headers: { 'content-type': 'application/json' } })
    );
  }

  return Promise.resolve(
    new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
  );
}) as typeof fetch;

await import('../../submit-form-completion/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');
const { resetPlatformSettingsCacheForTests } = await import(
  '../../_shared/platformSettingsCache.ts'
);

const handler = getMountedEdgeHandler('submit-form-completion');
assert(handler, 'serveHandler must mount submit-form-completion in test mode');

type Envelope = { success?: boolean; error?: string };

function reset(maintenance = false) {
  state = { maintenance };
  calls = [];
  resetPlatformSettingsCacheForTests();
}

function post(query = ''): Request {
  return new Request(`${FUNCTIONS_URL}/submit-form-completion${query}`, {
    method: 'POST',
    body: new FormData(),
  });
}

Deno.test('submit-form-completion rejects a read verb with 405', async () => {
  reset();
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/submit-form-completion`, { method: 'GET' })
  );

  assertEquals(response.status, 405);
  const body = (await response.json()) as Envelope;
  assertEquals(body.error, 'Method not allowed');
  assertEquals(calls, [], 'a wrong verb must not reach the database');
});

Deno.test('submit-form-completion is closed while the platform is in maintenance', async () => {
  reset(true);
  const response = await handler!(post('?complete=token-abc'));

  assertEquals(response.status, 503);
  const body = (await response.json()) as Envelope;
  assertEquals(body.error, 'Back at 6pm.');
  assert(
    !calls.some((call) => call.includes('/rest/v1/guest_submissions')),
    'maintenance must short-circuit before any booking read'
  );
});

Deno.test('submit-form-completion rejects a request without a token', async () => {
  reset();
  const response = await handler!(post());

  assertEquals(response.status, 400);
  const body = (await response.json()) as Envelope;
  assertEquals(body.error, 'Missing completion token');
  assert(
    !calls.some((call) => call.includes('/rest/v1/guest_submissions')),
    'the token guard runs before the booking lookup'
  );
});
