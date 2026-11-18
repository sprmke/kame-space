/**
 * org-plan — GET org subscription state + subscription plans + org properties + billing
 * (pending intent, upcoming payment, account credit, billing details, payment history). Billing is
 * org-level only — every active subscription plan is selectable, priced per enrolled property
 * (rate x count, volume-discounted). See _shared/planPricing.ts#computeOrgSubscriptionTotalPhp.
 */

import { createServiceClient, verifyOrgAccess } from '../_shared/orgAuth.ts';
import { hasOrgPermission } from '../_shared/orgTeamPermissions.ts';
import { reconcilePendingOrgPaymentTransaction } from '../_shared/orgPaymentReconcile.ts';
import { buildOrgPaymentQuote } from '../_shared/orgBillingContext.ts';
import { getLedgerBalancePhp } from '../_shared/orgBillingLedger.ts';
import { getPlatformPaymentSettings } from '../_shared/platformPaymentSettings.ts';
import { getActiveOrgSubscription } from '../_shared/planEntitlements.ts';
import { parsePlanFeatures } from '../_shared/planFeatures.ts';
import {
  normalizePlanDiscountPercent,
  normalizeVolumeDiscountTiers,
  normalizeVolumeRampAtCount,
  normalizeVolumeRampFloorPhp,
} from '../_shared/planPricing.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function serializePlan(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    tagline: (row.tagline as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    pricingModel: row.pricing_model as string,
    pricePhp: row.price_php == null ? null : Number(row.price_php),
    discountPercent: normalizePlanDiscountPercent(
      row.discount_percent == null ? 0 : Number(row.discount_percent)
    ),
    volumeDiscountTiers: normalizeVolumeDiscountTiers(row.volume_discount_tiers),
    volumeRampFloorPhp: normalizeVolumeRampFloorPhp(
      row.volume_ramp_floor_php == null ? null : Number(row.volume_ramp_floor_php)
    ),
    volumeRampAtCount: normalizeVolumeRampAtCount(
      row.volume_ramp_at_count == null ? null : Number(row.volume_ramp_at_count)
    ),
    features: parsePlanFeatures(row.features),
    isDefault: Boolean(row.is_default),
  };
}

const PAGE_SIZE = 20;
const TRANSACTION_SELECT =
  'id, plan_id, amount, currency, status, payment_method_type, created_at, paid_at, checkout_url, purpose, period_start, period_end, line_items, credit_applied_php, applied, review_reason, receipt_number, expires_at';

