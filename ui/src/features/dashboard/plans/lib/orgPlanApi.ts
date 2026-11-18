import type { PlanFeatures } from '@/features/dashboard/plans/lib/planFeatures';
import type { VolumeDiscountTier } from '@/features/dashboard/plans/lib/planPricing';

import { supabase } from '@/lib/supabase/client';

function supabaseBaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
}

export type OrgBundlePlanDto = {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  sortOrder: number;
  pricingModel: string;
  pricePhp: number | null;
  discountPercent: number;
  volumeDiscountTiers: VolumeDiscountTier[];
  volumeRampFloorPhp: number;
  volumeRampAtCount: number;
  features: PlanFeatures;
  isDefault: boolean;
};

export type OrgPropertyDto = {
  id: string;
  name: string;
  slug: string;
  status: string;
  inactiveReason?: string | null;
};

export type OrgSubscriptionDto = {
  id: string;
  planId: string;
  planCode: string;
  planName: string;
  pricingModel: string;
  status: string;
  source?: string;
  pricePhpSnapshot: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEndsAt?: string | null;
  suspendedAt?: string | null;
  /** When a suspended subscription ends on its own and the org moves to Free. */
  autoCancelAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  scheduledPlanId?: string | null;
  scheduledPlanName?: string | null;
  scheduledChangeAt?: string | null;
  isPriceOverridden?: boolean;
};

export type OrgPaymentPurpose = 'initial' | 'renewal' | 'retry' | 'change' | 'reactivation';

export type OrgQuoteLineItem = {
  kind: string;
  label: string;
  /** Signed: positive adds to the amount due, negative reduces it. */
  amountPhp: number;
};

export type OrgPaymentTransactionDto = {
  id: string;
  planId: string;
  amount: number;
  currency: string;
  status: string;
  checkoutUrl: string | null;
  paymentMethodType: string | null;
  createdAt: string;
  paidAt: string | null;
  purpose?: OrgPaymentPurpose | 'credit' | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  lineItems?: OrgQuoteLineItem[];
  creditAppliedPhp?: number;
  applied?: boolean | null;
  /** The payment arrived after the plan had changed, so it was added to the account credit. */
  keptAsCredit?: boolean;
  receiptNumber?: string | null;
};

export type OrgUpcomingPaymentDto = {
  purpose: OrgPaymentPurpose;
  planId: string;
  planName: string;
  amountPhp: number;
  coveredByCredit: boolean;
  propertyCount: number;
  dueAt: string;
  lineItems: OrgQuoteLineItem[];
};

export type OrgBillingDetailsDto = {
  legalName: string;
  address: string;
  tin: string;
  billingEmail: string;
  updatedAt?: string | null;
};

export type OrgPlanResponse = {
  plans: OrgBundlePlanDto[];
  properties: OrgPropertyDto[];
  subscription: OrgSubscriptionDto | null;
  assignedPropertyIds: string[];
  upcomingPayment?: OrgUpcomingPaymentDto | null;
  accountCreditPhp?: number;
  amountOwedPhp?: number;
  billingDetails?: OrgBillingDetailsDto | null;
  pendingCheckoutUrl: string | null;
  pendingCheckoutPlanId: string | null;
  pendingCheckoutExpiresAt?: string | null;
  /** What the open checkout is for: renewal / retry are due payments, the rest are host-started. */
  pendingCheckoutPurpose?: OrgPaymentPurpose | null;
  transactions: OrgPaymentTransactionDto[];
  transactionsNextCursor?: string | null;
};

/** A billing request the server refused on purpose, with a stable code the UI can act on. */
export class OrgBillingApiError extends Error {
  readonly code: string | null;
  readonly status: number;
  readonly freshChargePhp: number | null;

