import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for `marketing-trends-cron` and `marketing-trends-weekly-cron`.
 *
 * The things worth proving here are the two things that only exist at the HTTP edge:
 * the cron secret gate, and that the handlers answer in the `serveCronPost` envelope.
 * The pipeline's own rules are covered in `_shared/marketingTrends/pipeline_test.ts`;
 * the nightly run is not exercised end to end because that needs the source network
 * and a real database.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';
const SECRET = 'test-trends-secret';

/*
 * Deno runs every handler test file in one process, so `ENVIRONMENT=production` set below
 * changes later files: public write handlers start enforcing captcha. Capture the originals
 * and put them back in a final test, which runs last in this file.
 */
const ORIGINAL_ENVIRONMENT = Deno.env.get('ENVIRONMENT');
const ORIGINAL_CRON_SECRET = Deno.env.get('MARKETING_TRENDS_CRON_SECRET');

function restoreEnvironmentForLaterFiles() {
  if (ORIGINAL_ENVIRONMENT === undefined) Deno.env.delete('ENVIRONMENT');
  else Deno.env.set('ENVIRONMENT', ORIGINAL_ENVIRONMENT);
  if (ORIGINAL_CRON_SECRET === undefined) Deno.env.delete('MARKETING_TRENDS_CRON_SECRET');
  else Deno.env.set('MARKETING_TRENDS_CRON_SECRET', ORIGINAL_CRON_SECRET);
}

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('MARKETING_TRENDS_CRON_SECRET', SECRET);
Deno.env.set('ENVIRONMENT', 'production');

const TODAY_TSV = [
  'week\tcategory\tshow\tnetflix_country_code',
  '2026-11-01\tFilms\tOlder Film\tPH',
  '2026-11-08\tFilms\tNewest Film\tPH',
  '2026-11-08\tFilms\tNot Ours\tUS',
].join('\n');

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

  if (url.includes('netflix.com')) {
    return Promise.resolve(new Response(TODAY_TSV, { status: 200 }));
  }

  if (method !== 'GET' && method !== 'HEAD') {
    const table = url.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? 'unknown';
    writes.push({ table, body: init?.body ? JSON.parse(String(init.body)) : null });
    return json([{ id: 'run-1' }], 201);
  }

  // Any read returns an empty set: no cached Netflix week, no manual topics, no runs.
  return json([]);
}) as typeof fetch;

await import('../../marketing-trends-weekly-cron/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const weekly = getMountedEdgeHandler('marketing-trends-weekly-cron');
assert(weekly, 'the weekly wrapper must mount a handler in test mode');

function request(secret?: string): Request {
  return new Request(`${FUNCTIONS_URL}/marketing-trends-weekly-cron`, {
    method: 'POST',
    headers: secret ? { 'x-marketing-trends-cron-secret': secret } : {},
  });
}

type Envelope = { success?: boolean; error?: string; status?: string; count?: number };

Deno.test('the weekly cron refuses a call without the secret in production', async () => {
  const response = await weekly!(request());
  assertEquals(response.status, 401);
});

Deno.test('the weekly cron refuses a wrong secret', async () => {
  const response = await weekly!(request('not-the-secret'));
  assertEquals(response.status, 401);
});

Deno.test('the weekly cron stores the newest Philippine week and nothing else', async () => {
  writes.length = 0;
  const response = await weekly!(request(SECRET));
  assertEquals(response.status, 200);

  const body = (await response.json()) as Envelope;
  assertEquals(body.success, true);
  assertEquals(body.status, 'published');
  assertEquals(body.count, 1);

  const cache = writes.find((entry) => entry.table === 'marketing_trend_source_cache');
  assert(cache, 'the cache row must be written');
  const payload = cache!.body as {
    source: string;
    items: Array<{ title: string; rank: number }>;
    error: string | null;
  };
  assertEquals(payload.source, 'netflix');
  assertEquals(payload.items.length, 1);
  assertEquals(payload.items[0]?.title, 'Newest Film');
  assertEquals(payload.items[0]?.rank, 1);
  assertEquals(payload.error, null);
});

Deno.test('restores the environment for later test files', () => {
  restoreEnvironmentForLaterFiles();
});
