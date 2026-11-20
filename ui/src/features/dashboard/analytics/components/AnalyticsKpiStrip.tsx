import { BarChart3, BedDouble, CalendarCheck, Percent } from 'lucide-react';

import { MetricInfoDot } from '@/features/dashboard/analytics/components/MetricInfoDot';
import type { AnalyticsMetricKey } from '@/features/dashboard/analytics/lib/metricGlossary';
import type { AnalyticsKpi, AnalyticsKpis } from '@/features/dashboard/analytics/lib/types';

import { MetricStrip } from '@/components/mobile/native/MetricStrip';
import { StatCard } from '@/components/shared/StatCard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { formatMoney } from '@/utils/format/currency';

import type { LucideIcon } from 'lucide-react';

type Props = {
  kpis: AnalyticsKpis;
};

type MetricRow = {
  key: AnalyticsMetricKey;
  title: string;
  shortLabel: string;
  icon: LucideIcon;
  value: (k: AnalyticsKpis) => string;
  kpi: (k: AnalyticsKpis) => AnalyticsKpi;
  changeIsPoints?: boolean;
};

const METRICS: MetricRow[] = [
  {
    key: 'occupancy',
    title: 'Occupancy',
    shortLabel: 'Occupancy',
    icon: Percent,
    value: (k) => `${k.occupancyRate.value}%`,
    kpi: (k) => k.occupancyRate,
    changeIsPoints: true,
  },
  {
    key: 'adr',
    title: 'Avg nightly rate',
    shortLabel: 'ADR',
    icon: BedDouble,
    value: (k) => formatMoney(k.adr.value),
    kpi: (k) => k.adr,
  },
  {
    key: 'revpar',
    title: 'Revenue per night',
    shortLabel: 'RevPAR',
    icon: BarChart3,
    value: (k) => formatMoney(k.revpar.value),
    kpi: (k) => k.revpar,
  },
  {
    key: 'reservations',
    title: 'Bookings',
    shortLabel: 'Bookings',
    icon: CalendarCheck,
    value: (k) => String(k.reservations.value),
    kpi: (k) => k.reservations,
  },
];

function deltaLabel(change: number | null | undefined, asPoints?: boolean): string | undefined {
  if (change == null || change === 0) return undefined;
  const suffix = asPoints ? ' pts' : '%';
  return `${change > 0 ? '+' : ''}${change}${suffix}`;
}

export function AnalyticsKpiStrip({ kpis }: Props) {
  const isMobile = useIsBelowLg();

  if (isMobile) {
    return (
      <section aria-label="Key metrics">
        <MetricStrip
          metrics={METRICS.map((metric) => {
            const change = metric.kpi(kpis).changePctVsPrior;
            return {
              label: metric.shortLabel,
              value: metric.value(kpis),
              delta: deltaLabel(change, metric.changeIsPoints),
              deltaPositive: change == null ? undefined : change >= 0,
            };
          })}
        />
      </section>
    );
  }

  return (
    <section aria-label="Key metrics">
      <div className="native-stagger grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        {METRICS.map((metric) => (
          <StatCard
            key={metric.key}
            title={metric.title}
            titleAdornment={<MetricInfoDot metric={metric.key} label={metric.title} />}
            value={metric.value(kpis)}
            change={metric.kpi(kpis).changePctVsPrior ?? undefined}
            changeLabel="vs last period"
            changeIsPoints={metric.changeIsPoints}
            icon={metric.icon}
          />
        ))}
      </div>
    </section>
  );
}
