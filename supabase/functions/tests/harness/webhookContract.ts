import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * Shared HTTP contract for a public webhook endpoint.
 *
 * These are `verify_jwt=false` by contract, so the provider signature is the only thing
 * standing between the internet and a write. Every one of them must refuse a request with no
 * signature, a wrong signature, or a tampered body, and must do it before any database work.
 *
 * Each webhook gets a thin `tests/handlers/<fn>.test.ts` that calls this with its signature
 * header, plus any provider-specific cases below it in that file.
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

export type WebhookContract = {
  name: string;
  /** Signature header the provider sends. */
  signatureHeader: string;
  /** Secret env var the verifier reads; set to a test value so verification is exercised. */
  secretEnvKey?: string;
  /** Sample payload the provider would POST. */
  payload: string;
};

export function webhookContract(contract: WebhookContract): void {
  /**
   * A webhook may read platform settings before it verifies the signature (maintenance mode is
   * checked first for some handlers), so the invariant is "no write and no booking read", not
   * "no request at all".
   */
  function assertNoWrites() {
    const offending = calls.filter(
      (call) =>
        // The public rate limiter counters every hit, including a rejected one; that is the
        // only allowed write. Everything else here would be the webhook acting on unverified
        // input.
        (/^(POST|PATCH|PUT|DELETE) /.test(call) && !call.includes('rpc/bump_rate_limit')) ||
        call.includes('guest_submissions')
    );
    assertEquals(offending.join(' | '), '', 'an unverified webhook must not write or read bookings');
  }

  const { name, signatureHeader, secretEnvKey, payload } = contract;

  async function handlerFor() {
    if (secretEnvKey) Deno.env.set(secretEnvKey, 'test-webhook-secret');
    await import(`../../${name}/index.ts`);
    const handler = getMountedEdgeHandler(name);
    assert(handler, `${name} must mount through a public wrapper`);
    calls = [];
    return handler!;
  }

  Deno.test(`${name} refuses a request with no signature`, async () => {
    const handler = await handlerFor();
    const response = await handler(
      new Request(`${FUNCTIONS_URL}/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      })
    );

    assert(
      response.status >= 400 && response.status < 500,
      `${name} must reject an unsigned request, got ${response.status}`
    );
    assertNoWrites();
  });

  Deno.test(`${name} refuses a wrong signature`, async () => {
    const handler = await handlerFor();
    const response = await handler(
      new Request(`${FUNCTIONS_URL}/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [signatureHeader]: 'deadbeef' },
        body: payload,
      })
    );

    assert(
      response.status >= 400 && response.status < 500,
      `${name} must reject a bad signature, got ${response.status}`
    );
    assertNoWrites();
  });
}
