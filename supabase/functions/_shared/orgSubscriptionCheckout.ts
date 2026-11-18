/**
 * Creates PayMongo checkout sessions for org subscription payments: first purchase, upgrades,
 * renewals, retries and reactivation. The amount always comes from the shared quote
 * (orgBillingContext.ts), the checkout stores the intent it was created for, and an org never has
 * more than one open checkout.
 */

import { createClient } from './supabaseJs.ts';

import { BillingRuleError, PriceChangedError } from './billingErrors.ts';
import {
  createPaymongoCheckoutSession,
  getPaymongoProviderPaymentState,
  isPaymongoCheckoutSessionRef,
  phpToCentavos,
} from './paymongoClient.ts';
import { orgPlansBillingCheckoutUrl } from './orgBillingUrls.ts';
import { buildOrgPaymentQuote, type OrgPaymentQuoteResult } from './orgBillingContext.ts';
import { fulfillOrgSubscriptionPayment } from './orgPaymentFulfillment.ts';
import { expireOrgCheckout, reconcilePendingOrgPaymentTransaction } from './orgPaymentReconcile.ts';
import type { CheckoutPurpose } from './orgSubscriptionStateMachine.ts';

/** A host is never charged more than a few pesos above the amount they reviewed. Unused-time
 * credit shrinks by about a peso an hour, so a short delay between review and confirm is fine. */
export const PRICE_TOLERANCE_PHP = 10;

export type OrgCheckoutResult = {
  /** null when the change was fully covered by account credit and applied on the spot. */
  checkoutUrl: string | null;
  transactionId: string;
  reused: boolean;
  paidWithCredit: boolean;
  purpose: CheckoutPurpose;
  chargePhp: number;
  planName: string;
  /** When the period this payment buys ends (for reminders and copy). */
  periodEnd: string | null;
};

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

type PendingRow = {
  id: string;
  checkout_url: string | null;
  provider_reference: string | null;
  plan_id: string;
  amount: number | string;
  purpose: string | null;
  expires_at: string | null;
};

/** Result of a plain "keep the open checkout" check. */
async function reusableOpenCheckout(
  pending: PendingRow,
  fresh: OrgPaymentQuoteResult | null
): Promise<boolean> {
  if (!pending.checkout_url) return false;
  if (pending.expires_at && new Date(pending.expires_at).getTime() <= Date.now()) return false;
  const providerRef = String(pending.provider_reference ?? '');
  if (!isPaymongoCheckoutSessionRef(providerRef)) return false;
  if (fresh) {
    // Same plan and purpose, and the charge has not drifted: it is the same payment.
    if (pending.plan_id !== fresh.plan.id) return false;
    if (pending.purpose !== fresh.purpose) return false;
    if (Math.abs(Number(pending.amount) - fresh.quote.chargePhp) > PRICE_TOLERANCE_PHP)
      return false;
  }
  const state = await getPaymongoProviderPaymentState(providerRef);
  return state === 'open' || state === 'unknown';
}

