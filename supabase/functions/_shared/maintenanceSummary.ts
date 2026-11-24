/**
 * Pure maintenance KPI math. Kept separate from `maintenanceService` so tests do not
 * import the Supabase client (which requires env at module load).
 */

import { manilaTodayIso } from './bookingsListSort.ts';
import type { MaintenanceItemRow } from './maintenanceServiceTypes.ts';

export type MaintenanceSummaryResult = {
  period: {
    from: string | null;
    to: string | null;
  };
  total: number;
  telegramEnabled: number;
  completed: number;
  pending: number;
  overdue: number;
  byCategory: { category: string; count: number }[];
};

export function summarizeMaintenanceItems(
  items: MaintenanceItemRow[],
  todayIso = manilaTodayIso()
): Omit<MaintenanceSummaryResult, 'period'> {
  let telegramEnabled = 0;
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  const categoryCounts = new Map<string, number>();

  for (const item of items) {
    if (item.telegram_reminder_enabled) telegramEnabled += 1;
    if (item.completed_at) {
      completed += 1;
    } else if (item.scheduled_on < todayIso) {
      overdue += 1;
    } else {
      pending += 1;
    }

    const key = item.category?.trim() || '-';
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  }

  const byCategory = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  return {
    total: items.length,
    telegramEnabled,
    completed,
    pending,
    overdue,
    byCategory,
  };
}
