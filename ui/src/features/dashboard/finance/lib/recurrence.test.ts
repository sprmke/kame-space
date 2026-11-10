import { describe, expect, it } from 'vitest';

import {
  buildTelegramReminderSchedule,
  defaultRecurrenceUntil,
  isRecurrenceScheduleDirty,
  normalizeFinanceReminderInterval,
  recurrenceIntervalLabel,
  recurrenceScheduleUpdateFields,
  reminderIntervalLabel,
  suggestExtendAfter,
  suggestExtendBefore,
} from '@/features/dashboard/finance/lib/recurrence';

/*
 * Recurring finance rows decide when money is expected again. A wrong schedule silently
 * creates duplicate entries or stops a series a month early, so the boundaries matter.
 */

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

describe('recurrenceIntervalLabel', () => {
  it('has no label for a one-off row', () => {
    expect(recurrenceIntervalLabel('none')).toBeNull();
    expect(recurrenceIntervalLabel(null)).toBeNull();
    expect(recurrenceIntervalLabel(undefined)).toBeNull();
    expect(recurrenceIntervalLabel('')).toBeNull();
  });

  it('labels a known interval', () => {
    expect(recurrenceIntervalLabel('monthly')).toBeTruthy();
    expect(recurrenceIntervalLabel('weekly')).toBeTruthy();
  });

  it('passes an unknown value through instead of dropping it', () => {
    expect(recurrenceIntervalLabel('fortnightly')).toBe('fortnightly');
  });
});

describe('isRecurrenceScheduleDirty', () => {
  const base = {
    isRecurringEdit: true,
    recurrenceInterval: 'monthly' as const,
    recurrenceUntil: '2026-12-31',
    initialInterval: 'monthly' as const,
    initialUntil: '2026-12-31',
  };

  it('is never dirty when the booking is not a recurring edit', () => {
    expect(isRecurrenceScheduleDirty({ ...base, isRecurringEdit: false })).toBe(false);
  });

  it('is clean when the schedule is unchanged', () => {
    expect(isRecurrenceScheduleDirty(base)).toBe(false);
  });

  it('treats the same day with a different timestamp as unchanged', () => {
    expect(
      isRecurrenceScheduleDirty({
        ...base,
        recurrenceUntil: '2026-12-31T23:00:00.000Z',
        initialUntil: '2026-12-31',
      })
    ).toBe(false);
  });

  it('is dirty when the interval changes', () => {
    expect(isRecurrenceScheduleDirty({ ...base, recurrenceInterval: 'weekly' })).toBe(true);
  });

  it('is dirty when the end date changes', () => {
    expect(isRecurrenceScheduleDirty({ ...base, recurrenceUntil: '2027-01-31' })).toBe(true);
  });

  it('normalises a missing or none initial interval', () => {
    expect(isRecurrenceScheduleDirty({ ...base, initialInterval: null })).toBe(true);
    expect(
      isRecurrenceScheduleDirty({ ...base, recurrenceInterval: 'none', initialInterval: 'none' })
    ).toBe(false);
  });

  it('treats a cleared end date as a change', () => {
    expect(isRecurrenceScheduleDirty({ ...base, recurrenceUntil: undefined })).toBe(true);
  });
});

describe('defaultRecurrenceUntil', () => {
  it('suggests about 90 daily entries', () => {
    const until = defaultRecurrenceUntil('2026-01-01', 'daily');
    expect(daysBetween('2026-01-01', until)).toBe(89);
  });

  it('suggests about a year of weekly entries', () => {
    const until = defaultRecurrenceUntil('2026-01-01', 'weekly');
    expect(daysBetween('2026-01-01', until)).toBe(357);
  });

  it('suggests two years of monthly entries, clamped to day 28', () => {
    expect(defaultRecurrenceUntil('2026-01-31', 'monthly')).toBe('2028-01-28');
    expect(defaultRecurrenceUntil('2026-01-15', 'monthly')).toBe('2028-01-15');
  });

  it('treats twice-monthly, every-2-months and quarterly like monthly', () => {
    for (const interval of ['twice_monthly', 'every_2_months', 'quarterly'] as const) {
      expect(defaultRecurrenceUntil('2026-03-31', interval)).toBe('2028-03-28');
    }
  });

  it('suggests five years for a yearly series and clamps a leap day', () => {
    expect(defaultRecurrenceUntil('2026-06-15', 'yearly')).toBe('2031-06-15');
    expect(defaultRecurrenceUntil('2024-02-29', 'yearly')).toBe('2029-02-28');
  });
});

describe('suggestExtendBefore / suggestExtendAfter', () => {
  it('walks twelve monthly steps in each direction', () => {
    expect(suggestExtendBefore('2026-03-01', 'monthly')).toBe('2025-03-01');
    expect(suggestExtendAfter('2026-03-01', 'monthly')).toBe('2027-03-01');
  });

  it('walks twelve weekly steps', () => {
    expect(daysBetween(suggestExtendBefore('2026-06-01', 'weekly'), '2026-06-01')).toBe(84);
    expect(daysBetween('2026-06-01', suggestExtendAfter('2026-06-01', 'weekly'))).toBe(84);
  });

  it('keeps a mid-month day stable across a monthly extension', () => {
    expect(suggestExtendAfter('2026-03-15', 'monthly', '2026-01-15')).toBe('2027-03-15');
  });

  // Observed but not pinned: extending from a 31st drifts instead of clamping to the same
  // day each month (2026-03-31 with a 2026-01-31 series start lands on 2027-12-31). The
  // intended behaviour is unknown, so this test does not lock either reading in.
});


