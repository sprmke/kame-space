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
 * it lands within five minutes without a rerun.
 *
 * When there is no usable list (none yet, or older than 72 h) the endpoint
 * answers `fallback: 'evergreen'` and the client shows seasonal ideas.
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { isFeatureAvailable } from '../_shared/featureAvailability.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import type { SupabaseClient } from '../_shared/supabaseJs.ts';
import { availableWindows } from '../_shared/marketingTrends/windows.ts';
import type {
  MarketingTrendsResponse,
  TrendAngle,
  TrendCategory,
  TrendMomentum,
  TrendSourceEvidence,
  TrendTopic,
  TrendWindow,
} from '../_shared/marketingTrends/types.ts';

/** A list older than this is stale; older than that and the client gets evergreen. */
export const STALE_AFTER_HOURS = 36;
/** Past this age there is no usable list at all. */
export const EXPIRED_AFTER_HOURS = 72;

const TOPIC_COLUMNS =
  'id, run_id, run_date, window, rank, topic_key, title, summary, category, stay_fit, score, momentum, days_trending, first_seen, sources, angles, caption_idea, hashtags, brand_guard, pinned, manual';

type TopicRow = {
  id: string;
  run_id: string;
  run_date: string;
  window: TrendWindow;
  rank: number;
  topic_key: string;
  title: string;
  summary: string;
  category: TrendCategory;
  stay_fit: number;
  score: number;
  momentum: TrendMomentum;
  days_trending: number;
  first_seen: string | null;
  sources: TrendSourceEvidence[];
  angles: TrendAngle[];
  caption_idea: string;
  hashtags: string[];
  brand_guard: string[];
  pinned: boolean;
  manual: boolean;
};

type RunRow = {
  id: string;
  run_date: string;
  started_at: string;
  finished_at: string | null;
};

/** Per-isolate memo. The same list is read by every host, so it is worth keeping. */
let memo: { at: number; key: string; payload: MarketingTrendsResponse } | null = null;
const MEMO_TTL_MS = 5 * 60_000;

function toTopic(row: TopicRow): TrendTopic {
  return {
    id: row.id,
    runId: row.run_id,
    runDate: row.run_date,
    window: row.window,
    rank: row.rank,
    topicKey: row.topic_key,
    title: row.title,
    summary: row.summary,
    category: row.category,
    stayFit: row.stay_fit,
    score: Number(row.score),
    momentum: row.momentum,
    daysTrending: row.days_trending,
    firstSeen: row.first_seen ?? row.run_date,
    sources: Array.isArray(row.sources) ? row.sources : [],
    angles: Array.isArray(row.angles) ? row.angles : [],
    captionIdea: row.caption_idea ?? '',
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
    brandGuard: Array.isArray(row.brand_guard) ? row.brand_guard : [],
    pinned: Boolean(row.pinned),
    manual: Boolean(row.manual),
  };
}

/** The latest published run, or null. */
async function readLatestPublishedRun(
  supabase: SupabaseClient
): Promise<RunRow | null> {
  const { data } = await supabase
    .from('marketing_trend_runs')
    .select('id, run_date, started_at, finished_at')
    .eq('status', 'published')
    .order('run_date', { ascending: false })
    .limit(1);
  return (data?.[0] as RunRow | undefined) ?? null;
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
    .gt('expires_at', new Date().toISOString());
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
  const publishedRunCount = await countPublishedRuns(supabase);

  if (!run) {
    return {
      runDate: null,
      publishedAt: null,
      stale: false,
      fallback: 'evergreen',
      windowsAvailable: [],
      topics: [],
    };
  }

  const publishedAt = run.finished_at ?? run.started_at;
  const ageHours = (Date.now() - Date.parse(publishedAt)) / 3_600_000;
  const expired = ageHours > EXPIRED_AFTER_HOURS;

  const { hidden, pinned } = await readOverrides(supabase);
  const { data } = await supabase
    .from('marketing_trend_topics')
    .select(TOPIC_COLUMNS)
    .eq('run_id', run.id)
    .eq('window', window)
    .order('rank', { ascending: true });

  const topics = (data ?? [])
    .map((row) => toTopic(row as TopicRow))
    .filter((topic) => !hidden.has(topic.topicKey))
    .map((topic) => ({ ...topic, pinned: pinned.has(topic.topicKey) || topic.pinned }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.rank - b.rank;
    });

  if (expired || !topics.length) {
    return {
      runDate: run.run_date,
      publishedAt,
      stale: true,
      fallback: 'evergreen',
      windowsAvailable: availableWindows(publishedRunCount),
      topics: [],
    };
  }

  return {
    runDate: run.run_date,
    publishedAt,
    stale: ageHours > STALE_AFTER_HOURS,
    fallback: null,
    windowsAvailable: availableWindows(publishedRunCount),
    topics,
  };
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
    await resolveScopedPropertyAccess(req, 'marketing:view');
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const available = await isFeatureAvailable('marketing.trends', { user });
  if (!available) {
    return jsonSuccess(req, { disabled: true });
  }

  const rawWindow = new URL(req.url).searchParams.get('window') ?? 'today';
  const window: TrendWindow =
    rawWindow === 'week' || rawWindow === 'month' ? rawWindow : 'today';

  const supabase = createServiceClient();

  // Per-isolate memo. The same list is read by every host, so the second read
  // of the same run and window costs nothing.
  const latest = await readLatestPublishedRun(supabase);
  const memoKey = `${latest?.id ?? 'none'}:${window}`;
  if (memo && Date.now() - memo.at < MEMO_TTL_MS && memo.key === memoKey) {
    return jsonSuccess(req, memo.payload);
  }

  const payload = await buildTrendsPayload(supabase, window);
  memo = { at: Date.now(), key: memoKey, payload };

  return jsonSuccess(req, payload);
});
