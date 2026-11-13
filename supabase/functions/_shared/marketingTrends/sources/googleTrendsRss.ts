/**
 * Marketing Trends — Google Trends "Trending now" RSS for the Philippines.
 *
 * The feed is what people search today. It catches TikTok and X virality one
 * step later, when the crowd goes looking for the name.
 *
 * https://trends.google.com/trending/rss?geo=PH
 */

import { XMLParser } from 'fast-xml-parser';

import type { TrendSourceItem, TrendSourceResult } from '../types.ts';
import { fetchText, runSource } from './http.ts';

export const GOOGLE_TRENDS_PH_URL = 'https://trends.google.com/trending/rss?geo=PH';

type ParsedItem = {
  title?: unknown;
  approx_traffic?: unknown;
  news_item?: unknown;
};

type ParsedFeed = {
  rss?: { channel?: { item?: ParsedItem | ParsedItem[] } };
};

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number') return String(value);
  return null;
}

/** Parse the RSS body into source items. Strict about shape, lenient about content. */
export function parseGoogleTrendsRss(xml: string): TrendSourceItem[] {
  let parsed: ParsedFeed;
  try {
    parsed = parser.parse(xml) as ParsedFeed;
  } catch {
    return [];
  }
  const rawItems = asArray(parsed.rss?.channel?.item);
  const items: TrendSourceItem[] = [];
  for (const raw of rawItems) {
    const title = asText(raw.title);
    if (!title) continue;
    const newsHeadlines: string[] = [];
    for (const news of asArray(raw.news_item)) {
      const headline = asText((news as { news_item_title?: unknown }).news_item_title);
      if (headline) newsHeadlines.push(headline);
    }
    items.push({
      title,
      rank: items.length + 1,
      traffic: asText(raw.approx_traffic),
      newsHeadlines: newsHeadlines.slice(0, 5),
    });
  }
  return items;
}

/** Fetch and parse the Philippine trending-now feed. */
export async function fetchGoogleTrendsPh(): Promise<TrendSourceResult> {
  return runSource('google_trends', async () => {
    const xml = await fetchText(GOOGLE_TRENDS_PH_URL);
    const items = parseGoogleTrendsRss(xml);
    if (!items.length) {
      return { source: 'google_trends', ok: false, items: [], ms: 0, error: 'no items parsed' };
    }
    return { source: 'google_trends', ok: true, items, ms: 0, error: null };
  });
}
