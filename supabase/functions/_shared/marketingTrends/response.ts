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
  TrendSourceId,
  TrendTopic,
  TrendWindow,
} from './types.ts';

/** A list older than this is flagged stale. */
export const STALE_AFTER_HOURS = 36;
/** Past this age there is no usable list at all: the client gets evergreen. */
export const EXPIRED_AFTER_HOURS = 72;

/** One row of `marketing_trend_topics`, as Postgres returns it. */
export type TrendTopicRow = {
  topic_key: string;
  rank: number;
  title: string;
  summary: string;
  category: TrendCategory;
  momentum: TrendMomentum;
  days_trending: number;
  sources: Array<{ source: TrendSourceId }> | null;
  angles: TrendAngle[] | null;
  caption_idea: string | null;
  pinned: boolean;
  // Kept because the select includes them for the memo key and window checks.
  window?: TrendWindow;
  run_id?: string;
  run_date?: string;
};

/** One row of `marketing_trend_runs`. */
export type TrendRunRow = {
  id: string;
  run_date: string;
  started_at: string;
  finished_at: string | null;
};

/**
 * Map a database row to the DTO the client reads.
 *
 * The source evidence is trimmed to the label the UI renders. Rank, traffic, views
 * and the related headlines are only ever read by the classify step and the admin
 * page, and shipping them to every host costs about 400 bytes per topic.
 */
export function toTrendTopic(row: TrendTopicRow): TrendTopic {
  return {
    topicKey: row.topic_key,
    rank: row.rank,
    title: row.title,
    summary: row.summary,
    category: row.category,
    momentum: row.momentum,
    daysTrending: row.days_trending,
    sources: Array.isArray(row.sources)
      ? row.sources.map((entry) => ({ source: entry.source }))
      : [],
    angles: Array.isArray(row.angles) ? row.angles : [],
    captionIdea: row.caption_idea ?? '',
    pinned: Boolean(row.pinned),
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
