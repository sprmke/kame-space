import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { authenticatedPostContract } from '../harness/authenticatedPostContract.ts';

/*
 * get-booking is the host single-row read (booking detail + assistant card).
 * These cases pin the format=row path that replaced browser PostgREST+.single(),
 * including platform-admin access through edge scope (not RLS membership).
 */

authenticatedPostContract('get-booking');

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');
Deno.env.set('ADMIN_ALLOWED_EMAILS', 'platform@example.test');

const PROPERTY_ID = 'c9573d84-e816-4f9a-8049-efa91e01d2d5';
const BOOKING_ID = '1f344a3c-600a-4870-9dc7-d3a58e4c7625';
const OWNER_ID = 'owner-user-1';
const PLATFORM_USER_ID = 'platform-user-1';

const BOOKING_ROW = {
  id: BOOKING_ID,
  property_id: PROPERTY_ID,
  parking_id: null,
  primary_guest_name: 'Maria Santos',
  status: 'PENDING_REVIEW',
  check_in_date: '11-20-2026',
  check_out_date: '11-22-2026',
  guest_balance_paid_amount: 0,
  booking_rate: 5000,
  down_payment: 0,
  balance: 0,
  security_deposit: 0,
  pet_fee: 0,
  parking_rate_guest: 0,
  guest_additional_fee: 0,
};

type Scenario = {
  tokenEmail: string | null;
  tokenUserId: string;
  hasPropertyAccess: boolean;
  booking: typeof BOOKING_ROW | null;
};

const scenario: Scenario = {
  tokenEmail: 'platform@example.test',
  tokenUserId: PLATFORM_USER_ID,
  hasPropertyAccess: true,
  booking: BOOKING_ROW,
};

function resetScenario(over: Partial<Scenario> = {}) {
  Object.assign(scenario, {
    tokenEmail: 'platform@example.test',
    tokenUserId: PLATFORM_USER_ID,
    hasPropertyAccess: true,
    booking: BOOKING_ROW,
    ...over,
  });
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    );

  if (url.includes('/auth/v1/user')) {
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    if (!auth.startsWith('Bearer ') || !scenario.tokenEmail) {
      return json({ message: 'invalid token' }, 401);
    }
    return json({
      user: { id: scenario.tokenUserId, email: scenario.tokenEmail },
    });
  }

  if (url.includes('/rest/v1/rpc/resolve_property_access')) {
    if (!scenario.hasPropertyAccess) return json([]);
    return json([
      {
        property: {
          id: PROPERTY_ID,
          organization_id: 'org-1',
          name: 'Test Property',
          slug: 'test-property',
          inactive_reason: null,
        },
        org: {
          id: 'org-1',
          name: 'Test Org',
          slug: 'test-org',
          // Owner is someone else; caller is platform admin via ADMIN_ALLOWED_EMAILS.
          owner_id: OWNER_ID,
        },
        org_member: null,
        property_member: null,
      },
    ]);
  }

  if (url.includes('/rest/v1/guest_submissions')) {
    if (!scenario.booking) return json(null);
    // maybeSingle → object; select('*') or select('property_id')
    if (url.includes('select=property_id')) {
      return json({ property_id: scenario.booking.property_id });
    }
    return json(scenario.booking);
  }

  if (url.includes('/rest/v1/properties')) {
    return json({ id: PROPERTY_ID, name: 'Test Property' });
  }

  return json({ message: `unexpected fetch ${url}` }, 599);
}) as typeof fetch;

await import('../../get-booking/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('get-booking');
assert(handler, 'get-booking must mount through a serve wrapper');

Deno.test('get-booking format=row returns the full booking for a platform admin', async () => {
  resetScenario();
  const response = await handler!(
    new Request(
      `${FUNCTIONS_URL}/get-booking?booking_id=${BOOKING_ID}&property_id=${PROPERTY_ID}&format=row`,
      {
        method: 'GET',
        headers: { Authorization: 'Bearer platform-token' },
      }
    )
  );
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.success, true);
  assertEquals(body.data.id, BOOKING_ID);
  assertEquals(body.data.property_id, PROPERTY_ID);
  assertEquals(body.data.primary_guest_name, 'Maria Santos');
  assertEquals(body.data.status, 'PENDING_REVIEW');
});

Deno.test('get-booking format=row returns 404 when the booking is missing', async () => {
  resetScenario({ booking: null });
  const response = await handler!(
    new Request(
      `${FUNCTIONS_URL}/get-booking?booking_id=${BOOKING_ID}&property_id=${PROPERTY_ID}&format=row`,
      {
        method: 'GET',
        headers: { Authorization: 'Bearer platform-token' },
      }
    )
  );
  assertEquals(response.status, 404);
  const body = await response.json();
  assertEquals(body.success, false);
});

Deno.test('get-booking default response stays slim for assistant callers', async () => {
  resetScenario();
  const response = await handler!(
    new Request(
      `${FUNCTIONS_URL}/get-booking?booking_id=${BOOKING_ID}&property_id=${PROPERTY_ID}`,
      {
        method: 'GET',
        headers: { Authorization: 'Bearer platform-token' },
      }
    )
  );
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.success, true);
  assertEquals(body.data.bookingId, BOOKING_ID);
  assertEquals(body.data.guestName, 'Maria Santos');
  assertEquals(body.data.id, undefined);
});
