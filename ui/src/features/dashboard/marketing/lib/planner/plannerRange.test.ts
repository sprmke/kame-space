import { describe, expect, it } from 'vitest';

import {
  PLANNER_RANGES,
  describeClaimLines,
  fromDatetimeLocal,
  toDatetimeLocal,
  RANGE_LABELS,
  formatDayHeading,
  formatItemTime,
  groupItemsByDay,
  isPlannerRange,
  normalizePlannerRange,
  resolveRangeWindow,
} from '@/features/dashboard/marketing/lib/planner/plannerRange';

describe('plannerRange', () => {
  it('labels every chip', () => {
    for (const range of PLANNER_RANGES) {
      expect(RANGE_LABELS[range].trim()).not.toBe('');
    }
  });

  it('rejects unknown ranges without throwing', () => {
    expect(isPlannerRange('14d')).toBe(false);
    expect(normalizePlannerRange('14d')).toBe('today');
    expect(normalizePlannerRange(null)).toBe('today');
    expect(normalizePlannerRange('7d')).toBe('7d');
  });

  it('resolves an inclusive window per chip', () => {
    expect(resolveRangeWindow('today', '2026-11-09')).toEqual({
      from: '2026-11-09',
      to: '2026-11-09',
    });
    expect(resolveRangeWindow('3d', '2026-11-09')).toEqual({
      from: '2026-11-09',
      to: '2026-11-11',
    });
    expect(resolveRangeWindow('7d', '2026-11-09')).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    });
  });

  it('groups items by day in order, unscheduled last', () => {
    const groups = groupItemsByDay([
      { id: 'b', scheduledFor: '2026-11-10T19:00:00+08:00' },
      { id: 'a', scheduledFor: '2026-11-09T09:00:00+08:00' },
      { id: 'c', scheduledFor: null },
    ]);
    expect(groups.map((group) => group.day)).toEqual(['2026-11-09', '2026-11-10', 'unscheduled']);
    expect(groups[2].items[0].id).toBe('c');
  });

  it('uses Today and Tomorrow headings', () => {
    expect(formatDayHeading('2026-11-09', '2026-11-09')).toBe('Today');
    expect(formatDayHeading('2026-11-10', '2026-11-09')).toBe('Tomorrow');
    expect(formatDayHeading('unscheduled', '2026-11-09')).toBe('Anytime');
    expect(formatDayHeading('2026-11-13', '2026-11-09')).toContain('Fri');
  });

  it('formats times from the Manila offset without a timezone shift', () => {
    expect(formatItemTime('2026-11-09T09:00:00+08:00')).toBe('9:00 AM');
    expect(formatItemTime('2026-11-09T19:30:00+08:00')).toBe('7:30 PM');
    expect(formatItemTime('2026-11-09T00:15:00+08:00')).toBe('12:15 AM');
    expect(formatItemTime(null)).toBeNull();
  });
});

describe('datetime-local round trip', () => {
  it('reads the Manila clock out of a stored timestamp', () => {
    expect(toDatetimeLocal('2026-11-09T09:00:00+08:00')).toBe('2026-11-09T09:00');
    expect(toDatetimeLocal('2026-11-09T19:30:00+08:00')).toBe('2026-11-09T19:30');
    expect(toDatetimeLocal(null)).toBe('');
  });

  it('writes back the stored shape, or null for a half-filled value', () => {
    expect(fromDatetimeLocal('2026-11-09T19:00')).toBe('2026-11-09T19:00:00+08:00');
    expect(fromDatetimeLocal('')).toBeNull();
    expect(fromDatetimeLocal('2026-11-09')).toBeNull();
  });
});

describe('describeClaimLines', () => {
  it('renders only the claims the item carries', () => {
    expect(describeClaimLines({})).toEqual([]);
    expect(
      describeClaimLines({
        openNights: ['2026-11-13', '2026-11-14'],
        rateFrom: 3200,
        rating: { avg: 4.9, count: 38 },
      })
    ).toEqual([
      'Open: 2026-11-13, 2026-11-14',
      'From 3200 a night',
      '4.9 from 38 reviews',
    ]);
    expect(describeClaimLines({ nightsLeftInMonth: 3 })).toEqual(['3 dates left this month']);
  });
});
