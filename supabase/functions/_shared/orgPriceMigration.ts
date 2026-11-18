/**
 * Price migrations (D8). Subscriptions keep the pricing they bought. A super-admin schedules a
 * move to a plan's current pricing at least 30 days out; every affected owner is told the old and
 * new monthly total, and the move happens at the first renewal on or after the effective date.
 */

import { createServiceClient } from './orgAuth.ts';
import { BillingRuleError } from './billingErrors.ts';
import { formatManilaDateLabel } from './billingPeriod.ts';
import { notifyOrgBillingOnce } from './orgBillingNotify.ts';
import { writeOrgSubscriptionEvent } from './planEntitlements.ts';
import {
  computeTotalFromPricingParams,
  parsePricingSnapshot,
  pricingParamsEqual,
  pricingParamsFromPlan,
  type PlanPricingParams,
} from './planPricing.ts';

export const MIN_PRICE_NOTICE_DAYS = 30;

const db = () => createServiceClient();

export async function getDuePriceMigration(
  planId: string,
  at: Date
): Promise<{ id: string; effectiveOn: string } | null> {
  const { data, error } = await db()
    .from('plan_price_migrations')
    .select('id, effective_on')
    .eq('plan_id', planId)
    .is('canceled_at', null)
    .lte('effective_on', at.toISOString())
    .order('effective_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id as string, effectiveOn: data.effective_on as string } : null;
}

export type PriceMigrationPreviewRow = {
  organizationId: string;
  orgSubscriptionId: string;
  propertyCount: number;
  oldTotalPhp: number;
  newTotalPhp: number;
};

/** Live subscriptions on the plan whose grandfathered pricing differs from the plan's today. */
export async function previewPriceMigration(planId: string): Promise<{
  planName: string;
  current: PlanPricingParams;
  affected: PriceMigrationPreviewRow[];
}> {
  const sb = db();
  const { data: plan, error: planError } = await sb
    .from('pricing_plans')
    .select(
      'id, name, price_php, discount_percent, volume_discount_tiers, volume_ramp_floor_php, volume_ramp_at_count, is_default'
    )
    .eq('id', planId)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) throw new BillingRuleError('Plan not found', 'not_found', 404);
  if (plan.is_default) throw new BillingRuleError('The Free plan has no price to migrate');

  const current = pricingParamsFromPlan(plan);
  const { data: subs, error } = await sb
    .from('org_subscriptions')
    .select('id, organization_id, pricing_snapshot, price_override_php, source')
    .eq('plan_id', planId)
    .in('status', ['active', 'past_due', 'suspended'])
    .not('current_period_end', 'is', null)
    .is('price_override_php', null)
    .limit(2000);
  if (error) throw new Error(error.message);

  const affected: PriceMigrationPreviewRow[] = [];
  for (const sub of subs ?? []) {
    if (sub.source === 'reward') continue;
    const snapshot = parsePricingSnapshot(sub.pricing_snapshot);
    if (!snapshot || pricingParamsEqual(snapshot, current)) continue;
    const { count } = await sb
      .from('org_subscription_properties')
      .select('id', { count: 'exact', head: true })
      .eq('org_subscription_id', sub.id as string);
    const propertyCount = count ?? 0;
    affected.push({
      organizationId: sub.organization_id as string,
      orgSubscriptionId: sub.id as string,
      propertyCount,
      oldTotalPhp: computeTotalFromPricingParams(snapshot, propertyCount),
      newTotalPhp: computeTotalFromPricingParams(current, propertyCount),
    });
  }
  return { planName: String(plan.name), current, affected };
}

export async function schedulePriceMigration(input: {
  planId: string;
  effectiveOn: Date;
  adminUserId: string;
  now?: Date;
}): Promise<{ migrationId: string; notified: number; affected: number; effectiveOn: string }> {
  const now = input.now ?? new Date();
  const earliest = new Date(now.getTime() + MIN_PRICE_NOTICE_DAYS * 24 * 60 * 60 * 1000);
  if (
    !Number.isFinite(input.effectiveOn.getTime()) ||
    input.effectiveOn.getTime() < earliest.getTime()
  ) {
    throw new BillingRuleError(
      `Give subscribers at least ${MIN_PRICE_NOTICE_DAYS} days notice. Pick a date after ${formatManilaDateLabel(earliest)}.`,
      'notice_too_short'
    );
  }

  const preview = await previewPriceMigration(input.planId);
  const sb = db();
  const { data: migration, error } = await sb
    .from('plan_price_migrations')
    .insert({
      plan_id: input.planId,
      effective_on: input.effectiveOn.toISOString(),
      new_pricing: preview.current,
      notified_count: 0,
      created_by: input.adminUserId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const migrationId = migration.id as string;

  let notified = 0;
  for (const row of preview.affected) {
    try {
      const outcome = await notifyOrgBillingOnce({
        organizationId: row.organizationId,
        orgSubscriptionId: row.orgSubscriptionId,
        kind: 'price_change',
        periodKey: migrationId,
        params: {
          planName: preview.planName,
          dateLabel: formatManilaDateLabel(input.effectiveOn),
          oldPricePhp: row.oldTotalPhp,
          newPricePhp: row.newTotalPhp,
        },
      });
      if (outcome === 'sent') notified += 1;
      await writeOrgSubscriptionEvent({
        orgSubscriptionId: row.orgSubscriptionId,
        eventType: 'price_migrated',
        note: `New price from ${formatManilaDateLabel(input.effectiveOn)}: ₱${row.oldTotalPhp} to ₱${row.newTotalPhp}`,
        createdBy: input.adminUserId,
      });
    } catch (err) {
      console.error('[orgPriceMigration] notice failed', row.organizationId, err);
    }
  }
  await sb.from('plan_price_migrations').update({ notified_count: notified }).eq('id', migrationId);

  return {
    migrationId,
    notified,
    affected: preview.affected.length,
    effectiveOn: input.effectiveOn.toISOString(),
  };
}

export async function cancelPriceMigration(migrationId: string): Promise<void> {
  const { error } = await db()
    .from('plan_price_migrations')
    .update({ canceled_at: new Date().toISOString() })
    .eq('id', migrationId)
    .is('canceled_at', null);
  if (error) throw new Error(error.message);
}
