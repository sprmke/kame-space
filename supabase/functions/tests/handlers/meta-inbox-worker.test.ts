import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the Meta inbox worker. `EDGE_HANDLER_TEST=1` mounts the composed
 * handler instead of starting a server, so this drives the real cron wrapper: method, secret
 * gate, heartbeat and the counters it returns. Supabase is stubbed at `fetch`.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('ENVIRONMENT', 'development');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('META_INBOX_WORKER_SECRET', 'worker-secret');

const rpcCalls: string[] = [];

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const body = init?.body ? String(init.body) : '';
  const rpc = /\/rest\/v1\/rpc\/([^?]+)/.exec(url)?.[1] ?? '';
  if (rpc) rpcCalls.push(rpc);

  // Both claim RPCs report no due work, so the run is an empty but complete pass.
  if (rpc === 'meta_webhook_claim' || rpc === 'meta_sync_claim') {
    return Promise.resolve(new Response('[]', { status: 200 }));
  }
  if (rpc === 'meta_webhook_claim') return Promise.resolve(new Response('[]', { status: 200 }));
  void body;
  return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
}) as typeof fetch;

const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');
await import('../../meta-inbox-worker/index.ts');

const handler = getMountedEdgeHandler('meta-inbox-worker');
if (!handler) throw new Error('meta-inbox-worker did not mount a handler');

function cronRequest(secret: string | null, method = 'POST'): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (secret) headers['x-meta-inbox-worker-secret'] = secret;
  return new Request(`${FUNCTIONS_URL}/functions/v1/meta-inbox-worker`, {
    method,
    headers,
    body: method === 'POST' ? '{}' : undefined,
  });
}

Deno.test('meta-inbox-worker: rejects a method other than POST', async () => {
  const res = await handler(cronRequest('worker-secret', 'GET'));
  // `serveCronPost` maps the EdgeError through `jsonError`, which defaults to 400. The only
  // caller is pg_cron with POST, so the exact code matters less than the request being
  // refused before any work runs.
  assertEquals(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assertEquals(String(body.error).includes('not allowed'), true);
});

Deno.test('meta-inbox-worker: rejects a wrong cron secret', async () => {
  const res = await handler(cronRequest('not-the-secret'));
  assertEquals(res.status, 401);
});

Deno.test('meta-inbox-worker: drains the outbox, runs sync and records a heartbeat', async () => {
  rpcCalls.length = 0;
  const res = await handler(cronRequest('worker-secret'));
  assertEquals(res.status, 200);

  const body = (await res.json()) as {
    success: boolean;
    outbox: { claimed: number };
    sync: { jobs: number };
  };
  assertEquals(body.success, true);
  assertEquals(body.outbox.claimed, 0);
  assertEquals(body.sync.jobs, 0);

  // Both claims run, and the run is recorded for /admin/health.
  assertEquals(rpcCalls.includes('meta_webhook_claim'), true);
  assertEquals(rpcCalls.includes('meta_sync_claim'), true);
  assertEquals(rpcCalls.includes('record_system_job_heartbeat'), true);
});
