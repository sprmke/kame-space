import { Link, useParams } from 'react-router-dom';

import { Megaphone } from 'lucide-react';

import type { MarketingResults } from '@/features/dashboard/analytics/lib/types';
import { channelLabel } from '@/features/dashboard/marketing/lib/planner/planItemStatus';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

type Props = {
  marketing: MarketingResults;
  className?: string;
};

/**
 * Planner results inside Analytics: tracked visits and attributed booking requests from the
 * planner's tracked links. First-touch and campaign-code based, so it reads "at least".
 */
export function MarketingResultsCard({ marketing, className }: Props) {
  const { orgSlug, propertySlug } = useParams<{ orgSlug: string; propertySlug: string }>();
  const hasData = marketing.trackedVisits > 0 || marketing.attributedRequests > 0;

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-visible p-3 sm:p-4',
        className
      )}
      aria-label="Marketing results"
    >
      <AdminSurfaceCardHeader
        icon={Megaphone}
        title="Marketing results"
        iconClassName="bg-muted/80"
      />

      {hasData ? (
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-caption text-muted-foreground">
            At least {marketing.trackedVisits}{' '}
            {marketing.trackedVisits === 1 ? 'visit' : 'visits'} and{' '}
            {marketing.attributedRequests}{' '}
            {marketing.attributedRequests === 1 ? 'booking request' : 'booking requests'} from
            planner posts.
          </p>
          <ul className="space-y-1 text-sm">
            {marketing.channels
              .filter((channel) => channel.visits > 0 || channel.requests > 0)
              .map((channel) => (
                <li key={channel.channel} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">{channelLabel(channel.channel)}</span>
                  <span className="text-caption shrink-0 text-muted-foreground">
                    {channel.visits} visits
                    {channel.requests > 0 ? ` · ${channel.requests} requests` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <p className="text-caption text-muted-foreground">
          No tracked planner visits in this period.
        </p>
      )}
      {orgSlug && propertySlug ? (
        <Link
          to={`/org/${orgSlug}/property/${propertySlug}/marketing?tab=plan`}
          className="text-caption text-primary underline-offset-2 hover:underline"
        >
          Open plan
        </Link>
      ) : null}
    </section>
  );
}
