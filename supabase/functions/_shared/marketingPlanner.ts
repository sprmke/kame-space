/**
 * Marketing Planner service — the only place that writes planner rows.
 *
 * Loads inputs, runs the pure engine, persists the plan and its items, and emits
 * activity events. Handlers stay thin: auth, gate, zod, call this.
 */

import { addDaysYmd, manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { logActivity, type ActorContext } from './activityLog.ts';
import { createServiceClient } from './orgAuth.ts';
import { buildTrackedPath, campaignCode, formatShortCode } from './marketingTrackedLinks.ts';
import { MAX_ITEMS_PER_RUN, PLAYBOOK_VERSION } from './marketingPlaybook.ts';
import {
  maybeDraftPlanBriefs,
  maybeRefreshPlanBrief,
  type PlanBriefCopy,
  type RefreshInstruction,
} from './marketingPlanBriefAi.ts';
import { MARKETING_PLAN_BRIEF_PROMPT } from './ai/prompts/marketingPlanBrief.ts';
import { buildOpportunities, type PlannerOpportunity } from './marketingSignals.ts';
import { validateAvailabilityClaims } from './marketingClaims.ts';
import { loadBlockedNightKeys, loadPlannerInputs } from './marketingSignalsData.ts';
import { resolvePropertySlugById } from './propertyScope.ts';
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
  /** `ai` writes briefs on top of the rules skeleton. Any AI failure falls back to rules copy. */
  mode?: 'rules' | 'ai';
};

