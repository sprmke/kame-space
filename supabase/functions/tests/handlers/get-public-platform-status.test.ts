import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the boot status every page reads.
 *
 * It decides whether the shell shows the maintenance screen and whether sign-up is offered, so
 * the payload shape and the mapping from platform settings are the contract.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

type StubState = { maintenance: boolean; signups: boolean; message: string | null };
let state: StubState = { maintenance: false, signups: true, message: null };
let calls: string[] = [];

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push(`${init?.method ?? 'GET'} ${url}`);

  if (url.includes('/rest/v1/platform_settings')) {
    const row = {
      signups_enabled: state.signups,
      maintenance_mode: state.maintenance,
      maintenance_message: state.message,
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

  if (url.includes('/rest/v1/rpc/')) {
    return Promise.resolve(
      new Response('1', { status: 200, headers: { 'content-type': 'application/json' } })
    );
  }

  return Promise.resolve(
    new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
  );
}) as typeof fetch;

await import('../../get-public-platform-status/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');
const { resetPlatformSettingsCacheForTests } = await import(
  '../../_shared/platformSettingsCache.ts'
);

const handler = getMountedEdgeHandler('get-public-platform-status');
assert(handler, 'servePublic must mount get-public-platform-status in test mode');

type Payload = { success?: boolean; data?: Record<string, unknown> };

function reset(next: Partial<StubState> = {}) {
  state = { maintenance: false, signups: true, message: null, ...next };
  calls = [];
  resetPlatformSettingsCacheForTests();
}

function get(): Request {
  return new Request(`${FUNCTIONS_URL}/get-public-platform-status`);
}

Deno.test('get-public-platform-status reports a healthy platform', async () => {
  reset();
  const response = await handler!(get());

  assertEquals(response.status, 200);
  const body = (await response.json()) as Payload;
  assertEquals(body.success, true);
  assertEquals(body.data?.maintenanceMode, false);
  assertEquals(body.data?.signupsEnabled, true);
});

Deno.test('get-public-platform-status reflects maintenance with its message', async () => {
  reset({ maintenance: true, message: 'Back at 6pm.' });
  const body = (await (await handler!(get())).json()) as Payload;

  assertEquals(body.data?.maintenanceMode, true);
  assertEquals(body.data?.maintenanceMessage, 'Back at 6pm.');
});

Deno.test('get-public-platform-status reflects disabled signups', async () => {
  reset({ signups: false });
  const body = (await (await handler!(get())).json()) as Payload;

  assertEquals(body.data?.signupsEnabled, false);
});

Deno.test('get-public-platform-status exposes only the three platform flags', async () => {
  reset();
  const body = (await (await handler!(get())).json()) as Payload;

  assertEquals(Object.keys(body.data ?? {}).sort(), [
    'maintenanceMessage',
    'maintenanceMode',
    'signupsEnabled',
  ]);
});

Deno.test('get-public-platform-status rejects a non-GET verb', async () => {
  reset();
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/get-public-platform-status`, { method: 'POST' })
  );

  assertEquals(response.status, 405);
});
