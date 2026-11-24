/** Row + summary shapes shared by the maintenance service and its pure helpers. */

import type { RecurrenceInterval } from './financeRecurrence.ts';

export type MaintenanceItemRow = {
  id: string;
  label: string;
  category: string | null;
  scheduled_on: string;
  notes: string | null;
  recurrence_series_id: string | null;
  recurrence_interval: RecurrenceInterval | null;
  telegram_reminder_enabled: boolean;
  telegram_due_date: string | null;
  telegram_days_before: number;
  telegram_reminder_interval:
    | 'hourly'
    | 'every_2_hours'
    | 'every_4_hours'
    | 'every_12_hours'
    | 'daily_noon';
  telegram_message_template: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