export type GeneratePlanResult = {
  plan: PlannerPlanRow;
  items: PlannerItemRow[];
  created: number;
  skipped: number;
  /** Items that kept rules copy because the AI pass was skipped or its copy was rejected. */
  rulesFallback: number;
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
  input: {
    propertyId: string;
    organizationId: string;
    planId: string;
    actorId: string | null;
    propertySlug: string | null;
    copy?: PlanBriefCopy;
  }
): Record<string, unknown> {
  const copy = input.copy;
  const shortCode = newShortCode();
  return {
    short_code: shortCode,
    property_id: input.propertyId,
    organization_id: input.organizationId,
    plan_id: input.planId,
    source: copy ? 'ai' : 'rules',
    opportunity_type: draft.opportunityType,
    opportunity_key: draft.opportunityKey,
    title: copy?.title ?? draft.title,
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
      hook: copy?.hook ?? draft.hook,
      message: copy?.message ?? draft.message,
      cta: copy?.cta ?? draft.cta,
      why: draft.evidence,
    },
    status: 'planned',
    tracked_url: input.propertySlug
      ? buildTrackedPath(`/properties/${input.propertySlug}`, {
          channel: draft.channelKind,
          shortCode,
        })
      : null,
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
    preferredHourByWeekday: inputs.learnedPreferredHours,
  });

  const mode: 'rules' | 'ai' = input.mode === 'ai' ? 'ai' : 'rules';

  // AI is additive: it rewrites words for the drafts the rules engine already produced.
  // Any failure returns null and the plan ships with rules copy.
  const aiResult =
    mode === 'ai' && drafts.length > 0
      ? await maybeDraftPlanBriefs({
          organizationId: input.organizationId,
          propertyId: input.propertyId,
          propertyName: inputs.propertyName,
          area: null,
          amenities: inputs.signals.amenities,
          language: inputs.settings.language,
          tone: 'warm',
          horizonEnd: inputs.horizonEnd,
          actorType: 'staff',
          items: drafts.map((draft) => ({
            key: draft.opportunityKey,
            opportunityType: draft.opportunityType,
            format: draft.format,
            channel: draft.channelKind,
            evidence: draft.evidence,
            claims: draft.claims,
          })),
        })
      : null;

  const { data: plan, error: planError } = await supabase
    .from('marketing_plans')
    .insert({
      property_id: input.propertyId,
      organization_id: input.organizationId,
      horizon_start: today,
      horizon_end: inputs.horizonEnd,
      mode: aiResult ? 'ai' : 'rules',
      trigger: input.trigger ?? 'host',
      playbook_version: PLAYBOOK_VERSION,
      signals_snapshot: {
        forwardOccupancyState: inputs.signals.forwardOccupancyState,
        medianLeadDays: inputs.signals.medianLeadDays,
        opportunityCount: opportunities.length,
        plannedCount: drafts.length,
        goalKeys: inputs.signals.goals,
        aiRejected: aiResult?.rejected ?? 0,
      },
      summary: aiResult?.summary || buildPlanSummary(opportunities, inputs.horizonEnd),
      ai_model: aiResult ? 'gemini-2.5-flash' : null,
      prompt_id: aiResult ? MARKETING_PLAN_BRIEF_PROMPT.id : null,
      prompt_version: aiResult ? MARKETING_PLAN_BRIEF_PROMPT.version : null,
      credits_consumed: aiResult?.creditsConsumed ?? 0,
      created_by: input.actor.userId ?? null,
    })
    .select('*')
    .single();
  if (planError || !plan) {
    throw new Error(`Could not save the plan: ${planError?.message ?? 'unknown error'}`);
  }

  const propertySlug = await resolvePropertySlugById(input.propertyId).catch(() => null);
  const rows = drafts.map((draft) =>
    toInsertRow(draft, {
      propertyId: input.propertyId,
      organizationId: input.organizationId,
      planId: String(plan.id),
      actorId: input.actor.userId ?? null,
      propertySlug,
      copy: aiResult?.copies.get(draft.opportunityKey),
    })
  );

  let items: PlannerItemRow[] = [];
  if (rows.length > 0) {
    const { data: inserted, error: itemError } = await supabase
      .from('marketing_plan_items')
      .insert(rows)
      .select('*')
      .limit(MAX_ITEMS_PER_RUN);
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
      mode: aiResult ? 'ai' : 'rules',
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
    rulesFallback: aiResult ? drafts.length - aiResult.copies.size : drafts.length,
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

/** Statuses whose availability claim is still worth re-checking on every read. */
const REVALIDATED_STATUSES = new Set(['suggested', 'planned', 'ready', 'scheduled']);

/**
 * Cheap truth check on read: availability only (nights, dates left, sold-out window).
 * A booking that lands between visits therefore flips the item to `stale` with a plain
 * reason instead of the host finding out after they post it. Rate and rating claims are
 * re-checked on item open and before publishing, where the live rate is resolved.
 */
async function revalidateAvailability(
  propertyId: string,
  items: PlannerItemRow[]
): Promise<PlannerItemRow[]> {
  if (items.length === 0) return items;
  const candidates = items.filter((item) => REVALIDATED_STATUSES.has(item.status));
  if (candidates.length === 0) return items;

  const blocked = await loadBlockedNightKeys(propertyId);
  const supabase = createServiceClient();
  const stale = new Map<string, string>();

  for (const item of candidates) {
    const check = validateAvailabilityClaims(item.claims ?? {}, blocked);
    if (!check.ok) stale.set(item.id, check.reason);
  }
  if (stale.size === 0) return items;

  for (const [itemId, reason] of stale) {
    await supabase
      .from('marketing_plan_items')
      .update({ status: 'stale', status_reason: reason })
      .eq('id', itemId)
      .eq('property_id', propertyId);
  }

  return items.map((item) =>
    stale.has(item.id)
      ? { ...item, status: 'stale', status_reason: stale.get(item.id) ?? null }
      : item
  );
}

/**
 * Tracked visits per item: page views whose `utm_campaign` is the item's campaign code.
 * This is the half of Results that needs no Meta scopes, so it works from day one.
 */
async function withTrackedVisits(
  propertyId: string,
  items: PlannerItemRow[]
): Promise<PlannerItemRow[]> {
  if (items.length === 0) return items;
  const campaigns = items.map((item) => campaignCode(item.short_code));
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('property_page_views')
    .select('utm_campaign')
    .eq('property_id', propertyId)
    .in('utm_campaign', campaigns)
    .limit(5000);
  if (error) {
    console.error('[marketing-planner] tracked visits:', error);
    return items;
  }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const campaign = typeof row.utm_campaign === 'string' ? row.utm_campaign : '';
    counts.set(campaign, (counts.get(campaign) ?? 0) + 1);
  }
  return items.map((item) => {
    const trackedVisits = counts.get(campaignCode(item.short_code)) ?? 0;
    return { ...item, results: { ...(item.results ?? {}), trackedVisits } };
  });
}

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
    .order('scheduled_for', { ascending: true })
    .limit(200);
  if (error) throw new Error(`Could not load the plan: ${error.message}`);
  const revalidated = await revalidateAvailability(
    input.propertyId,
    (data ?? []) as PlannerItemRow[]
  );
  return withTrackedVisits(input.propertyId, revalidated);
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

