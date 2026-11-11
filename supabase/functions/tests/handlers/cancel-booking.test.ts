import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the host-initiated cancellation endpoint.
 *
 * `cancel-booking` is the admin twin of `guest-cancel-booking`: it moves money and status,
 * so the order of its guards is the contract. These cases pin the two that must run before
 * any booking is read: the authenticated wrapper (no bearer, bad session) and the method
 * guard. Nothing here touches a booking, a refund or the workflow orchestrator.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

const EMAILS: Record<string, string> = {
  'host-token': 'host@example.test',
};

let calls: string[] = [];

/** Reset recorded calls. The stub itself is installed once: the client caches `fetch`. */
function reset() {
  calls = [];
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push(url);

  if (url.includes('/auth/v1/user')) {
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    const email = EMAILS[auth.replace(/^Bearer\s+/i, '')];
    if (!email) {
      return Promise.resolve(
        new Response(JSON.stringify({ message: 'invalid token' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ user: { id: 'user-host-1', email } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  }

  // `getPlatformSettingsSnapshot` reads this before the handler runs; `null` means defaults.
  if (url.includes('/rest/v1/platform_settings')) {
    return Promise.resolve(
      new Response('null', { status: 200, headers: { 'content-type': 'application/json' } })
    );
  }

  return Promise.resolve(
    new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
  );
}) as typeof fetch;

reset();
await import('../../cancel-booking/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('cancel-booking');
assert(handler, 'the wrapper must mount a handler in test mode');

type Envelope = { success?: boolean; error?: string };

function request(method: string, token?: string): Request {
  return new Request(`${FUNCTIONS_URL}/cancel-booking`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(method === 'POST' ? { body: JSON.stringify({ bookingId: 'x', confirm: true }) } : {}),
  });
}

Deno.test('cancel-booking rejects a missing bearer before reading anything', async () => {
  reset();
  const response = await handler!(request('POST'));

  assertEquals(response.status, 401);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assert(typeof body.error === 'string' && body.error.length > 0);

  // The admin boundary is first: no session lookup, no settings read, no booking read.
  assertEquals(calls, []);
});

Deno.test('cancel-booking rejects an invalid session', async () => {
  reset();
  const response = await handler!(request('POST', 'not-a-real-token'));

  assertEquals(response.status, 401);
  assertEquals(calls.some((url) => url.includes('/auth/v1/user')), true);
  assertEquals(
    calls.some((url) => url.includes('/rest/v1/') && !url.includes('/auth/v1/')),
    false,
    'an invalid session must not reach the database'
  );
});

Deno.test('cancel-booking refuses a wrong verb for an authenticated host', async () => {
  reset();
  const response = await handler!(request('GET', 'host-token'));

  assertEquals(response.status, 405);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assert(body.error?.includes('GET'), 'the error names the rejected verb');

  // The method guard sits inside the handler, after auth: the session is verified first.
  assertEquals(calls.some((url) => url.includes('/auth/v1/user')), true);
});
