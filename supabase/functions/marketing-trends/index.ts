/**
 * marketing-trends — the host read endpoint for Marketing Trends.
 * Plan: docs/workflow/in-progress/marketing-trending-topics.md
 *
 * GET ?property_id=<id>&window=today|week|month
 * Auth: `marketing:view` (no plan gate: viewing Trends is on every plan with
 * Content Studio). The `marketing.trends` feature-availability leaf is the
 * super-admin kill switch; when it is off the endpoint answers
 * `{ disabled: true }` so the rail hides itself instead of showing an error.
 *
 * The payload is one precomputed snapshot: the latest published run's rows for
 * one window, minus anything a super admin hid. A hide applies at read time, so
 * it lands within five minutes without a rerun. The rules live in
 * `_shared/marketingTrends/response.ts` so they are testable without a database.
 */

import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { isFeatureAvailable } from '../_shared/featureAvailability.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import type { SupabaseClient } from '../_shared/supabaseJs.ts';
import {
  shapeTrendsResponse,
  type TrendRunRow,
  type TrendTopicRow,
} from '../_shared/marketingTrends/response.ts';
import type { MarketingTrendsResponse, TrendWindow } from '../_shared/marketingTrends/types.ts';

const TOPIC_COLUMNS =
  'id, run_id, run_date, window, rank, topic_key, title, summary, category, stay_fit, score, momentum, days_trending, first_seen, sources, angles, caption_idea, hashtags, brand_guard, pinned, manual';

/**
 * The payload is the same platform-wide list for every host, so an isolate can
 * serve it from memory. A 60-second TTL keeps a super-admin hide and a fresh run
 * visible well inside the five minutes the admin page promises.
 */
const MEMO_TTL_MS = 60_000;

type MemoEntry = { at: number; payload: MarketingTrendsResponse };
const memoByWindow = new Map<TrendWindow, MemoEntry>();

/** Test helper: clear the isolate memo between scenarios. */
export function resetMarketingTrendsMemoForTests(): void {
  memoByWindow.clear();
}

/** The latest published run, or null. */
async function readLatestPublishedRun(supabase: SupabaseClient): Promise<TrendRunRow | null> {
  const { data } = await supabase
    .from('marketing_trend_runs')
    .select('id, run_date, started_at, finished_at')
    .eq('status', 'published')
    .order('run_date', { ascending: false })
    .limit(1);
  return (data?.[0] as TrendRunRow | undefined) ?? null;
}

/** How many published runs exist. Decides which windows are shown. */
async function countPublishedRuns(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('marketing_trend_runs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published');
  return count ?? 0;
}

/** The topic keys a super admin hid, and the ones they pinned. */
async function readOverrides(
  supabase: SupabaseClient
): Promise<{ hidden: Set<string>; pinned: Set<string> }> {
  const { data } = await supabase
    .from('marketing_trend_overrides')
    .select('topic_key, action')
    .gt('expires_at', new Date().toISOString())
    // Admin-curated, at most one active row per topic, and the table is pruned by the
    // 14-day expiry. Bounded rather than unbounded for the guard's sake.
    .limit(500);
  const hidden = new Set<string>();
  const pinned = new Set<string>();
  for (const row of data ?? []) {
    const item = row as { topic_key: string; action: string };
    if (item.action === 'hide') hidden.add(item.topic_key);
    if (item.action === 'pin') pinned.add(item.topic_key);
  }
  return { hidden, pinned };
}

/** Build the payload for one window. */
export async function buildTrendsPayload(
  supabase: SupabaseClient,
  window: TrendWindow
): Promise<MarketingTrendsResponse> {
  const run = await readLatestPublishedRun(supabase);
  if (!run) {
    return shapeTrendsResponse({
      run: null,
      publishedRunCount: 0,
      rows: [],
      hidden: new Set(),
      pinned: new Set(),
    });
  }

  const publishedRunCount = await countPublishedRuns(supabase);
  const { hidden, pinned } = await readOverrides(supabase);
  const { data } = await supabase
    .from('marketing_trend_topics')
    .select(TOPIC_COLUMNS)
    .eq('run_id', run.id)
    .eq('window', window)
    .order('rank', { ascending: true })
    // The publish RPC writes at most MAX_TOPICS rows per window; the cap is stated
    // here so the read is bounded even if that constant ever grows.
    .limit(50);

  return shapeTrendsResponse({
    run,
    publishedRunCount,
    rows: (data ?? []) as TrendTopicRow[],
    hidden,
    pinned,
  });
}

serveAuthenticated('marketing-trends', async (req, user) => {
  requireHttpMethod(req, 'GET');

  const limited = await rateLimitGate(req, {
    scope: 'marketing-trends',
    identity: identityFromRequest(req, user),
    limit: 120,
    windowSec: 3600,
  });
  if (limited) return limited;

  try {
    // Authorization only: the list is platform-wide, so this checks the caller may
    // read marketing for the property they asked for and nothing else.
    await resolveScopedPropertyAccess(req, 'marketing:view');
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const available = await isFeatureAvailable('marketing.trends', { user });
  if (!available) {
    return jsonSuccess(req, { disabled: true });
  }

  const requested = new URL(req.url).searchParams.get('window');
  const window: TrendWindow = requested === 'week' || requested === 'month' ? requested : 'today';

  const cached = memoByWindow.get(window);
  if (cached && Date.now() - cached.at < MEMO_TTL_MS) {
    return jsonSuccess(req, cached.payload);
  }

  const payload = await buildTrendsPayload(createServiceClient(), window);
  memoByWindow.set(window, { at: Date.now(), payload });
  return jsonSuccess(req, payload);
});
