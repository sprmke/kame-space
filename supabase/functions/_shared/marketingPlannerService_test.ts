// The planner service imports DatabaseService, which builds a Supabase client at module load.
// Set a local placeholder first, exactly like the handler tests do.
import '../tests/_localSupabaseEnv.ts';

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildPlanSummary,
  isPlannerRange,
  manilaMinuteOfDay,
  resolvePlannerRange,
} from './marketingPlanner.ts';
import { parseChannelSettings, resolveNightlyRate } from './marketingSignalsData.ts';
import type { PropertyPricingDto } from './propertyPricing.ts';
import type { PlannerOpportunity } from './marketingSignals.ts';

function opportunity(overrides: Partial<PlannerOpportunity> = {}): PlannerOpportunity {
  return {
    type: 'weekend_open',
    key: 'weekend_open:2026-11-13',
    pillar: 'offers',
    targetFrom: '2026-11-13',
    targetTo: '2026-11-15',
    postBy: '2026-11-11',
    nightsAtStake: 6000,
    claims: { openNights: ['2026-11-13', '2026-11-14'] },
    evidence: 'Both nights that weekend are open.',
    formats: ['reel'],
    score: 0.9,
    ...overrides,
  };
}

Deno.test('planner ranges: the server accepts all five windows, nothing else', () => {
  for (const range of ['today', '3d', '5d', '7d', '14d']) {
    assertEquals(isPlannerRange(range), true, range);
  }
  assertEquals(isPlannerRange('30d'), false);
  assertEquals(isPlannerRange(null), false);
  assertEquals(isPlannerRange(7), false);
});

Deno.test('resolvePlannerRange: inclusive Manila windows per chip', () => {
  assertEquals(resolvePlannerRange('today', '2026-11-09'), {
    from: '2026-11-09',
    to: '2026-11-09',
  });
  assertEquals(resolvePlannerRange('3d', '2026-11-09'), {
    from: '2026-11-09',
    to: '2026-11-11',
  });
  assertEquals(resolvePlannerRange('7d', '2026-11-09'), {
    from: '2026-11-09',
    to: '2026-11-15',
  });
  assertEquals(resolvePlannerRange('14d', '2026-11-09').to, '2026-11-22');
});

Deno.test('buildPlanSummary: names the top reason and the horizon', () => {
  const summary = buildPlanSummary([opportunity(), opportunity({ key: 'b' })], '2026-12-09');
  assert(summary.startsWith('Both nights that weekend are open.'));
  assert(summary.includes('1 more items planned.'));
  assert(summary.includes('2026-12-09'));
});

Deno.test('buildPlanSummary: an empty plan says so, without inventing work', () => {
  assertEquals(
    buildPlanSummary([], '2026-12-09'),
    'No marketing items this week. Your calendar is covered.'
  );
});

Deno.test('manilaMinuteOfDay: reads the Manila clock, not UTC', () => {
  // 00:00 UTC = 08:00 Manila
  assertEquals(manilaMinuteOfDay(new Date('2026-11-09T00:00:00.000Z')), 8 * 60);
  // 16:30 UTC = 00:30 Manila the next day
  assertEquals(manilaMinuteOfDay(new Date('2026-11-09T16:30:00.000Z')), 30);
});

Deno.test('parseChannelSettings: keeps recognised channels and drops junk', () => {
  const parsed = parseChannelSettings([
    { kind: 'facebook_page', connectionId: 'conn-1' },
    { kind: 'instagram' },
    { kind: 'facebook_group', label: 'Tagaytay Rentals' },
    { kind: 'myspace', label: 'nope' },
    'not-an-object',
    { kind: 'tiktok' },
  ]);
  assertEquals(parsed, [
    { kind: 'facebook_page', connectionId: 'conn-1' },
    { kind: 'facebook_group', label: 'Tagaytay Rentals', url: undefined },
    { kind: 'tiktok', label: 'tiktok', url: undefined },
  ]);
});

Deno.test('parseChannelSettings: caps at twenty entries and survives a non-array', () => {
  const many = Array.from({ length: 30 }, (_, index) => ({
    kind: 'other',
    label: `place-${index}`,
  }));
  assertEquals(parseChannelSettings(many).length, 20);
  assertEquals(parseChannelSettings(null), []);
  assertEquals(parseChannelSettings('nope'), []);
});

function pricing(overrides: Partial<PropertyPricingDto> = {}): PropertyPricingDto {
  return {
    weekdayNightlyRate: 3000,
    weekendNightlyRate: 3500,
    downPayment: 0,
    securityDeposit: 0,
    petFee: 0,
    parkingRateGuest: 0,
    guestAdditionalFee: 0,
    dateOverrides: {},
    bookedDateKeys: [],
    blockedDateKeys: [],
    importedBlockedDateKeys: [],
    holidayRules: [],
    calendarBookings: [],
    smartRecommendations: {},
    smartPricingEnabled: false,
    ...overrides,
  };
}

Deno.test('resolveNightlyRate: override beats smart pricing beats the default', () => {
  const base = pricing({ dateOverrides: { '2026-11-13': 4200 }, smartRecommendations: { '2026-11-14': 3900 } });
  assertEquals(resolveNightlyRate(base, '2026-11-13'), 4200);
  assertEquals(resolveNightlyRate(base, '2026-11-14'), 3900);
  // 2026-11-15 is a Sunday, so the weekend rate applies.
  assertEquals(resolveNightlyRate(base, '2026-11-15'), 3500);
  // 2026-11-16 is a Monday.
  assertEquals(resolveNightlyRate(base, '2026-11-16'), 3000);
});

Deno.test('resolveNightlyRate: a zero or missing rate is null, never zero', () => {
  const empty = pricing({ weekdayNightlyRate: 0, weekendNightlyRate: 0, dateOverrides: { '2026-11-13': 0 } });
  assertEquals(resolveNightlyRate(empty, '2026-11-13'), null);
  assertEquals(resolveNightlyRate(empty, '2026-11-16'), null);
});
