/**
 * List/filter inbox conversations (DB only — keep fast).
 * Optional property_id / parking_id scopes web + effective Meta threads.
 */

import { hasOrgInboxRealtimeAccess, resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { resolveMetaConnectionIdsForScope } from '../_shared/metaInboxScope.ts';
import {
  attachConversationConnectionStatus,
  listConversations,
  resolveMetaHasMore,
  searchInboxConversations,
} from '../_shared/socialInboxService.ts';
import type {
  ConversationType,
  InboxThreadFilter,
  SocialPlatform,
} from '../_shared/socialInboxTypes.ts';
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
  const ctx = await resolveInboxAccess(req, 'view');
  const filter = parseFilter(new URL(req.url));
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
