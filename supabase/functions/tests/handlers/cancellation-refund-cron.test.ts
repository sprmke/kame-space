import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the cancellation refund cron.
 *
 * It expires stale cancellation requests, so an unauthenticated run must be refused before any
 * row is touched, and it must fail closed when the operator has not provisioned the secret.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

/*
 * Deno runs every handler test file in one process, so an env var set here changes later
 * files: `ENVIRONMENT=production` makes unrelated crons fail closed. Capture the originals and
 * put them back in a final test, which runs last in this file.
 */
const ORIGINAL_ENVIRONMENT = Deno.env.get('ENVIRONMENT');
const ORIGINAL_SECRET = Deno.env.get('CANCELLATION_REFUND_CRON_SECRET');

function restoreEnvironmentForLaterFiles() {
  if (ORIGINAL_ENVIRONMENT === undefined) Deno.env.delete('ENVIRONMENT');
  else Deno.env.set('ENVIRONMENT', ORIGINAL_ENVIRONMENT);
  if (ORIGINAL_SECRET === undefined) Deno.env.delete('CANCELLATION_REFUND_CRON_SECRET');
  else Deno.env.set('CANCELLATION_REFUND_CRON_SECRET', ORIGINAL_SECRET);
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

await import('../../cancellation-refund-cron/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('cancellation-refund-cron');
assert(handler, 'serveCronPost must mount cancellation-refund-cron in test mode');

type Envelope = { success?: boolean; error?: string };

function run(secret?: string): Request {
  return new Request(`${FUNCTIONS_URL}/cancellation-refund-cron`, {
    method: 'POST',
    headers: secret ? { 'x-cancellation-refund-cron-secret': secret } : {},
  });
}

function configure(secret: string | undefined) {
  calls = [];
  if (secret === undefined) Deno.env.delete('CANCELLATION_REFUND_CRON_SECRET');
  else Deno.env.set('CANCELLATION_REFUND_CRON_SECRET', secret);
  Deno.env.set('ENVIRONMENT', 'production');
}

Deno.test('cancellation-refund-cron rejects a non-POST verb', async () => {
  configure('test-secret');
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/cancellation-refund-cron`, { method: 'GET' })
  );

  // 405 is the precise code; this wrapper's catch flattens the thrown method guard to 400,
  // the same status flattening recorded for the upload endpoints.
  assert([400, 405].includes(response.status), `got ${response.status}`);
  assertEquals(calls, []);
});

Deno.test('cancellation-refund-cron refuses a run without the shared secret', async () => {
  configure('test-secret');
  const response = await handler!(run());

  assertEquals(response.status, 401);
  const body = (await response.json()) as Envelope;
  assertEquals(body.error, 'Unauthorized');
  assertEquals(calls, [], 'an unauthenticated run must not touch cancellation rows');
});

Deno.test('cancellation-refund-cron fails closed in production when the secret is unset', async () => {
  configure(undefined);
  const response = await handler!(run());

  assertEquals(response.status, 401);
  assertEquals(calls, []);
});

Deno.test('restores the environment for later test files', () => {
  restoreEnvironmentForLaterFiles();
});
