import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for `marketing-trends-cron`.
 *
 * Covers the cron secret gate and the failure posture: when the pipeline cannot
 * publish, the handler still answers through `serveCronPost` and the run is recorded
 * as failed, because a scheduled job that dies silently is the worst failure mode.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';
const SECRET = 'test-trends-secret';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'k');
Deno.env.set('MARKETING_TRENDS_CRON_SECRET', SECRET);
Deno.env.set('ENVIRONMENT', 'production');

type Write = { table: string; body: unknown };

const writes: Write[] = [];

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? 'GET';
  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    );

  // Every source fails, which is the "no source returned enough candidates" path.
  if (/trends\.google\.com|wikimedia\.org|marketingtools\.apple\.com/.test(url)) {
    return json({ message: 'upstream down' }, 503);
  }

  if (method !== 'GET' && method !== 'HEAD') {
    const table = url.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? 'unknown';
    writes.push({ table, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.includes('/marketing_trend_runs') && method === 'POST') {
      return json([{ id: 'run-1' }], 201);
    }
    return json([], 201);
  }

  return json([]);
}) as typeof fetch;

await import('../../marketing-trends-cron/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const cron = getMountedEdgeHandler('marketing-trends-cron');
assert(cron, 'the cron wrapper must mount a handler in test mode');

function request(secret?: string): Request {
  return new Request(`${FUNCTIONS_URL}/marketing-trends-cron`, {
    method: 'POST',
    headers: secret ? { 'x-marketing-trends-cron-secret': secret } : {},
  });
}

type Envelope = {
  success?: boolean;
  error?: string;
  status?: string;
  topicCount?: number;
  sources?: Record<string, { ok: boolean; error: string | null }>;
};

Deno.test('the cron refuses a call without the secret in production', async () => {
  const response = await cron!(request());
  assertEquals(response.status, 401);
});

Deno.test('the cron refuses a wrong secret', async () => {
  const response = await cron!(request('nope'));
  assertEquals(response.status, 401);
});

Deno.test('when every source is down the run is recorded as failed, not published', async () => {
  writes.length = 0;
  const response = await cron!(request(SECRET));
  assertEquals(response.status, 200);

  const body = (await response.json()) as Envelope;
  assertEquals(body.success, true);
  assertEquals(body.status, 'failed');
  assertEquals(body.topicCount, 0);
  assert(body.error, 'the failure reason must be reported');

  // The run row is opened and then closed as failed; nothing is published.
  const runWrites = writes.filter((entry) => entry.table === 'marketing_trend_runs');
  assert(runWrites.length >= 1, 'the run ledger must record the attempt');
  assertEquals(
    writes.some((entry) => entry.table === 'marketing_trend_topics'),
    false,
    'a failed run must not write topics'
  );

  // Each source reports its own failure, so an operator can see which one broke.
  const stats = Object.values(body.sources ?? {});
  assert(stats.length >= 3, 'every daily source must be reported');
  assert(
    stats.every((stat) => stat.ok === false),
    'every source failed in this scenario'
  );
});
