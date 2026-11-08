import {
  assert,
  assertEquals,
  assertFalse,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
  type EdgeTimings,
  formatServerTiming,
  SERVER_TIMING_HEADER,
  timePhase,
  withServerTiming,
} from './serverTiming.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.test('formatServerTiming renders one duration per phase', () => {
  const header = formatServerTiming({ auth: 12.34, handler: 88.2 });
  assertEquals(header, 'auth;dur=12.3, handler;dur=88.2');
});

Deno.test('formatServerTiming drops non-finite and negative values', () => {
  const header = formatServerTiming({
    auth: Number.NaN,
    handler: -5,
    ratelimit: 0,
  });
  assertEquals(header, 'ratelimit;dur=0.0');
});

Deno.test('formatServerTiming returns an empty string with no timings', () => {
  assertEquals(formatServerTiming({}), '');
});

Deno.test('withServerTiming sets Server-Timing and Timing-Allow-Origin', async () => {
  const wrapped = withServerTiming(jsonResponse({ ok: true }), { auth: 5, handler: 9 });

  assertEquals(wrapped.status, 200);
  assertEquals(wrapped.headers.get(SERVER_TIMING_HEADER), 'auth;dur=5.0, handler;dur=9.0');
  assertEquals(wrapped.headers.get('Timing-Allow-Origin'), '*');
  assertEquals(await wrapped.json(), { ok: true });
});

Deno.test('withServerTiming preserves existing headers and status', () => {
  const original = jsonResponse({ error: 'nope' }, 429);
  original.headers.set('Retry-After', '7');
  original.headers.set('Content-Type', 'application/json');

  const wrapped = withServerTiming(original, { handler: 3 });

  assertEquals(wrapped.status, 429);
  assertEquals(wrapped.headers.get('Retry-After'), '7');
  assertEquals(wrapped.headers.get('Content-Type'), 'application/json');
});

Deno.test('withServerTiming never leaks identifiers into the header', async () => {
  const wrapped = withServerTiming(jsonResponse({ ok: true }), { auth: 1, handler: 2 });
  const header = wrapped.headers.get(SERVER_TIMING_HEADER) ?? '';

  assertFalse(header.includes('@'));
  assertFalse(header.includes('bearer'));
  assertFalse(header.includes('user'));
  // Only phase names and durations are allowed.
  assert(/^[a-z]+;dur=[\d.]+(, [a-z]+;dur=[\d.]+)*$/.test(header), `unexpected header: ${header}`);
});

Deno.test('withServerTiming returns the response untouched when there is nothing to add', () => {
  const original = jsonResponse({ ok: true });
  assertEquals(withServerTiming(original, {}), original);
});

Deno.test('withServerTiming returns the response untouched when the body was read', async () => {
  const original = jsonResponse({ ok: true });
  await original.text();

  const wrapped = withServerTiming(original, { handler: 4 });
  assertEquals(wrapped, original);
  assertEquals(original.headers.get(SERVER_TIMING_HEADER), null);
});

Deno.test('timePhase records a duration and returns the value', async () => {
  const timings: EdgeTimings = {};
  const value = await timePhase(timings, 'handler', () => 'ok');

  assertEquals(value, 'ok');
  assert(typeof timings.handler === 'number');
  assert(timings.handler >= 0);
});

Deno.test('timePhase records a failed phase so auth errors still show', async () => {
  const timings: EdgeTimings = {};
  let caught = false;

  try {
    await timePhase(timings, 'auth', () => {
      throw new Error('bad token');
    });
  } catch {
    caught = true;
  }

  assert(caught);
  assert(typeof timings.auth === 'number');
});
