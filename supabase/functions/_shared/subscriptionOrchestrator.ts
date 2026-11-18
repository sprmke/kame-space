/**
 * Org subscription billing: PayMongo webhook handling and the hourly billing cycle.
 * State changes live in orgPaymentFulfillment.ts (payments) and orgBillingLifecycle.ts
 * (transitions); this module decides which one runs and when. Never inline in handlers.
 */

import { createServiceClient } from './orgAuth.ts';
import { buildActorContext, logActivity } from './activityLog.ts';
import { formatManilaDateLabel } from './billingPeriod.ts';
import { getPaymongoProviderPaymentState, isPaymongoTestMode } from './paymongoClient.ts';
import { handleParkingPaymentWebhookEvent } from './parkingPaymentOrchestrator.ts';
import {
  extractRefundedPaymentId,
  extractWebhookInner,
  paymentMethodFromWebhookPayload,
  readMetadataString,
  readWebhookKind,
} from './paymongoWebhookMetadata.ts';
import { listBillablePropertyIds } from './orgBillableProperties.ts';
import { loadQuotePlan, toSubscriptionState } from './orgBillingContext.ts';
import {
  applyScheduledPlan,
  endAtPeriodEnd,
  endForNonPayment,
  endWithoutProperties,
  markPastDue,
  suspendSubscription,
} from './orgBillingLifecycle.ts';
import { addLedgerEntry, getLedgerBalancePhp } from './orgBillingLedger.ts';
import { computePaymentQuote } from './orgBillingQuote.ts';
import {
  loadOrgBillingOrgContext,
  notifyOrgBilling,
  notifyOrgBillingOnce,
} from './orgBillingNotify.ts';
import { createOrgSubscriptionCheckoutLink } from './orgSubscriptionCheckout.ts';
import {
  fulfillOrgSubscriptionPayment,
  retryUnappliedOrgPayments,
} from './orgPaymentFulfillment.ts';
import { sweepOrgPayments } from './orgPaymentReconcile.ts';
import {
  type BillingContext,
  type BillingTransition,
  dueReminders,
  nextBillingTransition,
} from './orgSubscriptionStateMachine.ts';
import {
  changeOrgSubscription,
  getActiveOrgSubscription,
  loadOrgEligiblePlan,
  type OrgSubscriptionRow,
  reconcileTeamSeatsForProperty,
  resolveSubscriptionTotalPhp,
  writeOrgSubscriptionEvent,
} from './planEntitlements.ts';
import {
  getPlatformPaymentSettings,
  type PlatformPaymentSettings,
} from './platformPaymentSettings.ts';
import { expireHostVerificationRewards } from './hostVerificationReward.ts';

export { fulfillOrgSubscriptionPayment, getPlatformPaymentSettings, type PlatformPaymentSettings };

const db = () => createServiceClient();
const DAY_MS = 24 * 60 * 60 * 1000;
const cronActor = () => buildActorContext('cron', { cron: 'platform-billing-cron' });
const webhookActor = () => buildActorContext('webhook', { webhook: 'paymongo' });

export function paymongoLivemodeFromEnv(): boolean {
  return !isPaymongoTestMode();
}

// ─── Webhook ─────────────────────────────────────────────────────────────────────

type OrgPaymentTransactionRow = {
  id: string;
  organization_id: string;
  org_subscription_id: string | null;
  plan_id: string;
  property_ids: string[];
  provider_reference: string | null;
  status: string;
  amount: number;
};