export async function createOrgSubscriptionCheckoutLink(input: {
  organizationId: string;
  /** Omit to pay what is due (renewal of the current or scheduled plan). */
  planId?: string | null;
  initiatedBy?: string | null;
  /** The cron issues renewal links on its own schedule, outside the host-facing lead window. */
  ignoreRenewalWindow?: boolean;
  /** Replace any open checkout even if it is still valid (cron retry links). */
  forceNew?: boolean;
  /** The amount the host reviewed. A higher fresh amount (beyond tolerance) is rejected with 409. */
  expectedChargePhp?: number | null;
  /** Same key twice returns the same checkout (double click, two tabs). */
  idempotencyKey?: string | null;
  /** Reopen the host's current open checkout instead of starting a new one. */
  resume?: boolean;
}): Promise<OrgCheckoutResult> {
  const sb = db();

  const { data: org, error: orgError } = await sb
    .from('organizations')
    .select('id, name, slug')
    .eq('id', input.organizationId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!org) throw new BillingRuleError('Organization not found', 'not_found', 404);
  const orgName = String(org.name ?? 'Organization').trim();
  const orgSlug = String(org.slug ?? '').trim();
  if (!orgSlug) throw new Error('Organization slug is missing');

  // Same click twice (double click, two tabs, a retry after a dropped response).
  if (input.idempotencyKey) {
    const { data: prior } = await sb
      .from('org_payment_transactions')
      .select('id, status, checkout_url, amount, purpose')
      .eq('organization_id', input.organizationId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();
    if (prior) {
      return {
        checkoutUrl: (prior.checkout_url as string | null) ?? null,
        transactionId: prior.id as string,
        reused: true,
        paidWithCredit: prior.status === 'paid' && !prior.checkout_url,
        purpose: (prior.purpose as CheckoutPurpose | null) ?? 'renewal',
        chargePhp: Number(prior.amount ?? 0),
        planName: '',
        periodEnd: null,
      };
    }
  }

  const { data: pendingRow } = await sb
    .from('org_payment_transactions')
    .select('id, checkout_url, provider_reference, plan_id, amount, purpose, expires_at')
    .eq('organization_id', input.organizationId)
    .eq('status', 'pending')
    .maybeSingle();
  let pending = (pendingRow as PendingRow | null) ?? null;

  // Money may already be on its way: settle that before anything else.
  if (pending) {
    const reconciled = await reconcilePendingOrgPaymentTransaction(pending.id, { force: true });
    if (reconciled === 'fulfilled') {
      throw new BillingRuleError(
        'Payment already received. Refresh Plans & Billing.',
        'already_paid',
        409
      );
    }
    if (reconciled === 'expired') pending = null;
  }

  if (input.resume && pending && (await reusableOpenCheckout(pending, null))) {
    return {
      checkoutUrl: pending.checkout_url,
      transactionId: pending.id,
      reused: true,
      paidWithCredit: false,
      purpose: (pending.purpose as CheckoutPurpose | null) ?? 'renewal',
      chargePhp: Number(pending.amount),
      planName: '',
      periodEnd: null,
    };
  }

  const targetPlanId = input.planId ?? (input.resume ? (pending?.plan_id ?? null) : null);
  const quote = await buildOrgPaymentQuote({
    organizationId: input.organizationId,
    targetPlanId,
    ignoreRenewalWindow: input.ignoreRenewalWindow,
  });

  if (
    input.expectedChargePhp != null &&
    quote.quote.chargePhp > Number(input.expectedChargePhp) + PRICE_TOLERANCE_PHP
  ) {
    throw new PriceChangedError(quote.quote.chargePhp);
  }

  if (pending && !input.forceNew && (await reusableOpenCheckout(pending, quote))) {
    return {
      checkoutUrl: pending.checkout_url,
      transactionId: pending.id,
      reused: true,
      paidWithCredit: false,
      purpose: quote.purpose,
      chargePhp: Number(pending.amount),
      planName: quote.plan.name,
      periodEnd: quote.period.end.toISOString(),
    };
  }

  // One open checkout per org: close the old one at PayMongo before opening another.
  if (pending) await expireOrgCheckout(pending.id);

  const settings = quote.settings;
  const expiresAt = new Date(
    Date.now() + Math.max(1, settings.pendingCheckoutTtlHours) * 60 * 60 * 1000
  ).toISOString();

  const baseRow = {
    organization_id: input.organizationId,
    plan_id: quote.plan.id,
    property_ids: quote.billablePropertyIds,
    currency: 'PHP',
    purpose: quote.purpose,
    period_start: quote.period.start.toISOString(),
    period_end: quote.period.end.toISOString(),
    line_items: quote.quote.lineItems,
    credit_applied_php: quote.quote.ledgerCreditAppliedPhp,
    intent: quote.intent,
    idempotency_key: input.idempotencyKey ?? null,
  };

  // Fully covered by account credit: no checkout. Record and apply it as a paid row.
  if (quote.quote.coveredByCredit) {
    const { data: creditRow, error: creditError } = await sb
      .from('org_payment_transactions')
      .insert({
        ...baseRow,
        provider: 'credit',
        amount: 0,
        status: 'pending',
        expires_at: null,
      })
      .select('id')
      .single();
    if (creditError) {
      if (creditError.code === '23505') {
        throw new BillingRuleError(
          'Another change is already in progress. Try again.',
          'busy',
          409
        );
      }
      throw new Error(creditError.message);
    }
    const result = await fulfillOrgSubscriptionPayment({
      transactionId: creditRow.id as string,
      paymentMethodType: 'credit',
      paidAt: new Date().toISOString(),
      rawPayload: { source: 'account_credit' },
      assignedByUserId: input.initiatedBy ?? null,
    });
    if (!result.applied) {
      throw new BillingRuleError(
        'This change could not be applied. Nothing was charged.',
        'not_applied',
        409
      );
    }
    return {
      checkoutUrl: null,
      transactionId: creditRow.id as string,
      reused: false,
      paidWithCredit: true,
      purpose: quote.purpose,
      chargePhp: 0,
      planName: quote.plan.name,
      periodEnd: quote.period.end.toISOString(),
    };
  }

  const { data: txnRow, error: insertError } = await sb
    .from('org_payment_transactions')
    .insert({
      ...baseRow,
      amount: quote.quote.chargePhp,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single();
  if (insertError) {
    // The partial unique index (one pending per org) caught a concurrent start.
    if (insertError.code === '23505') {
      throw new BillingRuleError(
        'A payment is already in progress. Resume it or wait a moment.',
        'busy',
        409
      );
    }
    throw new Error(insertError.message);
  }

  const transactionId = txnRow.id as string;
  const descriptionSuffix =
    quote.purpose === 'renewal' || quote.purpose === 'retry'
      ? ' renewal'
      : quote.purpose === 'change'
        ? ' plan change'
        : quote.purpose === 'reactivation'
          ? ' reactivation'
          : '';

  try {
    const propertyCount = quote.billablePropertyIds.length;
    const lineItemName = `${quote.plan.name} plan (${propertyCount} propert${propertyCount === 1 ? 'y' : 'ies'})`;
    const session = await createPaymongoCheckoutSession({
      amountCentavos: phpToCentavos(quote.quote.chargePhp),
      lineItemName,
      description: `${orgName} - ${lineItemName}${descriptionSuffix}`,
      successUrl: orgPlansBillingCheckoutUrl(orgSlug, 'success'),
      cancelUrl: orgPlansBillingCheckoutUrl(orgSlug, 'cancelled'),
      paymentMethodTypes: settings.enabledPaymentMethods,
      referenceNumber: transactionId.replace(/-/g, '').slice(0, 32),
      metadata: {
        kind: 'org_subscription',
        transaction_id: transactionId,
        organization_id: input.organizationId,
        plan_id: quote.plan.id,
        purpose: quote.purpose,
        ...(input.initiatedBy ? { initiated_by: input.initiatedBy } : {}),
      },
    });

    const { error: updateError } = await sb
      .from('org_payment_transactions')
      .update({ provider_reference: session.id, checkout_url: session.checkoutUrl })
      .eq('id', transactionId);
    if (updateError) throw new Error(updateError.message);

    return {
      checkoutUrl: session.checkoutUrl,
      transactionId,
      reused: false,
      paidWithCredit: false,
      purpose: quote.purpose,
      chargePhp: quote.quote.chargePhp,
      planName: quote.plan.name,
      periodEnd: quote.period.end.toISOString(),
    };
  } catch (err) {
    await sb
      .from('org_payment_transactions')
      .update({
        status: 'failed',
        failure_reason: (err as Error).message.slice(0, 500),
      })
      .eq('id', transactionId);
    throw err;
  }
}
