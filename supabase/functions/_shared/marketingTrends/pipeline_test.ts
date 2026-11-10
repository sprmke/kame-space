/**
 * Unit tests for the Marketing Trends pipeline's pure steps.
 * Run: deno test supabase/functions/_shared/marketingTrends/pipeline_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  applyAliasMap,
  applyClassifyMerges,
  buildCandidates,
  rankTodayTopics,
  MAX_TOPICS,
  type TrendOverrides,
} from './pipeline.ts';
import type { TrendClassifiedTopic, TrendSourceResult } from './types.ts';

const NO_OVERRIDES: TrendOverrides = { hidden: new Set(), pinned: new Set() };

function source(
  id: TrendSourceResult['source'],
  titles: string[],
  over: Partial<TrendSourceResult> = {}
): TrendSourceResult {
  return {
    source: id,
    ok: true,
    ms: 1,
    error: null,
    items: titles.map((title, index) => ({ title, rank: index + 1 })),
    ...over,
  };
}

function classified(over: Partial<TrendClassifiedTopic> = {}): TrendClassifiedTopic {
  return {
    key: 'pinoy-big-brother-collab-3-0',
    mergeInto: null,
    title: 'PBB Collab 3.0',
    category: 'tv_film',
    safety: 'safe',
    blockReason: null,
    stayFit: 3,
    summary: 'Fans are following the new housemates.',
    angles: [],
    captionIdea: 'Tonight is a staycation kind of night.',
    hashtags: ['#Staycation'],
    brandGuard: [],
    ...over,
  };
}

Deno.test('near-duplicate titles merge into one candidate', () => {
  const { candidates } = buildCandidates([
    source('google_trends', ['Pinoy Big Brother: Collab 3.0']),
    source('wikimedia_ph', ['Pinoy Big Brother Collab 3.0']),
  ]);
  assertEquals(candidates.length, 1);
  assertEquals(candidates[0]?.sources.length, 2);
  assertEquals(candidates[0]?.sourceCount, 2);
});

Deno.test('one source cannot contribute twice to the same topic', () => {
  const { candidates } = buildCandidates([
    source('google_trends', ['Pinoy Big Brother: Collab 3.0', 'PINOY BIG BROTHER collab 3.0']),
  ]);
  assertEquals(candidates.length, 1);
  assertEquals(candidates[0]?.sourceCount, 1);
});

Deno.test('index pages and evergreen terms are dropped', () => {
  const { candidates, dropped } = buildCandidates([
    source('wikimedia_ph', ['Main_Page', 'Special:Search', 'Philippines', 'Alexandra_Eala']),
  ]);
  assertEquals(candidates.length, 1);
  assertEquals(candidates[0]?.key, 'alexandra-eala');
  assertEquals(dropped, 3);
});

Deno.test('the keyword denylist applies to news sources only', () => {
  // "Ako ang bagyo" is a song, not a storm.
  const news = buildCandidates([source('google_trends', ['bagyo signal'])]).candidates;
  const music = buildCandidates([source('apple_music', ['Ako ang bagyo'])]).candidates;
  assertEquals(news.length, 0);
  assertEquals(music.length, 1);
});

Deno.test('a merge folds the duplicate evidence into the target', () => {
  const { candidates } = buildCandidates([
    source('google_trends', ['Pinoy Big Brother Collab 3.0']),
    source('apple_music', ['PBB Collab Theme']),
  ]);
  assertEquals(candidates.length, 2);

  const target = candidates.find((entry) => entry.key === 'pinoy-big-brother-collab-3-0')!;
  const duplicate = candidates.find((entry) => entry.key === 'pbb-collab-theme')!;

  const applied = applyClassifyMerges(candidates, [
    { from: duplicate.key, into: target.key },
  ]);
  assertEquals(applied, 1);
  assertEquals(target.sourceCount, 2);
});

Deno.test('a merge is ignored when either side is unknown', () => {
  const { candidates } = buildCandidates([source('google_trends', ['nintendo switch update'])]);
  assertEquals(
    applyClassifyMerges(candidates, [{ from: 'not-real', into: candidates[0]!.key }]),
    0
  );
});

Deno.test('a topic that was not there yesterday is new', () => {
  const { candidates } = buildCandidates([source('google_trends', ['nintendo switch update'])]);
  const ranked = rankTodayTopics({
    topics: [classified({ key: candidates[0]!.key, title: 'Nintendo update' })],
    candidates,
    previous: new Map(),
    overrides: NO_OVERRIDES,
    runDate: '2026-11-10',
  });
  assertEquals(ranked[0]?.momentum, 'new');
  assertEquals(ranked[0]?.days_trending, 1);
});

Deno.test('a topic that climbed the list is rising', () => {
  const { candidates } = buildCandidates([
    source('google_trends', ['nintendo switch update', 'alexandra eala']),
  ]);
  const ranked = rankTodayTopics({
    topics: candidates.map((entry) => classified({ key: entry.key, stayFit: 2 })),
    candidates,
    previous: new Map([['nintendo-switch-update', { rank: 4, firstSeen: '2026-11-08' }]]),
    overrides: NO_OVERRIDES,
    runDate: '2026-11-10',
  });

  const nintendo = ranked.find((row) => row.topic_key === 'nintendo-switch-update')!;
  assertEquals(nintendo.momentum, 'rising');
  assertEquals(nintendo.days_trending, 3);
});

Deno.test('a topic that held its place is steady', () => {
  const { candidates } = buildCandidates([source('google_trends', ['nintendo switch update'])]);
  const ranked = rankTodayTopics({
    topics: [classified({ key: candidates[0]!.key, stayFit: 2 })],
    candidates,
    previous: new Map([['nintendo-switch-update', { rank: 1, firstSeen: '2026-11-09' }]]),
    overrides: NO_OVERRIDES,
    runDate: '2026-11-10',
  });
  assertEquals(ranked[0]?.momentum, 'steady');
});

Deno.test('a pinned topic leads regardless of score', () => {
  const { candidates } = buildCandidates([
    source('google_trends', ['nintendo switch update']),
    source('wikimedia_ph', ['pinoy big brother collab 3.0']),
  ]);
  const ranked = rankTodayTopics({
    topics: candidates.map((entry) => classified({ key: entry.key, stayFit: entry.key.includes('pinoy') ? 3 : 1 })),
    candidates,
    previous: new Map(),
    overrides: { hidden: new Set(), pinned: new Set(['nintendo-switch-update']) },
    runDate: '2026-11-10',
  });
  assertEquals(ranked[0]?.topic_key, 'nintendo-switch-update');
  assertEquals(ranked[0]?.pinned, true);
});

Deno.test('the list is capped', () => {
  const titles = Array.from({ length: 40 }, (_, index) => `artist number ${index} song`);
  const { candidates } = buildCandidates([source('google_trends', titles)]);
  const ranked = rankTodayTopics({
    topics: candidates.map((entry) => classified({ key: entry.key, stayFit: 2, title: entry.title })),
    candidates,
    previous: new Map(),
    overrides: NO_OVERRIDES,
    runDate: '2026-11-10',
  });
  assert(ranked.length <= MAX_TOPICS);
});

Deno.test('a manual topic is marked as manual', () => {
  const { candidates } = buildCandidates([source('editor', ['Local festival weekend'])]);
  const ranked = rankTodayTopics({
    topics: [classified({ key: candidates[0]!.key, title: 'Local festival weekend' })],
    candidates,
    previous: new Map(),
    overrides: NO_OVERRIDES,
    runDate: '2026-11-10',
  });
  assertEquals(ranked[0]?.manual, true);
});

Deno.test('a higher stay fit ranks above an equal topic with less', () => {
  const { candidates } = buildCandidates([
    source('google_trends', ['nintendo switch update']),
    source('wikimedia_ph', ['pinoy big brother collab 3.0']),
  ]);
  const ranked = rankTodayTopics({
    topics: [
      classified({ key: 'nintendo-switch-update', stayFit: 1 }),
      classified({ key: 'pinoy-big-brother-collab-3-0', stayFit: 3 }),
    ],
    candidates,
    previous: new Map(),
    overrides: NO_OVERRIDES,
    runDate: '2026-11-10',
  });
  assertEquals(ranked[0]?.topic_key, 'pinoy-big-brother-collab-3-0');
});

Deno.test('a respelling is renamed to the key the topic settled on', () => {
  // Today the feed says "PBB Collab 3.0"; yesterday the AI settled that spelling into
  // the longer key. The candidate must take the settled key, or the streak resets.
  const candidates = buildCandidates([source('google_trends', ['PBB Collab 3.0'])]).candidates;
  const todayKey = candidates[0]!.key;

  const applied = applyAliasMap(
    candidates,
    new Map([[todayKey, 'pinoy-big-brother-collab-3-0']])
  );
  assertEquals(applied, 1);
  assertEquals(candidates.length, 1);
  assertEquals(candidates[0]!.key, 'pinoy-big-brother-collab-3-0');
  assertEquals(candidates[0]!.aliases, [todayKey]);
});

Deno.test('both spellings in one feed fold into the canonical candidate', () => {
  const candidates = buildCandidates([
    source('google_trends', ['PBB Collab 3.0']),
    source('wikimedia_ph', ['Pinoy Big Brother Collab 3.0']),
  ]).candidates;
  const shortKey = candidates.find((entry) => entry.key === 'pbb-collab-3-0')!.key;

  const applied = applyAliasMap(
    candidates,
    new Map([[shortKey, 'pinoy-big-brother-collab-3-0']])
  );
  assertEquals(applied, 1);
  assertEquals(candidates.length, 1);
  assertEquals(candidates[0]!.key, 'pinoy-big-brother-collab-3-0');
  assertEquals(candidates[0]!.sourceCount, 2);
  assertEquals(candidates[0]!.aliases, [shortKey]);
});

Deno.test('an alias chain resolves and a cycle stops', () => {
  const candidates = buildCandidates([source('google_trends', ['PBB Collab 3.0'])]).candidates;
  const key = candidates[0]!.key;
  applyAliasMap(
    candidates,
    new Map([
      [key, 'middle-key'],
      ['middle-key', 'final-key'],
    ])
  );
  assertEquals(candidates[0]!.key, 'final-key');

  const looping = buildCandidates([source('google_trends', ['PBB Collab 3.0'])]).candidates;
  const loopKey = looping[0]!.key;
  // a -> b -> a must not hang.
  applyAliasMap(
    looping,
    new Map([
      [loopKey, 'b-key'],
      ['b-key', loopKey],
    ])
  );
  assertEquals(looping.length, 1);
});

Deno.test('an alias with no matching candidate is left alone', () => {
  const candidates = buildCandidates([source('google_trends', ['nintendo switch update'])]).candidates;
  const applied = applyAliasMap(candidates, new Map([['something-else', 'not-a-candidate']]));
  assertEquals(applied, 0);
  assertEquals(candidates.length, 1);
});

Deno.test('an alias map of nothing costs nothing', () => {
  const candidates = buildCandidates([source('google_trends', ['nintendo switch update'])]).candidates;
  assertEquals(applyAliasMap(candidates, new Map()), 0);
});

Deno.test('aliases reach the published row', () => {
  const candidates = buildCandidates([source('google_trends', ['PBB Collab 3.0'])]).candidates;
  const todayKey = candidates[0]!.key;
  applyAliasMap(candidates, new Map([[todayKey, 'pinoy-big-brother-collab-3-0']]));

  const ranked = rankTodayTopics({
    topics: [classified({ key: 'pinoy-big-brother-collab-3-0', title: 'PBB Collab 3.0' })],
    candidates,
    previous: new Map(),
    overrides: NO_OVERRIDES,
    runDate: '2026-11-10',
  });
  assertEquals(ranked[0]?.topic_key, 'pinoy-big-brother-collab-3-0');
  assertEquals(ranked[0]?.aliases, [todayKey]);
});

Deno.test('a real merge is remembered as an alias too', () => {
  const { candidates } = buildCandidates([
    source('google_trends', ['Pinoy Big Brother Collab 3.0']),
    source('apple_music', ['PBB Collab Theme']),
  ]);
  const target = candidates.find((entry) => entry.key === 'pinoy-big-brother-collab-3-0')!;
  const duplicate = candidates.find((entry) => entry.key === 'pbb-collab-theme')!;

  applyClassifyMerges(candidates, [{ from: duplicate.key, into: target.key }]);
  assertEquals(target.aliases, [duplicate.key]);
});