/**
 * Rewrite one item's copy with AI. Returns null when AI is unavailable or its copy fails
 * the guard, and the stored brief stays untouched.
 */
export async function refreshPlanBrief(input: {
  propertyId: string;
  organizationId: string;
  actor: ActorContext;
  itemId: string;
  instruction: RefreshInstruction;
}): Promise<PlannerItemRow | null> {
  const existing = await loadItem(input.itemId, input.propertyId);
  const inputs = await loadPlannerInputs(input.propertyId);
  const result = await maybeRefreshPlanBrief({
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    propertyName: inputs.propertyName,
    amenities: inputs.signals.amenities,
    language: inputs.settings.language,
    claim: existing.claims ?? {},
    itemKey: existing.opportunity_key ?? existing.id,
    title: existing.title,
    evidence: String((existing.brief as Record<string, unknown> | null)?.why ?? ''),
    instruction: input.instruction,
    actorType: 'staff',
  });
  if (!result) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_plan_items')
    .update({
      title: result.copy.title,
      source: 'ai',
      brief: {
        ...(existing.brief ?? {}),
        hook: result.copy.hook,
        message: result.copy.message,
        cta: result.copy.cta,
      },
    })
    .eq('id', input.itemId)
    .eq('property_id', input.propertyId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Could not refresh the item: ${error?.message ?? ''}`);
  return data as PlannerItemRow;
}

/** One item, property-scoped. Used by the assistant tool and the sheet. */
export async function getPlanItem(
  propertyId: string,
  itemId: string
): Promise<PlannerItemRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_plan_items')
    .select('*')
    .eq('id', itemId)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as PlannerItemRow | null;
}

export type PlannerAssetKind = 'template' | 'ai_session' | 'media';

/**
 * Attach the asset an editor just produced and move the item to `ready`. This is the other
 * half of the handoff: the planner hands the host a seeded draft, and the saved draft comes
 * back here so the item stops asking to be made.
 */
/**
 * Statuses an attach may move to `ready`. A held, published or skipped item keeps its state:
 * attaching a draft must never quietly un-hold a post the scheduler paused.
 */
const ATTACHABLE_STATUSES = ['suggested', 'planned', 'preparing', 'stale'];

export async function attachPlanAsset(input: {
  propertyId: string;
  organizationId: string;
  actor: ActorContext;
  itemId: string;
  assetKind: PlannerAssetKind;
  assetId: string;
  assetVersionId?: string | null;
}): Promise<PlannerItemRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_plan_items')
    .update({
      asset_kind: input.assetKind,
      asset_id: input.assetId,
      asset_version_id: input.assetVersionId ?? null,
      status: 'ready',
      status_reason: null,
    })
    .eq('id', input.itemId)
    .eq('property_id', input.propertyId)
    .in('status', ATTACHABLE_STATUSES)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Could not attach the asset: ${error.message}`);
  if (!data) {
    // Either the item is gone or it is in a state that keeps its own status. Return the
    // current row so the caller can see which; never fail the editor save over it.
    const { data: existing } = await supabase
      .from('marketing_plan_items')
      .select('*')
      .eq('id', input.itemId)
      .eq('property_id', input.propertyId)
      .maybeSingle();
    if (!existing) throw new Error('Item not found');
    return existing as PlannerItemRow;
  }
  return data as PlannerItemRow;
}

export type PrepareWeekResult = {
  queued: Array<{
    itemId: string;
    title: string;
    format: string;
    opportunityType: string | null;
  }>;
  skipped: number;
};

/**
 * Start the week: move every unbuilt item in the range to `preparing` and return the work
 * list. The host still finishes each draft, because the editors are human canvases; this
 * only records where they are.
 */
