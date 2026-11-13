import { describe, expect, it } from 'vitest';

import { mapPlannerItem } from '@/features/dashboard/marketing/lib/planner/plannerApi';

const ROW = {
  id: 'item-1',
  short_code: 'abcd2345',
  opportunity_type: 'weekend_open',
  title: 'Open this weekend',
  pillar: 'offers',
  channel_kind: 'facebook_page',
  manual_targets: ['Tagaytay Rentals', 42],
  format: 'reel',
  scheduled_for: '2026-11-11T09:00:00+08:00',
  post_by: '2026-11-11T23:59:59+08:00',
  target_from: '2026-11-13',
  target_to: '2026-11-15',
  claims: { openNights: ['2026-11-13'], rateFrom: 3200 },
  brief: { hook: 'Two nights left', message: 'Nov 13 is open.', cta: 'Book', why: 'Open.' },
  status: 'planned',
  status_reason: null,
  tracked_url: '/properties/demo?utm_campaign=ks-abcd2345',
  posted_url: null,
  results: { trackedVisits: 12, views: 300, reach: 180, interactions: 24 },
};

describe('mapPlannerItem', () => {
  it('maps the row and keeps only string manual targets', () => {
    const item = mapPlannerItem(ROW);
    expect(item.id).toBe('item-1');
    expect(item.manualTargets).toEqual(['Tagaytay Rentals']);
    expect(item.claims.rateFrom).toBe(3200);
    expect(item.brief.hook).toBe('Two nights left');
  });

  it('reads tracked visits and the insight rollup', () => {
    const item = mapPlannerItem(ROW);
    expect(item.trackedVisits).toBe(12);
    expect(item.insights).toEqual({ views: 300, reach: 180, interactions: 24 });
  });

  it('returns null insights when the rollup has no platform metrics yet', () => {
    const item = mapPlannerItem({ ...ROW, results: { trackedVisits: 3 } });
    expect(item.trackedVisits).toBe(3);
    expect(item.insights).toBeNull();
  });

  it('defaults safely for a sparse row', () => {
    const item = mapPlannerItem({ id: 'x' });
    expect(item.format).toBe('post');
    expect(item.status).toBe('planned');
    expect(item.manualTargets).toEqual([]);
    expect(item.claims).toEqual({});
    expect(item.brief).toEqual({ photoUrls: [] });
    expect(item.trackedVisits).toBe(0);
    expect(item.insights).toBeNull();
  });

  it('normalizes selected photo urls and drops junk', () => {
    const item = mapPlannerItem({
      ...ROW,
      brief: { hook: 'x', photoUrls: ['https://cdn/a.jpg', 42, null] },
    });
    expect(item.brief.photoUrls).toEqual(['https://cdn/a.jpg']);
    expect(mapPlannerItem(ROW).brief.photoUrls).toEqual([]);
  });

  it('ignores a non-object results blob', () => {
    const item = mapPlannerItem({ ...ROW, results: 'nope' });
    expect(item.trackedVisits).toBe(0);
    expect(item.insights).toBeNull();
  });
});
