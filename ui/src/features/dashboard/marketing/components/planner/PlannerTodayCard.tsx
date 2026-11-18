import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { useMarketingPlan } from '@/features/dashboard/marketing/hooks/useMarketingPlan';
import { formatItemTime } from '@/features/dashboard/marketing/lib/planner/plannerRange';
import { planItemStatusView } from '@/features/dashboard/marketing/lib/planner/planItemStatus';

const MAX_TODAY_ITEMS = 3;

/**
 * "Marketing today" on the property Dashboard: the next few planner items and one link into
 * the Plan tab. Renders nothing for a property without the planner or without items, so it
 * never becomes dashboard clutter.
 */
export function PlannerTodayCard() {
  const gate = useFeatureGate('marketingPlanner');
  const { orgSlug, propertySlug } = useParams<{ orgSlug: string; propertySlug: string }>();
  const query = useMarketingPlan('today');

  const items = useMemo(
    () => (query.data?.items ?? []).slice(0, MAX_TODAY_ITEMS),
    [query.data?.items]
  );

  if (!gate.allowed || items.length === 0 || !orgSlug || !propertySlug) return null;

  const href = `/org/${orgSlug}/property/${propertySlug}/marketing?tab=plan&range=today`;

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
