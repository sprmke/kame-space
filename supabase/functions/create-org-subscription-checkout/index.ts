/**
 * create-org-subscription-checkout — Org owner pays for the org's plan through a PayMongo
 * Hosted Checkout Session: first purchase, upgrade, renewal, retry or reactivation. Billing
 * covers every billable property in the organization. The amount comes from the shared quote;
 * a change fully covered by account credit is applied on the spot with no checkout.
 * See _shared/orgSubscriptionCheckout.ts.
 *
 * Body: { organizationId, planId?, expectedChargePhp?, idempotencyKey?, resume? }
 *  - planId omitted: pay what is due (renewal of the current or scheduled plan)
 *  - expectedChargePhp: the amount the host reviewed; a higher fresh amount returns 409
 */

import { verifyOrgOwner } from '../_shared/orgAuth.ts';
import { billingErrorResponse } from '../_shared/billingHttp.ts';
import { createOrgSubscriptionCheckoutLink } from '../_shared/orgSubscriptionCheckout.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';

serveAuthenticated('create-org-subscription-checkout', async (req, user) => {
  requireHttpMethod(req, 'POST');

  const body = await readJsonBody(req);
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length >= 8
      ? body.idempotencyKey.trim().slice(0, 80)
      : null;
  const expectedChargePhp =
    typeof body.expectedChargePhp === 'number' && Number.isFinite(body.expectedChargePhp)
      ? body.expectedChargePhp
      : null;
  const resume = body.resume === true;

  if (!organizationId) {
    return jsonError(req, 'organizationId is required');
  }

  const { org } = await verifyOrgOwner(req, organizationId);

  try {
    const result = await createOrgSubscriptionCheckoutLink({
      organizationId,
      planId: planId || null,
      initiatedBy: user.id,
      expectedChargePhp,
      idempotencyKey,
      resume,
    });
    if (!result.reused) {
      await logActivity({
        action: 'billing.checkout_started',
        organizationId,
        scope: 'org',
        actor: buildActorContext(
          'dashboard',
          { authUser: user, actorType: 'org_owner', role: 'owner' },
          req
        ),
        targetType: 'subscription',
        targetId: organizationId,
        targetLabel: org.name ?? 'the organization',
        metadata: {
          plan: result.planName || planId,
          purpose: result.purpose,
          amount: Math.round(result.chargePhp),
          paid_with_credit: result.paidWithCredit,
        },
      });
    }
    return jsonSuccess(req, result);
  } catch (err) {
    return billingErrorResponse(req, err);
  }
});
