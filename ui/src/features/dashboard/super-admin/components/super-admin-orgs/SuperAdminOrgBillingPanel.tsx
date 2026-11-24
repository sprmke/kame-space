import { useState } from 'react';

import { AlertTriangle, Loader2 } from 'lucide-react';

import {
  SuperAdminSettingsCard,
  SuperAdminSettingsRow,
} from '@/features/dashboard/super-admin/components/shared/SuperAdminSettingsCard';
import {
  useOrgBillingAdmin,
  useOrgBillingAdminAction,
} from '@/features/dashboard/super-admin/hooks/useOrgBillingAdmin';
import {
  buildBillingTimeline,
  findUnappliedPayments,
} from '@/features/dashboard/super-admin/lib/superAdminBillingTimeline';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';
import { formatManilaLongDate } from '@/utils/format/dates';

const TONE: Record<string, string> = {
  good: 'bg-primary',
  warn: 'bg-warning',
  bad: 'bg-destructive',
  neutral: 'bg-muted-foreground/50',
};

/** Billing state, scheduled changes, credit, held payments and one history for support. */
export function SuperAdminOrgBillingPanel({ organizationId }: { organizationId: string }) {
  const { data, isLoading, error } = useOrgBillingAdmin(organizationId);
  const act = useOrgBillingAdminAction(organizationId);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');

  if (isLoading) {
    return (
      <SuperAdminSettingsCard title="Billing" description="Loading billing history.">
        <div className="bg-muted h-24 animate-pulse rounded-lg" aria-hidden />
      </SuperAdminSettingsCard>
    );
  }
  if (error || !data) {
    return (
      <SuperAdminSettingsCard title="Billing" description="Could not load billing.">
        <p role="alert" className="text-destructive-strong text-sm">
          {error instanceof Error ? error.message : 'Try again in a moment.'}
        </p>
      </SuperAdminSettingsCard>
    );
  }

  const sub = data.subscription;
  const timeline = buildBillingTimeline({
    events: data.recentEvents,
    transactions: data.transactions,
    ledger: data.ledger,
  });
  const held = findUnappliedPayments(data.transactions);
  // Applied payments only: a held payment is resolved above, not refunded from here.
  const paidPayments = data.transactions
    .filter((txn) => txn.status === 'paid' && txn.applied !== false)
    .slice(0, 5);
  const balance = data.ledgerBalancePhp;
  const hasIntent = Boolean(sub?.scheduledPlanId || sub?.cancelAtPeriodEnd);
  const busy = act.isPending;
  const run = (input: Parameters<typeof act.mutate>[0], confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    act.mutate(input);
  };

  const submitCredit = () => {
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount === 0 || !creditNote.trim()) return;
    act.mutate(
      { action: 'adjust_credit', creditPhp: amount, note: creditNote.trim() },
      {
        onSuccess: () => {
          setCreditAmount('');
          setCreditNote('');
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <SuperAdminSettingsCard
        title="Billing state"
        description="What the org is paying for, what is scheduled, and the account credit."
      >
        <SuperAdminSettingsRow label="Status">
          {sub ? (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={sub.status === 'active' ? 'success' : 'secondary'}>
                {sub.status}
              </Badge>
              {sub.planName}
              {sub.priceOverridePhp != null ? (
                <span className="text-muted-foreground">(price set by platform)</span>
              ) : null}
            </span>
          ) : (
            <span className="text-sm">Free (no subscription)</span>
          )}
        </SuperAdminSettingsRow>

        {sub?.currentPeriodEnd ? (
          <SuperAdminSettingsRow label="Period ends">
            <span className="text-sm tabular-nums">
              {formatManilaLongDate(sub.currentPeriodEnd)}
            </span>
          </SuperAdminSettingsRow>
        ) : null}

        <SuperAdminSettingsRow label="Account credit">
          <span className="text-sm tabular-nums">
            {balance < 0
              ? `${formatMoneyCompact(-balance)} credit`
              : balance > 0
                ? `${formatMoneyCompact(balance)} owed (added to the next payment)`
                : 'None'}
          </span>
        </SuperAdminSettingsRow>

        {hasIntent ? (
          <SuperAdminSettingsRow
            stacked
            label="Scheduled"
            description={
              sub?.cancelAtPeriodEnd
                ? 'The plan ends at the period end and the org moves to Free.'
                : `Moves to another plan on ${formatManilaLongDate(sub?.scheduledChangeAt)}.`
            }
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                disabled={busy}
                onClick={() => run({ action: 'clear_intent' })}
              >
                Remove scheduled change
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                disabled={busy}
                onClick={() =>
                  run(
                    { action: 'apply_intent_now' },
                    'Apply the scheduled change right now? Paid time left on the current plan is not refunded.'
                  )
                }
              >
                Apply now
              </Button>
            </div>
          </SuperAdminSettingsRow>
        ) : null}

        {sub ? (
          <SuperAdminSettingsRow
            stacked
            label="Plan controls"
            description="Moves go through the same rules as the host's own buttons."
          >
            <div className="flex flex-wrap gap-2">
              {!hasIntent && sub.status === 'active' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  disabled={busy}
                  onClick={() => run({ action: 'cancel_at_period_end' })}
                >
                  Cancel at period end
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                className="min-h-[44px]"
                disabled={busy}
                onClick={() =>
                  run(
                    { action: 'cancel_now' },
                    'End this plan now and move the organization to Free? Paid time left is not refunded.'
                  )
                }
              >
                End plan now
              </Button>
            </div>
          </SuperAdminSettingsRow>
        ) : null}

        <SuperAdminSettingsRow
          stacked
          label="Adjust account credit"
          description="Positive adds credit. Negative removes it. A note is required and the change is logged."
        >
          <form
            className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              submitCredit();
            }}
          >
            <Input
              type="number"
              inputMode="numeric"
              step="1"
              placeholder="₱ amount"
              aria-label="Credit amount in pesos"
              value={creditAmount}
              onChange={(event) => setCreditAmount(event.target.value)}
            />
            <Input
              placeholder="Why (shown in the history)"
              aria-label="Reason for the adjustment"
              maxLength={300}
              value={creditNote}
              onChange={(event) => setCreditNote(event.target.value)}
            />
            <Button
              type="submit"
              className="min-h-[44px]"
              disabled={busy || !creditNote.trim() || !Number(creditAmount)}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Apply
            </Button>
          </form>
        </SuperAdminSettingsRow>
      </SuperAdminSettingsCard>

      {held.length > 0 ? (
        <SuperAdminSettingsCard
          title="Held payments"
          description="Money was collected but not applied to the plan. Apply it, or keep it as account credit."
          icon={<AlertTriangle className="text-warning size-4" aria-hidden />}
        >
          <ul className="divide-border divide-y">
            {held.map((txn) => (
              <li
                key={txn.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium tabular-nums">
                    {formatMoneyCompact(Number(txn.amount))}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {txn.review_reason ?? 'Not applied yet'} ·{' '}
                    {formatManilaLongDate(txn.paid_at ?? txn.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-[44px]"
                    disabled={busy}
                    onClick={() =>
                      run({ action: 'resolve_payment', transactionId: txn.id, resolution: 'apply' })
                    }
                  >
                    Apply
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px]"
                    disabled={busy || String(txn.review_reason ?? '').startsWith('stale:')}
                    onClick={() =>
                      run({
                        action: 'resolve_payment',
                        transactionId: txn.id,
                        resolution: 'keep_credit',
                      })
                    }
                  >
                    Keep as credit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </SuperAdminSettingsCard>
      ) : null}

      {paidPayments.length > 0 ? (
        <SuperAdminSettingsCard
          title="Recent payments"
          description="Refund in the PayMongo dashboard first. Marking a payment refunded here only updates the record and does not end the plan."
        >
          <ul className="divide-border divide-y">
            {paidPayments.map((txn) => (
              <li
                key={txn.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium tabular-nums">
                    {formatMoneyCompact(Number(txn.amount))}
                    {txn.receipt_number ? (
                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                        {txn.receipt_number}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {txn.purpose ?? 'Payment'} ·{' '}
                    {formatManilaLongDate(txn.paid_at ?? txn.created_at)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] shrink-0"
                  disabled={busy}
                  onClick={() =>
                    run(
                      { action: 'record_refund', transactionId: txn.id },
                      'Mark this payment as refunded? Only do this after refunding it in the PayMongo dashboard.'
                    )
                  }
                >
                  Mark refunded
                </Button>
              </li>
            ))}
          </ul>
        </SuperAdminSettingsCard>
      ) : null}

      <SuperAdminSettingsCard
        title="History"
        description="Plan changes, payments and credit, newest first."
      >
        {timeline.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing yet.</p>
        ) : (
          <ol className="space-y-3">
            {timeline.slice(0, 60).map((entry) => (
              <li key={entry.id} className="flex items-start gap-3">
                <span
                  className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE[entry.tone])}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm">{entry.title}</p>
                  {entry.detail ? (
                    <p className="text-muted-foreground text-xs">{entry.detail}</p>
                  ) : null}
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatManilaLongDate(entry.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SuperAdminSettingsCard>
    </div>
  );
}
