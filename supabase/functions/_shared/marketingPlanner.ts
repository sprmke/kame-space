/**
 * Marketing Planner service — the only place that writes planner rows.
 *
 * Loads inputs, runs the pure engine, persists the plan and its items, and emits
 * activity events. Handlers stay thin: auth, gate, zod, call this.
 */

import { addDaysYmd, manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { logActivity, type ActorContext } from './activityLog.ts';
import { createServiceClient } from './orgAuth.ts';
import { formatShortCode } from './marketingTrackedLinks.ts';
import { PLAYBOOK_VERSION } from './marketingPlaybook.ts';
import { buildOpportunities, type PlannerOpportunity } from './marketingSignals.ts';
import { loadPlannerInputs } from './marketingSignalsData.ts';
import { scheduleItems, type PlannerItemDraft } from './marketingScheduler.ts';
import type { PlannerClaims } from './marketingClaims.ts';

export const PLANNER_RANGES = ['today', '3d', '5d', '7d', '14d'] as const;
export type PlannerRange = (typeof PLANNER_RANGES)[number];

const RANGE_DAYS: Record<PlannerRange, number> = {
  today: 0,
  '3d': 2,
  '5d': 4,
  '7d': 6,
  '14d': 13,
};

export function isPlannerRange(value: unknown): value is PlannerRange {
  return typeof value === 'string' && (PLANNER_RANGES as readonly string[]).includes(value);
}

/** Inclusive calendar range for a range chip, in Manila days. */
export function resolvePlannerRange(
  range: PlannerRange,
  today: string
): { from: string; to: string } {
  return { from: today, to: addDaysYmd(today, RANGE_DAYS[range]) };
}

export type PlannerItemRow = {
  id: string;
  short_code: string;
  opportunity_type: string | null;
  opportunity_key: string | null;
  title: string;
  pillar: string | null;
  channel_kind: string;
  manual_targets: string[];
  format: string;
  scheduled_for: string | null;
  post_by: string | null;
  target_from: string | null;
  target_to: string | null;
  claims: PlannerClaims;
  brief: Record<string, unknown>;
  status: string;
  status_reason: string | null;
  tracked_url: string | null;
  posted_url: string | null;
  results: Record<string, unknown> | null;
};

export type PlannerPlanRow = {
  id: string;
  horizon_start: string;
  horizon_end: string;
  mode: string;
  trigger: string;
  playbook_version: string;
  summary: string | null;
  created_at: string;
  superseded_at: string | null;
};

export type GeneratePlanInput = {
  propertyId: string;
  organizationId: string;
  actor: ActorContext;
  trigger?: 'host' | 'weekly_cron' | 'event';
};

export type GeneratePlanResult = {
  plan: PlannerPlanRow;
  items: PlannerItemRow[];
  created: number;
  skipped: number;
};

function newShortCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return formatShortCode(bytes);
}

/** One plain sentence from the top opportunities. Never a claim the item does not carry. */
export function buildPlanSummary(opportunities: PlannerOpportunity[], horizonEnd: string): string {
  if (opportunities.length === 0) {
    return 'No marketing items this week. Your calendar is covered.';
  }
  const top = opportunities[0];
  const extra = opportunities.length > 1 ? ` ${opportunities.length - 1} more items planned.` : '';
  return `${top.evidence}${extra} Planned through ${horizonEnd}.`;
}

function toInsertRow(
  draft: PlannerItemDraft,
  input: { propertyId: string; organizationId: string; planId: string; actorId: string | null }
): Record<string, unknown> {
  return {
    short_code: newShortCode(),
    property_id: input.propertyId,
    organization_id: input.organizationId,
    plan_id: input.planId,
    source: 'rules',
    opportunity_type: draft.opportunityType,
    opportunity_key: draft.opportunityKey,
    title: draft.title,
    pillar: draft.pillar,
    objective: null,
    channel_kind: draft.channelKind,
    manual_targets: draft.manualTargets,
    format: draft.format,
    scheduled_for: draft.scheduledFor,
    post_by: `${draft.postBy}T23:59:59+08:00`,
    target_from: draft.targetFrom,
    target_to: draft.targetTo,
    claims: draft.claims,
    brief: {
      hook: draft.hook,
      message: draft.message,
      cta: draft.cta,
      why: draft.evidence,
    },
    status: 'planned',
    created_by: input.actorId,
  };
}

/**
 * Generate a rules plan for a property. Items that already exist for the same
 * opportunity are never duplicated, so a re-run only adds what is new.
 */
