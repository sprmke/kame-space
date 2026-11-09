import { describe, expect, it } from 'vitest';

import {
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
    expect(resolveHandoffTarget('reel', 'weekend_open')).toEqual({ tab: 'video', output: 'clip' });
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
