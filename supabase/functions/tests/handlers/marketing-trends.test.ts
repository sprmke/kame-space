import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * HTTP-level test for `marketing-trends`, the host read endpoint.
 *
 * `EDGE_HANDLER_TEST=1` makes `serveEdge` mount the composed handler instead of
 * starting a server, so this drives the real wrapper: auth, the property gate, the
 * availability kill switch, the envelope and the read rules. Supabase is stubbed at
 * `fetch`, which is the only boundary the handler crosses.
 *
 * The stub is installed once, before the handler module is imported, because
 * supabase-js binds `fetch` when it builds the client. Each test swaps the scenario
 * object instead of swapping the function.
 *
 * The read rules themselves (stale, expired, hide, pin, window availability) are
 * covered without a database in `_shared/marketingTrends/response_test.ts`; this file
 * proves the wiring.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('EDGE_HANDLER_TEST', '1');
Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');
Deno.env.set('SUPER_ADMIN_EMAILS', 'boss@example.test');

const EMAILS: Record<string, string> = {
  'host-token': 'host@example.test',
};

const PROPERTY_ID = 'e5555555-5555-4555-8555-555555555501';

/** A published run finishing a minute ago, so it is fresh. */
const FRESH_RUN = {
  id: 'run-1',
  run_date: '2026-11-10',
  started_at: new Date(Date.now() - 60_000).toISOString(),
  finished_at: new Date(Date.now() - 50_000).toISOString(),
};

function topicRow(over: Record<string, unknown> = {}) {
  return {
    id: 'topic-1',
    run_id: 'run-1',
    run_date: '2026-11-10',
    window: 'today',
    rank: 1,
    topic_key: 'pinoy-big-brother-collab-3-0',
    title: 'PBB Collab 3.0',
    summary: 'Fans are following the new housemates this week.',
    category: 'tv_film',
    stay_fit: 3,
    score: '2.1843',
    momentum: 'new',
    days_trending: 1,
    first_seen: '2026-11-10',
    sources: [{ source: 'google_trends', rank: 2 }],
    angles: [],
    caption_idea: 'Tonight is a staycation kind of night.',
    hashtags: ['#Staycation'],
    brand_guard: ['no_likeness'],
    pinned: false,
    manual: false,
    ...over,
  };
}

type Scenario = {
  /** `null` = no published run. */
  run: typeof FRESH_RUN | null;
  topics: Array<Record<string, unknown>>;
  overrides: Array<{ topic_key: string; action: string }>;
  /** Published-run count reported to the `count=exact` head request. */
  publishedRunCount: number;
  availabilityOff: boolean;
  /** False makes `resolve_property_access` come back empty. */
  hasAccess: boolean;
};

const scenario: Scenario = {
  run: FRESH_RUN,
  topics: [topicRow()],
  overrides: [],
  publishedRunCount: 3,
  availabilityOff: false,
  hasAccess: true,
};

function resetScenario(over: Partial<Scenario> = {}): void {
  // The availability snapshot is memoised per isolate for 60 s, so without this the
  // first test's scenario would decide every later one.
  resetFeatureAvailabilityCacheForTests();
  resetMarketingTrendsMemoForTests();
  Object.assign(scenario, {
    run: FRESH_RUN,
    topics: [topicRow()],
    overrides: [],
    publishedRunCount: 3,
    availabilityOff: false,
    hasAccess: true,
    ...over,
  });
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      })
    );

  if (url.includes('/auth/v1/user')) {
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const email = EMAILS[token];
    if (!email) return json({ message: 'invalid token' }, 401);
    return json({ user: { id: 'user-1', email } });
  }

  if (url.includes('/rest/v1/rpc/resolve_property_access')) {
    if (!scenario.hasAccess) return json([]);
    return json([
      {
        property: {
          id: PROPERTY_ID,
          organization_id: 'org-1',
          name: 'Trends Test Property',
          slug: 'trends-test-property',
          inactive_reason: null,
        },
        org: { id: 'org-1', name: 'Trends Test Org', slug: 'trends-test-org', owner_id: 'user-1' },
        org_member: null,
        property_member: null,
      },
    ]);
  }

  if (url.includes('/rest/v1/feature_availability_overrides')) {
    if (!scenario.availabilityOff) return json([]);
    return json([
      {
        feature_key: 'marketing.trends',
        is_enabled: false,
        reason: 'maintenance',
        message: null,
        expected_back_at: null,
        auto_restore: false,
        show_banner: true,
        super_admin_bypass: false,
        updated_at: '2026-11-01T00:00:00.000Z',
      },
    ]);
  }

  if (url.includes('/rest/v1/marketing_trend_runs')) {
    // supabase-js asks for a count with `Prefer: count=exact` and a HEAD-style request,
    // not a query param, so the header is what distinguishes the two reads.
    const prefer = new Headers(init?.headers).get('prefer') ?? '';
    if (prefer.includes('count=exact')) {
      return json([], 200, {
        'content-range': `0-0/${scenario.publishedRunCount}`,
      });
    }
    return json(scenario.run ? [scenario.run] : []);
  }

  if (url.includes('/rest/v1/marketing_trend_overrides')) return json(scenario.overrides);
  if (url.includes('/rest/v1/marketing_trend_topics')) return json(scenario.topics);

  // Rate-limit and platform-settings reads all fail open, which is the real posture.
  return json({ message: `unexpected fetch ${url}` }, 599);
}) as typeof fetch;

