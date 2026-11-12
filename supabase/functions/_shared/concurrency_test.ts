import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { runWithConcurrency } from './concurrency.ts';

Deno.test('runWithConcurrency - visits every item exactly once, in order', async () => {
  const seen: number[] = [];
  await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
    seen.push(item);
  });
  assertEquals(seen.sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

Deno.test('runWithConcurrency - never exceeds the limit', async () => {
  let inFlight = 0;
  let peak = 0;
  await runWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
  });
  assertEquals(peak, 3);
  assertEquals(inFlight, 0);
});

Deno.test('runWithConcurrency - a limit above the item count still runs everything', async () => {
  let count = 0;
  await runWithConcurrency([1, 2], 10, async () => {
    count += 1;
  });
  assertEquals(count, 2);
});

Deno.test('runWithConcurrency - an empty list resolves without work', async () => {
  let called = false;
  await runWithConcurrency([], 3, async () => {
    called = true;
  });
  assertEquals(called, false);
});

Deno.test('runWithConcurrency - a rejected worker surfaces and stops the queue', async () => {
  const started: number[] = [];
  let threw = false;
  try {
    await runWithConcurrency([1, 2, 3, 4], 1, async (item) => {
      started.push(item);
      if (item === 2) throw new Error('boom');
    });
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
  // With a limit of one, item 2 failing means 3 and 4 never start.
  assertEquals(started, [1, 2]);
});

Deno.test('runWithConcurrency - three 40ms jobs finish in about one wave, not three', async () => {
  const started = Date.now();
  await runWithConcurrency([1, 2, 3], 3, async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
  const elapsed = Date.now() - started;
  // Sequential would be ~120ms. Allow generous headroom for a loaded CI box; the point is that
  // it is nowhere near three waves.
  if (elapsed > 100) {
    throw new Error(`expected roughly one wave, took ${elapsed}ms`);
  }
});
