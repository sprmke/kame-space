import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for `admin-marketing-trends`.
 *
 * Drives the real `serveSuperAdmin` wrapper: the super-admin gate, the action
 * switch, the audit write and the run-now cooldown. Supabase is stubbed at `fetch`.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPER_ADMIN_EMAILS', 'boss@example.test');

const EMAILS: Record<string, string> = {
  'boss-token': 'boss@example.test',
  'host-token': 'host@example.test',
};

type Insert = { table: string; body: unknown };

type Scenario = {
  /** Rows returned for `marketing_trend_runs`, newest first. */
  runs: Array<Record<string, unknown>>;
  /** The last manual run, for the cooldown check. */
  lastManualAt: string | null;
  inserts: Insert[];
};

const scenario: Scenario = { runs: [], lastManualAt: null, inserts: [] };

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

  if (url.includes('/auth/v1/user')) {
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const email = EMAILS[token];
    if (!email) return json({ message: 'invalid token' }, 401);
    return json({ user: { id: 'user-1', email } });
  }

  // Any write is an audit row, an override, a manual topic or a new run.
  if (method !== 'GET' && method !== 'HEAD') {
    const table = url.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? 'unknown';
    scenario.inserts.push({ table, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.includes('/marketing_trend_runs')) return json([{ id: 'run-new' }], 201);
    return json([], 201);
  }

  if (url.includes('/rest/v1/marketing_trend_runs')) {
    if (url.includes('trigger=eq.manual')) {
      return json(scenario.lastManualAt ? [{ started_at: scenario.lastManualAt }] : []);
    }
    return json(scenario.runs);
  }

  return json([]);
}) as typeof fetch;

await import('../../admin-marketing-trends/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');

const handler = getMountedEdgeHandler('admin-marketing-trends');
assert(handler, 'the wrapper must mount a handler in test mode');

function request(options: {
  token?: string;
  method?: string;
  body?: unknown;
}): Request {
  return new Request(`${FUNCTIONS_URL}/admin-marketing-trends`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

function resetScenario(over: Partial<Scenario> = {}): void {
  Object.assign(scenario, { runs: [], lastManualAt: null, inserts: [], ...over });
}

type Envelope = { success?: boolean; error?: string; data?: Record<string, unknown> };

Deno.test('a host who is not a super admin is rejected', async () => {
  resetScenario();
  const response = await handler!(request({ token: 'host-token' }));
  assertEquals(response.status, 403);
});

Deno.test('an unauthenticated request is rejected', async () => {
  resetScenario();
  const response = await handler!(request({}));
  assertEquals(response.status, 401);
});

Deno.test('GET returns the run ledger, the published list, overrides and manual topics', async () => {
  resetScenario({
    runs: [
      {
        id: 'run-1',
        run_date: '2026-11-10',
        status: 'published',
        trigger: 'cron',
        source_stats: { google_trends: { ok: true, count: 10, ms: 400, error: null } },
        candidate_count: 34,
        topic_count: 6,
      },
    ],
  });

  const response = await handler!(request({ token: 'boss-token' }));
  assertEquals(response.status, 200);

  const body = (await response.json()) as Envelope;
  assertEquals(body.success, true);
  const data = body.data as { runs?: unknown[]; latestRunId?: string | null };
  assertEquals(data.runs?.length, 1);
  assertEquals(data.latestRunId, 'run-1');
});

Deno.test('hide writes an override and an audit row', async () => {
  resetScenario();
  const response = await handler!(
    request({ token: 'boss-token', method: 'POST', body: { action: 'hide', topicKey: 'pbb' } })
  );
  assertEquals(response.status, 200);

  const tables = scenario.inserts.map((entry) => entry.table);
  assert(tables.includes('marketing_trend_overrides'), 'the override must be written');
  assert(tables.includes('super_admin_audit_events'), 'the action must be audited');

  const override = scenario.inserts.find((entry) => entry.table === 'marketing_trend_overrides');
  assertEquals((override?.body as { action: string }).action, 'hide');
  assertEquals((override?.body as { topic_key: string }).topic_key, 'pbb');

  const audit = scenario.inserts.find((entry) => entry.table === 'super_admin_audit_events');
  assertEquals(
    (audit?.body as { action: string }).action,
    'marketing_trend_hidden'
  );
});

Deno.test('hide without a topic key is a 400, not an empty override', async () => {
  resetScenario();
  const response = await handler!(
    request({ token: 'boss-token', method: 'POST', body: { action: 'hide' } })
  );
  assertEquals(response.status, 400);
  assertEquals(scenario.inserts.length, 0);
});

Deno.test('unhide deletes the override and audits it', async () => {
  resetScenario();
  const response = await handler!(
    request({ token: 'boss-token', method: 'POST', body: { action: 'unhide', topicKey: 'pbb' } })
  );
  assertEquals(response.status, 200);
  const audit = scenario.inserts.find((entry) => entry.table === 'super_admin_audit_events');
  assertEquals((audit?.body as { action: string }).action, 'marketing_trend_unhidden');
});

Deno.test('adding a topic writes a 14-day manual row and audits it', async () => {
  resetScenario();
  const response = await handler!(
    request({
      token: 'boss-token',
      method: 'POST',
      body: { action: 'add-topic', title: 'Local festival', category: 'holiday_event' },
    })
  );
  assertEquals(response.status, 200);

  const manual = scenario.inserts.find(
    (entry) => entry.table === 'marketing_trend_manual_topics'
  );
  assert(manual, 'the manual topic must be written');
  const body = manual!.body as { title: string; category: string; active_to: string };
  assertEquals(body.title, 'Local festival');
  assertEquals(body.category, 'holiday_event');
  assert(body.active_to, 'the active window must be set');
});

Deno.test('an unknown action is rejected', async () => {
  resetScenario();
  const response = await handler!(
    request({ token: 'boss-token', method: 'POST', body: { action: 'delete-everything' } })
  );
  assertEquals(response.status, 400);
});

Deno.test('run now is refused inside the ten-minute cooldown', async () => {
  resetScenario({ lastManualAt: new Date(Date.now() - 60_000).toISOString() });
  const response = await handler!(
    request({ token: 'boss-token', method: 'POST', body: { action: 'run-now' } })
  );
  assertEquals(response.status, 429);
  // Nothing was started.
  assertEquals(
    scenario.inserts.some((entry) => entry.table === 'marketing_trend_runs'),
    false
  );
});
