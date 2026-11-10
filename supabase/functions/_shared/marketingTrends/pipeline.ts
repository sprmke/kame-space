/**
 * Marketing Trends — the daily pipeline.
 *
 * The same function backs the cron and a super admin's "Run now" button, so the
 * two can never drift apart.
 *
 *   fetch → normalize → pre-filter → score → classify (AI) → rank → publish
 *
 * The rules that matter:
 *  - One source failing never fails the run. At least one source with enough
 *    candidates is enough to publish.
 *  - No AI review, no new list. If the classify step fails, the run is marked
 *    failed and hosts keep the last published list.
 *  - A hide applies at read time too, so it lands within five minutes without a
 *    rerun.
 *  - Momentum compares today's position with yesterday's published position. It
 *    is not derived from the order the sources happened to return.
 *
 * Plan §4.1 and §4.5.
 */

import { manilaTodayYmd } from '../calendarAvailabilityManila.ts';
import type { SupabaseClient } from '../supabaseJs.ts';
import {
  STAY_FIT_MULTIPLIER,
  baseScore,
  distinctSourceCount,
  finalScore,
} from './score.ts';
import { isStoplistedTitle, normalizeRawTitle, titlesOverlap, type NormalizedTitle } from './normalize.ts';
import { NEWS_DERIVED_SOURCES } from './stoplists.ts';
import { findUnsafeTerm } from './safetyDenylist.ts';
import { MIN_SAFE_TOPICS, runTrendClassify, type TrendClassifyResult } from './marketingTrendsClassify.ts';
import { enabledDailySources, SOURCE_LABELS } from './sources/index.ts';
import type {
  TrendCandidate,
  TrendClassifiedTopic,
  TrendMomentum,
  TrendSourceEvidence,
  TrendSourceId,
  TrendSourceItem,
  TrendSourceResult,
} from './types.ts';

/** A source needs at least this many candidates to count toward the run. */
export const MIN_CANDIDATES_PER_SOURCE = 5;

/** How old a cached weekly source may be before it is ignored. */
export const MAX_CACHED_SOURCE_AGE_DAYS = 14;

/** Topics kept in the daily list. */
export const MAX_TOPICS = 25;

/** Days of history the evergreen check looks at. */
export const EVERGREEN_WINDOW_DAYS = 30;
/** A key that shows up on this many of those days is always trending, so it says nothing. */
export const EVERGREEN_MIN_DAYS = 25;

export type TrendSourceStat = {
  ok: boolean;
  count: number;
  ms: number;
  error: string | null;
  /** True when the source answered from a cache that is older than it should be. */
  stale?: boolean;
};

