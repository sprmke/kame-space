/**
 * Marketing Trends — Wikimedia top pages.
 *
 * Two calls, one parser:
 *  - top-per-country for PH (English Wikipedia, mostly): the country's most read
 *    articles that day, which is where celebrities, shows and sports land.
 *  - top for Tagalog Wikipedia: local celebrities and shows the English list
 *    misses.
 *
 * Both are one to two days behind, which is fine: the daily list is a
 * "what people are talking about" signal, not a breaking-news feed.
 */

import type { TrendSourceItem, TrendSourceResult } from '../types.ts';
import { fetchJson, runSource } from './http.ts';

const WIKIMEDIA_BASE = 'https://wikimedia.org/api/rest_v1/metrics/pageviews';
const TOP_PER_COUNTRY_PATH = '/top-per-country/PH/all-access';
const TOP_PATH = '/top/tl.wikipedia/all-access';

type WikimediaArticle = {
  article?: unknown;
  views?: unknown;
  views_ceil?: unknown;
  rank?: unknown;
};

type WikimediaPayload = {
  items?: Array<{ articles?: WikimediaArticle[] }>;
};

/** `2026/11/07` → the `YYYY/MM/DD` path segment. */
function datePath(ymd: string): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return '';
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

function toItems(payload: WikimediaPayload): TrendSourceItem[] {
  const articles = payload.items?.[0]?.articles ?? [];
  const items: TrendSourceItem[] = [];
  for (const article of articles) {
    const title = typeof article.article === 'string' ? article.article : null;
    if (!title) continue;
    const views =
      typeof article.views === 'number'
        ? article.views
        : typeof article.views_ceil === 'number'
          ? article.views_ceil
          : null;
    items.push({
      title,
      rank: items.length + 1,
      views,
    });
  }
  return items;
}

/** Top articles read in the Philippines on one day (English Wikipedia). */
export async function fetchWikimediaTopPerCountry(ymd: string): Promise<TrendSourceResult> {
  return runSource('wikimedia_ph', async () => {
    const path = datePath(ymd);
    if (!path) {
      return { source: 'wikimedia_ph', ok: false, items: [], ms: 0, error: 'bad date' };
    }
    const payload = await fetchJson<WikimediaPayload>(`${WIKIMEDIA_BASE}${TOP_PER_COUNTRY_PATH}/${path}`);
    const items = toItems(payload);
    if (!items.length) {
      return { source: 'wikimedia_ph', ok: false, items: [], ms: 0, error: 'no articles' };
    }
    return { source: 'wikimedia_ph', ok: true, items, ms: 0, error: null };
  });
}

/** Top articles read on Tagalog Wikipedia on one day. */
export async function fetchWikimediaTopTagalog(ymd: string): Promise<TrendSourceResult> {
  return runSource('wikimedia_tl', async () => {
    const path = datePath(ymd);
    if (!path) {
      return { source: 'wikimedia_tl', ok: false, items: [], ms: 0, error: 'bad date' };
    }
    const payload = await fetchJson<WikimediaPayload>(`${WIKIMEDIA_BASE}${TOP_PATH}/${path}`);
    const items = toItems(payload);
    if (!items.length) {
      return { source: 'wikimedia_tl', ok: false, items: [], ms: 0, error: 'no articles' };
    }
    return { source: 'wikimedia_tl', ok: true, items, ms: 0, error: null };
  });
}
