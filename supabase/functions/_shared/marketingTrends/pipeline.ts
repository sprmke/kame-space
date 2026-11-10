/**
 * Marketing Trends — the daily pipeline.
 *
 * The same function backs the cron and a super admin's "Run now" button, so the
 * two can never drift apart.
 *
 *   fetch → normalize → pre-filter → score → classify (AI) → publish
 *
 * The rules that matter:
 *  - One source failing never fails the run. At least one source with five
 *    candidates is enough to publish.
 *  - No AI review, no new list. If the classify step fails, the run is marked
 *    failed and hosts keep seeing the last published list.
 *  - A hide applies at read time too, so it lands within five minutes without a
 *    rerun.
 *
 * Plan §4.1 and §4.5.
 */

import { manilaTodayYmd } from '../calendarAvailabilityManila.ts';
import type { SupabaseClient } from '../supabaseJs.ts';
import { finalScore, distinctSourceCount } from './score.ts';
import { isStoplistedTitle, normalizeRawTitle, titlesOverlap, type NormalizedTitle } from './normalize.ts';
import { NEWS_DERIVED_SOURCES } from './stoplists.ts';
import { findUnsafeTerm } from './safetyDenylist.ts';
import { runTrendClassify, MIN_SAFE_TOPICS } from './marketingTrendsClassify.ts';
import { enabledDailySources, SOURCE_LABELS } from './sources/index.ts';
import type {
  TrendCandidate,
  TrendMomentum,
  TrendSourceEvidence,
  TrendSourceId,
  TrendSourceItem,
  TrendSourceResult,
} from './types.ts';

/** The whole daily run has this budget. Sources fetch in parallel, so it is generous. */
export const TIME_BUDGET_MS = 55_000;

/** A source needs at least this many candidates to count toward the run. */
export const MIN_CANDIDATES_PER_SOURCE = 5;

/** How old a cached weekly source may be before it is ignored. */
export const MAX_CACHED_SOURCE_AGE_DAYS = 14;

export type TrendSourceStat = {
  ok: boolean;
  count: number;
  ms: number;
  error: string | null;
  stale?: boolean;
};

export type TrendRunResult = {
  runId: string;
  runDate: string;
  status: 'published' | 'failed' | 'skipped';
  topicCount: number;
  candidateCount: number;
  sourceStats: Record<string, TrendSourceStat>;
  error: string | null;
};

export type TrendRunOptions = {
  supabase: SupabaseClient;
  trigger: 'cron' | 'manual';
  triggeredBy?: string | null;
  /** Override the Manila date. Used by the seed and the tests. */
  runDate?: string;
};

