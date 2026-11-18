import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type {
  BillingEventRow,
  BillingLedgerRow,
  BillingTransactionRow,
} from '@/features/dashboard/super-admin/lib/superAdminBillingTimeline';

export type OrgBillingAdminDetail = {
  subscription: {
    id: string;
    planId: string;
    planName: string;
    planCode: string;
    status: string;
    source: string;
    pricePhpSnapshot: number | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    graceEndsAt: string | null;
    suspendedAt: string | null;
    cancelAtPeriodEnd: boolean;
    scheduledPlanId: string | null;
    scheduledChangeAt: string | null;
    priceOverridePhp: number | null;
  } | null;
  recentEvents: BillingEventRow[];
  transactions: BillingTransactionRow[];
  ledger: BillingLedgerRow[];
  ledgerBalancePhp: number;
};

const key = (orgId: string) => ['super-admin', 'org-billing', orgId] as const;

export function useOrgBillingAdmin(orgId: string | null) {
  return useQuery({
    queryKey: key(orgId ?? ''),
    enabled: Boolean(orgId),
    queryFn: () =>
      callEdgeFunction<OrgBillingAdminDetail>(
        `org-subscriptions-admin?organizationId=${encodeURIComponent(orgId!)}`
      ),
  });
}

export type OrgBillingAdminAction =
  | { action: 'clear_intent' }
  | { action: 'cancel_at_period_end' }
  | { action: 'apply_intent_now'; note?: string }
  | { action: 'cancel_now'; note?: string }
  | { action: 'adjust_credit'; creditPhp: number; note: string }
  | { action: 'record_refund'; transactionId: string; note?: string }
  | {
      action: 'resolve_payment';
      transactionId: string;
      resolution: 'apply' | 'keep_credit';
      note?: string;
    }
  | { action: 'extend_period'; periodEnd: string; status?: string; note?: string };

const SUCCESS_COPY: Record<OrgBillingAdminAction['action'], string> = {
  clear_intent: 'Scheduled change removed',
  cancel_at_period_end: 'Plan will end at the period end',
  apply_intent_now: 'Scheduled change applied',
  cancel_now: 'Organization moved to Free',
  adjust_credit: 'Account credit adjusted',
  record_refund: 'Refund recorded',
  resolve_payment: 'Payment resolved',
  extend_period: 'Billing period extended',
};

export function useOrgBillingAdminAction(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OrgBillingAdminAction) =>
      callEdgeFunction('org-subscriptions-admin', {
        method: 'PATCH',
        body: JSON.stringify({ ...input, organizationId: orgId }),
      }),
    onSuccess: async (_data, input) => {
      if (orgId) await qc.invalidateQueries({ queryKey: key(orgId) });
      await qc.invalidateQueries({ queryKey: ['super-admin'] });
      toast.success(SUCCESS_COPY[input.action]);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'That did not work');
    },
  });
}
