import { describe, expect, it } from 'vitest';

import {
  collectMaintenanceCategories,
  filterMaintenanceItems,
  maintenanceReminderStatus,
  paginateMaintenanceItems,
  sortMaintenanceItems,
} from '@/features/dashboard/maintenance/lib/maintenanceReminders';
import type { MaintenanceItem, MaintenanceQuery } from '@/features/dashboard/maintenance/lib/types';

const TODAY = '2026-11-24';

function item(overrides: Partial<MaintenanceItem> = {}): MaintenanceItem {
  return {
    id: 'rem-1',
    label: 'Aircon filter',
    category: 'Aircon',
    scheduled_on: '2026-11-24',
    notes: null,
    recurrence_series_id: null,
    recurrence_interval: null,
    telegram_reminder_enabled: false,
    telegram_due_date: null,
    telegram_days_before: 3,
    telegram_reminder_interval: 'daily_noon',
    telegram_message_template: null,
    completed_at: null,
    created_by: null,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function query(overrides: Partial<MaintenanceQuery> = {}): MaintenanceQuery {
  return {
    from: null,
    to: null,
    q: '',
    page: 1,
    limit: 25,
    view: 'table',
    sort: 'date:asc',
    statusFilter: [],
    categoryFilter: [],
    telegramFilter: 'all',
    ...overrides,
  };
}

describe('maintenanceReminderStatus', () => {
  it('completed wins over overdue', () => {
    expect(
      maintenanceReminderStatus(
        item({ scheduled_on: '2026-11-01', completed_at: '2026-11-02' }),
        TODAY
      )
    ).toBe('completed');
  });

  it('past unfinished rows are overdue, today and future are pending', () => {
    expect(maintenanceReminderStatus(item({ scheduled_on: '2026-11-23' }), TODAY)).toBe('overdue');
    expect(maintenanceReminderStatus(item({ scheduled_on: '2026-11-24' }), TODAY)).toBe('pending');
    expect(maintenanceReminderStatus(item({ scheduled_on: '2026-12-01' }), TODAY)).toBe('pending');
  });

  it('does not depend on Telegram reminders', () => {
    expect(maintenanceReminderStatus(item({ scheduled_on: '2026-11-20' }), TODAY)).toBe('overdue');
  });
});

describe('filterMaintenanceItems', () => {
  const rows = [
    item({ id: 'a', label: 'Overdue', scheduled_on: '2026-11-20', category: 'Aircon' }),
    item({ id: 'b', label: 'Today', scheduled_on: '2026-11-24', category: 'Pool' }),
    item({
      id: 'c',
      label: 'Done',
      scheduled_on: '2026-11-22',
      category: 'Pool',
      completed_at: '2026-11-22T08:00:00.000Z',
      telegram_reminder_enabled: true,
    }),
  ];

  it('filters by overdue, pending and completed', () => {
    expect(
      filterMaintenanceItems(rows, query({ statusFilter: ['overdue'] }), TODAY).map((r) => r.id)
    ).toEqual(['a']);
    expect(
      filterMaintenanceItems(rows, query({ statusFilter: ['pending'] }), TODAY).map((r) => r.id)
    ).toEqual(['b']);
    expect(
      filterMaintenanceItems(rows, query({ statusFilter: ['completed'] }), TODAY).map((r) => r.id)
    ).toEqual(['c']);
  });

  it('combines category and Telegram filters', () => {
    expect(
      filterMaintenanceItems(
        rows,
        query({ categoryFilter: ['Pool'], telegramFilter: 'enabled' }),
        TODAY
      ).map((r) => r.id)
    ).toEqual(['c']);
  });
});

describe('sortMaintenanceItems', () => {
  it('Due soonest is oldest first and breaks ties by label', () => {
    const rows = [
      item({ id: 'new', scheduled_on: '2026-12-01', label: 'B' }),
      item({ id: 'old', scheduled_on: '2026-11-01', label: 'Z' }),
      item({ id: 'tie-b', scheduled_on: '2026-11-10', label: 'B' }),
      item({ id: 'tie-a', scheduled_on: '2026-11-10', label: 'A' }),
    ];
    expect(sortMaintenanceItems(rows, 'date:asc').map((r) => r.id)).toEqual([
      'old',
      'tie-a',
      'tie-b',
      'new',
    ]);
  });
});

describe('collectMaintenanceCategories', () => {
  it('sorts unique categories and drops blanks', () => {
    expect(
      collectMaintenanceCategories([
        item({ category: 'Pool' }),
        item({ category: 'Aircon' }),
        item({ category: null }),
        item({ category: 'Pool' }),
      ])
    ).toEqual(['Aircon', 'Pool']);
  });
});

describe('paginateMaintenanceItems', () => {
  it('returns the requested slice and the filtered total', () => {
    const rows = Array.from({ length: 7 }, (_, index) => item({ id: String(index) }));
    expect(paginateMaintenanceItems(rows, 2, 3)).toEqual({
      rows: rows.slice(3, 6),
      total: 7,
    });
  });
});
