import { Link } from 'react-router-dom';

import { Megaphone } from 'lucide-react';

import {
  orgPropertyPlanHref,
  rankListingsForPromotion,
} from '@/features/dashboard/analytics/lib/marketingPortfolio';
import type { OrgPortfolioRow } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

type Props = {
  rows: readonly OrgPortfolioRow[];
  orgSlug: string;
  className?: string;
};

/**
 * "Needs promotion this week": the top listings by open nights times ADR, each one tap from
 * its plan. Renders nothing when every listing is full or locked.
 */
export function OrgMarketingRanking({ rows, orgSlug, className }: Props) {
  const ranked = rankListingsForPromotion(rows);
  if (ranked.length === 0) return null;

  return (
    <section
      className={cn('surface-card flex flex-col gap-2 p-3 sm:p-4', className)}
      aria-label="Listings that need promotion"
    >
      <AdminSurfaceCardHeader
        icon={Megaphone}
        title="Needs promotion this week"
        iconClassName="bg-muted/80"
      />
      <ul className="space-y-1.5">
        {ranked.map((listing) => (
          <li key={listing.id} className="flex items-baseline justify-between gap-2 text-sm">
            <Link
              to={orgPropertyPlanHref(orgSlug, listing.slug)}
              className="min-w-0 truncate underline-offset-2 hover:underline"
            >
              {listing.name}
            </Link>
            <span className="text-caption shrink-0 text-muted-foreground">
              {listing.openNights} {listing.openNights === 1 ? 'night' : 'nights'} open
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
