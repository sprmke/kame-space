import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type PlatformPaymentSettings = {
  enabledPaymentMethods: string[];
  enabledBanks: string[];
  renewalLinkLeadDays: number;
  gracePeriodDays: number;
  suspensionCancelDays: number;
  pendingCheckoutTtlHours: number;
  updatedAt?: string;
};

const PAYMENT_SETTINGS_KEY = ['super-admin', 'platform-payment-settings'] as const;

export function usePlatformPaymentSettings() {
  return useQuery({
    queryKey: PAYMENT_SETTINGS_KEY,
    queryFn: () =>
      callEdgeFunction<{ settings: PlatformPaymentSettings }>('platform-payment-settings').then(
        (data) => data.settings
      ),
  });
}

export function useUpdatePlatformPaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PlatformPaymentSettings>) =>
      callEdgeFunction<{ settings: PlatformPaymentSettings }>('platform-payment-settings', {
        method: 'PUT',
        body: JSON.stringify(input),
      }).then((data) => data.settings),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PAYMENT_SETTINGS_KEY });
      toast.success('Payment settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not save settings');
    },
  });
}

export function useRunPlatformBillingCron() {
  return useMutation({
    mutationFn: () =>
      callEdgeFunction<{ result: Record<string, number> }>('org-subscriptions-admin', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'run_billing_cron' }),
      }).then((data) => data.result),
    onSuccess: (result) => {
      const part = (count: number | undefined, label: string) =>
        count ? `${count} ${label}` : null;
      const summary = [
        part(result.renewalLinks, 'renewal links'),
        part(result.reminders, 'reminders'),
        part(result.scheduledApplied, 'plan changes applied'),
        part(result.renewedFromCredit, 'renewed from credit'),
        part(result.pastDue, 'past due'),
        part(result.suspended, 'suspended'),
        part(result.canceled, 'ended'),
        part(result.paymentsRecovered, 'payments recovered'),
        part(result.errors, 'errors'),
      ].filter(Boolean);
      toast.success(
        summary.length > 0 ? `Billing run: ${summary.join(', ')}` : 'Billing run: nothing was due'
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Cron failed');
    },
  });
}
