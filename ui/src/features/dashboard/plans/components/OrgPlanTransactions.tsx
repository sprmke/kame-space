import { useState } from 'react';

import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  downloadOrgReceipt,
  type OrgBundlePlanDto,
  type OrgPaymentTransactionDto,
} from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  paymentMethodIcon,
  paymentMethodLabel,
  transactionPeriodLabel,
  transactionPurposeLabel,
  transactionStatusMeta,
  transactionTitle,
} from '@/features/dashboard/plans/lib/orgPlanTransactionFormat';
import {
  PLANS_TAB_SECTION_TITLES,
  planTabSectionTitleClass,
} from '@/features/dashboard/plans/lib/planPresentation';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { formatMoneyCompact } from '@/utils/format/currency';
import { formatManilaLongDate } from '@/utils/format/dates';

type OrgPlanTransactionsProps = {
  orgId: string | null;
  transactions: OrgPaymentTransactionDto[];
  plans?: OrgBundlePlanDto[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  showIncomplete?: boolean;
  onShowIncompleteChange?: (next: boolean) => void;
};

function ReceiptButton({ orgId, txn }: { orgId: string | null; txn: OrgPaymentTransactionDto }) {
  const [busy, setBusy] = useState(false);
  if (!txn.receiptNumber || !orgId) return null;
  const receiptNumber = txn.receiptNumber;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground -ml-2 mt-1 h-8 gap-1.5 px-2 text-xs"
      disabled={busy}
      aria-label={`Download receipt ${receiptNumber}`}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadOrgReceipt(orgId, txn.id, receiptNumber);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not download the receipt');
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Download className="size-3.5" aria-hidden />
      )}
      {receiptNumber}
    </Button>
  );
}

export function OrgPlanTransactions({
  orgId,
  transactions,
  plans = [],
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  showIncomplete = false,
  onShowIncompleteChange,
}: OrgPlanTransactionsProps) {
  return (
    <FloatingPanel as="section" padding="lg" aria-labelledby="plans-billing-heading">
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <h2 id="plans-billing-heading" className={planTabSectionTitleClass}>
          {PLANS_TAB_SECTION_TITLES.billing}
        </h2>
        {onShowIncompleteChange ? (
          <label className="text-muted-foreground flex min-h-[44px] cursor-pointer items-center gap-2 text-xs">
            <Switch
              checked={showIncomplete}
              onCheckedChange={onShowIncompleteChange}
              aria-label="Show unpaid and canceled checkouts"
            />
            <span>Show unpaid checkouts</span>
          </label>
        ) : null}
      </div>

      <div className="max-h-[min(50vh,26rem)] overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
        <ul className="divide-border divide-y">
          {transactions.map((txn) => {
            const status = transactionStatusMeta(txn.status, { keptAsCredit: txn.keptAsCredit });
            const method = paymentMethodLabel(txn.paymentMethodType);
            const Icon = paymentMethodIcon(txn.paymentMethodType);
            const title = transactionTitle(txn.planId, plans);
            const purpose = transactionPurposeLabel(txn.purpose);
            const period = transactionPeriodLabel(txn, formatManilaLongDate);
            /* An unpaid row has no paid_at — dating it by creation keeps the timeline honest. */
            const date = formatManilaLongDate(txn.paidAt ?? txn.createdAt);
            const subtitle = [purpose, date, method].filter(Boolean).join(' · ');

            return (
              <li key={txn.id} className="flex items-start gap-3 py-3.5 last:pb-0">
                <span
                  className="bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">{title}</p>
                  <p className="text-meta mt-0.5 truncate">{subtitle}</p>
                  {period ? <p className="text-meta mt-0.5 truncate">Covers {period}</p> : null}
                  {txn.keptAsCredit ? (
                    <p className="text-meta mt-0.5">
                      The plan had changed, so this was added to your account credit.
                    </p>
                  ) : null}
                  <ReceiptButton orgId={orgId} txn={txn} />
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-foreground text-sm font-semibold tabular-nums">
                    {txn.amount === 0 && txn.paymentMethodType === 'credit'
                      ? 'Credit'
                      : formatMoneyCompact(txn.amount)}
                  </span>
                  <Badge variant={status.tone} className="h-5 px-1.5 text-[10px] leading-none">
                    {status.label}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>

        {hasMore && onLoadMore ? (
          <div className="flex justify-center pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={isLoadingMore}
              onClick={onLoadMore}
            >
              {isLoadingMore ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Show more
            </Button>
          </div>
        ) : null}
      </div>
    </FloatingPanel>
  );
}
