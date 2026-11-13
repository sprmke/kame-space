/**
 * Unit tests for the Marketing Trends read rules.
 * Run: deno test supabase/functions/_shared/marketingTrends/response_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  EXPIRED_AFTER_HOURS,
  STALE_AFTER_HOURS,
  shapeTrendsResponse,
  type TrendRunRow,
  type TrendTopicRow,
} from './response.ts';

const NOW = new Date('2026-11-10T06:00:00.000Z');

function run(over: Partial<TrendRunRow> = {}): TrendRunRow {
  return {
    id: 'run-1',
    run_date: '2026-11-10',
    started_at: '2026-11-10T05:30:00.000Z',
    finished_at: '2026-11-10T05:31:00.000Z',
    ...over,
  };
}

function topic(over: Partial<TrendTopicRow> = {}): TrendTopicRow {
  return {
    run_id: 'run-1',
    run_date: '2026-11-10',
    window: 'today',
    rank: 1,
    topic_key: 'pinoy-big-brother-collab-3-0',
    title: 'PBB Collab 3.0',
    summary: 'Fans are following the new housemates.',
    category: 'tv_film',
    momentum: 'new',
    days_trending: 1,
    sources: [{ source: 'google_trends' }],
    angles: [],
    caption_idea: 'Tonight is a staycation kind of night.',
    pinned: false,
    ...over,
  };
}

function shape(input: {
  run?: TrendRunRow | null;
  publishedRunCount?: number;
  rows?: TrendTopicRow[];
  hidden?: string[];
  pinned?: string[];
}) {
  return shapeTrendsResponse({
    run: input.run === undefined ? run() : input.run,
    publishedRunCount: input.publishedRunCount ?? 1,
    rows: input.rows ?? [topic()],
    hidden: new Set(input.hidden ?? []),
    pinned: new Set(input.pinned ?? []),
    now: NOW,
  });
}

Deno.test('a fresh list is returned as is', () => {
  const payload = shape({});
  assertEquals(payload.fallback, null);
  assertEquals(payload.stale, false);
  assertEquals(payload.topics.length, 1);
  assertEquals(payload.runDate, '2026-11-10');
});

Deno.test('no run at all falls back to evergreen', () => {
  const payload = shape({ run: null });
  assertEquals(payload.fallback, 'evergreen');
  assertEquals(payload.topics.length, 0);
  assertEquals(payload.windowsAvailable.length, 0);
});

Deno.test('a list older than the stale threshold is flagged, not dropped', () => {
  const publishedAt = new Date(NOW.getTime() - (STALE_AFTER_HOURS + 2) * 3_600_000);
  const payload = shape({
    run: run({ finished_at: publishedAt.toISOString(), started_at: publishedAt.toISOString() }),
  });
  assertEquals(payload.stale, true);
  assertEquals(payload.fallback, null);
  assertEquals(payload.topics.length, 1);
});

Deno.test('a list older than the expiry threshold falls back to evergreen', () => {
  const publishedAt = new Date(NOW.getTime() - (EXPIRED_AFTER_HOURS + 1) * 3_600_000);
  const payload = shape({
    run: run({ finished_at: publishedAt.toISOString(), started_at: publishedAt.toISOString() }),
  });
  assertEquals(payload.stale, true);
  assertEquals(payload.fallback, 'evergreen');
  assertEquals(payload.topics.length, 0);
});

Deno.test('a hidden topic never reaches the host', () => {
  const payload = shape({
    rows: [topic({ topic_key: 'hidden-one' }), topic({ topic_key: 'kept-one' })],
    hidden: ['hidden-one'],
  });
  assertEquals(payload.topics.length, 1);
  assertEquals(payload.topics[0]?.topicKey, 'kept-one');
});

Deno.test('hiding every topic falls back to evergreen', () => {
  const payload = shape({ hidden: ['pinoy-big-brother-collab-3-0'] });
  assertEquals(payload.fallback, 'evergreen');
  assertEquals(payload.topics.length, 0);
});

Deno.test('a pinned topic leads the list', () => {
  const payload = shape({
    rows: [
      topic({ topic_key: 'first', rank: 1 }),
      topic({ topic_key: 'second', rank: 2 }),
    ],
    pinned: ['second'],
  });
  assertEquals(payload.topics[0]?.topicKey, 'second');
  assertEquals(payload.topics[0]?.pinned, true);
});

Deno.test('windows are only offered once there is enough history', () => {
  assertEquals(shape({ publishedRunCount: 1 }).windowsAvailable, ['today']);
  assertEquals(shape({ publishedRunCount: 3 }).windowsAvailable, ['today', 'week']);
  assertEquals(shape({ publishedRunCount: 7 }).windowsAvailable, ['today', 'week', 'month']);
});

Deno.test('finish time is preferred, start time is the fallback', () => {
  const payload = shape({
    run: run({ finished_at: null, started_at: '2026-11-10T05:31:00.000Z' }),
  });
  assertEquals(payload.publishedAt, '2026-11-10T05:31:00.000Z');
});

Deno.test('the DTO carries only the fields the host UI renders', () => {
  const payload = shape({});
  const keys = Object.keys(payload.topics[0] ?? {}).sort();
  assertEquals(keys, [
    'angles',
    'captionIdea',
    'category',
    'daysTrending',
    'momentum',
    'pinned',
    'rank',
    'sources',
    'summary',
    'title',
    'topicKey',
  ]);
});
