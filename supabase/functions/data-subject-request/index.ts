/**
 * data-subject-request — RA 10173 export and deletion requests for the signed-in user.
 *
 * POST { kind: 'export' }                    → JSON download of the caller's own data
 * POST { kind: 'delete', confirm: 'DELETE' } → opens a reviewed deletion request (15-day due)
 *
 * Export is synchronous. Deletion never destroys records inline: bookings are financial
 * records with a lawful retention basis and an operator executes the documented runbook.
 * Auth: authenticated guest or host (`serveAuthenticated`).
 */

import {
  buildDataSubjectExport,
  recordExportDelivered,
  requestAccountDeletion,
} from '../_shared/dataSubjectService.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const RATE_LIMIT_PER_HOUR = 5;

serveAuthenticated('data-subject-request', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const kind = typeof body.kind === 'string' ? body.kind.trim() : '';

  const limited = await rateLimitGate(req, {
    scope: 'data-subject-request',
    identity: user.id,
    limit: RATE_LIMIT_PER_HOUR,
    windowSec: 60 * 60,
  });
  if (limited) return limited;

  if (kind === 'export') {
    try {
      const payload = await buildDataSubjectExport(user);
      await recordExportDelivered(user);
      const stamp = new Date().toISOString().slice(0, 10);
      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          ...corsHeaders(req),
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="kame-space-data-${stamp}.json"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      return jsonError(
        req,
        error instanceof Error ? error.message : 'Could not prepare your data export',
        500
      );
    }
  }

  if (kind === 'delete') {
    if (body.confirm !== 'DELETE') {
      return jsonError(req, 'Type DELETE to confirm the deletion request', 400);
    }
    try {
      const request = await requestAccountDeletion(
        user,
        typeof body.note === 'string' ? body.note : null
      );
      return jsonSuccess(req, {
        request,
        retention:
          'Bookings are kept as financial records after deletion. Personal fields are anonymised; dates, amounts and status remain for accounting and tax.',
      });
    } catch (error) {
      return jsonError(
        req,
        error instanceof Error ? error.message : 'Could not record the deletion request',
        500
      );
    }
  }

  return jsonError(req, "kind must be 'export' or 'delete'", 400);
});
