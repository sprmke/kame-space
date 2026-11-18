/**
 * preview-org-plan-change — read-only server quote for a plan change, shown in the review dialog
 * before anything is charged or scheduled. Same math the checkout uses (orgBillingContext.ts), so
 * the amount reviewed is the amount charged.
 *
 * kind:
 *  - 'pay'      upgrade, renewal, retry or reactivation (a payment)
 *  - 'schedule' downgrade at the end of the period (no payment)
 *  - 'cancel'   move to Free at the end of the period (no payment)
 *  - 'add_property'  what one more property does to the bill (shown before creating it)
 */

import { verifyOrgAccess, verifyOrgOwner } from '../_shared/orgAuth.ts';
import { billingErrorResponse } from '../_shared/billingHttp.ts';
import { BillingRuleError } from '../_shared/billingErrors.ts';
import { periodRemaining } from '../_shared/billingPeriod.ts';
import {
  buildOrgPaymentQuote,
  loadQuotePlan,
  toSubscriptionState,
} from '../_shared/orgBillingContext.ts';
import { listBillablePropertyIds } from '../_shared/orgBillableProperties.ts';
import { computePlanTotalPhp } from '../_shared/planPricing.ts';
import {
  validateCancelAtPeriodEnd,
  validateScheduleDowngrade,
} from '../_shared/orgSubscriptionStateMachine.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { loadPlanChangeImpact } from '../_shared/planChangeImpact.ts';
import {
  getActiveOrgSubscription,
  getDefaultPricingPlan,
  loadOrgEligiblePlan,
  previewAddPropertyBilling,
} from '../_shared/planEntitlements.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const KINDS = ['pay', 'schedule', 'cancel', 'add_property'] as const;
type Kind = (typeof KINDS)[number];

serveAuthenticated('preview-org-plan-change', async (req) => {
  requireHttpMethod(req, 'POST');

  const body = await readJsonBody(req);
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
  const kind = (typeof body.kind === 'string' ? body.kind.trim() : '') as Kind;

  if (!organizationId) return jsonError(req, 'organizationId is required');
  if (!KINDS.includes(kind)) return jsonError(req, 'Unknown kind');
  if ((kind === 'pay' || kind === 'schedule') && !planId && kind === 'schedule') {
    return jsonError(req, 'planId is required');
  }

  // Whoever may create a property sees what it adds to the bill; plan changes stay owner only.
  if (kind === 'add_property') {
    await verifyOrgAccess(req, { orgId: organizationId }, 'org:properties:create');
    try {
      return jsonSuccess(req, { kind, ...(await previewAddPropertyBilling(organizationId)) });
    } catch (err) {
      return billingErrorResponse(req, err);
    }
  }

  await verifyOrgOwner(req, organizationId);

  try {
    const sub = await getActiveOrgSubscription(organizationId);

    if (kind === 'pay') {
      const result = await buildOrgPaymentQuote({
        organizationId,
        targetPlanId: planId || null,
        subscription: sub,
      });
      const remaining =
        sub?.currentPeriodStart && sub.currentPeriodEnd
          ? periodRemaining(
              new Date(sub.currentPeriodStart),
              new Date(sub.currentPeriodEnd),
              new Date()
            ).remainingDays
          : null;
      return jsonSuccess(req, {
        kind: 'pay',
        purpose: result.purpose,
        planId: result.plan.id,
        planName: result.plan.name,
        propertyCount: result.billablePropertyIds.length,
        chargePhp: result.quote.chargePhp,
        coveredByCredit: result.quote.coveredByCredit,
        targetTotalPhp: result.quote.targetTotalPhp,
        unusedCreditPhp: result.quote.unusedCreditPhp,
        ledgerDebtPhp: result.quote.ledgerDebtPhp,
        ledgerCreditAppliedPhp: result.quote.ledgerCreditAppliedPhp,
        newCreditPhp: result.quote.newCreditPhp,
        lineItems: result.quote.lineItems,
        periodStart: result.period.start.toISOString(),
        periodEnd: result.period.end.toISOString(),
        startsNewPeriod: result.period.mode !== 'anchored',
        nextRenewalPhp: result.nextRenewalPhp,
        currentPeriodRemainingDays: remaining,
      });
    }

    if (!sub) throw new BillingRuleError('No active subscription to change', 'no_subscription');
    const state = toSubscriptionState(sub);
    if (!sub.currentPeriodEnd) {
      throw new BillingRuleError(
        'This plan has no billing period yet. Contact support to change it.',
        'no_period'
      );
    }

    if (kind === 'schedule') {
      const target = await loadQuotePlan(planId, { allowInactive: true });
      const verdict = validateScheduleDowngrade(state, {
        id: target.id,
        code: target.code,
        sortOrder: target.sortOrder,
        isDefault: target.isDefault,
        isActive: target.isActive,
      });
      if (!verdict.ok) throw new BillingRuleError(verdict.message);
      const targetPlan = await loadOrgEligiblePlan(planId, { allowInactive: true });
      const currentPlan = await loadOrgEligiblePlan(sub.planId, { allowInactive: true });
      const impact = await loadPlanChangeImpact({
        organizationId,
        fromFeatures: currentPlan.features,
        toFeatures: targetPlan.features,
        toPlanName: target.name,
      });
      const billable = await listBillablePropertyIds(organizationId);
      return jsonSuccess(req, {
        kind: 'schedule',
        fromPlanName: sub.planName,
        toPlanName: target.name,
        effectiveAt: sub.currentPeriodEnd,
        // What the next payment is on the lower plan (it buys today's pricing for that plan).
        nextRenewalPhp: computePlanTotalPhp(targetPlan, billable.length),
        currentTotalPhp: sub.pricePhpSnapshot,
        propertyCount: billable.length,
        impact,
      });
    }

    const verdict = validateCancelAtPeriodEnd(state);
    if (!verdict.ok) throw new BillingRuleError(verdict.message);
    const freePlan = await getDefaultPricingPlan();
    const currentPlan = await loadOrgEligiblePlan(sub.planId, { allowInactive: true });
    const impact = await loadPlanChangeImpact({
      organizationId,
      fromFeatures: currentPlan.features,
      toFeatures: freePlan.features,
      toPlanName: freePlan.name,
    });
    return jsonSuccess(req, {
      kind: 'cancel',
      fromPlanName: sub.planName,
      toPlanName: freePlan.name,
      effectiveAt: sub.currentPeriodEnd,
      nextRenewalPhp: 0,
      currentTotalPhp: sub.pricePhpSnapshot,
      propertyCount: (await listBillablePropertyIds(organizationId)).length,
      impact,
    });
  } catch (err) {
    return billingErrorResponse(req, err);
  }
});
