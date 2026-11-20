import { Building2, Calendar, DollarSign, Layers, Percent } from 'lucide-react';

import { DashboardTrendStatCard } from '@/features/dashboard/property/components/DashboardTrendStatCard';
import type { DashboardStats } from '@/features/dashboard/property/lib/types';

import { MetricHint } from '@/components/help/MetricHint';
import { MetricStrip } from '@/components/mobile/native/MetricStrip';
import { SummaryStrip } from '@/components/mobile/native/SummaryStrip';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  stats: DashboardStats;
};

function deltaLabel(change: number | null | undefined, asPoints?: boolean): string | undefined {
  if (change == null || change === 0) return undefined;
  const suffix = asPoints ? ' pts' : '%';
  return `${change > 0 ? '+' : ''}${change}${suffix}`;
}

export function OrgDashboardStatCards({ stats }: Props) {
  const { kpis, propertyCount, parkingCount } = stats;
  const hasParking = parkingCount > 0;
  const listingCount = propertyCount + parkingCount;
  const isMobile = useIsBelowLg();

  if (isMobile) {
    return (
      <section aria-label="Key metrics" className="space-y-2">
        <SummaryStrip
          segments={[
            { count: propertyCount, label: 'properties', filterKey: 'properties' },
            ...(hasParking
              ? [{ count: parkingCount, label: 'parking', filterKey: 'parking' as const }]
              : []),
          ]}
        />
        <MetricStrip
          metrics={[
            {
              label: 'Revenue',
              value: formatMoney(kpis.netProfit.value),
              delta: deltaLabel(kpis.netProfit.changePercent),
              deltaPositive: (kpis.netProfit.changePercent ?? 0) >= 0,
            },
            {
              label: 'Bookings',
              value: String(kpis.checkInsInPeriod.value),
              delta: deltaLabel(kpis.checkInsInPeriod.changePercent),
              deltaPositive: (kpis.checkInsInPeriod.changePercent ?? 0) >= 0,
            },
            {
              label: 'Occupancy',
              value: `${kpis.occupancyRate.value}%`,
              delta: deltaLabel(kpis.occupancyRate.changePoints, true),
              deltaPositive: (kpis.occupancyRate.changePoints ?? 0) >= 0,
            },
          ]}
        />
      </section>
    );
  }

  return (
    <section aria-label="Key metrics">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        <DashboardTrendStatCard
          title="Total Revenue"
          titleAdornment={<MetricHint metric="orgNetIncome" label="Total Revenue" />}
          value={formatMoney(kpis.netProfit.value)}
          change={kpis.netProfit.changePercent}
          icon={DollarSign}
          valueClassName={cn(
            kpis.netProfit.value >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          )}
        />
        <DashboardTrendStatCard
          title="Total Bookings"
          titleAdornment={<MetricHint metric="orgBookings" label="Total Bookings" />}
          value={String(kpis.checkInsInPeriod.value)}
          change={kpis.checkInsInPeriod.changePercent}
          icon={Calendar}
        />
        <DashboardTrendStatCard
          title="Occupancy Rate"
          titleAdornment={<MetricHint metric="orgOccupancyRate" label="Occupancy Rate" />}
          value={`${kpis.occupancyRate.value}%`}
          change={kpis.occupancyRate.changePoints}
          changeIsPoints
          icon={Percent}
        />
        {hasParking ? (
          <DashboardTrendStatCard
            title="Total Listings"
            value={String(listingCount)}
            icon={Layers}
            footer={
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums sm:text-xs">
                <span>{propertyCount} properties</span>
                <span aria-hidden>·</span>
                <span>{parkingCount} parking</span>
              </p>
            }
          />
        ) : (
          <DashboardTrendStatCard
            title="Total Properties"
            value={String(propertyCount)}
            icon={Building2}
          />
        )}
      </div>
    </section>
  );
}
