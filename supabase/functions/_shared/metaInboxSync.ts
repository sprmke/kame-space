/**
 * Server-owned Meta import and reconciliation.
 *
 * The browser used to drive the import one chunk per scroll, so closing the tab stopped it
 * and nothing ever filled a webhook gap. Here the cursor, the watermark and the schedule all
 * live on `meta_sync_state`, and the worker does bounded work per run.
 */

import { socialInboxDb } from './socialInboxDb.ts';
import type { SocialChannelConnectionRow } from './socialInboxTypes.ts';
import { getPageAccessToken, parseMetaGraphJson } from './metaInboxGraph.ts';
import {
  buildMetaConversationHeadUrl,
  buildMetaConversationsByIdsUrl,
  buildMetaConversationsUrl,
  buildMetaThreadOwnerUrl,
  extractMetaPagingCursor,
  readMetaRateLimitPct,
} from './metaInboxGraphPaging.ts';
import { syncMetaConversationToDb } from './metaInboxBackfill.ts';
import { metaGraphErrorFromResponse, isInvalidMetaTokenError } from './metaInboxGraphError.ts';
import type { MetaConversationItem } from './metaInboxGraph.ts';
import { logActivity } from './activityLog.ts';

/** Debounced per connection: one row when sync breaks, one when it recovers. */
async function logSyncTransition(opts: {
  action: 'integrations.meta_sync_degraded' | 'integrations.meta_sync_recovered';
  connection: SocialChannelConnectionRow;
  reason?: string | null;
}): Promise<void> {
  await logActivity({
    action: opts.action,
    organizationId: opts.connection.organization_id,
    propertyId: opts.connection.property_id ?? null,
    parkingId: opts.connection.parking_id ?? null,
    actor: { actorType: 'system', source: 'cron', displayName: 'Meta sync' },
    targetId: opts.connection.id,
    targetLabel: opts.connection.display_name ?? 'Meta Page',
    metadata: {
      provider: 'meta_inbox',
      platform: opts.connection.platform,
      ...(opts.reason ? { reason: opts.reason } : {}),
    },
  });
}

/** Graph calls in flight per worker run. */
const GRAPH_CONCURRENCY = 4;
/** Lookback used after a re-subscribe or a webhook outage. */
export const RECONCILE_RECOVERY_LOOKBACK_HOURS = 72;
/** Reconciliation always reaches slightly further back than the watermark, so a clock skew between Meta and Postgres cannot miss a row. */
const WATERMARK_OVERLAP_MINUTES = 10;
/** At this rate-limit percentage every interval doubles. */
const RATE_LIMIT_SOFT_PCT = 75;
/** At this percentage only a manual check runs. */
const RATE_LIMIT_HARD_PCT = 90;

export type MetaSyncStateRow = {
  id: string;
  connection_id: string;
  organization_id: string;
  platform: 'facebook' | 'instagram';
  import_cursor: string | null;
  import_phase: 'messenger' | 'instagram' | 'complete';
  import_completed_at: string | null;
  watermark: string | null;
  next_run_at: string;
  consecutive_failures: number;
  last_error_code: string | null;
  rate_limit_pct: number | null;
  last_change_at: string | null;
  last_viewed_at: string | null;
};

export type MetaSyncJobResult = {
  connectionId: string;
  job: 'import' | 'reconcile' | 'idle' | 'skipped';
  conversations: number;
  messages: number;
  changed: number;
  errorCode: string | null;
};

/**
 * Next reconcile interval.
 *
 * Adaptive on purpose: a chatty Page is checked often enough to feel live, a quiet one costs
 * almost nothing, and a Page with an inbox open is checked every two minutes.
 */
