import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the public ICS feed.
 *
 * OTAs poll this URL with a per-property token. Every failure has to look identical (404, no
 * enumeration) and the endpoint must never leak guest data, so the cheap gates and the shape
 * of a rejection are what this pins.
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

  // Public rate limit counter; 1 means "under the cap".
  if (url.includes('/rest/v1/rpc/')) {
    return Promise.resolve(
      new Response('1', { status: 200, headers: { 'content-type': 'application/json' } })
    );
  }

  return Promise.resolve(
    new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
  );
}) as typeof fetch;

await import('../../ical-export/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('ical-export');
assert(handler, 'serveHandler must mount ical-export in test mode');

function reset() {
  calls = [];
}

function get(query = ''): Request {
  return new Request(`${FUNCTIONS_URL}/ical-export/calendar.ics${query}`, { method: 'GET' });
}

Deno.test('ical-export answers a CORS preflight without any read', async () => {
  reset();
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/ical-export/calendar.ics`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://kamespace.com' },
    })
  );

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('access-control-allow-origin'), 'https://kamespace.com');
  assertEquals(calls, []);
});

Deno.test('ical-export answers a non-GET verb as a plain 404', async () => {
  reset();
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/ical-export/calendar.ics`, { method: 'POST' })
  );

  assertEquals(response.status, 404);
  assertEquals(await response.text(), 'Not found');
  assertEquals(calls, [], 'the verb guard runs before the rate limiter');
});

Deno.test('ical-export hides a missing token behind the same 404', async () => {
  reset();
  const response = await handler!(get('?property=sample-stays-ph'));

  assertEquals(response.status, 404);
  assertEquals(await response.text(), 'Not found');
  assert(
    !calls.some((call) => call.includes('/rest/v1/guest_submissions')),
    'a tokenless request must not read bookings'
  );
});

Deno.test('ical-export hides a missing property behind the same 404', async () => {
  reset();
  const response = await handler!(get('?token=abc123'));

  assertEquals(response.status, 404);
  assertEquals(await response.text(), 'Not found');
});

Deno.test('a rejection never leaks guest data or the reason', async () => {
  reset();
  const response = await handler!(get('?property=sample-stays-ph&token=wrong'));

  assertEquals(response.status, 404);
  const text = await response.text();
  assertEquals(text, 'Not found');
  assertEquals(text.includes('@'), false);
  assertEquals(text.includes('token'), false);
});