await import('../../marketing-trends/index.ts');
const { getMountedEdgeHandler } = await import('../../_shared/serveEdge.ts');
const { resetFeatureAvailabilityCacheForTests } = await import(
  '../../_shared/featureAvailability.ts'
);
const { resetMarketingTrendsMemoForTests } = await import('../../marketing-trends/index.ts');

const handler = getMountedEdgeHandler('marketing-trends');
assert(handler, 'the wrapper must mount a handler in test mode');

function request(options: { token?: string; window?: string } = {}): Request {
  const params = new URLSearchParams({ property_id: PROPERTY_ID });
  if (options.window) params.set('window', options.window);
  return new Request(`${FUNCTIONS_URL}/marketing-trends?${params.toString()}`, {
    method: 'GET',
    headers: options.token ? { Authorization: `Bearer ${options.token}` } : {},
  });
}

type Envelope = {
  success?: boolean;
  error?: string;
  data?: {
    disabled?: boolean;
    runDate?: string | null;
    stale?: boolean;
    fallback?: string | null;
    windowsAvailable?: string[];
    topics?: Array<{ topicKey: string; pinned: boolean; rank: number }>;
  };
};

async function call(
  options: { token?: string; window?: string } = { token: 'host-token' }
): Promise<Envelope & { status: number; cacheControl: string | null }> {
  const response = await handler!(request(options));
  return {
    ...((await response.json()) as Envelope),
    status: response.status,
    cacheControl: response.headers.get('cache-control'),
  };
}

Deno.test('an unauthenticated request is rejected', async () => {
  resetScenario();
  const body = await call({});
  assertEquals(body.status, 401);
});

Deno.test('a caller who is not a member of the property gets a 404, not a leak', async () => {
  resetScenario({ hasAccess: false });
  const body = await call();
  // 404 rather than 403 on purpose: a non-member must not learn the property exists.
  assertEquals(body.status, 404);
});

Deno.test('the super-admin kill switch answers { disabled: true }, not an error', async () => {
  resetScenario({ availabilityOff: true });
  const body = await call();
  assertEquals(body.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.data?.disabled, true);
});

Deno.test('a fresh list comes back with its date and the windows it can offer', async () => {
  resetScenario();
  const body = await call();
  assertEquals(body.status, 200);

  const data = body.data;
  assert(data);
  assertEquals(data.disabled, undefined);
  assertEquals(data.fallback, null);
  assertEquals(data.stale, false);
  assertEquals(data.runDate, '2026-11-10');
  assertEquals(data.topics?.length, 1);
  assertEquals(data.topics?.[0]?.topicKey, 'pinoy-big-brother-collab-3-0');
  // Only the fields the UI renders travel: no score, stayFit or raw evidence.
  assertEquals(typeof data.topics?.[0]?.rank, 'number');
  assertEquals('score' in (data.topics?.[0] ?? {}), false);
  // Three published runs is the minimum for the week window.
  assertEquals(data.windowsAvailable, ['today', 'week']);
  // The list is property-scoped, so it must never be shared-cached.
  assert(body.cacheControl?.includes('private'));
});

Deno.test('a hidden topic never reaches the host', async () => {
  resetScenario({
    topics: [
      topicRow({ id: 'a', topic_key: 'hidden-one' }),
      topicRow({ id: 'b', topic_key: 'kept-one', rank: 2 }),
    ],
    overrides: [{ topic_key: 'hidden-one', action: 'hide' }],
  });

  const body = await call();
  assertEquals(body.data?.topics?.length, 1);
  assertEquals(body.data?.topics?.[0]?.topicKey, 'kept-one');
});

Deno.test('a pinned topic leads the list', async () => {
  resetScenario({
    topics: [
      topicRow({ id: 'a', topic_key: 'first', rank: 1 }),
      topicRow({ id: 'b', topic_key: 'second', rank: 2 }),
    ],
    overrides: [{ topic_key: 'second', action: 'pin' }],
  });

  const body = await call();
  assertEquals(body.data?.topics?.[0]?.topicKey, 'second');
  assertEquals(body.data?.topics?.[0]?.pinned, true);
});

Deno.test('no published run falls back to the seasonal ideas', async () => {
  resetScenario({ run: null });
  const body = await call();
  assertEquals(body.data?.fallback, 'evergreen');
  assertEquals(body.data?.topics?.length, 0);
  assertEquals(body.data?.runDate, null);
});

Deno.test('a list older than the expiry window falls back to seasonal ideas', async () => {
  const longAgo = new Date(Date.now() - 100 * 3_600_000).toISOString();
  resetScenario({ run: { ...FRESH_RUN, started_at: longAgo, finished_at: longAgo } });
  const body = await call();
  assertEquals(body.data?.fallback, 'evergreen');
  assertEquals(body.data?.stale, true);
});

Deno.test('a list past the stale threshold is flagged but still served', async () => {
  const stale = new Date(Date.now() - 40 * 3_600_000).toISOString();
  resetScenario({ run: { ...FRESH_RUN, started_at: stale, finished_at: stale } });
  const body = await call();
  assertEquals(body.data?.fallback, null);
  assertEquals(body.data?.stale, true);
  assertEquals(body.data?.topics?.length, 1);
});

Deno.test('an unknown window falls back to today rather than failing', async () => {
  resetScenario();
  const body = await call({ token: 'host-token', window: 'yesterday' });
  assertEquals(body.status, 200);
  assertEquals(body.data?.topics?.length, 1);
});

Deno.test('the payload carries no guest or host PII', async () => {
  resetScenario();
  const text = JSON.stringify(await call());
  assertEquals(text.includes('@example.test'), false);
  assertEquals(text.includes('user-1'), false);
});
