/**
 * list-parkings — GET parkings for an org (owner/org admin with org:parkings:view).
 * Query: ?orgId=uuid OR ?orgSlug=slug
 * Scoped org admins (`all_listings = false`) only see assigned parkings.
 */

import { createServiceClient, verifyOrgAccess } from '../_shared/orgAuth.ts';
import { loadParkingsPayload } from '../_shared/listParkings.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('list-parkings', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId')?.trim() ?? '';
  const orgSlug = url.searchParams.get('orgSlug')?.trim() ?? '';

  if (!orgId && !orgSlug) {
    return jsonError(req, 'orgId or orgSlug is required');
  }

  const { user, org, canListAllProperties } = await verifyOrgAccess(
    req,
    { orgId: orgId || undefined, orgSlug: orgSlug || undefined },
    'org.parkings:view'
  );

  const supabase = createServiceClient();
  return jsonSuccess(req, await loadParkingsPayload(supabase, user, { org, canListAllProperties }));
});
