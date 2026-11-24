/**
 * One chronological billing history for support: subscription events, payments and account
 * credit entries merged and sorted newest first. Pure, so the ordering and wording are tested.
 */

export type BillingEventRow = {
  id: string;
  event_type: string;
  previous_status?: string | null;
  new_status?: string | null;
  note?: string | null;
  created_at: string;
};

export type BillingTransactionRow = {
  id: string;
  amount: number | string;
  status: string;
  purpose?: string | null;
  applied?: boolean | null;
  review_reason?: string | null;
  receipt_number?: string | null;
  created_at: string;
  paid_at?: string | null;
};

export type BillingLedgerRow = {
  id: string;
  amount_php: number | string;
  kind: string;
  note?: string | null;
  created_at: string;
};

export type BillingTimelineEntry = {
  id: string;
  at: string;
  source: 'event' | 'payment' | 'credit';
  title: string;
  detail: string | null;
  tone: 'neutral' | 'good' | 'warn' | 'bad';
};

const EVENT_TITLES: Record<string, string> = {
  assigned: 'Plan assigned',
  plan_changed: 'Plan changed',
  status_changed: 'Status changed',
  property_added: 'Property added to the plan',
  property_removed: 'Property removed from the plan',
  reward_granted: 'Reward granted',
  reward_expired: 'Reward expired',
  reward_revoked: 'Reward revoked',
  change_scheduled: 'Downgrade scheduled',
  change_canceled: 'Scheduled change removed',
  change_applied: 'Scheduled change applied',
  cancel_scheduled: 'Cancel scheduled',
  cancel_reverted: 'Plan resumed',
  renewed: 'Renewed',
  past_due: 'Became past due',
  suspended: 'Suspended',
  canceled: 'Ended',
  reactivated: 'Reactivated',
  ledger_entry: 'Billing note',
  payment_unapplied: 'Payment not applied',
  price_migrated: 'Price change scheduled',
};

const WARN_EVENTS = new Set([
  'past_due',
  'payment_unapplied',
  'cancel_scheduled',
  'change_scheduled',
]);
const BAD_EVENTS = new Set(['suspended', 'canceled']);
const GOOD_EVENTS = new Set(['renewed', 'reactivated', 'assigned', 'cancel_reverted']);

const LEDGER_TITLES: Record<string, string> = {
  proration_credit: 'Credit from a plan change',
  true_up: 'Added a property mid-period',
  overpayment: 'Extra payment kept as credit',
  stale_payment: 'Payment kept as credit',
  admin_adjustment: 'Credit adjusted by platform',
  applied_to_renewal: 'Applied to a payment',
  refund: 'Refund recorded',
};

function php(value: number): string {
  return `₱${Math.round(Math.abs(value)).toLocaleString('en-PH')}`;
}

export function buildBillingTimeline(input: {
  events: BillingEventRow[];
  transactions: BillingTransactionRow[];
  ledger: BillingLedgerRow[];
}): BillingTimelineEntry[] {
  const entries: BillingTimelineEntry[] = [];
  // Partial or failed payloads reach this pure function; a missing list means "nothing
  // to show", not a crash that takes down the organization page.
  const events = input.events ?? [];
  const transactions = input.transactions ?? [];
  const ledger = input.ledger ?? [];

  for (const event of events) {
    const statusChange =
      event.previous_status && event.new_status && event.previous_status !== event.new_status
        ? `${event.previous_status} to ${event.new_status}`
        : null;
    entries.push({
      id: `event-${event.id}`,
      at: event.created_at,
      source: 'event',
      title: EVENT_TITLES[event.event_type] ?? event.event_type.replace(/_/g, ' '),
      detail: [statusChange, event.note].filter(Boolean).join('. ') || null,
      tone: BAD_EVENTS.has(event.event_type)
        ? 'bad'
        : WARN_EVENTS.has(event.event_type)
          ? 'warn'
          : GOOD_EVENTS.has(event.event_type)
            ? 'good'
            : 'neutral',
    });
  }

  for (const txn of transactions) {
    const amount = Number(txn.amount);
    const keptAsCredit = txn.status === 'paid' && txn.applied === false;
    const title =
      txn.status === 'paid'
        ? keptAsCredit
          ? `Payment of ${php(amount)} held`
          : `Payment of ${php(amount)} received`
        : txn.status === 'pending'
          ? `Checkout of ${php(amount)} opened`
          : `Checkout of ${php(amount)} ${txn.status}`;
    entries.push({
      id: `payment-${txn.id}`,
      at: txn.paid_at ?? txn.created_at,
      source: 'payment',
      title,
      detail:
        [txn.purpose, txn.receipt_number, keptAsCredit ? txn.review_reason : null]
          .filter(Boolean)
          .join(' · ') || null,
      tone:
        keptAsCredit || txn.status === 'failed'
          ? 'warn'
          : txn.status === 'paid'
            ? 'good'
            : 'neutral',
    });
  }

  for (const row of ledger) {
    const amount = Number(row.amount_php);
    entries.push({
      id: `credit-${row.id}`,
      at: row.created_at,
      source: 'credit',
      title: `${LEDGER_TITLES[row.kind] ?? row.kind}: ${amount < 0 ? '+' : '-'}${php(amount)} ${
        amount < 0 ? 'credit' : 'owed'
      }`,
      detail: row.note ?? null,
      tone: 'neutral',
    });
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

/** Held payments that need a decision: paid, never applied, not already settled as credit. */
export function findUnappliedPayments(
  transactions: BillingTransactionRow[]
): BillingTransactionRow[] {
  return transactions.filter((txn) => txn.status === 'paid' && txn.applied !== true);
}
