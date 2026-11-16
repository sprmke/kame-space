import { applyLocalSupabaseTestEnv } from '../tests/_localSupabaseEnv.ts';

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { relayRangesFor, type ImportedReservationRow } from './calendarSyncRun.ts';

applyLocalSupabaseTestEnv();

function row(overrides: Partial<ImportedReservationRow>): ImportedReservationRow {
  return {
    id: 'row-1',
    feedId: 'feed-a',
    feedProvider: 'airbnb',
    externalUid: 'uid-1',
    startDate: '2026-12-01',
    endDate: '2026-12-04',
    lastSeenAt: new Date().toISOString(),
    feedIsActive: true,
    feedConsecutiveFailures: 0,
    ...overrides,
  };
}

Deno.test('an imported reservation is relayed to other channels, never back to its own', () => {
  const airbnbStay = row({});
  assertEquals(relayRangesFor([airbnbStay], 'airbnb', new Set()), []);
  const toAgoda = relayRangesFor([airbnbStay], 'agoda', new Set());
  assertEquals(toAgoda.length, 1);
  assertEquals(toAgoda[0].startDate, '2026-12-01');
  assertEquals(toAgoda[0].endDate, '2026-12-04');
  assertEquals(toAgoda[0].summary, 'Booked');
});

Deno.test('the all-channels link relays every imported reservation', () => {
  const ranges = relayRangesFor(
    [
      row({ feedId: 'feed-a', feedProvider: 'airbnb' }),
      row({ feedId: 'feed-b', feedProvider: 'booking_com', externalUid: 'uid-2' }),
    ],
    null,
    new Set()
  );
  assertEquals(ranges.length, 2);
});

Deno.test('a stay already carried by a live booking is not published twice', () => {
  const live = new Set(['feed-a|uid-1']);
  assertEquals(relayRangesFor([row({})], 'agoda', live), []);
});

Deno.test('a live booking key only suppresses its own feed and uid pair', () => {
  const live = new Set(['feed-a|uid-1']);
  const ranges = relayRangesFor([row({ feedId: 'feed-b', externalUid: 'uid-1' })], 'agoda', live);
  assertEquals(ranges.length, 1);
});

Deno.test('relay UIDs are opaque and never carry the source confirmation code', () => {
  const ranges = relayRangesFor([row({ externalUid: 'HMABCDEF/123+@x' })], 'agoda', new Set());
  assertEquals(ranges[0].uidLocalPart, 'gfm-relay-row-1');
  assertEquals(ranges[0].uidLocalPart.includes('HMABCDEF'), false);
});

Deno.test('a feed that stopped refreshing stops relaying', () => {
  const stale = new Date(Date.now() - 49 * 3_600_000).toISOString();
  assertEquals(relayRangesFor([row({ lastSeenAt: stale })], 'agoda', new Set()), []);
});

Deno.test('an inactive or failing feed does not relay', () => {
  assertEquals(relayRangesFor([row({ feedIsActive: false })], 'agoda', new Set()), []);
  assertEquals(relayRangesFor([row({ feedConsecutiveFailures: 4 })], 'agoda', new Set()), []);
});

Deno.test('a row with unreadable dates is skipped', () => {
  assertEquals(relayRangesFor([row({ startDate: '', endDate: '' })], 'agoda', new Set()), []);
  assertEquals(
    relayRangesFor([row({ startDate: '2026-12-04', endDate: '2026-12-01' })], 'agoda', new Set()),
    []
  );
});
