/**
 * Org-level plan assignment and entitlement resolution.
 * Single source of truth — do not duplicate merge logic at call sites.
 *
 * Billing is org-level only: one org_subscriptions row (per-property rate x enrolled property
 * count, volume-discounted) covers whichever properties are enrolled via
 * org_subscription_properties. A property outside any live org subscription resolves to Free.
 * There is no per-property subscription anymore.
 */

import { createClient } from './supabaseJs.ts';

import {
  isFeatureEnabled,
  mergePlanFeatures,
  parsePlanFeatures,
  type PlanFeatureKey,
  type PlanFeatures,
} from './planFeatures.ts';
import { jsonUpgradeHook } from './httpResponse.ts';
import { capturePostHogEvent } from './posthog.ts';
import type { TelegramAssetScope } from './telegramAssetScope.ts';
import { upsertAiPlatformOrgSettings } from './aiUsageService.ts';
import {
  computeTotalFromPricingParams,
  parsePricingSnapshot,
  pricingParamsFromPlan,
  type PlanPricingParams,
} from './planPricing.ts';
import { normalizePermissionIds } from './propertyTeamPermissions.ts';
import { chunkIds, countInIdChunks, selectInIdChunks } from './postgrestInChunks.ts';
import { subscriptionStatusBlocksFeatureGates } from './orgSubscriptionStateMachine.ts';
import { listBillablePropertyIds } from './orgBillableProperties.ts';
import { computeUnusedCreditPhp, periodRemaining } from './billingPeriod.ts';
import { addLedgerEntry } from './orgBillingLedger.ts';
import { computePropertyTrueUpPhp } from './orgBillingQuote.ts';

export class PlanFeatureRequiredError extends Error {
  readonly upgradeHook = true;

  constructor(
    readonly feature: PlanFeatureKey,
    message?: string
  ) {
    super(message ?? `This feature requires a paid plan (${feature})`);
    this.name = 'PlanFeatureRequiredError';
  }
}

export type PricingModel = 'subscription' | 'commission';

export type OrgSubscriptionRow = {
  id: string;
  organizationId: string;
  planId: string;
  pricingModel: PricingModel;
  pricePhpSnapshot: number | null;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  featureOverrides: Record<string, unknown> | null;
  planCode: string;
  planName: string;
  planFeatures: PlanFeatures;
  planSortOrder: number;
  planIsDefault: boolean;
  source: string;
  graceEndsAt: string | null;
  suspendedAt: string | null;
  cancelAtPeriodEnd: boolean;
  scheduledPlanId: string | null;
  scheduledChangeAt: string | null;
  periodPaidPhp: number;
  priceOverridePhp: number | null;
  billingAnchorDay: number | null;
  /** Pricing the subscription bought (grandfathered until a price migration moves it). */
  pricingSnapshot: PlanPricingParams | null;
};

export const ORG_SUBSCRIPTION_SELECT = `
      id,
      organization_id,
      plan_id,
      pricing_model,
      price_php_snapshot,
      status,
      source,
      current_period_start,
      current_period_end,
      grace_period_ends_at,
      suspended_at,
      cancel_at_period_end,
      scheduled_plan_id,
      scheduled_change_at,
      period_paid_php,
      price_override_php,
      billing_anchor_day,
      pricing_snapshot,
      feature_overrides`;

export type ResolvedPropertyEntitlements = PlanFeatures & {
  planCode: string;
  planName: string;
  pricingModel: PricingModel;
  status: string;
  /** org_subscriptions.id (or '' for the unenrolled/Free fallback) — kept under its original
   * name since it's a thin passthrough field with no other consumer worth a rename. */
  propertySubscriptionId: string;
  planId: string;
};

type PricingPlanRow = {
  id: string;
  code: string;
  name: string;
  pricing_model: string;
  price_php: number | null;
  discount_percent: number | null;
  volume_discount_tiers: unknown;
  volume_ramp_floor_php: number | null;
  volume_ramp_at_count: number | null;
  commission_rate_percent: number | null;
  features: unknown;
  is_default: boolean;
  sort_order?: number | null;
  is_active?: boolean | null;
};

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

function serializeOrgSubscription(
  sub: Record<string, unknown>,
  plan: PricingPlanRow
): OrgSubscriptionRow {
  return {
    id: sub.id as string,
    organizationId: sub.organization_id as string,
    planId: sub.plan_id as string,
    pricingModel: sub.pricing_model as PricingModel,
    pricePhpSnapshot: sub.price_php_snapshot == null ? null : Number(sub.price_php_snapshot),
    status: String(sub.status ?? 'active'),
    currentPeriodStart: (sub.current_period_start as string | null) ?? null,
    currentPeriodEnd: (sub.current_period_end as string | null) ?? null,
    featureOverrides:
      sub.feature_overrides && typeof sub.feature_overrides === 'object'
        ? (sub.feature_overrides as Record<string, unknown>)
        : null,
    planCode: plan.code,
    planName: plan.name,
    planFeatures: parsePlanFeatures(plan.features),
    planSortOrder: Number(plan.sort_order ?? 0),
    planIsDefault: Boolean(plan.is_default),
    source: String(sub.source ?? 'purchase'),
    graceEndsAt: (sub.grace_period_ends_at as string | null) ?? null,
    suspendedAt: (sub.suspended_at as string | null) ?? null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    scheduledPlanId: (sub.scheduled_plan_id as string | null) ?? null,
    scheduledChangeAt: (sub.scheduled_change_at as string | null) ?? null,
    periodPaidPhp: Number(sub.period_paid_php ?? 0),
    priceOverridePhp: sub.price_override_php == null ? null : Number(sub.price_override_php),
    billingAnchorDay: sub.billing_anchor_day == null ? null : Number(sub.billing_anchor_day),
    pricingSnapshot: parsePricingSnapshot(sub.pricing_snapshot),
  };
}

const PLAN_SELECT_FIELDS =
  'id, code, name, pricing_model, price_php, discount_percent, volume_discount_tiers, volume_ramp_floor_php, volume_ramp_at_count, commission_rate_percent, features, is_default, sort_order, is_active';

export async function getDefaultPricingPlan(): Promise<PricingPlanRow> {
  const sb = db();
  const { data, error } = await sb
    .from('pricing_plans')
    .select(PLAN_SELECT_FIELDS)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const { data: fallback, error: fbError } = await sb
      .from('pricing_plans')
      .select(PLAN_SELECT_FIELDS)
      .eq('code', 'free')
      .maybeSingle();
    if (fbError) throw new Error(fbError.message);
    if (!fallback) throw new Error('No default pricing plan configured');
    return fallback as PricingPlanRow;
  }
  return data as PricingPlanRow;
}

/** The org's current live subscription (active/trialing/past_due/suspended), if any. */
export async function getActiveOrgSubscription(
  organizationId: string
): Promise<OrgSubscriptionRow | null> {
  const sb = db();
  // Hint plan_id FK: org_subscriptions also FKs pricing_plans via scheduled_plan_id (PGRST201).
  const { data, error } = await sb
    .from('org_subscriptions')
    .select(
      `
${ORG_SUBSCRIPTION_SELECT},
      pricing_plans!org_subscriptions_plan_id_fkey!inner (${PLAN_SELECT_FIELDS})
    `
    )
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing', 'past_due', 'suspended'])
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const plan = (data as Record<string, unknown>).pricing_plans as PricingPlanRow;
  const { pricing_plans: _planJoin, ...sub } = data as Record<string, unknown>;
  return serializeOrgSubscription(sub, plan);
}

/** The live org subscription covering this property, if it's enrolled in one. */
export async function getActiveOrgSubscriptionForProperty(
  propertyId: string
): Promise<OrgSubscriptionRow | null> {
  const sb = db();

  const { data: slot, error: slotError } = await sb
    .from('org_subscription_properties')
    .select('org_subscription_id')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (slotError) throw new Error(slotError.message);
  if (!slot) return null;

  const { data, error } = await sb
    .from('org_subscriptions')
    .select(
      `
${ORG_SUBSCRIPTION_SELECT},
      pricing_plans!org_subscriptions_plan_id_fkey!inner (${PLAN_SELECT_FIELDS})
    `
    )
    .eq('id', slot.org_subscription_id as string)
    .in('status', ['active', 'trialing', 'past_due', 'suspended'])
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const plan = (data as Record<string, unknown>).pricing_plans as PricingPlanRow;
  const { pricing_plans: _planJoin, ...sub } = data as Record<string, unknown>;
  return serializeOrgSubscription(sub, plan);
}