export async function markOrgPaymentFailed(
  transactionId: string,
  failureReason: string,
  rawPayload?: Record<string, unknown>
): Promise<void> {
  const { error } = await db()
    .from('org_payment_transactions')
    .update({
      status: 'failed',
      failure_reason: failureReason.slice(0, 500),
      raw_webhook_payload: rawPayload ?? null,
    })
    .eq('id', transactionId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}

export async function resolveOrgTransactionFromWebhookPayload(
  payload: Record<string, unknown>
): Promise<OrgPaymentTransactionRow | null> {
  const sb = db();
  const { inner, metadata } = extractWebhookInner(payload);

  const transactionId = readMetadataString(metadata, 'transaction_id');
  if (transactionId) {
    const { data } = await sb
      .from('org_payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .maybeSingle();
    return (data as OrgPaymentTransactionRow | null) ?? null;
  }

  const checkoutSessionId =
    (inner?.type === 'checkout_session' ? String(inner.id ?? '') : '') ||
    readMetadataString(metadata, 'checkout_session_id');
  if (checkoutSessionId) {
    const { data } = await sb
      .from('org_payment_transactions')
      .select('*')
      .eq('provider_reference', checkoutSessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as OrgPaymentTransactionRow | null) ?? null;
  }

  const linkId =
    (inner?.type === 'link' ? String(inner.id ?? '') : '') ||
    readMetadataString(metadata, 'link_id');
  const providerRef =
    linkId || (inner?.type === 'payment' && typeof inner.id === 'string' ? inner.id : null) || null;
  if (!providerRef) return null;

  const { data } = await sb
    .from('org_payment_transactions')
    .select('*')
    .eq('provider_reference', providerRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as OrgPaymentTransactionRow | null) ?? null;
}

export async function handlePaymongoWebhookEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ handled: boolean; action?: string }> {
  const normalized = eventType.toLowerCase();

  // Dispatch by metadata.kind first — without this, a parking-payment webhook would fall
  // through into the org-subscription lookup below and silently no-op (different table, no
  // match found). 'org_subscription' or absent kind (older links) both take the org path.
  const kind = readWebhookKind(payload);
  if (kind === 'parking_booking') {
    return handleParkingPaymentWebhookEvent(normalized, payload);
  }

  if (normalized === 'payment.failed') {
    const orgTxn = await resolveOrgTransactionFromWebhookPayload(payload);
    if (!orgTxn || orgTxn.status !== 'pending') return { handled: false };

    // A stale "failed" event can arrive after the host paid on a retry.
    const paymongoState = await getPaymongoProviderPaymentState(orgTxn.provider_reference);
    if (paymongoState === 'paid') {
      const { metadata, innerAttrs } = extractWebhookInner(payload);
      await fulfillOrgSubscriptionPayment({
        transactionId: orgTxn.id,
        providerReference: orgTxn.provider_reference,
        paymentMethodType: paymentMethodFromWebhookPayload(payload),
        paidAt: new Date().toISOString(),
        rawPayload: payload,
        assignedByUserId: readMetadataString(metadata, 'initiated_by'),
        allowReopen: true,
      });
      void innerAttrs;
      return {
        handled: true,
        action: 'fulfilled_org_subscription_after_stale_failed_event',
      };
    }

    await markOrgPaymentFailed(orgTxn.id, 'Payment failed', payload);
    try {
      await notifyOrgBilling({
        organizationId: orgTxn.organization_id,
        kind: 'payment_failed',
        periodKey: orgTxn.id,
      });
    } catch (err) {
      console.error('[subscriptionOrchestrator] payment failed email', err);
    }
    return { handled: true, action: 'marked_org_failed' };
  }

  if (
    normalized === 'payment.paid' ||
    normalized === 'link.payment.paid' ||
    normalized === 'checkout_session.payment.paid'
  ) {
    const { innerAttrs, metadata } = extractWebhookInner(payload);
    const paidAtEpoch = innerAttrs?.paid_at;
    const paidAt =
      typeof paidAtEpoch === 'number'
        ? new Date(paidAtEpoch * 1000).toISOString()
        : new Date().toISOString();

    const orgTxn = await resolveOrgTransactionFromWebhookPayload(payload);
    if (!orgTxn) return { handled: false };
    // Already paid (a second event for the same payment): nothing to do.
    if (orgTxn.status === 'paid' || orgTxn.status === 'refunded') {
      return { handled: false };
    }

    // pending, or a checkout we had already closed (expired, replaced, failed): money arrived, so
    // it goes through the same validated path. A stale one becomes account credit.
    const result = await fulfillOrgSubscriptionPayment({
      transactionId: orgTxn.id,
      providerReference: orgTxn.provider_reference,
      paymentMethodType: paymentMethodFromWebhookPayload(payload),
      paidAt,
      rawPayload: payload,
      assignedByUserId: readMetadataString(metadata, 'initiated_by'),
      allowReopen: true,
    });
    return {
      handled: true,
      action: result.applied ? 'fulfilled_org_subscription' : 'payment_kept_as_credit',
    };
  }

  if (normalized === 'payment.refunded') {
    // A refund event's resource is the refund itself: it names the payment, not our checkout.
    let orgTxn = await resolveOrgTransactionFromWebhookPayload(payload);
    const refundedPaymentId = extractRefundedPaymentId(payload);
    if (!orgTxn && refundedPaymentId) {
      const { data } = await db()
        .from('org_payment_transactions')
        .select('*')
        .eq('provider_payment_id', refundedPaymentId)
        .maybeSingle();
      orgTxn = (data as OrgPaymentTransactionRow | null) ?? null;
    }
    if (!orgTxn || orgTxn.status !== 'paid') return { handled: false };
    await db()
      .from('org_payment_transactions')
      .update({ status: 'refunded', review_reason: 'refunded_in_paymongo' })
      .eq('id', orgTxn.id)
      .eq('status', 'paid');
    if (orgTxn.org_subscription_id) {
      await writeOrgSubscriptionEvent({
        orgSubscriptionId: orgTxn.org_subscription_id,
        eventType: 'ledger_entry',
        note: `Payment refunded in PayMongo (₱${Math.round(
          Number(orgTxn.amount)
        )}). Review the period.`,
      }).catch(() => undefined);
    }
    const ctx = await loadOrgBillingOrgContext(orgTxn.organization_id);
    await logActivity({
      action: 'billing.refund_recorded',
      organizationId: orgTxn.organization_id,
      scope: 'org',
      actor: webhookActor(),
      targetType: 'subscription',
      targetId: orgTxn.organization_id,
      targetLabel: ctx.orgName,
      metadata: {
        amount: Math.round(Number(orgTxn.amount)),
        transaction_id: orgTxn.id,
      },
    });
    return { handled: true, action: 'marked_org_refunded' };
  }

  return { handled: false };
}

// ─── Billing cycle ───────────────────────────────────────────────────────────────

type Counters = {
  subscriptionsChecked: number;
  renewalLinks: number;
  reminders: number;
  pastDue: number;
  suspended: number;
  canceled: number;
  scheduledApplied: number;
  renewedFromCredit: number;
  paymentsRecovered: number;
  paymentsRetried: number;
  checkoutsExpired: number;
  errors: number;
};

async function loadCronContext(
  sub: OrgSubscriptionRow,
  now: Date,
  settings: PlatformPaymentSettings
): Promise<BillingContext> {
  const billable = await listBillablePropertyIds(sub.organizationId);
  let covered = false;
  const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const relevant =
    end != null && end.getTime() - now.getTime() <= settings.renewalLinkLeadDays * DAY_MS;
  if (billable.length > 0 && relevant) {
    const ledger = await getLedgerBalancePhp(sub.organizationId);
    if (ledger < 0) {
      const nextPlanId = sub.scheduledPlanId ?? sub.planId;
      const plan = await loadOrgEligiblePlan(nextPlanId, {
        allowInactive: true,
      });
      const total = resolveSubscriptionTotalPhp(
        nextPlanId === sub.planId ? sub.priceOverridePhp : null,
        plan,
        billable.length,
        nextPlanId === sub.planId ? sub.pricingSnapshot : null
      );
      covered =
        total > 0 &&
        computePaymentQuote({
          targetTotalPhp: total,
          unusedCreditPhp: 0,
          ledgerBalancePhp: ledger,
          planLabel: '',
        }).coveredByCredit;
    }
  }
  return {
    billablePropertyCount: billable.length,
    renewalCoveredByCredit: covered,
  };
}

async function applyTransition(
  transition: BillingTransition,
  sub: OrgSubscriptionRow,
  settings: PlatformPaymentSettings,
  counters: Counters
): Promise<'continue' | 'stop'> {
  switch (transition.type) {
    case 'apply_scheduled_plan':
      await applyScheduledPlan(sub);
      counters.scheduledApplied += 1;
      return 'continue';
    case 'cancel_at_period_end':
      await endAtPeriodEnd(sub);
      counters.canceled += 1;
      return 'continue';
    case 'end_no_properties':
      await endWithoutProperties(sub);
      counters.canceled += 1;
      return 'continue';
    case 'auto_cancel':
      await endForNonPayment(sub);
      counters.canceled += 1;
      return 'continue';
    case 'mark_past_due': {
      const changed = await markPastDue(sub, transition.graceEndsAt);
      if (changed) counters.pastDue += 1;
      return 'continue';
    }
    case 'suspend': {
      const changed = await suspendSubscription(sub, settings);
      if (changed) counters.suspended += 1;
      return 'continue';
    }
    case 'renew_from_credit': {
      const result = await createOrgSubscriptionCheckoutLink({
        organizationId: sub.organizationId,
        planId: null,
        ignoreRenewalWindow: true,
      });
      if (!result.paidWithCredit) {
        // Credit no longer covers the renewal (the estimate was off): treat it as unpaid.
        if (sub.status === 'active' && sub.currentPeriodEnd) {
          const graceEndsAt = new Date(
            new Date(sub.currentPeriodEnd).getTime() + settings.gracePeriodDays * DAY_MS
          );
          if (await markPastDue(sub, graceEndsAt)) counters.pastDue += 1;
        }
        return 'stop';
      }
      if (result.paidWithCredit) {
        counters.renewedFromCredit += 1;
        const ctx = await loadOrgBillingOrgContext(sub.organizationId);
        await logActivity({
          action: 'billing.subscription_renewed',
          organizationId: sub.organizationId,
          scope: 'org',
          actor: cronActor(),
          targetType: 'subscription',
          targetId: sub.organizationId,
          targetLabel: ctx.orgName,
          metadata: { plan_name: result.planName, via: 'credit' },
        });
        await notifyOrgBillingOnce({
          organizationId: sub.organizationId,
          orgSubscriptionId: sub.id,
          kind: 'renewed_from_credit',
          periodKey: result.transactionId,
          params: {
            planName: result.planName,
            dateLabel: result.periodEnd
              ? formatManilaDateLabel(new Date(result.periodEnd))
              : undefined,
          },
        });
      }
      return 'continue';
    }
    case 'trial_ended':
      // Reward trials are closed by expireHostVerificationRewards at the end of the cycle.
      return 'stop';
  }
}

async function sendReminders(
  sub: OrgSubscriptionRow,
  now: Date,
  settings: PlatformPaymentSettings,
  ctx: BillingContext,
  counters: Counters
): Promise<void> {
  const reminders = dueReminders(toSubscriptionState(sub), now, settings, ctx);
  if (reminders.length === 0) return;

  const nextPlanId = sub.scheduledPlanId ?? sub.planId;

  for (const reminder of reminders) {
    const periodKey = `${reminder.periodKey}:${nextPlanId}`;
    let checkoutUrl: string | null = null;
    let planName = sub.scheduledPlanId ? '' : sub.planName;
    let amountPhp: number | undefined;
    let periodEnd = sub.currentPeriodEnd;

    // Every payment reminder carries a live link. Reuses the open checkout when there is one.
    try {
      const checkout = await createOrgSubscriptionCheckoutLink({
        organizationId: sub.organizationId,
        planId: null,
        ignoreRenewalWindow: true,
      });
      checkoutUrl = checkout.checkoutUrl;
      planName = checkout.planName || planName;
      amountPhp = checkout.chargePhp;
      if (reminder.kind === 'renewal_link' && !checkout.reused) {
        counters.renewalLinks += 1;
      }
    } catch (err) {
      console.error(
        '[platform-billing-cron] reminder link',
        sub.organizationId,
        reminder.kind,
        err
      );
      counters.errors += 1;
      continue;
    }

    if (!planName) {
      const plan = await loadQuotePlan(nextPlanId, { allowInactive: true });
      planName = plan.name;
    }
    const dateLabel = periodEnd ? formatManilaDateLabel(new Date(periodEnd)) : undefined;
    const trialDays = sub.currentPeriodEnd
      ? Math.max(1, Math.ceil((new Date(sub.currentPeriodEnd).getTime() - now.getTime()) / DAY_MS))
      : 1;

    const outcome = await notifyOrgBillingOnce({
      organizationId: sub.organizationId,
      orgSubscriptionId: sub.id,
      kind:
        reminder.kind === 'trial_ending_3' || reminder.kind === 'trial_ending_1'
          ? 'trial_ending'
          : reminder.kind,
      periodKey: `${reminder.kind}:${periodKey}`,
      params: {
        planName,
        amountPhp,
        dateLabel,
        daysLeft: reminder.kind === 'trial_ending_1' ? 1 : trialDays,
        graceEndLabel: sub.graceEndsAt
          ? formatManilaDateLabel(new Date(sub.graceEndsAt))
          : undefined,
        checkoutUrl,
      },
    });
    if (outcome === 'sent') {
      counters.reminders += 1;
      if (reminder.kind === 'renewal_link') {
        const orgCtx = await loadOrgBillingOrgContext(sub.organizationId);
        await logActivity({
          action: 'billing.renewal_link_sent',
          organizationId: sub.organizationId,
          scope: 'org',
          actor: cronActor(),
          targetType: 'subscription',
          targetId: sub.organizationId,
          targetLabel: orgCtx.orgName,
          metadata: { plan_name: planName },
        });
      }
    }
  }
}

/**
 * Hourly job. Idempotent: every transition is a compare-and-set, every notification is
 * send-once, so overlapping runs and multi-day outages catch up in order without doubling up.
 */
export async function runPlatformBillingCycle(
  options: { organizationIds?: string[] } = {}
): Promise<Record<string, number>> {
  const sb = db();
  // Scoped runs (tests, a support "run for this org") touch only these orgs: no global payment
  // sweeps and no reward sweep.
  const scope = options.organizationIds?.length ? new Set(options.organizationIds) : null;
  const settings = await getPlatformPaymentSettings();
  const now = new Date();
  const counters: Counters = {
    subscriptionsChecked: 0,
    renewalLinks: 0,
    reminders: 0,
    pastDue: 0,
    suspended: 0,
    canceled: 0,
    scheduledApplied: 0,
    renewedFromCredit: 0,
    paymentsRecovered: 0,
    paymentsRetried: 0,
    checkoutsExpired: 0,
    errors: 0,
  };

  // 1. Money first: reconcile missed webhooks, close expired checkouts, retry unapplied payments.
  if (!scope) {
    try {
      const sweep = await sweepOrgPayments({
        pendingTtlHours: settings.pendingCheckoutTtlHours,
      });
      counters.paymentsRecovered = sweep.fulfilled + sweep.recovered;
      counters.checkoutsExpired = sweep.expired;
      counters.errors += sweep.errors;
    } catch (err) {
      console.error('[platform-billing-cron] payment sweep', err);
      counters.errors += 1;
    }
    try {
      const retry = await retryUnappliedOrgPayments();
      counters.paymentsRetried = retry.retried;
      counters.errors += retry.errors;
    } catch (err) {
      console.error('[platform-billing-cron] unapplied retry', err);
      counters.errors += 1;
    }
  }

  // 2. Subscriptions that can have something due.
  const horizon = new Date(now.getTime() + Math.max(settings.renewalLinkLeadDays, 3) * DAY_MS);
  const orgIds = new Set<string>();
  // Page every selection by organization_id so a backlog larger than one page is worked through
  // in full instead of the same first page being returned every hour.
  const dueQueries = [
    () =>
      sb
        .from('org_subscriptions')
        .select('organization_id')
        .in('status', ['past_due', 'suspended']),
    () =>
      sb
        .from('org_subscriptions')
        .select('organization_id')
        .in('status', ['active', 'trialing'])
        .not('current_period_end', 'is', null)
        .lte('current_period_end', horizon.toISOString()),
    () =>
      sb
        .from('org_subscriptions')
        .select('organization_id')
        .eq('status', 'active')
        .not('scheduled_plan_id', 'is', null),
  ];
  const PAGE = 500;
  for (const build of dueQueries) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build()
        .order('organization_id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const id = row.organization_id as string;
        if (!scope || scope.has(id)) orgIds.add(id);
      }
      if ((data ?? []).length < PAGE) break;
    }
  }

  for (const organizationId of orgIds) {
    try {
      let sub = await getActiveOrgSubscription(organizationId);
      if (!sub) continue;
      counters.subscriptionsChecked += 1;
      const ctx = await loadCronContext(sub, now, settings);

      for (let step = 0; step < 6 && sub; step += 1) {
        const transition = nextBillingTransition(toSubscriptionState(sub), now, settings, ctx);
        if (!transition) break;
        const control = await applyTransition(transition, sub, settings, counters);
        if (control === 'stop') break;
        sub = await getActiveOrgSubscription(organizationId);
      }

      if (sub) await sendReminders(sub, now, settings, ctx, counters);
    } catch (err) {
      console.error('[platform-billing-cron] subscription', organizationId, err);
      counters.errors += 1;
    }
  }

  // 3. Reward trials that reached their end.
  if (scope) return counters as unknown as Record<string, number>;
  try {
    const rewardSweep = await expireHostVerificationRewards();
    (counters as Record<string, number>).rewardExpired = rewardSweep.expired;
    (counters as Record<string, number>).rewardExpireErrors = rewardSweep.errors;
  } catch (err) {
    console.error('[platform-billing-cron] host verification reward expiry', err);
    counters.errors += 1;
  }

  return counters as unknown as Record<string, number>;
}

