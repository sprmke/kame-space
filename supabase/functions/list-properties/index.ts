/**
 * list-properties — GET properties for an org (owner sees all; members see assigned only).
 * Query: ?orgId=uuid OR ?orgSlug=slug
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { loadPropertiesPayload } from '../_shared/listProperties.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('list-properties', async (req, user) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId')?.trim() ?? '';
  const orgSlug = url.searchParams.get('orgSlug')?.trim() ?? '';

  if (!orgId && !orgSlug) {
    return jsonError(req, 'orgId or orgSlug is required');
  }

  const payload = await loadPropertiesPayload(req, user, {
    orgId: orgId || undefined,
    orgSlug: orgSlug || undefined,
  });

  return jsonSuccess(req, payload);
});
