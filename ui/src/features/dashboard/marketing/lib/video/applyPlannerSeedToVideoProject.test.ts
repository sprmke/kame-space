import { describe, expect, it } from 'vitest';

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  applyPlannerSeedToVideoProject,
  trimVideoField,
} from '@/features/dashboard/marketing/lib/video/applyPlannerSeedToVideoProject';
import { buildDefaultVideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';
import type { PlannerHandoffPayload } from '@/features/dashboard/marketing/lib/planner/plannerHandoff';

const binding: DesignBinding = {
  propertyName: 'Demo Stay',
  propertyPhoto: null,
  propertyMedia: [],
  nightlyRate: '₱2,799 / night',
  availabilityText: 'Open all month',
  monthLabel: 'November 2026',
  monthShort: 'November',
  openSlots: [],
};

const seed: PlannerHandoffPayload = {
  itemId: 'item-1',
  title: 'Open this weekend',
  hook: 'Two nights left this weekend',
  message: 'Nov 13 and Nov 14 are still open.',
  cta: 'Book the weekend',
  dates: ['2026-11-13', '2026-11-14'],
  trackedUrl: null,
  photoIds: [],
  rateFrom: 3200,
};

function project() {
  return buildDefaultVideoProject('one-left', 'slots', binding, 'instagram-story');
}

describe('trimVideoField', () => {
  it('collapses whitespace and keeps short copy intact', () => {
    expect(trimVideoField('  Two   nights left  ', 60)).toBe('Two nights left');
  });

  it('truncates with an ellipsis at the cap', () => {
    const trimmed = trimVideoField('x'.repeat(80), 10);
    expect(trimmed.length).toBe(10);
    expect(trimmed.endsWith('…')).toBe(true);
  });
});

describe('applyPlannerSeedToVideoProject', () => {
  it('puts the planner hook, caption and call to action on the first scene', () => {
    const scene = applyPlannerSeedToVideoProject(project(), seed, binding).scenes[0]!;
    const text = Object.values(scene.texts).filter(Boolean).join(' ');
    expect(text).toContain('Two nights left this weekend');
  });

  it('keeps the scene and layer counts untouched', () => {
    const before = project();
    const after = applyPlannerSeedToVideoProject(before, seed, binding);
    expect(after.scenes.length).toBe(before.scenes.length);
    expect(after.scenes[0]?.layers?.length).toBe(before.scenes[0]?.layers?.length);
  });

  it('falls back to template copy when the planner carries no copy', () => {
    const blank = { ...seed, hook: '', message: '', cta: '' };
    const before = project();
    const after = applyPlannerSeedToVideoProject(before, blank, binding);
    expect(after.scenes[0]?.texts).toEqual(before.scenes[0]?.texts);
  });

  it('never overflows a beat with long copy', () => {
    const long = { ...seed, hook: 'h'.repeat(200), message: 'm'.repeat(200), cta: 'c'.repeat(80) };
    const after = applyPlannerSeedToVideoProject(project(), long, binding);
    const values = Object.values(after.scenes[0]!.texts).filter(
      (value): value is string => typeof value === 'string'
    );
    for (const value of values) expect(value.length).toBeLessThanOrEqual(120);
  });
});
