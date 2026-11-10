/**
 * Unit tests for the Marketing Trends source adapters, against the real fixtures
 * captured on 2026-11-10 (see the plan's §3.1).
 * Run: deno test supabase/functions/_shared/marketingTrends/sources/sources_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { parseGoogleTrendsRss } from './googleTrendsRss.ts';
import { parseAppleMusicChart } from './appleMusicChart.ts';
import { parseNetflixTop10 } from './netflixTop10.ts';

const FIXTURE_DIR = new URL('../../../tests/fixtures/marketing-trends/', import.meta.url);

async function readFixture(name: string): Promise<string> {
  return await Deno.readTextFile(new URL(name, FIXTURE_DIR));
}

Deno.test('the Google Trends RSS fixture parses into ranked items', async () => {
  const items = parseGoogleTrendsRss(await readFixture('google-trends-ph.xml'));
  assert(items.length > 0);
  assertEquals(items[0]?.rank, 1);
  assert(items[0]?.title);
  assert(items[0]?.traffic);
});

Deno.test('the Google Trends RSS keeps the related news headlines', async () => {
  const items = parseGoogleTrendsRss(await readFixture('google-trends-ph.xml'));
  const withNews = items.find((item) => (item.newsHeadlines?.length ?? 0) > 0);
  assert(withNews, 'expected at least one item with a related headline');
  assert((withNews!.newsHeadlines ?? []).length <= 5);
});

Deno.test('a broken RSS body yields no items instead of throwing', () => {
  assertEquals(parseGoogleTrendsRss('not xml at all').length, 0);
  assertEquals(parseGoogleTrendsRss('').length, 0);
});

Deno.test('the Apple Music fixture parses into ranked songs', async () => {
  const items = parseAppleMusicChart(await readFixture('apple-music-ph.json'));
  assert(items.length > 0);
  assertEquals(items[0]?.rank, 1);
  assert(items[0]?.title.includes('—'));
});

Deno.test('a broken Apple body yields no items', () => {
  assertEquals(parseAppleMusicChart('<html>redirect</html>').length, 0);
});

Deno.test('the Netflix TSV keeps only the Philippines rows of the newest week', () => {
  const header = 'week\tcategory\tshow\tnetflix_country_code';
  const body = [
    header,
    '2026-11-01\tFilm (TV)\tOld Show\tPH',
    '2026-11-01\tFilm (TV)\tOld Show Two\tPH',
    '2026-11-08\tFilm (TV)\tNewest Show\tPH',
    '2026-11-08\tFilm (TV)\tOther Country\tUS',
  ].join('\n');
  const { rows, error } = parseNetflixTop10(body);
  assertEquals(error, null);
  assertEquals(rows.length, 1);
  assertEquals(rows[0]?.show, 'Newest Show');
  assertEquals(rows[0]?.week, '2026-11-08');
  assertEquals(rows[0]?.rank, 1);
});

Deno.test('the Netflix TSV fails closed when the columns change', () => {
  const body = ['week\tcategory\tshow', '2026-11-01\tFilm\tSome Show'].join('\n');
  const { rows, error } = parseNetflixTop10(body);
  assertEquals(rows.length, 0);
  assert(error);
});

Deno.test('the Netflix TSV fails closed when there is no country column', () => {
  const body = ['week\tcategory\tshow', '2026-11-01\tFilm\tSome Show'].join('\n');
  assert(parseNetflixTop10(body).error);
});
