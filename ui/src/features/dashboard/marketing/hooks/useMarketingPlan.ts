import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import {
  fetchMarketingPlan,
  generateMarketingPlan,
  markPlannerItemPosted,
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

export function useGeneratePlan() {
  const propertyId = usePropertyIdParam();
  const invalidate = usePlanInvalidation();
  return useMutation({
    mutationFn: () => generateMarketingPlan(propertyId),
    onSuccess: (result) => {
      invalidate();
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
      toast.success('Item skipped');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not skip the item'),
  });

  const markPosted = useMutation({
    mutationFn: (input: { itemId: string; postedUrl?: string }) =>
      markPlannerItemPosted(propertyId, input.itemId, input.postedUrl),
    onSuccess: () => {
      invalidate();
      toast.success('Marked as posted');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not mark the item'),
  });

  const reschedule = useMutation({
    mutationFn: (input: { itemId: string; scheduledFor: string }) =>
      updatePlannerItem(propertyId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Rescheduled');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not reschedule'),
  });

  return { skip, markPosted, reschedule };
}

export function useSavePlannerSettings() {
  const propertyId = usePropertyIdParam();
  const invalidate = usePlanInvalidation();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => savePlannerSettings(propertyId, patch),
    onSuccess: () => {
      invalidate();
      toast.success('Saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not save'),
  });
}
