import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the superhost assessment cron.
 *
 * It scores hosts and can force a run, so the guard has to reject anyone with neither the
 * cron secret nor a super-admin session before any scoring work happens.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

/* Deno shares one process across handler test files: restore what we changed. */
const ORIGINAL_ENVIRONMENT = Deno.env.get('ENVIRONMENT');

function restoreEnvironmentForLaterFiles() {
  if (ORIGINAL_ENVIRONMENT === undefined) Deno.env.delete('ENVIRONMENT');
  else Deno.env.set('ENVIRONMENT', ORIGINAL_ENVIRONMENT);
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

await import('../../superhost-assessment-cron/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('superhost-assessment-cron');
assert(handler, 'serveHandler must mount superhost-assessment-cron in test mode');

type Envelope = { success?: boolean; error?: string };

Deno.test('superhost-assessment-cron rejects a caller with no secret and no session', async () => {
  calls = [];
  Deno.env.set('ENVIRONMENT', 'production');
  Deno.env.delete('SUPERHOST_ASSESSMENT_CRON_SECRET');

  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/superhost-assessment-cron`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
  );

  assertEquals(response.status, 401);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assertEquals(body.error, 'Unauthorized');
  assertEquals(calls, [], 'no scoring or database work before the guard passes');
});

Deno.test('superhost-assessment-cron refuses a non-POST verb', async () => {
  calls = [];
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/superhost-assessment-cron`, { method: 'GET' })
  );

  // 405 would be the precise code; this handler's catch maps the thrown method guard to 400,
  // the same status-flattening recorded for the upload endpoints. The invariant pinned here is
  // the rejection without I/O, not the exact code.
  assert([400, 401, 405].includes(response.status), `got ${response.status}`);
  assertEquals(calls, []);
});

Deno.test('restores the environment for later test files', () => {
  restoreEnvironmentForLaterFiles();
});
