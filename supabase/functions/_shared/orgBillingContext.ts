/**
 * Loads live billing state and builds the one authoritative payment quote. Used by the preview
 * endpoint, checkout creation, the renewal cron and the credit-only path, so what a host reviews
 * is exactly what is charged. The money math itself is pure: orgBillingQuote.ts.
 */

import {
  addBillingMonths,
  computeUnusedCreditPhp,
  manilaDayOfMonth,
  nextPeriodEndAfter,
} from './billingPeriod.ts';
import { BillingRuleError } from './billingErrors.ts';
import { computePaymentQuote, type PaymentQuote } from './orgBillingQuote.ts';
import { getLedgerBalancePhp } from './orgBillingLedger.ts';
import { listBillablePropertyIds } from './orgBillableProperties.ts';
import {
  classifyCheckout,
  type CheckoutPurpose,
  type PlanRef,
  type SubscriptionState,
  type SubscriptionSource,
  type SubscriptionStatus,
} from './orgSubscriptionStateMachine.ts';
import type { PaymentIntent } from './orgPaymentIntent.ts';
import {
  getActiveOrgSubscription,
  loadOrgEligiblePlan,
  type OrgSubscriptionRow,
} from './planEntitlements.ts';
import { computeTotalFromPricingParams, pricingParamsFromPlan } from './planPricing.ts';
import { getDuePriceMigration } from './orgPriceMigration.ts';
import {
  getPlatformPaymentSettings,
  type PlatformPaymentSettings,
} from './platformPaymentSettings.ts';

export function toSubscriptionState(row: OrgSubscriptionRow): SubscriptionState {
  const date = (value: string | null) => (value ? new Date(value) : null);
  return {
    id: row.id,
    status: row.status as SubscriptionStatus,
    source: row.source as SubscriptionSource,
    plan: {
      id: row.planId,
      code: row.planCode,
      sortOrder: row.planSortOrder,
      isDefault: row.planIsDefault,
    },
    currentPeriodStart: date(row.currentPeriodStart),
    currentPeriodEnd: date(row.currentPeriodEnd),
    graceEndsAt: date(row.graceEndsAt),
    suspendedAt: date(row.suspendedAt),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    scheduledPlanId: row.scheduledPlanId,
    scheduledChangeAt: date(row.scheduledChangeAt),
  };
}

export type QuotePlan = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  price_php: number | null;
  discount_percent: number | null;
  volume_discount_tiers: unknown;
  volume_ramp_floor_php: number | null;
  volume_ramp_at_count: number | null;
};

export async function loadQuotePlan(
  planId: string,
  options: { allowInactive?: boolean } = {}
): Promise<QuotePlan> {
  const plan = await loadOrgEligiblePlan(planId, options);
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    sortOrder: Number(plan.sort_order ?? 0),
    isDefault: Boolean(plan.is_default),
    isActive: plan.is_active !== false,
    price_php: plan.price_php,
    discount_percent: plan.discount_percent,
    volume_discount_tiers: plan.volume_discount_tiers,
    volume_ramp_floor_php: plan.volume_ramp_floor_php,
    volume_ramp_at_count: plan.volume_ramp_at_count,
  };
}

export type OrgPaymentQuoteResult = {
  purpose: CheckoutPurpose;
  plan: QuotePlan;
  subscription: OrgSubscriptionRow | null;
  billablePropertyIds: string[];
  ledgerBalancePhp: number;
  quote: PaymentQuote;
  /** The period this payment buys. */
  period: { start: Date; end: Date; mode: 'create' | 'fresh' | 'anchored' };
  /** What the next renewal will cost on this plan with today's properties. */
  nextRenewalPhp: number;
  intent: PaymentIntent;
  settings: PlatformPaymentSettings;
};

/**
 * Quote for paying `targetPlanId` (or "what is due" when omitted) as the org is right now.
 * Throws BillingRuleError when the request does not make sense for the subscription.
 */
