import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the guest SD refund submission.
 *
 * This is a money path: the guest picks a refund method and the handler moves the booking to
 * PENDING_SD_REFUND through the orchestrator. These cases pin the gates that must run before
 * that transition, so a bad payload can never reach the state machine.
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

await import('../../submit-sd-form/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');
const { resetPlatformSettingsCacheForTests } = await import(
  '../../_shared/platformSettingsCache.ts'
);

const handler = getMountedEdgeHandler('submit-sd-form');
assert(handler, 'serveHandler must mount submit-sd-form in test mode');

type Envelope = { success?: boolean; error?: string };

function reset(maintenance = false) {
  state = { maintenance };
  calls = [];
  resetPlatformSettingsCacheForTests();
}

function post(body: unknown): Request {
  return new Request(`${FUNCTIONS_URL}/submit-sd-form`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BOOKING_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

Deno.test('submit-sd-form refuses a read verb', async () => {
  reset();
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/submit-sd-form`, { method: 'GET' })
  );

  assertEquals(response.status, 400);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assertEquals(calls, [], 'a wrong verb must not reach the database');
});

Deno.test('submit-sd-form is closed while the platform is in maintenance', async () => {
  reset(true);
  const response = await handler!(post({ bookingId: BOOKING_ID, refund: { method: 'cash' } }));

  assertEquals(response.status, 503);
  const body = (await response.json()) as Envelope;
  assertEquals(body.error, 'Back at 6pm.');
  assert(
    !calls.some((call) => call.includes('/rest/v1/guest_submissions')),
    'maintenance must short-circuit before any booking read'
  );
});

Deno.test('submit-sd-form requires a booking id', async () => {
  reset();
  const response = await handler!(post({ refund: { method: 'cash' } }));

  assertEquals(response.status, 400);
  const body = (await response.json()) as Envelope;
  assert((body.error ?? '').includes('bookingId'), `got: ${body.error}`);
  assert(
    !calls.some((call) => call.includes('/rest/v1/guest_submissions')),
    'validation must run before the booking lookup'
  );
});

Deno.test('submit-sd-form requires a refund choice', async () => {
  reset();
  const response = await handler!(post({ bookingId: BOOKING_ID }));

  assertEquals(response.status, 400);
  const body = (await response.json()) as Envelope;
  assert((body.error ?? '').includes('refund'), `got: ${body.error}`);
});

Deno.test('submit-sd-form rejects a bank transfer without bank details', async () => {
  reset();
  const response = await handler!(
    post({ bookingId: BOOKING_ID, refund: { method: 'other_bank' } })
  );

  assertEquals(response.status, 400);
  const body = (await response.json()) as Envelope;
  assertEquals(body.error, 'Bank is required');
  assert(
    !calls.some((call) => call.includes('/rest/v1/guest_submissions')),
    'an invalid refund must never reach the booking or the orchestrator'
  );
});

Deno.test('submit-sd-form rejects an incomplete account name', async () => {
  reset();
  const response = await handler!(
    post({
      bookingId: BOOKING_ID,
      refund: {
        method: 'other_bank',
        bank: 'GCash',
        accountName: 'Maria',
        accountNumber: '1234567890',
      },
    })
  );

  assertEquals(response.status, 400);
  const body = (await response.json()) as Envelope;
  assert((body.error ?? '').includes('complete name'), `got: ${body.error}`);
});
