import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the calendar sync cron.
 *
 * The global sweep imports OTA feeds, which costs provider quota and writes availability, so
 * an unauthenticated sweep must be refused before any feed is loaded.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

/*
 * Deno runs every handler test file in one process, so an env var set here changes later
 * files: `ENVIRONMENT=production` makes unrelated crons fail closed. Capture the originals and
 * put them back in a final test, which runs last in this file.
 */
const ORIGINAL_ENVIRONMENT = Deno.env.get('ENVIRONMENT');
const ORIGINAL_SECRET = Deno.env.get('CALENDAR_SYNC_CRON_SECRET');

function restoreEnvironmentForLaterFiles() {
  if (ORIGINAL_ENVIRONMENT === undefined) Deno.env.delete('ENVIRONMENT');
  else Deno.env.set('ENVIRONMENT', ORIGINAL_ENVIRONMENT);
  if (ORIGINAL_SECRET === undefined) Deno.env.delete('CALENDAR_SYNC_CRON_SECRET');
  else Deno.env.set('CALENDAR_SYNC_CRON_SECRET', ORIGINAL_SECRET);
}

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

let calls: string[] = [];
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push(`${init?.method ?? 'GET'} ${url}`);
  return Promise.resolve(
    new Response(JSON.stringify({ message: `unexpected fetch ${url}` }), { status: 599 })
  );
}) as typeof fetch;

await import('../../calendar-sync-cron/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('calendar-sync-cron');
assert(handler, 'serveHandler must mount calendar-sync-cron in test mode');

type Envelope = { success?: boolean; error?: string };

function sweep(secret?: string): Request {
  return new Request(`${FUNCTIONS_URL}/calendar-sync-cron`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { 'x-calendar-sync-cron-secret': secret } : {}),
    },
    body: '{}',
  });
}

function configure(secret: string | undefined) {
  calls = [];
  if (secret === undefined) Deno.env.delete('CALENDAR_SYNC_CRON_SECRET');
  else Deno.env.set('CALENDAR_SYNC_CRON_SECRET', secret);
  Deno.env.set('ENVIRONMENT', 'production');
}

Deno.test('calendar-sync-cron refuses a global sweep without the shared secret', async () => {
  configure('test-secret');
  const response = await handler!(sweep());

  assertEquals(response.status, 401);
  const body = (await response.json()) as Envelope;
  assertEquals(body.error, 'Unauthorized');
  assertEquals(calls, [], 'an unauthenticated sweep must not load feeds');
});

Deno.test('calendar-sync-cron fails closed in production when the secret is unset', async () => {
  configure(undefined);
  const response = await handler!(sweep());

  assertEquals(response.status, 401);
  assertEquals(calls, []);
});

Deno.test('restores the environment for later test files', () => {
  restoreEnvironmentForLaterFiles();
});
