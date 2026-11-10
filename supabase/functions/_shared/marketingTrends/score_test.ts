/**
 * Unit tests for the Marketing Trends scorer.
 * Run: deno test supabase/functions/_shared/marketingTrends/score_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  baseScore,
  crossSourceMultiplier,
  distinctSourceCount,
  finalScore,
  sourceRankScore,
  trafficBoost,
} from './score.ts';
import type { TrendSourceEvidence } from './types.ts';

function evidence(
  source: TrendSourceEvidence['source'],
  rank: number,
  extra: Partial<TrendSourceEvidence> = {}
): TrendSourceEvidence {
  return { source, rank, traffic: null, views: null, ...extra };
}

Deno.test('a higher rank scores lower', () => {
  assert(sourceRankScore(1, 1) > sourceRankScore(1, 4));
});

Deno.test('the cross-source bonus grows with every extra source', () => {
  assertEquals(crossSourceMultiplier(1), 1);
  assertEquals(crossSourceMultiplier(2), 1.3);
  assert(crossSourceMultiplier(3) > crossSourceMultiplier(2));
});

Deno.test('traffic buckets add a small boost', () => {
  assertEquals(trafficBoost(null), 0);
  assert(trafficBoost('1M+') > trafficBoost('100+'));
  assert(trafficBoost('1M+') > trafficBoost('10K+'));
});

Deno.test('the same topic on two sources scores higher than on one', () => {
  const one = baseScore([evidence('google_trends', 3)]);
  const two = baseScore([evidence('google_trends', 3), evidence('wikimedia_ph', 5)]);
  assert(two > one);
});

Deno.test('the same source twice does not double count', () => {
  const once = baseScore([evidence('google_trends', 3)]);
  const twice = baseScore([evidence('google_trends', 3), evidence('google_trends', 4)]);
  assertEquals(once, twice);
});

Deno.test('momentum and stay fit multiply the score', () => {
  const sources = [evidence('google_trends', 2)];
  const steady = finalScore({ sources, momentum: 'steady', stayFit: 2 });
  const rising = finalScore({ sources, momentum: 'rising', stayFit: 2 });
  const strong = finalScore({ sources, momentum: 'steady', stayFit: 3 });
  const weak = finalScore({ sources, momentum: 'steady', stayFit: 1 });
  assert(rising > steady);
  assert(strong > steady);
  assert(steady > weak);
});

Deno.test('stay fit 0 scores zero', () => {
  const sources = [evidence('google_trends', 1)];
  assertEquals(finalScore({ sources, momentum: 'new', stayFit: 0 }), 0);
});

Deno.test('distinctSourceCount counts sources, not rows', () => {
  assertEquals(
    distinctSourceCount([
      evidence('google_trends', 1),
      evidence('google_trends', 2),
      evidence('wikimedia_ph', 1),
    ]),
    2
  );
});
