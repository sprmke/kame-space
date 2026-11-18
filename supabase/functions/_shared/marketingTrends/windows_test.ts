/**
 * Unit tests for the Marketing Trends window computation.
 * Run: deno test supabase/functions/_shared/marketingTrends/windows_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  availableWindows,
  computeWindowScores,
  daysBetween,
  decayedScore,
  WINDOW_CONFIG,
} from './windows.ts';

Deno.test('the week window uses a 0.85 decay over seven days', () => {
  assertEquals(WINDOW_CONFIG.week.days, 7);
  assertEquals(WINDOW_CONFIG.week.decay, 0.85);
  assertEquals(WINDOW_CONFIG.month.decay, 0.93);
});

Deno.test('decayedScore decays with age', () => {
  assertEquals(decayedScore(1, 0, 0.85), 1);
  assert(decayedScore(1, 3, 0.85) < 1);
  assertEquals(decayedScore(1, -1, 0.85), 0);
});

Deno.test('a topic that keeps trending climbs the window', () => {
  const entries = [
    { key: 'pbb', score: 1, ageDays: 0 },
    { key: 'pbb', score: 1, ageDays: 1 },
    { key: 'pbb', score: 1, ageDays: 2 },
    { key: 'pbb', score: 1, ageDays: 3 },
    { key: 'nintendo', score: 1, ageDays: 0 },
  ];
  const ranked = computeWindowScores(entries, 'week');
  assertEquals(ranked[0]?.key, 'pbb');
  assert(ranked[0]!.score > ranked[1]!.score);
});

Deno.test('entries older than the window are ignored', () => {
  const entries = [{ key: 'old', score: 10, ageDays: 8 }];
  assertEquals(computeWindowScores(entries, 'week').length, 0);
  assertEquals(computeWindowScores(entries, 'month').length, 1);
});

Deno.test('a window is only available once there is enough history', () => {
  assertEquals(availableWindows(1), ['today']);
  assertEquals(availableWindows(2), ['today']);
  assertEquals(availableWindows(3), ['today', 'week']);
  assertEquals(availableWindows(7), ['today', 'week', 'month']);
});

Deno.test('daysBetween counts calendar days', () => {
  assertEquals(daysBetween('2026-11-07', '2026-11-10'), 3);
  assertEquals(daysBetween('2026-11-10', '2026-11-10'), 0);
});