// ─── Super-admin helpers ─────────────────────────────────────────────────────────

/**
 * Manual period extension (goodwill, bank transfer received outside PayMongo). Moves the
 * scheduled-change date with the period so a pending downgrade does not fire early.
 */
export async function adminExtendOrgSubscription(input: {
  organizationId: string;
  periodEndIso: string;
  status?: 'active' | 'past_due' | 'suspended' | 'canceled';
  note?: string | null;
  adminUserId: string;
}): Promise<void> {
  const sb = db();
  const { data: sub, error } = await sb
    .from('org_subscriptions')
    .select('id, status, plan_id, scheduled_plan_id')
    .eq('organization_id', input.organizationId)
    .in('status', ['active', 'trialing', 'past_due', 'suspended'])
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sub) throw new Error('No live subscription for organization');

  const patch: Record<string, unknown> = {
    current_period_end: input.periodEndIso,
    grace_period_ends_at: null,
    suspended_at: null,
  };
  if (sub.scheduled_plan_id) patch.scheduled_change_at = input.periodEndIso;
  if (input.status) patch.status = input.status;
  else if (sub.status === 'past_due' || sub.status === 'suspended') {
    patch.status = 'active';
  }

  const { error: updateError } = await sb.from('org_subscriptions').update(patch).eq('id', sub.id);
  if (updateError) throw new Error(updateError.message);

  await writeOrgSubscriptionEvent({
    orgSubscriptionId: sub.id as string,
    eventType: 'status_changed',
    previousStatus: sub.status as string,
    newStatus: (patch.status as string | undefined) ?? (sub.status as string),
    note: input.note ?? 'Super-admin manual billing extension',
    createdBy: input.adminUserId,
  });

  const restoredFromSuspension =
    sub.status === 'suspended' && ((patch.status as string | undefined) ?? 'active') === 'active';
  if (restoredFromSuspension) {
    // Paid allowances (AI credits, team seats) come back with the plan.
    const billable = await listBillablePropertyIds(input.organizationId);
    if (billable.length > 0) {
      await changeOrgSubscription(
        sub.id as string,
        sub.plan_id as string,
        billable,
        input.adminUserId
      );
    }
    return;
  }

  const { data: enrolledRows } = await sb
    .from('org_subscription_properties')
    .select('property_id')
    .eq('org_subscription_id', sub.id as string);
  for (const row of enrolledRows ?? []) {
    await reconcileTeamSeatsForProperty(row.property_id as string);
  }
}

/** Super-admin credit adjustment: positive adds credit, negative removes it. Always audited. */
export async function adminAdjustOrgCredit(input: {
  organizationId: string;
  creditPhp: number;
  note: string;
  adminUserId: string;
}): Promise<{ balancePhp: number }> {
  const amount = Math.round(input.creditPhp);
  if (!amount) throw new Error('Enter an amount other than zero');
  // Ledger sign: negative = credit to the org.
  await addLedgerEntry({
    organizationId: input.organizationId,
    amountPhp: -amount,
    kind: 'admin_adjustment',
    note: input.note,
    createdBy: input.adminUserId,
  });
  return { balancePhp: await getLedgerBalancePhp(input.organizationId) };
}
