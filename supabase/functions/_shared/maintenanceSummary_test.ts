import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { summarizeMaintenanceItems } from './maintenanceSummary.ts';
import type { MaintenanceItemRow } from './maintenanceServiceTypes.ts';

function row(overrides: Partial<MaintenanceItemRow> = {}): MaintenanceItemRow {
  return {
    id: 'row-1',
    label: 'Task',
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

Deno.test('summarizeMaintenanceItems splits pending from overdue', () => {
  const summary = summarizeMaintenanceItems(
    [
      row({ id: 'overdue', scheduled_on: '2026-11-20' }),
      row({ id: 'today', scheduled_on: '2026-11-24' }),
      row({ id: 'upcoming', scheduled_on: '2026-12-01' }),
      row({ id: 'done', scheduled_on: '2026-11-20', completed_at: '2026-11-21T00:00:00.000Z' }),
      row({ id: 'telegram', telegram_reminder_enabled: true }),
    ],
    '2026-11-24'
  );

  assertEquals(summary.total, 5);
  assertEquals(summary.completed, 1);
  assertEquals(summary.overdue, 1);
  assertEquals(summary.pending, 3);
  assertEquals(summary.telegramEnabled, 1);
  assertEquals(summary.byCategory, [{ category: 'Aircon', count: 5 }]);
});

Deno.test('summarizeMaintenanceItems keeps category order stable', () => {
  const summary = summarizeMaintenanceItems(
    [
      row({ id: 'a', category: 'Pool' }),
      row({ id: 'b', category: 'Aircon' }),
      row({ id: 'c', category: 'Aircon' }),
      row({ id: 'd', category: null }),
    ],
    '2026-11-24'
  );

  assertEquals(summary.byCategory, [
    { category: 'Aircon', count: 2 },
    { category: '-', count: 1 },
    { category: 'Pool', count: 1 },
  ]);
});
