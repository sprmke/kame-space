import { Bell, CheckCircle2, Clock3, ListChecks } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import { MAINTENANCE_HELP_COPY } from '@/features/dashboard/maintenance/lib/maintenanceHelpCopy';
import type { MaintenanceSummary } from '@/features/dashboard/maintenance/lib/types';

import { InfoHint } from '@/components/help/InfoHint';
import { MetricStrip } from '@/components/mobile/native/MetricStrip';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type Props = Partial<
  Pick<MaintenanceSummary, 'total' | 'telegramEnabled' | 'completed' | 'pending'>
>;

/** Defaults missing fields to 0 so partial API / mock payloads never render `undefined` (C5). */
export function MaintenanceSummaryCards({
  total = 0,
  telegramEnabled = 0,
  completed = 0,
  pending = 0,
}: Props) {
  const safeTotal = total ?? 0;
  const safeTelegram = telegramEnabled ?? 0;
  const safeCompleted = completed ?? 0;
  const safePending = pending ?? 0;
  const isMobile = useIsBelowLg();

  if (isMobile) {
    return (
      <MetricStrip
        metrics={[
          { label: 'Open', value: String(safePending) },
          { label: 'Done', value: String(safeCompleted) },
          { label: 'Total', value: String(safeTotal) },
          { label: 'Telegram', value: String(safeTelegram) },
        ]}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
      <AdminMetricCard title="Total" value={String(safeTotal)} icon={ListChecks} />
      <AdminMetricCard
        title="Telegram enabled"
        value={String(safeTelegram)}
        icon={Bell}
        titleAdornment={
          <InfoHint
            label="Telegram enabled"
            text={MAINTENANCE_HELP_COPY.telegramEnabled.hint}
            variant="metric"
          />
        }
      />
      <AdminMetricCard
        title="Completed"
        value={String(safeCompleted)}
        icon={CheckCircle2}
        valueClassName="text-emerald-600 dark:text-emerald-400"
      />
      <AdminMetricCard
        title="Pending"
        value={String(safePending)}
        icon={Clock3}
        valueClassName={cn(safePending > 0 ? 'text-amber-600 dark:text-amber-400' : undefined)}
        titleAdornment={
          <InfoHint label="Pending" text={MAINTENANCE_HELP_COPY.pending.hint} variant="metric" />
        }
      />
    </div>
  );
}
