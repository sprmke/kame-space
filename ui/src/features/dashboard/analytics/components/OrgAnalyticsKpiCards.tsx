import { CalendarCheck, DollarSign, Percent, AlertTriangle } from 'lucide-react';

import { MetricInfoDot } from '@/features/dashboard/analytics/components/MetricInfoDot';
import type { OrgAnalyticsSummary } from '@/features/dashboard/analytics/lib/types';

import { MetricStrip } from '@/components/mobile/native/MetricStrip';
import { SummaryStrip } from '@/components/mobile/native/SummaryStrip';
import { StatCard, StatCardGrid } from '@/components/shared/StatCard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  portfolio: OrgAnalyticsSummary['portfolio'];
};

function deltaLabel(change: number | null | undefined, asPoints?: boolean): string | undefined {
  if (change == null || change === 0) return undefined;
  const suffix = asPoints ? ' pts' : '%';
  return `${change > 0 ? '+' : ''}${change}${suffix}`;
}

export function OrgAnalyticsKpiCards({ portfolio }: Props) {
  const parkingCount = portfolio.parkingCount ?? 0;
  const propertyCount = portfolio.propertyCount;
  const listingCount = portfolio.listingCount ?? propertyCount + parkingCount;
  const attentionCount = portfolio.attentionCount ?? 0;
  const isMobile = useIsBelowLg();

  if (isMobile) {
    return (
      <section aria-label="Portfolio metrics" className="space-y-2">
        <SummaryStrip
          segments={[
            { count: propertyCount, label: 'properties', filterKey: 'properties' },
            ...(parkingCount > 0
              ? [{ count: parkingCount, label: 'parking', filterKey: 'parking' as const }]
              : []),
            { count: attentionCount, label: 'need attention', filterKey: 'attention' },
          ]}
        />
        <MetricStrip
          metrics={[
            {
              label: 'Revenue',
              value: formatMoney(portfolio.totalRevenue),
              delta: deltaLabel(portfolio.totalRevenueChangePct),
              deltaPositive: (portfolio.totalRevenueChangePct ?? 0) >= 0,
            },
            {
              label: 'Bookings',
              value: String(portfolio.totalReservations),
              delta: deltaLabel(portfolio.totalReservationsChangePct),
              deltaPositive: (portfolio.totalReservationsChangePct ?? 0) >= 0,
            },
            {
              label: 'Occupancy',
              value: `${portfolio.avgOccupancy}%`,
              delta: deltaLabel(portfolio.avgOccupancyChangePts, true),
              deltaPositive: (portfolio.avgOccupancyChangePts ?? 0) >= 0,
            },
          ]}
        />
      </section>
    );
  }

  return (
    <section aria-label="Portfolio metrics">
      <StatCardGrid>
        <StatCard
          title="Revenue"
          value={formatMoney(portfolio.totalRevenue)}
          change={portfolio.totalRevenueChangePct ?? undefined}
          icon={DollarSign}
        />
        <StatCard
          title="Bookings"
          titleAdornment={<MetricInfoDot metric="reservations" label="Bookings" />}
          value={String(portfolio.totalReservations)}
          change={portfolio.totalReservationsChangePct ?? undefined}
          icon={CalendarCheck}
        />
        <StatCard
          title="Occupancy"
          titleAdornment={<MetricInfoDot metric="occupancy" label="Occupancy" />}
          value={`${portfolio.avgOccupancy}%`}
          change={portfolio.avgOccupancyChangePts ?? undefined}
          changeIsPoints
          icon={Percent}
        />
        <StatCard
          title="Needs attention"
          value={String(attentionCount)}
          icon={AlertTriangle}
          iconClassName={attentionCount > 0 ? 'text-amber-700 dark:text-amber-300' : undefined}
          iconBgClassName={attentionCount > 0 ? 'bg-amber-100 dark:bg-amber-950/50' : undefined}
          footer={
            <p className="text-muted-foreground text-[11px] tabular-nums sm:text-xs">
              of {listingCount} {listingCount === 1 ? 'listing' : 'listings'}
            </p>
          }
        />
      </StatCardGrid>
    </section>
  );
}
