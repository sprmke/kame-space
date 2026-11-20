import type { FinanceLedgerEntry } from '@/features/dashboard/finance/lib/financeLedger';
import type { FinanceLedgerStatus } from '@/features/dashboard/finance/lib/types';
import type { ParkingPaymentRow } from '@/features/dashboard/parking/hooks/useParkingPayments';

const MARKETPLACE_CATEGORY = 'Marketplace';

function isoDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

export function parkingPayoutLedgerStatus(row: ParkingPaymentRow): {
  status: FinanceLedgerStatus;
  statusLabel: string;
} {
  if (row.status === 'refunded') {
    return { status: 'canceled', statusLabel: 'Refunded' };
  }
  if (row.status === 'refund_review') {
    return { status: 'pending', statusLabel: 'Refund review' };
  }
  if (row.disbursedAt) {
    return { status: 'completed', statusLabel: 'Disbursed' };
  }
  return { status: 'pending', statusLabel: 'Awaiting payout' };
}

function formatFeePct(commissionPct: number): string {
  const pct = commissionPct * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded}%`;
}

function formatPhpPlain(amount: number): string {
  return `₱${Math.round(amount).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

/**
 * Maps a `parking-payments` row into the shared finance ledger shape.
 * Read-only: no `transaction` / `stay`, so table/card/calendar hide edit actions.
 */
export function buildParkingPayoutLedgerEntry(
  row: ParkingPaymentRow
): FinanceLedgerEntry | null {
  const date = isoDateOnly(row.paidAt) ?? isoDateOnly(row.disbursedAt);
  if (!date) return null;

  const { status, statusLabel } = parkingPayoutLedgerStatus(row);
  const isDirect = row.bookingChannel === 'direct_link';
  const feePct = formatFeePct(row.commissionPct);

  return {
    id: `payout:${row.id}`,
    source: 'parking_payout',
    date,
    description: isDirect ? 'Marketplace payout · Direct link' : 'Marketplace payout',
    subDescription: `Guest paid ${formatPhpPlain(row.guestChargeTotal)} · Fee ${feePct}`,
    category: MARKETPLACE_CATEGORY,
    type: 'income',
    status,
    statusLabel,
    netAmount: row.hostNetTotal,
  };
}

export function buildParkingPayoutLedgerEntries(
  rows: ParkingPaymentRow[],
  range?: { from: string | null; to: string | null }
): FinanceLedgerEntry[] {
  const entries: FinanceLedgerEntry[] = [];
  for (const row of rows) {
    const entry = buildParkingPayoutLedgerEntry(row);
    if (!entry) continue;
    if (range?.from && entry.date < range.from) continue;
    if (range?.to && entry.date > range.to) continue;
    entries.push(entry);
  }
  return entries;
}
