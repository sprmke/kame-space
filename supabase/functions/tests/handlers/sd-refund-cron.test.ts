import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the SD refund cron.
 *
 * The sweep transitions bookings and emails guests, and pg_cron calls it with a shared secret.
 * The guard that matters is the one before the database: an unauthenticated global sweep must
 * be refused, and it must fail closed when the operator has not provisioned the secret.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

/*
 * Deno runs every handler test file in one process, so an env var set here changes later
 * files: `ENVIRONMENT=production` makes unrelated crons fail closed. Capture the originals and
 * put them back in a final test, which runs last in this file.
 */
const ORIGINAL_ENVIRONMENT = Deno.env.get('ENVIRONMENT');
const ORIGINAL_SECRET = Deno.env.get('SD_REFUND_CRON_SECRET');

function restoreEnvironmentForLaterFiles() {
  if (ORIGINAL_ENVIRONMENT === undefined) Deno.env.delete('ENVIRONMENT');
  else Deno.env.set('ENVIRONMENT', ORIGINAL_ENVIRONMENT);
  if (ORIGINAL_SECRET === undefined) Deno.env.delete('SD_REFUND_CRON_SECRET');
  else Deno.env.set('SD_REFUND_CRON_SECRET', ORIGINAL_SECRET);
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

await import('../../sd-refund-cron/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('sd-refund-cron');
assert(handler, 'serveHandler must mount sd-refund-cron in test mode');

type Envelope = { success?: boolean; error?: string };

function sweep(secret?: string): Request {
  return new Request(`${FUNCTIONS_URL}/sd-refund-cron`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { 'x-sd-refund-cron-secret': secret } : {}),
    },
    body: '{}',
  });
}

function configure(options: { secret?: string; environment?: string }) {
  calls = [];
  if (options.secret === undefined) Deno.env.delete('SD_REFUND_CRON_SECRET');
  else Deno.env.set('SD_REFUND_CRON_SECRET', options.secret);

  if (options.environment === undefined) Deno.env.delete('ENVIRONMENT');
  else Deno.env.set('ENVIRONMENT', options.environment);
}

Deno.test('sd-refund-cron refuses an unscoped sweep without the shared secret', async () => {
  configure({ secret: 'test-secret', environment: 'production' });
  const response = await handler!(sweep());

  assertEquals(response.status, 401);
  const body = (await response.json()) as Envelope;
  assertEquals(body.success, false);
  assertEquals(body.error, 'Unauthorized');
  assertEquals(calls, [], 'an unauthenticated sweep must not read bookings');
});

Deno.test('sd-refund-cron refuses a wrong secret', async () => {
  configure({ secret: 'test-secret', environment: 'production' });
  const response = await handler!(sweep('wrong-secret'));

  assertEquals(response.status, 401);
  assertEquals(calls, []);
});

Deno.test('sd-refund-cron fails closed in production when the secret is unset', async () => {
  // An unset ENVIRONMENT counts as production, so a misconfigured deploy cannot be swept
  // by an anonymous caller. This is the property the shared gate exists for.
  configure({ secret: undefined, environment: undefined });
  const response = await handler!(sweep());

  assertEquals(response.status, 401);
  const body = (await response.json()) as Envelope;
  assertEquals(body.error, 'Unauthorized');
  assertEquals(calls, []);
});

Deno.test('restores the environment for later test files', () => {
  restoreEnvironmentForLaterFiles();
});
