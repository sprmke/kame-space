/**
 * Unit tests for the Marketing Trends normalizer.
 * Run: deno test supabase/functions/_shared/marketingTrends/normalize_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  foldDiacritics,
  isStoplistedTitle,
  jaccard,
  normalizeRawTitle,
  normalizeTitle,
  titlesOverlap,
  tokenize,
  topicKeyFromNormalized,
} from './normalize.ts';

Deno.test('normalizeTitle lowercases, folds diacritics and drops punctuation', () => {
  assertEquals(normalizeTitle('Pinoy Big Brother: Collab 3.0'), 'pinoy big brother collab 3.0');
  assertEquals(normalizeTitle('José Rizal'), 'jose rizal');
  assertEquals(normalizeTitle('Crown_Jewel_(2026)'), 'crown jewel');
  assertEquals(normalizeTitle('Beeg'), 'beeg');
});

Deno.test('normalizeTitle keeps a version number as one token', () => {
  assertEquals(normalizeTitle('GPT 5.2 launch'), 'gpt 5.2 launch');
});

Deno.test('foldDiacritics keeps the ASCII letters', () => {
  assertEquals(foldDiacritics('Ángel ñandú'), 'Angel nandu');
});

Deno.test('the topic key is a stable slug', () => {
  assertEquals(
    topicKeyFromNormalized(normalizeTitle('Pinoy Big Brother: Collab 3.0')),
    'pinoy-big-brother-collab-3-0'
  );
});

Deno.test('normalizeRawTitle keeps a readable display title', () => {
  const title = normalizeRawTitle('Pinoy_Big_Brother:_Collab_3.0');
  assertEquals(title.display, 'Pinoy Big Brother: Collab 3.0');
  assertEquals(title.key, 'pinoy-big-brother-collab-3-0');
});

Deno.test('wiki disambiguators are stripped', () => {
  assertEquals(normalizeTitle('The Expanse (TV series)'), 'the expanse');
  assertEquals(normalizeTitle('Someone (singer)'), 'someone');
});

Deno.test('tokenize drops stop words and very short tokens', () => {
  assertEquals(tokenize('the show of the pbb housemate'), ['show', 'pbb', 'housemate']);
});

Deno.test('jaccard is 1 for the same token set and 0 for disjoint ones', () => {
  assertEquals(jaccard(['pinoy', 'big', 'brother'], ['pinoy', 'big', 'brother']), 1);
  assertEquals(jaccard(['pinoy'], ['nintendo']), 0);
  assertEquals(jaccard([], ['a']), 0);
});

Deno.test('overlapping titles are merged', () => {
  const a = normalizeRawTitle('Pinoy Big Brother: Collab 3.0');
  const b = normalizeRawTitle('Pinoy Big Brother Collab 3.0');
  assert(titlesOverlap(a, b));
});

Deno.test('different titles are not merged', () => {
  const a = normalizeRawTitle('nintendo switch 2 update');
  const b = normalizeRawTitle('alexandra eala');
  assert(!titlesOverlap(a, b));
});

Deno.test('index pages and evergreen terms are stoplisted', () => {
  assert(isStoplistedTitle('main page'));
  assert(isStoplistedTitle('special search'));
  assert(isStoplistedTitle('natatangi maghanap'));
  assert(isStoplistedTitle('unang pahina'));
  assert(isStoplistedTitle('philippines'));
  assert(isStoplistedTitle('manila'));
  assert(!isStoplistedTitle('alexandra eala'));
});
