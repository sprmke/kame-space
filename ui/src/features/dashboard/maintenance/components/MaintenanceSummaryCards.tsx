import { AlertTriangle, CheckCircle2, Clock3, ListChecks } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import { MAINTENANCE_HELP_COPY } from '@/features/dashboard/maintenance/lib/maintenanceHelpCopy';
import type { MaintenanceSummary } from '@/features/dashboard/maintenance/lib/types';

import { InfoHint } from '@/components/help/InfoHint';
import { cn } from '@/lib/utils';

type Props = Pick<
  MaintenanceSummary,
  'total' | 'telegramEnabled' | 'completed' | 'pending' | 'overdue'
>;

export function MaintenanceSummaryCards({ total, completed, pending, overdue }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:gap-4">
      <AdminMetricCard title="Total" value={String(total)} icon={ListChecks} />
      <AdminMetricCard
        title="Overdue"
        value={String(overdue)}
        icon={AlertTriangle}
        valueClassName={cn(overdue > 0 ? 'text-rose-600 dark:text-rose-400' : undefined)}
        titleAdornment={
          <InfoHint label="Overdue" text={MAINTENANCE_HELP_COPY.overdue.hint} variant="metric" />
        }
      />
      <AdminMetricCard
        title="Pending"
        value={String(pending)}
        icon={Clock3}
        valueClassName={cn(pending > 0 ? 'text-amber-600 dark:text-amber-400' : undefined)}
        titleAdornment={
          <InfoHint label="Pending" text={MAINTENANCE_HELP_COPY.pending.hint} variant="metric" />
        }
      />
      <AdminMetricCard
        title="Completed"
        value={String(completed)}
        icon={CheckCircle2}
        valueClassName="text-emerald-600 dark:text-emerald-400"
      />
    </div>
  );
}
