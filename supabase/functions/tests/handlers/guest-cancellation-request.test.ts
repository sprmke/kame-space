import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the guest cancellation *request* path (host reviews it, so no money
 * moves here). The guards before the booking lookup are the contract.
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

await import('../../guest-cancellation-request/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('guest-cancellation-request');
assert(handler, 'servePublic must mount guest-cancellation-request in test mode');

type Envelope = { success?: boolean; error?: string };

function post(body: unknown): Request {
  return new Request(`${FUNCTIONS_URL}/guest-cancellation-request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

Deno.test('guest-cancellation-request rejects a read verb', async () => {
  calls = [];
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/guest-cancellation-request`, { method: 'GET' })
  );

  assertEquals(response.status, 405);
  assertEquals(calls, []);
});

Deno.test('guest-cancellation-request hides a malformed booking id', async () => {
  calls = [];
  const response = await handler!(post({ bookingId: 'not-a-uuid' }));

  assertEquals(response.status, 404);
  const body = (await response.json()) as Envelope;
  assertEquals(body.error, 'Booking not found');
  assertEquals(calls, [], 'id validation must run before auth, rate limit and reads');
});
