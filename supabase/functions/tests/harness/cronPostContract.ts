import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * Shared HTTP contract for a `serveCronPost` endpoint.
 *
 * Every scheduled job is reachable over HTTP, so the guard in front of it is a security
 * boundary: a wrong verb or a missing/wrong shared secret must be refused before the job runs.
 * Each cron gets a three-line `tests/handlers/<fn>.test.ts`; the family lives here.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

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

const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

export function cronPostContract(name: string, envKey: string, headerName: string): void {
  /**
   * Deno runs every test file in one process, so an env var set here leaks into later files and
   * can change their behaviour (fail-closed crons suddenly reject). Save once, restore after each
   * case.
   */
  const previousEnv = Deno.env.get('ENVIRONMENT');
  const previousSecret = Deno.env.get(envKey);

  function restoreEnv() {
    if (previousEnv === undefined) Deno.env.delete('ENVIRONMENT');
    else Deno.env.set('ENVIRONMENT', previousEnv);
    if (previousSecret === undefined) Deno.env.delete(envKey);
    else Deno.env.set(envKey, previousSecret);
  }

  function request(method: string, secret?: string): Request {
    return new Request(`${FUNCTIONS_URL}/${name}`, {
      method,
      headers: secret ? { [headerName]: secret } : {},
    });
  }

  async function handlerFor() {
    await import(`../../${name}/index.ts`);
    const handler = getMountedEdgeHandler(name);
    assert(handler, `${name} must mount through serveCronPost`);
    calls = [];
    return handler!;
  }

  function configureSecret(secret: string | undefined) {
    if (secret === undefined) Deno.env.delete(envKey);
    else Deno.env.set(envKey, secret);
    // Unset ENVIRONMENT counts as production, which is what makes the fail-closed case real.
    Deno.env.set('ENVIRONMENT', 'production');
  }

  Deno.test(`${name} rejects a non-POST verb`, async () => {
    configureSecret('test-secret');
    const handler = await handlerFor();

    const response = await handler(request('GET'));

    // 405 is the precise code; some wrappers flatten the method guard to 400. The invariant
    // is the rejection without running the job.
    restoreEnv();
    assert([400, 405].includes(response.status), `got ${response.status}`);
    assertEquals(calls, [], 'a wrong verb must not run the job');
  });

  Deno.test(`${name} refuses a run without the shared secret`, async () => {
    configureSecret('test-secret');
    const handler = await handlerFor();

    const response = await handler(request('POST'));

    restoreEnv();
    assertEquals(response.status, 401);
    assertEquals(calls, [], 'an unauthenticated run must not touch data');
  });

  Deno.test(`${name} refuses a wrong secret`, async () => {
    configureSecret('test-secret');
    const handler = await handlerFor();

    const response = await handler(request('POST', 'wrong-secret'));

    restoreEnv();
    assertEquals(response.status, 401);
    assertEquals(calls, []);
  });

  Deno.test(`${name} fails closed in production when the secret is unset`, async () => {
    configureSecret(undefined);
    const handler = await handlerFor();

    const response = await handler(request('POST'));

    restoreEnv();
    assertEquals(response.status, 401);
    assertEquals(calls, []);
  });
}
