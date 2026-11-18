/**
 * Account credit ledger (org_billing_ledger). Signed amounts: positive = the org owes it
 * (property true-ups), negative = account credit. Balance = SUM. Credit is applied to the next
 * payment automatically and is never paid out as cash.
 */

import { createClient } from './supabaseJs.ts';
import type { PaymentQuote } from './orgBillingQuote.ts';

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

export type LedgerKind =
  | 'proration_credit'
  | 'true_up'
  | 'overpayment'
  | 'stale_payment'
  | 'admin_adjustment'
  | 'applied_to_renewal'
  | 'refund';

export async function getLedgerBalancePhp(organizationId: string): Promise<number> {
  const sb = db();
  const { data, error } = await sb.rpc('org_billing_balance', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  return Math.round(Number(data ?? 0));
}

export async function addLedgerEntry(input: {
  organizationId: string;
  amountPhp: number;
  kind: LedgerKind;
  transactionId?: string | null;
  orgSubscriptionId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}): Promise<boolean> {
  const amount = Math.round(input.amountPhp);
  if (!amount) return false;
  const sb = db();
  const { error } = await sb.from('org_billing_ledger').insert({
    organization_id: input.organizationId,
    amount_php: amount,
    kind: input.kind,
    transaction_id: input.transactionId ?? null,
    org_subscription_id: input.orgSubscriptionId ?? null,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  });
  // 23505 = this payment's entry already exists (retry): applying twice is a no-op.
  if (error) {
    if (error.code === '23505') return false;
    throw new Error(error.message);
  }
  return true;
}

/**
 * Writes the ledger side of an applied payment: settles owed amounts, consumes credit and keeps
 * any leftover as new credit. Idempotent per transaction (unique on transaction_id + kind).
 */
export async function applyQuoteToLedger(input: {
  organizationId: string;
  transactionId: string;
  orgSubscriptionId?: string | null;
  quote: Pick<PaymentQuote, 'settleDebtPhp' | 'consumeCreditPhp' | 'newCreditPhp'>;
  leftoverKind?: 'proration_credit' | 'overpayment';
  note?: string | null;
}): Promise<void> {
  const { quote } = input;
  // Debt and credit never coexist (single signed balance), so one settle entry at most.
  const settle = quote.consumeCreditPhp - quote.settleDebtPhp;
  if (settle !== 0) {
    await addLedgerEntry({
      organizationId: input.organizationId,
      amountPhp: settle,
      kind: 'applied_to_renewal',
      transactionId: input.transactionId,
      orgSubscriptionId: input.orgSubscriptionId,
      note: input.note ?? 'Applied to a payment',
    });
  }
  if (quote.newCreditPhp > 0) {
    await addLedgerEntry({
      organizationId: input.organizationId,
      amountPhp: -quote.newCreditPhp,
      kind: input.leftoverKind ?? 'proration_credit',
      transactionId: input.transactionId,
      orgSubscriptionId: input.orgSubscriptionId,
      note: input.note ?? 'Leftover credit from a plan change',
    });
  }
}