export async function generatePlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
  const supabase = createServiceClient();
  const inputs = await loadPlannerInputs(input.propertyId);
  const today = inputs.signals.today;

  const opportunities = buildOpportunities(inputs.signals);
  const drafts = scheduleItems({
    today,
    nowMinute: manilaMinuteOfDay(),
    horizonEnd: inputs.horizonEnd,
    opportunities,
    settings: inputs.settings,
    existingOpportunityKeys: inputs.signals.usedOpportunityKeys,
    propertyName: inputs.propertyName,
  });

  const { data: plan, error: planError } = await supabase
    .from('marketing_plans')
    .insert({
      property_id: input.propertyId,
      organization_id: input.organizationId,
      horizon_start: today,
      horizon_end: inputs.horizonEnd,
      mode: 'rules',
      trigger: input.trigger ?? 'host',
      playbook_version: PLAYBOOK_VERSION,
      signals_snapshot: {
        forwardOccupancyState: inputs.signals.forwardOccupancyState,
        medianLeadDays: inputs.signals.medianLeadDays,
        opportunityCount: opportunities.length,
        plannedCount: drafts.length,
        goalKeys: inputs.signals.goals,
      },
      summary: buildPlanSummary(opportunities, inputs.horizonEnd),
      created_by: input.actor.userId ?? null,
    })
    .select('*')
    .single();
  if (planError || !plan) {
    throw new Error(`Could not save the plan: ${planError?.message ?? 'unknown error'}`);
  }

  const rows = drafts.map((draft) =>
    toInsertRow(draft, {
      propertyId: input.propertyId,
      organizationId: input.organizationId,
      planId: String(plan.id),
      actorId: input.actor.userId ?? null,
    })
  );

  let items: PlannerItemRow[] = [];
  if (rows.length > 0) {
    const { data: inserted, error: itemError } = await supabase
      .from('marketing_plan_items')
      .insert(rows)
      .select('*');
    if (itemError) {
      throw new Error(`Could not save plan items: ${itemError.message}`);
    }
    items = (inserted ?? []) as PlannerItemRow[];
  }

  // Retire the previous run for this property so the tab shows one live plan.
  await supabase
    .from('marketing_plans')
    .update({ superseded_at: new Date().toISOString() })
    .eq('property_id', input.propertyId)
    .neq('id', plan.id)
    .is('superseded_at', null);

  await logActivity({
    action: 'marketing.plan_generated',
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actor: input.actor,
    targetId: String(plan.id),
    targetLabel: inputs.propertyName,
    metadata: {
      mode: 'rules',
      trigger: input.trigger ?? 'host',
      count: items.length,
      horizonEnd: inputs.horizonEnd,
    },
  });

  return {
    plan: plan as PlannerPlanRow,
    items,
    created: items.length,
    skipped: opportunities.length - drafts.length,
  };
}

/** Manila minutes from midnight, for "never schedule a slot that already passed". */
export function manilaMinuteOfDay(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

export type ListPlanInput = {
  propertyId: string;
  from: string;
  to: string;
};

export async function listPlanItems(input: ListPlanInput): Promise<PlannerItemRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_plan_items')
    .select('*')
    .eq('property_id', input.propertyId)
    .is('deleted_at', null)
    .gte('scheduled_for', `${input.from}T00:00:00+08:00`)
    .lte('scheduled_for', `${input.to}T23:59:59+08:00`)
    .not('status', 'in', '(skipped,expired)')
    .order('scheduled_for', { ascending: true });
  if (error) throw new Error(`Could not load the plan: ${error.message}`);
  return (data ?? []) as PlannerItemRow[];
}

export async function latestPlan(propertyId: string): Promise<PlannerPlanRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_plans')
    .select('*')
    .eq('property_id', propertyId)
    .is('superseded_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the plan: ${error.message}`);
  return (data ?? null) as PlannerPlanRow | null;
}

async function loadItem(itemId: string, propertyId: string): Promise<PlannerItemRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_plan_items')
    .select('*')
    .eq('id', itemId)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Item not found');
  return data as PlannerItemRow;
}

export type ItemPatch = {
  scheduledFor?: string;
  format?: string;
  title?: string;
  brief?: Record<string, unknown>;
};

