/**
 * Unit tests for the Marketing Trends classify validator.
 * Run: deno test supabase/functions/_shared/marketingTrends/marketingTrendsClassify_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { shapeTrendClassifyOutput, TrendClassifyResponse } from './marketingTrendsClassify.ts';

const KEYS = ['pinoy-big-brother-collab-3-0', 'alexandra-eala', 'lotto-result-today-9pm'];

function topic(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: 'pinoy-big-brother-collab-3-0',
    title: 'PBB Collab 3.0',
    category: 'tv_film',
    safety: 'safe',
    stayFit: 3,
    summary: 'Fans are following the new housemates this week.',
    angles: [
      {
        title: 'Watch party staycation',
        hook: 'Big night on screen, better from a proper stay.',
        output: 'post',
        goal: 'vibe',
        format: 'instagram-portrait',
        prompt: 'A cozy living room with the TV on. No logos, no people.',
      },
    ],
    captionIdea: 'Tonight is a staycation kind of night.',
    hashtags: ['#Staycation'],
    brandGuard: ['no_likeness', 'no_logo', 'no_endorsement'],
    ...over,
  };
}

Deno.test('a clean topic is kept', () => {
  const result = shapeTrendClassifyOutput({ topics: [topic()] }, KEYS);
  assertEquals(result.topics.length, 1);
  assertEquals(result.topics[0]?.key, 'pinoy-big-brother-collab-3-0');
  assertEquals(result.topics[0]?.stayFit, 3);
  assertEquals(result.topics[0]?.angles.length, 1);
});

Deno.test('a topic with an unknown key is dropped', () => {
  const result = shapeTrendClassifyOutput({ topics: [topic({ key: 'not-a-candidate' })] }, KEYS);
  assertEquals(result.topics.length, 0);
  assertEquals(result.dropped, 1);
});

Deno.test('a blocked topic is counted and never published', () => {
  const result = shapeTrendClassifyOutput(
    { topics: [topic({ key: 'lotto-result-today-9pm', safety: 'block', title: 'Lotto result' })] },
    KEYS
  );
  assertEquals(result.topics.length, 0);
  assertEquals(result.blocked, 1);
});

Deno.test('the denylist runs over the model text too', () => {
  const result = shapeTrendClassifyOutput(
    {
      topics: [
        topic({
          safety: 'safe',
          title: 'Christmas',
          summary: 'A long weekend of food.',
          captionIdea: 'Also, the lotto result today.',
        }),
      ],
    },
    KEYS
  );
  assertEquals(result.topics.length, 0);
  assertEquals(result.blocked, 1);
});

Deno.test('a merge is reported and the merged topic is not published twice', () => {
  const result = shapeTrendClassifyOutput(
    {
      topics: [
        topic({ key: 'alexandra-eala', mergeInto: 'pinoy-big-brother-collab-3-0' }),
        topic(),
      ],
    },
    KEYS
  );
  assertEquals(result.merges, [
    { from: 'alexandra-eala', into: 'pinoy-big-brother-collab-3-0' },
  ]);
  assertEquals(result.topics.length, 1);
});

Deno.test('a merge into an unknown key is ignored, not swallowed', () => {
  const result = shapeTrendClassifyOutput(
    {
      topics: [
        topic({ key: 'alexandra-eala', mergeInto: 'not-a-candidate' }),
        topic(),
      ],
    },
    KEYS
  );
  assertEquals(result.merges.length, 0);
  assertEquals(result.topics.length, 2);
});

Deno.test('stay fit 0 is never published', () => {
  const result = shapeTrendClassifyOutput({ topics: [topic({ stayFit: 0 })] }, KEYS);
  assertEquals(result.topics.length, 0);
});

Deno.test('unknown enums fall back to the safe default', () => {
  const result = shapeTrendClassifyOutput(
    {
      topics: [
        topic({
          category: 'not_a_category',
          angles: [
            {
              title: 'A',
              hook: 'B',
              output: 'hologram',
              goal: 'chaos',
              format: 'unknown',
              prompt: 'C',
            },
          ],
        }),
      ],
    },
    KEYS
  );
  assertEquals(result.topics[0]?.category, 'other');
  assertEquals(result.topics[0]?.angles[0]?.output, 'post');
  assertEquals(result.topics[0]?.angles[0]?.goal, 'vibe');
});

Deno.test('hashtags are capped and prefixed', () => {
  const result = shapeTrendClassifyOutput(
    { topics: [topic({ hashtags: ['one', '#two', 'three', 'four', 'five', 'six'] })] },
    KEYS
  );
  assertEquals(result.topics[0]?.hashtags.length, 5);
  assertEquals(result.topics[0]?.hashtags[0], '#one');
  assertEquals(result.topics[0]?.hashtags[1], '#two');
});

Deno.test('the brand guard is filled in for people-adjacent categories', () => {
  const result = shapeTrendClassifyOutput(
    { topics: [topic({ category: 'celebrity', brandGuard: [] })] },
    KEYS
  );
  assertEquals(result.topics[0]?.brandGuard.length, 3);
});

Deno.test('a non-people category gets no brand guard', () => {
  const result = shapeTrendClassifyOutput(
    { topics: [topic({ category: 'sports', brandGuard: [] })] },
    KEYS
  );
  assertEquals(result.topics[0]?.brandGuard.length, 0);
});

Deno.test('a broken payload yields nothing instead of throwing', () => {
  assertEquals(shapeTrendClassifyOutput({ topics: 'nope' }, KEYS).topics.length, 0);
  assertEquals(shapeTrendClassifyOutput(null, KEYS).topics.length, 0);
});

Deno.test('a numeric stayFit arrives as a string and is still read', () => {
  const result = shapeTrendClassifyOutput({ topics: [topic({ stayFit: '3' })] }, KEYS);
  assertEquals(result.topics[0]?.stayFit, 3);
});

Deno.test('hashtags and guard rules survive a single string instead of a list', () => {
  const result = shapeTrendClassifyOutput(
    { topics: [topic({ hashtags: '#Staycation', brandGuard: 'no_logo' })] },
    KEYS
  );
  assertEquals(result.topics[0]?.hashtags, ['#Staycation']);
  assertEquals(result.topics[0]?.brandGuard.includes('no_logo'), true);
});

Deno.test('a single angle object instead of an array is still an angle', () => {
  const result = shapeTrendClassifyOutput(
    {
      topics: [
        topic({
          angles: {
            title: 'Watch party',
            hook: 'Big night.',
            output: 'post',
            goal: 'vibe',
            format: 'instagram-portrait',
            prompt: 'A cozy living room.',
          },
        }),
      ],
    },
    KEYS
  );
  assertEquals(result.topics[0]?.angles.length, 1);
});

Deno.test('one malformed topic does not cost the whole list', () => {
  const result = shapeTrendClassifyOutput(
    {
      topics: [
        { key: 'pinoy-big-brother-collab-3-0' }, // no title, summary or stayFit
        topic({ key: 'alexandra-eala', title: 'Alexandra Eala', category: 'sports', stayFit: 2 }),
      ],
    },
    KEYS
  );
  // The empty one is dropped (stayFit 0), the good one survives.
  assertEquals(result.topics.length, 1);
  assertEquals(result.topics[0]?.key, 'alexandra-eala');
});

Deno.test('a topics object instead of an array is unwrapped', () => {
  const result = shapeTrendClassifyOutput({ topics: topic() }, KEYS);
  assertEquals(result.topics.length, 1);
});

Deno.test('a bare array of topics is accepted', () => {
  const result = shapeTrendClassifyOutput([topic()], KEYS);
  assertEquals(result.topics.length, 1);
});

Deno.test('the gateway contract accepts both envelope shapes and rejects an empty reply', () => {
  // A bare array and a {topics} object are both accepted: the model has produced each.
  assertEquals(TrendClassifyResponse.safeParse([topic()]).success, true);
  assertEquals(TrendClassifyResponse.safeParse({ topics: [topic()] }).success, true);
  // JSON with no topics is a real contract failure, so the repair turn fires.
  assertEquals(TrendClassifyResponse.safeParse({}).success, false);
  assertEquals(TrendClassifyResponse.safeParse({ topics: [] }).success, false);
  assertEquals(TrendClassifyResponse.safeParse('not json at all').success, false);
});
