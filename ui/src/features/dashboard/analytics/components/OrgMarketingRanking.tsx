import { Link } from 'react-router-dom';

import { Megaphone } from 'lucide-react';

import {
  orgPropertyPlanHref,
  rankListingsForPromotion,
} from '@/features/dashboard/analytics/lib/marketingPortfolio';
import type { OrgPortfolioRow } from '@/features/dashboard/analytics/lib/types';

import { cn } from '@/lib/utils';

type Props = {
  rows: readonly OrgPortfolioRow[];
  orgSlug: string;
  className?: string;
};

/**
 * Compact promote queue above the listings list: top open-nights × ADR properties,
 * each one tap to its plan. Not a peer content card. Hidden when every listing is full
 * or locked.
 */
export function OrgMarketingRanking({ rows, orgSlug, className }: Props) {
  const ranked = rankListingsForPromotion(rows);
  if (ranked.length === 0) return null;

  return (
    <aside
      className={cn(
        'border-border/70 bg-muted/35 flex min-w-0 flex-col gap-1.5 rounded-lg border px-3 py-2.5',
        className
      )}
      aria-label="Listings to promote this week"
    >
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium leading-none">
        <Megaphone className="size-3.5 shrink-0" aria-hidden />
        Promote this week
      </p>
      <ul className="min-w-0">
        {ranked.map((listing) => (
          <li
            key={listing.id}
            className="flex min-w-0 items-center justify-between gap-3 py-1 first:pt-0 last:pb-0"
          >
            <Link
              to={orgPropertyPlanHref(orgSlug, listing.slug)}
              title={listing.name}
              className="text-foreground min-w-0 truncate text-sm font-medium underline-offset-2 hover:underline"
            >
              {listing.name}
            </Link>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {listing.openNights} {listing.openNights === 1 ? 'night' : 'nights'} open
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
