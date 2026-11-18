/**
 * Reconcile org_payment_transactions against PayMongo when a webhook was missed or arrived on a
 * checkout we had already closed. Anything PayMongo actually collected goes through the same
 * validated apply path as a webhook (orgPaymentFulfillment.ts), so a late payment is applied if
 * it still fits and kept as account credit if it does not.
 */

import { createServiceClient } from './orgAuth.ts';
import {
  expirePaymongoCheckoutSession,
  getPaymongoProviderPaymentState,
  isPaymongoCheckoutSessionRef,
  isPaymongoPaymentLinkRef,
} from './paymongoClient.ts';
import { fulfillOrgSubscriptionPayment } from './orgPaymentFulfillment.ts';

export type OrgPaymentReconcileResult = 'fulfilled' | 'expired' | 'unchanged' | 'skipped';

/** Page loads and polls reconcile a given checkout at most this often. */
export const RECONCILE_MIN_INTERVAL_MS = 15_000;

const db = () => createServiceClient();

async function stampReconciled(transactionId: string): Promise<void> {
  await db()
    .from('org_payment_transactions')
    .update({ last_reconciled_at: new Date().toISOString() })
    .eq('id', transactionId);
}

async function expirePendingTransaction(transactionId: string): Promise<void> {
  const { error } = await db()
    .from('org_payment_transactions')
    .update({ status: 'expired' })
    .eq('id', transactionId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}

/**
 * If PayMongo already collected payment, fulfill the subscription. Legacy Payment Links (no
 * redirect back to Kame Space) are expired when still open so the next checkout uses Hosted
 * Checkout Sessions with success/cancel URLs. Throttled per transaction unless `force`.
 */
export async function reconcilePendingOrgPaymentTransaction(
  transactionId: string,
  options: { force?: boolean } = {}
): Promise<OrgPaymentReconcileResult> {
  const { data: txn, error } = await db()
    .from('org_payment_transactions')
    .select('id, status, provider_reference, payment_method_type, last_reconciled_at, amount')
    .eq('id', transactionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!txn || txn.status !== 'pending') return 'skipped';

  if (!options.force && txn.last_reconciled_at) {
    const age = Date.now() - new Date(txn.last_reconciled_at as string).getTime();
    if (age < RECONCILE_MIN_INTERVAL_MS) return 'unchanged';
  }
  // Credit-only rows have no provider reference and are applied synchronously.
  const providerRef =
    typeof txn.provider_reference === 'string' ? txn.provider_reference.trim() : '';
  if (!providerRef) return 'unchanged';

  await stampReconciled(transactionId);
  const paymongoState = await getPaymongoProviderPaymentState(providerRef);

  if (paymongoState === 'paid') {
    await fulfillOrgSubscriptionPayment({
      transactionId,
      providerReference: providerRef,
      paymentMethodType:
        typeof txn.payment_method_type === 'string' ? txn.payment_method_type : 'qrph',
      paidAt: new Date().toISOString(),
      rawPayload: { source: 'reconcile', provider_reference: providerRef },
    });
    return 'fulfilled';
  }

  // Only legacy Payment Links are auto-expired while still open. Hosted Checkout Sessions
  // (`cs_…`) must never be expired here on a transient API miss.
  if (isPaymongoPaymentLinkRef(providerRef)) {
    await expirePendingTransaction(transactionId);
    return 'expired';
  }

  if (isPaymongoCheckoutSessionRef(providerRef) && paymongoState === 'expired') {
    await expirePendingTransaction(transactionId);
    return 'expired';
  }

  return 'unchanged';
}

/** Expire a checkout the host no longer needs (superseded, TTL, plan change). */
export async function expireOrgCheckout(transactionId: string): Promise<void> {
  const { data: txn } = await db()
    .from('org_payment_transactions')
    .select('id, status, provider_reference')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn || txn.status !== 'pending') return;
  // Close it at PayMongo first so the link cannot be paid afterwards.
  await expirePaymongoCheckoutSession(txn.provider_reference as string | null);
  await expirePendingTransaction(transactionId);
}

