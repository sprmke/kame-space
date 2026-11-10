/**
 * marketing-planner — the Marketing Planner read/write endpoint.
 *
 * GET  ?property_id=&range=today|3d|5d|7d|14d  → plan + items for the range
 * GET  ?property_id=&view=settings             → planner settings
 * POST { action }                              → generate | update_item | skip | mark_posted
 * PATCH                                        → planner settings
 *
 * Read is `marketing:view`. Every write is `marketing.plan:edit`. `marketingPlanner` is
 * the plan gate for generating a full plan; the read stays open so a lower tier can see
 * the showcase and hit the upgrade path on the action.
 */

import { z } from 'zod';

import { buildActorContext } from '../_shared/activityLog.ts';
import {
  assertFeatureAvailable,
  catchFeatureUnavailableError,
} from '../_shared/featureAvailability.ts';
import { jsonError, jsonSuccess, jsonUpgradeHook, readJsonBody } from '../_shared/httpResponse.ts';
import {
  addPlanItem,
  attachPlanAsset,
  generatePlan,
  getPlannerSettings,
  isPlannerRange,
  latestPlan,
  listPlanItems,
  markPlanItemPosted,
  refreshPlanBrief,
  prepareWeek,
  resolvePlannerRange,
  savePlannerSettings,
  skipPlanItem,
  updatePlanItem,
} from '../_shared/marketingPlanner.ts';
import { addDaysYmd, manilaTodayYmd } from '../_shared/calendarAvailabilityManila.ts';
import { PlanFeatureRequiredError } from '../_shared/planEntitlements.ts';
import { requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const generateSchema = z.object({
  action: z.literal('generate'),
  mode: z.enum(['rules', 'ai']).default('rules'),
});

const updateSchema = z.object({
  action: z.literal('update_item'),
  itemId: z.string().uuid(),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  format: z.enum(['post', 'carousel', 'story', 'reel', 'calendar']).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  brief: z.record(z.unknown()).optional(),
});

const skipSchema = z.object({
  action: z.literal('skip'),
  itemId: z.string().uuid(),
  reason: z.string().trim().min(1).max(200),
});

const refreshSchema = z.object({
  action: z.literal('refresh_brief'),
  itemId: z.string().uuid(),
  instruction: z.enum(['shorter', 'playful', 'taglish']).default('shorter'),
});

const postedSchema = z.object({
  action: z.literal('mark_posted'),
  itemId: z.string().uuid(),
  postedUrl: z.string().url().max(500).optional(),
});

const addItemSchema = z.object({
  action: z.literal('add_item'),
  title: z.string().trim().min(1).max(120),
  format: z.enum(['post', 'carousel', 'story', 'reel', 'calendar']),
  channelKind: z.enum([
    'facebook_page',
    'instagram',
    'facebook_group',
    'tiktok',
    'messenger',
    'viber',
    'whatsapp',
    'google_business',
    'other',
  ]),
  scheduledFor: z.string().datetime({ offset: true }),
  manualTargets: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  brief: z.record(z.unknown()).optional(),
});

const attachSchema = z.object({
  action: z.literal('attach_asset'),
  itemId: z.string().uuid(),
  assetKind: z.enum(['template', 'ai_session', 'media']),
  assetId: z.string().uuid(),
  assetVersionId: z.string().uuid().optional(),
});

const prepareSchema = z.object({
  action: z.literal('prepare_batch'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.number().int().min(1).max(20).optional(),
});

const settingsSchema = z.object({
  goals: z
    .array(
      z.enum(['fill_open_nights', 'weekends', 'direct_bookings', 'longer_stays', 'brand'])
    )
    .max(2)
    .optional(),
  cadencePreset: z.enum(['light', 'steady', 'active', 'custom']).optional(),
  channels: z.array(z.record(z.unknown())).max(20).optional(),
  language: z.enum(['en', 'fil', 'taglish']).optional(),
  tone: z.enum(['warm', 'playful', 'premium']).optional(),
  approvalMode: z.enum(['ask', 'auto_publish_connected']).optional(),
  autoPlan: z.boolean().optional(),
  planWeekday: z.number().int().min(0).max(6).optional(),
  planTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

serveAuthenticated('marketing-planner', async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const scoped = await resolveScopedPropertyAccess(req, 'marketing:view');
    const propertyId = scoped.property.id;

    if (url.searchParams.get('view') === 'settings') {
      return jsonSuccess(req, { settings: await getPlannerSettings(propertyId) });
    }

    const rangeParam = url.searchParams.get('range');
    const range = isPlannerRange(rangeParam) ? rangeParam : 'today';
    const today = manilaTodayYmd();
    const { from, to } = resolvePlannerRange(range, today);
    const [items, plan] = await Promise.all([
      listPlanItems({ propertyId, from, to }),
      latestPlan(propertyId),
    ]);

    // Coming up: the next few items past the chip's window, so a staged campaign is visible
    // without widening the agenda.
    const upcomingFrom = addDaysYmd(to, 1);
    const upcoming = plan?.horizon_end && plan.horizon_end >= upcomingFrom
      ? (await listPlanItems({ propertyId, from: upcomingFrom, to: plan.horizon_end })).slice(0, 3)
      : [];

    return jsonSuccess(req, {
      range,
      from,
      to,
      plan,
      items,
      upcoming,
      summary: plan?.summary ?? null,
    });
  }

  if (req.method === 'POST') {
    const scoped = await resolveScopedPropertyAccess(req, 'marketing.plan:edit');
    const propertyId = scoped.property.id;
    const body = await readJsonBody(req);
    const action = body.action;

    try {
      if (action === 'generate') {
        const parsed = generateSchema.safeParse(body);
        if (!parsed.success) return jsonError(req, 'Invalid generate body', 400);
        await assertFeatureAvailable(
          parsed.data.mode === 'ai' ? 'marketing.planner.ai' : 'marketing.planner',
          { user: scoped.user }
        );
        await requirePropertyPermissionAndFeature(
          req,
          propertyId,
          'marketing.plan:edit',
          parsed.data.mode === 'ai' ? 'aiMarketingPlanner' : 'marketingPlanner'
        );
        const actor = buildActorContext('dashboard', { propertyAccess: scoped }, req);
        const result = await generatePlan({
          propertyId,
          organizationId: scoped.org.id,
          actor,
          mode: parsed.data.mode,
        });
        return jsonSuccess(req, result);
      }

      if (action === 'add_item') {
        const parsed = addItemSchema.safeParse(body);
        if (!parsed.success) return jsonError(req, 'Invalid add_item body', 400);
        const actor = buildActorContext('dashboard', { propertyAccess: scoped }, req);
        const item = await addPlanItem({
          propertyId,
          organizationId: scoped.org.id,
          actor,
          item: {
            title: parsed.data.title,
            format: parsed.data.format,
            channelKind: parsed.data.channelKind,
            scheduledFor: parsed.data.scheduledFor,
            manualTargets: parsed.data.manualTargets,
            brief: parsed.data.brief,
          },
        });
        return jsonSuccess(req, { item });
      }

      if (action === 'update_item') {
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) return jsonError(req, 'Invalid update body', 400);
        const actor = buildActorContext('dashboard', { propertyAccess: scoped }, req);
        const item = await updatePlanItem({
          propertyId,
          organizationId: scoped.org.id,
          actor,
          itemId: parsed.data.itemId,
          patch: {
            scheduledFor: parsed.data.scheduledFor,
            format: parsed.data.format,
            title: parsed.data.title,
            brief: parsed.data.brief,
          },
        });
        return jsonSuccess(req, { item });
      }

      if (action === 'skip') {
        const parsed = skipSchema.safeParse(body);
        if (!parsed.success) return jsonError(req, 'Invalid skip body', 400);
        const actor = buildActorContext('dashboard', { propertyAccess: scoped }, req);
        const item = await skipPlanItem({
          propertyId,
          organizationId: scoped.org.id,
          actor,
          itemId: parsed.data.itemId,
          reason: parsed.data.reason,
        });
        return jsonSuccess(req, { item });
      }

      if (action === 'attach_asset') {
        const parsed = attachSchema.safeParse(body);
        if (!parsed.success) return jsonError(req, 'Invalid attach_asset body', 400);
        const actor = buildActorContext('dashboard', { propertyAccess: scoped }, req);
        const item = await attachPlanAsset({
          propertyId,
          organizationId: scoped.org.id,
          actor,
          itemId: parsed.data.itemId,
          assetKind: parsed.data.assetKind,
          assetId: parsed.data.assetId,
          assetVersionId: parsed.data.assetVersionId ?? null,
        });
        return jsonSuccess(req, { item });
      }

      if (action === 'prepare_batch') {
        const parsed = prepareSchema.safeParse(body);
        if (!parsed.success) return jsonError(req, 'Invalid prepare_batch body', 400);
        const actor = buildActorContext('dashboard', { propertyAccess: scoped }, req);
        const result = await prepareWeek({
          propertyId,
          organizationId: scoped.org.id,
          actor,
          from: parsed.data.from,
          to: parsed.data.to,
          limit: parsed.data.limit,
        });
        return jsonSuccess(req, result);
      }

      if (action === 'refresh_brief') {
        const parsed = refreshSchema.safeParse(body);
        if (!parsed.success) return jsonError(req, 'Invalid refresh_brief body', 400);
        await requirePropertyPermissionAndFeature(
          req,
          propertyId,
          'marketing.plan:edit',
          'aiMarketingPlanner'
        );
        const actor = buildActorContext('dashboard', { propertyAccess: scoped }, req);
        const item = await refreshPlanBrief({
          propertyId,
          organizationId: scoped.org.id,
          actor,
          itemId: parsed.data.itemId,
          instruction: parsed.data.instruction,
        });
        if (!item) return jsonError(req, 'Could not rewrite that item', 502);
        return jsonSuccess(req, { item });
      }

      if (action === 'mark_posted') {
        const parsed = postedSchema.safeParse(body);
        if (!parsed.success) return jsonError(req, 'Invalid mark_posted body', 400);
        const actor = buildActorContext('dashboard', { propertyAccess: scoped }, req);
        const item = await markPlanItemPosted({
          propertyId,
          organizationId: scoped.org.id,
          actor,
          itemId: parsed.data.itemId,
          postedUrl: parsed.data.postedUrl ?? null,
        });
        return jsonSuccess(req, { item });
      }

      return jsonError(req, 'Unknown action', 400);
    } catch (err) {
      if (err instanceof Response) return err;
      const unavailable = catchFeatureUnavailableError(req, err);
      if (unavailable) return unavailable;
      if (err instanceof PlanFeatureRequiredError) {
        return jsonUpgradeHook(req, err.message, { feature: err.feature });
      }
      throw err;
    }
  }

  if (req.method === 'PATCH') {
    const scoped = await resolveScopedPropertyAccess(req, 'marketing.plan:edit');
    const body = await readJsonBody(req);
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) return jsonError(req, 'Invalid settings body', 400);
    const actor = buildActorContext('dashboard', { propertyAccess: scoped }, req);
    const settings = await savePlannerSettings({
      propertyId: scoped.property.id,
      organizationId: scoped.org.id,
      actor,
      patch: parsed.data,
    });
    return jsonSuccess(req, { settings });
  }

  return jsonError(req, 'Method not allowed', 405);
});
