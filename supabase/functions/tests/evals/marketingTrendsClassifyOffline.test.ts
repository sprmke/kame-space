/**
 * Marketing Trends — offline eval for the deterministic safety rules.
 *
 * The labelled set has 42 Philippine cases. Two rules decide them: the source
 * filter plus the keyword denylist (`layer: "denylist"`), and the AI classify
 * pass (`layer: "ai"`). This suite proves the deterministic rules agree with
 * every label they are responsible for, in both directions:
 *
 *  - every case labelled `block` on that layer is caught, and
 *  - every case labelled `safe` passes, so the keyword list never over-blocks a
 *    song, a film, or a phrase like "award night".
 *
 * Each case carries the `source` it arrives through, because the denylist is
 * deliberately skipped for music and video titles: the OPM song "Ako ang bagyo"
 * contains the Filipino word for storm and is still a perfectly good topic. A
 * self-test proves that filter is doing the work.
 *
 * The AI layer's verdicts need a live model, so they are scored by
 * `bun run eval:ai` against the same file.
 *
 * Run: `bun run test:edge:handlers`
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { normalizeTitle } from '../../_shared/marketingTrends/normalize.ts';
import { findUnsafeTerm } from '../../_shared/marketingTrends/safetyDenylist.ts';
import { NEWS_DERIVED_SOURCES } from '../../_shared/marketingTrends/stoplists.ts';
import type { TrendSourceId } from '../../_shared/marketingTrends/types.ts';
import { readJsonl } from './evalDatasets.ts';

type Labels = 'safe' | 'block';
type Layer = 'denylist' | 'ai';

type TrendCase = {
  id: string;
  title: string;
  summary?: string;
  newsHeadlines?: string[];
  expect: Labels;
  layer: Layer;
  /** Where the title arrives from. Decides whether the keyword denylist applies. */
  source: TrendSourceId;
  note?: string;
};

const cases = await readJsonl<TrendCase>('marketing_trends_classify.jsonl');

/** The same fold the pipeline applies before it reads the denylist. */
function fold(text: string): string {
  return normalizeTitle(text);
}

/**
 * The pipeline's actual rule: the keyword denylist only runs on news-derived
 * sources. Returns the matched term, or null when the case is not subject to it.
 */
function denylistVerdict(entry: TrendCase, text: string): string | null {
  if (!NEWS_DERIVED_SOURCES.includes(entry.source)) return null;
  return findUnsafeTerm(fold(text));
}

Deno.test('the dataset has the sizes and layers the plan promises', () => {
  assert(cases.length >= 40, `expected 40+ cases, found ${cases.length}`);
  assert(
    cases.some((entry) => entry.layer === 'denylist' && entry.expect === 'block'),
    'no denylist block cases'
  );
  assert(
    cases.some((entry) => entry.layer === 'denylist' && entry.expect === 'safe'),
    'no denylist safe cases'
  );
  assert(
    cases.some((entry) => entry.layer === 'ai'),
    'no AI-only cases'
  );
  assert(
    cases.some((entry) => !NEWS_DERIVED_SOURCES.includes(entry.source)),
    'no non-news source cases, so the source filter is untested'
  );
});

for (const entry of cases.filter((row) => row.layer === 'denylist')) {
  Deno.test(`denylist [${entry.id}] is ${entry.expect}`, () => {
    const term = denylistVerdict(entry, entry.title);
    if (entry.expect === 'block') {
      assert(term, `expected "${entry.title}" to be blocked, but nothing matched`);
    } else {
      assertEquals(term, null, `"${entry.title}" was wrongly blocked by "${term}"`);
    }
  });
}

Deno.test('a song title that contains a blocked word is only safe because of the source filter', () => {
  // Guards the reasoning, not just the outcome: the keyword really is there.
  assertEquals(findUnsafeTerm(fold('Ako ang bagyo')), 'bagyo');
  const song = cases.find((entry) => entry.id === 'ako-ang-bagyo');
  assert(song, 'the song case is missing from the dataset');
  assertEquals(denylistVerdict(song!, song!.title), null);
});

Deno.test('no safe case is blocked after the model writes its own text', () => {
  // The validator re-runs the denylist over the model's title and summary. A safe
  // topic must survive that fold too, or a good topic is dropped after the model
  // already wrote it.
  for (const entry of cases.filter((row) => row.layer === 'denylist' && row.expect === 'safe')) {
    const combined = `${entry.title} ${entry.summary ?? ''}`;
    assertEquals(
      denylistVerdict(entry, combined),
      null,
      `"${entry.id}" failed the combined fold`
    );
  }
});