describe('normalizeFinanceReminderInterval', () => {
  it('keeps a supported interval, trimmed and lower-cased', () => {
    expect(normalizeFinanceReminderInterval('hourly')).toBe('hourly');
    expect(normalizeFinanceReminderInterval('  EVERY_4_HOURS ')).toBe('every_4_hours');
    expect(normalizeFinanceReminderInterval('daily_noon')).toBe('daily_noon');
  });

  it('maps every retired interval to daily at noon', () => {
    for (const legacy of ['once', 'daily', 'weekly', 'until_paid']) {
      expect(normalizeFinanceReminderInterval(legacy)).toBe('daily_noon');
    }
  });

  it('defaults unknown and missing values to daily at noon', () => {
    expect(normalizeFinanceReminderInterval('every_5_minutes')).toBe('daily_noon');
    expect(normalizeFinanceReminderInterval(null)).toBe('daily_noon');
    expect(normalizeFinanceReminderInterval(undefined)).toBe('daily_noon');
  });
});

describe('reminderIntervalLabel', () => {
  it('labels a supported interval', () => {
    expect(reminderIntervalLabel('hourly')).toBeTruthy();
    expect(reminderIntervalLabel('daily_noon')).toBeTruthy();
  });

  it('falls back to the raw value', () => {
    expect(reminderIntervalLabel('nope' as never)).toBe('nope');
  });
});

describe('recurrenceScheduleUpdateFields', () => {
  const base = {
    hasSeries: true,
    recurrenceInterval: 'monthly' as const,
    recurrenceUntil: '2026-12-31',
    initialInterval: 'monthly' as const,
    initialUntil: '2026-12-31',
    editScope: 'all' as const,
  };

  it('touches only this occurrence when the row is not part of a series', () => {
    expect(recurrenceScheduleUpdateFields({ ...base, hasSeries: false })).toEqual({
      scope: 'this',
    });
  });

  it('adds no schedule fields when the schedule is unchanged', () => {
    expect(recurrenceScheduleUpdateFields(base)).toEqual({ scope: 'all' });
  });

  it('promotes a schedule change from this-occurrence to this-and-future', () => {
    expect(
      recurrenceScheduleUpdateFields({ ...base, recurrenceInterval: 'weekly', editScope: 'this' })
    ).toEqual({
      scope: 'this_and_future',
      recurrence_interval: 'weekly',
      recurrence_until: '2026-12-31',
    });
  });

  it('keeps a wider scope and sends a null end date when it was cleared', () => {
    expect(
      recurrenceScheduleUpdateFields({
        ...base,
        recurrenceUntil: undefined,
        initialInterval: 'weekly',
      })
    ).toEqual({
      scope: 'all',
      recurrence_interval: 'monthly',
      recurrence_until: null,
    });
  });
});

describe('buildTelegramReminderSchedule', () => {
  const base = {
    anchorDate: '2026-01-15',
    recurrenceInterval: 'monthly' as const,
    recurrenceUntil: '2026-06-15',
    daysBefore: 3,
  };

  it('returns nothing for a malformed anchor date', () => {
    expect(buildTelegramReminderSchedule({ ...base, anchorDate: '15-01-2026' })).toBeNull();
  });

  it('builds one window for a single occurrence', () => {
    expect(
      buildTelegramReminderSchedule({ ...base, recurrenceInterval: 'none' })
    ).toEqual({
      windows: [{ windowStart: '2026-01-12', windowEnd: '2026-01-15' }],
      totalCount: 1,
      isRecurring: false,
      recurrenceLabel: null,
      seriesEndDate: null,
    });
  });

  it('builds a recurring preview with the total count and series end', () => {
    const preview = buildTelegramReminderSchedule(base);

    expect(preview?.isRecurring).toBe(true);
    expect(preview?.totalCount).toBe(6);
    expect(preview?.windows).toHaveLength(3);
    expect(preview?.windows[0]).toEqual({ windowStart: '2026-01-12', windowEnd: '2026-01-15' });
    expect(preview?.seriesEndDate).toBe('2026-06-15');
    expect(preview?.recurrenceLabel).toBeTruthy();
  });

  it('returns nothing when the series end is before the anchor', () => {
    expect(
      buildTelegramReminderSchedule({ ...base, recurrenceUntil: '2025-12-31' })
    ).toBeNull();
    expect(buildTelegramReminderSchedule({ ...base, recurrenceUntil: undefined })).toBeNull();
  });

  it('clamps the days-before window into a sane range', () => {
    const wide = buildTelegramReminderSchedule({ ...base, daysBefore: 500 });
    expect(wide?.windows[0]).toEqual({ windowStart: '2025-10-17', windowEnd: '2026-01-15' });

    const negative = buildTelegramReminderSchedule({ ...base, daysBefore: -5 });
    expect(negative?.windows[0]).toEqual({ windowStart: '2026-01-15', windowEnd: '2026-01-15' });
  });
});