serveAuthenticated('org-plan', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId')?.trim() || undefined;
  const orgSlug = url.searchParams.get('orgSlug')?.trim() || undefined;
  const cursor = url.searchParams.get('cursor')?.trim() || null;
  const includeIncomplete = url.searchParams.get('includeIncomplete') === '1';
  if (!orgId && !orgSlug) {
    return jsonError(req, 'orgId or orgSlug is required');
  }

  const { org, permissions } = await verifyOrgAccess(req, { orgId, orgSlug });
  const organizationId = org.id as string;
  // Plan state drives gates and banners for every member. Payment history and billing details
  // (TIN, address) are for people who can open Plans & Billing.
  const canViewBilling = hasOrgPermission(permissions, 'org.plans:view');

  const supabase = createServiceClient();

  const { data: plans, error: plansError } = await supabase
    .from('pricing_plans')
    .select(
      'id, code, name, tagline, sort_order, pricing_model, price_php, discount_percent, volume_discount_tiers, volume_ramp_floor_php, volume_ramp_at_count, features, is_default'
    )
    .eq('pricing_model', 'subscription')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (plansError) return jsonError(req, plansError.message, 500);

  const { data: properties, error: propertiesError } = await supabase
    .from('properties')
    .select('id, name, slug, status, inactive_reason')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });
  if (propertiesError) return jsonError(req, propertiesError.message, 500);

  // Money first: if the open checkout was paid and the webhook is late, settle it now. Throttled
  // per checkout (at most one PayMongo lookup per 15 s however often the page polls).
  const { data: pendingRow } = await supabase
    .from('org_payment_transactions')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .not('checkout_url', 'is', null)
    .maybeSingle();
  if (pendingRow?.id) {
    try {
      await reconcilePendingOrgPaymentTransaction(pendingRow.id as string);
    } catch (err) {
      console.error('[org-plan] pending checkout reconcile failed', err);
    }
  }

  const sub = await getActiveOrgSubscription(organizationId);

  let subscription: Record<string, unknown> | null = null;
  let assignedPropertyIds: string[] = [];
  let upcomingPayment: Record<string, unknown> | null = null;

  if (sub) {
    const settings = await getPlatformPaymentSettings();
    const scheduledPlan = sub.scheduledPlanId
      ? (plans ?? []).find((row) => row.id === sub.scheduledPlanId)
      : null;
    let scheduledPlanName: string | null = scheduledPlan ? String(scheduledPlan.name) : null;
    if (sub.scheduledPlanId && !scheduledPlanName) {
      const { data: retired } = await supabase
        .from('pricing_plans')
        .select('name')
        .eq('id', sub.scheduledPlanId)
        .maybeSingle();
      scheduledPlanName = retired ? String(retired.name) : null;
    }
    const suspendedAt = sub.suspendedAt ? new Date(sub.suspendedAt) : null;
    subscription = {
      id: sub.id,
      planId: sub.planId,
      planCode: sub.planCode,
      planName: sub.planName,
      pricingModel: sub.pricingModel,
      status: sub.status,
      source: sub.source,
      pricePhpSnapshot: sub.pricePhpSnapshot,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      gracePeriodEndsAt: sub.graceEndsAt,
      suspendedAt: sub.suspendedAt,
      autoCancelAt: suspendedAt
        ? new Date(
            suspendedAt.getTime() + settings.suspensionCancelDays * 24 * 60 * 60 * 1000
          ).toISOString()
        : null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      scheduledPlanId: sub.scheduledPlanId,
      scheduledPlanName,
      scheduledChangeAt: sub.scheduledChangeAt,
      isPriceOverridden: sub.priceOverridePhp != null,
    };

    const { data: slots, error: slotsError } = await supabase
      .from('org_subscription_properties')
      .select('property_id')
      .eq('org_subscription_id', sub.id);
    if (slotsError) return jsonError(req, slotsError.message, 500);
    assignedPropertyIds = (slots ?? []).map((row) => row.property_id as string);

    // What the next payment is, using the same quote the checkout charges.
    if (!sub.cancelAtPeriodEnd && sub.currentPeriodEnd) {
      try {
        const quote = await buildOrgPaymentQuote({
          organizationId,
          targetPlanId: null,
          subscription: sub,
          ignoreRenewalWindow: true,
        });
        upcomingPayment = {
          purpose: quote.purpose,
          planId: quote.plan.id,
          planName: quote.plan.name,
          amountPhp: quote.quote.chargePhp,
          coveredByCredit: quote.quote.coveredByCredit,
          propertyCount: quote.billablePropertyIds.length,
          dueAt: sub.currentPeriodEnd,
          lineItems: quote.quote.lineItems,
        };
      } catch {
        upcomingPayment = null;
      }
    }
  }

  const ledgerBalancePhp = await getLedgerBalancePhp(organizationId);

  const { data: pendingCheckout } = await supabase
    .from('org_payment_transactions')
    .select('checkout_url, plan_id, expires_at, purpose')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .not('checkout_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let transactionsQuery = supabase
    .from('org_payment_transactions')
    .select(TRANSACTION_SELECT)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (!includeIncomplete) {
    // Closed-without-payment checkouts are noise by default; a toggle brings them back.
    transactionsQuery = transactionsQuery.not('status', 'in', '(expired,cancelled)');
  }
  if (cursor) transactionsQuery = transactionsQuery.lt('created_at', cursor);
  const { data: transactionRows, error: transactionsError } = await transactionsQuery;
  if (transactionsError) return jsonError(req, transactionsError.message, 500);
  const hasMore = (transactionRows ?? []).length > PAGE_SIZE;
  const pageRows = (transactionRows ?? []).slice(0, PAGE_SIZE);

  const { data: billingDetails } = await supabase
    .from('org_billing_details')
    .select('legal_name, address, tin, billing_email, updated_at')
    .eq('organization_id', organizationId)
    .maybeSingle();

  return jsonSuccess(req, {
    plans: (plans ?? []).map((row) => serializePlan(row as Record<string, unknown>)),
    properties: (properties ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      status: row.status as string,
      inactiveReason: (row.inactive_reason as string | null) ?? null,
    })),
    subscription,
    assignedPropertyIds,
    upcomingPayment,
    accountCreditPhp: Math.max(0, -ledgerBalancePhp),
    amountOwedPhp: Math.max(0, ledgerBalancePhp),
    billingDetails:
      canViewBilling && billingDetails
        ? {
            legalName: (billingDetails.legal_name as string | null) ?? '',
            address: (billingDetails.address as string | null) ?? '',
            tin: (billingDetails.tin as string | null) ?? '',
            billingEmail: (billingDetails.billing_email as string | null) ?? '',
            updatedAt: (billingDetails.updated_at as string | null) ?? null,
          }
        : null,
    transactions: (canViewBilling ? pageRows : []).map((row) => ({
      id: row.id as string,
      planId: row.plan_id as string,
      amount: Number(row.amount ?? 0),
      currency: row.currency as string,
      status: row.status as string,
      paymentMethodType: (row.payment_method_type as string | null) ?? null,
      checkoutUrl: row.status === 'pending' ? ((row.checkout_url as string | null) ?? null) : null,
      createdAt: row.created_at as string,
      paidAt: (row.paid_at as string | null) ?? null,
      purpose: (row.purpose as string | null) ?? null,
      periodStart: (row.period_start as string | null) ?? null,
      periodEnd: (row.period_end as string | null) ?? null,
      lineItems: Array.isArray(row.line_items) ? row.line_items : [],
      creditAppliedPhp: Number(row.credit_applied_php ?? 0),
      applied: row.applied == null ? null : Boolean(row.applied),
      keptAsCredit: typeof row.review_reason === 'string' && row.review_reason.startsWith('stale:'),
      receiptNumber: (row.receipt_number as string | null) ?? null,
    })),
    transactionsNextCursor:
      canViewBilling && hasMore ? (pageRows.at(-1)?.created_at as string) : null,
    pendingCheckoutUrl: (pendingCheckout?.checkout_url as string | null) ?? null,
    pendingCheckoutPlanId: (pendingCheckout?.plan_id as string | null) ?? null,
    pendingCheckoutExpiresAt: (pendingCheckout?.expires_at as string | null) ?? null,
    pendingCheckoutPurpose: (pendingCheckout?.purpose as string | null) ?? null,
  });
});
