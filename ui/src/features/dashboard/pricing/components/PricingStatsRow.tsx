import { Calendar, DollarSign, Tag, TrendingUp, Wand2 } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import { PRICING_HELP_COPY } from '@/features/dashboard/pricing/lib/pricingHelpCopy';

import { InfoHint } from '@/components/help/InfoHint';
import { MetricStrip } from '@/components/mobile/native/MetricStrip';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';

type Props = {
  weekdayRate: number;
  weekendRate: number;
  customDatesCount: number;
  enabledFeesTotal: number;
  /** Applied Smart Pricing nights in the current view — shows a 5th card when > 0. */
  smartDatesCount?: number;
};

export function PricingStatsRow({
  weekdayRate,
  weekendRate,
  customDatesCount,
  enabledFeesTotal,
  smartDatesCount = 0,
}: Props) {
  const weekendPremium =
    weekdayRate > 0 ? Math.round(((weekendRate - weekdayRate) / weekdayRate) * 100) : 0;
  const showSmart = smartDatesCount > 0;
  const isMobile = useIsBelowLg();

  if (isMobile) {
    const metrics = [
      { label: 'Base', value: formatMoneyCompact(weekdayRate) },
      { label: 'Weekend', value: `+${weekendPremium}%` },
      { label: 'Custom', value: String(customDatesCount) },
      { label: 'Fees', value: formatMoneyCompact(enabledFeesTotal) },
    ];
    if (showSmart) {
      metrics.push({ label: 'Smart', value: String(smartDatesCount) });
    }
    return <MetricStrip metrics={metrics} />;
  }

  return (
    <section
      aria-label="Pricing summary"
      className={cn(
        'grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-4',
        showSmart ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
      )}
    >
      <AdminMetricCard
        title="Base Rate"
        value={formatMoneyCompact(weekdayRate)}
        icon={DollarSign}
      />
      <AdminMetricCard
        title="Weekend Premium"
        value={`+${weekendPremium}%`}
        icon={TrendingUp}
        titleAdornment={
          <InfoHint
            label="Weekend Premium"
            text={PRICING_HELP_COPY.weekendPremium.hint}
            variant="metric"
          />
        }
      />
      <AdminMetricCard
        title="Custom Dates"
        value={String(customDatesCount)}
        icon={Calendar}
        titleAdornment={
          <InfoHint
            label="Custom Dates"
            text={PRICING_HELP_COPY.customDates.hint}
            variant="metric"
          />
        }
      />
      <AdminMetricCard
        title="Fixed Fees"
        value={formatMoneyCompact(enabledFeesTotal)}
        icon={Tag}
        titleAdornment={
          <InfoHint label="Fixed Fees" text={PRICING_HELP_COPY.fixedFees.hint} variant="metric" />
        }
      />
      {showSmart ? (
        <AdminMetricCard
          title="Smart Pricing"
          value={String(smartDatesCount)}
          icon={Wand2}
          titleAdornment={
            <InfoHint
              label="Smart Pricing"
              text={PRICING_HELP_COPY.smartPricingNights.hint}
              variant="metric"
            />
          }
        />
      ) : null}
    </section>
  );
}
