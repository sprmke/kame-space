import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { isWithinQuietHours } from './marketingPlaybook.ts';
import { scheduleItems, type PlannerSettingsShape, type SchedulerInput } from './marketingScheduler.ts';
import type { PlannerOpportunity } from './marketingSignals.ts';

const TODAY = '2026-11-09';
const HORIZON_END = '2026-11-30';

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
    formats: ['reel', 'carousel', 'story'],
    score: 0.9,
    ...overrides,
  };
}

function settings(overrides: Partial<PlannerSettingsShape> = {}): PlannerSettingsShape {
  return {
    cadencePreset: 'steady',
    customCadence: null,
    goals: ['fill_open_nights'],
    channels: [{ kind: 'facebook_page', connectionId: 'conn-1' }],
    language: 'en',
    postingWindows: null,
    ...overrides,
  };
}

function input(overrides: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    today: TODAY,
    nowMinute: 8 * 60,
    horizonEnd: HORIZON_END,
    opportunities: [opportunity()],
    settings: settings(),
    existingOpportunityKeys: new Set<string>(),
    propertyName: 'Demo Stay',
    ...overrides,
  };
}

Deno.test('scheduler: every draft has a Manila timestamp and a real format', () => {
  const drafts = scheduleItems(input());
  assertEquals(drafts.length, 1);
  assert(drafts[0].scheduledFor.endsWith('+08:00'));
  assertEquals(drafts[0].format, 'reel');
  assertEquals(drafts[0].channelKind, 'facebook_page');
});

Deno.test('scheduler: nothing is ever placed inside quiet hours', () => {
  const drafts = scheduleItems(
    input({ opportunities: Array.from({ length: 12 }, (_, index) => opportunity({ key: `k${index}`, postBy: TODAY })) })
  );
  for (const draft of drafts) {
    const time = draft.scheduledFor.slice(11, 16);
    const [hours, minutes] = time.split(':').map(Number);
    assertEquals(isWithinQuietHours(hours * 60 + minutes), false, `quiet hour used: ${time}`);
  }
});

Deno.test('scheduler: today never schedules a slot that already passed', () => {
  const drafts = scheduleItems(
    input({
      nowMinute: 20 * 60,
      opportunities: [opportunity({ postBy: TODAY, formats: ['post'] })],
    })
  );
  const scheduled = drafts[0].scheduledFor;
  assert(scheduled.startsWith('2026-11-10'), `expected tomorrow, got ${scheduled}`);
});

Deno.test('scheduler: the per-day cap is respected', () => {
  const drafts = scheduleItems(
    input({
      opportunities: Array.from({ length: 8 }, (_, index) =>
        opportunity({ key: `k${index}`, postBy: TODAY, formats: ['story'] })
      ),
    })
  );
  const perDay = new Map<string, number>();
  for (const draft of drafts) {
    const day = draft.scheduledFor.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  for (const count of perDay.values()) {
    assert(count <= 3, `day over cap: ${count}`);
  }
});

Deno.test('scheduler: an existing opportunity key is never re-planned', () => {
  const drafts = scheduleItems(
    input({ existingOpportunityKeys: new Set(['weekend_open:2026-11-13']) })
  );
  assertEquals(drafts.length, 0);
});

Deno.test('scheduler: cadence caps how many items a run produces', () => {
  const drafts = scheduleItems(
    input({
      settings: settings({ cadencePreset: 'light' }),
      opportunities: Array.from({ length: 30 }, (_, index) =>
        opportunity({ key: `k${index}`, postBy: TODAY, formats: ['story'] })
      ),
    })
  );
  // Light = 3 stories a week over a 22 day horizon, so well under 30.
  assert(drafts.length < 20, `light cadence planned ${drafts.length} items`);
  assertEquals(drafts.every((draft) => draft.format === 'story'), true);
});

Deno.test('scheduler: a property with no connected channel falls back to manual share', () => {
  const drafts = scheduleItems(
    input({
      settings: settings({
        channels: [
          { kind: 'facebook_group', label: 'Tagaytay Rentals' },
          { kind: 'tiktok', label: 'Staycations PH' },
        ],
      }),
    })
  );
  assertEquals(drafts[0].channelKind, 'facebook_group');
  assertEquals(drafts[0].manualTargets, ['Tagaytay Rentals']);
});

Deno.test('scheduler: a property with no channels at all still gets a manual item', () => {
  const drafts = scheduleItems(input({ settings: settings({ channels: [] }) }));
  assertEquals(drafts.length, 1);
  assertEquals(drafts[0].channelKind, 'facebook_group');
});

Deno.test('scheduler: items never spill past the horizon end', () => {
  const drafts = scheduleItems(
    input({
      horizonEnd: TODAY,
      nowMinute: 22 * 60,
      opportunities: [opportunity({ key: 'today-only', postBy: TODAY, formats: ['post'] })],
    })
  );
  assertEquals(drafts.length, 0);
});

Deno.test('scheduler: copy is filled from claims, never a raw placeholder', () => {
  const drafts = scheduleItems(input({ opportunities: [opportunity({ formats: ['carousel'] })] }));
  const draft = drafts[0];
  for (const value of [draft.title, draft.hook, draft.message, draft.cta]) {
    assert(!value.includes('{{'), `placeholder leaked: ${value}`);
  }
  assertEquals(draft.message.includes('Nov 13, Nov 14'), true);
});

Deno.test('scheduler: a Taglish plan uses Taglish copy', () => {
  const drafts = scheduleItems(
    input({ settings: settings({ language: 'taglish' }), opportunities: [opportunity({ formats: ['story'] })] })
  );
  assertEquals(drafts[0].title, 'Open this weekend');
  assertEquals(drafts[0].hook.includes('this weekend'), true);
});

Deno.test('scheduler: a learned hour wins over the default window', () => {
  const drafts = scheduleItems(
    input({
      opportunities: [opportunity({ postBy: TODAY, formats: ['post'] })],
      preferredHourByWeekday: { 1: 15 },
    })
  );
  assertEquals(drafts[0].scheduledFor, '2026-11-09T15:00:00+08:00');
});

Deno.test('scheduler: a learned hour inside quiet hours is ignored', () => {
  const drafts = scheduleItems(
    input({
      opportunities: [opportunity({ postBy: TODAY, formats: ['post'] })],
      preferredHourByWeekday: { 1: 2 },
    })
  );
  assertEquals(drafts[0].scheduledFor, '2026-11-09T19:00:00+08:00');
});

Deno.test('scheduler: a learned hour in the past today is ignored', () => {
  const drafts = scheduleItems(
    input({
      nowMinute: 20 * 60,
      opportunities: [opportunity({ postBy: TODAY, formats: ['post'] })],
      preferredHourByWeekday: { 1: 15 },
    })
  );
  assertEquals(drafts[0].scheduledFor.startsWith('2026-11-10'), true);
});
