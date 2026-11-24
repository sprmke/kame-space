import type {
  MaintenanceItem,
  MaintenanceQuery,
  MaintenanceReminderStatus,
  MaintenanceRemindersSort,
} from '@/features/dashboard/maintenance/lib/types';

import { manilaTodayIso } from '@/lib/date/manilaPeriod';

export const MAINTENANCE_STATUS_OPTIONS: {
  value: MaintenanceReminderStatus;
  label: string;
}[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];

export const MAINTENANCE_SORT_OPTIONS: {
  value: MaintenanceRemindersSort;
  label: string;
}[] = [
  { value: 'date:asc', label: 'Due soonest' },
  { value: 'date:desc', label: 'Newest scheduled' },
  { value: 'label:asc', label: 'Label A–Z' },
  { value: 'label:desc', label: 'Label Z–A' },
];

/**
 * Completed wins over overdue: a task finished late is done, not still late.
 * `todayIso` is injectable so tests do not depend on the wall clock.
 */
export function maintenanceReminderStatus(
  item: MaintenanceItem,
  todayIso: string = manilaTodayIso()
): MaintenanceReminderStatus {
  if (item.completed_at) return 'completed';
  if (item.scheduled_on < todayIso) return 'overdue';
  return 'pending';
}

export function collectMaintenanceCategories(items: MaintenanceItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const category = item.category?.trim();
    if (category) set.add(category);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function filterMaintenanceItems(
  items: MaintenanceItem[],
  query: MaintenanceQuery,
  todayIso: string = manilaTodayIso()
): MaintenanceItem[] {
  return items.filter((item) => {
    if (query.statusFilter.length > 0) {
      const status = maintenanceReminderStatus(item, todayIso);
      if (!query.statusFilter.includes(status)) return false;
    }
    if (query.categoryFilter.length > 0) {
      const category = item.category?.trim() ?? '';
      if (!query.categoryFilter.includes(category)) return false;
    }
    if (query.telegramFilter === 'enabled' && !item.telegram_reminder_enabled) {
      return false;
    }
    if (query.telegramFilter === 'disabled' && item.telegram_reminder_enabled) {
      return false;
    }
    return true;
  });
}

/**
 * "Due soonest" is overdue first, then today, then upcoming. Ties fall back to label so
 * equal dates never shuffle between renders because the API returned them in another order.
 */
export function sortMaintenanceItems(
  items: MaintenanceItem[],
  sort: MaintenanceRemindersSort
): MaintenanceItem[] {
  const rows = [...items];
  rows.sort((a, b) => {
    switch (sort) {
      case 'date:asc':
        return a.scheduled_on.localeCompare(b.scheduled_on) || a.label.localeCompare(b.label);
      case 'date:desc':
        return b.scheduled_on.localeCompare(a.scheduled_on) || a.label.localeCompare(b.label);
      case 'label:asc':
        return a.label.localeCompare(b.label);
      case 'label:desc':
        return b.label.localeCompare(a.label);
      default:
        return 0;
    }
  });
  return rows;
}

export function paginateMaintenanceItems(
  items: MaintenanceItem[],
  page: number,
  limit: number
): { rows: MaintenanceItem[]; total: number } {
  const total = items.length;
  const start = (page - 1) * limit;
  return { rows: items.slice(start, start + limit), total };
}
