import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * `get-pay-parking` privacy contract (OWASP A01 / API1 BOLA, API3 BOPLA).
 *
 * The endpoint exists so `/properties/:slug/parking/:bookingId` can redirect a guest to the
 * right parking flow. It used to answer a bare booking id with the guest's name, stay dates,
 * party size and vehicle plate/model/color. Those fields are now only returned to the guest who
 * owns the booking (a valid `?access=` token or a signed-in owner); a bare id gets redirect
 * fields only.
 *
 * One `fetch` stub is installed before the handler is imported and each test swaps the data it
 * serves, for the same reason as the other handler tests: the Supabase client captures `fetch`
 * when a client is created.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';
const BOOKING_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const ACCESS_SECRET = 'get-pay-parking-privacy-test-secret';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');
Deno.env.set('GUEST_BOOKING_ACCESS_SECRET', ACCESS_SECRET);

const BOOKING_ROW = {
  id: BOOKING_ID,
  property_id: 'property-e2e-001',
  status: 'PENDING_DOCUMENTS',
  primary_guest_name: 'Maria Santos',
  guest_facebook_name: 'Maria Santos',
  guest_email: 'maria@example.test',
  guest_user_id: null,
  check_in_date: '08-25-2026',
  check_out_date: '08-27-2026',
  check_in_time: '14:00',
  check_out_time: '12:00',
  number_of_nights: 2,
  number_of_adults: 2,
  number_of_children: 0,
  need_parking: true,
  car_plate_number: 'ABC 1234',
  car_brand_model: 'Toyota Vios',
  car_color: 'White',
  parking_id: null,
  parking_check_in_date: null,
  parking_check_out_date: null,
  parking_rate_guest: 400,
};

let calls: string[] = [];

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

  if (url.includes('/rest/v1/rpc/bump_rate_limit') || url.includes('/rest/v1/rpc/')) {
    return Promise.resolve(
      new Response('1', { status: 200, headers: { 'content-type': 'application/json' } })
    );
  }

  // `DatabaseService.getBookingById` and the linked-parking lookup both read guest_submissions.
  if (url.includes('/rest/v1/guest_submissions')) {
    return Promise.resolve(
      new Response(JSON.stringify(BOOKING_ROW), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  }

  if (url.includes('/rest/v1/properties')) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: 'property-e2e-001',
          slug: 'kame-home',
          organization_id: 'org-e2e-001',
          residence_name: 'One Palm Residences',
          settings: {},
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
  }

  // Platform settings / app settings reads are single-row; an empty object keeps them happy.
  if (url.includes('/rest/v1/')) {
    return Promise.resolve(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    );
  }

  return Promise.resolve(
    new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
  );
}) as typeof fetch;

await import('../../get-pay-parking/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');
const { mintGuestBookingAccessToken } = await import('../../_shared/guestBookingAccessToken.ts');

const handler = getMountedEdgeHandler('get-pay-parking');
assert(handler, 'the wrapper must mount a handler in test mode');

type Payload = {
  success?: boolean;
  data?: Record<string, unknown>;
};

async function get(query: string): Promise<{ status: number; data: Record<string, unknown> }> {
  calls = [];
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/get-pay-parking?${query}`, { method: 'GET' })
  );
  const body = (await response.json()) as Payload;
  return { status: response.status, data: body.data ?? {} };
}

const GUEST_PII_FIELDS = [
  'primary_guest_name',
  'guest_facebook_name',
  'car_plate_number',
  'car_brand_model',
  'car_color',
  'number_of_adults',
  'number_of_children',
  'pax',
  'parking_rate_guest',
  'check_in_date',
  'check_out_date',
  'status',
];

Deno.test('get-pay-parking bare booking id returns redirect fields only', async () => {
  const { status, data } = await get(`bookingId=${BOOKING_ID}`);

  assertEquals(status, 200);
  assertEquals(data.viewerOwnsBooking, false);
  assertEquals(data.property_slug, 'kame-home');
  for (const field of GUEST_PII_FIELDS) {
    assertEquals(
      Object.prototype.hasOwnProperty.call(data, field),
      false,
      `a bare booking id must not return guest field "${field}"`
    );
  }
});

Deno.test('get-pay-parking rejects a forged access token without leaking guest fields', async () => {
  const { status, data } = await get(`bookingId=${BOOKING_ID}&access=v1.${BOOKING_ID}.9999999999999.bad`);

  assertEquals(status, 200);
  assertEquals(data.viewerOwnsBooking, false);
  for (const field of GUEST_PII_FIELDS) {
    assertEquals(
      Object.prototype.hasOwnProperty.call(data, field),
      false,
      `a forged token must not return guest field "${field}"`
    );
  }
});

Deno.test('get-pay-parking returns guest fields to the holder of a valid access token', async () => {
  const token = await mintGuestBookingAccessToken(BOOKING_ID);
  const { status, data } = await get(
    `bookingId=${BOOKING_ID}&access=${encodeURIComponent(token)}`
  );

  assertEquals(status, 200);
  assertEquals(data.viewerOwnsBooking, true);
  assertEquals(data.primary_guest_name, 'Maria Santos');
  assertEquals(data.car_plate_number, 'ABC 1234');
});

Deno.test('get-pay-parking does not accept a token minted for another booking', async () => {
  const otherId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const token = await mintGuestBookingAccessToken(otherId);
  const { status, data } = await get(
    `bookingId=${BOOKING_ID}&access=${encodeURIComponent(token)}`
  );

  assertEquals(status, 200);
  assertEquals(data.viewerOwnsBooking, false);
  for (const field of GUEST_PII_FIELDS) {
    assertEquals(Object.prototype.hasOwnProperty.call(data, field), false);
  }
});