export function computeMetaNextRunAt(opts: {
  now?: Date;
  lastChangeAt: string | null;
  inboxOpen: boolean;
  rateLimitPct: number | null;
  consecutiveFailures?: number;
}): Date {
  const now = opts.now ?? new Date();
  const minutes = (() => {
    if (opts.inboxOpen) return 2;
    if (!opts.lastChangeAt) return 6 * 60;
    const ageHours = (now.getTime() - new Date(opts.lastChangeAt).getTime()) / 3_600_000;
    if (ageHours <= 24) return 10;
    if (ageHours <= 24 * 7) return 30;
    return 6 * 60;
  })();

  const pct = opts.rateLimitPct ?? 0;
  const pressureMultiplier = pct >= RATE_LIMIT_SOFT_PCT ? 2 : 1;
  // A failing connection backs off rather than hammering a Page that is already unhappy.
  const failureMultiplier = Math.min(2 ** Math.min(opts.consecutiveFailures ?? 0, 4), 16);

  return new Date(now.getTime() + minutes * 60_000 * pressureMultiplier * failureMultiplier);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++]!;
      results.push(await run(current));
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Run due sync jobs. Bounded by a time budget so one large Page cannot hold the worker.
 */
export async function runMetaSyncBatch(
  opts: { limit?: number; budgetMs?: number } = {}
): Promise<MetaSyncJobResult[]> {
  const sb = socialInboxDb();
  const budgetMs = opts.budgetMs ?? 40_000;
  const startedAt = Date.now();

  const { data, error } = await sb.rpc('meta_sync_claim', {
    p_limit: opts.limit ?? 5,
    p_lock_seconds: Math.ceil(budgetMs / 1000) + 10,
  });
  if (error) throw new Error(error.message);

  const states = (data ?? []) as MetaSyncStateRow[];
  const results: MetaSyncJobResult[] = [];

  for (const state of states) {
    if (Date.now() - startedAt > budgetMs) break;
    results.push(await runOneSyncJob(state));
  }

  return results;
}

