import { CreditCard, Landmark, QrCode, Receipt, Wallet } from 'lucide-react';

import type {
  OrgBundlePlanDto,
  OrgPaymentTransactionDto,
} from '@/features/dashboard/plans/lib/orgPlanApi';
import { planDisplayName } from '@/features/dashboard/plans/lib/planPresentation';

import type { LucideIcon } from 'lucide-react';

export type TransactionStatusTone = 'success' | 'secondary' | 'destructive';

export type TransactionStatusMeta = {
  label: string;
  tone: TransactionStatusTone;
};

const STATUS_META: Record<string, TransactionStatusMeta> = {
  paid: { label: 'Paid', tone: 'success' },
  pending: { label: 'Pending', tone: 'secondary' },
  failed: { label: 'Failed', tone: 'destructive' },
  expired: { label: 'Expired', tone: 'secondary' },
  cancelled: { label: 'Cancelled', tone: 'secondary' },
  refunded: { label: 'Refunded', tone: 'secondary' },
};

const METHOD_LABELS: Record<string, string> = {
  qrph: 'QR Ph',
  credit: 'Account credit',
  gcash: 'GCash',
  paymaya: 'Maya',
  card: 'Card',
  dob: 'Online banking',
  dob_ubp: 'UnionBank',
  brankas: 'Online banking',
};

/** A paid row that was kept as account credit reads as such, not as a plain paid plan payment. */
export function transactionStatusMeta(
  status: string,
  options: { keptAsCredit?: boolean } = {}
): TransactionStatusMeta {
  if (status === 'paid' && options.keptAsCredit)
    return { label: 'Added as credit', tone: 'secondary' };
  return STATUS_META[status] ?? { label: status, tone: 'secondary' };
}

const PURPOSE_LABELS: Record<string, string> = {
  initial: 'New plan',
  renewal: 'Renewal',
  retry: 'Overdue renewal',
  change: 'Plan change',
  reactivation: 'Reactivation',
  credit: 'Account credit',
};

export function transactionPurposeLabel(purpose: string | null | undefined): string | null {
  return purpose ? (PURPOSE_LABELS[purpose] ?? null) : null;
}

/** "Renewal · Dec 3 to Jan 3" style second line, from whatever the row knows. */
export function transactionPeriodLabel(
  txn: Pick<OrgPaymentTransactionDto, 'periodStart' | 'periodEnd'>,
  formatDate: (iso: string) => string
): string | null {
  if (!txn.periodStart || !txn.periodEnd) return null;
  return `${formatDate(txn.periodStart)} to ${formatDate(txn.periodEnd)}`;
}

export function paymentMethodLabel(method: string | null): string | null {
  if (!method) return null;
  return METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}

export function paymentMethodIcon(method: string | null): LucideIcon {
  const key = method?.toLowerCase() ?? '';
  if (key === 'qrph') return QrCode;
  if (key === 'gcash' || key === 'paymaya') return Wallet;
  if (key === 'card') return CreditCard;
  if (key === 'dob' || key === 'dob_ubp' || key === 'brankas') return Landmark;
  return Receipt;
}

export function transactionTitle(planId: string, plans: OrgBundlePlanDto[]): string {
  const plan = plans.find((entry) => entry.id === planId);
  if (plan) return `${planDisplayName(plan)} plan`;
  return 'Subscription payment';
}
