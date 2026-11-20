/**
 * delete-organization — DELETE an organization (owner only). Blocked when bookings exist or a
 * paid plan is still live (Plans & Billing lifecycle E22).
 */

import { createServiceClient, verifyOrgOwner } from '../_shared/orgAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { toSubscriptionState } from '../_shared/orgBillingContext.ts';
import { expireAllPendingOrgCheckouts } from '../_shared/orgPaymentReconcile.ts';
import { validateOrgDeletion } from '../_shared/orgSubscriptionStateMachine.ts';
import { getActiveOrgSubscription } from '../_shared/planEntitlements.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { propertyStoragePurgeTargets, purgeStorageTargets } from '../_shared/tenantStoragePurge.ts';

serveAuthenticated('delete-organization', async (req) => {
  requireHttpMethod(req, 'DELETE');
  const body = await readJsonBody(req);

  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  if (!orgId) {
    return jsonError(req, 'orgId is required');
  }

  const { user, org } = await verifyOrgOwner(req, orgId);
  const supabase = createServiceClient();

  const subscription = await getActiveOrgSubscription(org.id);
  const deletion = validateOrgDeletion(subscription ? toSubscriptionState(subscription) : null);
  if (!deletion.ok) return jsonError(req, deletion.message, 409);

  const { data: properties, error: propertiesError } = await supabase
    .from('properties')
    .select('id, settings')
    .eq('organization_id', org.id);

  if (propertiesError) {
    console.error('[delete-organization] properties:', propertiesError.message);
    return jsonError(req, 'Could not verify organization properties', 500);
  }

  const propertyIds = (properties ?? []).map((row) => row.id as string);

  if (propertyIds.length > 0) {
    const { count: bookingCount, error: countError } = await supabase
      .from('guest_submissions')
      .select('id', { count: 'exact', head: true })
      .in('property_id', propertyIds);

    if (countError) {
      console.error('[delete-organization] booking count:', countError.message);
      return jsonError(req, 'Could not verify booking history', 500);
    }

    if ((bookingCount ?? 0) > 0) {
      return jsonError(
        req,
        'This organization has booking history and cannot be deleted. Remove or archive properties with bookings first.',
        409
      );
    }
  }

  // Remove every object each property owns before the cascade drops the rows: media,
  // marketing, listing authorization, app-settings assets and the guest-PII buckets.
  for (const property of properties ?? []) {
    await purgeStorageTargets(
      supabase,
      propertyStoragePurgeTargets({ propertyId: property.id as string, orgId: org.id }),
      'delete-organization'
    );
  }

  // Close any open checkout first: the rows go with the org, but the PayMongo link would stay payable.
  try {
    await expireAllPendingOrgCheckouts(org.id);
  } catch (err) {
    console.warn('[delete-organization] checkout expiry:', err);
  }

  const { error: deleteError } = await supabase.from('organizations').delete().eq('id', org.id);

  if (deleteError) {
    if (deleteError.code === '23503') {
      return jsonError(
        req,
        'Organization is still referenced by other records and cannot be deleted.',
        409
      );
    }
    console.error('[delete-organization]', deleteError.message);
    return jsonError(req, 'Failed to delete organization', 500);
  }

  await logActivity({
    action: 'org.deleted',
    organizationId: org.id,
    scope: 'org',
    actor: buildActorContext(
      'dashboard',
      { authUser: user, actorType: 'org_owner', role: 'owner' },
      req
    ),
    targetType: 'organization',
    targetId: org.id,
    targetLabel: org.name,
    metadata: { property_count: propertyIds.length },
  });

  return jsonSuccess(req, { deletedOrganizationId: org.id });
});
