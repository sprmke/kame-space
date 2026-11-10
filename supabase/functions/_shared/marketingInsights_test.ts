import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  ageBucketFor,
  mapFacebookPostInsights,
  mapInstagramInsights,
  rollupSnapshots,
  toMetricMap,
} from './marketingInsights.ts';

Deno.test('toMetricMap: reads the {data:[{name,values}]} envelope', () => {
  const map = toMetricMap({
    data: [
      { name: 'views', values: [{ value: 120 }] },
      { name: 'reach', values: [{ value: 90 }] },
    ],
  });
  assertEquals(map.get('views'), 120);
  assertEquals(map.get('reach'), 90);
});

Deno.test('toMetricMap: tolerates a bare array and a direct value', () => {
  const map = toMetricMap([{ name: 'likes', value: 7 }]);
  assertEquals(map.get('likes'), 7);
});

Deno.test('toMetricMap: ignores junk rows', () => {
  const map = toMetricMap({ data: [null, {}, { name: 4 }, { name: 'x', values: [{ value: 'nope' }] }] });
  assertEquals(map.size, 0);
});

Deno.test('mapInstagramInsights: falls back to the old impressions name', () => {
  const snapshot = mapInstagramInsights({
    data: [{ name: 'impressions', values: [{ value: 500 }] }],
  });
  assertEquals(snapshot.views, 500);
  assertEquals(snapshot.reach, null);
});

Deno.test('mapInstagramInsights: reads saves and shares', () => {
  const snapshot = mapInstagramInsights({
    data: [
      { name: 'saved', values: [{ value: 4 }] },
      { name: 'shares', values: [{ value: 6 }] },
      { name: 'total_interactions', values: [{ value: 30 }] },
    ],
  });
  assertEquals(snapshot.saves, 4);
  assertEquals(snapshot.shares, 6);
  assertEquals(snapshot.interactions, 30);
});

Deno.test('mapFacebookPostInsights: accepts the June 2026 reach metric', () => {
  const snapshot = mapFacebookPostInsights({
    data: [
      { name: 'post_media_views', values: [{ value: 300 }] },
      { name: 'post_total_media_view_unique', values: [{ value: 210 }] },
      { name: 'post_reactions_like_total', values: [{ value: 12 }] },
    ],
  });
  assertEquals(snapshot.views, 300);
  assertEquals(snapshot.reach, 210);
  assertEquals(snapshot.likes, 12);
});

Deno.test('ageBucketFor: maps hours onto the four snapshot windows', () => {
  assertEquals(ageBucketFor(1), null);
  assertEquals(ageBucketFor(24), '24h');
  assertEquals(ageBucketFor(71), '24h');
  assertEquals(ageBucketFor(72), '72h');
  assertEquals(ageBucketFor(167), '72h');
  assertEquals(ageBucketFor(168), '7d');
  assertEquals(ageBucketFor(671), '7d');
  assertEquals(ageBucketFor(672), '28d');
});

Deno.test('rollupSnapshots: the newest bucket wins', () => {
  const rolled = rollupSnapshots([
    { ageBucket: '7d', views: 900, reach: 500, likes: 40, comments: 3, shares: 2, saves: 5, interactions: 50 },
    { ageBucket: '24h', views: 100, reach: 80, likes: 5, comments: 1, shares: 0, saves: 1, interactions: 7 },
  ]);
  assertEquals(rolled.views, 900);
  assertEquals(rolled.likes, 40);
});

Deno.test('rollupSnapshots: no snapshots yields a null row', () => {
  assertEquals(rollupSnapshots([]).views, null);
});
