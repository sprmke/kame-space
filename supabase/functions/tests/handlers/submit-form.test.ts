import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the guest intake endpoint.
 *
 * `submit-form` is the biggest guest-facing write in the app and it used to call `serve()`
 * directly, so a test could not import it: importing booted a server. It now mounts through
 * `serveHandler`, which keeps production on the same `serve(handler)` path and only adds the
 * test seam. These cases pin the cheap gates that must run before any database read.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

type StubState = {
  /** Row for `platform_settings`, or `'none'` for defaults. */
  settings: Record<string, unknown> | 'none';
};

let state: StubState = { settings: 'none' };
let calls: string[] = [];

/** One stub, installed before the module import: the Supabase client caches `fetch`. */
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push(`${init?.method ?? 'GET'} ${url}`);

  if (url.includes('/rest/v1/platform_settings')) {
    // `.maybeSingle()` unwraps client-side: it needs an array, and an object body reads as
    // "no row", which silently falls back to defaults.
    const payload = JSON.stringify(state.settings === 'none' ? [] : [state.settings]);
    return Promise.resolve(
      new Response(payload, { status: 200, headers: { 'content-type': 'application/json' } })
    );
  }

  return Promise.resolve(
    new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
  );
}) as typeof fetch;

await import('../../submit-form/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');
const { resetPlatformSettingsCacheForTests } = await import(
  '../../_shared/platformSettingsCache.ts'
);

const handler = getMountedEdgeHandler('submit-form');
assert(handler, 'serveHandler must mount submit-form in test mode');

type Envelope = { success?: boolean; error?: string };

function reset(settings: StubState['settings'] = 'none') {
  state = { settings };
  calls = [];
  resetPlatformSettingsCacheForTests();
}

Deno.test('submit-form answers a CORS preflight without touching the database', async () => {
  reset();
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/submit-form`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://kamespace.com' },
    })
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), 'ok');
  assertEquals(response.headers.get('access-control-allow-origin'), 'https://kamespace.com');
  assertEquals(calls, []);
});

Deno.test('submit-form rejects a non-POST verb before any dependency', async () => {
  reset();
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/submit-form`, { method: 'GET' })
  );

  assertEquals(response.status, 400);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assert(body.error?.includes('GET'), `the error names the verb, got: ${body.error}`);
  assertEquals(calls, []);
});

Deno.test('submit-form refuses new bookings while the platform is in maintenance', async () => {
  reset({
    signups_enabled: true,
    maintenance_mode: true,
    maintenance_message: 'Back at 6pm.',
    public_rate_limit_per_min: 120,
    authenticated_rate_limit_enforce: false,
    authenticated_rate_limit_per_min: 300,
    default_plan_code: null,
    migration_cutover_at: null,
  });

  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/submit-form`, { method: 'POST', body: new FormData() })
  );

  assertEquals(response.status, 503);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assertEquals(body.error, 'Back at 6pm.');
  assert(
    !calls.some((call) => call.includes('/rest/v1/guest_submissions')),
    'maintenance must short-circuit before any booking read or write'
  );
});
