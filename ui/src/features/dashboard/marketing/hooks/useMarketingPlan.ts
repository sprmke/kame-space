import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { captureAppEvent } from '@/lib/posthog/capture';
import {
  fetchMarketingPlan,
  fetchPlannerSettings,
  prepareWeekBatch,
  generateMarketingPlan,
  markPlannerItemPosted,
  refreshPlannerBrief,
  savePlannerSettings,
  skipPlannerItem,
  updatePlannerItem,
} from '@/features/dashboard/marketing/lib/planner/plannerApi';
import type { PlannerRange } from '@/features/dashboard/marketing/lib/planner/plannerRange';

export const marketingPlanQueryKey = (propertyId: string | null, range: PlannerRange) =>
  ['marketing-plan', propertyId, range] as const;

export function useMarketingPlan(range: PlannerRange) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: marketingPlanQueryKey(propertyId, range),
    queryFn: () => fetchMarketingPlan(propertyId, range),
    enabled: Boolean(propertyId),
    staleTime: 30_000,
  });
}

function usePlanInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['marketing-plan'] });
}

export function usePlannerSettings() {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: ['marketing-planner-settings', propertyId],
    queryFn: () => fetchPlannerSettings(propertyId),
    enabled: Boolean(propertyId),
    staleTime: 60_000,
  });
}

export function useGeneratePlan() {
  const propertyId = usePropertyIdParam();
  const invalidate = usePlanInvalidation();
  return useMutation({
    mutationFn: () => generateMarketingPlan(propertyId),
    onSuccess: (result) => {
      invalidate();
      captureAppEvent('plan_generated', {
        mode: 'rules',
        created: result.created,
        skipped: result.skipped,
      });
      toast.success(
        result.created > 0 ? `${result.created} items planned` : 'Your plan is up to date'
      );
    },
    onError: (error: Error) => toast.error(error.message || 'Could not build the plan'),
  });
}

export function usePlanItemActions() {
  const propertyId = usePropertyIdParam();
  const invalidate = usePlanInvalidation();

  const skip = useMutation({
    mutationFn: (input: { itemId: string; reason: string }) =>
      skipPlannerItem(propertyId, input.itemId, input.reason),
    onSuccess: () => {
      invalidate();
      captureAppEvent('planner_item_skipped');
      toast.success('Item skipped');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not skip the item'),
  });

  const markPosted = useMutation({
    mutationFn: (input: { itemId: string; postedUrl?: string }) =>
      markPlannerItemPosted(propertyId, input.itemId, input.postedUrl),
    onSuccess: () => {
      invalidate();
      captureAppEvent('planner_item_completed', { channel: 'manual' });
      toast.success('Marked as posted');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not mark the item'),
  });

  const update = useMutation({
    mutationFn: (input: {
      itemId: string;
      scheduledFor?: string;
      format?: string;
      title?: string;
      brief?: Record<string, unknown>;
    }) => updatePlannerItem(propertyId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not save the item'),
  });

  return { skip, markPosted, update };
}

export function usePrepareWeek() {
  const propertyId = usePropertyIdParam();
  const invalidate = usePlanInvalidation();
  return useMutation({
    mutationFn: (input: { from: string; to: string; limit?: number }) =>
      prepareWeekBatch(propertyId, input),
    onSuccess: (result) => {
      invalidate();
      captureAppEvent('plan_generated', {
        mode: 'prepare',
        created: result.queued.length,
        skipped: result.skipped,
      });
      toast.success(
        result.queued.length > 0
          ? `${result.queued.length} items ready to prepare`
          : 'Nothing to prepare in that range'
      );
    },
    onError: (error: Error) => toast.error(error.message || 'Could not start preparing'),
  });
}

export function useRefreshPlanBrief() {
  const propertyId = usePropertyIdParam();
  const invalidate = usePlanInvalidation();
  return useMutation({
    mutationFn: (input: { itemId: string; instruction: 'shorter' | 'playful' | 'taglish' }) =>
      refreshPlannerBrief(propertyId, input.itemId, input.instruction),
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message || 'Could not rewrite the item'),
  });
}

export function useSavePlannerSettings() {
  const propertyId = usePropertyIdParam();
  const invalidate = usePlanInvalidation();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => savePlannerSettings(propertyId, patch),
    onSuccess: () => {
      invalidate();
      captureAppEvent('planner_onboarded');
      toast.success('Saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not save'),
  });
}
