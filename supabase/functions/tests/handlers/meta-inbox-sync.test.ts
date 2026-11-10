import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the Meta inbox sync endpoint. Drives the real authenticated wrapper:
 * the JWT check, the request envelope and the action validation that runs before any
 * database work. Supabase is stubbed at `fetch`.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('ENVIRONMENT', 'development');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

const AUTH_EMAILS: Record<string, string> = { 'host-token': 'host@example.test' };

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/auth/v1/user')) {
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const email = AUTH_EMAILS[token];
    if (!email) {
      return Promise.resolve(
        new Response(JSON.stringify({ message: 'invalid token' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ id: 'user-1', email }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  }
  return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
}) as typeof fetch;

const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');
await import('../../meta-inbox-sync/index.ts');

const handler = getMountedEdgeHandler('meta-inbox-sync');
if (!handler) throw new Error('meta-inbox-sync did not mount a handler');

function request(opts: {
  method?: string;
  token?: string | null;
  body?: unknown;
}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? 'host-token'}`;
  return new Request(`${FUNCTIONS_URL}/functions/v1/meta-inbox-sync`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(opts.body ?? {}),
  });
}

Deno.test('meta-inbox-sync: rejects a method other than POST', async () => {
  const res = await handler(request({ method: 'GET' }));
  assertEquals(res.status, 405);
});

Deno.test('meta-inbox-sync: rejects an unauthenticated caller', async () => {
  const res = await handler(request({ token: null, body: { action: 'status' } }));
  assertEquals(res.status, 401);
});

Deno.test('meta-inbox-sync: rejects an unknown action before touching the database', async () => {
  const res = await handler(request({ body: { action: 'drop-everything' } }));
  assertEquals(res.status, 400);
  const body = (await res.json()) as { error: string };
  assertEquals(body.error.includes('status'), true);
});