export async function updatePlanItem(input: {
  propertyId: string;
  organizationId: string;
  actor: ActorContext;
  itemId: string;
  patch: ItemPatch;
}): Promise<PlannerItemRow> {
  const supabase = createServiceClient();
  const existing = await loadItem(input.itemId, input.propertyId);
  const update: Record<string, unknown> = {};
  if (input.patch.scheduledFor) update.scheduled_for = input.patch.scheduledFor;
  if (input.patch.format) update.format = input.patch.format;
  if (input.patch.title) update.title = input.patch.title;
  if (input.patch.brief) update.brief = { ...(existing.brief ?? {}), ...input.patch.brief };
  if (Object.keys(update).length === 0) return existing;

  const { data, error } = await supabase
    .from('marketing_plan_items')
    .update(update)
    .eq('id', input.itemId)
    .eq('property_id', input.propertyId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Could not update the item: ${error?.message ?? ''}`);

  // Reschedule and brief edits are high-frequency editor state, not audit events.
  return data as PlannerItemRow;
}

export async function skipPlanItem(input: {
  propertyId: string;
  organizationId: string;
  actor: ActorContext;
  itemId: string;
  reason: string;
}): Promise<PlannerItemRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_plan_items')
    .update({ status: 'skipped', skipped_reason: input.reason.slice(0, 200) })
    .eq('id', input.itemId)
    .eq('property_id', input.propertyId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Could not skip the item: ${error?.message ?? ''}`);

  await logActivity({
    action: 'marketing.plan_item_skipped',
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actor: input.actor,
    targetId: input.itemId,
    targetLabel: String(data.title ?? ''),
    metadata: { reason: input.reason.slice(0, 200) },
  });

  return data as PlannerItemRow;
}

export async function markPlanItemPosted(input: {
  propertyId: string;
  organizationId: string;
  actor: ActorContext;
  itemId: string;
  postedUrl?: string | null;
}): Promise<PlannerItemRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_plan_items')
    .update({
      status: 'posted_manually',
      posted_at: new Date().toISOString(),
      posted_url: input.postedUrl ?? null,
    })
    .eq('id', input.itemId)
    .eq('property_id', input.propertyId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Could not mark the item posted: ${error?.message ?? ''}`);

  await logActivity({
    action: 'marketing.plan_item_posted_manually',
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actor: input.actor,
    targetId: input.itemId,
    targetLabel: String(data.title ?? ''),
    metadata: { channel: String(data.channel_kind ?? '') },
  });

  return data as PlannerItemRow;
}

export type PlannerSettingsPatch = {
  goals?: string[];
  cadencePreset?: 'light' | 'steady' | 'active' | 'custom';
  channels?: unknown[];
  language?: 'en' | 'fil' | 'taglish';
  tone?: 'warm' | 'playful' | 'premium';
  approvalMode?: 'ask' | 'auto_publish_connected';
  autoPlan?: boolean;
  planWeekday?: number;
  planTime?: string;
};

export async function getPlannerSettings(propertyId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_planner_settings')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) throw new Error(`Could not load planner settings: ${error.message}`);
  return data ?? null;
}

export async function savePlannerSettings(input: {
  propertyId: string;
  organizationId: string;
  actor: ActorContext;
  patch: PlannerSettingsPatch;
}): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const update: Record<string, unknown> = { updated_by: input.actor.userId ?? null };
  if (input.patch.goals) update.goals = input.patch.goals;
  if (input.patch.cadencePreset) update.cadence_preset = input.patch.cadencePreset;
  if (input.patch.channels) update.channels = input.patch.channels;
  if (input.patch.language) update.language = input.patch.language;
  if (input.patch.tone) update.tone = input.patch.tone;
  if (input.patch.approvalMode) update.approval_mode = input.patch.approvalMode;
  if (input.patch.autoPlan != null) update.auto_plan = input.patch.autoPlan;
  if (input.patch.planWeekday != null) update.plan_weekday = input.patch.planWeekday;
  if (input.patch.planTime) update.plan_time = input.patch.planTime;

  const { data, error } = await supabase
    .from('marketing_planner_settings')
    .upsert(
      {
        property_id: input.propertyId,
        organization_id: input.organizationId,
        ...update,
        onboarded_at: new Date().toISOString(),
      },
      { onConflict: 'property_id' }
    )
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`Could not save planner settings: ${error?.message ?? ''}`);
  }

  await logActivity({
    action: 'marketing.planner_settings_saved',
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actor: input.actor,
    targetLabel: input.propertyId,
    metadata: { fields: Object.keys(input.patch) },
  });

  return data as Record<string, unknown>;
}

export { manilaTodayYmd };