export async function runOneSyncJob(state: MetaSyncStateRow): Promise<MetaSyncJobResult> {
  const sb = socialInboxDb();
  const base: MetaSyncJobResult = {
    connectionId: state.connection_id,
    job: 'idle',
    conversations: 0,
    messages: 0,
    changed: 0,
    errorCode: null,
  };

  const { data: connectionRow } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('id', state.connection_id)
    .maybeSingle();
  const connection = connectionRow as SocialChannelConnectionRow | null;
  if (!connection || connection.status !== 'connected') {
    await sb.rpc('meta_sync_finish', {
      p_connection_id: state.connection_id,
      p_next_run_at: new Date(Date.now() + 6 * 3_600_000).toISOString(),
      p_error_code: 'connection_not_connected',
    });
    return { ...base, job: 'skipped', errorCode: 'connection_not_connected' };
  }

  const pageId = connection.meta_page_id ?? connection.external_account_id;
  if (!pageId) {
    await sb.rpc('meta_sync_finish', {
      p_connection_id: state.connection_id,
      p_next_run_at: new Date(Date.now() + 6 * 3_600_000).toISOString(),
      p_error_code: 'no_page_id',
    });
    return { ...base, job: 'skipped', errorCode: 'no_page_id' };
  }

  const platform = state.platform === 'instagram' ? 'instagram' : 'messenger';

  try {
    const token = await getPageAccessToken(connection);
    const wasFailing = state.consecutive_failures > 0;
    const result: Omit<MetaSyncJobResult, 'connectionId' | 'changed' | 'errorCode'> & {
      completedImport?: boolean;
    } = state.import_completed_at
      ? await runReconcile(connection, state, pageId, platform, token)
      : await runImportPage(connection, state, pageId, platform, token);

    if (wasFailing) {
      await logSyncTransition({
        action: 'integrations.meta_sync_recovered',
        connection,
      });
    }
    if (result.job === 'import' && result.completedImport) {
      await logActivity({
        action: 'integrations.meta_import_completed',
        organizationId: connection.organization_id,
        propertyId: connection.property_id ?? null,
        parkingId: connection.parking_id ?? null,
        actor: { actorType: 'system', source: 'cron', displayName: 'Meta sync' },
        targetId: connection.id,
        targetLabel: connection.display_name ?? 'Meta Page',
        metadata: {
          provider: 'meta_inbox',
          platform: connection.platform,
          conversations: result.conversations,
        },
      });
    }
    return { ...base, ...result, changed: result.conversations };
  } catch (error) {
    const code = isInvalidMetaTokenError(error)
      ? 'invalid_token'
      : ((error as { code?: number }).code ?? 'unknown');
    if (isInvalidMetaTokenError(error)) {
      // A dead token stops the schedule; reconnect resumes it.
      await sb
        .from('social_channel_connections')
        .update({
          status: 'error',
          error_message: 'Meta session expired. Reconnect Facebook in Channels.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', state.connection_id);
    }
    await sb.rpc('meta_sync_finish', {
      p_connection_id: state.connection_id,
      p_next_run_at: computeMetaNextRunAt({
        lastChangeAt: state.last_change_at,
        inboxOpen: false,
        rateLimitPct: state.rate_limit_pct,
        consecutiveFailures: state.consecutive_failures + 1,
      }).toISOString(),
      p_error_code: String(code),
    });
    // One row when sync first breaks, not one per failed run.
    if (state.consecutive_failures === 0) {
      await logSyncTransition({
        action: 'integrations.meta_sync_degraded',
        connection,
        reason: String(code),
      });
    }
    return { ...base, job: 'idle', errorCode: String(code) };
  }
}

/** One Graph page of conversations, newest first. */
async function runImportPage(
  connection: SocialChannelConnectionRow,
  state: MetaSyncStateRow,
  pageId: string,
  platform: 'messenger' | 'instagram',
  token: string
): Promise<
    Omit<MetaSyncJobResult, 'connectionId' | 'changed' | 'errorCode'> & {
      completedImport?: boolean;
    }
  > {
  const sb = socialInboxDb();
  const url = buildMetaConversationsUrl(pageId, token, platform, {
    after: state.import_cursor,
  });
  const res = await fetch(url);
  const json = await parseMetaGraphJson(res);
  if (!res.ok) throw metaGraphErrorFromResponse(json, res.status, 'Meta conversations failed');

  const conversations = (json.data ?? []) as MetaConversationItem[];
  const nextCursor = extractMetaPagingCursor((json.paging as { next?: string })?.next);
  const rateLimitPct = readMetaRateLimitPct(res.headers);

  let conversationsImported = 0;
  let messagesImported = 0;

  await mapWithConcurrency(conversations, GRAPH_CONCURRENCY, async (conv) => {
    try {
      await syncMetaConversationToDb({
        orgId: connection.organization_id,
        connection,
        platform: state.platform,
        conv,
        pageId,
      });
      conversationsImported += 1;
      messagesImported += conv.messages?.data?.length ?? 0;
    } catch (error) {
      console.warn('[metaInboxSync] import conversation failed:', (error as Error).message);
    }
  });

  const completed = !nextCursor;
  const newestChange = conversations
    .map((conv) => conv.updated_time)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();

  await sb.rpc('meta_sync_finish', {
    p_connection_id: state.connection_id,
    p_next_run_at: (
      completed
        ? computeMetaNextRunAt({
            lastChangeAt: newestChange ?? null,
            inboxOpen: false,
            rateLimitPct,
          })
        : new Date(Date.now() + 5_000)
    ).toISOString(),
    p_watermark: newestChange ?? null,
    p_conversations_imported: conversationsImported,
    p_messages_imported: messagesImported,
    p_import_cursor: nextCursor,
    p_import_phase: completed ? 'complete' : state.import_phase,
    p_import_completed: completed,
    p_rate_limit_pct: rateLimitPct,
  });

  return {
    job: 'import',
    conversations: conversationsImported,
    messages: messagesImported,
    completedImport: completed,
  };
}

/** Cheap head scan, then one multi-id read for the threads that changed. */
async function runReconcile(
  connection: SocialChannelConnectionRow,
  state: MetaSyncStateRow,
  pageId: string,
  platform: 'messenger' | 'instagram',
  token: string
): Promise<Omit<MetaSyncJobResult, 'connectionId' | 'changed' | 'errorCode'>> {
  const sb = socialInboxDb();

  if ((state.rate_limit_pct ?? 0) >= RATE_LIMIT_HARD_PCT) {
    // Meta told us to back off. Nothing but a manual check runs until the window moves.
    await sb.rpc('meta_sync_finish', {
      p_connection_id: state.connection_id,
      p_next_run_at: computeMetaNextRunAt({
        lastChangeAt: state.last_change_at,
        inboxOpen: false,
        rateLimitPct: state.rate_limit_pct,
      }).toISOString(),
    });
    return { job: 'reconcile', conversations: 0, messages: 0 };
  }

  const headRes = await fetch(buildMetaConversationHeadUrl(pageId, token, platform));
  const headJson = await parseMetaGraphJson(headRes);
  if (!headRes.ok) {
    throw metaGraphErrorFromResponse(headJson, headRes.status, 'Meta conversation head failed');
  }
  const rateLimitPct = readMetaRateLimitPct(headRes.headers);
  const head = (headJson.data ?? []) as Array<{ id: string; updated_time?: string }>;

  const cutoff = state.watermark
    ? new Date(new Date(state.watermark).getTime() - WATERMARK_OVERLAP_MINUTES * 60_000)
    : new Date(Date.now() - RECONCILE_RECOVERY_LOOKBACK_HOURS * 3_600_000);

  const changed = head.filter((row) => row.updated_time && new Date(row.updated_time) >= cutoff);
  const newestHead = head
    .map((row) => row.updated_time)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();

  let conversations = 0;
  let messages = 0;

  if (changed.length) {
    const byIdsUrl = buildMetaConversationsByIdsUrl(
      pageId,
      token,
      platform,
      changed.map((row) => row.id)
    );
    const byIdsRes = await fetch(byIdsUrl);
    const byIdsJson = await parseMetaGraphJson(byIdsRes);
    if (!byIdsRes.ok) {
      throw metaGraphErrorFromResponse(byIdsJson, byIdsRes.status, 'Meta multi-id read failed');
    }

    // `?ids=` returns an object keyed by conversation id, in no particular order.
    const items = Object.values(byIdsJson).filter(
      (value): value is MetaConversationItem =>
        Boolean(value) && typeof value === 'object' && 'id' in (value as object)
    );

    for (const conv of items) {
      try {
        const stored = await syncMetaConversationToDb({
          orgId: connection.organization_id,
          connection,
          platform: state.platform,
          conv,
          pageId,
        });
        if (stored) conversations += 1;
        messages += conv.messages?.data?.length ?? 0;
      } catch (error) {
        console.warn('[metaInboxSync] reconcile conversation failed:', (error as Error).message);
      }
    }
  }

  await sb.rpc('meta_sync_finish', {
    p_connection_id: state.connection_id,
    p_next_run_at: computeMetaNextRunAt({
      lastChangeAt: newestHead ?? state.last_change_at,
      inboxOpen: Boolean(state.last_viewed_at && Date.now() - new Date(state.last_viewed_at).getTime() < 120_000),
      rateLimitPct,
    }).toISOString(),
    p_watermark: newestHead ?? null,
    p_rate_limit_pct: rateLimitPct,
  });

  return { job: 'reconcile', conversations, messages };
}

/** Mark a connection as watched right now, so the next reconcile runs on the 2-minute interval. */
export async function markMetaInboxViewed(connectionId: string): Promise<void> {
  const sb = socialInboxDb();
  await sb
    .from('meta_sync_state')
    .update({ last_viewed_at: new Date().toISOString(), next_run_at: new Date().toISOString() })
    .eq('connection_id', connectionId);
}

/** Which app owns the Page's chats. */
export async function fetchMetaThreadOwner(
  pageId: string,
  pageAccessToken: string
): Promise<string | null> {
  const res = await fetch(buildMetaThreadOwnerUrl(pageId, pageAccessToken));
  if (!res.ok) return null;
  const json = await parseMetaGraphJson(res);
  const data = (json.data ?? json) as { thread_owner?: { app_id?: string } } | undefined;
  const appId = data?.thread_owner?.app_id;
  return appId ? String(appId) : null;
}
