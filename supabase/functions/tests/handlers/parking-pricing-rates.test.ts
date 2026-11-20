import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the host rate rules on `parking-pricing`: ₱100 minimum on base rates and
 * date overrides, and no maximum. Drives the real `serveAuthenticated` wrapper as the parking
 * owner; Supabase is stubbed at `fetch`.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

const PARKING = { id: 'parking-1', organization_id: 'org-1', slug: 'slot-1', name: 'Slot 1' };
const ORG = { id: 'org-1', owner_id: 'user-1', slug: 'org-one', name: 'Org One' };

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
  const rows = (list: Array<Record<string, unknown>>) =>
    json(wantsObject ? (list[0] ?? null) : list);

  if (url.includes('/auth/v1/user')) {
    const token = (headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (token !== 'owner-token') return json({ message: 'invalid token' }, 401);
    return json({ user: { id: 'user-1', email: 'owner@example.test' } });
  }

  const table = url.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? 'unknown';
  if (method !== 'GET' && method !== 'HEAD') {
    writes.push({ method, table, body: init?.body ? JSON.parse(String(init.body)) : null });
    return json(wantsObject ? {} : [], method === 'POST' ? 201 : 200);
  }
  if (table === 'parkings') return rows([PARKING]);
  if (table === 'organizations') return rows([ORG]);
  if (table === 'parking_settings') {
    return rows([
      { parking_id: 'parking-1', weekday_nightly_rate: 300, weekend_nightly_rate: 400 },
    ]);
  }
  return rows([]);
}) as typeof fetch;

await import('../../parking-pricing/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');
const handler = getMountedEdgeHandler('parking-pricing');
assert(handler, 'the wrapper must mount a handler in test mode');

function patch(body: Record<string, unknown>): Request {
  return new Request(`${FUNCTIONS_URL}/parking-pricing?parking_id=parking-1`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer owner-token' },
    body: JSON.stringify(body),
  });
}

const settingsWrites = () => writes.filter((w) => w.table === 'parking_settings');

Deno.test('a weekday rate under the minimum is rejected and nothing is written', async () => {
  writes = [];
  const response = await handler!(patch({ weekdayNightlyRate: 99 }));
  assertEquals(response.status, 400);
  assertEquals(settingsWrites().length, 0);
});

Deno.test('a weekend rate under the minimum is rejected', async () => {
  writes = [];
  const response = await handler!(patch({ weekendNightlyRate: 0 }));
  assertEquals(response.status, 400);
  assertEquals(settingsWrites().length, 0);
});

Deno.test('a date override under the minimum is rejected', async () => {
  writes = [];
  const response = await handler!(patch({ dateOverrides: { '2027-08-25': 99 } }));
  assertEquals(response.status, 400);
  const body = (await response.json()) as { error?: string };
  assert(body.error?.includes('2027-08-25'), body.error);
});

Deno.test('the minimum rate itself is accepted and saved', async () => {
  writes = [];
  const response = await handler!(patch({ weekdayNightlyRate: 100 }));
  assertEquals(response.status, 200);
  assert(
    settingsWrites().some((w) => w.body?.weekday_nightly_rate === 100),
    JSON.stringify(writes)
  );
});

Deno.test('there is no maximum rate', async () => {
  writes = [];
  const response = await handler!(
    patch({ weekdayNightlyRate: 50_000, weekendNightlyRate: 75_000 })
  );
  assertEquals(response.status, 200);
  assert(settingsWrites().some((w) => w.body?.weekday_nightly_rate === 50_000));
});
