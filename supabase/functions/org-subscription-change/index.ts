/**
 * org-subscription-change — Org owner schedules a downgrade or a cancel for the end of the
 * billing period, undoes it, or leaves an overdue plan. Nothing here takes payment and nothing
 * turns features off now: paid time is honored until the period ends.
 * See _shared/orgBillingLifecycle.ts.
 */

import { verifyOrgOwner } from '../_shared/orgAuth.ts';
import { billingErrorResponse } from '../_shared/billingHttp.ts';
import {
  CANCEL_REASONS,
  cancelOrgSubscriptionNow,
  clearOrgScheduledChange,
  scheduleOrgCancel,
  scheduleOrgDowngrade,
  type CancelReason,
} from '../_shared/orgBillingLifecycle.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const ACTIONS = [
  'schedule_downgrade',
  'cancel_at_period_end',
  'clear_intent',
  'cancel_now',
] as const;
type Action = (typeof ACTIONS)[number];

serveAuthenticated('org-subscription-change', async (req, user) => {
  requireHttpMethod(req, 'POST');

  const body = await readJsonBody(req);
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  const action = typeof body.action === 'string' ? (body.action.trim() as Action) : ('' as Action);
  const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
  const reason =
    typeof body.reason === 'string' && (CANCEL_REASONS as readonly string[]).includes(body.reason)
      ? (body.reason as CancelReason)
      : null;

  if (!organizationId) return jsonError(req, 'organizationId is required');
  if (!ACTIONS.includes(action)) return jsonError(req, 'Unknown action');
  if (action === 'schedule_downgrade' && !planId) return jsonError(req, 'planId is required');

  const { org } = await verifyOrgOwner(req, organizationId);
  const actor = buildActorContext(
    'dashboard',
    { authUser: user, actorType: 'org_owner', role: 'owner' },
    req
  );
  const orgName = org.name ?? 'the organization';
  const log = (
    activityAction: Parameters<typeof logActivity>[0]['action'],
    metadata: Record<string, unknown>
  ) =>
    logActivity({
      action: activityAction,
      organizationId,
      scope: 'org',
      actor,
      targetType: 'subscription',
      targetId: organizationId,
      targetLabel: orgName,
      metadata,
    });

  try {
    if (action === 'schedule_downgrade') {
      const result = await scheduleOrgDowngrade({
        organizationId,
        targetPlanId: planId,
        scheduledBy: user.id,
      });
      if (!result.alreadyScheduled) {
        await log('billing.change_scheduled', {
          to_plan_name: result.toPlanName,
          from_plan_name: result.fromPlanName,
          effective_at: result.effectiveAt,
          related_event_ref: { table: 'org_subscription_events' },
        });
        await capturePostHogEvent('org_plan_change_scheduled', {
          logPrefix: 'org-subscription-change',
          distinctId: user.id,
          groups: { organization: organizationId },
          properties: { to_plan: planId },
        });
      }
      return jsonSuccess(req, { scheduled: 'downgrade', ...result });
    }

    if (action === 'cancel_at_period_end') {
      const result = await scheduleOrgCancel({
        organizationId,
        reason,
        scheduledBy: user.id,
      });
      if (!result.alreadyScheduled) {
        await log('billing.cancel_scheduled', {
          plan_name: result.planName,
          effective_at: result.effectiveAt,
          reason,
          related_event_ref: { table: 'org_subscription_events' },
        });
        await capturePostHogEvent('org_plan_cancel_scheduled', {
          logPrefix: 'org-subscription-change',
          distinctId: user.id,
          groups: { organization: organizationId },
          properties: { reason: reason ?? 'none' },
        });
      }
      return jsonSuccess(req, { scheduled: 'cancel', ...result });
    }

    if (action === 'clear_intent') {
      const result = await clearOrgScheduledChange({ organizationId, clearedBy: user.id });
      await log('billing.scheduled_change_cleared', {
        plan_name: result.planName,
        had_cancel: result.hadCancel,
        had_downgrade: result.hadDowngrade,
        related_event_ref: { table: 'org_subscription_events' },
      });
      await capturePostHogEvent('org_plan_intent_cleared', {
        logPrefix: 'org-subscription-change',
        distinctId: user.id,
        groups: { organization: organizationId },
        properties: { had_cancel: result.hadCancel },
      });
      return jsonSuccess(req, { cleared: true, ...result });
    }

    const result = await cancelOrgSubscriptionNow({
      organizationId,
      cancelledBy: user.id,
      reason,
    });
    await log('billing.subscription_canceled', {
      plan_name: result.planName,
      ended_reason: 'host_canceled',
      related_event_ref: { table: 'org_subscription_events' },
    });
    return jsonSuccess(req, { canceled: true, ...result });
  } catch (err) {
    return billingErrorResponse(req, err);
  }
});
