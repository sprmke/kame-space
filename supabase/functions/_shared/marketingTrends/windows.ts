/**
 * Marketing Trends — the three windows a host can browse.
 *
 * Today is the day's own ranking. This week and this month are a decayed sum of
 * the same key's daily scores across the last 7 / 30 published runs, so a topic
 * that keeps showing up climbs.
 *
 * The sums are computed at publish time (inside the publish RPC) and written out
 * as rows, so the host read is a single indexed query and never aggregates.
 */

import type { TrendWindow } from './types.ts';

export type WindowConfig = {
  /** How many days of history the window looks at. */
  days: number;
  /** Score multiplier per day of age. */
  decay: number;
  /** Published runs needed before the window is shown at all. */
  minRuns: number;
  /** Topics kept in the window. */
  limit: number;
};

export const WINDOW_CONFIG: Record<TrendWindow, WindowConfig> = {
  today: { days: 1, decay: 1, minRuns: 1, limit: 25 },
  week: { days: 7, decay: 0.85, minRuns: 3, limit: 25 },
  month: { days: 30, decay: 0.93, minRuns: 7, limit: 25 },
};

/** One published run's contribution to a window. */
export type WindowEntry = {
  /** Topic key. */
  key: string;
  /** That day's final score. */
  score: number;
  /** Days before the target date. 0 is the target day itself. */
  ageDays: number;
};

/** Decayed score for one entry. */
export function decayedScore(score: number, ageDays: number, decay: number): number {
  if (ageDays < 0) return 0;
  return score * Math.pow(decay, ageDays);
}

/**
 * Sum the entries per key with decay, then sort by score.
 * Returns the ranked key list (no padding, no gaps).
 */
export function computeWindowScores(
  entries: readonly WindowEntry[],
  window: TrendWindow
): Array<{ key: string; score: number }> {
  const config = WINDOW_CONFIG[window];
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.ageDays < 0 || entry.ageDays >= config.days) continue;
    const value = decayedScore(entry.score, entry.ageDays, config.decay);
    totals.set(entry.key, (totals.get(entry.key) ?? 0) + value);
  }
  return [...totals.entries()]
    .map(([key, score]) => ({ key, score: Math.round(score * 10_000) / 10_000 }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, config.limit);
}

/** Which windows have enough published runs to be worth showing. */
export function availableWindows(publishedRunCount: number): TrendWindow[] {
  const windows: TrendWindow[] = [];
  for (const window of ['today', 'week', 'month'] as const) {
    if (publishedRunCount >= WINDOW_CONFIG[window].minRuns) windows.push(window);
  }
  return windows;
}

/** Days between two `YYYY-MM-DD` dates. `from - to`. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
