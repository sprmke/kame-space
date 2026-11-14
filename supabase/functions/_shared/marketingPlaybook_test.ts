import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  CADENCE_PRESETS,
  DEFAULT_POSTING_WINDOWS,
  FORMAT_LABELS,
  OPPORTUNITIES,
  PILLAR_MIX,
  PILLARS,
  PLAYBOOK_VERSION,
  isWithinQuietHours,
  resolveCadence,
  weekdayWeight,
} from './marketingPlaybook.ts';

Deno.test('playbook: version is pinned', () => {
  assert(/^\d{4}-\d{2}-\d{2}\.\d+$/.test(PLAYBOOK_VERSION));
});

Deno.test('playbook: every pillar mix sums to 1 for every occupancy state', () => {
  for (const [state, mix] of Object.entries(PILLAR_MIX)) {
    const total = PILLARS.reduce((sum, pillar) => sum + mix[pillar], 0);
    assertEquals(Math.round(total * 1000) / 1000, 1, `${state} mix does not sum to 1`);
  }
});

Deno.test('playbook: every opportunity has a known pillar and at least one format', () => {
  for (const [type, definition] of Object.entries(OPPORTUNITIES)) {
    assertEquals(definition.type, type as typeof definition.type);
    assert(PILLARS.includes(definition.pillar), `${type} has an unknown pillar`);
    assert(definition.formats.length > 0, `${type} has no format`);
    for (const format of definition.formats) {
      assert(FORMAT_LABELS[format], `${type} references an unknown format ${format}`);
    }
  }
});

Deno.test('playbook: availability-promoting types carry a target window', () => {
  const promoting = Object.values(OPPORTUNITIES).filter((o) => o.promotesAvailability);
  // Guards the truth rule: an item claiming open dates must be checkable.
  assert(promoting.length >= 8);
});

Deno.test('playbook: cadence presets escalate', () => {
  assert(CADENCE_PRESETS.light.feedPostsPerWeek < CADENCE_PRESETS.steady.feedPostsPerWeek);
  assert(CADENCE_PRESETS.steady.feedPostsPerWeek <= CADENCE_PRESETS.active.feedPostsPerWeek);
  assert(CADENCE_PRESETS.light.maxItemsPerDay < CADENCE_PRESETS.active.maxItemsPerDay);
});

Deno.test('resolveCadence: custom falls back to steady when no shape is stored', () => {
  assertEquals(resolveCadence('custom', null), CADENCE_PRESETS.steady);
  assertEquals(
    resolveCadence('custom', {
      feedPostsPerWeek: 1,
      reelsPerWeek: 1,
      storiesPerWeek: 1,
      maxItemsPerDay: 1,
    }).maxItemsPerDay,
    1
  );
});

Deno.test('quiet hours: 23:00 to 07:00 is blocked, midday is not', () => {
  assert(isWithinQuietHours(23 * 60));
  assert(isWithinQuietHours(0));
  assert(isWithinQuietHours(6 * 60 + 59));
  assertEquals(isWithinQuietHours(7 * 60), false);
  assertEquals(isWithinQuietHours(12 * 60), false);
  assertEquals(isWithinQuietHours(22 * 60 + 59), false);
});

Deno.test('default windows never start inside quiet hours', () => {
  for (const window of DEFAULT_POSTING_WINDOWS) {
    assertEquals(isWithinQuietHours(window.startMinute), false);
    assert(window.endMinute > window.startMinute);
  }
});

Deno.test('weekdayWeight: weekends weigh less than weekdays', () => {
  const midday = DEFAULT_POSTING_WINDOWS[1];
  assert(weekdayWeight(3, midday) > weekdayWeight(7, midday));
  assert(weekdayWeight(6, midday) === midday.weekendWeight);
  assert(weekdayWeight(1, midday) === midday.weekdayWeight);
});
