import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for a real edge function. `EDGE_HANDLER_TEST=1` makes `serveEdge` mount
 * the composed handler instead of starting a server, so this drives the actual wrapper:
 * auth, envelope, cache headers and the public payload. Supabase is stubbed at `fetch`,
 * which is the only boundary the handler crosses.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');
Deno.env.set('SUPER_ADMIN_EMAILS', 'boss@example.test');

const OFFS = [
  {
    feature_key: 'pricing.channel_sync',
    is_enabled: false,
    reason: 'maintenance',
    message: null,
    expected_back_at: null,
    auto_restore: false,
    show_banner: true,
    super_admin_bypass: true,
    updated_at: '2026-11-01T00:00:00.000Z',
  },
];

const EMAILS: Record<string, string> = {
  'host-token': 'host@example.test',
  'super-token': 'boss@example.test',
};

function stubSupabase(rows: unknown[] = OFFS) {
  const calls: string[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);

    if (url.includes('/auth/v1/user')) {
      const auth = new Headers(init?.headers).get('authorization') ?? '';
      const token = auth.replace(/^Bearer\s+/i, '');
      const email = EMAILS[token];
      if (!email) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'invalid token' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ user: { id: 'user-1', email } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }

    if (url.includes('/rest/v1/feature_availability_overrides')) {
      return Promise.resolve(
        new Response(JSON.stringify(rows), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
    );
  }) as typeof fetch;
  return { calls };
}

stubSupabase();
await import('../../get-feature-availability/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('get-feature-availability');
assert(handler, 'the wrapper must mount a handler in test mode');

function request(token?: string): Request {
  return new Request(`${FUNCTIONS_URL}/get-feature-availability`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

type Entry = Record<string, unknown> & { key?: string; available?: boolean };

type Envelope = {
  success?: boolean;
  error?: string;
  /** `jsonSuccess` wraps the payload: `{ success: true, data }`. */
  data?: { serverNow?: string; entries?: Entry[] };
  entries?: Entry[];
};

Deno.test('get-feature-availability returns the off keys with the server clock', async () => {
  const response = await handler!(request('host-token'));
  assertEquals(response.status, 200);

  const body = (await response.json()) as Envelope;
  assertEquals(body.success, true);
  assert(body.data?.serverNow && !Number.isNaN(Date.parse(body.data.serverNow)));
  assert(
    response.headers.get('cache-control')?.includes('private'),
    'a per-viewer payload must never be shared-cached'
  );

  const entry = body.data?.entries?.find((row) => row.key === 'pricing.channel_sync');
  assert(entry, 'the disabled key must be reported');
  assertEquals(entry.available, false);
  assertEquals(entry.reason, 'maintenance');
  assertEquals(entry.showBanner, true);

  // The client defaults an absent key to available, so an enabled key must not be listed.
  assertEquals(
    body.data?.entries?.some((row) => row.key === 'inbox.meta'),
    false
  );
});

Deno.test('get-feature-availability leaks no guest or host PII', async () => {
  const body = (await (await handler!(request('host-token'))).json()) as Envelope;
  const text = JSON.stringify(body);

  assertEquals(text.includes('@example.test'), false);
  assertEquals(text.includes('user-1'), false);
});

Deno.test('a super admin sees the same entry as bypassed, not as available-feature omission', async () => {
  const body = (await (await handler!(request('super-token'))).json()) as Envelope;

  assertEquals(body.success, true);
  const entry = body.data?.entries?.find((row) => row.key === 'pricing.channel_sync');
  assert(entry, 'the off key stays listed so the host knows it exists');
  assertEquals(entry.bypassed, true);
  assertEquals(entry.available, true);
});

Deno.test('the wrapper rejects a missing bearer token before the handler runs', async () => {
  const response = await handler!(request());
  assertEquals(response.status, 401);

  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assert(typeof body.error === 'string' && body.error.length > 0);
});

Deno.test('the wrapper rejects an invalid session', async () => {
  const response = await handler!(request('not-a-real-token'));
  assertEquals(response.status, 401);
});

/*
 * Fail-open on a read error is unit-tested in `featureAvailabilityResolve_test.ts`. It is
 * not re-tested here: `loadOverrideRows` caches for 60 s per isolate, so a second dataset
 * in this file would be served from the cache rather than exercised.
 */
