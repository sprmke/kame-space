import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  changeOrgSubscriptionPlan,
  createOrgPlanCheckout,
  fetchOrgPlan,
  OrgBillingApiError,
  previewAddPropertyBilling,
  previewOrgPlanChange,
  saveOrgBillingDetails,
  type CreateOrgPlanCheckoutInput,
  type OrgBillingDetailsDto,
  type OrgSubscriptionChangeAction,
} from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  isOrgPlanCheckoutWatchExpired,
  readOrgPlanCheckoutSession,
} from '@/features/dashboard/plans/lib/orgPlanCheckoutSession';

export const orgPlanQueryKey = (orgId: string) => ['org', orgId, 'plan'] as const;

type UseOrgPlanOptions = {
  /** Poll while this browser has a PayMongo checkout in flight (the webhook is on its way). */
  pollWhileCheckoutPending?: boolean;
};

/** Refresh everything a plan change can alter: the plan, org data and every entitlement read. */
export async function invalidateOrgBilling(queryClient: QueryClient, orgId: string): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: orgPlanQueryKey(orgId) });
  await queryClient.invalidateQueries({ queryKey: ['org', orgId] });
  await queryClient.invalidateQueries({ queryKey: ['property'] });
  await queryClient.invalidateQueries({
    predicate: (query) => Array.isArray(query.queryKey) && query.queryKey.includes('entitlements'),
  });
}

/** `orgId` is explicit (not read from route context) — this page renders org-only routes,
 * which don't populate the property-scoped org context `useOrgIdParam()` relies on. */
export function useOrgPlan(orgId: string | null, options?: UseOrgPlanOptions) {
  return useQuery({
    queryKey: orgPlanQueryKey(orgId ?? ''),
    queryFn: () => fetchOrgPlan(orgId!),
    enabled: Boolean(orgId),
    staleTime: 60_000,
    refetchInterval: () => {
      if (!options?.pollWhileCheckoutPending || !orgId) return false;
      // Only this browser's own in-flight checkout is polled. An abandoned checkout left open on
      // another device or an old tab never keeps the page polling the server.
      const session = readOrgPlanCheckoutSession(orgId);
      if (session && !isOrgPlanCheckoutWatchExpired(session)) return 3_000;
      return false;
    },
  });
}

export function useCreateOrgPlanCheckout(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrgPlanCheckoutInput = {}) => createOrgPlanCheckout(orgId!, input),
    onSuccess: async (result) => {
      if (orgId) await invalidateOrgBilling(queryClient, orgId);
      if (result.paidWithCredit) {
        toast.success('Plan updated using your account credit');
      }
    },
    onError: (error: Error) => {
      // The review dialog handles a changed price itself, with the new amount on screen.
      if (error instanceof OrgBillingApiError && error.code === 'price_changed') return;
      toast.error(error.message || 'Could not start checkout');
    },
  });
}

const CHANGE_SUCCESS_COPY: Record<OrgSubscriptionChangeAction['action'], string> = {
  schedule_downgrade: 'Plan change scheduled',
  cancel_at_period_end: 'Plan will end at the period end',
  clear_intent: 'Plan kept',
  cancel_now: 'Moved to Free',
};

/** Schedule a downgrade or a cancel for the period end, undo it, or leave an overdue plan. */
export function useChangeOrgSubscriptionPlan(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (change: OrgSubscriptionChangeAction) => changeOrgSubscriptionPlan(orgId!, change),
    onSuccess: async (_result, change) => {
      if (orgId) await invalidateOrgBilling(queryClient, orgId);
      toast.success(CHANGE_SUCCESS_COPY[change.action]);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not change plan');
    },
  });
}

/** Server quote for a plan change. Re-fetched each time the review dialog opens. */
export function usePayPlanPreview(orgId: string | null, planId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['org', orgId, 'plan-preview', 'pay', planId],
    queryFn: () => previewOrgPlanChange(orgId!, 'pay', planId),
    enabled: enabled && Boolean(orgId) && Boolean(planId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useSchedulePlanPreview(
  orgId: string | null,
  kind: 'schedule' | 'cancel',
  planId: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['org', orgId, 'plan-preview', kind, planId],
    queryFn: () => previewOrgPlanChange(orgId!, kind, planId),
    enabled: enabled && Boolean(orgId) && (kind === 'cancel' || Boolean(planId)),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/** Server preview of what adding a property does to the bill. Fresh each time the dialog opens. */
export function useAddPropertyPreview(orgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['org', orgId, 'plan-preview', 'add_property'],
    queryFn: () => previewAddPropertyBilling(orgId!),
    enabled: enabled && Boolean(orgId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useSaveOrgBillingDetails(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (details: Omit<OrgBillingDetailsDto, 'updatedAt'>) =>
      saveOrgBillingDetails(orgId!, details),
    onSuccess: async () => {
      if (orgId) await queryClient.invalidateQueries({ queryKey: orgPlanQueryKey(orgId) });
      toast.success('Billing details saved');
    },
  });
}
