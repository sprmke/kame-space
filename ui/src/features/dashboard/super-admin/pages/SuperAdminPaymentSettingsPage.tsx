import { useEffect, useState } from 'react';

import { Wallet } from 'lucide-react';

import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import {
  SuperAdminSettingsCard,
  SuperAdminSettingsRow,
} from '@/features/dashboard/super-admin/components/shared/SuperAdminSettingsCard';
import {
  usePlatformPaymentSettings,
  useUpdatePlatformPaymentSettings,
} from '@/features/dashboard/super-admin/hooks/usePlatformPaymentSettings';

import { SuperAdminSettingsBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';

const RAIL_OPTIONS = [
  { id: 'qrph', label: 'QR Ph' },
  { id: 'paymaya', label: 'Maya' },
  { id: 'dob', label: 'Direct online banking' },
] as const;

export function SuperAdminPaymentSettingsPage() {
  usePageTitle(appPageTitle('Payment settings'));
  const { data, isLoading, error } = usePlatformPaymentSettings();
  const save = useUpdatePlatformPaymentSettings();
  const [methods, setMethods] = useState<string[]>([]);
  const [leadDays, setLeadDays] = useState('5');
  const [graceDays, setGraceDays] = useState('5');
  const [suspensionDays, setSuspensionDays] = useState('30');
  const [ttlHours, setTtlHours] = useState('24');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!data || initialized) return;
    setMethods(data.enabledPaymentMethods ?? []);
    setLeadDays(String(data.renewalLinkLeadDays ?? 5));
    setGraceDays(String(data.gracePeriodDays ?? 5));
    setSuspensionDays(String(data.suspensionCancelDays ?? 30));
    setTtlHours(String(data.pendingCheckoutTtlHours ?? 24));
    setInitialized(true);
  }, [data, initialized]);

  const toggleRail = (rail: string, on: boolean) => {
    setMethods((current) =>
      on ? [...new Set([...current, rail])] : current.filter((value) => value !== rail)
    );
  };

  const input = {
    enabledPaymentMethods: methods,
    renewalLinkLeadDays: Number(leadDays),
    gracePeriodDays: Number(graceDays),
    suspensionCancelDays: Number(suspensionDays),
    pendingCheckoutTtlHours: Number(ttlHours),
  };
  const sameMethods = (a: string[], b: string[]) =>
    a.length === b.length && a.every((value) => b.includes(value));
  const isDirty =
    !!data &&
    initialized &&
    (!sameMethods(methods, data.enabledPaymentMethods ?? []) ||
      input.renewalLinkLeadDays !== Number(data.renewalLinkLeadDays ?? 5) ||
      input.gracePeriodDays !== Number(data.gracePeriodDays ?? 5) ||
      input.suspensionCancelDays !== Number(data.suspensionCancelDays ?? 30) ||
      input.pendingCheckoutTtlHours !== Number(data.pendingCheckoutTtlHours ?? 24));

  const saveSettings = async (): Promise<boolean> => {
    try {
      await save.mutateAsync(input);
      return true;
    } catch {
      return false;
    }
  };

  useUnsavedChangesGuard({ isDirty, onSave: saveSettings });

  return (
    <SuperAdminPage
      title="Payment settings"
      subtitle="Subscription checkout rails and renewal timing for host billing."
      isLoading={isLoading && !data}
      loadingBody={<SuperAdminSettingsBodySkeleton cards={1} titles={['Enabled rails']} />}
      error={error}
      errorMessage="Could not load payment settings."
    >
      <SuperAdminSettingsCard
        title="Enabled rails"
        description="Payment methods offered at subscription checkout."
        icon={<Wallet className="text-muted-foreground size-4" aria-hidden />}
        onSubmit={() => void saveSettings()}
        footer={
          <Button type="submit" className="min-h-[44px]" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <div className="divide-border/60 -my-1 divide-y">
          {RAIL_OPTIONS.map((rail) => (
            <SuperAdminSettingsRow key={rail.id} label={rail.label} htmlFor={`rail-${rail.id}`}>
              <Switch
                id={`rail-${rail.id}`}
                checked={methods.includes(rail.id)}
                onCheckedChange={(on) => toggleRail(rail.id, on)}
                aria-label={rail.label}
              />
            </SuperAdminSettingsRow>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SuperAdminSettingsRow
            stacked
            label="Renewal link lead (days)"
            htmlFor="renewal-lead-days"
            description="How early the renewal link is sent before expiry."
          >
            <Input
              id="renewal-lead-days"
              type="number"
              min={0}
              max={30}
              value={leadDays}
              onChange={(event) => setLeadDays(event.target.value)}
            />
          </SuperAdminSettingsRow>
          <SuperAdminSettingsRow
            stacked
            label="Grace period (days)"
            htmlFor="grace-period-days"
            description="Days after the period end a lapsed subscription keeps every paid feature."
          >
            <Input
              id="grace-period-days"
              type="number"
              min={0}
              max={30}
              value={graceDays}
              onChange={(event) => setGraceDays(event.target.value)}
            />
          </SuperAdminSettingsRow>
          <SuperAdminSettingsRow
            stacked
            label="Suspension window (days)"
            htmlFor="suspension-cancel-days"
            description="Days a suspended subscription waits for payment before it ends and the org moves to Free."
          >
            <Input
              id="suspension-cancel-days"
              type="number"
              min={1}
              max={365}
              value={suspensionDays}
              onChange={(event) => setSuspensionDays(event.target.value)}
            />
          </SuperAdminSettingsRow>
          <SuperAdminSettingsRow
            stacked
            label="Checkout expiry (hours)"
            htmlFor="pending-checkout-ttl"
            description="How long an unpaid checkout link stays payable before it is closed."
          >
            <Input
              id="pending-checkout-ttl"
              type="number"
              min={1}
              max={168}
              value={ttlHours}
              onChange={(event) => setTtlHours(event.target.value)}
            />
          </SuperAdminSettingsRow>
        </div>
      </SuperAdminSettingsCard>
    </SuperAdminPage>
  );
}