  constructor(
    message: string,
    init: { code?: string | null; status: number; freshChargePhp?: number | null }
  ) {
    super(message);
    this.name = 'OrgBillingApiError';
    this.code = init.code ?? null;
    this.status = init.status;
    this.freshChargePhp = init.freshChargePhp ?? null;
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

type Envelope<T> = {
  success?: boolean;
  error?: string;
  code?: string;
  freshChargePhp?: number;
  data?: T;
};

async function callBilling<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown } = {},
  fallbackMessage = 'Something went wrong'
): Promise<T> {
  const res = await fetch(`${supabaseBaseUrl()}/${path}`, {
    method: init.method ?? 'GET',
    headers: await authHeaders(),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let json: Envelope<T> = {};
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    // Non-JSON error page: fall through to the generic message below.
  }
  if (!res.ok || !json.success || json.data === undefined) {
    throw new OrgBillingApiError(json.error ?? fallbackMessage, {
      code: json.code ?? null,
      status: res.status,
      freshChargePhp: json.freshChargePhp ?? null,
    });
  }
  return json.data;
}

export async function fetchOrgPlan(
  orgId: string,
  options: { cursor?: string | null; includeIncomplete?: boolean } = {}
): Promise<OrgPlanResponse> {
  const params = new URLSearchParams({ orgId });
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.includeIncomplete) params.set('includeIncomplete', '1');
  return callBilling<OrgPlanResponse>(`org-plan?${params}`, {}, 'Failed to load org plan');
}

export type CreateOrgPlanCheckoutInput = {
  /** Omit to pay what is due (renewal of the current or scheduled plan). */
  planId?: string | null;
  /** The amount the host reviewed. The server refuses a higher fresh amount (409). */
  expectedChargePhp?: number | null;
  /** Same key twice returns the same checkout (double click, two tabs). */
  idempotencyKey?: string;
  /** Reopen the host's current open checkout. */
  resume?: boolean;
};

export type CreateOrgPlanCheckoutResult = {
  /** null when the change was fully covered by account credit and applied on the spot. */
  checkoutUrl: string | null;
  transactionId: string;
  paidWithCredit: boolean;
  purpose: OrgPaymentPurpose;
  chargePhp: number;
};

/** First purchase, upgrade, renewal, retry and reactivation. Billing covers every billable
 * property in the organization; the server prices it and prorates when it is a genuine change. */
export async function createOrgPlanCheckout(
  organizationId: string,
  input: CreateOrgPlanCheckoutInput = {}
): Promise<CreateOrgPlanCheckoutResult> {
  return callBilling<CreateOrgPlanCheckoutResult>(
    'create-org-subscription-checkout',
    {
      method: 'POST',
      body: {
        organizationId,
        planId: input.planId ?? undefined,
        expectedChargePhp: input.expectedChargePhp ?? undefined,
        idempotencyKey: input.idempotencyKey,
        resume: input.resume ? true : undefined,
      },
    },
    'Could not start checkout'
  );
}

export type PlanImpactItem = {
  key: string;
  label: string;
  detail: string;
  count: number;
};

export type PayPlanPreview = {
  kind: 'pay';
  purpose: OrgPaymentPurpose;
  planId: string;
  planName: string;
  propertyCount: number;
  chargePhp: number;
  coveredByCredit: boolean;
  targetTotalPhp: number;
  unusedCreditPhp: number;
  ledgerDebtPhp: number;
  ledgerCreditAppliedPhp: number;
  newCreditPhp: number;
  lineItems: OrgQuoteLineItem[];
  periodStart: string;
  periodEnd: string;
  startsNewPeriod: boolean;
  nextRenewalPhp: number;
  currentPeriodRemainingDays: number | null;
};

export type SchedulePlanPreview = {
  kind: 'schedule' | 'cancel';
  fromPlanName: string;
  toPlanName: string;
  effectiveAt: string;
  /** The monthly total from the effective date (0 when the plan ends). */
  nextRenewalPhp: number;
  currentTotalPhp: number | null;
  propertyCount: number;
  impact: PlanImpactItem[];
};

export type PlanChangePreview = PayPlanPreview | SchedulePlanPreview;

