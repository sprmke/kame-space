/**
 * Unit tests for the Marketing Trends safety denylist.
 * Run: deno test supabase/functions/_shared/marketingTrends/safetyDenylist_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { findUnsafeTerm, isDeterministicallyUnsafe } from './safetyDenylist.ts';

Deno.test('the fixtures from the live probe are blocked', () => {
  assert(isDeterministicallyUnsafe('bir data breach'));
  assert(isDeterministicallyUnsafe('lotto result today 9pm'));
  assert(isDeterministicallyUnsafe('stagflation'));
  assert(isDeterministicallyUnsafe('typhoon signal number'));
  assert(isDeterministicallyUnsafe('holdup in manila'));
});

Deno.test('Filipino terms are blocked', () => {
  assert(isDeterministicallyUnsafe('patay sa sagana'));
  assert(isDeterministicallyUnsafe('namatay na'));
  assert(isDeterministicallyUnsafe('bagyo signal'));
  assert(isDeterministicallyUnsafe('lindol sa manila'));
  assert(isDeterministicallyUnsafe('sunog sa bahay'));
  assert(isDeterministicallyUnsafe('aksidente'));
  assert(isDeterministicallyUnsafe('kulong'));
});

Deno.test('ordinary topics are not blocked', () => {
  assert(!isDeterministicallyUnsafe('pinoy big brother collab 3.0'));
  assert(!isDeterministicallyUnsafe('alexandra eala'));
  assert(!isDeterministicallyUnsafe('pba governors cup'));
  assert(!isDeterministicallyUnsafe('christmas long weekend'));
  assert(!isDeterministicallyUnsafe('nintendo switch update'));
});

Deno.test('a blocked word inside another word does not block', () => {
  assert(!isDeterministicallyUnsafe('award night'));
  assert(!isDeterministicallyUnsafe('huling biyahe'));
  assert(!isDeterministicallyUnsafe('presidents day'));
});

Deno.test('the matched term is reported', () => {
  assertEquals(findUnsafeTerm('bir data breach'), 'data breach');
  assertEquals(findUnsafeTerm('lotto result today 9pm'), 'lotto');
  assertEquals(findUnsafeTerm('a clean topic'), null);
});
