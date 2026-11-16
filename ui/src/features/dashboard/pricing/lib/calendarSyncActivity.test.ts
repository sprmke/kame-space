import { describe, expect, it } from 'vitest';

import {
  buildCalendarSyncActivityRows,
  isHostFacingCalendarSyncEvent,
} from '@/features/dashboard/pricing/lib/calendarSyncActivity';
import type { CalendarSyncEvent } from '@/features/dashboard/pricing/lib/calendarSyncApi';

function event(
  partial: Partial<CalendarSyncEvent> & Pick<CalendarSyncEvent, 'id' | 'action'>
): CalendarSyncEvent {
  return {
    feed_id: 'feed-1',
    external_uid: null,
    start_date: null,
    end_date: null,
    summary: null,
    detail: null,
    created_at: '2026-11-16T03:00:00.000Z',
    ...partial,
  };
}

describe('isHostFacingCalendarSyncEvent', () => {
  it('hides rate-limit and no-op skips', () => {
    expect(
      isHostFacingCalendarSyncEvent(
        event({ id: 1, action: 'skipped', detail: { reason: 'min_interval_or_locked' } })
      )
    ).toBe(false);
    expect(
      isHostFacingCalendarSyncEvent(
        event({ id: 4, action: 'skipped', detail: { reason: 'no change' } })
      )
    ).toBe(false);
  });

  it('keeps meaningful skips and imports', () => {
    expect(
      isHostFacingCalendarSyncEvent(
        event({ id: 2, action: 'skipped', detail: { reason: 'past_stay' } })
      )
    ).toBe(true);
    expect(isHostFacingCalendarSyncEvent(event({ id: 3, action: 'block_created' }))).toBe(true);
  });
});

describe('buildCalendarSyncActivityRows', () => {
  it('humanizes titles and formats stay ranges', () => {
    const rows = buildCalendarSyncActivityRows(
      [
        event({
          id: 10,
          action: 'block_created',
          start_date: '2027-11-11',
          end_date: '2027-11-16',
        }),
        event({
          id: 11,
          action: 'skipped',
          detail: { reason: 'min_interval_or_locked' },
        }),
        event({
          id: 12,
          action: 'conflict_detected',
          start_date: '2027-12-01',
          end_date: '2027-12-03',
        }),
      ],
      () => 'an hour ago'
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.title).toBe('Busy dates imported');
    expect(rows[0]?.rangeLabel).toMatch(/Nov/);
    expect(rows[1]?.title).toBe('Date conflict');
    expect(rows[1]?.tone).toBe('danger');
  });

  it('maps skip reasons to plain labels', () => {
    const rows = buildCalendarSyncActivityRows(
      [
        event({ id: 1, action: 'skipped', detail: { reason: 'past_stay' } }),
        event({ id: 2, action: 'skipped', detail: { reason: 'empty_feed_pull_1' } }),
        event({ id: 3, action: 'skipped', detail: { reason: 'reschedule_after_review' } }),
      ],
      () => '2 hours ago',
      8
    );
    expect(rows.map((r) => r.title)).toEqual([
      'Past stay ignored',
      'Empty calendar check',
      'Airbnb dates changed after review',
    ]);
  });
});
