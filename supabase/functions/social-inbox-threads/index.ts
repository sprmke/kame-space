/**
 * List/filter inbox conversations (DB only — keep fast).
 * Optional property_id / parking_id scopes web + effective Meta threads.
 */

import { hasOrgInboxRealtimeAccess, resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { resolveMetaConnectionIdsForScope } from '../_shared/metaInboxScope.ts';
import {
  attachConversationConnectionStatus,
  conversationAllowedInScope,
  listConversations,
  resolveMetaHasMore,
  searchInboxConversations,
} from '../_shared/socialInboxService.ts';
import type {
  ConversationType,
  InboxThreadFilter,
  SocialConversationRow,
  SocialPlatform,
} from '../_shared/socialInboxTypes.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { enrichWebConversationsWithPropertyNames } from '../_shared/webGuestChatService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { isFeatureAvailable } from '../_shared/featureAvailability.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function parseFilter(url: URL): InboxThreadFilter {
  const status = url.searchParams.get('status');
  const platform = url.searchParams.get('platform');
  const search = url.searchParams.get('search') ?? undefined;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const limitRaw = url.searchParams.get('limit');
  return {
    type: 'dm' as ConversationType,
    status: (status === 'unread' || status === 'pending' || status === 'replied'
      ? status
      : 'all') as InboxThreadFilter['status'],
    platform: (platform === 'facebook' ||
    platform === 'instagram' ||
    platform === 'tiktok' ||
    platform === 'airbnb' ||
    platform === 'web'
      ? platform
      : 'all') as SocialPlatform | 'all',
    search,
    cursor,
    limit: limitRaw ? Number(limitRaw) : undefined,
  };
}

serveAuthenticated('social-inbox-threads', async (req, user) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }
  const url = new URL(req.url);
  const ctx = await resolveInboxAccess(req, 'view');

  // Delta mode: only what changed since the cursor. One small call replaces refetching
  // every loaded page after a live signal.
  const changedSince = url.searchParams.get('changed_since');
  if (changedSince) {
    const since = new Date(changedSince);
    if (Number.isNaN(since.getTime())) {
      return jsonError(req, 'changed_since must be an ISO timestamp', 400);
    }
    const metaConnectionIds = await resolveMetaConnectionIdsForScope(ctx.orgId, ctx.scope);
    const sb = createServiceClient();
    const { data, error } = await sb.rpc('inbox_changed_conversations', {
      p_organization_id: ctx.orgId,
      p_since: since.toISOString(),
      p_limit: 200,
    });
    if (error) return jsonError(req, error.message, 500);

    const allowed = new Set(metaConnectionIds);
    const conversations = ((data ?? []) as SocialConversationRow[]).filter((row) =>
      conversationAllowedInScope(row, {
        propertyId: ctx.propertyId,
        parkingId: ctx.parkingId,
        metaIds: allowed,
      })
    );
    return jsonSuccess(req, {
      conversations,
      nextCursor: null,
      metaHasMore: false,
      realtimeSupported: true,
      serverTime: new Date().toISOString(),
      delta: true,
    });
  }

  const filter = parseFilter(url);
  const metaConnectionIds = await resolveMetaConnectionIdsForScope(ctx.orgId, ctx.scope);
  const scopedFilter: InboxThreadFilter = {
    ...filter,
    propertyId: ctx.propertyId,
    parkingId: ctx.parkingId,
    metaConnectionIds,
  };

  const listResult = scopedFilter.search?.trim()
    ? await searchInboxConversations(ctx.orgId, scopedFilter)
    : await listConversations(ctx.orgId, scopedFilter);

  const conversations = await attachConversationConnectionStatus(
    await enrichWebConversationsWithPropertyNames(listResult.conversations)
  );
  const metaSyncAvailable = await isFeatureAvailable('inbox.meta.sync');
  const metaHasMore = metaSyncAvailable ? await resolveMetaHasMore(ctx.orgId) : false;
  // Property-level members have `inbox:view` but no org-wide Realtime. The client polls
  // instead, so their inbox still updates.
  const realtimeSupported = await hasOrgInboxRealtimeAccess(
    ctx.orgId,
    user.id,
    ctx.org.owner_id
  );

  return jsonSuccess(req, {
    conversations,
    nextCursor: listResult.nextCursor,
    metaHasMore,
    realtimeSupported,
    ...(metaSyncAvailable ? {} : { metaSyncPaused: true }),
  });
});
