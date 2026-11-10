/**
 * list-organizations — GET returns orgs the user owns, is an org-hub member of,
 * or has property membership in.
 * Auth: verifyAuthenticatedUser.
 *
 * One RPC, not seven round trips. The previous version issued up to seven sequential
 * PostgREST queries and measured 601 to 917 ms warm in production on 2026-11-09, while the
 * database's cache hit rates were both 1.00. The cost was round trips. `list_user_organizations`
 * / `list_all_organizations_for_platform_admin` (migration 20261324000000) return the same
 * rows in one statement; serialization stays here so the response shape is unchanged.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { loadOrganizationsPayload } from '../_shared/listOrganizations.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('list-organizations', async (req, user) => {
  requireHttpMethod(req, 'GET');

  const payload = await loadOrganizationsPayload(createServiceClient(), user);
  return jsonSuccess(req, payload);
});
