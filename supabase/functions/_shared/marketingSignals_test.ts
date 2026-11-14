import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { addDaysYmd } from './calendarAvailabilityManila.ts';
import { buildOpportunities, type PlannerSignalsInput } from './marketingSignals.ts';

const TODAY = '2026-11-09';
const HORIZON_END = '2026-11-30';

function input(overrides: Partial<PlannerSignalsInput> = {}): PlannerSignalsInput {
  return {
    today: TODAY,
    horizonEnd: HORIZON_END,
    blockedNights: new Set<string>(),
    forwardOccupancyState: 'building',
    medianLeadDays: null,
    gapNights: [],
    events: [],
    reviews: [],
    liveRateFrom: null,
    referenceRateFrom: null,
    nightlyValue: 3000,
    goals: ['fill_open_nights'],
    channels: ['facebook_page'],
    lastFeedPostOn: addDaysYmd(TODAY, -1),
    lastReelOn: addDaysYmd(TODAY, -2),
    minStayNights: 1,
    usedOpportunityKeys: new Set<string>(),
    usedReviewIds: new Set<string>(),
    usedAmenities: new Set<string>(),
    amenities: [],
    topReviewTags: [],
    partySizePeak: null,
    photoCount: 0,
    unusedPhotoCount: 0,
    otaShareTop: null,
    monthsFullyBooked: [],
    reviewAvg: null,
    reviewCount: null,
    ...overrides,
  };
}

function types(result: ReturnType<typeof buildOpportunities>): string[] {
  return result.map((item) => item.type);
}

Deno.test('signals: an open calendar produces tonight and the next weekend', () => {
  const result = buildOpportunities(input());
  assert(types(result).includes('tonight_tomorrow'));
  assert(types(result).includes('weekend_open'));
  const weekend = result.find((item) => item.type === 'weekend_open');
  assertEquals(weekend?.key, 'weekend_open:2026-11-13');
  assertEquals(weekend?.claims.openNights, ['2026-11-13', '2026-11-14']);
});

Deno.test('signals: nothing is promoted for a night that is already booked', () => {
  const blocked = new Set(['2026-11-09', '2026-11-13', '2026-11-14']);
  const result = buildOpportunities(input({ blockedNights: blocked }));
  for (const item of result) {
    for (const night of item.claims.openNights ?? []) {
      assertEquals(blocked.has(night), false, `${item.type} promoted blocked night ${night}`);
    }
  }
  assertEquals(
    result.some((item) => item.key === 'tonight_tomorrow:2026-11-09'),
    false
  );
  assertEquals(result.some((item) => item.key === 'weekend_open:2026-11-13'), false);
});

Deno.test('signals: a half-open weekend promotes only the open night', () => {
  const result = buildOpportunities(
    input({ blockedNights: new Set(['2026-11-14']) })
  );
  const weekend = result.find((item) => item.type === 'weekend_open');
  assertEquals(weekend?.claims.openNights, ['2026-11-13']);
  assert(weekend?.evidence.includes('Only'));
});

Deno.test('signals: consecutive gap nights merge into one two-night item', () => {
  const result = buildOpportunities(
    input({ gapNights: ['2026-11-17', '2026-11-18', '2026-11-25'] })
  );
  const gaps = result.filter((item) => item.type === 'gap_nights');
  assertEquals(gaps.length, 2);
  assertEquals(gaps[0].key, 'gap_nights:2026-11-17');
  assertEquals(gaps[0].claims.openNights, ['2026-11-17', '2026-11-18']);
  assertEquals(gaps[1].claims.openNights, ['2026-11-25']);
});

Deno.test('signals: a holiday with open nights becomes a long weekend', () => {
  const result = buildOpportunities(
    input({
      events: [
        {
          id: 'event-1',
          scope: 'platform',
          kind: 'regular_holiday',
          name: 'Bonifacio Day',
          startsOn: '2026-11-30',
          endsOn: '2026-11-30',
          weight: 1,
        },
      ],
    })
  );
  const holiday = result.find((item) => item.type === 'long_weekend');
  assertEquals(holiday?.key, 'long_weekend:event-1');
  assertEquals(holiday?.label, 'Bonifacio Day');
  assertEquals(holiday?.claims.openNights, ['2026-11-30']);
});

