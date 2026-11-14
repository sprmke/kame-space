/**
 * org-access — current user's permissions for an organization.
 * Auth: JWT + verifyOrgAccess (no specific permission required).
 * Query: ?org_id=uuid OR ?org_slug=slug
 */

import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { buildOrgAccessPayload } from '../_shared/orgAccessPayload.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('org-access', async (req) => {
  requireHttpMethod(req, 'GET');
  const ctx = await resolveOrgAccessContext(req);

  return jsonSuccess(req, buildOrgAccessPayload(ctx));
});
