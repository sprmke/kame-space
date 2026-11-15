import { assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  BOOKING_COM_CLOSED_DATES_MATCH_THRESHOLD,
  channelProvesReservation,
  classifyExportEcho,
  countExactServedMatches,
  isClosedDatesEchoPull,
  isFullyCovered,
} from './calendarEchoRules.ts';

Deno.test('an exact served range is covered', () => {
  assertEquals(
    isFullyCovered({ start: '2026-12-01', end: '2026-12-04' }, [
      { start: '2026-12-01', end: '2026-12-04' },
    ]),
    true
  );
});

Deno.test('a union of two served ranges covers a stay that spans them', () => {
  assertEquals(
    isFullyCovered({ start: '2026-12-02', end: '2026-12-05' }, [
      { start: '2026-12-01', end: '2026-12-04' },
      { start: '2026-12-04', end: '2026-12-06' },
    ]),
    true
  );
});

Deno.test('partial overlap is not coverage', () => {
  assertFalse(
    isFullyCovered({ start: '2026-12-01', end: '2026-12-06' }, [
      { start: '2026-12-01', end: '2026-12-04' },
    ])
  );
});

Deno.test('a gap between served ranges breaks coverage', () => {
  assertFalse(
    isFullyCovered({ start: '2026-12-01', end: '2026-12-08' }, [
      { start: '2026-12-01', end: '2026-12-03' },
      { start: '2026-12-05', end: '2026-12-08' },
    ])
  );
});

Deno.test('an empty or inverted range is never covered', () => {
  assertFalse(
    isFullyCovered({ start: '2026-12-04', end: '2026-12-04' }, [
      { start: '2026-12-01', end: '2026-12-06' },
    ])
  );
  assertFalse(isFullyCovered({ start: '', end: '' }, [{ start: '2026-12-01', end: '2026-12-06' }]));
});

Deno.test('Airbnb reservations are proof and never echo', () => {
  assertEquals(channelProvesReservation('airbnb', { kind: 'reservation' }), true);
  assertEquals(channelProvesReservation('airbnb', { kind: 'block' }), false);
  assertEquals(channelProvesReservation('booking_com', { kind: 'reservation' }), false);

  const decision = classifyExportEcho(
    'airbnb',
    { startDate: '2026-12-01', endDate: '2026-12-04', kind: 'reservation' },
    [{ start: '2026-12-01', end: '2026-12-04' }]
  );
  assertEquals(decision.isEcho, false);
  assertEquals(decision.reason, 'reservation_proof');
});

Deno.test('Airbnb block inside served nights is an echo, but still a block', () => {
  const decision = classifyExportEcho(
    'airbnb',
    { startDate: '2026-12-01', endDate: '2026-12-04', kind: 'block' },
    [{ start: '2026-12-01', end: '2026-12-04' }]
  );
  assertEquals(decision.isEcho, true);
  assertEquals(decision.reason, 'covered_by_served_ranges');
});

Deno.test('Booking.com has no proof, so a covered reservation is an echo', () => {
  const decision = classifyExportEcho(
    'booking_com',
    { startDate: '2026-12-01', endDate: '2026-12-04', kind: 'reservation' },
    [{ start: '2026-12-01', end: '2026-12-04' }]
  );
  assertEquals(decision.isEcho, true);
});

Deno.test('a Booking.com reservation outside served nights is not an echo', () => {
  const decision = classifyExportEcho(
    'booking_com',
    { startDate: '2027-01-10', endDate: '2027-01-12', kind: 'reservation' },
    [{ start: '2026-12-01', end: '2026-12-04' }]
  );
  assertFalse(decision.isEcho);
});

Deno.test('no served ranges means nothing is an echo', () => {
  assertFalse(
    classifyExportEcho(
      'booking_com',
      {
        startDate: '2026-12-01',
        endDate: '2026-12-04',
        kind: 'reservation',
      },
      []
    ).isEcho
  );
});

Deno.test('exact served matches count only exact ranges', () => {
  const served = [{ start: '2026-12-01', end: '2026-12-04' }];
  assertEquals(
    countExactServedMatches(
      [
        { startDate: '2026-12-01', endDate: '2026-12-04' },
        { startDate: '2026-12-01', endDate: '2026-12-05' },
      ],
      served
    ),
    1
  );
});

Deno.test('the closed-dates tell fires at the threshold, not below it', () => {
  const served = [
    { start: '2026-12-01', end: '2026-12-04' },
    { start: '2026-12-08', end: '2026-12-10' },
  ];
  const oneMatch = [{ startDate: '2026-12-01', endDate: '2026-12-04' }];
  const twoMatches = [...oneMatch, { startDate: '2026-12-08', endDate: '2026-12-10' }];
  assertEquals(BOOKING_COM_CLOSED_DATES_MATCH_THRESHOLD, 2);
  assertFalse(isClosedDatesEchoPull('booking_com', oneMatch, served));
  assertEquals(isClosedDatesEchoPull('booking_com', twoMatches, served), true);
});

Deno.test('the closed-dates tell never fires for Airbnb', () => {
  const served = [
    { start: '2026-12-01', end: '2026-12-04' },
    { start: '2026-12-08', end: '2026-12-10' },
  ];
  assertFalse(
    isClosedDatesEchoPull(
      'airbnb',
      [
        { startDate: '2026-12-01', endDate: '2026-12-04' },
        { startDate: '2026-12-08', endDate: '2026-12-10' },
      ],
      served
    )
  );
});