export type ResolvedOrgEntitlements = ResolvedPropertyEntitlements;

/**
 * What a subscription lets the org do right now. A suspended subscription (grace ended, payment
 * still missing) keeps its plan identity for billing screens but works like Free: every paid
 * feature is off on every read path (crons, guest pages, AI, sync), and Free features keep
 * working. Paying restores the plan's features.
 */
async function resolveSubscriptionFeatures(
  subscription: OrgSubscriptionRow
): Promise<PlanFeatures> {
  if (subscriptionStatusBlocksFeatureGates(subscription.status)) {
    const defaultPlan = await getDefaultPricingPlan();
    return parsePlanFeatures(defaultPlan.features);
  }
  return mergePlanFeatures(subscription.planFeatures, subscription.featureOverrides);
}

/** Org-wide entitlements — live org subscription features or Free default when none. */
export async function resolveOrgEntitlements(
  organizationId: string
): Promise<ResolvedOrgEntitlements> {
  const subscription = await getActiveOrgSubscription(organizationId);

  if (!subscription) {
    const defaultPlan = await getDefaultPricingPlan();
    const merged = parsePlanFeatures(defaultPlan.features);
    return {
      ...merged,
      planCode: defaultPlan.code,
      planName: defaultPlan.name,
      pricingModel: defaultPlan.pricing_model as PricingModel,
      status: 'active',
      propertySubscriptionId: '',
      planId: defaultPlan.id,
    };
  }

  const merged = await resolveSubscriptionFeatures(subscription);

  return {
    ...merged,
    planCode: subscription.planCode,
    planName: subscription.planName,
    pricingModel: subscription.pricingModel,
    status: subscription.status,
    propertySubscriptionId: subscription.id,
    planId: subscription.planId,
  };
}

/** True when the org has a live subscription on a paid (non-Free) tier. */
export async function orgHasLivePaidSubscription(organizationId: string): Promise<boolean> {
  const subscription = await getActiveOrgSubscription(organizationId);
  return subscription != null && subscription.planCode !== 'free';
}

export async function resolvePropertyEntitlements(
  propertyId: string
): Promise<ResolvedPropertyEntitlements> {
  let subscription: OrgSubscriptionRow | null =
    await getActiveOrgSubscriptionForProperty(propertyId);

  if (!subscription) {
    const defaultPlan = await getDefaultPricingPlan();
    subscription = {
      id: '',
      organizationId: '',
      planId: defaultPlan.id,
      pricingModel: defaultPlan.pricing_model as PricingModel,
      pricePhpSnapshot: defaultPlan.price_php == null ? null : Number(defaultPlan.price_php),
      status: 'active',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      featureOverrides: null,
      planCode: defaultPlan.code,
      planName: defaultPlan.name,
      planFeatures: parsePlanFeatures(defaultPlan.features),
      planSortOrder: Number(defaultPlan.sort_order ?? 0),
      planIsDefault: true,
      source: 'purchase',
      graceEndsAt: null,
      suspendedAt: null,
      cancelAtPeriodEnd: false,
      scheduledPlanId: null,
      scheduledChangeAt: null,
      periodPaidPhp: 0,
      priceOverridePhp: null,
      billingAnchorDay: null,
      pricingSnapshot: null,
    };
  }

  const merged = await resolveSubscriptionFeatures(subscription);

  return {
    ...merged,
    planCode: subscription.planCode,
    planName: subscription.planName,
    pricingModel: subscription.pricingModel,
    status: subscription.status,
    propertySubscriptionId: subscription.id,
    planId: subscription.planId,
  };
}

/** The error for a feature the plan does not include. A suspended org sees why, not an upsell. */
function featureBlockedError(
  entitlements: ResolvedPropertyEntitlements,
  feature: PlanFeatureKey
): PlanFeatureRequiredError {
  if (subscriptionStatusBlocksFeatureGates(entitlements.status)) {
    return new PlanFeatureRequiredError(
      feature,
      'Subscription suspended: paid features are paused until the overdue payment is made. Pay from Plans & Billing to turn them back on.'
    );
  }
  return new PlanFeatureRequiredError(feature);
}

export async function requirePropertyFeature(
  propertyId: string,
  feature: PlanFeatureKey
): Promise<ResolvedPropertyEntitlements> {
  const entitlements = await resolvePropertyEntitlements(propertyId);
  if (!isFeatureEnabled(entitlements, feature)) {
    throw featureBlockedError(entitlements, feature);
  }
  return entitlements;
}

/**
 * Property-independent org feature gate — resolves straight from `organizationId` via
 * `resolveOrgEntitlements` (org's live subscription, or Free default), never a property proxy.
 * This is what closes the `parking-property-parity.md` interim-ungate blocker: a parking-only
 * org with zero properties has no property to resolve through
 * (`resolveTelegramEntitlementPropertyId`'s `firstActivePropertyIdForOrg` returns `null` for it),
 * but this function needs nothing but the org id. Mirrors `requirePropertyFeature` exactly,
 * just against `resolveOrgEntitlements` instead of `resolvePropertyEntitlements`.
 */
export async function requireOrgFeature(
  organizationId: string,
  feature: PlanFeatureKey
): Promise<ResolvedOrgEntitlements> {
  const entitlements = await resolveOrgEntitlements(organizationId);
  if (!isFeatureEnabled(entitlements, feature)) {
    throw featureBlockedError(entitlements, feature);
  }
  return entitlements;
}

/** Map PlanFeatureRequiredError to the shared upgradeHook JSON envelope. */
export function catchPlanFeatureError(req: Request, err: unknown): Response | null {
  if (err instanceof PlanFeatureRequiredError) {
    return jsonUpgradeHook(req, err.message, { feature: err.feature });
  }
  return null;
}

/**
 * Every property that shares `propertyId`'s quantity-limited entitlements (team seats,
 * marketing publish cap) — every property enrolled in the same *live* org subscription, or just
 * `propertyId` alone if it isn't enrolled in one (its own Free/standalone budget). Mirrors
 * resolvePropertyEntitlements's own org-subscription-first, Free-fallback resolution exactly, so
 * "which pool is this property in" never disagrees with "which plan is this property on."
 */
async function entitlementPoolPropertyIds(propertyId: string): Promise<string[]> {
  const sb = db();
  const { data: slot, error } = await sb
    .from('org_subscription_properties')
    .select('org_subscription_id, org_subscriptions!inner(status)')
    .eq('property_id', propertyId)
    .in('org_subscriptions.status', ['active', 'trialing', 'past_due'])
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!slot) return [propertyId];

  const { data: rows, error: rowsError } = await sb
    .from('org_subscription_properties')
    .select('property_id')
    .eq('org_subscription_id', slot.org_subscription_id as string);
  if (rowsError) throw new Error(rowsError.message);
  return (rows ?? []).map((r) => r.property_id as string);
}

