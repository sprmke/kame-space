/**
 * org-billing-details — GET/PUT the billing details printed on receipts (legal name, address,
 * optional TIN, billing email). Any org member can read; only the org owner can save.
 */

import { createServiceClient, verifyOrgAccess, verifyOrgOwner } from '../_shared/orgAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { validateBillingDetails } from '../_shared/orgBillingDetails.ts';
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function serialize(row: Record<string, unknown> | null) {
  return {
    legalName: (row?.legal_name as string | null) ?? '',
    address: (row?.address as string | null) ?? '',
    tin: (row?.tin as string | null) ?? '',
    billingEmail: (row?.billing_email as string | null) ?? '',
    updatedAt: (row?.updated_at as string | null) ?? null,
  };
}

serveAuthenticated('org-billing-details', async (req, user) => {
  const supabase = createServiceClient();

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId')?.trim() || undefined;
    if (!orgId) return jsonError(req, 'orgId is required');
    const { org } = await verifyOrgAccess(req, { orgId }, 'org.plans:view');
    const { data, error } = await supabase
      .from('org_billing_details')
      .select('legal_name, address, tin, billing_email, updated_at')
      .eq('organization_id', org.id as string)
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    return jsonSuccess(req, { details: serialize(data as Record<string, unknown> | null) });
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    const organizationId =
      typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    if (!organizationId) return jsonError(req, 'organizationId is required');
    const { org } = await verifyOrgOwner(req, organizationId);

    const verdict = validateBillingDetails({
      legalName: body.legalName as string,
      address: body.address as string,
      tin: body.tin as string,
      billingEmail: body.billingEmail as string,
    });
    if (!verdict.ok) {
      return jsonResponse(
        req,
        { success: false, error: verdict.message, field: verdict.field },
        400,
        'private'
      );
    }

    const { data, error } = await supabase
      .from('org_billing_details')
      .upsert(
        {
          organization_id: organizationId,
          legal_name: verdict.value.legalName || null,
          address: verdict.value.address || null,
          tin: verdict.value.tin || null,
          billing_email: verdict.value.billingEmail || null,
          updated_by: user.id,
        },
        { onConflict: 'organization_id' }
      )
      .select('legal_name, address, tin, billing_email, updated_at')
      .single();
    if (error) return jsonError(req, error.message, 500);

    await logActivity({
      action: 'billing.details_updated',
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
      // Field names only. The TIN and address are never written to the activity log.
      metadata: {
        fields: Object.entries(verdict.value)
          .filter(([, value]) => value)
          .map(([key]) => key),
      },
    });

    return jsonSuccess(req, { details: serialize(data as Record<string, unknown>) });
  }

  return jsonError(req, 'Method not allowed', 405);
});
