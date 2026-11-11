import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for the pending-review-expiry cron.
 *
 * The sweep itself is policy-tested in `_shared/pendingReviewPolicy_test.ts`. What matters here
 * is the boundary: a scheduled job that frees calendar dates must never be triggerable by an
 * unauthenticated caller, and must answer `ok` when it runs.
 *
 * `EDGE_HANDLER_TEST=1` mounts the composed handler instead of starting a server; Supabase is
 * stubbed at `fetch`, so the candidate query returns no rows and the sweep is a no-op.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';
const SECRET = 'test-pending-review-expiry-secret';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');
Deno.env.set('ENVIRONMENT', 'production');
Deno.env.set('PENDING_REVIEW_EXPIRY_CRON_SECRET', SECRET);

const calls: string[] = [];
globalThis.fetch = ((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  calls.push(url);
  return Promise.resolve(
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  );
}) as typeof fetch;

await import('../../pending-review-expiry/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('pending-review-expiry');
assert(handler, 'the wrapper must mount a handler in test mode');

function request(secret?: string): Request {
  return new Request(`${FUNCTIONS_URL}/pending-review-expiry`, {
    method: 'POST',
    headers: secret ? { 'x-pending-review-expiry-cron-secret': secret } : {},
  });
}

Deno.test('pending-review-expiry rejects a caller without the cron secret', async () => {
  const response = await handler!(request());
  assertEquals(response.status, 401);
  const body = (await response.json()) as { success?: boolean };
  assertEquals(body.success, false);
});

Deno.test('pending-review-expiry rejects the wrong secret', async () => {
  const response = await handler!(request('not-the-secret'));
  assertEquals(response.status, 401);
});

Deno.test('pending-review-expiry sweeps and reports counts with the secret', async () => {
  calls.length = 0;
  const response = await handler!(request(SECRET));
  assertEquals(response.status, 200);

  const body = (await response.json()) as {
    success?: boolean;
    candidates?: number;
    chased?: number;
    expired?: number;
    failed?: number;
  };
  assertEquals(body.success, true);
  assertEquals(body.candidates, 0);
  assertEquals(body.chased, 0);
  assertEquals(body.expired, 0);
  assertEquals(body.failed, 0);
});

Deno.test('pending-review-expiry only accepts POST', async () => {
  const response = await handler!(
    new Request(`${FUNCTIONS_URL}/pending-review-expiry`, {
      method: 'GET',
      headers: { 'x-pending-review-expiry-cron-secret': SECRET },
    })
  );
  assert(response.status >= 400, 'a GET must not run the sweep');
});
