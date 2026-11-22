import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { useMarketingPlan } from '@/features/dashboard/marketing/hooks/useMarketingPlan';
import { formatItemTime } from '@/features/dashboard/marketing/lib/planner/plannerRange';
import { planItemStatusView } from '@/features/dashboard/marketing/lib/planner/planItemStatus';

const MAX_TODAY_ITEMS = 3;

/**
 * "Marketing today" on the property Dashboard. Shows the next items, or a build CTA when
 * the host is entitled and the day is empty.
 */
export function PlannerTodayCard() {
  const gate = useFeatureGate('marketingPlanner');
  const { orgSlug, propertySlug } = useParams<{ orgSlug: string; propertySlug: string }>();
  const query = useMarketingPlan('today');

  const items = useMemo(
    () => (query.data?.items ?? []).slice(0, MAX_TODAY_ITEMS),
    [query.data?.items]
  );

  if (!gate.allowed || gate.isLoading || !orgSlug || !propertySlug) return null;
  if (query.isLoading) return null;

  const href = `/org/${orgSlug}/property/${propertySlug}/marketing?plan=1&range=today`;

  if (items.length === 0) {
    return (
      <Card className="border-border/70">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-section-title">Marketing today</p>
            <Link to={href} className="text-caption text-primary underline-offset-2 hover:underline">
              Open plan
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            No posts planned yet. Open Plan to build what to post from your calendar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-section-title">Marketing today</p>
          <Link to={href} className="text-caption text-primary underline-offset-2 hover:underline">
            Open plan
          </Link>
        </div>
        <ul className="space-y-1.5">
          {items.map((item) => {
            const time = formatItemTime(item.scheduledFor);
            const view = planItemStatusView(item.status);
            return (
              <li key={item.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {time ? <span className="text-muted-foreground">{time} · </span> : null}
                  {item.title}
                </span>
                <span className="text-caption shrink-0 text-muted-foreground">{view.label}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