async function countOrgAdminTeamSlots(organizationId: string, ownerId: string): Promise<number> {
  const sb = db();

  const { count: orgAdminCount, error: orgAdminError } = await sb
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .neq('user_id', ownerId);
  if (orgAdminError) throw new Error(orgAdminError.message);

  const { count: orgInviteCount, error: orgInviteError } = await sb
    .from('organization_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'pending');
  if (orgInviteError) throw new Error(orgInviteError.message);

  return 1 + (orgAdminCount ?? 0) + (orgInviteCount ?? 0);
}

async function countPropertyPoolTeamSlots(poolPropertyIds: string[]): Promise<number> {
  const sb = db();

  let memberCount = 0;
  let inviteCount = 0;
  if (poolPropertyIds.length > 0) {
    memberCount = await countInIdChunks(poolPropertyIds, (chunk) =>
      sb
        .from('property_members')
        .select('id', { count: 'exact', head: true })
        .in('property_id', chunk)
        .eq('status', 'active')
        .eq('assigned_via_org', false)
    );

    inviteCount = await countInIdChunks(poolPropertyIds, (chunk) =>
      sb
        .from('property_invitations')
        .select('id', { count: 'exact', head: true })
        .in('property_id', chunk)
        .eq('status', 'pending')
    );
  }

  return memberCount + inviteCount;
}

async function countPooledTeamSlots(
  organizationId: string,
  poolPropertyIds: string[],
  ownerId: string
): Promise<number> {
  const orgSlots = await countOrgAdminTeamSlots(organizationId, ownerId);
  const propertySlots = await countPropertyPoolTeamSlots(poolPropertyIds);
  // Owner is included in orgSlots; property pool excludes org-assigned members.
  return orgSlots + propertySlots - 1;
}

/** Org admin + pending org invites (+ owner slot) — used for org team invite capacity. */
export async function countOrgAdminTeamSlotsForOrg(organizationId: string): Promise<number> {
  const sb = db();
  const { data: org, error: orgError } = await sb
    .from('organizations')
    .select('owner_id')
    .eq('id', organizationId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!org) return 0;
  return countOrgAdminTeamSlots(organizationId, org.owner_id as string);
}
/** Org-wide pooled team-seat count — org admin seats + direct property team seats. */
export async function countOrgWideTeamSlots(organizationId: string): Promise<number> {
  const sb = db();
  const { data: org, error: orgError } = await sb
    .from('organizations')
    .select('owner_id')
    .eq('id', organizationId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!org) return 0;

  const { data: properties, error } = await sb
    .from('properties')
    .select('id')
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  const propertyIds = (properties ?? []).map((row) => row.id as string);
  return countPooledTeamSlots(organizationId, propertyIds, org.owner_id as string);
}

export async function countOrgTeamSlots(propertyId: string): Promise<number> {
  const sb = db();
  const poolPropertyIds = await entitlementPoolPropertyIds(propertyId);

  const { data: property, error: propertyError } = await sb
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (propertyError) throw new Error(propertyError.message);
  if (!property) throw new Error('Property not found');

  const { data: org, error: orgError } = await sb
    .from('organizations')
    .select('owner_id')
    .eq('id', property.organization_id as string)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!org) throw new Error('Organization not found');

  return countPooledTeamSlots(
    property.organization_id as string,
    poolPropertyIds,
    org.owner_id as string
  );
}

export type TeamInviteCapacity = {
  slotsUsed: number;
  maxMembers: number | null;
  teamManagementEnabled: boolean;
  canInvite: boolean;
};

export async function resolveTeamInviteCapacityForOrg(
  organizationId: string
): Promise<TeamInviteCapacity> {
  const entitlements = await resolveOrgEntitlements(organizationId);
  const enabled = entitlements.teamManagement.enabled;
  const max = enabled ? entitlements.teamManagement.maxMembers : 0;
  const used = await countOrgAdminTeamSlotsForOrg(organizationId);
  const canInvite = enabled && (max === null || used < max);
  return {
    slotsUsed: used,
    maxMembers: max,
    teamManagementEnabled: enabled,
    canInvite,
  };
}

type OrgAdminSeatReconciliation = {
  budget: number | null;
  activeCount: number;
  deactivatedMemberIds: string[];
  reactivatedMemberIds: string[];
};