export async function buildOrgPaymentQuote(input: {
  organizationId: string;
  targetPlanId?: string | null;
  now?: Date;
  /** The billing cron issues renewal links on its own schedule. */
  ignoreRenewalWindow?: boolean;
  subscription?: OrgSubscriptionRow | null;
}): Promise<OrgPaymentQuoteResult> {
  const now = input.now ?? new Date();
  const settings = await getPlatformPaymentSettings();
  const subscription =
    input.subscription !== undefined
      ? input.subscription
      : await getActiveOrgSubscription(input.organizationId);
  const state = subscription ? toSubscriptionState(subscription) : null;

  let target: (PlanRef & { isActive: boolean }) | null = null;
  if (input.targetPlanId) {
    const plan = await loadQuotePlan(input.targetPlanId, { allowInactive: true });
    target = {
      id: plan.id,
      code: plan.code,
      sortOrder: plan.sortOrder,
      isDefault: plan.isDefault,
      // Paying the plan you are already on (or are scheduled to move to) works after the plan
      // leaves the catalog. Picking a different plan needs it to be sellable.
      isActive:
        plan.isActive ||
        plan.id === subscription?.planId ||
        plan.id === subscription?.scheduledPlanId,
    };
  }

  const classification = classifyCheckout({
    sub: state,
    target,
    now,
    renewalLeadDays: input.ignoreRenewalWindow ? 3650 : settings.renewalLinkLeadDays,
  });
  if (!classification.ok) throw new BillingRuleError(classification.message);

  const plan = await loadQuotePlan(classification.effectivePlanId, { allowInactive: true });
  const billablePropertyIds = await listBillablePropertyIds(input.organizationId);
  if (billablePropertyIds.length === 0) {
    throw new BillingRuleError(
      'Add at least one property to your organization before subscribing',
      'no_properties'
    );
  }

  const purpose = classification.purpose;
  const keepsOverride =
    (purpose === 'renewal' || purpose === 'retry') &&
    subscription != null &&
    subscription.priceOverridePhp != null &&
    subscription.planId === plan.id;

  // Grandfathered pricing: a renewal of the same plan keeps the pricing the subscription bought,
  // unless a price migration has taken effect. Fresh purchases and plan changes buy today's.
  const isAnchoredRenewal = purpose === 'renewal' || purpose === 'retry';
  let pricingRefresh = !isAnchoredRenewal || !subscription || subscription.planId !== plan.id;
  if (!pricingRefresh && subscription) {
    const renewalStart = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : now;
    const due = await getDuePriceMigration(plan.id, renewalStart > now ? renewalStart : now);
    if (due || !subscription.pricingSnapshot) pricingRefresh = true;
  }
  const pricingParams =
    !pricingRefresh && subscription?.pricingSnapshot
      ? subscription.pricingSnapshot
      : pricingParamsFromPlan(plan);
  const targetTotalPhp = keepsOverride
    ? Number(subscription!.priceOverridePhp)
    : computeTotalFromPricingParams(pricingParams, billablePropertyIds.length);
  if (!Number.isFinite(targetTotalPhp) || targetTotalPhp <= 0) {
    throw new BillingRuleError('Plan has no price configured', 'no_price');
  }

  const oldEnd = state?.currentPeriodEnd ?? null;
  const anchorDay =
    subscription?.billingAnchorDay ?? (oldEnd ? manilaDayOfMonth(oldEnd) : manilaDayOfMonth(now));

  let mode: 'create' | 'fresh' | 'anchored';
  if (!subscription) mode = 'create';
  else if (purpose === 'renewal' || purpose === 'retry') mode = 'anchored';
  else mode = 'fresh';

  let periodStart: Date;
  let periodEnd: Date;
  if (mode === 'anchored' && oldEnd) {
    periodStart = oldEnd;
    periodEnd = nextPeriodEndAfter(periodStart, anchorDay, now);
  } else {
    periodStart = now;
    periodEnd = addBillingMonths(now, manilaDayOfMonth(now), 1);
  }

  const freshPurchase = mode === 'fresh';
  const unusedCreditPhp =
    freshPurchase && subscription
      ? computeUnusedCreditPhp({
          periodPaidPhp: subscription.periodPaidPhp,
          periodStart: state?.currentPeriodStart ?? null,
          periodEnd: oldEnd,
          now,
        })
      : 0;

  const ledgerBalancePhp = await getLedgerBalancePhp(input.organizationId);
  const quote = computePaymentQuote({
    targetTotalPhp,
    unusedCreditPhp,
    ledgerBalancePhp,
    planLabel: `${plan.name} plan (${billablePropertyIds.length} ${
      billablePropertyIds.length === 1 ? 'property' : 'properties'
    })`,
  });

  const intent: PaymentIntent = {
    v: 1,
    purpose,
    subscriptionId: subscription?.id ?? null,
    planId: plan.id,
    basePeriodEnd: subscription?.currentPeriodEnd ?? null,
    baseStatus: subscription?.status ?? null,
    targetTotalPhp,
    settleDebtPhp: quote.settleDebtPhp,
    consumeCreditPhp: quote.consumeCreditPhp,
    newCreditPhp: quote.newCreditPhp,
    propertyCount: billablePropertyIds.length,
    pricingRefresh,
  };

  return {
    purpose,
    plan,
    subscription,
    billablePropertyIds,
    ledgerBalancePhp,
    quote,
    period: { start: periodStart, end: periodEnd, mode },
    nextRenewalPhp: targetTotalPhp,
    intent,
    settings,
  };
}
