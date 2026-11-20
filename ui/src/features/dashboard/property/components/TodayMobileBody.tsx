import { Link } from 'react-router-dom';

import { PlannerTodayCard } from '@/features/dashboard/marketing/components/planner/PlannerTodayCard';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { DashboardStats } from '@/features/dashboard/property/lib/types';

import { MetricStrip } from '@/components/mobile/native/MetricStrip';
import { TodaySummaryCard } from '@/components/mobile/native/TodaySummaryCard';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  stats: DashboardStats;
  orgSlug: string;
  propertySlug: string;
};

/**
 * F1 Today lead for phone: summary card + KPI strip + marketing today.
 * Ops board (attention, calendar, maintenance, transactions, charts) renders
 * below via `DashboardFinanceCalendarSection` (already stacks below `lg`).
 */
export function TodayMobileBody({ stats, orgSlug, propertySlug }: Props) {
  const pricingHref = propertySectionPath(orgSlug, propertySlug, 'pricing');

  return (
    <div className="native-stagger flex min-w-0 flex-col gap-4">
      <TodaySummaryCard
        mascotPose="dashboard-overview"
        stats={[
          { label: 'Arrivals', value: stats.totals.checkInsToday },
          { label: 'Checkouts', value: stats.totals.checkOutsToday },
          { label: 'Active', value: stats.totals.activeBookings },
          {
            label: 'Due',
            value:
              stats.finance.outstandingBalance > 0
                ? formatMoney(stats.finance.outstandingBalance)
                : 0,
          },
        ]}
      />

      <MetricStrip
        metrics={[
          {
            label: 'Revenue',
            value: formatMoney(stats.kpis.netProfit.value),
            delta:
              stats.kpis.netProfit.changePercent !== 0
                ? `${stats.kpis.netProfit.changePercent > 0 ? '+' : ''}${stats.kpis.netProfit.changePercent}%`
                : undefined,
            deltaPositive: stats.kpis.netProfit.changePercent >= 0,
          },
          {
            label: 'Occupancy',
            value: `${stats.kpis.occupancyRate.value}%`,
          },
          {
            label: 'Bookings',
            value: String(stats.kpis.totalBookings.value),
          },
          {
            label: 'ADR',
            value: formatMoney(stats.kpis.avgNightlyRate.value),
          },
        ]}
      />

      <PlannerTodayCard />

      <Link
        to={pricingHref}
        className="text-native-meta text-primary native-v3-press inline-flex min-h-11 items-center px-1 font-medium"
      >
        Open calendar
      </Link>
    </div>
  );
}
