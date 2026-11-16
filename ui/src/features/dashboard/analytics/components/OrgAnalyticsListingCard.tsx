import { Link } from 'react-router-dom';

import {
  OrgAnalyticsAttention,
  OrgAnalyticsKindBadge,
  OrgAnalyticsOutlook,
  OrgAnalyticsRevenueChange,
  orgAnalyticsListingHref,
} from '@/features/dashboard/analytics/components/OrgAnalyticsListingParts';
import {
  orgPortfolioListingKind,
  orgPortfolioListingName,
  type OrgPortfolioRow,
} from '@/features/dashboard/analytics/lib/types';

import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';

type Props = {
  row: OrgPortfolioRow;
  orgSlug: string;
};

const CARD_CLASS = cn(
  'surface-card group relative flex min-w-0 flex-col gap-3.5 p-4 transition-colors',
  'hover:bg-muted/30 focus-within:ring-primary/40 focus-within:ring-2'
);

function Metric({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-muted-foreground mb-0.5 text-[11px] font-medium">{label}</p>
      <div className="text-foreground text-sm font-semibold tabular-nums leading-snug">
        {children}
      </div>
    </div>
  );
}

function Header({ row, orgSlug }: Props) {
  const name = orgPortfolioListingName(row);
  return (
    <div className="min-w-0 space-y-1.5">
      <OrgAnalyticsKindBadge kind={orgPortfolioListingKind(row)} />
      <Link
        to={orgAnalyticsListingHref(orgSlug, row)}
        className="text-foreground group-hover:text-primary block text-sm font-semibold leading-snug transition-colors after:absolute after:inset-0 after:content-[''] sm:text-base"
      >
        {name}
      </Link>
    </div>
  );
}

function MetricsBlock({ row }: { row: Extract<OrgPortfolioRow, { locked: false }> }) {
  return (
    <div className="border-separator grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3.5 sm:grid-cols-4">
      <Metric label="Occupancy">{row.occupancyRate}%</Metric>
      <Metric label="Revenue" className="sm:col-span-1">
        <span className="block whitespace-nowrap">{formatMoneyCompact(row.grossRevenue)}</span>
        <OrgAnalyticsRevenueChange pct={row.revenueChangePct} />
      </Metric>
      <Metric label="Bookings">{row.reservations}</Metric>
      <Metric label="Outlook">
        <OrgAnalyticsOutlook row={row} compact />
      </Metric>
    </div>
  );
}

/** Grid view: stacked card. */
export function OrgAnalyticsListingCard({ row, orgSlug }: Props) {
  return (
    <article className={CARD_CLASS}>
      <Header row={row} orgSlug={orgSlug} />
      {row.locked ? (
        <p className="text-muted-foreground text-xs">Unavailable on your plan</p>
      ) : (
        <>
          <OrgAnalyticsAttention row={row} hideOutlookReasons />
          <MetricsBlock row={row} />
        </>
      )}
    </article>
  );
}

/** List view: one wide row per listing. */
export function OrgAnalyticsListingRow({ row, orgSlug }: Props) {
  return (
    <article className={cn(CARD_CLASS, 'lg:flex-row lg:items-start lg:gap-5')}>
      <div className="min-w-0 lg:w-52 lg:shrink-0">
        <Header row={row} orgSlug={orgSlug} />
      </div>
      {row.locked ? (
        <p className="text-muted-foreground text-xs">Unavailable on your plan</p>
      ) : (
        <>
          <div className="relative z-[1] min-w-0 lg:max-w-[14rem] lg:flex-1">
            <OrgAnalyticsAttention row={row} hideOutlookReasons />
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:max-w-none lg:shrink-0">
            <Metric label="Occupancy">{row.occupancyRate}%</Metric>
            <Metric label="Revenue">
              <span className="block whitespace-nowrap">
                {formatMoneyCompact(row.grossRevenue)}
              </span>
              <OrgAnalyticsRevenueChange pct={row.revenueChangePct} />
            </Metric>
            <Metric label="Bookings">{row.reservations}</Metric>
            <Metric label="Outlook">
              <OrgAnalyticsOutlook row={row} compact />
            </Metric>
          </div>
        </>
      )}
    </article>
  );
}