export async function prepareWeek(input: {
  propertyId: string;
  organizationId: string;
  actor: ActorContext;
  from: string;
  to: string;
  limit?: number;
}): Promise<PrepareWeekResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('marketing_plan_items')
    .select('id, title, format, opportunity_type, status, asset_id')
    .eq('property_id', input.propertyId)
    .is('deleted_at', null)
    .gte('scheduled_for', `${input.from}T00:00:00+08:00`)
    .lte('scheduled_for', `${input.to}T23:59:59+08:00`)
    .in('status', ['planned', 'suggested', 'stale'])
    .order('scheduled_for', { ascending: true })
    .limit(input.limit ?? 20);
  if (error) throw new Error(`Could not load the plan: ${error.message}`);

  const queue = (data ?? []).filter((row) => !row.asset_id);
  if (queue.length === 0) return { queued: [], skipped: 0 };

  const ids = queue.map((row) => String(row.id));
  const { error: updateError } = await supabase
    .from('marketing_plan_items')
    .update({ status: 'preparing' })
    .in('id', ids)
    .eq('property_id', input.propertyId);
  if (updateError) throw new Error(`Could not start preparing: ${updateError.message}`);

  await logActivity({
    action: 'marketing.prepare_week_started',
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actor: input.actor,
    metadata: { count: ids.length, from: input.from, to: input.to },
  });

  return {
    queued: queue.map((row) => ({
      itemId: String(row.id),
      title: String(row.title ?? ''),
      format: String(row.format ?? 'post'),
      opportunityType: row.opportunity_type ? String(row.opportunity_type) : null,
    })),
    skipped: 0,
  };
}

export type NewPlanItemInput = {
  title: string;
  format: 'post' | 'carousel' | 'story' | 'reel' | 'calendar';
  channelKind:
    | 'facebook_page'
    | 'instagram'
    | 'facebook_group'
    | 'tiktok'
    | 'messenger'
    | 'viber'
    | 'whatsapp'
    | 'google_business'
    | 'other';
  scheduledFor: string;
  manualTargets?: string[];
  brief?: Record<string, unknown>;
};

/** A host-authored item: no opportunity key, so it never collides with a generated one. */
export async function addPlanItem(input: {
  propertyId: string;
  organizationId: string;
  actor: ActorContext;
  item: NewPlanItemInput;
}): Promise<PlannerItemRow> {
  const supabase = createServiceClient();
  const shortCode = newShortCode();
  const propertySlug = await resolvePropertySlugById(input.propertyId).catch(() => null);
  const { data, error } = await supabase
    .from('marketing_plan_items')
    .insert({
      short_code: shortCode,
      property_id: input.propertyId,
      organization_id: input.organizationId,
      plan_id: null,
      source: 'host',
      opportunity_type: null,
      opportunity_key: null,
      title: input.item.title.slice(0, 120),
      pillar: null,
      channel_kind: input.item.channelKind,
      manual_targets: input.item.manualTargets ?? [],
      format: input.item.format,
      scheduled_for: input.item.scheduledFor,
      post_by: input.item.scheduledFor,
      claims: {},
      brief: input.item.brief ?? {},
      status: 'planned',
      tracked_url: propertySlug
        ? buildTrackedPath(`/properties/${propertySlug}`, {
            channel: input.item.channelKind,
            shortCode,
          })
        : null,
      created_by: input.actor.userId ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Could not add the item: ${error?.message ?? ''}`);
  return data as PlannerItemRow;
}

export type PlannerSettingsPatch = {
  goals?: string[];
  cadencePreset?: 'light' | 'steady' | 'active' | 'custom';
  /** `ai` spends credits on weekly briefs; `rules` is free. Defaults to `rules`. */
  autoPlanMode?: 'rules' | 'ai';
  /** Rolling 7-day credit cap for the weekly AI plan. 0 disables it. */
  weeklyAiCreditCap?: number;
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
  if (input.patch.autoPlanMode) update.auto_plan_mode = input.patch.autoPlanMode;
  if (input.patch.weeklyAiCreditCap != null) {
    update.weekly_ai_credit_cap = Math.max(0, Math.min(1000, Math.round(input.patch.weeklyAiCreditCap)));
  }
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
