/**
 * Meta inbox sync — status, check now, and load older history.
 *
 * The browser never holds a Graph URL and never drives paging. It asks for a status, nudges
 * a check, or asks for one more page of older chats; the worker does the rest.
 */

import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { resolveEffectiveMetaConnection } from '../_shared/metaInboxScope.ts';
import { socialInboxDb } from '../_shared/socialInboxDb.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { isFeatureAvailable } from '../_shared/featureAvailability.ts';
import { countOrgMetaConversations } from '../_shared/socialInboxService.ts';

/** A check-now is allowed at most this often per connection. */
const CHECK_NOW_THROTTLE_MS = 60_000;

type SyncStateSnapshot = {
  import_phase?: string;
  import_completed_at?: string | null;
  import_cursor?: string | null;
  conversations_imported?: number;
  messages_imported?: number;
  last_checked_at?: string | null;
  last_error_code?: string | null;
  consecutive_failures?: number;
  next_run_at?: string | null;
  rate_limit_pct?: number | null;
 };

serveAuthenticated('meta-inbox-sync', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const body = (await readJsonBody(req)) as Record<string, unknown>;
  const action = String(body.action ?? 'status').trim();
  if (action !== 'status' && action !== 'check_now' && action !== 'load_older') {
    return jsonError(req, 'action must be status, check_now or load_older', 400);
  }

  const ctx = await resolveInboxAccess(req, action === 'status' ? 'view' : 'channels_add', body);
  const effective = await resolveEffectiveMetaConnection(ctx.orgId, ctx.scope);
  const connection = effective.connection;
  if (!connection) {
    return jsonSuccess(req, { connected: false, conversations: 0 });
  }

  const syncAvailable = await isFeatureAvailable('inbox.meta.sync');
  const sb = socialInboxDb();

  const { data: stateRow } = await sb
    .from('meta_sync_state')
    .select('*')
    .eq('connection_id', connection.id)
    .maybeSingle();
  const state = (stateRow ?? {}) as SyncStateSnapshot;

  const head = {
    connected: connection.status === 'connected',
    status: connection.status,
    errorMessage: connection.error_message ?? null,
    platform: connection.platform,
    conversations: await countOrgMetaConversations(ctx.orgId),
    conversationsImported: state.conversations_imported ?? 0,
    messagesImported: state.messages_imported ?? 0,
    importPhase: state.import_phase ?? 'messenger',
    importComplete: Boolean(state.import_completed_at),
    importRunning: !state.import_completed_at,
    lastCheckedAt: state.last_checked_at ?? null,
    lastErrorCode: state.last_error_code ?? null,
    consecutiveFailures: state.consecutive_failures ?? 0,
    nextRunAt: state.next_run_at ?? null,
    rateLimitPct: state.rate_limit_pct ?? null,
    syncPaused: !syncAvailable,
    // Meta returns only the newest 20 messages per chat, so older history may exist.
    historyCappedPerThread: 20,
  };

  if (action === 'status') {
    return jsonSuccess(req, head);
  }

  if (!syncAvailable) {
    return jsonError(req, 'Meta sync is turned off for this platform', 409);
  }

  if (connection.status !== 'connected') {
    return jsonError(req, 'Reconnect Facebook to sync this inbox', 400);
  }

  if (action === 'check_now') {
    const lastChecked = state.last_checked_at ? new Date(state.last_checked_at).getTime() : 0;
    if (Date.now() - lastChecked < CHECK_NOW_THROTTLE_MS) {
      // Silence is correct here: the client asks on open and on focus, and both are cheap
      // no-ops inside the throttle window.
      return jsonSuccess(req, { ...head, throttled: true });
    }
    await sb
      .from('meta_sync_state')
      .update({ next_run_at: new Date().toISOString(), last_viewed_at: new Date().toISOString() })
      .eq('connection_id', connection.id);
    return jsonSuccess(req, { ...head, checked: true });
  }

  // load_older: continue the import past the lookback window, one page per tap.
  if (state.import_completed_at && !state.import_cursor) {
    return jsonSuccess(req, { ...head, exhausted: true });
  }
  await sb
    .from('meta_sync_state')
    .update({
      next_run_at: new Date().toISOString(),
      import_completed_at: null,
      import_phase: state.import_phase === 'complete' ? 'messenger' : state.import_phase,
    })
    .eq('connection_id', connection.id);
  return jsonSuccess(req, { ...head, loadingOlder: true, requestedBy: user.id });
});
