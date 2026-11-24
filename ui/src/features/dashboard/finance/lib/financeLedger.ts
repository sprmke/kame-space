import { financeDisplayNet } from '@/features/dashboard/bookings/lib/bookingFinance';
import { bookingListDisplayName } from '@/features/dashboard/bookings/lib/bookingListDisplay';
import { checkInDateToIso } from '@/features/dashboard/bookings/lib/bookingsListSort';
import { getFinanceCategoryLabel } from '@/features/dashboard/finance/lib/financeCategoryColors';
import type {
  FinanceBookingLedgerRow,
  FinanceLedgerSort,
  FinanceLedgerStatus,
  FinanceLineItem,
  FinanceQuery,
} from '@/features/dashboard/finance/lib/types';

export type FinanceLedgerEntry = {
  id: string;
  /** `parking_payout` = read-only marketplace payment row (parking finance only). */
  source: 'stay' | 'transaction' | 'parking_payout';
  date: string;
  description: string;
  subDescription?: string;
  category: string;
  type: 'income' | 'expense';
  status: FinanceLedgerStatus;
  /** Overrides the default Completed / Pending / Canceled badge label. */
  statusLabel?: string;
  netAmount: number;
  stay?: FinanceBookingLedgerRow;
  transaction?: FinanceLineItem;
};

const STAY_NET_CATEGORY = 'Stay net';

export function stayLedgerStatus(status: string): FinanceLedgerStatus {
  if (status === 'CANCELLED') return 'canceled';
  if (status === 'COMPLETED') return 'completed';
  return 'pending';
}

export function transactionLedgerStatus(item: FinanceLineItem): FinanceLedgerStatus {
  if (item.telegram_reminder_enabled && !item.paid_at) return 'pending';
  return 'completed';
}

export function buildStayLedgerEntry(row: FinanceBookingLedgerRow): FinanceLedgerEntry | null {
  const date = checkInDateToIso(row.check_in_date);
  if (!date) return null;

  const net = financeDisplayNet(row.financials) ?? 0;
  const name = bookingListDisplayName(row);

  return {
    id: `stay:${row.id}`,
    source: 'stay',
    date,
    description: `${name}: Stay`,
    category: STAY_NET_CATEGORY,
    type: net >= 0 ? 'income' : 'expense',
    status: stayLedgerStatus(row.status),
    netAmount: net,
    stay: row,
  };
}

export type LedgerAmountTone = 'income' | 'expense' | 'pending' | 'canceled';

/**
 * Money is only "collected" when the entry completed. Pending and canceled rows
 * keep their status tone so a pending stay never reads as received cash.
 */
export function ledgerAmountTone(entry: FinanceLedgerEntry): LedgerAmountTone {
  if (entry.status === 'canceled') return 'canceled';
  if (entry.status === 'pending') return 'pending';
  return entry.type === 'income' ? 'income' : 'expense';
}

/** Icon well tone for ledger rows: pending stays are amber, not collected green. */
export function ledgerIconTone(entry: FinanceLedgerEntry): 'green' | 'red' | 'yellow' | 'neutral' {
  if (entry.status === 'canceled') return 'neutral';
  if (entry.status === 'pending') return 'yellow';
  return entry.type === 'income' ? 'green' : 'red';
}

export function ledgerIconClassName(tone: ReturnType<typeof ledgerIconTone>): string {
  switch (tone) {
    case 'green':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'red':
      return 'text-red-600 dark:text-red-400';
    case 'yellow':
      return 'text-amber-600 dark:text-amber-400';
    case 'neutral':
    default:
      return 'text-muted-foreground';
  }
}

export function ledgerAmountClassName(tone: LedgerAmountTone): string {
  switch (tone) {
    case 'income':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'expense':
      return 'text-red-600 dark:text-red-400';
    case 'pending':
      return 'text-amber-700 dark:text-amber-300';
    case 'canceled':
    default:
      return 'text-muted-foreground';
  }
}

export function buildTransactionLedgerEntry(item: FinanceLineItem): FinanceLedgerEntry {
  return {
    id: `txn:${item.id}`,
    source: 'transaction',
    date: item.occurred_on,
    description: item.label,
    subDescription: item.notes?.trim() || undefined,
    category: getFinanceCategoryLabel(item.category),
    type: item.kind,
    status: transactionLedgerStatus(item),
    netAmount: item.amount,
    transaction: item,
  };
}

export function buildFinanceLedgerEntries(
  stays: FinanceBookingLedgerRow[],
  transactions: FinanceLineItem[]
): FinanceLedgerEntry[] {
  const entries: FinanceLedgerEntry[] = [];

  for (const row of stays) {
    const entry = buildStayLedgerEntry(row);
    if (entry) entries.push(entry);
  }

  for (const item of transactions) {
    entries.push(buildTransactionLedgerEntry(item));
  }

  return entries;
}

function entryMatchesSearch(entry: FinanceLedgerEntry, needle: string): boolean {
  if (!needle) return true;
  const hay = [
    entry.description,
    entry.subDescription,
    entry.category,
    entry.statusLabel,
    entry.id,
    entry.stay?.guest_email,
    entry.stay?.guest_facebook_name,
    entry.stay?.primary_guest_name,
    entry.transaction?.notes,
  ]
    .map((v) => String(v ?? '').toLowerCase())
    .join(' ');
  return hay.includes(needle);
}

export function filterFinanceLedgerEntries(
  entries: FinanceLedgerEntry[],
  query: Pick<FinanceQuery, 'q' | 'typeFilter' | 'statusFilter' | 'categoryFilter'>
): FinanceLedgerEntry[] {
  const needle = query.q.trim().toLowerCase();

  return entries.filter((entry) => {
    if (!entryMatchesSearch(entry, needle)) return false;

    if (query.typeFilter !== 'all' && entry.type !== query.typeFilter) {
      return false;
    }

    if (query.statusFilter.length > 0 && !query.statusFilter.includes(entry.status)) {
      return false;
    }

    if (query.categoryFilter.length > 0 && !query.categoryFilter.includes(entry.category)) {
      return false;
    }

    return true;
  });
}

export function sortFinanceLedgerEntries(
  entries: FinanceLedgerEntry[],
  sort: FinanceLedgerSort
): FinanceLedgerEntry[] {
  const sorted = [...entries];
  sorted.sort((a, b) => {
    switch (sort) {
      case 'date:asc':
        return a.date.localeCompare(b.date);
      case 'amount:desc':
        return Math.abs(b.netAmount) - Math.abs(a.netAmount);
      case 'amount:asc':
        return Math.abs(a.netAmount) - Math.abs(b.netAmount);
      case 'date:desc':
      default:
        return b.date.localeCompare(a.date);
    }
  });
  return sorted;
}

export function paginateFinanceLedgerEntries(
  entries: FinanceLedgerEntry[],
  page: number,
  limit: number
): { rows: FinanceLedgerEntry[]; total: number } {
  const total = entries.length;
  const start = (page - 1) * limit;
  return {
    rows: entries.slice(start, start + limit),
    total,
  };
}

export function collectLedgerCategories(entries: FinanceLedgerEntry[]): string[] {
  const categories = new Set<string>();
  for (const entry of entries) {
    categories.add(entry.category);
  }
  return [...categories].sort((a, b) => a.localeCompare(b));
}

export const FINANCE_LEDGER_STATUS_OPTIONS: {
  value: FinanceLedgerStatus;
  label: string;
}[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'canceled', label: 'Canceled' },
];
