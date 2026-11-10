/**
 * Marketing Trends — Netflix Top 10 for the Philippines (weekly).
 *
 * The public download is a 33 MB TSV of every country and every week. The daily
 * run never touches it: a weekly job streams it line by line and keeps only the
 * Philippines rows of the newest week.
 *
 * https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv
 */

import type { TrendSourceItem, TrendSourceResult } from '../types.ts';
import { fetchText, runSource, WEEKLY_TIMEOUT_MS } from './http.ts';

export const NETFLIX_TOP10_TSV_URL =
  'https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv';

/** Column names the parser needs. Anything else is ignored. */
const REQUIRED_COLUMNS = ['week', 'category', 'show'];
const COUNTRY_COLUMN_PREFERENCE = [
  'netflix_country_code',
  'country_iso2',
  'country_code',
  'iso2',
];

/** The country code we keep. */
export const TARGET_COUNTRY = 'PH';

export type NetflixRow = {
  week: string;
  category: string;
  show: string;
  rank: number;
};

/**
 * Parse the TSV body into Philippine rows for the newest week.
 *
 * The header check fails closed: if the columns we depend on are gone, the
 * source reports a failure and the cache keeps the last good week.
 */
export function parseNetflixTop10(
  body: string,
  countryCode: string = TARGET_COUNTRY
): { rows: NetflixRow[]; error: string | null } {
  const lines = body.split('\n');
  if (!lines.length) return { rows: [], error: 'empty body' };

  const header = lines[0]!.split('\t').map((cell) => cell.trim().toLowerCase());
  if (!REQUIRED_COLUMNS.every((column) => header.includes(column))) {
    return { rows: [], error: 'unexpected TSV header' };
  }
  const countryColumn = COUNTRY_COLUMN_PREFERENCE.find((column) => header.includes(column));
  if (!countryColumn) return { rows: [], error: 'no country column in TSV header' };

  const weekIndex = header.indexOf('week');
  const categoryIndex = header.indexOf('category');
  const showIndex = header.indexOf('show');
  const countryIndex = header.indexOf(countryColumn);

  const weeks = new Set<string>();
  const rows: NetflixRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const cells = line.split('\t');
    if (cells.length <= Math.max(weekIndex, categoryIndex, showIndex, countryIndex)) continue;
    const country = (cells[countryIndex] ?? '').trim().toUpperCase();
    if (country !== countryCode.toUpperCase()) continue;
    const week = (cells[weekIndex] ?? '').trim();
    const category = (cells[categoryIndex] ?? '').trim();
    const show = (cells[showIndex] ?? '').trim();
    if (!week || !show) continue;
    weeks.add(week);
    rows.push({ week, category, show, rank: 0 });
  }

  if (!rows.length) return { rows: [], error: 'no rows for country' };

  // Keep only the newest week.
  const newest = [...weeks].sort().at(-1)!;
  const newestRows = rows.filter((row) => row.week === newest);
  // Rank inside each category (film vs TV show), in the order the file lists them.
  const perCategory = new Map<string, number>();
  const ranked = newestRows.map((row) => {
    const seen = (perCategory.get(row.category) ?? 0) + 1;
    perCategory.set(row.category, seen);
    return { ...row, rank: seen };
  });

  return { rows: ranked, error: null };
}

/** Download and parse the newest Philippine week. */
export async function fetchNetflixTop10Ph(): Promise<TrendSourceResult> {
  return runSource('netflix', async () => {
    const body = await fetchText(NETFLIX_TOP10_TSV_URL, { timeoutMs: WEEKLY_TIMEOUT_MS });
    const { rows, error } = parseNetflixTop10(body);
    if (error || !rows.length) {
      return {
        source: 'netflix',
        ok: false,
        items: [],
        ms: 0,
        error: error ?? 'no rows',
      };
    }
    const items: TrendSourceItem[] = rows.map((row) => ({
      title: row.show,
      rank: row.rank,
      context: row.category,
    }));
    return { source: 'netflix', ok: true, items, ms: 0, error: null };
  });
}
