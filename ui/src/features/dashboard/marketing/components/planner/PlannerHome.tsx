import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { PlanItemCard } from '@/features/dashboard/marketing/components/planner/PlanItemCard';
import type { PlannerItemDto } from '@/features/dashboard/marketing/lib/planner/plannerApi';
import {
  PLANNER_RANGES,
  RANGE_LABELS,
  formatDayHeading,
  groupItemsByDay,
  normalizePlannerRange,
} from '@/features/dashboard/marketing/lib/planner/plannerRange';
import {
  useGeneratePlan,
  useMarketingPlan,
  usePlanItemActions,
} from '@/features/dashboard/marketing/hooks/useMarketingPlan';
import { toast } from 'sonner';

const SHOWCASE_ITEMS = 3;

function todayManilaYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export function PlannerHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = normalizePlannerRange(searchParams.get('range'));
  const setRange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('range', next);
    setSearchParams(params, { replace: true });
  };

  const planGate = useFeatureGate('marketingPlanner');
  const aiGate = useFeatureGate('aiMarketingPlanner');
  const { open: openUpgradeModal } = useUpgradeModal();
  const { data, isLoading, isError, error } = useMarketingPlan(range);
  const generate = useGeneratePlan();
  const { skip, markPosted } = usePlanItemActions();

  const today = todayManilaYmd();
  const allowed = planGate.allowed;

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return allowed ? all : all.slice(0, SHOWCASE_ITEMS);
  }, [allowed, data?.items]);

  const groups = useMemo(() => groupItemsByDay(items), [items]);

  const handleOpen = (item: PlannerItemDto) => {
    if (item.brief.message) {
      void navigator.clipboard?.writeText(item.brief.message).catch(() => undefined);
      toast.success('Caption copied');
      return;
    }
    toast.info('Open the editor from Posts to finish this item');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {PLANNER_RANGES.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={value === range ? 'default' : 'outline'}
              onClick={() => setRange(value)}
            >
              {RANGE_LABELS[value]}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {!aiGate.allowed && !aiGate.isLoading ? (
            <Button size="sm" variant="outline" onClick={() => openUpgradeModal('aiMarketingPlanner')}>
              AI plan
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={!allowed || generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? 'Building' : 'Build plan'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </CardContent>
        </Card>
      ) : data?.summary ? (
        <Card className="border-border/70 bg-muted/30">
          <CardContent className="p-4 text-sm">{data.summary}</CardContent>
        </Card>
      ) : null}

      {isError ? (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            {(error as Error | null)?.message || 'Could not load the plan'}
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !isError && groups.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nothing planned yet. Build a plan to see what to post.
          </CardContent>
        </Card>
      ) : null}

      {groups.map((group) => (
        <section key={group.day} className="space-y-2">
          <h3 className="text-section-title text-muted-foreground">
            {formatDayHeading(group.day, today)}
          </h3>
          <div className="space-y-2">
            {group.items.map((item) => (
              <PlanItemCard
                key={item.id}
                item={item}
                day={group.day}
                today={today}
                readOnly={!allowed}
                onOpen={handleOpen}
                onSkip={(target) => skip.mutate({ itemId: target.id, reason: 'Not this week' })}
                onMarkPosted={(target) => markPosted.mutate({ itemId: target.id })}
              />
            ))}
          </div>
        </section>
      ))}

      {!allowed && !planGate.isLoading && (data?.items.length ?? 0) > 0 ? (
        <Card className="border-primary/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
            <p className="text-sm">
              The full plan, reminders and Share it yourself are on Pro and above.
            </p>
            <Button size="sm" onClick={() => openUpgradeModal('marketingPlanner')}>
              View plans
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
