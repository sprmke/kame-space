/**
 * Learned posting windows.
 *
 * Each property's own engagement eventually replaces the playbook defaults. The blend is a
 * shrinkage: with no data the prior wins completely, and the property's own numbers take over
 * as the sample grows, so a lucky week never rewrites the plan.
 *
 * Pure: no clock, no DB, no network.
 */

import type { PostingWindow } from './marketingPlaybook.ts';
import { DEFAULT_POSTING_WINDOWS, weekdayWeight } from './marketingPlaybook.ts';

/** Shrinkage constant: the sample count at which a property's data carries half the weight. */
export const SHRINKAGE_K = 12;

/** Do not surface "your best time" before this many published posts with insights. */
export const MIN_LEARNED_SAMPLES = 12;

export type TimingSample = {
  /** 1 (Monday) to 7 (Sunday). */
  weekday: number;
  /** Manila hour, 0 to 23. */
  hour: number;
  /** Views or reach for the post. */
  views: number;
  /** Interactions (likes, comments, shares, saves). */
  engagement: number;
};

export type TimingWindow = {
  weekday: number;
  startHour: number;
  /** Engagement per view, blended with the prior. */
  score: number;
};

function dayKey(weekday: number, hour: number): string {
  return `${weekday}:${hour}`;
}

/**
 * Engagement per view by weekday × hour, blended with the default prior.
 * A bucket with no views contributes nothing rather than a fake zero.
 */
export function blendTiming(
  samples: readonly TimingSample[],
  options?: { shrinkageK?: number }
): Map<string, number> {
  const k = options?.shrinkageK ?? SHRINKAGE_K;
  const totals = new Map<string, { views: number; engagement: number; posts: number }>();
  for (const sample of samples) {
    if (sample.views <= 0) continue;
    const key = dayKey(sample.weekday, sample.hour);
    const bucket = totals.get(key) ?? { views: 0, engagement: 0, posts: 0 };
    bucket.views += sample.views;
    bucket.engagement += sample.engagement;
    bucket.posts += 1;
    totals.set(key, bucket);
  }

  const blended = new Map<string, number>();
  for (const [key, bucket] of totals) {
    const observed = bucket.engagement / bucket.views;
    // Shrink on the post count, not the view count: one viral post is still one post.
    const weight = bucket.posts / (bucket.posts + k);
    blended.set(key, weight * observed + (1 - weight) * priorScore(key));
  }
  return blended;
}

/**
 * Prior engagement-per-view for a weekday and hour, derived from the playbook windows:
 * window weight divided by the number of hours in the window.
 */
export function priorScore(key: string, windows: readonly PostingWindow[] = DEFAULT_POSTING_WINDOWS): number {
  const [weekdayRaw, hourRaw] = key.split(':').map(Number);
  const window = windows.find((entry) => {
    const startHour = Math.floor(entry.startMinute / 60);
    const endHour = Math.ceil(entry.endMinute / 60);
    return hourRaw >= startHour && hourRaw < Math.max(endHour, startHour + 1);
  });
  if (!window) return 0;
  const hours = Math.max(1, Math.ceil((window.endMinute - window.startMinute) / 60));
  return weekdayWeight(weekdayRaw, window) / hours;
}

/**
 * Best windows for a property, or null when the sample is too thin to be worth showing.
 * Quiet hours are never returned.
 */
export function bestLearnedWindows(
  samples: readonly TimingSample[],
  options?: {
    minSamples?: number;
    limit?: number;
    quietHourStart?: number;
    quietHourEnd?: number;
  }
): TimingWindow[] | null {
  const minSamples = options?.minSamples ?? MIN_LEARNED_SAMPLES;
  if (samples.filter((sample) => sample.views > 0).length < minSamples) return null;

  const quietStart = options?.quietHourStart ?? 23;
  const quietEnd = options?.quietHourEnd ?? 7;
  const blended = blendTiming(samples);

  return [...blended.entries()]
    .map(([key, score]) => {
      const [weekday, hour] = key.split(':').map(Number);
      return { weekday, startHour: hour, score };
    })
    .filter((window) => !(window.startHour >= quietStart || window.startHour < quietEnd))
    .sort((a, b) => b.score - a.score)
    .slice(0, options?.limit ?? 3);
}

/**
 * Pick the hour a story, feed post or reel should go out, given learned windows.
 * Returns the top learned hour for one of the preferred weekdays, else null.
 */
export function preferredHourFromLearned(
  learned: readonly TimingWindow[] | null,
  weekday: number
): number | null {
  if (!learned || learned.length === 0) return null;
  const match = learned.find((window) => window.weekday === weekday);
  return match ? match.startHour : null;
}
