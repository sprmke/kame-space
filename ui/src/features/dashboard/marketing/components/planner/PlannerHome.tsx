import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { MarketingPlannerSkeleton } from '@/components/skeletons/AdminSkeletons';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { MarketingOverflowMenu } from '@/features/dashboard/marketing/components/shared/MarketingOverflowMenu';
import { captureAppEvent } from '@/lib/posthog/capture';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import {
  resolveHandoffTarget,
  setPendingPlannerDraft,
} from '@/features/dashboard/marketing/lib/planner/plannerHandoff';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';
import {
  normalizeGallery,
  suggestPlannerPhotos,
} from '@/features/dashboard/marketing/lib/planner/plannerPhotos';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { PlanItemCard } from '@/features/dashboard/marketing/components/planner/PlanItemCard';
import { PlanItemSheet } from '@/features/dashboard/marketing/components/planner/PlanItemSheet';
import { PlannerSetupWizard } from '@/features/dashboard/marketing/components/planner/PlannerSetupWizard';
import { PrepareWeekDialog } from '@/features/dashboard/marketing/components/planner/PrepareWeekDialog';
import { ShareItYourselfSheet } from '@/features/dashboard/marketing/components/planner/ShareItYourselfSheet';
import type { PlannerItemDto } from '@/features/dashboard/marketing/lib/planner/plannerApi';
import { setPlannerOpen } from '@/features/dashboard/marketing/lib/planner/plannerRoute';
import {
  PLANNER_RANGES,
  RANGE_LABELS,
  formatDayHeading,
  groupItemsByDay,
  normalizePlannerRange,
  type PlannerRange,
} from '@/features/dashboard/marketing/lib/planner/plannerRange';
import {
  useGeneratePlan,
  useMarketingPlan,
  usePlanItemActions,
  usePlannerSettings,
  usePrepareWeek,
  useRefreshPlanBrief,
  useSavePlannerSettings,
} from '@/features/dashboard/marketing/hooks/useMarketingPlan';

const SHOWCASE_ITEMS = 3;

const RANGE_OPTIONS = PLANNER_RANGES.map((value) => ({
  value,
  label: RANGE_LABELS[value],
}));

function todayManilaYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export function PlannerHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = normalizePlannerRange(searchParams.get('range'));
  const setRange = (next: PlannerRange) => {
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
  const { property } = useOrgContext();
  const listing = usePublicPropertyDetail(property.slug);
  const { setTab, startAiSession } = useMarketingTheme();
  const settings = usePlannerSettings();
  const saveSettings = useSavePlannerSettings();
  const [setupOpen, setSetupOpen] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState(false);
  const prepareWeek = usePrepareWeek();
  const [shareItem, setShareItem] = useState<PlannerItemDto | null>(null);
  const viewed = useRef(false);
  const [openItem, setOpenItem] = useState<PlannerItemDto | null>(null);

  const today = todayManilaYmd();
  const allowed = planGate.allowed;
  const needsSetup = allowed && settings.isSuccess && settings.data === null;

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return allowed ? all : all.slice(0, SHOWCASE_ITEMS);
  }, [allowed, data?.items]);

  const groups = useMemo(() => groupItemsByDay(items), [items]);
  const hasItems = groups.length > 0;

  const gallery = useMemo(
    () => normalizeGallery(listing.data?.images ?? []),
    [listing.data?.images]
  );
  const usedPhotoUrls = useMemo(() => {
    const used = new Set<string>();
    for (const item of data?.items ?? []) {
      for (const url of item.brief.photoUrls ?? []) used.add(url);
    }
    return used;
  }, [data?.items]);

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
      rateFrom: item.claims.rateFrom ?? null,
      photoUrls: item.brief.photoUrls ?? [],
    });
    void navigator.clipboard?.writeText(caption).catch(() => undefined);
    setOpenItem(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        setPlannerOpen(next, false);
        return next;
      },
      { replace: true }
    );
    if (target.tab === 'generate') startAiSession(target.output ?? 'post', { replace: true });
    else setTab(target.tab);
  };

  const overflowItems = [
    {
      id: 'setup',
      label: 'Goals & channels',
      onSelect: () => setSetupOpen(true),
    },
    {
      id: 'prepare',
      label: 'Prepare week',
      onSelect: () => setPrepareOpen(true),
    },
  ];
  if (!aiGate.allowed && !aiGate.isLoading) {
    overflowItems.push({
      id: 'ai-upgrade',
      label: 'AI plan',
      onSelect: () => openUpgradeModal('aiMarketingPlanner'),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {!needsSetup ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <SegmentedControl
              value={range}
              onChange={setRange}
              options={RANGE_OPTIONS}
              size="dense"
              equalSegments
              fullWidth
              aria-label="Plan range"
              className="min-w-0 flex-1"
            />
            {allowed ? (
              <MarketingOverflowMenu
                label="Plan options"
                icon="horizontal"
                forceSheet
                menuItems={overflowItems}
              />
            ) : null}
          </div>
          <Button
            className="w-full sm:w-auto sm:self-start"
            disabled={!allowed || generate.isPending || needsSetup}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? 'Building…' : hasItems ? 'Rebuild plan' : 'Build plan'}
          </Button>
        </div>
      ) : null}

      {needsSetup ? (
        <div className="border-border space-y-3 rounded-xl border bg-muted/30 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Set your goals</p>
            <p className="text-caption text-muted-foreground">
              Choose what to fill, where you post, and how often. Then build this week.
            </p>
          </div>
          <Button size="sm" onClick={() => setSetupOpen(true)}>
            Continue
          </Button>
        </div>
      ) : null}

      {isLoading ? <MarketingPlannerSkeleton /> : null}

      {!isLoading && data?.summary ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{data.summary}</p>
      ) : null}

      {isError ? (
        <p className="text-sm text-destructive">
          {(error as Error | null)?.message || 'Could not load the plan'}
        </p>
      ) : null}

      {!isLoading && !isError && !needsSetup && !hasItems ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No posts planned yet.</p>
          <Button
            size="sm"
            disabled={!allowed || generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? 'Building…' : 'Build plan'}
          </Button>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.day} className="space-y-2">
          <h3 className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
            {formatDayHeading(group.day, today)}
          </h3>
          <ul className="space-y-2">
            {group.items.map((item) => (
              <li key={item.id}>
                <PlanItemCard
                  item={item}
                  day={group.day}
                  today={today}
                  readOnly={!allowed}
                  onOpen={handleOpen}
                  onSkip={(target) => skip.mutate({ itemId: target.id, reason: 'Not this week' })}
                  onOpenEditor={allowed ? handleOpenEditor : undefined}
                  onMarkPosted={(target) => setShareItem(target)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {data && data.upcoming.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
            Later
          </h3>
          <ul className="space-y-1.5 text-sm">
            {data.upcoming.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-muted-foreground">
                  {formatDayHeading(item.scheduledFor?.slice(0, 10) ?? 'unscheduled', today)}
                </span>
                <span className="font-medium">{item.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PrepareWeekDialog
        open={prepareOpen}
        onOpenChange={setPrepareOpen}
        range={range}
        today={today}
        itemCount={
          items.filter(
            (item) => !['preparing', 'ready', 'published', 'posted_manually'].includes(item.status)
          ).length
        }
        isPreparing={prepareWeek.isPending}
        onConfirm={(window) =>
          prepareWeek.mutateAsync(window).then(
            () => true,
            () => false
          )
        }
      />

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
        photoOptions={suggestPlannerPhotos(gallery, usedPhotoUrls)}
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
        onPosted={(target, postedUrl) => markPosted.mutate({ itemId: target.id, postedUrl })}
      />

      {!allowed && !planGate.isLoading && (data?.items.length ?? 0) > 0 ? (
        <div className="border-border flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/20 p-4">
          <p className="text-sm">Full plan is on Pro and above.</p>
          <Button size="sm" onClick={() => openUpgradeModal('marketingPlanner')}>
            View plans
          </Button>
        </div>
      ) : null}
    </div>
  );
}
