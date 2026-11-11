import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { computeMetaNextRunAt } from './metaInboxSync.ts';
import { readMetaRateLimitPct } from './metaInboxGraphPaging.ts';

const NOW = new Date('2026-11-10T12:00:00.000Z');

function minutesFromNow(date: Date): number {
  return Math.round((date.getTime() - NOW.getTime()) / 60_000);
}

Deno.test('computeMetaNextRunAt: an open inbox checks every two minutes', () => {
  const next = computeMetaNextRunAt({
    now: NOW,
    lastChangeAt: '2026-11-10T11:59:00.000Z',
    inboxOpen: true,
    rateLimitPct: null,
  });
  assertEquals(minutesFromNow(next), 2);
});

Deno.test('computeMetaNextRunAt: recent activity backs off as the thread goes quiet', () => {
  const active = computeMetaNextRunAt({
    now: NOW,
    lastChangeAt: '2026-11-10T11:00:00.000Z',
    inboxOpen: false,
    rateLimitPct: null,
  });
  assertEquals(minutesFromNow(active), 10);

  const thisWeek = computeMetaNextRunAt({
    now: NOW,
    lastChangeAt: '2026-11-08T12:00:00.000Z',
    inboxOpen: false,
    rateLimitPct: null,
  });
  assertEquals(minutesFromNow(thisWeek), 30);

  const quiet = computeMetaNextRunAt({
    now: NOW,
    lastChangeAt: '2026-10-01T12:00:00.000Z',
    inboxOpen: false,
    rateLimitPct: null,
  });
  assertEquals(minutesFromNow(quiet), 6 * 60);

  const never = computeMetaNextRunAt({
    now: NOW,
    lastChangeAt: null,
    inboxOpen: false,
    rateLimitPct: null,
  });
  assertEquals(minutesFromNow(never), 6 * 60);
});

Deno.test('computeMetaNextRunAt: rate-limit pressure and failures only slow it down', () => {
  const pressured = computeMetaNextRunAt({
    now: NOW,
    lastChangeAt: '2026-11-10T11:00:00.000Z',
    inboxOpen: false,
    rateLimitPct: 80,
  });
  assertEquals(minutesFromNow(pressured), 20);

  const failing = computeMetaNextRunAt({
    now: NOW,
    lastChangeAt: '2026-11-10T11:00:00.000Z',
    inboxOpen: false,
    rateLimitPct: null,
    consecutiveFailures: 3,
  });
  assertEquals(minutesFromNow(failing), 80);

  // The failure multiplier is capped, so a dead connection is not scheduled months out.
  const veryBroken = computeMetaNextRunAt({
    now: NOW,
    lastChangeAt: '2026-11-10T11:00:00.000Z',
    inboxOpen: false,
    rateLimitPct: null,
    consecutiveFailures: 40,
  });
  assertEquals(minutesFromNow(veryBroken), 10 * 16);
});

Deno.test('readMetaRateLimitPct: takes the highest call_count in the header', () => {
  const headers = new Headers({
    'x-business-use-case-usage': JSON.stringify({
      '1234567890': [
        { type: 'pages', call_count: 12, total_cputime: 5, total_time: 8 },
        { type: 'messenger', call_count: 64, total_cputime: 10, total_time: 20 },
      ],
    }),
  });
  assertEquals(readMetaRateLimitPct(headers), 64);
});

Deno.test('readMetaRateLimitPct: falls back to x-app-usage and clamps to 100', () => {
  const headers = new Headers({ 'x-app-usage': JSON.stringify({ call_count: 140 }) });
  assertEquals(readMetaRateLimitPct(headers), 100);
});

Deno.test('readMetaRateLimitPct: absent or unparseable headers are null', () => {
  assertEquals(readMetaRateLimitPct(new Headers()), null);
  assertEquals(readMetaRateLimitPct(new Headers({ 'x-app-usage': 'not json' })), null);
  assertEquals(readMetaRateLimitPct(new Headers({ 'x-app-usage': JSON.stringify({}) })), null);
});