/** Expire every pending checkout for an org (scheduling a change, cancel, ownership events). */
export async function expireAllPendingOrgCheckouts(organizationId: string): Promise<number> {
  const { data: rows } = await db()
    .from('org_payment_transactions')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    // One open checkout per org by unique index; the cap only guards legacy rows.
    .limit(20);
  let count = 0;
  for (const row of rows ?? []) {
    // A checkout that was paid a moment ago must be applied, not expired.
    const result = await reconcilePendingOrgPaymentTransaction(row.id as string, { force: true });
    if (result === 'fulfilled') continue;
    await expireOrgCheckout(row.id as string);
    count += 1;
  }
  return count;
}

/**
 * Cron sweep: pending checkouts older than 10 minutes (missed webhooks), pending past their TTL,
 * and recently closed checkouts that PayMongo says were paid after all.
 */
export async function sweepOrgPayments(options: {
  pendingTtlHours: number;
}): Promise<{ fulfilled: number; expired: number; recovered: number; errors: number }> {
  const out = { fulfilled: 0, expired: 0, recovered: 0, errors: 0 };
  const now = Date.now();
  const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
  const ttlCutoff = new Date(now - options.pendingTtlHours * 60 * 60 * 1000).toISOString();

  const { data: pending, error } = await db()
    .from('org_payment_transactions')
    .select('id, created_at, expires_at, provider_reference')
    .eq('status', 'pending')
    .lte('created_at', tenMinAgo)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);

  for (const txn of pending ?? []) {
    try {
      const result = await reconcilePendingOrgPaymentTransaction(txn.id as string, { force: true });
      if (result === 'fulfilled') {
        out.fulfilled += 1;
        continue;
      }
      if (result === 'expired') {
        out.expired += 1;
        continue;
      }
      const expiresAt = txn.expires_at
        ? new Date(txn.expires_at as string).toISOString()
        : (txn.created_at as string) <= ttlCutoff
          ? ttlCutoff
          : null;
      if (expiresAt && new Date(expiresAt).getTime() <= now) {
        await expireOrgCheckout(txn.id as string);
        out.expired += 1;
      }
    } catch (err) {
      console.error('[orgPaymentReconcile] sweep pending failed', txn.id, err);
      out.errors += 1;
    }
  }

  // Closed checkouts (expired by TTL, replaced, or marked failed by a stale event) that were
  // actually paid. Looks back a week; each is checked once an hour at most.
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const { data: closed, error: closedError } = await db()
    .from('org_payment_transactions')
    .select('id, provider_reference, payment_method_type')
    .in('status', ['expired', 'failed'])
    .not('provider_reference', 'is', null)
    .gte('created_at', weekAgo)
    .or(`last_reconciled_at.is.null,last_reconciled_at.lte.${hourAgo}`)
    .order('created_at', { ascending: false })
    .limit(25);
  if (closedError) throw new Error(closedError.message);

  for (const txn of closed ?? []) {
    try {
      await stampReconciled(txn.id as string);
      const state = await getPaymongoProviderPaymentState(txn.provider_reference as string);
      if (state !== 'paid') continue;
      const result = await fulfillOrgSubscriptionPayment({
        transactionId: txn.id as string,
        providerReference: txn.provider_reference as string,
        paymentMethodType:
          typeof txn.payment_method_type === 'string' ? txn.payment_method_type : 'qrph',
        paidAt: new Date().toISOString(),
        rawPayload: { source: 'sweep_recovery', provider_reference: txn.provider_reference },
        allowReopen: true,
      });
      if (result.applied !== undefined) out.recovered += 1;
    } catch (err) {
      console.error('[orgPaymentReconcile] sweep recovery failed', txn.id, err);
      out.errors += 1;
    }
  }

  return out;
}