/** What one more property does to the bill, shown before it is created. */
export type AddPropertyPreview = {
  kind: 'add_property';
  /** covered: joins the paid plan now. free: no paid plan. overdue: stays on Free until paid. */
  status: 'covered' | 'free' | 'overdue';
  planName: string | null;
  propertyCount: number;
  addsMonthlyPhp: number;
  /** Prorated share of the increase for the rest of this period, added to the next payment. */
  trueUpPhp: number;
  nextRenewalPhp: number;
  renewsAt: string | null;
};

export async function previewAddPropertyBilling(
  organizationId: string
): Promise<AddPropertyPreview> {
  return callBilling<AddPropertyPreview>(
    'preview-org-plan-change',
    { method: 'POST', body: { organizationId, kind: 'add_property' } },
    'Could not load the billing preview'
  );
}

export async function previewOrgPlanChange(
  organizationId: string,
  kind: 'pay',
  planId: string | null
): Promise<PayPlanPreview>;
export async function previewOrgPlanChange(
  organizationId: string,
  kind: 'schedule' | 'cancel',
  planId: string | null
): Promise<SchedulePlanPreview>;
export async function previewOrgPlanChange(
  organizationId: string,
  kind: 'pay' | 'schedule' | 'cancel',
  planId: string | null
): Promise<PlanChangePreview> {
  return callBilling<PlanChangePreview>(
    'preview-org-plan-change',
    { method: 'POST', body: { organizationId, kind, planId: planId ?? undefined } },
    'Could not load the plan change'
  );
}

export type CancelReason =
  | 'too_expensive'
  | 'missing_features'
  | 'fewer_properties'
  | 'switching_tool'
  | 'temporary'
  | 'other';

export type OrgSubscriptionChangeAction =
  | { action: 'schedule_downgrade'; planId: string }
  | { action: 'cancel_at_period_end'; reason?: CancelReason | null }
  | { action: 'clear_intent' }
  | { action: 'cancel_now'; reason?: CancelReason | null };

export type OrgSubscriptionChangeResult = {
  scheduled?: 'downgrade' | 'cancel';
  cleared?: boolean;
  canceled?: boolean;
  effectiveAt?: string;
  planName?: string;
  toPlanName?: string;
  alreadyScheduled?: boolean;
};

/** Schedule a downgrade or a cancel for the period end, undo it, or leave an overdue plan. */
export async function changeOrgSubscriptionPlan(
  organizationId: string,
  change: OrgSubscriptionChangeAction
): Promise<OrgSubscriptionChangeResult> {
  return callBilling<OrgSubscriptionChangeResult>(
    'org-subscription-change',
    { method: 'POST', body: { organizationId, ...change } },
    'Could not change plan'
  );
}

export async function fetchOrgBillingDetails(orgId: string): Promise<OrgBillingDetailsDto> {
  const data = await callBilling<{ details: OrgBillingDetailsDto }>(
    `org-billing-details?orgId=${encodeURIComponent(orgId)}`,
    {},
    'Could not load billing details'
  );
  return data.details;
}

export async function saveOrgBillingDetails(
  organizationId: string,
  details: Omit<OrgBillingDetailsDto, 'updatedAt'>
): Promise<OrgBillingDetailsDto> {
  const data = await callBilling<{ details: OrgBillingDetailsDto }>(
    'org-billing-details',
    { method: 'PUT', body: { organizationId, ...details } },
    'Could not save billing details'
  );
  return data.details;
}

/** Downloads a payment receipt PDF through the signed-in session. */
export async function downloadOrgReceipt(
  orgId: string,
  transactionId: string,
  receiptNumber: string
): Promise<void> {
  const res = await fetch(
    `${supabaseBaseUrl()}/get-org-payment-receipt?orgId=${encodeURIComponent(orgId)}&transactionId=${encodeURIComponent(transactionId)}`,
    { headers: await authHeaders() }
  );
  if (!res.ok) {
    let message = 'Could not download the receipt';
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      // keep the generic message
    }
    throw new OrgBillingApiError(message, { status: res.status });
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${receiptNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
