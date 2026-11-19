import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the no-loss guard on `platform-parking-settings`: a super admin cannot
 * save commission and guest fee settings that lose money at the ₱100 minimum rate. Drives the
 * real `serveSuperAdmin` wrapper; Supabase is stubbed at `fetch`.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPER_ADMIN_EMAILS', 'boss@example.test');
Deno.env.set('SUPER_ADMIN_VERIFICATION_SECRET', 'test-sudo-secret');

const DEFAULT_ROW = {
  id: 1,
  commission_pct: 0.1,
  direct_commission_pct: 0.05,
  guest_fee_pct: 0.05,
  guest_fee_fixed: 15,
  payment_fee_pct: 0.03125,
  payment_fee_fixed: 15,
  support_escalation_phone: null,
  updated_at: '2026-11-19T00:00:00.000Z',
};

type Write = { method: string; table: string; body: Record<string, unknown> | null };
let writes: Write[] = [];

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? 'GET';
  const headers = new Headers(init?.headers);
  const wantsObject = (headers.get('accept') ?? '').includes('vnd.pgrst.object');
  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    );

  if (url.includes('/auth/v1/user')) {
    const token = (headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (token !== 'boss-token') return json({ message: 'invalid token' }, 401);
    return json({ user: { id: 'user-1', email: 'boss@example.test' } });
  }

  const table = url.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? 'unknown';
  if (method !== 'GET' && method !== 'HEAD') {
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    writes.push({ method, table, body });
    if (table === 'platform_parking_settings') {
      const merged = { ...DEFAULT_ROW, ...(body ?? {}) };
      return json(wantsObject ? merged : [merged]);
    }
    return json([], 201);
  }
  if (table === 'platform_parking_settings') {
    return json(wantsObject ? DEFAULT_ROW : [DEFAULT_ROW]);
  }
  return json(wantsObject ? null : []);
}) as typeof fetch;

await import('../../platform-parking-settings/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');
const { signSudoToken, SUPER_ADMIN_OTP_HEADER } =
  await import('../../_shared/superAdminVerification.ts');
const sudoToken = (await signSudoToken('user-1')).token;
const handler = getMountedEdgeHandler('platform-parking-settings');
assert(handler, 'the wrapper must mount a handler in test mode');

function put(body: Record<string, unknown>): Request {
  return new Request(`${FUNCTIONS_URL}/platform-parking-settings`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      Authorization: 'Bearer boss-token',
      [SUPER_ADMIN_OTP_HEADER]: sudoToken,
    },
    body: JSON.stringify(body),
  });
}

const settingsWrites = () => writes.filter((w) => w.table === 'platform_parking_settings');

Deno.test('commission 1% with no guest fee loses money and is rejected', async () => {
  writes = [];
  const response = await handler!(put({ commissionPct: 0.01, guestFeePct: 0, guestFeeFixed: 0 }));
  assertEquals(response.status, 400);
  const body = (await response.json()) as { error?: string };
  assert(body.error?.includes('lose money'), body.error);
  assertEquals(settingsWrites().length, 0, 'nothing may be saved');
});

Deno.test('a high fixed guest fee with a zero percentage is rejected on its slope', async () => {
  writes = [];
  const response = await handler!(
    put({ commissionPct: 0, directCommissionPct: 0, guestFeePct: 0.01, guestFeeFixed: 500 })
  );
  assertEquals(response.status, 400);
  assertEquals(settingsWrites().length, 0);
});

Deno.test('the default settings are accepted and saved', async () => {
  writes = [];
  const response = await handler!(
    put({
      commissionPct: 0.1,
      directCommissionPct: 0.05,
      guestFeePct: 0.05,
      guestFeeFixed: 15,
      paymentFeePct: 0.03125,
      paymentFeeFixed: 15,
    })
  );
  assertEquals(response.status, 200);
  assertEquals(settingsWrites().length, 1);
  assertEquals(settingsWrites()[0].body?.guest_fee_pct, 0.05);
});

Deno.test('a profitable change to one field is accepted', async () => {
  writes = [];
  const response = await handler!(put({ guestFeePct: 0.06 }));
  assertEquals(response.status, 200);
  assertEquals(settingsWrites()[0].body?.guest_fee_pct, 0.06);
});

Deno.test('an out-of-range guest fee is a validation error', async () => {
  writes = [];
  const response = await handler!(put({ guestFeePct: 1.5 }));
  assertEquals(response.status, 400);
  assertEquals(settingsWrites().length, 0);
});
