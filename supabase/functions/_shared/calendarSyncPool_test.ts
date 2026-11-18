import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { groupFeedsByProperty, runFeedPool } from './calendarSyncPool.ts';

function feed(id: string, property_id: string) {
  return { id, property_id };
}

Deno.test('feeds are grouped by property, first-seen order preserved', () => {
  const groups = groupFeedsByProperty([feed('a', 'p1'), feed('b', 'p2'), feed('c', 'p1')]);
  assertEquals(
    groups.map((g) => g.propertyId),
    ['p1', 'p2']
  );
  assertEquals(
    groups[0].feeds.map((f) => f.id),
    ['a', 'c']
  );
  assertEquals(
    groups[1].feeds.map((f) => f.id),
    ['b']
  );
});

Deno.test('one feed at a time within a property, several properties in parallel', async () => {
  let active = 0;
  let maxActive = 0;
  const activeProperties = new Map<string, number>();
  let overlaps = 0;

  await runFeedPool(
    groupFeedsByProperty([feed('a1', 'p1'), feed('a2', 'p1'), feed('b1', 'p2'), feed('b2', 'p2')]),
    4,
    async (f) => {
      active++;
      maxActive = Math.max(maxActive, active);
      const now = (activeProperties.get(f.property_id) ?? 0) + 1;
      if (now > 1) overlaps++;
      activeProperties.set(f.property_id, now);
      await new Promise((r) => setTimeout(r, 5));
      activeProperties.set(f.property_id, (activeProperties.get(f.property_id) ?? 1) - 1);
      active--;
      return f.id;
    }
  );

  assertEquals(overlaps, 0, 'two feeds of one property must never run together');
  assertEquals(maxActive > 1, true, 'independent properties should overlap');
  assertEquals(maxActive <= 4, true, 'the pool must respect its cap');
});

Deno.test('results come back in input order', async () => {
  const results = await runFeedPool(
    groupFeedsByProperty([feed('a', 'p1'), feed('b', 'p2'), feed('c', 'p3')]),
    3,
    async (f) => {
      // Make later feeds finish first to prove ordering is not completion order.
      await new Promise((r) => setTimeout(r, f.id === 'a' ? 15 : 1));
      return f.id;
    }
  );
  assertEquals(results, ['a', 'b', 'c']);
});

Deno.test('the pool never exceeds the group count', async () => {
  let maxActive = 0;
  let active = 0;
  const results = await runFeedPool(
    groupFeedsByProperty([feed('a', 'p1'), feed('b', 'p2')]),
    8,
    async (f) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 3));
      active--;
      return f.id;
    }
  );
  assertEquals(results.length, 2);
  assertEquals(maxActive <= 2, true);
});

Deno.test('shouldStop stops taking new work without dropping finished results', async () => {
  const seen: string[] = [];
  let stop = false;
  const results = await runFeedPool(
    groupFeedsByProperty([feed('a', 'p1'), feed('b', 'p2'), feed('c', 'p3')]),
    1,
    async (f) => {
      seen.push(f.id);
      if (f.id === 'a') stop = true;
      return f.id;
    },
    { shouldStop: () => stop }
  );
  assertEquals(seen, ['a']);
  assertEquals(results, ['a']);
});
