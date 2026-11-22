import { describe, expect, it } from 'vitest';

import {
  channelLabel,
  countPlanProgress,
  formatLabel,
  isManualChannel,
  isOpenStatus,
  planItemHostPhase,
  planItemStatusView,
} from '@/features/dashboard/marketing/lib/planner/planItemStatus';

describe('planItemStatusView', () => {
  it('gives every status a label and a tone', () => {
    const statuses = [
      'suggested',
      'planned',
      'preparing',
      'ready',
      'scheduled',
      'publishing',
      'published',
      'posted_manually',
      'held',
      'stale',
      'skipped',
      'expired',
      'failed',
    ];
    for (const status of statuses) {
      const view = planItemStatusView(status);
      expect(view.label.trim()).not.toBe('');
      expect(['neutral', 'positive', 'warning', 'danger']).toContain(view.tone);
      expect(view.phase).toBeTruthy();
    }
  });

  it('never ships an em dash in status copy', () => {
    for (const status of ['suggested', 'ready', 'held', 'stale', 'failed']) {
      expect(planItemStatusView(status).label).not.toContain('\u2014');
    }
  });

  it('asks for an update when a claim went stale', () => {
    const view = planItemStatusView('stale');
    expect(view.action).toBe('fix');
    expect(view.actionLabel).toBe('Update');
    expect(view.tone).toBe('warning');
    expect(view.label).toBe('Needs update');
  });

  it('uses Make this for to-do items', () => {
    expect(planItemStatusView('planned').actionLabel).toBe('Make this');
    expect(planItemStatusView('planned').label).toBe('To do');
  });

  it('collapses published and posted to Done', () => {
    expect(planItemStatusView('published').label).toBe('Done');
    expect(planItemStatusView('posted_manually').label).toBe('Done');
    expect(planItemStatusView('published').action).toBe('none');
  });

  it('keeps finished items quiet', () => {
    expect(planItemStatusView('published').action).toBe('none');
    expect(planItemStatusView('posted_manually').action).toBe('none');
  });

  it('falls back to a to-do view for an unknown status', () => {
    expect(planItemStatusView('something_new').action).toBe('create');
    expect(planItemStatusView('something_new').actionLabel).toBe('Make this');
  });
});

describe('planItemHostPhase', () => {
  it('maps API statuses into a short host lifecycle', () => {
    expect(planItemHostPhase('planned')).toBe('todo');
    expect(planItemHostPhase('preparing')).toBe('doing');
    expect(planItemHostPhase('published')).toBe('done');
    expect(planItemHostPhase('stale')).toBe('blocked');
    expect(planItemHostPhase('expired')).toBe('missed');
  });
});

describe('countPlanProgress', () => {
  it('counts done vs open and ignores skipped', () => {
    expect(
      countPlanProgress([
        { status: 'planned' },
        { status: 'published' },
        { status: 'skipped' },
        { status: 'posted_manually' },
      ])
    ).toEqual({ done: 2, open: 1, total: 3 });
  });
});

describe('isOpenStatus', () => {
  it('treats finished states as closed', () => {
    expect(isOpenStatus('planned')).toBe(true);
    expect(isOpenStatus('stale')).toBe(true);
    expect(isOpenStatus('published')).toBe(false);
    expect(isOpenStatus('posted_manually')).toBe(false);
    expect(isOpenStatus('skipped')).toBe(false);
  });
});

describe('labels', () => {
  it('names formats and channels in host words', () => {
    expect(formatLabel('carousel')).toBe('Carousel');
    expect(formatLabel('nope')).toBe('Post');
    expect(channelLabel('facebook_page')).toBe('Facebook');
    expect(channelLabel('nope')).toBe('Another channel');
  });

  it('knows which channels cannot be published to', () => {
    expect(isManualChannel('facebook_page')).toBe(false);
    expect(isManualChannel('instagram')).toBe(false);
    expect(isManualChannel('facebook_group')).toBe(true);
    expect(isManualChannel('tiktok')).toBe(true);
  });
});
