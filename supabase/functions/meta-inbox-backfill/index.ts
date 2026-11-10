/**
 * Meta inbox conversation backfill — one Graph page per request.
 *
 * The request never carries a Graph URL and the response never returns one. A Graph paging
 * URL carries the Page access token, so the server keeps the opaque cursor on the
 * connection row and builds every URL itself.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { verifyAuthenticatedUser } from '../_shared/orgAuth.ts';
import { resolveSupabaseServiceRoleKey } from '../_shared/supabaseRuntimeEnv.ts';
import { isFeatureAvailable } from '../_shared/featureAvailability.ts';
import { captureSentryException } from '../_shared/sentry.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { getOrgDefaultFacebookConnection } from '../_shared/metaInboxScope.ts';

function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const key = resolveSupabaseServiceRoleKey();
  return !!key && token === key;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  let orgId: string;
  let phase: 'messenger' | 'instagram' | undefined;
  let finalize = false;
  let light = false;

  try {
    const body = await readJsonBody(req);
    finalize = body.finalize === true;
    light = body.light === true;

    if (isServiceRoleRequest(req)) {
      orgId = String(body.organizationId ?? '').trim();
      if (!orgId) return jsonError(req, 'organizationId required', 400);
    } else {
      await verifyAuthenticatedUser(req);
      const permission = light ? 'view' : 'channels_add';
      const ctx = await resolveInboxAccess(req, permission, body as Record<string, unknown>);
      orgId = ctx.orgId;
    }

    const rawPhase = String(body.phase ?? '').trim();
    if (rawPhase === 'instagram' || rawPhase === 'messenger') {
      phase = rawPhase;
    }
  } catch {
    return jsonError(req, 'Unauthorized', 401);
  }

  // The light path pages the whole Page history one conversation at a time. A member with
  // `inbox:view` could use it to walk the account, so it gets its own budget.
  if (light) {
    const limited = await rateLimitGate(req, {
      scope: 'meta-inbox-backfill-light',
      identity: identityFromRequest(req),
      limit: 30,
      windowSec: 60,
    });
    if (limited) return limited;
  }

  // The org-default Page, not any connected row. The old lookup filtered on org and
  // platform only, so it matched a property or parking override row too, and `maybeSingle`
  // errored as soon as an org had one.
  const facebook = await getOrgDefaultFacebookConnection(orgId);
  if (!facebook) {
    return jsonError(req, 'No Meta connection', 404);
  }

  if (!(await isFeatureAvailable('inbox.meta.sync'))) {
    return jsonSuccess(req, {
      done: true,
      phase: 'complete',
      syncedInChunk: 0,
      metaHasMore: false,
      metaSyncPaused: true,
    });
  }

  try {
    const { backfillOrgMetaInboxChunk, finalizeMetaInboxSync } =
      await import('../_shared/metaInboxBackfill.ts');
    if (finalize) {
      await finalizeMetaInboxSync(orgId);
      return jsonSuccess(req, {
        done: true,
        phase: 'complete',
        syncedInChunk: 0,
        metaHasMore: false,
      });
    }
    // No explicit phase means "continue from the stored import state".
    const result = await backfillOrgMetaInboxChunk(
      orgId,
      phase ? { phase } : undefined,
      { light }
    );
    return jsonSuccess(req, result);
  } catch (e) {
    console.error('[meta-inbox-backfill]', e);
    await captureSentryException(e, {
      logPrefix: 'meta-inbox-backfill',
      url: req.url,
      method: req.method,
      tags: { provider: 'meta' },
      fingerprint: ['meta-inbox-backfill'],
    });
    return jsonError(req, (e as Error).message, 500);
  }
});
