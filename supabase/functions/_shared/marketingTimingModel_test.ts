import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  MIN_LEARNED_SAMPLES,
  bestLearnedWindows,
  blendTiming,
  preferredHourFromLearned,
  priorScore,
} from './marketingTimingModel.ts';

const samples = (weekday: number, hour: number, views: number, engagement: number, count = 1) =>
  Array.from({ length: count }, () => ({ weekday, hour, views, engagement }));

Deno.test('priorScore: a window hour scores above a quiet hour', () => {
  const midday = priorScore('3:13');
  const lateNight = priorScore('3:3');
  assert(midday > 0);
  assertEquals(lateNight, 0);
});

Deno.test('blendTiming: a single post stays close to the prior', () => {
  const prior = priorScore('3:13');
  const observed = 0.2;
  const value = blendTiming(samples(3, 13, 100, 20)).get('3:13')!;
  const low = Math.min(prior, observed);
  const high = Math.max(prior, observed);
  assert(value >= low && value <= high, `expected between ${low} and ${high}, got ${value}`);
  assert(Math.abs(value - prior) < Math.abs(observed - prior) / 3, 'one post must not dominate');
});

Deno.test('blendTiming: a large sample approaches the observed rate', () => {
  const value = blendTiming(samples(3, 20, 500, 100, 300)).get('3:20')!;
  assert(Math.abs(value - 0.2) < 0.03, `expected ~0.2, got ${value}`);
});

Deno.test('blendTiming: more posts move the score toward the observed rate', () => {
  const prior = priorScore('3:20');
  const few = blendTiming(samples(3, 20, 500, 100, 3)).get('3:20')!;
  const many = blendTiming(samples(3, 20, 500, 100, 60)).get('3:20')!;
  assert(Math.abs(many - prior) > Math.abs(few - prior), 'shrinkage should loosen with posts');
});

Deno.test('blendTiming: samples with no views are ignored', () => {
  assertEquals(blendTiming([{ weekday: 3, hour: 13, views: 0, engagement: 9 }]).size, 0);
});

Deno.test('bestLearnedWindows: refuses to learn from a thin sample', () => {
  assertEquals(bestLearnedWindows(samples(3, 20, 100, 30, MIN_LEARNED_SAMPLES - 1)), null);
});

Deno.test('bestLearnedWindows: returns the strongest buckets, highest first', () => {
  const learned = bestLearnedWindows([
    ...samples(3, 20, 200, 80, 4),
    ...samples(2, 11, 200, 20, 4),
    ...samples(4, 12, 200, 40, 4),
  ]);
  assert(learned && learned.length > 0);
  assertEquals(learned[0].weekday, 3);
  assertEquals(learned[0].startHour, 20);
  for (let index = 1; index < learned.length; index += 1) {
    assert(learned[index - 1].score >= learned[index].score);
  }
});

Deno.test('bestLearnedWindows: never returns quiet hours', () => {
  const learned = bestLearnedWindows([
    ...samples(5, 1, 500, 400, 6),
    ...samples(5, 2, 500, 350, 6),
    ...samples(6, 22, 500, 100, 6),
  ]);
  assert(learned && learned.length > 0);
  for (const window of learned) {
    assert(window.startHour >= 7 && window.startHour < 23, `quiet hour leaked: ${window.startHour}`);
  }
});

Deno.test('preferredHourFromLearned: picks the hour for that weekday only', () => {
  const learned = [
    { weekday: 3, startHour: 20, score: 0.5 },
    { weekday: 2, startHour: 11, score: 0.4 },
  ];
  assertEquals(preferredHourFromLearned(learned, 3), 20);
  assertEquals(preferredHourFromLearned(learned, 5), null);
  assertEquals(preferredHourFromLearned(null, 3), null);
});
