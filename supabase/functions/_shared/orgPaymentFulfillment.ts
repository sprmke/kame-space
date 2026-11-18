/**
 * Applies a collected PayMongo payment to the org subscription. Money is never ignored:
 *
 *  1. The transaction is claimed (pending -> paid) so a webhook, a reconcile and a retry can never
 *     apply the same payment twice.
 *  2. The checkout's stored intent is validated against the subscription as it is now
 *     (orgPaymentIntent.ts). A valid payment is applied; a stale one (already renewed, plan
 *     changed, subscription ended) is kept as account credit and the owner is told.
 *  3. If applying throws, the row stays `paid` with `applied = false` and a reason, and the cron
 *     retries it. The host's money is on record either way.
 *
 * Apply steps are idempotent: they derive periods from the intent and the payment time, not from
 * "now", so a retry after a partial failure lands on the same state.
 */

import { extractPaidPaymentId } from './paymongoWebhookMetadata.ts';
import { createServiceClient } from './orgAuth.ts';
import { addBillingMonths, manilaDayOfMonth, nextPeriodEndAfter } from './billingPeriod.ts';
import { buildActorContext, logActivity } from './activityLog.ts';
import { listBillablePropertyIds } from './orgBillableProperties.ts';
import { addLedgerEntry, applyQuoteToLedger } from './orgBillingLedger.ts';
import { loadOrgBillingOrgContext, notifyOrgBilling } from './orgBillingNotify.ts';
import { formatPhp } from './orgBillingMessages.ts';
import {
  legacyPaymentIntent,
  parsePaymentIntent,
  staleReasonMessage,
  validatePaymentIntent,
  type PaymentIntent,
  type StaleReason,
} from './orgPaymentIntent.ts';
import {
  changeOrgSubscription,
  createOrgSubscription,
  getActiveOrgSubscription,
  writeOrgSubscriptionEvent,
} from './planEntitlements.ts';
import { capturePostHogEvent } from './posthog.ts';
import { captureSentryMessage } from './sentry.ts';

type TxnRow = {
  id: string;
  organization_id: string;
  org_subscription_id: string | null;
  plan_id: string;
  property_ids: string[] | null;
  provider_reference: string | null;
  status: string;
  amount: number | string;
  paid_at: string | null;
  applied: boolean | null;
  intent: unknown;
  apply_attempts: number | null;
  purpose: string | null;
};

export type FulfillResult = { applied: boolean; reason?: string };

const sb = () => createServiceClient();

const webhookActor = () => buildActorContext('webhook', { webhook: 'paymongo' });

/**
 * Claim and apply a collected payment. Safe to call repeatedly for the same transaction.
 * `allowReopen` lets a payment on an expired / failed checkout through (money arrived anyway).
 */
