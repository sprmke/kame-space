import { Ban, Calendar, DollarSign, TrendingUp } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import { PRICING_HELP_COPY } from '@/features/dashboard/pricing/lib/pricingHelpCopy';
import {
  formatWeekendPremiumPercent,
  weekendPremiumPercent,
} from '@/features/dashboard/pricing/lib/weekendPremium';

import { InfoHint } from '@/components/help/InfoHint';
import { formatMoneyCompact } from '@/utils/format/currency';

type Props = {
  weekdayRate: number;
  weekendRate: number;
  customDatesCount: number;
  /** Owner-blocked nights in the loaded calendar window; show `0` when none. */
  blockedDatesCount: number;
};

export function ParkingPricingStatsRow({
  weekdayRate,
  weekendRate,
  customDatesCount,
  blockedDatesCount,
}: Props) {
  const weekendPremium = weekendPremiumPercent(weekdayRate, weekendRate);

  return (
    <section
      aria-label="Pricing summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard
        title="Your base rate"
        value={formatMoneyCompact(weekdayRate)}
        icon={DollarSign}
      />
      <AdminMetricCard
        title="Weekend Premium"
        value={formatWeekendPremiumPercent(weekendPremium)}
        icon={TrendingUp}
        titleAdornment={
          <InfoHint
            label="Weekend Premium"
            text={PRICING_HELP_COPY.parkingWeekendPremium.hint}
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
            text={PRICING_HELP_COPY.parkingCustomDates.hint}
            variant="metric"
          />
        }
      />
      <AdminMetricCard
        title="Blocked nights"
        value={String(blockedDatesCount)}
        icon={Ban}
        titleAdornment={
          <InfoHint
            label="Blocked nights"
            text={PRICING_HELP_COPY.parkingBlockedNights.hint}
            variant="metric"
          />
        }
      />
    </section>
  );
}
