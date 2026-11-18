/**
 * Marketing Trends — Apple Music Philippines most-played chart.
 *
 * The closest free signal to a TikTok sound: OPM hits and whatever else is
 * actually being played. Titles and artists only, no artwork, no chart position
 * beyond our own order.
 *
 * https://rss.marketingtools.apple.com/api/v2/ph/music/most-played/25/songs.json
 */

import type { TrendSourceItem, TrendSourceResult } from '../types.ts';
import { fetchText, runSource } from './http.ts';

export const APPLE_MUSIC_PH_URL =
  'https://rss.marketingtools.apple.com/api/v2/ph/music/most-played/25/songs.json';

type AppleFeed = {
  feed?: {
    results?: Array<{ name?: unknown; artistName?: unknown }>;
  };
};

/** Parse the Apple feed body into source items. */
export function parseAppleMusicChart(body: string): TrendSourceItem[] {
  let parsed: AppleFeed;
  try {
    parsed = JSON.parse(body) as AppleFeed;
  } catch {
    return [];
  }
  const results = parsed.feed?.results ?? [];
  const items: TrendSourceItem[] = [];
  for (const result of results) {
    const name = typeof result.name === 'string' ? result.name.trim() : '';
    if (!name) continue;
    const artist = typeof result.artistName === 'string' ? result.artistName.trim() : '';
    items.push({
      title: artist ? `${name} — ${artist}` : name,
      rank: items.length + 1,
      context: artist || null,
    });
  }
  return items;
}

/** Fetch the Philippine most-played chart. */
export async function fetchAppleMusicPh(): Promise<TrendSourceResult> {
  return runSource('apple_music', async () => {
    const body = await fetchText(APPLE_MUSIC_PH_URL);
    const items = parseAppleMusicChart(body);
    if (!items.length) {
      return { source: 'apple_music', ok: false, items: [], ms: 0, error: 'no songs parsed' };
    }
    return { source: 'apple_music', ok: true, items, ms: 0, error: null };
  });
}
