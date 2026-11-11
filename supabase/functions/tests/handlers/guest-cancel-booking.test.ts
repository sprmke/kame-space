import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for guest instant cancellation.
 *
 * `guest-cancel-booking` is the public twin of `cancel-booking` and it moves money, so the
 * order of its guards is the contract: validate the id, rate limit, check booking access,
 * then touch the cancellation service. These cases pin the guards and prove the endpoint
 * does no work it does not have to.
 *
 * One `fetch` stub is installed before the handler is imported and every test changes the
 * data it serves. Swapping `globalThis.fetch` per test does not work: the Supabase client
 * captures `fetch` when it is created, so a later reassignment is invisible to it and the
 * first stub silently answers every test.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

type StubState = {
  /** Rows for `guest_submissions`, or `'not-found'` for a PostgREST zero-row answer. */
  bookingRows: unknown[] | 'not-found';
};

let state: StubState = { bookingRows: 'not-found' };
let calls: string[] = [];

function reset(next: Partial<StubState> = {}) {
  state = { bookingRows: 'not-found', ...next };
  calls = [];
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push(`${init?.method ?? 'GET'} ${url}`);

  if (url.includes('/auth/v1/user')) {
    return Promise.resolve(
      new Response(JSON.stringify({ message: 'invalid token' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    );
  }

  if (url.includes('/rest/v1/rpc/bump_rate_limit')) {
    return Promise.resolve(
      new Response('1', { status: 200, headers: { 'content-type': 'application/json' } })
    );
  }

  // `DatabaseService.getBookingById` reads guest_submissions, not bookings.
  if (url.includes('/rest/v1/guest_submissions')) {
    // PostgREST answers 406 + PGRST116 for `.single()` with no row, which is what
    // `getBookingById` maps to `null`. Answering 200 with `null` or `[]` still yields a
    // row-like value in the client, hiding a missing booking behind a wrong status.
    if (state.bookingRows === 'not-found') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: 'Results contain 0 rows',
            hint: null,
          }),
          { status: 406, headers: { 'content-type': 'application/json' } }
        )
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(state.bookingRows), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  }

  return Promise.resolve(
    new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
  );
}) as typeof fetch;

await import('../../guest-cancel-booking/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('guest-cancel-booking');
assert(handler, 'the wrapper must mount a handler in test mode');

type Envelope = { success?: boolean; error?: string };

function request(method: string, body?: unknown): Request {
  return new Request(`${FUNCTIONS_URL}/guest-cancel-booking`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const VALID_BOOKING_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

Deno.test('guest-cancel-booking refuses a read verb', async () => {
  reset();
  const response = await handler!(request('GET'));

  assertEquals(response.status, 405);
  assertEquals(calls, [], 'a wrong verb must not reach the database');
});

Deno.test('guest-cancel-booking rejects a malformed booking id before any lookup', async () => {
  reset();
  const response = await handler!(request('POST', { bookingId: 'not-a-uuid', confirm: true }));

  assertEquals(response.status, 404);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assertEquals(calls, [], 'id validation must run before auth, rate limit and booking reads');
});

Deno.test('guest-cancel-booking answers 404 for an id that is not a booking', async () => {
  reset({ bookingRows: 'not-found' });
  const response = await handler!(
    request('POST', { bookingId: VALID_BOOKING_ID, confirm: true })
  );

  assertEquals(response.status, 404);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assert(
    calls.some((call) => call.includes('/rest/v1/guest_submissions')),
    'a well-formed id is looked up'
  );
  assert(
    !calls.some((call) => call.includes('/rest/v1/booking_refunds')),
    'no refund row is written when there is no booking'
  );
});

Deno.test('guest-cancel-booking needs a signed-in guest or a valid access token', async () => {
  reset({
    bookingRows: [
      {
        id: VALID_BOOKING_ID,
        property_id: 'property-e2e-001',
        status: 'READY_FOR_CHECKIN',
        external_source: null,
        parking_id: null,
        guest_email: 'maria@example.test',
        primary_guest_name: 'Maria Santos',
        guest_user_id: null,
      },
    ],
  });
  const response = await handler!(request('POST', { bookingId: VALID_BOOKING_ID }));

  // Access is checked before confirmation, so an anonymous caller without a token is turned
  // away here even though the body also lacks `confirm`.
  assertEquals(response.status, 401);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assert(
    (body.error ?? '').includes('Sign in'),
    `the guest is told how to proceed, got: ${body.error}`
  );
  assert(
    !calls.some(
      (call) =>
        call.includes('/rest/v1/booking_refunds') || call.includes('/rest/v1/activity_log')
    ),
    'no refund or activity write before access passes'
  );
});
