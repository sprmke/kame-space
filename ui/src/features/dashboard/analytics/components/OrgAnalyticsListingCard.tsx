import { Link } from 'react-router-dom';

import {
  OrgAnalyticsAttention,
  OrgAnalyticsKindBadge,
  OrgAnalyticsOutlook,
  OrgAnalyticsPromoteHint,
  OrgAnalyticsRevenueChange,
  orgAnalyticsListingHref,
} from '@/features/dashboard/analytics/components/OrgAnalyticsListingParts';
import type { PromotionCandidate } from '@/features/dashboard/analytics/lib/marketingPortfolio';
import { orgAttentionReasons } from '@/features/dashboard/analytics/lib/orgAnalyticsListings';
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
  promote?: PromotionCandidate;
};

type UnlockedRow = Extract<OrgPortfolioRow, { locked: false }>;

const CARD_CLASS = cn(
  'surface-card group relative flex min-w-0 flex-col gap-3 p-3.5 transition-colors sm:p-4',
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
      <p className="text-muted-foreground text-[11px] font-medium leading-none">{label}</p>
      <div className="text-foreground mt-1 truncate text-sm font-semibold tabular-nums leading-none">
        {children}
      </div>
    </div>
  );
}

function RevenueValue({ row, stacked = false }: { row: UnlockedRow; stacked?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 gap-1.5',
        stacked ? 'flex-col items-start gap-0.5' : 'items-baseline'
      )}
    >
      <span className="whitespace-nowrap">{formatMoneyCompact(row.grossRevenue)}</span>
      <OrgAnalyticsRevenueChange pct={row.revenueChangePct} />
    </span>
  );
}

function NameLink({ row, orgSlug }: Pick<Props, 'row' | 'orgSlug'>) {
  const name = orgPortfolioListingName(row);
  return (
    <Link
      to={orgAnalyticsListingHref(orgSlug, row)}
      title={name}
      className="text-foreground group-hover:text-primary block truncate text-sm font-semibold leading-snug transition-colors after:absolute after:inset-0 after:content-[''] sm:text-[15px]"
    >
      {name}
    </Link>
  );
}

function AttentionReasonLines({ row }: { row: UnlockedRow }) {
  const reasons = orgAttentionReasons(row).filter((reason) => reason.key !== 'underbooked');
  if (reasons.length === 0) return null;
  return (
    <ul className="text-muted-foreground relative z-[1] space-y-0.5 text-[11px] leading-snug sm:text-xs">
      {reasons.map((reason) => (
        <li key={reason.key}>
          <span className="text-foreground font-medium">{reason.label}</span>
          <span>{`. ${reason.detail}`}</span>
        </li>
      ))}
    </ul>
  );
}

function MetricsBlock({
  row,
  orgSlug,
  promote,
}: {
  row: UnlockedRow;
  orgSlug: string;
  promote?: PromotionCandidate;
}) {
  return (
    <div className="border-separator space-y-2.5 border-t pt-3">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Occupancy">{row.occupancyRate}%</Metric>
        <Metric label="Revenue">
          <RevenueValue row={row} />
        </Metric>
        <Metric label="Bookings">{row.reservations}</Metric>
      </div>
      <div className="relative z-[1] flex min-w-0 items-center justify-between gap-2">
        <div className="text-muted-foreground flex min-w-0 items-baseline gap-1.5 text-[11px] leading-none sm:text-xs">
          <span className="shrink-0">Outlook</span>
          <OrgAnalyticsOutlook
            row={row}
            compact
            className="min-w-0 truncate text-[11px] sm:text-xs"
          />
        </div>
        <OrgAnalyticsPromoteHint candidate={promote} orgSlug={orgSlug} className="shrink-0" />
      </div>
    </div>
  );
}

/** Grid view: stacked card. */
export function OrgAnalyticsListingCard({ row, orgSlug, promote }: Props) {
  return (
    <article className={CARD_CLASS}>
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <OrgAnalyticsKindBadge kind={orgPortfolioListingKind(row)} />
          {!row.locked ? (
            <OrgAnalyticsAttention
              row={row}
              hideOutlookReasons
              showDetail={false}
              className="relative z-[1] shrink-0"
            />
          ) : null}
        </div>
        <NameLink row={row} orgSlug={orgSlug} />
      </div>

      {row.locked ? (
        <p className="text-muted-foreground text-xs">Unavailable on your plan</p>
      ) : (
        <>
          <AttentionReasonLines row={row} />
          <MetricsBlock row={row} orgSlug={orgSlug} promote={promote} />
        </>
      )}
    </article>
  );
}

/** List view: one wide row per listing. */
export function OrgAnalyticsListingRow({ row, orgSlug, promote }: Props) {
  return (
    <article className={cn(CARD_CLASS, 'xl:flex-row xl:items-center xl:gap-5')}>
      <div className="min-w-0 flex-1 space-y-1 xl:max-w-[18rem] xl:shrink-0">
        <OrgAnalyticsKindBadge kind={orgPortfolioListingKind(row)} />
        <NameLink row={row} orgSlug={orgSlug} />
      </div>

      {row.locked ? (
        <p className="text-muted-foreground text-xs">Unavailable on your plan</p>
      ) : (
        <>
          <div className="relative z-[1] min-w-0 xl:w-36 xl:shrink-0">
            <OrgAnalyticsAttention row={row} hideOutlookReasons showDetail={false} />
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-3 xl:max-w-md">
            <Metric label="Occupancy">{row.occupancyRate}%</Metric>
            <Metric label="Revenue">
              <RevenueValue row={row} stacked />
            </Metric>
            <Metric label="Bookings">{row.reservations}</Metric>
          </div>
          <div className="relative z-[1] flex min-w-0 items-end justify-between gap-3 xl:w-48 xl:shrink-0 xl:flex-col xl:items-start xl:justify-start xl:gap-1.5">
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-medium leading-none">Outlook</p>
              <OrgAnalyticsOutlook
                row={row}
                compact
                className="mt-1 min-w-0 truncate text-sm font-semibold leading-none"
              />
            </div>
            <OrgAnalyticsPromoteHint candidate={promote} orgSlug={orgSlug} className="shrink-0" />
          </div>
        </>
      )}
    </article>
  );
}
