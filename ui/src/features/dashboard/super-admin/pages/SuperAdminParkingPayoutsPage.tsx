import { useEffect, useMemo, useState } from 'react';

import { Wallet } from 'lucide-react';

import { computeParkingBookingBreakdown } from '@/features/dashboard/parking/lib/parkingPayout';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import {
  SuperAdminSettingsCard,
  SuperAdminSettingsRow,
} from '@/features/dashboard/super-admin/components/shared/SuperAdminSettingsCard';
import {
  type ParkingPayoutStatusFilter,
  type ParkingPayoutTransaction,
  useMarkParkingPayoutDisbursed,
  useParkingPayouts,
  usePlatformParkingSettings,
  useRecordParkingPayoutClawback,
  useRecordParkingPayoutRefund,
  useUpdatePlatformParkingSettings,
} from '@/features/dashboard/super-admin/hooks/usePlatformParkingSettings';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { SectionContentSkeleton } from '@/components/skeletons/AdminSkeletons';
import {
  SuperAdminAdminListBodySkeleton,
  SuperAdminSettingsBodySkeleton,
} from '@/components/skeletons/SuperAdminSkeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveModalTrigger } from '@/components/ui/responsive-modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

function formatPhp(value: number): string {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function payoutEligibleLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function MarkDisbursedDialog({ transaction }: { transaction: ParkingPayoutTransaction }) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [eligibilityNote, setEligibilityNote] = useState('');
  const markDisbursed = useMarkParkingPayoutDisbursed();
  const held = transaction.payoutEligible === false;
  const canConfirm = !held || eligibilityNote.trim().length > 0;

  const submitDisbursement = async (): Promise<boolean> => {
    try {
      await markDisbursed.mutateAsync({
        transactionId: transaction.id,
        reference: reference.trim() || undefined,
        overrideEligibility: held || undefined,
        eligibilityNote: held ? eligibilityNote.trim() : undefined,
      });
    } catch {
      return false;
    }
    setOpen(false);
    setReference('');
    setEligibilityNote('');
    return true;
  };

  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open,
    onOpenChange: setOpen,
    isDirty: reference.trim() !== '' || eligibilityNote.trim() !== '',
    onSave: submitDisbursement,
    onDiscard: () => {
      setReference('');
      setEligibilityNote('');
    },
  });

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title="Mark payout as disbursed"
        description={`Confirms ${formatPhp(transaction.hostNetTotal)} was manually paid out to the host for this booking. Reference is optional (e.g. bank transfer/GCash reference number).`}
        trigger={
          <ResponsiveModalTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]">
              {held ? 'Review payout' : 'Mark disbursed'}
            </Button>
          </ResponsiveModalTrigger>
        }
        footer={
          <Button
            type="button"
            className="min-h-[44px]"
            disabled={markDisbursed.isPending || !canConfirm}
            onClick={() => void submitDisbursement()}
          >
            {held ? 'Disburse early' : 'Confirm disbursed'}
          </Button>
        }
      >
        <div className="space-y-3">
          {held ? (
            <div className="border-warning/40 bg-warning/10 text-foreground space-y-1.5 rounded-xl border p-3 text-xs">
              <p className="font-medium">Payout held</p>
              <p>
                {transaction.payoutEligibleAt
                  ? `Eligible ${payoutEligibleLabel(transaction.payoutEligibleAt)} (24 hours after the parking start).`
                  : 'The parking start date is missing, so the payout is held for review.'}
              </p>
            </div>
          ) : null}
          {held ? (
            <div className="space-y-1.5">
              <Label htmlFor="eligibility-note">Why disburse early?</Label>
              <Textarea
                id="eligibility-note"
                value={eligibilityNote}
                rows={2}
                onChange={(event) => setEligibilityNote(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="disbursement-reference">Reference (optional)</Label>
            <Input
              id="disbursement-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}

function RecordClawbackDialog({ transaction }: { transaction: ParkingPayoutTransaction }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const recordClawback = useRecordParkingPayoutClawback();

  const submitClawback = async (): Promise<boolean> => {
    if (!amount || !reason.trim()) return false;
    try {
      await recordClawback.mutateAsync({
        transactionId: transaction.id,
        amount: Number(amount),
        reason: reason.trim(),
      });
    } catch {
      return false;
    }
    setOpen(false);
    setAmount('');
    setReason('');
    return true;
  };

  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open,
    onOpenChange: setOpen,
    isDirty: amount !== '' || reason !== '',
    onSave: submitClawback,
    onDiscard: () => {
      setAmount('');
      setReason('');
    },
  });

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title="Record a clawback"
        description="Audit trail only (e.g. a chargeback after disbursement). No automated collection happens here."
        trigger={
          <ResponsiveModalTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]">
              Record clawback
            </Button>
          </ResponsiveModalTrigger>
        }
        footer={
          <Button
            type="button"
            variant="destructive"
            disabled={recordClawback.isPending || !amount || !reason.trim()}
            className="min-h-[44px]"
            onClick={() => void submitClawback()}
          >
            Confirm clawback
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="clawback-amount">Amount (₱)</Label>
            <Input
              id="clawback-amount"
              type="number"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clawback-reason">Reason</Label>
            <Textarea
              id="clawback-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}

function RecordRefundDialog({ transaction }: { transaction: ParkingPayoutTransaction }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(transaction.guestChargeTotal));
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const recordRefund = useRecordParkingPayoutRefund();

  const submitRefund = async (): Promise<boolean> => {
    if (!amount || !reference.trim() || !reason.trim()) return false;
    try {
      await recordRefund.mutateAsync({
        transactionId: transaction.id,
        amount: Number(amount),
        reference: reference.trim(),
        reason: reason.trim(),
      });
    } catch {
      return false;
    }
    setOpen(false);
    return true;
  };

  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open,
    onOpenChange: setOpen,
    isDirty: amount !== '' || reference !== '' || reason !== '',
    onSave: submitRefund,
    onDiscard: () => {
      setAmount(String(transaction.guestChargeTotal));
      setReference('');
      setReason('');
    },
  });

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title="Record a guest refund"
        description="Record a refund you issued in the PayMongo dashboard. This closes the refund review; it does not move money."
        trigger={
          <ResponsiveModalTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]">
              Record refund
            </Button>
          </ResponsiveModalTrigger>
        }
        footer={
          <Button
            type="button"
            disabled={recordRefund.isPending || !amount || !reference.trim() || !reason.trim()}
            className="min-h-[44px]"
            onClick={() => void submitRefund()}
          >
            Confirm refund
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Amount (₱)</Label>
            <Input
              id="refund-amount"
              type="number"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reference">PayMongo reference</Label>
            <Input
              id="refund-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}

const PREVIEW_RATES = [100, 300, 1000] as const;

type PreviewSettings = {
  commissionPct: number;
  directCommissionPct: number;
  guestFeePct: number;
  guestFeeFixed: number;
  paymentFeePct: number;
  paymentFeeFixed: number;
};

/** True when a config loses money at the 100 minimum or at a very high rate. */
function losesMoney(settings: PreviewSettings): boolean {
  return [100, 100_000].some((rate) =>
    [settings.commissionPct, settings.directCommissionPct].some(
      (commissionPct) =>
        computeParkingBookingBreakdown({
          hostGrossTotal: rate,
          ...settings,
          commissionPct,
        }).platformNetTotal < 0
    )
  );
}

function ParkingSettlementPreview({ settings }: { settings: PreviewSettings }) {
  const [hostRate, setHostRate] = useState('300');
  const hostGross = Number(hostRate) || 0;

  const standard = useMemo(
    () => computeParkingBookingBreakdown({ hostGrossTotal: hostGross, ...settings }),
    [hostGross, settings]
  );
  const loss = useMemo(() => losesMoney(settings), [settings]);

  const rows: Array<{ label: string; value: number; tone?: 'muted' | 'strong' }> = [
    { label: 'Host rate', value: standard.hostGross, tone: 'muted' },
    { label: 'Guest fee', value: standard.guestFee, tone: 'muted' },
    { label: 'Guest pays', value: standard.guestCharge, tone: 'strong' },
    {
      label: `Commission (${Math.round(settings.commissionPct * 1000) / 10}%)`,
      value: -standard.commissionAmount,
      tone: 'muted',
    },
    { label: 'Host receives', value: standard.hostNet, tone: 'strong' },
    { label: 'Processor fee (est.)', value: -standard.paymentFeeAmount, tone: 'muted' },
    { label: 'Platform net', value: standard.platformNetTotal, tone: 'strong' },
  ];

  return (
    <div className="border-border/60 bg-muted/20 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Booking example (1 night)</p>
        <div className="flex items-center gap-2">
          <Label htmlFor="parking-example-host-rate" className="text-muted-foreground text-xs">
            Host rate
          </Label>
          <Input
            id="parking-example-host-rate"
            type="number"
            min={0}
            step={1}
            value={hostRate}
            onChange={(event) => setHostRate(event.target.value)}
            className="h-9 w-24 text-sm tabular-nums"
          />
        </div>
      </div>
      <dl className="mt-3 grid gap-1 text-xs sm:grid-cols-2 sm:gap-x-6">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt
              className={
                row.tone === 'strong' ? 'text-foreground font-medium' : 'text-muted-foreground'
              }
            >
              {row.label}
            </dt>
            <dd
              className={cn(
                'tabular-nums',
                row.tone === 'strong' ? 'text-foreground font-semibold' : 'text-foreground'
              )}
            >
              {row.value < 0 ? '-' : ''}
              {formatPhp(Math.abs(row.value))}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <caption className="text-muted-foreground pb-1 text-left">
            Platform net per booking
          </caption>
          <thead>
            <tr className="text-muted-foreground text-left">
              <th className="py-1 pr-3 font-normal">Host rate</th>
              <th className="py-1 pr-3 font-normal">Standard</th>
              <th className="py-1 font-normal">Direct link</th>
            </tr>
          </thead>
          <tbody>
            {PREVIEW_RATES.map((rate) => {
              const std = computeParkingBookingBreakdown({ hostGrossTotal: rate, ...settings });
              const direct = computeParkingBookingBreakdown({
                hostGrossTotal: rate,
                ...settings,
                commissionPct: settings.directCommissionPct,
              });
              return (
                <tr key={rate} className="border-border/40 border-t">
                  <td className="py-1 pr-3">{formatPhp(rate)}</td>
                  <td className={cn('py-1 pr-3', std.platformNetTotal < 0 && 'text-destructive')}>
                    {formatPhp(std.platformNetTotal)}
                  </td>
                  <td className={cn('py-1', direct.platformNetTotal < 0 && 'text-destructive')}>
                    {formatPhp(direct.platformNetTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loss ? (
        <p role="alert" className="text-destructive mt-2 text-xs">
          These settings lose money on some bookings. Raise the guest fee or the commission. Saving
          is blocked until every rate from ₱100 up is profitable.
        </p>
      ) : null}
    </div>
  );
}

function ParkingSettingsCard() {
  const { data, isLoading, error } = usePlatformParkingSettings();
  const save = useUpdatePlatformParkingSettings();
  const [commissionPct, setCommissionPct] = useState('10');
  const [directCommissionPct, setDirectCommissionPct] = useState('5');
  const [guestFeePct, setGuestFeePct] = useState('5');
  const [guestFeeFixed, setGuestFeeFixed] = useState('15');
  const [paymentFeePct, setPaymentFeePct] = useState('3.125');
  const [paymentFeeFixed, setPaymentFeeFixed] = useState('15');
  const [escalationPhone, setEscalationPhone] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!data || initialized) return;
    setCommissionPct(String(Math.round(data.commissionPct * 1000) / 10));
    setDirectCommissionPct(String(Math.round(data.directCommissionPct * 1000) / 10));
    setGuestFeePct(String(Math.round(data.guestFeePct * 1000) / 10));
    setGuestFeeFixed(String(data.guestFeeFixed));
    setPaymentFeePct(String(Math.round(data.paymentFeePct * 10000) / 100));
    setPaymentFeeFixed(String(data.paymentFeeFixed));
    setEscalationPhone(data.supportEscalationPhone ?? '');
    setInitialized(true);
  }, [data, initialized]);

  const settingsInput = {
    commissionPct: Number(commissionPct) / 100,
    directCommissionPct: Number(directCommissionPct) / 100,
    guestFeePct: Number(guestFeePct) / 100,
    guestFeeFixed: Number(guestFeeFixed),
    paymentFeePct: Number(paymentFeePct) / 100,
    paymentFeeFixed: Number(paymentFeeFixed),
    supportEscalationPhone: escalationPhone.trim(),
  };
  const isDirty =
    !!data &&
    initialized &&
    (commissionPct !== String(Math.round(data.commissionPct * 1000) / 10) ||
      directCommissionPct !== String(Math.round(data.directCommissionPct * 1000) / 10) ||
      guestFeePct !== String(Math.round(data.guestFeePct * 1000) / 10) ||
      guestFeeFixed !== String(data.guestFeeFixed) ||
      paymentFeePct !== String(Math.round(data.paymentFeePct * 10000) / 100) ||
      paymentFeeFixed !== String(data.paymentFeeFixed) ||
      escalationPhone.trim() !== (data.supportEscalationPhone ?? '').trim());

  const saveSettings = async (): Promise<boolean> => {
    try {
      await save.mutateAsync(settingsInput);
      return true;
    } catch {
      return false;
    }
  };

  useUnsavedChangesGuard({ isDirty, onSave: saveSettings });

  if (isLoading && !data)
    return <SuperAdminSettingsBodySkeleton cards={1} titles={['Commission, guest fee & margin']} />;
  if (error) return <p className="text-destructive text-sm">Could not load parking settings.</p>;

  return (
    <SuperAdminSettingsCard
      title="Commission, guest fee & margin"
      description="Hosts set their own rate. Guests pay it plus the guest fee. Hosts are paid their rate minus commission. The processor fee estimates what the payment provider keeps. Changes apply to new bookings only."
      icon={<Wallet className="text-muted-foreground size-4" aria-hidden />}
      onSubmit={() => void saveSettings()}
      footer={
        <Button type="submit" className="min-h-[44px]" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      {isLoading && !data ? (
        <SectionContentSkeleton rows={6} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SuperAdminSettingsRow stacked label="Commission (%)" htmlFor="commission-pct">
              <Input
                id="commission-pct"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={commissionPct}
                onChange={(event) => setCommissionPct(event.target.value)}
              />
            </SuperAdminSettingsRow>
            <SuperAdminSettingsRow
              stacked
              label="Direct-link commission (%)"
              htmlFor="direct-commission-pct"
            >
              <Input
                id="direct-commission-pct"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={directCommissionPct}
                onChange={(event) => setDirectCommissionPct(event.target.value)}
              />
            </SuperAdminSettingsRow>
            <SuperAdminSettingsRow
              stacked
              label="Guest fee (%)"
              htmlFor="guest-fee-pct"
              description="Added on top of the host rate."
            >
              <Input
                id="guest-fee-pct"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={guestFeePct}
                onChange={(event) => setGuestFeePct(event.target.value)}
              />
            </SuperAdminSettingsRow>
            <SuperAdminSettingsRow
              stacked
              label="Guest fee fixed (₱)"
              htmlFor="guest-fee-fixed"
              description="Per booking, not per night."
            >
              <Input
                id="guest-fee-fixed"
                type="number"
                min={0}
                step={0.01}
                value={guestFeeFixed}
                onChange={(event) => setGuestFeeFixed(event.target.value)}
              />
            </SuperAdminSettingsRow>
            <SuperAdminSettingsRow
              stacked
              label="Processor fee (%)"
              htmlFor="payment-fee-pct"
              description="Estimate only. PayMongo's rate varies by payment method."
            >
              <Input
                id="payment-fee-pct"
                type="number"
                min={0}
                max={100}
                step={0.001}
                value={paymentFeePct}
                onChange={(event) => setPaymentFeePct(event.target.value)}
              />
            </SuperAdminSettingsRow>
            <SuperAdminSettingsRow
              stacked
              label="Processor fee fixed (₱)"
              htmlFor="payment-fee-fixed"
              description="Per transaction."
            >
              <Input
                id="payment-fee-fixed"
                type="number"
                min={0}
                step={0.01}
                value={paymentFeeFixed}
                onChange={(event) => setPaymentFeeFixed(event.target.value)}
              />
            </SuperAdminSettingsRow>
          </div>

          <ParkingSettlementPreview
            settings={{
              commissionPct: Number(commissionPct) / 100 || 0,
              directCommissionPct: Number(directCommissionPct) / 100 || 0,
              guestFeePct: Number(guestFeePct) / 100 || 0,
              guestFeeFixed: Number(guestFeeFixed) || 0,
              paymentFeePct: Number(paymentFeePct) / 100 || 0,
              paymentFeeFixed: Number(paymentFeeFixed) || 0,
            }}
          />
          <SuperAdminSettingsRow
            stacked
            label="Support escalation phone"
            htmlFor="support-escalation-phone"
            description="Shown to guests on the parking status page for an unresponsive host. Optional."
          >
            <Input
              id="support-escalation-phone"
              type="tel"
              placeholder={FORM_PLACEHOLDERS.phone}
              value={escalationPhone}
              onChange={(event) => setEscalationPhone(event.target.value)}
            />
          </SuperAdminSettingsRow>
        </>
      )}
    </SuperAdminSettingsCard>
  );
}

function PayoutRowActions({ txn }: { txn: ParkingPayoutTransaction }) {
  const refundable = txn.status === 'paid' || txn.status === 'refund_review';
  return (
    <div className="flex flex-wrap gap-2">
      {!txn.disbursedAt && txn.status === 'paid' ? <MarkDisbursedDialog transaction={txn} /> : null}
      {refundable ? <RecordRefundDialog transaction={txn} /> : null}
      <RecordClawbackDialog transaction={txn} />
    </div>
  );
}

function PayoutStatusBadge({ txn }: { txn: ParkingPayoutTransaction }) {
  if (txn.status === 'refunded') return <Badge variant="secondary">Refunded</Badge>;
  if (txn.status === 'refund_review') {
    return <Badge variant="destructive">Refund review</Badge>;
  }
  if (txn.failureReason) return <Badge variant="outline">Needs review</Badge>;
  if (!txn.disbursedAt && txn.status === 'paid' && txn.payoutEligible === false) {
    return <Badge variant="outline">Payout held</Badge>;
  }
  return txn.disbursedAt ? (
    <Badge variant="secondary">Disbursed</Badge>
  ) : (
    <Badge variant="outline">Awaiting disbursement</Badge>
  );
}

const PAYOUT_FILTERS: Array<{ id: ParkingPayoutStatusFilter; label: string }> = [
  { id: 'paid', label: 'Paid' },
  { id: 'refund_review', label: 'Refund review' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'all', label: 'All' },
];

function PayoutsLedger() {
  const [filter, setFilter] = useState<ParkingPayoutStatusFilter>('paid');
  const { data, isLoading, error } = useParkingPayouts(filter);

  const transactions = useMemo(() => data ?? [], [data]);
  const totals = useMemo(
    () =>
      transactions.reduce(
        (acc, txn) => ({
          guest: acc.guest + txn.guestChargeTotal,
          host: acc.host + txn.hostNetTotal,
          fee: acc.fee + txn.paymentFeeAmount,
          platform: acc.platform + txn.platformNetTotal,
        }),
        { guest: 0, host: 0, fee: 0, platform: 0 }
      ),
    [transactions]
  );

  if (isLoading && !data) return <SuperAdminAdminListBodySkeleton metricCount={0} />;
  if (error) return <p className="text-destructive text-sm">Could not load the payout ledger.</p>;

  const filters = (
    <div className="flex flex-wrap gap-2">
      {PAYOUT_FILTERS.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={filter === option.id ? 'default' : 'outline'}
          className="min-h-[44px]"
          onClick={() => setFilter(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );

  if (transactions.length === 0) {
    return (
      <div className="space-y-3">
        {filters}
        <SuperAdminEmptyState icon={Wallet} title="No parking payments in this view" />
      </div>
    );
  }

  return (
    <>
      {filters}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Guest charges', value: totals.guest },
          { label: 'Host payouts', value: totals.host },
          { label: 'Processor (est.)', value: totals.fee },
          { label: 'Platform net', value: totals.platform },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-border/60 bg-muted/20 rounded-lg border px-3 py-2"
          >
            <div className="text-muted-foreground text-xs">{stat.label}</div>
            <div className="text-foreground text-sm font-semibold tabular-nums">
              {formatPhp(stat.value)}
            </div>
          </div>
        ))}
      </div>
      {/* Desktop table */}
      <Card className="hidden overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Host payout</TableHead>
                <TableHead>Platform net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>
                    <div className="font-medium">{txn.guestName ?? 'Guest'}</div>
                    <div className="text-muted-foreground text-xs">
                      {txn.checkInDate ?? '-'} → {txn.checkOutDate ?? '-'} · {txn.nights} night
                      {txn.nights === 1 ? '' : 's'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{txn.parkingName ?? '-'}</div>
                    <div className="text-muted-foreground text-xs">
                      {txn.organizationName ?? '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatPhp(txn.hostNetTotal)}</div>
                    <div className="text-muted-foreground text-xs">
                      Gross {formatPhp(txn.hostGrossTotal)} · Commission{' '}
                      {(txn.commissionPct * 100).toFixed(1)}%
                      {txn.bookingChannel === 'direct_link' ? ' · Direct link' : ''}
                    </div>
                    {txn.clawbackAmount != null ? (
                      <div className="text-destructive text-xs">
                        Clawback: {formatPhp(txn.clawbackAmount)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium tabular-nums">
                      {formatPhp(txn.platformNetTotal)}
                    </div>
                    <div className="text-muted-foreground text-xs tabular-nums">
                      Guest {formatPhp(txn.guestChargeTotal)} · Processor{' '}
                      {formatPhp(txn.paymentFeeAmount)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <PayoutStatusBadge txn={txn} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <PayoutRowActions txn={txn} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile / tablet cards */}
      <div className="space-y-3 lg:hidden">
        {transactions.map((txn) => (
          <Card key={txn.id} padding="sm" className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{txn.guestName ?? 'Guest'}</div>
                <div className="text-muted-foreground text-xs">
                  {txn.checkInDate ?? '-'} → {txn.checkOutDate ?? '-'} · {txn.nights} night
                  {txn.nights === 1 ? '' : 's'}
                </div>
              </div>
              <PayoutStatusBadge txn={txn} />
            </div>
            <div className="text-sm">
              <div>
                {txn.parkingName ?? '-'}{' '}
                <span className="text-muted-foreground">· {txn.organizationName ?? '-'}</span>
              </div>
              <div className="font-medium">{formatPhp(txn.hostNetTotal)} to host</div>
              <div className="text-muted-foreground text-xs">
                Gross {formatPhp(txn.hostGrossTotal)} · Commission{' '}
                {(txn.commissionPct * 100).toFixed(1)}%
                {txn.bookingChannel === 'direct_link' ? ' · Direct link' : ''}
              </div>
              <div className="text-muted-foreground text-xs tabular-nums">
                Guest {formatPhp(txn.guestChargeTotal)} · Processor{' '}
                {formatPhp(txn.paymentFeeAmount)} · Platform net {formatPhp(txn.platformNetTotal)}
              </div>
              {txn.clawbackAmount != null ? (
                <div className="text-destructive text-xs">
                  Clawback: {formatPhp(txn.clawbackAmount)}
                </div>
              ) : null}
            </div>
            <PayoutRowActions txn={txn} />
          </Card>
        ))}
      </div>
    </>
  );
}

export function SuperAdminParkingPayoutsPage() {
  usePageTitle(appPageTitle('Parking payouts'));

  return (
    <SuperAdminPage
      title="Parking payouts"
      subtitle="Commission, guest rate, processor fees, and the manual host disbursement ledger for the parkings vertical."
    >
      <ParkingSettingsCard />
      <div className="space-y-3">
        <h2 className="text-section-title">Disbursement ledger</h2>
        <PayoutsLedger />
      </div>
    </SuperAdminPage>
  );
}