Deno.test('signals: a holiday with no open nights is skipped', () => {
  const result = buildOpportunities(
    input({
      blockedNights: new Set(['2026-11-30']),
      events: [
        {
          id: 'event-1',
          scope: 'platform',
          kind: 'regular_holiday',
          name: 'Bonifacio Day',
          startsOn: '2026-11-30',
          endsOn: '2026-11-30',
          weight: 1,
        },
      ],
    })
  );
  assertEquals(types(result).includes('long_weekend'), false);
});

Deno.test('signals: last slots only fires when five or fewer dates are left', () => {
  const mostlyBooked = new Set<string>();
  for (let day = 10; day <= 30; day += 1) mostlyBooked.add(`2026-11-${String(day).padStart(2, '0')}`);
  const result = buildOpportunities(
    input({ blockedNights: mostlyBooked, horizonEnd: '2026-11-30' })
  );
  const lastSlots = result.find((item) => item.type === 'last_slots_month');
  assertEquals(lastSlots?.claims.openNights, ['2026-11-09']);
  assertEquals(lastSlots?.claims.nightsLeftInMonth, 1);
});

Deno.test('signals: a fully booked month never advertises open dates', () => {
  const blocked = new Set<string>();
  for (let day = 9; day <= 30; day += 1) blocked.add(`2026-11-${String(day).padStart(2, '0')}`);
  const result = buildOpportunities(input({ blockedNights: blocked }));
  for (const item of result) {
    assertEquals((item.claims.openNights ?? []).length, 0);
  }
});

Deno.test('signals: a used opportunity key is never re-planned', () => {
  const result = buildOpportunities(
    input({ usedOpportunityKeys: new Set(['tonight_tomorrow:2026-11-09']) })
  );
  assertEquals(types(result).includes('tonight_tomorrow') ? result.some((i) => i.key === 'tonight_tomorrow:2026-11-09') : false, false);
});

Deno.test('signals: lead time moves the weekend post-by earlier, never before today', () => {
  const shortLead = buildOpportunities(input({ medianLeadDays: 2 })).find(
    (item) => item.type === 'weekend_open'
  );
  assertEquals(shortLead?.postBy, '2026-11-11');
  const longLead = buildOpportunities(input({ medianLeadDays: 30 })).find(
    (item) => item.type === 'weekend_open'
  );
  assertEquals(longLead?.postBy, TODAY);
});

Deno.test('signals: a recent four star review becomes an item, an older one does not', () => {
  const recent = buildOpportunities(
    input({ reviews: [{ id: 'r1', rating: 5, createdAt: '2026-11-08' }] })
  );
  assert(types(recent).includes('new_review'));
  const old = buildOpportunities(
    input({ reviews: [{ id: 'r2', rating: 5, createdAt: '2026-10-01' }] })
  );
  assertEquals(types(old).includes('new_review'), false);
  const low = buildOpportunities(
    input({ reviews: [{ id: 'r3', rating: 3, createdAt: '2026-11-08' }] })
  );
  assertEquals(types(low).includes('new_review'), false);
});

Deno.test('signals: rating milestone fires every tenth review at 4.8 or better', () => {
  const result = buildOpportunities(input({ reviewAvg: 4.9, reviewCount: 30 }));
  const milestone = result.find((item) => item.type === 'rating_milestone');
  assertEquals(milestone?.claims.rating, { avg: 4.9, count: 30 });
  assertEquals(
    types(buildOpportunities(input({ reviewAvg: 4.7, reviewCount: 30 }))).includes(
      'rating_milestone'
    ),
    false
  );
});

Deno.test('signals: a live rate drop is promoted, a small change is not', () => {
  const dropped = buildOpportunities(
    input({ liveRateFrom: 2800, referenceRateFrom: 3600 })
  );
  const item = dropped.find((entry) => entry.type === 'rate_live_drop');
  assertEquals(item?.claims.rateFrom, 2800);
  assertEquals(
    types(buildOpportunities(input({ liveRateFrom: 3500, referenceRateFrom: 3600 }))).includes(
      'rate_live_drop'
    ),
    false
  );
});

Deno.test('signals: cadence gap fires only when posting has stalled', () => {
  assertEquals(types(buildOpportunities(input())).includes('cadence_gap'), false);
  assert(
    types(buildOpportunities(input({ lastFeedPostOn: '2026-10-20', lastReelOn: '2026-10-20' })))
      .includes('cadence_gap')
  );
});

Deno.test('signals: results are ranked by score, highest first', () => {
  const result = buildOpportunities(input());
  for (let index = 1; index < result.length; index += 1) {
    assert(result[index - 1].score >= result[index].score);
  }
});