async function reconcileOrgAdminSeats(
  organizationId: string,
  entitlements: ResolvedOrgEntitlements
): Promise<OrgAdminSeatReconciliation> {
  const sb = db();
  const maxMembers = entitlements.teamManagement.enabled
    ? entitlements.teamManagement.maxMembers
    : 0;

  const result: OrgAdminSeatReconciliation = {
    budget: null,
    activeCount: 0,
    deactivatedMemberIds: [],
    reactivatedMemberIds: [],
  };

  const { data: org, error: orgError } = await sb
    .from('organizations')
    .select('owner_id')
    .eq('id', organizationId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!org) return result;
  const ownerId = org.owner_id as string;

  const { data: properties, error: propsError } = await sb
    .from('properties')
    .select('id')
    .eq('organization_id', organizationId);
  if (propsError) throw new Error(propsError.message);
  const propertyIds = (properties ?? []).map((row) => row.id as string);

  let propertyActive = 0;
  let propertyPending = 0;
  if (propertyIds.length > 0) {
    propertyActive = await countInIdChunks(propertyIds, (chunk) =>
      sb
        .from('property_members')
        .select('id', { count: 'exact', head: true })
        .in('property_id', chunk)
        .eq('status', 'active')
    );

    propertyPending = await countInIdChunks(propertyIds, (chunk) =>
      sb
        .from('property_invitations')
        .select('id', { count: 'exact', head: true })
        .in('property_id', chunk)
        .eq('status', 'pending')
    );
  }

  const { count: orgPending, error: orgInviteError } = await sb
    .from('organization_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'pending');
  if (orgInviteError) throw new Error(orgInviteError.message);

  let budget: number | null = null;
  if (maxMembers !== null) {
    budget = Math.max(0, maxMembers - 1 - propertyActive - propertyPending - (orgPending ?? 0));
  }
  result.budget = budget;

  const { data: rows, error: rowsError } = await sb
    .from('organization_members')
    .select('id, user_id, status, plan_limited, assigned_at')
    .eq('organization_id', organizationId)
    .neq('user_id', ownerId)
    .order('assigned_at', { ascending: true });
  if (rowsError) throw new Error(rowsError.message);
  const members = rows ?? [];

  const active = members.filter((m) => m.status === 'active');
  result.activeCount = active.length;

  if (budget === null) {
    const toRestore = members.filter((m) => m.status === 'inactive' && m.plan_limited === true);
    for (const m of toRestore) {
      const { error } = await sb
        .from('organization_members')
        .update({ status: 'active', plan_limited: false })
        .eq('id', m.id as string);
      if (error) throw new Error(error.message);
      result.reactivatedMemberIds.push(m.id as string);
    }
    return result;
  }

  if (active.length > budget) {
    const overBy = active.length - budget;
    const toDeactivate = active.slice(active.length - overBy);
    for (const m of toDeactivate) {
      const { error } = await sb
        .from('organization_members')
        .update({ status: 'inactive', plan_limited: true })
        .eq('id', m.id as string);
      if (error) throw new Error(error.message);
      result.deactivatedMemberIds.push(m.id as string);
    }
    result.activeCount = budget;
  } else if (active.length < budget) {
    const room = budget - active.length;
    const restorable = members
      .filter((m) => m.status === 'inactive' && m.plan_limited === true)
      .slice(0, room);
    for (const m of restorable) {
      const { error } = await sb
        .from('organization_members')
        .update({ status: 'active', plan_limited: false })
        .eq('id', m.id as string);
      if (error) throw new Error(error.message);
      result.reactivatedMemberIds.push(m.id as string);
    }
    result.activeCount = active.length + restorable.length;
  }

  return result;
}

/** Reconcile org admins + property pool seats for an org (no-op when the org has no properties). */
export async function reconcileTeamSeatsForOrganization(organizationId: string): Promise<void> {
  const sb = db();
  const { data: property, error } = await sb
    .from('properties')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (property?.id) {
    await reconcileTeamSeatsForProperty(property.id as string);
    return;
  }
  const entitlements = await resolveOrgEntitlements(organizationId);
  await reconcileOrgAdminSeats(organizationId, entitlements);
}

/** Blocks invite when team management is off or the pool's maxMembers is reached. */
export async function requireTeamInviteAllowed(
  propertyId: string
): Promise<ResolvedPropertyEntitlements> {
  const entitlements = await resolvePropertyEntitlements(propertyId);
  if (!entitlements.teamManagement.enabled) {
    throw new PlanFeatureRequiredError('teamManagement');
  }

  const max = entitlements.teamManagement.maxMembers;
  if (max !== null && max >= 0) {
    const poolPropertyIds = await entitlementPoolPropertyIds(propertyId);
    const propertySlots = await countPropertyPoolTeamSlots(poolPropertyIds);
    const count = 1 + propertySlots;
    if (count >= max) {
      throw new PlanFeatureRequiredError('teamManagement', `Team member limit reached (${max})`);
    }
  }

  return entitlements;
}

/** Blocks org-level invite when team management is off or the org-wide pool maxMembers is reached. */
export async function requireOrgTeamInviteAllowed(
  organizationId: string
): Promise<ResolvedOrgEntitlements> {
  const entitlements = await resolveOrgEntitlements(organizationId);
  if (!entitlements.teamManagement.enabled) {
    throw new PlanFeatureRequiredError('teamManagement');
  }

  const max = entitlements.teamManagement.maxMembers;
  if (max !== null && max >= 0) {
    const count = await countOrgAdminTeamSlotsForOrg(organizationId);
    if (count >= max) {
      throw new PlanFeatureRequiredError('teamManagement', `Team member limit reached (${max})`);
    }
  }

  return entitlements;
}

export type TeamSeatReconciliation = {
  /** Real member budget after subtracting the owner + org-admin virtual slots, null = unlimited. */
  budget: number | null;
  activeCount: number;
  deactivatedMemberIds: string[];
  reactivatedMemberIds: string[];
};

/**
 * Keeps property_members in sync with the *current*, org-wide-pooled team-seat entitlement
 * shared by every property enrolled in the same live org subscription as `propertyId` (or just
 * `propertyId` alone if unenrolled) — after any event that can change it: a plan switch, adding
 * or removing an enrolled property, a subscription lapsing to suspended, or an invite accepted
 * while already at the cap. Never deletes a row: over budget, the newest-assigned active members
 * across the *whole pool* are switched to inactive with plan_limited=true (permissions stashed in
 * saved_permissions, same shape a manual deactivate already uses); once budget frees up — a later
 * upgrade, another property leaving the pool, or an admin manually deactivating someone else
 * first — the longest-waiting plan_limited members are restored automatically, oldest first. A
 * manual deactivation (plan_limited stays false) is never touched by this function; only seats it
 * took away itself get auto-restored.
 *
 * Deliberately does not enforce assertNotLastPropertyTeamManager's "keep one manager" rule — the
 * seat cap is a hard constraint that must hold regardless, and the org owner (never a
 * property_members row, always full permissions) is the permanent fallback manager.
 */
export async function reconcileTeamSeatsForProperty(
  propertyId: string
): Promise<TeamSeatReconciliation> {
  const sb = db();
  const entitlements = await resolvePropertyEntitlements(propertyId);
  const maxMembers = entitlements.teamManagement.enabled
    ? entitlements.teamManagement.maxMembers
    : 0;

  const result: TeamSeatReconciliation = {
    budget: null,
    activeCount: 0,
    deactivatedMemberIds: [],
    reactivatedMemberIds: [],
  };

  const { data: property, error: propertyError } = await sb
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (propertyError) throw new Error(propertyError.message);
  if (!property) return result;

  const organizationId = property.organization_id as string;
  const orgEntitlements = await resolveOrgEntitlements(organizationId);
  await reconcileOrgAdminSeats(organizationId, orgEntitlements);

  const { data: org, error: orgError } = await sb
    .from('organizations')
    .select('owner_id')
    .eq('id', organizationId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  const ownerId = (org?.owner_id as string | undefined) ?? '';

  const poolPropertyIds = await entitlementPoolPropertyIds(propertyId);

  let budget: number | null = null;
  if (maxMembers !== null) {
    const { count: orgAdminCount, error: orgAdminError } = await sb
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .neq('user_id', ownerId);
    if (orgAdminError) throw new Error(orgAdminError.message);
    const virtualSlotsUsed = 1 + (orgAdminCount ?? 0);
    budget = Math.max(0, maxMembers - virtualSlotsUsed);
  }
  result.budget = budget;

  const members = (
    await selectInIdChunks<{
      id: string;
      status: string;
      plan_limited: boolean | null;
      permissions: unknown;
      saved_permissions: unknown;
      assigned_at: string | null;
    }>(poolPropertyIds, (chunk) =>
      sb
        .from('property_members')
        .select('id, status, plan_limited, permissions, saved_permissions, assigned_at')
        .in('property_id', chunk)
    )
  ).sort((a, b) => String(a.assigned_at ?? '').localeCompare(String(b.assigned_at ?? '')));

  const active = members.filter((m) => m.status === 'active');
  result.activeCount = active.length;

  if (budget === null) {
    // Unlimited — restore every seat this function previously took away.
    const toRestore = members.filter((m) => m.status === 'inactive' && m.plan_limited === true);
    for (const m of toRestore) {
      const { error } = await sb
        .from('property_members')
        .update({
          status: 'active',
          permissions: normalizePermissionIds(m.saved_permissions),
          saved_permissions: null,
          plan_limited: false,
        })
        .eq('id', m.id as string);
      if (error) throw new Error(error.message);
      result.reactivatedMemberIds.push(m.id as string);
    }
    return result;
  }

  if (active.length > budget) {
    // Newest-assigned first (rows are already ordered assigned_at ASC).
    const overBy = active.length - budget;
    const toDeactivate = active.slice(active.length - overBy);
    for (const m of toDeactivate) {
      const { error } = await sb
        .from('property_members')
        .update({
          status: 'inactive',
          saved_permissions: normalizePermissionIds(m.permissions),
          permissions: [],
          plan_limited: true,
        })
        .eq('id', m.id as string);
      if (error) throw new Error(error.message);
      result.deactivatedMemberIds.push(m.id as string);
    }
    result.activeCount = budget;
  } else if (active.length < budget) {
    const room = budget - active.length;
    const restorable = members
      .filter((m) => m.status === 'inactive' && m.plan_limited === true)
      .slice(0, room); // already assigned_at ASC — oldest/longest-tenured restored first
    for (const m of restorable) {
      const { error } = await sb
        .from('property_members')
        .update({
          status: 'active',
          permissions: normalizePermissionIds(m.saved_permissions),
          saved_permissions: null,
          plan_limited: false,
        })
        .eq('id', m.id as string);
      if (error) throw new Error(error.message);
      result.reactivatedMemberIds.push(m.id as string);
    }
    result.activeCount = active.length + restorable.length;
  }

  return result;
}

export async function requireTelegramNotificationsEnabled(propertyId: string): Promise<void> {
  await requirePropertyFeature(propertyId, 'telegramNotifications');
}

async function firstActivePropertyIdForOrg(orgId: string): Promise<string | null> {
  const sb = db();

  // Prefer a property already covered by a live org subscription — resolving entitlements from
  // it gives parking the org's real plan instead of falling through to whatever an unrelated
  // property happens to have. This proxy is what `requireOrgFeature` (property-independent,
  // used by the two callers below) superseded for telegramNotifications/aiDashboardAssistant —
  // still used by resolveListingEntitlementPropertyId (recommendedBadgeEligible), out of scope
  // for that feature's own parity work.
  const { data: bundled, error: bundledError } = await sb
    .from('org_subscription_properties')
    .select('property_id, org_subscriptions!inner (organization_id, status)')
    .eq('org_subscriptions.organization_id', orgId)
    .in('org_subscriptions.status', ['active', 'trialing', 'past_due'])
    .limit(1)
    .maybeSingle();
  if (bundledError) throw new Error(bundledError.message);
  if (bundled?.property_id) return String(bundled.property_id);

  const { data, error } = await sb
    .from('properties')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

/** Property-scoped Telegram uses the property id directly. The `asset.kind === 'parking'`
 * branch below is superseded by `requireOrgFeature` (see `telegramSettingsHttp.ts`'s
 * `gateTelegramEnabledPatch`, which now resolves parking's org id directly and never calls this
 * function for a parking asset) — kept only so this function stays total over
 * `TelegramAssetScope` for any other caller that might still pass a parking asset in. */
export async function resolveTelegramEntitlementPropertyId(
  asset: TelegramAssetScope
): Promise<string> {
  if (asset.kind === 'property') return asset.id;

  const sb = db();
  const { data: parking, error } = await sb
    .from('parkings')
    .select('organization_id')
    .eq('id', asset.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!parking) throw new Error('Parking not found');

  const propertyId = await firstActivePropertyIdForOrg(parking.organization_id as string);
  if (!propertyId) {
    throw new PlanFeatureRequiredError(
      'telegramNotifications',
      'No active property found for plan check'
    );
  }
  return propertyId;
}

export async function orgHasPropertyWithFeature(
  orgId: string,
  feature: PlanFeatureKey
): Promise<boolean> {
  const sb = db();
  const { data: properties, error } = await sb
    .from('properties')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'ACTIVE');
  if (error) throw new Error(error.message);
  if (!properties?.length) return false;

  for (const row of properties) {
    const entitlements = await resolvePropertyEntitlements(row.id as string);
    if (isFeatureEnabled(entitlements, feature)) return true;
  }
  return false;
}

export async function requireOrgPropertyFeature(
  orgId: string,
  feature: PlanFeatureKey
): Promise<void> {
  const subscription = await getActiveOrgSubscription(orgId);
  if (subscription && subscriptionStatusBlocksFeatureGates(subscription.status)) {
    throw new PlanFeatureRequiredError(
      feature,
      'Subscription suspended - pay from Plans & Billing to restore access'
    );
  }
  const allowed = await orgHasPropertyWithFeature(orgId, feature);
  if (!allowed) {
    throw new PlanFeatureRequiredError(feature);
  }
}

export async function resolveListingEntitlementPropertyId(
  listingKind: 'property' | 'parking',
  listingId: string
): Promise<string> {
  if (listingKind === 'property') return listingId;

  const sb = db();
  const { data: parking, error } = await sb
    .from('parkings')
    .select('organization_id')
    .eq('id', listingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!parking) throw new Error('Listing not found');

  const propertyId = await firstActivePropertyIdForOrg(parking.organization_id as string);
  if (!propertyId) {
    throw new PlanFeatureRequiredError(
      'recommendedBadgeEligible',
      'No active property found for plan check'
    );
  }
  return propertyId;
}

export function patchEnablesInboxAutoSend(
  body: Record<string, unknown>,
  current: { auto_reply_enabled?: boolean; auto_reply_mode?: string }
): boolean {
  const nextEnabled =
    body.autoReplyEnabled !== undefined
      ? Boolean(body.autoReplyEnabled)
      : Boolean(current.auto_reply_enabled);
  const nextMode =
    body.autoReplyMode === 'draft' || body.autoReplyMode === 'send'
      ? body.autoReplyMode
      : (current.auto_reply_mode ?? 'draft');
  const currentlyAutoSend =
    Boolean(current.auto_reply_enabled) && current.auto_reply_mode === 'send';
  const willAutoSend = nextEnabled && nextMode === 'send';
  return willAutoSend && !currentlyAutoSend;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function syncAiCreditsFromPlan(
  organizationId: string,
  planCode: string,
  monthlyCreditAllowance: number,
  assignedBy: string | null
): Promise<void> {
  // `updated_by` is a uuid: system-driven changes (cron, webhook) pass no user. A placeholder
  // string such as 'system' would fail the write and abort the whole plan change.
  const updatedBy = assignedBy && UUID_PATTERN.test(assignedBy) ? assignedBy : null;
  // Plan allowance is its own layer in aiLimitResolver (below profiles), not an override:
  // `monthly_credit_limit` stays reserved for super-admin overrides.
  await upsertAiPlatformOrgSettings({
    organizationId,
    planTier: planCode,
    planCreditAllowance: monthlyCreditAllowance,
    updatedBy,
  });
}

export type OrgSubscriptionEventType =
  | 'assigned'
  | 'plan_changed'
  | 'status_changed'
  | 'property_added'
  | 'property_removed'
  | 'reward_granted'
  | 'reward_expired'
  | 'reward_revoked'
  | 'change_scheduled'
  | 'change_canceled'
  | 'change_applied'
  | 'cancel_scheduled'
  | 'cancel_reverted'
  | 'renewed'
  | 'past_due'
  | 'suspended'
  | 'canceled'
  | 'reactivated'
  | 'ledger_entry'
  | 'payment_unapplied'
  | 'price_migrated';

export async function writeOrgSubscriptionEvent(input: {
  orgSubscriptionId: string;
  eventType: OrgSubscriptionEventType;
  previousPlanId?: string | null;
  newPlanId?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  propertyId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const sb = db();
  const { error } = await sb.from('org_subscription_events').insert({
    org_subscription_id: input.orgSubscriptionId,
    event_type: input.eventType,
    previous_plan_id: input.previousPlanId ?? null,
    new_plan_id: input.newPlanId ?? null,
    previous_status: input.previousStatus ?? null,
    new_status: input.newStatus ?? null,
    property_id: input.propertyId ?? null,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  });
  if (error) throw new Error(error.message);
}

type OrgEligiblePlanRow = PricingPlanRow;

/**
 * Loads a plan for a subscription write. A subscription that already sits on a plan keeps working
 * after that plan is retired from the catalog (renewals, property changes, scheduled moves), so
 * callers that act on an existing subscription pass `allowInactive`.
 */
export async function loadOrgEligiblePlan(
  planId: string,
  options: { allowInactive?: boolean } = {}
): Promise<OrgEligiblePlanRow> {
  const sb = db();
  let query = sb.from('pricing_plans').select(PLAN_SELECT_FIELDS).eq('id', planId);
  if (!options.allowInactive) query = query.eq('is_active', true);
  const { data: plan, error: planError } = await query.maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) throw new Error('Pricing plan not found or inactive');
  if (plan.pricing_model === 'commission') {
    throw new Error('Commission pricing is not available');
  }
  return plan as OrgEligiblePlanRow;
}

function orgSubscriptionTotalForPlan(plan: OrgEligiblePlanRow, propertyCount: number): number {
  return computeTotalFromPricingParams(pricingParamsFromPlan(plan), propertyCount);
}

/**
 * Recurring total for a subscription: a super-admin price override (sales-assisted tiers) wins,
 * then the pricing the subscription bought (grandfathered), then the plan's current pricing.
 */
export function resolveSubscriptionTotalPhp(
  priceOverridePhp: unknown,
  plan: OrgEligiblePlanRow,
  propertyCount: number,
  pricingSnapshot: unknown = null
): number {
  if (priceOverridePhp != null && Number.isFinite(Number(priceOverridePhp))) {
    return Number(priceOverridePhp);
  }
  const params = parsePricingSnapshot(pricingSnapshot) ?? pricingParamsFromPlan(plan);
  return computeTotalFromPricingParams(params, propertyCount);
}

/** Every billable property in the org (archived listings are off the bill). */
async function listOrganizationPropertyIds(organizationId: string): Promise<string[]> {
  return await listBillablePropertyIds(organizationId);
}

const LIVE_STATUSES = ['active', 'trialing', 'past_due', 'suspended'];

/** Creates a new org subscription and slots the given properties into it. No property-count cap
 * — price scales with volume-discounted rate x count (see orgSubscriptionTotalForPlan). */
export async function createOrgSubscription(
  organizationId: string,
  planId: string,
  propertyIds: string[],
  assignedBy: string | null
): Promise<{ orgSubscriptionId: string }> {
  const sb = db();
  const plan = await loadOrgEligiblePlan(planId);

  if (propertyIds.length === 0) throw new Error('Select at least one property');
  const uniquePropertyIds = Array.from(new Set(propertyIds));

  const properties = await selectInIdChunks<{ id: string; organization_id: string }>(
    uniquePropertyIds,
    (chunk) => sb.from('properties').select('id, organization_id').in('id', chunk)
  );
  if (properties.length !== uniquePropertyIds.length) {
    throw new Error('One or more properties not found');
  }
  if (properties.some((p) => p.organization_id !== organizationId)) {
    throw new Error('All properties must belong to this organization');
  }

  const existingSlots = await selectInIdChunks<{ property_id: string }>(
    uniquePropertyIds,
    (chunk) => sb.from('org_subscription_properties').select('property_id').in('property_id', chunk)
  );
  if (existingSlots.length > 0) {
    throw new Error('One or more properties are already covered by an org subscription');
  }

  const { data: existingOrgSub, error: existingOrgSubError } = await sb
    .from('org_subscriptions')
    .select('id')
    .eq('organization_id', organizationId)
    .in('status', LIVE_STATUSES)
    .maybeSingle();
  if (existingOrgSubError) throw new Error(existingOrgSubError.message);
  if (existingOrgSub) {
    throw new Error(
      'This organization already has an active subscription - use changeOrgSubscription instead'
    );
  }

  const totalPricePhp = orgSubscriptionTotalForPlan(plan, uniquePropertyIds.length);

  const { data: inserted, error: insertError } = await sb
    .from('org_subscriptions')
    .insert({
      organization_id: organizationId,
      plan_id: planId,
      pricing_model: 'subscription',
      price_php_snapshot: totalPricePhp,
      pricing_snapshot: pricingParamsFromPlan(plan),
      status: 'active',
    })
    .select('id')
    .single();
  if (insertError) throw new Error(insertError.message);
  const orgSubscriptionId = inserted.id as string;

  // supabase-js REST calls aren't wrapped in a real DB transaction, so a failure partway through
  // property assignment must not leave a live `active` org_subscriptions row covering fewer
  // properties than were paid for. Clean up on any failure here so the caller sees one clear
  // error instead of an orphaned, half-slotted subscription.
  try {
    await writeOrgSubscriptionEvent({
      orgSubscriptionId,
      eventType: 'assigned',
      newPlanId: planId,
      newStatus: 'active',
      createdBy: assignedBy,
    });

    for (const chunk of chunkIds(uniquePropertyIds)) {
      const { error: assignError } = await sb.from('org_subscription_properties').insert(
        chunk.map((propertyId) => ({
          org_subscription_id: orgSubscriptionId,
          property_id: propertyId,
          assigned_by: assignedBy,
        }))
      );
      if (assignError) throw new Error(assignError.message);

      const { error: eventsError } = await sb.from('org_subscription_events').insert(
        chunk.map((propertyId) => ({
          org_subscription_id: orgSubscriptionId,
          event_type: 'property_added',
          property_id: propertyId,
          created_by: assignedBy,
        }))
      );
      if (eventsError) throw new Error(eventsError.message);
    }

    const features = parsePlanFeatures(plan.features);
    await syncAiCreditsFromPlan(
      organizationId,
      plan.code,
      features.aiMonthlyCreditAllowance,
      assignedBy
    );
    // Every property just slotted shares one pool — one reconciliation call covers all of them.
    await reconcileTeamSeatsForProperty(uniquePropertyIds[0]);
  } catch (err) {
    // org_subscription_properties/org_subscription_events cascade-delete via FK (ON DELETE CASCADE).
    await sb.from('org_subscriptions').delete().eq('id', orgSubscriptionId);
    throw err;
  }

  return { orgSubscriptionId };
}

/**
 * What covering one more property costs on a live subscription: the new monthly total and the
 * prorated share of the increase for the rest of the current period (added to the next payment).
 * Only a period the host actually paid for creates a true-up (not trials, admin grants or
 * price-overridden sales-assisted plans). Pure, so the preview and the real enrol cannot drift.
 */
export function computeAddPropertyQuote(input: {
  priceOverridePhp: unknown;
  pricingSnapshot: unknown;
  plan: OrgEligiblePlanRow;
  enrolledCount: number;
  periodPaidPhp: unknown;
  periodStart: string | null;
  periodEnd: string | null;
  now?: Date;
}): { totalBeforePhp: number; totalAfterPhp: number; trueUpPhp: number } {
  const totalBeforePhp = resolveSubscriptionTotalPhp(
    input.priceOverridePhp,
    input.plan,
    input.enrolledCount,
    input.pricingSnapshot
  );
  const totalAfterPhp = resolveSubscriptionTotalPhp(
    input.priceOverridePhp,
    input.plan,
    input.enrolledCount + 1,
    input.pricingSnapshot
  );

  let trueUpPhp = 0;
  const paid = Number(input.periodPaidPhp ?? 0) > 0;
  if (paid && input.priceOverridePhp == null && input.periodStart && input.periodEnd) {
    const remaining = periodRemaining(
      new Date(input.periodStart),
      new Date(input.periodEnd),
      input.now ?? new Date()
    );
    trueUpPhp = computePropertyTrueUpPhp({
      totalBeforePhp,
      totalAfterPhp,
      fractionRemaining: remaining.fraction,
    });
  }
  return { totalBeforePhp, totalAfterPhp, trueUpPhp };
}

export type AddPropertyPreview = {
  /** covered: joins the paid plan now. free: no paid plan. overdue: stays on Free until paid. */
  status: 'covered' | 'free' | 'overdue';
  planName: string | null;
  propertyCount: number;
  addsMonthlyPhp: number;
  trueUpPhp: number;
  nextRenewalPhp: number;
  renewsAt: string | null;
};

/** Read-only: what adding a property would do to the bill. Mirrors autoEnrollPropertyInOrgSubscription. */
export async function previewAddPropertyBilling(
  organizationId: string
): Promise<AddPropertyPreview> {
  const empty: AddPropertyPreview = {
    status: 'free',
    planName: null,
    propertyCount: 0,
    addsMonthlyPhp: 0,
    trueUpPhp: 0,
    nextRenewalPhp: 0,
    renewsAt: null,
  };
  const { data: liveSub, error } = await db()
    .from('org_subscriptions')
    .select(
      'id, plan_id, status, price_override_php, pricing_snapshot, current_period_start, current_period_end, period_paid_php'
    )
    .eq('organization_id', organizationId)
    .in('status', LIVE_STATUSES)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!liveSub) return empty;

  const plan = await loadOrgEligiblePlan(liveSub.plan_id as string, { allowInactive: true });
  if (plan.is_default) return empty;
  const enrolledCount = await countEnrolled(liveSub.id as string);
  const quote = computeAddPropertyQuote({
    priceOverridePhp: liveSub.price_override_php,
    pricingSnapshot: liveSub.pricing_snapshot,
    plan,
    enrolledCount,
    periodPaidPhp: liveSub.period_paid_php,
    periodStart: (liveSub.current_period_start as string | null) ?? null,
    periodEnd: (liveSub.current_period_end as string | null) ?? null,
  });
  const overdue = liveSub.status === 'past_due' || liveSub.status === 'suspended';
  return {
    status: overdue ? 'overdue' : 'covered',
    planName: String(plan.name),
    propertyCount: enrolledCount,
    addsMonthlyPhp: Math.max(0, quote.totalAfterPhp - quote.totalBeforePhp),
    // Nothing is added while the plan is overdue: the property stays on Free until paid.
    trueUpPhp: overdue ? 0 : quote.trueUpPhp,
    nextRenewalPhp: quote.totalAfterPhp,
    renewsAt: (liveSub.current_period_end as string | null) ?? null,
  };
}

export type CoverPropertyResult =
  | { covered: true; trueUpPhp: number; nextRenewalPhp: number; alreadyCovered: boolean }
  | { covered: false; reason: 'no_subscription' | 'payment_overdue' | 'archived' };

/**
 * Covers a newly created or restored property on the org's live subscription and records the
 * prorated share of the added monthly cost for the rest of the period as a true-up that is added
 * to the next payment (account ledger). While a payment is overdue the property stays on Free
 * until the host pays, so an overdue plan never gets bigger for free.
 */
export async function autoEnrollPropertyInOrgSubscription(
  organizationId: string,
  propertyId: string,
  assignedBy: string | null
): Promise<CoverPropertyResult> {
  const sb = db();
  const { data: liveSub, error: liveSubError } = await sb
    .from('org_subscriptions')
    .select(
      'id, plan_id, status, source, price_override_php, price_php_snapshot, pricing_snapshot, current_period_start, current_period_end, period_paid_php'
    )
    .eq('organization_id', organizationId)
    .in('status', LIVE_STATUSES)
    .maybeSingle();
  if (liveSubError) throw new Error(liveSubError.message);
  if (!liveSub) return { covered: false, reason: 'no_subscription' };
  if (liveSub.status === 'past_due' || liveSub.status === 'suspended') {
    return { covered: false, reason: 'payment_overdue' };
  }

  const { data: property, error: propertyError } = await sb
    .from('properties')
    .select('id, organization_id, inactive_reason, name')
    .eq('id', propertyId)
    .maybeSingle();
  if (propertyError) throw new Error(propertyError.message);
  if (!property) throw new Error('Property not found');
  if (property.inactive_reason === 'archived') return { covered: false, reason: 'archived' };

  const { data: existingSlot, error: slotError } = await sb
    .from('org_subscription_properties')
    .select('property_id')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (slotError) throw new Error(slotError.message);

  const plan = await loadOrgEligiblePlan(liveSub.plan_id as string, { allowInactive: true });

  if (existingSlot) {
    const count = await countEnrolled(liveSub.id as string);
    return {
      covered: true,
      trueUpPhp: 0,
      nextRenewalPhp: resolveSubscriptionTotalPhp(
        liveSub.price_override_php,
        plan,
        count,
        liveSub.pricing_snapshot
      ),
      alreadyCovered: true,
    };
  }

  const countBefore = await countEnrolled(liveSub.id as string);
  await assignPropertyToOrgSubscription(liveSub.id as string, propertyId, assignedBy);

  const { totalAfterPhp: totalAfter, trueUpPhp } = computeAddPropertyQuote({
    priceOverridePhp: liveSub.price_override_php,
    pricingSnapshot: liveSub.pricing_snapshot,
    plan,
    enrolledCount: countBefore,
    periodPaidPhp: liveSub.period_paid_php,
    periodStart: (liveSub.current_period_start as string | null) ?? null,
    periodEnd: (liveSub.current_period_end as string | null) ?? null,
  });
  if (trueUpPhp > 0) {
    await addLedgerEntry({
      organizationId,
      amountPhp: trueUpPhp,
      kind: 'true_up',
      orgSubscriptionId: liveSub.id as string,
      note: `Added ${String(property.name ?? 'a property')} mid-period`,
      createdBy: assignedBy,
    });
  }

  return { covered: true, trueUpPhp, nextRenewalPhp: totalAfter, alreadyCovered: false };
}

async function countEnrolled(orgSubscriptionId: string): Promise<number> {
  const sb = db();
  const { count, error } = await sb
    .from('org_subscription_properties')
    .select('id', { count: 'exact', head: true })
    .eq('org_subscription_id', orgSubscriptionId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Adds one more property to an existing live org subscription and recomputes the total price
 * for the new property count. No cap — see createOrgSubscription. */
export async function assignPropertyToOrgSubscription(
  orgSubscriptionId: string,
  propertyId: string,
  assignedBy: string | null
): Promise<void> {
  const sb = db();

  const { data: orgSub, error: orgSubError } = await sb
    .from('org_subscriptions')
    .select('id, organization_id, plan_id, price_override_php')
    .eq('id', orgSubscriptionId)
    .in('status', ['active', 'trialing', 'past_due'])
    .maybeSingle();
  if (orgSubError) throw new Error(orgSubError.message);
  if (!orgSub) throw new Error('Org subscription not found or not active');

  const { data: property, error: propertyError } = await sb
    .from('properties')
    .select('id, organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (propertyError) throw new Error(propertyError.message);
  if (!property) throw new Error('Property not found');
  if ((property.organization_id as string) !== (orgSub.organization_id as string)) {
    throw new Error('Property must belong to the same organization');
  }

  const { data: existingSlot, error: slotError } = await sb
    .from('org_subscription_properties')
    .select('property_id')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (slotError) throw new Error(slotError.message);
  if (existingSlot) throw new Error('Property is already covered by an org subscription');

  const { error: insertError } = await sb.from('org_subscription_properties').insert({
    org_subscription_id: orgSubscriptionId,
    property_id: propertyId,
    assigned_by: assignedBy,
  });
  if (insertError) throw new Error(insertError.message);

  await syncOrgSubscriptionPrice(orgSubscriptionId);

  await writeOrgSubscriptionEvent({
    orgSubscriptionId,
    eventType: 'property_added',
    propertyId,
    createdBy: assignedBy,
  });
  await reconcileTeamSeatsForProperty(propertyId);
}

/** Recomputes price_php_snapshot from the plan, enrolled count and any admin override. */
export async function syncOrgSubscriptionPrice(orgSubscriptionId: string): Promise<number> {
  const sb = db();
  const { data: orgSub, error } = await sb
    .from('org_subscriptions')
    .select('plan_id, price_override_php, pricing_snapshot')
    .eq('id', orgSubscriptionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!orgSub) throw new Error('Org subscription not found');
  const plan = await loadOrgEligiblePlan(orgSub.plan_id as string, { allowInactive: true });
  const count = await countEnrolled(orgSubscriptionId);
  const total = resolveSubscriptionTotalPhp(
    orgSub.price_override_php,
    plan,
    count,
    orgSub.pricing_snapshot
  );
  const { error: updateError } = await sb
    .from('org_subscriptions')
    .update({ price_php_snapshot: total })
    .eq('id', orgSubscriptionId);
  if (updateError) throw new Error(updateError.message);
  return total;
}

/** Removes a property from its org subscription and recomputes the total price for the
 * remaining property count — falls back to Free for the removed property via the usual
 * resolvePropertyEntitlements fallback. Works on any subscription, including one on a retired
 * plan or a suspended one, so archive and delete never fail on billing state. */
export async function removePropertyFromOrgSubscription(
  propertyId: string,
  removedBy: string | null
): Promise<void> {
  const sb = db();

  const { data: slot, error: slotError } = await sb
    .from('org_subscription_properties')
    .select('id, org_subscription_id')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (slotError) throw new Error(slotError.message);
  if (!slot) return;

  const orgSubscriptionId = slot.org_subscription_id as string;

  const { error: deleteError } = await sb
    .from('org_subscription_properties')
    .delete()
    .eq('id', slot.id as string);
  if (deleteError) throw new Error(deleteError.message);

  const { data: remaining, error: remainingError } = await sb
    .from('org_subscription_properties')
    .select('property_id')
    .eq('org_subscription_id', orgSubscriptionId);
  if (remainingError) throw new Error(remainingError.message);

  await syncOrgSubscriptionPrice(orgSubscriptionId);

  await writeOrgSubscriptionEvent({
    orgSubscriptionId,
    eventType: 'property_removed',
    propertyId,
    createdBy: removedBy,
  });

  // Reconcile the removed property standalone (its pool is now just itself, against Free)...
  await reconcileTeamSeatsForProperty(propertyId);
  // ...and reconcile one remaining pool member, if any, since the shrunk pool may now have
  // headroom to auto-restore a previously plan-limited member on those properties.
  const stillEnrolled = (remaining ?? []).find((r) => r.property_id !== propertyId);
  if (stillEnrolled) {
    await reconcileTeamSeatsForProperty(stillEnrolled.property_id as string);
  }
}

/** Changes an already-live org subscription's plan and/or enrolled property set in one write —
 * the "switch tiers and/or re-sync the billable properties" path (as opposed to
 * createOrgSubscription's first-purchase-only path). Diffs org_subscription_properties, updates
 * plan_id/price_php_snapshot, and reconciles pooled team seats once for the changed pool. Pricing
 * (what was charged) is decided by the caller; this records the resulting state and the new
 * authoritative recurring total. A plan change clears any admin price override. */
export async function changeOrgSubscription(
  orgSubscriptionId: string,
  newPlanId: string,
  newPropertyIds: string[],
  changedBy: string | null,
  options: { refreshPricing?: boolean } = {}
): Promise<void> {
  const sb = db();

  const { data: orgSub, error: orgSubError } = await sb
    .from('org_subscriptions')
    .select('id, organization_id, plan_id, price_override_php, pricing_snapshot')
    .eq('id', orgSubscriptionId)
    .in('status', LIVE_STATUSES)
    .maybeSingle();
  if (orgSubError) throw new Error(orgSubError.message);
  if (!orgSub) throw new Error('Org subscription not found or not active');

  const organizationId = orgSub.organization_id as string;
  const uniquePropertyIds = Array.from(new Set(newPropertyIds));
  if (uniquePropertyIds.length === 0) throw new Error('Select at least one property');

  const properties = await selectInIdChunks<{ id: string; organization_id: string }>(
    uniquePropertyIds,
    (chunk) => sb.from('properties').select('id, organization_id').in('id', chunk)
  );
  if (properties.length !== uniquePropertyIds.length) {
    throw new Error('One or more properties not found');
  }
  if (properties.some((p) => p.organization_id !== organizationId)) {
    throw new Error('All properties must belong to this organization');
  }

  // A property already slotted in a *different* org subscription can't be added here.
  const conflictingSlots = await selectInIdChunks<{ property_id: string }>(
    uniquePropertyIds,
    (chunk) =>
      sb
        .from('org_subscription_properties')
        .select('property_id')
        .in('property_id', chunk)
        .neq('org_subscription_id', orgSubscriptionId)
  );
  if (conflictingSlots.length > 0) {
    throw new Error('One or more properties are already covered by a different org subscription');
  }

  const { data: currentSlots, error: currentSlotsError } = await sb
    .from('org_subscription_properties')
    .select('property_id')
    .eq('org_subscription_id', orgSubscriptionId);
  if (currentSlotsError) throw new Error(currentSlotsError.message);
  const currentPropertyIds = new Set((currentSlots ?? []).map((r) => r.property_id as string));
  const nextPropertyIds = new Set(uniquePropertyIds);

  const toAdd = uniquePropertyIds.filter((id) => !currentPropertyIds.has(id));
  const toRemove = [...currentPropertyIds].filter((id) => !nextPropertyIds.has(id));

  // The subscription may already sit on a plan that has since left the catalog (scheduled
  // downgrade target, renewal of a retired plan): that must keep working.
  const plan = await loadOrgEligiblePlan(newPlanId, { allowInactive: true });
  const planChanged = newPlanId !== (orgSub.plan_id as string);
  const priceOverridePhp = planChanged ? null : orgSub.price_override_php;
  // A new plan, or a fresh purchase of the same one, buys today's pricing. A plain re-sync of
  // properties keeps the grandfathered pricing the subscription already has.
  const nextPricing =
    planChanged || options.refreshPricing || !parsePricingSnapshot(orgSub.pricing_snapshot)
      ? pricingParamsFromPlan(plan)
      : parsePricingSnapshot(orgSub.pricing_snapshot);
  const totalPricePhp = resolveSubscriptionTotalPhp(
    priceOverridePhp,
    plan,
    uniquePropertyIds.length,
    nextPricing
  );

  const { error: updateError } = await sb
    .from('org_subscriptions')
    .update({
      plan_id: newPlanId,
      price_php_snapshot: totalPricePhp,
      price_override_php: priceOverridePhp,
      pricing_snapshot: nextPricing,
    })
    .eq('id', orgSubscriptionId);
  if (updateError) throw new Error(updateError.message);

  if (planChanged) {
    await writeOrgSubscriptionEvent({
      orgSubscriptionId,
      eventType: 'plan_changed',
      previousPlanId: orgSub.plan_id as string,
      newPlanId,
      createdBy: changedBy,
    });
  }

  for (const chunk of chunkIds(toAdd)) {
    const { error } = await sb.from('org_subscription_properties').insert(
      chunk.map((propertyId) => ({
        org_subscription_id: orgSubscriptionId,
        property_id: propertyId,
        assigned_by: changedBy,
      }))
    );
    if (error) throw new Error(error.message);
    const { error: eventsError } = await sb.from('org_subscription_events').insert(
      chunk.map((propertyId) => ({
        org_subscription_id: orgSubscriptionId,
        event_type: 'property_added',
        property_id: propertyId,
        created_by: changedBy,
      }))
    );
    if (eventsError) throw new Error(eventsError.message);
  }

  for (const chunk of chunkIds(toRemove)) {
    const { error } = await sb
      .from('org_subscription_properties')
      .delete()
      .eq('org_subscription_id', orgSubscriptionId)
      .in('property_id', chunk);
    if (error) throw new Error(error.message);
    const { error: eventsError } = await sb.from('org_subscription_events').insert(
      chunk.map((propertyId) => ({
        org_subscription_id: orgSubscriptionId,
        event_type: 'property_removed',
        property_id: propertyId,
        created_by: changedBy,
      }))
    );
    if (eventsError) throw new Error(eventsError.message);
  }

  const features = parsePlanFeatures(plan.features);
  await syncAiCreditsFromPlan(
    organizationId,
    plan.code,
    features.aiMonthlyCreditAllowance,
    changedBy
  );

  // Reconcile the new pool (any surviving/added property represents it) and each removed
  // property standalone (now off the subscription, against Free).
  await reconcileTeamSeatsForProperty(uniquePropertyIds[0]);
  for (const propertyId of toRemove) {
    await reconcileTeamSeatsForProperty(propertyId);
  }
}

/**
 * Atomic paid-to-Free move (RPC): unenrolls every property, clears pending intent, cancels the
 * subscription and records why. Then settles AI credits and team seats for the whole org.
 */
export async function cancelOrgSubscriptionToFree(input: {
  orgSubscriptionId: string;
  organizationId: string;
  previousStatus: string;
  endedReason:
    | 'host_canceled'
    | 'nonpayment'
    | 'trial_ended'
    | 'no_properties'
    | 'admin'
    | 'downgraded_to_free';
  note?: string | null;
  changedBy: string | null;
}): Promise<{ freePlanName: string }> {
  const sb = db();
  const freePlan = await getDefaultPricingPlan();
  const propertyIds = await listOrganizationPropertyIds(input.organizationId);

  const { error: rpcError } = await sb.rpc('cancel_org_subscription_to_free', {
    p_org_subscription_id: input.orgSubscriptionId,
    p_target_plan_id: freePlan.id,
    p_previous_status: input.previousStatus,
    p_changed_by: input.changedBy,
    p_ended_reason: input.endedReason,
    p_note: input.note ?? null,
  });
  if (rpcError) throw new Error(rpcError.message);

  const freeFeatures = parsePlanFeatures(freePlan.features);
  await syncAiCreditsFromPlan(
    input.organizationId,
    freePlan.code,
    freeFeatures.aiMonthlyCreditAllowance,
    input.changedBy
  );
  for (const propertyId of propertyIds) {
    await reconcileTeamSeatsForProperty(propertyId);
  }
  return { freePlanName: freePlan.name };
}

export async function countMarketingPublications(propertyId: string): Promise<number> {
  const sb = db();
  const poolPropertyIds = await entitlementPoolPropertyIds(propertyId);
  return countInIdChunks(poolPropertyIds, (chunk) =>
    sb
      .from('marketing_publications')
      .select('id', { count: 'exact', head: true })
      .in('property_id', chunk)
      .eq('status', 'published')
  );
}

/** Blocks publish when Meta publishing is not on the plan or the pool's publish cap is reached. */
export async function requireMarketingPublishAllowed(
  propertyId: string
): Promise<ResolvedPropertyEntitlements> {
  const entitlements = await requirePropertyFeature(propertyId, 'marketingPublishLimitPerGroup');
  const limit = entitlements.marketingPublishLimitPerGroup;

  if (limit === 0) {
    throw new PlanFeatureRequiredError(
      'marketingPublishLimitPerGroup',
      'Publishing to Meta platforms requires Business plan or above'
    );
  }

  if (limit !== null && limit > 0) {
    const count = await countMarketingPublications(propertyId);
    if (count >= limit) {
      throw new PlanFeatureRequiredError(
        'marketingPublishLimitPerGroup',
        `Marketing publish limit reached (${limit})`
      );
    }
  }

  return entitlements;
}