export type TrendRunResult = {
  runId: string;
  runDate: string;
  status: 'published' | 'failed';
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

/** A cached source result, with the staleness carried as data rather than in the message. */
type CachedSourceResult = TrendSourceResult & { stale: boolean };

/** Normalize, stoplist and merge the raw items of every source into candidates. */
export function buildCandidates(results: readonly TrendSourceResult[]): {
  candidates: TrendCandidate[];
  dropped: number;
} {
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

      const existing = candidates.find((candidate) =>
        titlesOverlap(normalizedByKey.get(candidate.key)!, normalized)
      );
      if (existing) {
        const alreadySeen = existing.sources.some((entry) => entry.source === evidence.source);
        // The cross-source bonus counts sources, not rows, so one source cannot
        // contribute twice.
        if (!alreadySeen) existing.sources.push(evidence);
        // Keep the fuller title: a title with words reads better than one keyword.
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

/**
 * Fold the AI's duplicate merges into the candidates that survived, so the
 * evidence of a merged duplicate still counts toward the cross-source bonus.
 * Returns the number of merges actually applied.
 */
export function applyClassifyMerges(
  candidates: TrendCandidate[],
  merges: readonly { from: string; into: string }[]
): number {
  const byKey = new Map(candidates.map((candidate) => [candidate.key, candidate]));
  let applied = 0;

  for (const merge of merges) {
    if (merge.from === merge.into) continue;
    const target = byKey.get(merge.into);
    const source = byKey.get(merge.from);
    if (!target || !source) continue;

    for (const evidence of source.sources) {
      if (target.sources.some((entry) => entry.source === evidence.source)) continue;
      target.sources.push(evidence);
    }
    target.sourceCount = distinctSourceCount(target.sources);

    // Remember the merged spelling so tomorrow's list can still match this topic.
    const aliases = new Set(target.aliases ?? []);
    aliases.add(source.key);
    for (const inherited of source.aliases ?? []) aliases.add(inherited);
    aliases.delete(target.key);
    target.aliases = [...aliases];
    applied += 1;
  }

  return applied;
}

/** Read the weekly Netflix cache. Older than two weeks, it is ignored. */
async function readCachedSource(
  supabase: SupabaseClient,
  source: TrendSourceId,
  runDate: string
): Promise<CachedSourceResult> {
  const empty = (error: string, stale = false): CachedSourceResult => ({
    source,
    ok: false,
    items: [],
    ms: 0,
    error,
    stale,
  });

  const { data, error } = await supabase
    .from('marketing_trend_source_cache')
    .select('items, period_start, fetched_at, error')
    .eq('source', source)
    .order('period_start', { ascending: false })
    .limit(1);
  if (error) return empty(error.message);

  const row = data?.[0] as
    | { items?: unknown; period_start?: string; fetched_at?: string; error?: string | null }
    | undefined;
  if (!row?.period_start) return empty('no cached rows');

  const ageDays = Math.round(
    (Date.parse(`${runDate}T00:00:00Z`) - Date.parse(`${row.period_start}T00:00:00Z`)) / 86_400_000
  );
  if (ageDays > MAX_CACHED_SOURCE_AGE_DAYS) return empty('cached rows are stale', true);

  const items = Array.isArray(row.items) ? (row.items as TrendSourceItem[]) : [];
  if (!items.length) return empty('cached rows are empty');
  return { source, ok: true, items, ms: 0, error: null, stale: false };
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

/**
 * What the last month of published lists tells this run.
 *
 * Three things come out of one pass over the same rows:
 *
 *  - `previous`: yesterday's position, so momentum and days trending survive.
 *  - `aliasMap`: every spelling seen in the window, mapped to the key it settled on,
 *    so a topic respelled between days is still the same topic.
 *  - `evergreen`: keys that appeared on almost every day of the window. They are
 *    always trending, so they say nothing about today.
 *
 * One query for the runs and one for their topics, both bounded by the window.
 */
export type TrendHistory = {
  previous: Map<string, { rank: number; firstSeen: string | null }>;
  aliasMap: Map<string, string>;
  evergreen: Set<string>;
  /** How many published days the window actually covered. */
  windowDays: number;
};

const EMPTY_HISTORY: TrendHistory = {
  previous: new Map(),
  aliasMap: new Map(),
  evergreen: new Set(),
  windowDays: 0,
};

type HistoryTopicRow = {
  run_id: string;
  topic_key: string;
  rank: number;
  first_seen: string | null;
  aliases: string[] | null;
};

export async function readHistory(
  supabase: SupabaseClient,
  runDate: string
): Promise<TrendHistory> {
  const { data: runs } = await supabase
    .from('marketing_trend_runs')
    .select('id, run_date')
    .eq('status', 'published')
    .lt('run_date', runDate)
    .order('run_date', { ascending: false })
    .limit(EVERGREEN_WINDOW_DAYS);

  const runRows = (runs ?? []) as Array<{ id: string; run_date: string }>;
  if (!runRows.length) return EMPTY_HISTORY;

  // Newest run first, so the first write to a map wins.
  const orderByRunId = new Map(runRows.map((row, index) => [row.id, index]));

  const { data: topics } = await supabase
    .from('marketing_trend_topics')
    .select('run_id, topic_key, rank, first_seen, aliases')
    .in(
      'run_id',
      runRows.map((row) => row.id)
    )
    .eq('window', 'today')
    // One row per topic per run, and runs are distinct days, so a row count is a day count.
    .limit(EVERGREEN_WINDOW_DAYS * MAX_TOPICS + 50);

  const rows = ((topics ?? []) as HistoryTopicRow[]).sort(
    (a, b) => (orderByRunId.get(a.run_id) ?? 0) - (orderByRunId.get(b.run_id) ?? 0)
  );

  const newestRunId = runRows[0]!.id;
  const previous = new Map<string, { rank: number; firstSeen: string | null }>();
  const aliasMap = new Map<string, string>();
  const daysByKey = new Map<string, Set<string>>();
  const runDateById = new Map(runRows.map((row) => [row.id, row.run_date]));

  for (const row of rows) {
    // Aliases settle on the newest canonical key, so an older spelling never wins.
    for (const alias of row.aliases ?? []) {
      if (!alias || alias === row.topic_key) continue;
      if (!aliasMap.has(alias)) aliasMap.set(alias, row.topic_key);
    }

    if (row.run_id === newestRunId) {
      const entry = { rank: row.rank, firstSeen: row.first_seen };
      if (!previous.has(row.topic_key)) previous.set(row.topic_key, entry);
      for (const alias of row.aliases ?? []) {
        if (!previous.has(alias)) previous.set(alias, entry);
      }
    }

    const canonical = aliasMap.get(row.topic_key) ?? row.topic_key;
    const seenOn = daysByKey.get(canonical) ?? new Set<string>();
    const day = runDateById.get(row.run_id);
    if (day) seenOn.add(day);
    daysByKey.set(canonical, seenOn);
  }

  // Only trust the pattern once there is a month behind it.
  const evergreen =
    runRows.length >= EVERGREEN_WINDOW_DAYS
      ? new Set(
          [...daysByKey.entries()]
            .filter(([, days]) => days.size >= EVERGREEN_MIN_DAYS)
            .map(([key]) => key)
        )
      : new Set<string>();

  return { previous, aliasMap, evergreen, windowDays: runRows.length };
}

/**
 * Rewrite the candidates through the persisted alias map.
 *
 * Without this, "X" one day and "Y" (the key X was merged into) the next are two
 * different topics: the streak resets and the week window counts them apart.
 *
 * Two cases, and both matter:
 *  - the canonical key is also a candidate today, so the alias folds into it;
 *  - the canonical key is not here at all, so the alias is *renamed* to it. This is
 *    the common case: the feed used one spelling yesterday and a shorter one today.
 *
 * Chains (a → b → c) resolve, and a cycle stops instead of looping.
 */
export function applyAliasMap(
  candidates: TrendCandidate[],
  aliasMap: ReadonlyMap<string, string>
): number {
  if (!aliasMap.size) return 0;

  const byKey = new Map(candidates.map((candidate) => [candidate.key, candidate]));
  let changed = 0;

  const resolve = (key: string): string => {
    const seen = new Set<string>([key]);
    let current = key;
    for (;;) {
      const next = aliasMap.get(current);
      if (!next || next === current || seen.has(next)) return current;
      seen.add(next);
      current = next;
    }
  };

  for (const candidate of [...candidates]) {
    if (!byKey.has(candidate.key)) continue;
    const canonical = resolve(candidate.key);
    if (canonical === candidate.key) continue;

    const target = byKey.get(canonical);
    if (target) {
      // Both spellings are in today's feed: fold the evidence into the canonical one.
      for (const evidence of candidate.sources) {
        if (target.sources.some((entry) => entry.source === evidence.source)) continue;
        target.sources.push(evidence);
      }
      target.sourceCount = distinctSourceCount(target.sources);

      const aliases = new Set(target.aliases ?? []);
      aliases.add(candidate.key);
      for (const inherited of candidate.aliases ?? []) aliases.add(inherited);
      aliases.delete(target.key);
      target.aliases = [...aliases];

      byKey.delete(candidate.key);
      candidates.splice(candidates.indexOf(candidate), 1);
      changed += 1;
      continue;
    }

    // Only today's spelling is here: keep the key the topic settled on.
    const previousKey = candidate.key;
    const aliases = new Set(candidate.aliases ?? []);
    aliases.add(previousKey);
    aliases.delete(canonical);
    candidate.key = canonical;
    candidate.aliases = [...aliases];
    byKey.delete(previousKey);
    byKey.set(canonical, candidate);
    changed += 1;
  }

  return changed;
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
    .gt('expires_at', now.toISOString())
    // Same reasoning as the read endpoint: an admin-curated table with one row per topic.
    .limit(500);
  const hidden = new Set<string>();
  const pinned = new Set<string>();
  for (const row of data ?? []) {
    const item = row as { topic_key: string; action: string };
    if (item.action === 'hide') hidden.add(item.topic_key);
    else if (item.action === 'pin') pinned.add(item.topic_key);
  }
  return { hidden, pinned };
}

/** One row of the array handed to the publish RPC. */
export type PublishTopic = {
  topic_key: string;
  title: string;
  summary: string;
  category: string;
  stay_fit: number;
  score: number;
  momentum: TrendMomentum;
  days_trending: number;
  first_seen: string;
  sources: TrendSourceEvidence[];
  aliases: string[];
  angles: unknown;
  caption_idea: string;
  hashtags: string[];
  brand_guard: string[];
  pinned: boolean;
  manual: boolean;
};

/**
 * Rank today's topics.
 *
 * Momentum needs a position, and the position needs a score, so this runs in two
 * passes: rank by the score without momentum, read momentum off that position
 * against yesterday, then apply the momentum multiplier. The final order is the
 * order the stored scores describe, which is what the publish RPC re-sorts by.
 */
export function rankTodayTopics(input: {
  topics: readonly TrendClassifiedTopic[];
  candidates: readonly TrendCandidate[];
  previous: ReadonlyMap<string, { rank: number; firstSeen: string | null }>;
  overrides: TrendOverrides;
  runDate: string;
}): PublishTopic[] {
  const { topics, candidates, previous, overrides, runDate } = input;
  const byKey = new Map(candidates.map((candidate) => [candidate.key, candidate]));
  const runMs = Date.parse(`${runDate}T00:00:00Z`);

  // Pass 1: score without momentum, so every topic has a position to compare.
  const provisional = topics.map((topic) => {
    const candidate = byKey.get(topic.key);
    const sources = candidate?.sources ?? [];
    const stayFitMultiplier = STAY_FIT_MULTIPLIER[topic.stayFit] ?? 0;
    const previousEntry = previous.get(topic.key);
    const firstSeen = previousEntry?.firstSeen ?? runDate;
    const daysTrending = Number.isNaN(Date.parse(`${firstSeen}T00:00:00Z`))
      ? 1
      : Math.max(1, Math.round((runMs - Date.parse(`${firstSeen}T00:00:00Z`)) / 86_400_000) + 1);
    return {
      topic,
      candidate,
      sources,
      stayFitMultiplier,
      previousEntry,
      firstSeen,
      daysTrending,
      preMomentumScore: baseScore(sources) * stayFitMultiplier,
    };
  });

  const provisionalRank = new Map<string, number>();
  [...provisional]
    .sort((a, b) => b.preMomentumScore - a.preMomentumScore || a.topic.key.localeCompare(b.topic.key))
    .forEach((row, index) => provisionalRank.set(row.topic.key, index + 1));

  // Pass 2: momentum from yesterday's position, then the real score.
  const ranked = provisional.map((row) => {
    const rank = provisionalRank.get(row.topic.key) ?? Number.MAX_SAFE_INTEGER;
    const momentum: TrendMomentum = !row.previousEntry
      ? 'new'
      : rank < row.previousEntry.rank
        ? 'rising'
        : 'steady';

    return {
      topic_key: row.topic.key,
      title: row.topic.title,
      summary: row.topic.summary,
      category: row.topic.category,
      stay_fit: row.topic.stayFit,
      score: finalScore({ sources: row.sources, momentum, stayFit: row.topic.stayFit }),
      momentum,
      days_trending: row.daysTrending,
      first_seen: row.firstSeen,
      sources: row.sources,
      aliases: row.candidate?.aliases ?? [],
      angles: row.topic.angles,
      caption_idea: row.topic.captionIdea,
      hashtags: row.topic.hashtags,
      brand_guard: row.topic.brandGuard,
      pinned: overrides.pinned.has(row.topic.key),
      manual: row.sources.some((entry) => entry.source === 'editor'),
    } satisfies PublishTopic;
  });

  return ranked
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.score - a.score || a.topic_key.localeCompare(b.topic_key);
    })
    .slice(0, MAX_TOPICS);
}

/** Run the whole pipeline once. */
export async function runTrendsPipeline(options: TrendRunOptions): Promise<TrendRunResult> {
  const { supabase, trigger, triggeredBy } = options;
  const runDate = options.runDate ?? manilaTodayYmd();

  const { data: runRow, error: runError } = await supabase
    .from('marketing_trend_runs')
    .insert({
      run_date: runDate,
      status: 'running',
      trigger,
      triggered_by: triggeredBy ?? null,
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

  /** One place that closes a failed run: the ledger row and the return value agree. */
  const failRun = async (error: string, candidateCount = 0): Promise<TrendRunResult> => {
    const { error: updateError } = await supabase
      .from('marketing_trend_runs')
      .update({
        status: 'failed',
        ai_error: error,
        candidate_count: candidateCount,
        source_stats: sourceStats,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);
    if (updateError) {
      console.error('[marketing-trends] could not close the run row:', updateError.message);
    }
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
    const settled = await Promise.allSettled(daily.map((adapter) => adapter.fetch(runDate)));

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
      ...(netflix.stale ? { stale: true } : {}),
    };
    if (netflix.ok) results.push(netflix);

    const manual = await readManualTopics(supabase, runDate);
    if (manual.ok) results.push(manual);

    const usableSources = results.filter(
      (result) => result.ok && result.items.length >= MIN_CANDIDATES_PER_SOURCE
    );
    if (!usableSources.length) {
      return await failRun('no source returned enough candidates');
    }

    // ── 2 and 3. Normalize, stoplist, pre-filter, merge ───────────────────
    const built = buildCandidates(results);
    const [history, overrides] = await Promise.all([
      readHistory(supabase, runDate),
      readOverrides(supabase),
    ]);

    // A respelling seen before collapses onto the key it settled on, so momentum holds.
    applyAliasMap(built.candidates, history.aliasMap);

    // A topic that trends every single day is noise; drop it before the model sees it.
    const candidates = built.candidates.filter(
      (candidate) => !history.evergreen.has(candidate.key)
    );
    if (candidates.length < MIN_SAFE_TOPICS) {
      return await failRun('not enough candidates after normalization', candidates.length);
    }

    // ── 4 and 5. Classify ─────────────────────────────────────────────────
    let classified: TrendClassifyResult;
    try {
      classified = await runTrendClassify(candidates, SOURCE_LABELS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return await failRun(`classify failed: ${message}`, candidates.length);
    }

    // A duplicate the AI spotted still counts for the cross-source bonus.
    applyClassifyMerges(candidates, classified.merges);

    const safeTopics = classified.topics.filter((topic) => !overrides.hidden.has(topic.key));
    if (safeTopics.length < MIN_SAFE_TOPICS) {
      return await failRun(
        `only ${safeTopics.length} safe topics (minimum ${MIN_SAFE_TOPICS})`,
        candidates.length
      );
    }

    // ── 6. Rank ───────────────────────────────────────────────────────────
    const today = rankTodayTopics({
      topics: safeTopics,
      candidates,
      previous: history.previous,
      overrides,
      runDate,
    });

    // ── 7. Publish ────────────────────────────────────────────────────────
    const { data: publishResult, error: publishError } = await supabase.rpc(
      'publish_marketing_trend_run',
      { p_run_id: runId, p_run_date: runDate, p_today: today }
    );
    if (publishError) {
      return await failRun(`publish failed: ${publishError.message}`, candidates.length);
    }
    const published = publishResult as { ok?: boolean; error?: string } | null;
    if (!published?.ok) {
      return await failRun(published?.error ?? 'publish was refused', candidates.length);
    }

    // The RPC marked the run published; this fills in what the AI cost and saw.
    const { error: metricsError } = await supabase
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
    if (metricsError) {
      // The list is live; losing the cost columns must not turn a shipped run red.
      console.error('[marketing-trends] could not record run metrics:', metricsError.message);
    }

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
    return await failRun(message);
  }
}