export async function fulfillOrgSubscriptionPayment(input: {
  transactionId: string;
  providerReference?: string | null;
  paymentMethodType?: string | null;
  paidAt?: string | null;
  /** PayMongo payment id (pay_...). Taken from the payload when omitted; reconcile passes it. */
  providerPaymentId?: string | null;
  rawPayload?: Record<string, unknown>;
  assignedByUserId?: string | null;
  allowReopen?: boolean;
}): Promise<FulfillResult> {
  const db = sb();
  const { data: txn, error: txnError } = await db
    .from('org_payment_transactions')
    .select(
      'id, organization_id, org_subscription_id, plan_id, property_ids, provider_reference, status, amount, paid_at, applied, intent, apply_attempts, purpose'
    )
    .eq('id', input.transactionId)
    .maybeSingle();
  if (txnError) throw new Error(txnError.message);
  if (!txn) throw new Error('Org payment transaction not found');
  const row = txn as TxnRow;

  if (row.status === 'paid' || row.status === 'refunded') {
    return { applied: row.applied !== false };
  }

  if (row.status !== 'pending') {
    if (!input.allowReopen) return { applied: false, reason: 'not_pending' };
    const { data: reopened, error: reopenError } = await db
      .from('org_payment_transactions')
      .update({ status: 'pending', failure_reason: null })
      .eq('id', row.id)
      .in('status', ['expired', 'failed', 'cancelled'])
      .select('id')
      .maybeSingle();
    if (reopenError) throw new Error(reopenError.message);
    if (!reopened) return { applied: false, reason: 'not_pending' };
  }

  const paidAt = input.paidAt ?? new Date().toISOString();
  const { data: claimed, error: claimError } = await db
    .from('org_payment_transactions')
    .update({
      status: 'paid',
      paid_at: paidAt,
      provider_reference: input.providerReference ?? row.provider_reference,
      payment_method_type: input.paymentMethodType ?? null,
      raw_webhook_payload: input.rawPayload ?? null,
      provider_payment_id:
        input.providerPaymentId ??
        (input.rawPayload ? extractPaidPaymentId(input.rawPayload) : null),
      failure_reason: null,
      applied: null,
      review_reason: null,
      apply_attempts: Number(row.apply_attempts ?? 0) + 1,
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return { applied: false, reason: 'claimed_elsewhere' };

  const { error: receiptError } = await db.rpc('assign_org_payment_receipt', {
    p_transaction_id: row.id,
  });
  if (receiptError) console.error('[orgPaymentFulfillment] receipt number failed', receiptError);

  return await applyPaidTransaction(row.id, input.assignedByUserId ?? null);
}

/**
 * Applies a paid transaction that has not been applied yet. Called right after the claim and by
 * the cron retry for rows left `applied = null` / `applied = false` by a crash or an error.
 */
export async function applyPaidTransaction(
  transactionId: string,
  assignedBy: string | null
): Promise<FulfillResult> {
  const db = sb();
  const { data: txn, error } = await db
    .from('org_payment_transactions')
    .select(
      'id, organization_id, org_subscription_id, plan_id, property_ids, provider_reference, status, amount, paid_at, applied, intent, apply_attempts, purpose'
    )
    .eq('id', transactionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!txn) throw new Error('Org payment transaction not found');
  const row = txn as TxnRow;
  if (row.status !== 'paid') return { applied: false, reason: 'not_paid' };
  if (row.applied === true) return { applied: true };

  try {
    return await applyPaidTransactionUnsafe(row, assignedBy);
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    await db
      .from('org_payment_transactions')
      .update({
        applied: false,
        review_reason: `fulfillment_error: ${message}`.slice(0, 500),
      })
      .eq('id', row.id);
    await captureSentryMessage('org payment collected but not applied', {
      logPrefix: 'org-payment-fulfillment',
      level: 'error',
      tags: { provider: 'paymongo', stage: 'apply' },
      fingerprint: ['org_payment', 'apply_failed'],
      extra: { transactionId: row.id, organizationId: row.organization_id, message },
    });
    throw err;
  }
}

async function applyPaidTransactionUnsafe(
  row: TxnRow,
  assignedBy: string | null
): Promise<FulfillResult> {
  const db = sb();
  const organizationId = row.organization_id;
  const amountPhp = Number(row.amount ?? 0);
  const paidAt = row.paid_at ? new Date(row.paid_at) : new Date();

  const live = await getActiveOrgSubscription(organizationId);
  const intent: PaymentIntent =
    parsePaymentIntent(row.intent) ??
    legacyPaymentIntent({
      planId: row.plan_id,
      propertyCount: (row.property_ids ?? []).length,
      amountPhp,
      sub: live
        ? {
            id: live.id,
            status: live.status,
            planId: live.planId,
            scheduledPlanId: live.scheduledPlanId,
            currentPeriodEnd: live.currentPeriodEnd,
          }
        : null,
    });

  // A retry after a partial failure already has its subscription recorded on the row.
  const resumedSubscriptionId = row.org_subscription_id;
  let mode: 'create' | 'fresh' | 'anchored';

  if (resumedSubscriptionId) {
    const anchored =
      (intent.purpose === 'renewal' || intent.purpose === 'retry') &&
      intent.baseStatus !== 'suspended';
    mode = anchored ? 'anchored' : 'fresh';
  } else {
    const verdict = validatePaymentIntent(
      intent,
      live
        ? {
            id: live.id,
            status: live.status,
            planId: live.planId,
            scheduledPlanId: live.scheduledPlanId,
            currentPeriodEnd: live.currentPeriodEnd,
          }
        : null
    );
    if (!verdict.ok) {
      await creditStalePayment(row, verdict.reason);
      return { applied: false, reason: verdict.reason };
    }
    mode = verdict.mode;
  }

  const billable = await listBillablePropertyIds(organizationId);
  if (billable.length === 0) {
    await creditStalePayment(row, 'subscription_ended');
    return { applied: false, reason: 'no_properties' };
  }

  let subscriptionId = resumedSubscriptionId ?? live?.id ?? null;
  const previousStatus = live?.status ?? null;
  const previousPlanId = live?.planId ?? null;

  if (!resumedSubscriptionId) {
    if (mode === 'create') {
      const created = await createOrgSubscription(
        organizationId,
        intent.planId,
        billable,
        assignedBy
      );
      subscriptionId = created.orgSubscriptionId;
    } else if (mode === 'fresh') {
      await changeOrgSubscription(live!.id, intent.planId, billable, assignedBy, {
        refreshPricing: true,
      });
    } else {
      // anchored renewal
      const scheduled = live!.scheduledPlanId && intent.planId === live!.scheduledPlanId;
      const oldEnd = live!.currentPeriodEnd ? new Date(live!.currentPeriodEnd) : paidAt;
      if (scheduled) {
        // Paid early for the lower plan: keep the current plan until the old period ends.
        if (paidAt.getTime() >= oldEnd.getTime()) {
          await changeOrgSubscription(live!.id, intent.planId, billable, assignedBy);
        }
      } else {
        await changeOrgSubscription(live!.id, live!.planId, billable, assignedBy, {
          refreshPricing: intent.pricingRefresh === true,
        });
      }
    }
    if (subscriptionId) {
      await db
        .from('org_payment_transactions')
        .update({ org_subscription_id: subscriptionId })
        .eq('id', row.id);
    }
  }

  if (!subscriptionId) throw new Error('Subscription missing after payment');

  const { data: subRow, error: subError } = await db
    .from('org_subscriptions')
    .select(
      'id, plan_id, status, current_period_end, billing_anchor_day, scheduled_plan_id, scheduled_change_at'
    )
    .eq('id', subscriptionId)
    .maybeSingle();
  if (subError) throw new Error(subError.message);
  if (!subRow) throw new Error('Subscription not found');

  let periodStart: Date;
  let periodEnd: Date;
  const patch: Record<string, unknown> = {
    status: 'active',
    source: 'purchase',
    grace_period_ends_at: null,
    suspended_at: null,
    period_paid_php: intent.targetTotalPhp,
  };

  if (mode === 'anchored') {
    const baseEnd = intent.basePeriodEnd ? new Date(intent.basePeriodEnd) : paidAt;
    const anchorDay = (subRow.billing_anchor_day as number | null) ?? manilaDayOfMonth(baseEnd);
    periodStart = baseEnd;
    periodEnd = nextPeriodEndAfter(periodStart, anchorDay, paidAt);
    patch.billing_anchor_day = anchorDay;

    const scheduledIntent =
      subRow.scheduled_plan_id && intent.planId === (subRow.scheduled_plan_id as string);
    if (scheduledIntent && paidAt.getTime() >= baseEnd.getTime()) {
      patch.scheduled_plan_id = null;
      patch.scheduled_change_at = null;
      patch.scheduled_by = null;
    }
  } else {
    periodStart = paidAt;
    periodEnd = addBillingMonths(paidAt, manilaDayOfMonth(paidAt), 1);
    patch.billing_anchor_day = manilaDayOfMonth(paidAt);
    patch.scheduled_plan_id = null;
    patch.scheduled_change_at = null;
    patch.scheduled_by = null;
    patch.cancel_at_period_end = false;
    patch.cancel_requested_at = null;
    patch.cancel_reason = null;
  }
  patch.current_period_start = periodStart.toISOString();
  patch.current_period_end = periodEnd.toISOString();

  const { error: patchError } = await db
    .from('org_subscriptions')
    .update(patch)
    .eq('id', subscriptionId);
  if (patchError) throw new Error(patchError.message);

  await applyQuoteToLedger({
    organizationId,
    transactionId: row.id,
    orgSubscriptionId: subscriptionId,
    quote: intent,
    leftoverKind: intent.newCreditPhp > 0 && amountPhp > 0 ? 'overpayment' : 'proration_credit',
  });

  const { error: finalizeError } = await db
    .from('org_payment_transactions')
    .update({
      applied: true,
      review_reason: null,
      purpose: intent.purpose,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      org_subscription_id: subscriptionId,
    })
    .eq('id', row.id);
  if (finalizeError) throw new Error(finalizeError.message);

  await afterApplied({
    row,
    intent,
    mode,
    subscriptionId,
    previousStatus,
    previousPlanId,
    periodEnd,
    amountPhp,
    assignedBy,
    propertyCount: billable.length,
  });

  return { applied: true };
}

async function afterApplied(input: {
  row: TxnRow;
  intent: PaymentIntent;
  mode: 'create' | 'fresh' | 'anchored';
  subscriptionId: string;
  previousStatus: string | null;
  previousPlanId: string | null;
  periodEnd: Date;
  amountPhp: number;
  assignedBy: string | null;
  propertyCount: number;
}): Promise<void> {
  const { row, intent } = input;
  const organizationId = row.organization_id;
  const db = sb();

  try {
    const { data: planRow } = await db
      .from('pricing_plans')
      .select('name')
      .eq('id', intent.planId)
      .maybeSingle();
    const planName = String(planRow?.name ?? 'Plan');
    const { data: receiptRow } = await db
      .from('org_payment_transactions')
      .select('receipt_number')
      .eq('id', row.id)
      .maybeSingle();
    const orgCtx = await loadOrgBillingOrgContext(organizationId);

    const reactivated = input.previousStatus === 'suspended' || input.previousStatus === 'past_due';
    await writeOrgSubscriptionEvent({
      orgSubscriptionId: input.subscriptionId,
      eventType: reactivated ? 'reactivated' : input.mode === 'create' ? 'assigned' : 'renewed',
      previousStatus: input.previousStatus,
      newStatus: 'active',
      newPlanId: intent.planId,
      note: `Payment received (${intent.purpose})`,
      createdBy: input.assignedBy,
    }).catch(() => undefined);

    await logActivity({
      action: 'billing.payment_received',
      organizationId,
      scope: 'org',
      actor: webhookActor(),
      targetType: 'subscription',
      targetId: organizationId,
      targetLabel: orgCtx.orgName,
      metadata: {
        amount: Math.round(input.amountPhp),
        purpose: intent.purpose,
        plan_name: planName,
        transaction_id: row.id,
      },
    });
    if (reactivated) {
      await logActivity({
        action: 'billing.subscription_reactivated',
        organizationId,
        scope: 'org',
        actor: webhookActor(),
        targetType: 'subscription',
        targetId: organizationId,
        targetLabel: orgCtx.orgName,
        metadata: { plan_name: planName },
      });
    } else if (input.mode === 'anchored') {
      await logActivity({
        action: 'billing.subscription_renewed',
        organizationId,
        scope: 'org',
        actor: webhookActor(),
        targetType: 'subscription',
        targetId: organizationId,
        targetLabel: orgCtx.orgName,
        metadata: { plan_name: planName, via: 'payment' },
      });
    } else if (input.mode === 'create') {
      await logActivity({
        action: 'billing.subscription_activated',
        organizationId,
        scope: 'org',
        actor: webhookActor(),
        targetType: 'subscription',
        targetId: organizationId,
        targetLabel: orgCtx.orgName,
        metadata: { plan_name: planName },
      });
    }

    // The checkout completed on the server, so the browser's old event is deliberately not
    // re-emitted: one outcome, one source (plan F-22).
    await capturePostHogEvent('org_plan_checkout_completed', {
      logPrefix: 'org-payment-fulfillment',
      distinctId: input.assignedBy ?? undefined,
      groups: { organization: organizationId },
      properties: {
        plan_id: intent.planId,
        interval: 'monthly',
        is_upgrade: input.mode !== 'anchored',
        purpose: intent.purpose,
      },
    });
    if (input.previousPlanId !== intent.planId && input.mode !== 'anchored') {
      await capturePostHogEvent('org_plan_changed', {
        logPrefix: 'org-payment-fulfillment',
        distinctId: input.assignedBy ?? undefined,
        groups: { organization: organizationId },
        properties: {
          from_plan: input.previousPlanId ?? 'free',
          to_plan: intent.planId,
          cause: 'upgrade',
        },
      });
    }

    const periodLabel = input.periodEnd.toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    await notifyOrgBilling({
      organizationId,
      kind: 'receipt',
      context: orgCtx,
      params: {
        planName,
        amountPhp: input.amountPhp,
        propertyCount: input.propertyCount,
        dateLabel: periodLabel,
        receiptNumber: (receiptRow?.receipt_number as string | null) ?? null,
        purpose: intent.purpose,
      },
    });
    if (reactivated) {
      await notifyOrgBilling({
        organizationId,
        kind: 'reactivated',
        context: orgCtx,
        params: { planName },
        periodKey: row.id,
      });
    }
  } catch (err) {
    // The subscription is already correct. A failed email or log must not undo or retry it.
    console.error('[orgPaymentFulfillment] post-apply side effects failed', err);
  }
}

/** A payment that no longer fits the subscription becomes account credit (never dropped). */
async function creditStalePayment(row: TxnRow, reason: StaleReason): Promise<void> {
  const db = sb();
  const amountPhp = Math.round(Number(row.amount ?? 0));
  const message = staleReasonMessage(reason);

  if (amountPhp > 0) {
    await addLedgerEntry({
      organizationId: row.organization_id,
      amountPhp: -amountPhp,
      kind: reason === 'period_already_renewed' ? 'overpayment' : 'stale_payment',
      transactionId: row.id,
      note: message,
    });
  }

  await db
    .from('org_payment_transactions')
    .update({ applied: false, review_reason: `stale: ${reason}`.slice(0, 500) })
    .eq('id', row.id);

  await captureSentryMessage('org payment kept as account credit', {
    logPrefix: 'org-payment-fulfillment',
    level: 'warning',
    tags: { provider: 'paymongo', stage: 'stale_payment', reason },
    fingerprint: ['org_payment', 'stale', reason],
    extra: { transactionId: row.id, organizationId: row.organization_id, amountPhp },
  });

  try {
    const orgCtx = await loadOrgBillingOrgContext(row.organization_id);
    await logActivity({
      action: 'billing.payment_credited',
      organizationId: row.organization_id,
      scope: 'org',
      actor: webhookActor(),
      targetType: 'subscription',
      targetId: row.organization_id,
      targetLabel: orgCtx.orgName,
      metadata: { amount: amountPhp, reason, transaction_id: row.id, detail: message },
    });
    if (row.org_subscription_id) {
      await writeOrgSubscriptionEvent({
        orgSubscriptionId: row.org_subscription_id,
        eventType: 'payment_unapplied',
        note: `${message} (${formatPhp(amountPhp)} kept as account credit)`,
      }).catch(() => undefined);
    }
    await notifyOrgBilling({
      organizationId: row.organization_id,
      kind: 'payment_credited',
      context: orgCtx,
      params: { amountPhp },
      periodKey: row.id,
    });
  } catch (err) {
    console.error('[orgPaymentFulfillment] stale payment side effects failed', err);
  }
}

/**
 * Cron retry: payments that were collected but never applied (crash mid-way, transient error).
 * Rows that were deliberately kept as credit (`stale:`) are not retried.
 */
export async function retryUnappliedOrgPayments(): Promise<{ retried: number; errors: number }> {
  const db = sb();
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: rows, error } = await db
    .from('org_payment_transactions')
    .select('id, applied, review_reason, apply_attempts, paid_at')
    .eq('status', 'paid')
    .or('applied.is.null,applied.eq.false')
    .lt('apply_attempts', 5)
    .lte('paid_at', staleBefore)
    .order('paid_at', { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);

  let retried = 0;
  let errors = 0;
  for (const raw of rows ?? []) {
    const reason = String(raw.review_reason ?? '');
    if (raw.applied === false && !reason.startsWith('fulfillment_error')) continue;
    try {
      await db
        .from('org_payment_transactions')
        .update({ apply_attempts: Number(raw.apply_attempts ?? 0) + 1 })
        .eq('id', raw.id as string);
      await applyPaidTransaction(raw.id as string, null);
      retried += 1;
    } catch (err) {
      console.error('[orgPaymentFulfillment] retry failed', raw.id, err);
      errors += 1;
    }
  }
  return { retried, errors };
}
