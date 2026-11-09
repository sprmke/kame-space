import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { captureAppEvent } from '@/lib/posthog/capture';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import {
  resolveHandoffTarget,
  setPendingPlannerDraft,
} from '@/features/dashboard/marketing/lib/planner/plannerHandoff';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { PlanItemCard } from '@/features/dashboard/marketing/components/planner/PlanItemCard';
import { PlanItemSheet } from '@/features/dashboard/marketing/components/planner/PlanItemSheet';
import { PlannerSetupWizard } from '@/features/dashboard/marketing/components/planner/PlannerSetupWizard';
import { ShareItYourselfSheet } from '@/features/dashboard/marketing/components/planner/ShareItYourselfSheet';
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
  usePlannerSettings,
  useRefreshPlanBrief,
  useSavePlannerSettings,
} from '@/features/dashboard/marketing/hooks/useMarketingPlan';

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
  const { skip, markPosted, update } = usePlanItemActions();
  const refreshBrief = useRefreshPlanBrief();
  const { setTab } = useMarketingTheme();
  const settings = usePlannerSettings();
  const saveSettings = useSavePlannerSettings();
  const [setupOpen, setSetupOpen] = useState(false);
  const [shareItem, setShareItem] = useState<PlannerItemDto | null>(null);
  const viewed = useRef(false);
  const [openItem, setOpenItem] = useState<PlannerItemDto | null>(null);

  const today = todayManilaYmd();
  const allowed = planGate.allowed;

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return allowed ? all : all.slice(0, SHOWCASE_ITEMS);
  }, [allowed, data?.items]);

  const groups = useMemo(() => groupItemsByDay(items), [items]);

  useEffect(() => {
    if (!settings.isLoading && settings.data === null) setSetupOpen(true);
  }, [settings.isLoading, settings.data]);

  useEffect(() => {
    if (viewed.current || !data) return;
    viewed.current = true;
    captureAppEvent('planner_viewed', { range, itemCount: data.items.length });
  }, [data, range]);

  const handleOpen = (item: PlannerItemDto) => setOpenItem(item);

  const handleOpenEditor = (item: PlannerItemDto) => {
    const target = resolveHandoffTarget(item.format, item.opportunityType);
    const caption = [item.brief.hook, item.brief.message, item.brief.cta]
      .filter((part): part is string => Boolean(part))
      .join('\n\n');
    setPendingPlannerDraft({
      itemId: item.id,
      title: item.title,
      hook: item.brief.hook ?? '',
      message: item.brief.message ?? '',
      cta: item.brief.cta ?? '',
      dates: item.claims.openNights ?? [],
      trackedUrl: item.trackedUrl,
      photoIds: [],
    });
    void navigator.clipboard?.writeText(caption).catch(() => undefined);
    setOpenItem(null);
    setTab(target.tab);
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
            variant="outline"
            onClick={() => setSetupOpen(true)}
            disabled={!allowed}
          >
            Setup
          </Button>
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
                onMarkPosted={(target) => setShareItem(target)}
              />
            ))}
          </div>
        </section>
      ))}

      {data && data.upcoming.length > 0 ? (
        <section className="space-y-1">
          <h3 className="text-section-title text-muted-foreground">Coming up</h3>
          <ul className="space-y-1 text-sm">
            {data.upcoming.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-1">
                <span className="text-muted-foreground">
                  {formatDayHeading(item.scheduledFor?.slice(0, 10) ?? 'unscheduled', today)}
                </span>
                <span>{item.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PlannerSetupWizard
        open={setupOpen}
        onOpenChange={setSetupOpen}
        isSaving={saveSettings.isPending}
        initial={settings.data ?? null}
        onSave={(patch) =>
          saveSettings.mutateAsync(patch).then(
            () => true,
            () => false
          )
        }
      />

      <PlanItemSheet
        open={openItem !== null}
        onOpenChange={(next) => {
          if (!next) setOpenItem(null);
        }}
        item={openItem}
        isSaving={update.isPending}
        isRefreshing={refreshBrief.isPending}
        onRefresh={
          aiGate.allowed
            ? async (target, instruction) =>
                refreshBrief.mutateAsync({ itemId: target.id, instruction }).catch(() => null)
            : undefined
        }
        onOpenEditor={allowed ? handleOpenEditor : undefined}
        onSave={(target, patch) =>
          update.mutateAsync({ itemId: target.id, ...patch }).then(
            () => true,
            () => false
          )
        }
      />

      <ShareItYourselfSheet
        open={shareItem !== null}
        onOpenChange={(next) => {
          if (!next) setShareItem(null);
        }}
        item={shareItem}
        isPosting={markPosted.isPending}
        onPosted={(target, postedUrl) =>
          markPosted.mutate({ itemId: target.id, postedUrl })
        }
      />

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
