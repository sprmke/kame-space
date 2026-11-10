/**
 * Marketing Trends — the host read rules, as a pure function.
 *
 * Extracted from the endpoint so the behaviour the plan promises is testable
 * without a database: which windows are shown, what a hide does, and when the
 * client gets the evergreen fallback instead of a stale list.
 */

import { availableWindows } from './windows.ts';
import type {
  MarketingTrendsResponse,
  TrendAngle,
  TrendCategory,
  TrendMomentum,
  TrendSourceEvidence,
  TrendTopic,
  TrendWindow,
} from './types.ts';

/** A list older than this is flagged stale. */
export const STALE_AFTER_HOURS = 36;
/** Past this age there is no usable list at all: the client gets evergreen. */
export const EXPIRED_AFTER_HOURS = 72;

/** One row of `marketing_trend_topics`, as Postgres returns it. */
export type TrendTopicRow = {
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
  score: number | string;
  momentum: TrendMomentum;
  days_trending: number;
  first_seen: string | null;
  sources: TrendSourceEvidence[] | null;
  angles: TrendAngle[] | null;
  caption_idea: string | null;
  hashtags: string[] | null;
  brand_guard: string[] | null;
  pinned: boolean;
  manual: boolean;
};

/** One row of `marketing_trend_runs`. */
export type TrendRunRow = {
  id: string;
  run_date: string;
  started_at: string;
  finished_at: string | null;
};

/** Map a database row to the DTO the client reads. */
export function toTrendTopic(row: TrendTopicRow): TrendTopic {
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

/**
 * The read rules.
 *
 *  - No run, or a run older than 72 h, or nothing left after hides: evergreen.
 *  - A hidden topic never reaches the host, even if it is still in the list.
 *  - Pinned topics lead, then rank order.
 *  - Windows are only offered once there is enough history to compute them.
 */
export function shapeTrendsResponse(input: {
  run: TrendRunRow | null;
  publishedRunCount: number;
  rows: readonly TrendTopicRow[];
  hidden: ReadonlySet<string>;
  pinned: ReadonlySet<string>;
  now?: Date;
}): MarketingTrendsResponse {
  const { run, publishedRunCount, rows, hidden, pinned } = input;
  const now = input.now ?? new Date();

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
  const ageHours = (now.getTime() - Date.parse(publishedAt)) / 3_600_000;
  const expired = ageHours > EXPIRED_AFTER_HOURS;
  const windowsAvailable = availableWindows(publishedRunCount);

  const topics = rows
    .map(toTrendTopic)
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
      windowsAvailable,
      topics: [],
    };
  }

  return {
    runDate: run.run_date,
    publishedAt,
    stale: ageHours > STALE_AFTER_HOURS,
    fallback: null,
    windowsAvailable,
    topics,
  };
}
