/**
 * Marketing Trends — the source registry.
 *
 * One row per source: how much it counts, whether it runs today, and how to
 * fetch it. Adding a source is one adapter file plus one line here.
 *
 * The weekly Netflix source is not fetched by the daily run. It is read from
 * `marketing_trend_source_cache`, which the weekly cron fills.
 */

import type { TrendSourceId, TrendSourceResult } from '../types.ts';
import { fetchAppleMusicPh } from './appleMusicChart.ts';
import { fetchGoogleTrendsPh } from './googleTrendsRss.ts';
import { fetchWikimediaTopPerCountry, fetchWikimediaTopTagalog } from './wikimedia.ts';

export type TrendSourceAdapter = {
  id: TrendSourceId;
  /** What the host sees as the source label. */
  label: string;
  /** Score weight. Tuned during the dev review. */
  weight: number;
  /** Set false to pause a source without deleting it. */
  enabled: boolean;
  /** The daily adapters. The weekly ones are read from the cache instead. */
  kind: 'daily';
  /** The run date (Manila, `YYYY-MM-DD`). Sources that publish yesterday use it. */
  fetch: (runDate: string) => Promise<TrendSourceResult>;
};

/** The daily sources. */
export const DAILY_TREND_SOURCES: readonly TrendSourceAdapter[] = [
  {
    id: 'google_trends',
    label: 'Google Trends',
    weight: 1.0,
    enabled: true,
    kind: 'daily',
    fetch: () => fetchGoogleTrendsPh(),
  },
  {
    id: 'wikimedia_ph',
    label: 'Wikipedia',
    weight: 0.8,
    enabled: true,
    kind: 'daily',
    fetch: (runDate) => fetchWikimediaTopPerCountry(previousDay(runDate)),
  },
  {
    id: 'wikimedia_tl',
    label: 'Wikipedia (Tagalog)',
    weight: 0.5,
    enabled: true,
    kind: 'daily',
    fetch: (runDate) => fetchWikimediaTopTagalog(previousDay(runDate)),
  },
  {
    id: 'apple_music',
    label: 'Apple Music',
    weight: 0.5,
    enabled: true,
    kind: 'daily',
    fetch: () => fetchAppleMusicPh(),
  },
];

/** The day before the run date. Wikimedia publishes yesterday's numbers. */
function previousDay(runDate: string): string {
  const date = new Date(`${runDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Source label for a source id, including the ones that come from the cache. */
export const SOURCE_LABELS: Record<TrendSourceId, string> = {
  google_trends: 'Google Trends',
  wikimedia_ph: 'Wikipedia',
  wikimedia_tl: 'Wikipedia',
  apple_music: 'Apple Music',
  netflix: 'Netflix',
  editor: 'Added by staff',
};

/** The daily sources that are enabled right now. */
export function enabledDailySources(): TrendSourceAdapter[] {
  return DAILY_TREND_SOURCES.filter((source) => source.enabled);
}
