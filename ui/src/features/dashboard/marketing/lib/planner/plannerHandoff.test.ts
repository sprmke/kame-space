import { describe, expect, it } from 'vitest';

import {
  applyPlannerSeedToDesignBinding,
  handoffDescription,
  resolveHandoffTarget,
  setPendingPlannerDraft,
  takePendingPlannerDraft,
} from '@/features/dashboard/marketing/lib/planner/plannerHandoff';

describe('resolveHandoffTarget', () => {
  it('opens the calendar builder for an availability calendar', () => {
    expect(resolveHandoffTarget('calendar', 'last_slots_month')).toEqual({ tab: 'calendar' });
  });

  it('opens the video editor for a reel', () => {
    expect(resolveHandoffTarget('reel', 'weekend_open')).toEqual({ tab: 'video' });
  });

  it('opens Posts for a designed post, story or carousel', () => {
    expect(resolveHandoffTarget('post', 'weekend_open')).toEqual({ tab: 'design' });
    expect(resolveHandoffTarget('story', 'tonight_tomorrow')).toEqual({ tab: 'design' });
    expect(resolveHandoffTarget('carousel', 'new_review')).toEqual({ tab: 'design' });
  });

  it('opens AI Studio for types that read better as a generated image', () => {
    expect(resolveHandoffTarget('post', 'amenity_spotlight')).toEqual({
      tab: 'generate',
      output: 'post',
    });
    expect(resolveHandoffTarget('carousel', 'content_refresh')).toEqual({
      tab: 'generate',
      output: 'post',
    });
  });

  it('falls back to Posts for an unknown format', () => {
    expect(resolveHandoffTarget('mystery', null)).toEqual({ tab: 'design' });
  });
});

describe('pending planner draft', () => {
  it('is consumed once', () => {
    const payload = {
      itemId: 'item-1',
      title: 'Open this weekend',
      hook: 'Two nights left',
      message: 'Open in November.',
      cta: 'Book now',
      dates: ['2026-11-13'],
      trackedUrl: '/properties/demo-stay?utm_campaign=ks-abcd2345',
      photoIds: [],
    };
    setPendingPlannerDraft(payload);
    expect(takePendingPlannerDraft()).toEqual(payload);
    expect(takePendingPlannerDraft()).toBeNull();
  });
});

describe('handoffDescription', () => {
  it('joins the copy that exists, without stray spacing', () => {
    expect(
      handoffDescription({
        itemId: 'i',
        title: 't',
        hook: 'Two nights left',
        message: '',
        cta: 'Book now',
        dates: [],
        trackedUrl: null,
        photoIds: [],
      })
    ).toBe('Two nights left Book now');
  });
});

describe('applyPlannerSeedToDesignBinding', () => {
  const binding = {
    propertyName: 'Demo Stay',
    propertyPhoto: null,
    nightlyRate: '₱2,799 / night',
    availabilityText: 'Open all month',
    monthLabel: 'November 2026',
    monthShort: 'November',
    openSlots: [],
  };
  const seed = {
    itemId: 'i',
    title: 'Open this weekend',
    hook: 'Two nights left',
    message: 'Nov 13 and Nov 14 are open.',
    cta: 'Book now',
    dates: ['2026-11-13', '2026-11-14'],
    trackedUrl: null,
    photoIds: [],
    rateFrom: 3200,
  };

  it('takes the dates, month and rate from the plan', () => {
    const merged = applyPlannerSeedToDesignBinding(binding, seed);
    expect(merged.availabilityText).toBe('2 nights available');
    expect(merged.monthLabel).toBe('November 2026');
    expect(merged.monthShort).toBe('November');
    expect(merged.nightlyRate).toBe('₱3,200 / night');
    expect(merged.openSlots).toEqual([
      { dateNum: '13', dayName: 'FRIDAY' },
      { dateNum: '14', dayName: 'SATURDAY' },
    ]);
  });

  it('keeps the property facts and the photo', () => {
    const merged = applyPlannerSeedToDesignBinding(
      { ...binding, propertyPhoto: 'https://example.test/a.jpg' },
      seed
    );
    expect(merged.propertyName).toBe('Demo Stay');
    expect(merged.propertyPhoto).toBe('https://example.test/a.jpg');
  });

  it('leaves the binding alone without a seed or without dates', () => {
    expect(applyPlannerSeedToDesignBinding(binding, null)).toBe(binding);
    expect(applyPlannerSeedToDesignBinding(binding, { ...seed, dates: [] })).toBe(binding);
  });

  it('says one night for a single-date item', () => {
    expect(
      applyPlannerSeedToDesignBinding(binding, { ...seed, dates: ['2026-12-24'], rateFrom: null })
        .availabilityText
    ).toBe('1 night available');
  });
});