/** Yesterday's Manila date. Wikimedia lags by a day or two. */
export function manilaYesterdayYmd(runDate: string): string {
  const date = new Date(`${runDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Normalize, stoplist and merge the raw items of every source into candidates. */
export function buildCandidates(
  results: readonly TrendSourceResult[]
): { candidates: TrendCandidate[]; dropped: number } {
  const candidates: TrendCandidate[] = [];
  const normalizedByKey = new Map<string, NormalizedTitle>();
  let dropped = 0;

  for (const result of results) {
    const newsDerived = NEWS_DERIVED_SOURCES.includes(result.source);
    for (const item of result.items) {
      const normalized = normalizeRawTitle(item.title);
      if (!normalized.key || isStoplistedTitle(normalized.normalized)) {
        dropped += 1;
        continue;
      }
      // The keyword denylist only applies to news-like sources: a song title can
      // contain "bagyo" without being about a storm.
      if (newsDerived && findUnsafeTerm(normalized.normalized)) {
        dropped += 1;
        continue;
      }
      const evidence: TrendSourceEvidence = {
        source: result.source,
        rank: item.rank,
        traffic: item.traffic ?? null,
        views: item.views ?? null,
        newsHeadlines: item.newsHeadlines ?? [],
      };
      const existingKey = candidates.find((candidate) =>
        titlesOverlap(normalizedByKey.get(candidate.key)!, normalized)
      )?.key;
      if (existingKey) {
        const existing = candidates.find((candidate) => candidate.key === existingKey)!;
        existing.sources.push(evidence);
        // Keep the cleaner title: a title with words beats a single keyword.
        if (normalized.display.split(' ').length > existing.title.split(' ').length) {
          existing.title = normalized.display;
        }
      } else {
        candidates.push({
          key: normalized.key,
          title: normalized.display,
          sources: [evidence],
          sourceCount: 1,
        });
        normalizedByKey.set(normalized.key, normalized);
      }
    }
  }

  for (const candidate of candidates) {
    candidate.sourceCount = distinctSourceCount(candidate.sources);
  }
  return { candidates, dropped };
}

/** Read the weekly Netflix cache. Older than 14 days, it is ignored. */
async function readCachedSource(
  supabase: SupabaseClient,
  source: TrendSourceId,
  runDate: string
): Promise<TrendSourceResult> {
  const { data, error } = await supabase
    .from('marketing_trend_source_cache')
    .select('items, period_start, fetched_at, error')
    .eq('source', source)
    .order('period_start', { ascending: false })
    .limit(1);
  if (error) {
    return { source, ok: false, items: [], ms: 0, error: error.message };
  }
  const row = data?.[0] as
    | { items?: unknown; period_start?: string; fetched_at?: string; error?: string | null }
    | undefined;
  if (!row?.period_start) {
    return { source, ok: false, items: [], ms: 0, error: 'no cached rows' };
  }
  const ageDays = Math.round(
    (Date.parse(`${runDate}T00:00:00Z`) - Date.parse(`${row.period_start}T00:00:00Z`)) / 86_400_000
  );
  const rawItems = Array.isArray(row.items) ? (row.items as TrendSourceItem[]) : [];
  if (ageDays > MAX_CACHED_SOURCE_AGE_DAYS) {
    return { source, ok: false, items: [], ms: 0, error: 'cached rows are stale' };
  }
  return {
    source,
    ok: rawItems.length > 0,
    items: rawItems,
    ms: 0,
    error: rawItems.length > 0 ? null : 'cached rows are empty',
  };
}

/** Super-admin topics added by hand. They go through the same classify pass. */
async function readManualTopics(
  supabase: SupabaseClient,
  runDate: string
): Promise<TrendSourceResult> {
  const { data, error } = await supabase
    .from('marketing_trend_manual_topics')
    .select('title, category')
    .lte('active_from', runDate)
    .gte('active_to', runDate)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    return { source: 'editor', ok: false, items: [], ms: 0, error: error.message };
  }
  const items: TrendSourceItem[] = (data ?? []).map((row, index) => ({
    title: (row as { title: string }).title,
    rank: index + 1,
    context: (row as { category?: string }).category ?? null,
  }));
  return { source: 'editor', ok: items.length > 0, items, ms: 0, error: null };
}

/** The previous published list, used for momentum and days trending. */
async function readPreviousRun(
  supabase: SupabaseClient,
  runDate: string
): Promise<Map<string, { rank: number; firstSeen: string | null }>> {
  const { data } = await supabase
    .from('marketing_trend_runs')
    .select('id')
    .eq('status', 'published')
    .lt('run_date', runDate)
    .order('run_date', { ascending: false })
    .limit(1);
  const runId = (data?.[0] as { id?: string } | undefined)?.id;
  if (!runId) return new Map();
  const { data: topics } = await supabase
    .from('marketing_trend_topics')
    .select('topic_key, rank, first_seen')
    .eq('run_id', runId)
    .eq('window', 'today');
  const map = new Map<string, { rank: number; firstSeen: string | null }>();
  for (const row of topics ?? []) {
    const item = row as { topic_key: string; rank: number; first_seen: string | null };
    map.set(item.topic_key, { rank: item.rank, firstSeen: item.first_seen });
  }
  return map;
}

/** The active overrides: hidden keys and pinned keys. */
export type TrendOverrides = { hidden: Set<string>; pinned: Set<string> };

export async function readOverrides(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<TrendOverrides> {
  const { data } = await supabase
    .from('marketing_trend_overrides')
    .select('topic_key, action, expires_at')
    .gt('expires_at', now.toISOString());
  const hidden = new Set<string>();
  const pinned = new Set<string>();
  for (const row of data ?? []) {
    const item = row as { topic_key: string; action: string };
    if (item.action === 'hide') hidden.add(item.topic_key);
    if (item.action === 'pin') pinned.add(item.topic_key);
  }
  return { hidden, pinned };
}

/** Run the whole pipeline once. */
export async function runTrendsPipeline(options: TrendRunOptions): Promise<TrendRunResult> {
  const { supabase, trigger, triggeredBy } = options;
  const runDate = options.runDate ?? manilaTodayYmd();
  const startedAt = new Date();

  const { data: runRow, error: runError } = await supabase
    .from('marketing_trend_runs')
    .insert({
      run_date: runDate,
      status: 'running',
      trigger,
      triggered_by: triggeredBy ?? null,
      started_at: startedAt.toISOString(),
    })
    .select('id')
    .single();
  if (runError || !runRow) {
    return {
      runId: '',
      runDate,
      status: 'failed',
      topicCount: 0,
      candidateCount: 0,
      sourceStats: {},
      error: runError?.message ?? 'could not create the run',
    };
  }
  const runId = (runRow as { id: string }).id;

  const sourceStats: Record<string, TrendSourceStat> = {};
  const failRun = async (error: string, candidateCount = 0): Promise<TrendRunResult> => {
    await supabase
      .from('marketing_trend_runs')
      .update({
        status: 'failed',
        ai_error: error,
        candidate_count: candidateCount,
        source_stats: sourceStats,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);
    return {
      runId,
      runDate,
      status: 'failed',
      topicCount: 0,
      candidateCount,
      sourceStats,
      error,
    };
  };

  try {
    // ── 1. Fetch ──────────────────────────────────────────────────────────
    const daily = enabledDailySources();
    const settled = await Promise.allSettled(
      daily.map((adapter) => adapter.fetch(runDate))
    );

    const results: TrendSourceResult[] = [];
    settled.forEach((entry, index) => {
      const adapter = daily[index]!;
      if (entry.status === 'fulfilled') {
        const result = entry.value;
        sourceStats[adapter.id] = {
          ok: result.ok,
          count: result.items.length,
          ms: result.ms,
          error: result.error,
        };
        results.push(result);
        return;
      }
      const message = entry.reason instanceof Error ? entry.reason.message : String(entry.reason);
      sourceStats[adapter.id] = { ok: false, count: 0, ms: 0, error: message };
    });

    // The weekly source comes from the cache, not the network.
    const netflix = await readCachedSource(supabase, 'netflix', runDate);
    sourceStats.netflix = {
      ok: netflix.ok,
      count: netflix.items.length,
      ms: 0,
      error: netflix.error,
      ...(netflix.error === 'cached rows are stale' ? { stale: true } : {}),
    };
    if (netflix.ok) results.push(netflix);

    const manual = await readManualTopics(supabase, runDate);
    if (manual.ok) results.push(manual);

    const usable = results.filter(
      (result) => result.ok && result.items.length >= MIN_CANDIDATES_PER_SOURCE
    );
    if (!usable.length) {
      return failRun('no source returned enough candidates');
    }

    // ── 2 and 3. Normalize, stoplist, pre-filter, merge ───────────────────
    const { candidates } = buildCandidates(results);
    if (candidates.length < MIN_SAFE_TOPICS) {
      return failRun('not enough candidates after normalization', candidates.length);
    }

    // ── 4 and 5. Score and classify ───────────────────────────────────────
    const previous = await readPreviousRun(supabase, runDate);
    const overrides = await readOverrides(supabase);

    let classified;
    try {
      classified = await runTrendClassify(candidates, SOURCE_LABELS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase
        .from('marketing_trend_runs')
        .update({
          ai_error: message,
          candidate_count: candidates.length,
          source_stats: sourceStats,
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId);
      return failRun(`classify failed: ${message}`, candidates.length);
    }

    const topics = classified.topics.filter((topic) => !overrides.hidden.has(topic.key));
    if (topics.length < MIN_SAFE_TOPICS) {
      return failRun(
        `only ${topics.length} safe topics (minimum ${MIN_SAFE_TOPICS})`,
        candidates.length
      );
    }

    // ── 6. Rank ───────────────────────────────────────────────────────────
    const today = topics
      .map((topic) => {
        const candidate = candidates.find((entry) => entry.key === topic.key);
        const sources = candidate?.sources ?? [];
        const previousEntry = previous.get(topic.key);
        const firstSeen = previousEntry?.firstSeen ?? runDate;
        const daysTrending = Math.max(
          1,
          Math.round(
            (Date.parse(`${runDate}T00:00:00Z`) - Date.parse(`${firstSeen}T00:00:00Z`)) /
              86_400_000
          ) + 1
        );
        const currentRank = candidates.findIndex((entry) => entry.key === topic.key) + 1;
        const momentum: TrendMomentum = !previousEntry
          ? 'new'
          : previousEntry.rank > currentRank
            ? 'rising'
            : 'steady';
        const score = finalScore({ sources, momentum, stayFit: topic.stayFit });
        return {
          topic_key: topic.key,
          title: topic.title,
          summary: topic.summary,
          category: topic.category,
          stay_fit: topic.stayFit,
          score,
          momentum,
          days_trending: daysTrending,
          first_seen: firstSeen,
          sources,
          angles: topic.angles,
          caption_idea: topic.captionIdea,
          hashtags: topic.hashtags,
          brand_guard: topic.brandGuard,
          pinned: overrides.pinned.has(topic.key),
          manual: candidate?.sources.some((entry) => entry.source === 'editor') ?? false,
        };
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.score - a.score;
      })
      .slice(0, 25);

    // ── 7. Publish ────────────────────────────────────────────────────────
    const { data: publishResult, error: publishError } = await supabase.rpc(
      'publish_marketing_trend_run',
      { p_run_id: runId, p_run_date: runDate, p_today: today }
    );
    if (publishError) {
      return failRun(`publish failed: ${publishError.message}`, candidates.length);
    }
    const published = publishResult as { ok?: boolean; error?: string } | null;
    if (!published?.ok) {
      return failRun(published?.error ?? 'publish was refused', candidates.length);
    }

    await supabase
      .from('marketing_trend_runs')
      .update({
        ai_provider: classified.provider,
        ai_model: classified.model,
        candidate_count: candidates.length,
        topic_count: today.length,
        ai_input_tokens: classified.inputTokens,
        ai_output_tokens: classified.outputTokens,
        ai_cost_usd: classified.estimatedCostUsd,
        source_stats: sourceStats,
      })
      .eq('id', runId);

    return {
      runId,
      runDate,
      status: 'published',
      topicCount: today.length,
      candidateCount: candidates.length,
      sourceStats,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failRun(message);
  }
}
