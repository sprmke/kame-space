/**
 * Paginated messages for one conversation; mark read; edit host messages.
 */

import {
  assertHostCanEditMessage,
  assertHostCanUnsendMessage,
  editMessageBody,
  softDeleteMessage,
} from '../_shared/chatMessageLifecycle.ts';
import { logActivity } from '../_shared/activityLog.ts';
import {
  listGuestRequestsForConversation,
  resolveGuestRequest,
} from '../_shared/guestRequestsService.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { resolveMetaConnectionIdsForScope } from '../_shared/metaInboxScope.ts';
import {
  attachConversationConnectionStatus,
  conversationAllowedInScope,
  enrichConversationMessageAttachments,
  fillMissingMetaParticipantIdentity,
  getConversationById,
  listMessages,
  markConversationRead,
} from '../_shared/socialInboxService.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { getPageAccessToken, markMetaSeen } from '../_shared/metaInboxGraph.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { featureUnavailableResponse } from '../_shared/featureAvailability.ts';
import type {
  SocialChannelConnectionRow,
  SocialConversationRow,
  SocialMessageRow,
} from '../_shared/socialInboxTypes.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

async function metaReplyFeatureBlock(
  req: Request,
  conv: SocialConversationRow,
  user: { id: string; email: string }
): Promise<Response | null> {
  if (conv.platform !== 'facebook' && conv.platform !== 'instagram') return null;
  return featureUnavailableResponse(req, 'inbox.meta.reply', { user });
}

/**
 * Meta has no API to edit or unsend a Page message. Changing the copy in Kame would
 * leave the guest reading the original, so both are rejected on Meta threads.
 */
function metaBlocksEditOrUnsend(conv: SocialConversationRow): boolean {
  return conv.platform === 'facebook' || conv.platform === 'instagram';
}

/**
 * Mirror "host opened this thread" onto Meta, when the org allows it.
 *
 * Instagram answers to the linked Page's id for `mark_seen`, same as a send.
 */
async function markMetaThreadSeen(conv: SocialConversationRow): Promise<void> {
  const sb = createServiceClient();
  const { data: conn } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('id', conv.connection_id)
    .maybeSingle();
  if (!conn?.meta_page_id || !conn.encrypted_access_token) return;

  const { data: settings } = await sb
    .from('social_inbox_settings')
    .select('mark_seen_on_open, parking_id')
    .eq('organization_id', conv.organization_id)
    .order('parking_id', { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (settings && (settings as { mark_seen_on_open?: boolean }).mark_seen_on_open === false) {
    return;
  }

  const token = await getPageAccessToken(conn as SocialChannelConnectionRow);
  await markMetaSeen({
    accountId: conn.meta_page_id,
    pageAccessToken: token,
    recipientId: conv.external_participant_id ?? '',
  });
}

serveAuthenticated('social-inbox-messages', async (req, user) => {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversation_id')?.trim();
  if (!conversationId) {
    return jsonError(req, 'conversation_id required', 400);
  }

  let body: Record<string, unknown> = {};
  if (req.method === 'POST' || req.method === 'PATCH') {
    body = (await readJsonBody(req).catch(() => ({}))) as Record<string, unknown>;
  }

  const action = String(body.action ?? '').trim();
  const needsReply =
    req.method === 'PATCH' ||
    (req.method === 'POST' && (action === 'unsend' || action === 'resolve_guest_request'));
  const ctx = await resolveInboxAccess(req, needsReply ? 'reply' : 'view', body);

  const conv = await getConversationById(ctx.orgId, conversationId);
  if (!conv) {
    return jsonError(req, 'Conversation not found', 404);
  }

  const metaIds = new Set(await resolveMetaConnectionIdsForScope(ctx.orgId, ctx.scope));
  if (
    !conversationAllowedInScope(conv, {
      propertyId: ctx.propertyId,
      parkingId: ctx.parkingId,
      metaIds,
    })
  ) {
    return jsonError(req, 'Conversation not found', 404);
  }

  if (req.method === 'GET') {
    // Delta mode: only messages inserted or updated since the cursor. A read receipt, an
    // edit or a reaction is a delta, so the thread is patched instead of refetched.
    const after = url.searchParams.get('after') ?? undefined;
    if (after) {
      const since = new Date(after);
      if (Number.isNaN(since.getTime())) {
        return jsonError(req, 'after must be an ISO timestamp', 400);
      }
      const sb = createServiceClient();
      const { data, error } = await sb.rpc('inbox_changed_messages', {
        p_organization_id: ctx.orgId,
        p_conversation_id: conversationId,
        p_since: since.toISOString(),
        p_limit: 200,
      });
      if (error) return jsonError(req, error.message, 500);
      return jsonSuccess(req, {
        messages: (data ?? []) as SocialMessageRow[],
        serverTime: new Date().toISOString(),
        delta: true,
      });
    }

    const before = url.searchParams.get('before') ?? undefined;
    const namedConv = await fillMissingMetaParticipantIdentity(conv);
    const { messages, hasMore } = await listMessages(ctx.orgId, conversationId, { before });
    // GET never calls Graph. Attachment URLs that have expired are refreshed by the
    // explicit `refresh_media` action when an image fails to load.
    const [conversation] = await attachConversationConnectionStatus([namedConv]);
    const guestRequests = await listGuestRequestsForConversation(conversationId);
    return jsonSuccess(req, {
      conversation: conversation ?? namedConv,
      messages,
      hasMore,
      guestRequests,
    });
  }

  if (req.method === 'POST') {
    if (action === 'unsend') {
      const blocked = await metaReplyFeatureBlock(req, conv, user);
      if (blocked) return blocked;
      if (metaBlocksEditOrUnsend(conv)) {
        return jsonError(req, 'Messages sent to Facebook or Instagram cannot be unsent.', 400);
      }
      const messageId = String(body.messageId ?? body.message_id ?? '').trim();
      if (!messageId) {
        return jsonError(req, 'messageId required', 400);
      }
      try {
        await assertHostCanUnsendMessage(ctx.orgId, conversationId, messageId);
        await softDeleteMessage(messageId, { conversationId });
        return jsonSuccess(req, { unsent: true });
      } catch (e) {
        const message = (e as Error).message;
        if (message === 'Conversation not found' || message === 'Message not found') {
          return jsonError(req, message, 404);
        }
        if (
          message === 'Cannot edit this message' ||
          message === 'Message already read' ||
          message === 'Guest already replied'
        ) {
          return jsonError(req, message, 400);
        }
        throw e;
      }
    }

    if (action === 'resolve_guest_request') {
      const requestId = String(body.requestId ?? body.request_id ?? '').trim();
      const status = String(body.status ?? '').trim();
      if (!requestId || (status !== 'approved' && status !== 'declined')) {
        return jsonError(req, 'requestId and a valid status (approved|declined) required', 400);
      }
      const resolved = await resolveGuestRequest({
        id: requestId,
        organizationId: ctx.orgId,
        status,
        resolvedBy: user.id,
      });
      if (!resolved) {
        return jsonError(req, 'Request not found or already resolved', 404);
      }
      await logActivity({
        action: 'guest_request.resolved',
        organizationId: ctx.orgId,
        propertyId: resolved.property_id,
        actor: { actorType: 'team_member', source: 'dashboard', userId: user.id },
        targetId: resolved.id,
        metadata: { status },
      });
      return jsonSuccess(req, { request: resolved });
    }

    if (action === 'refresh_media') {
      const messageId = String(body.messageId ?? body.message_id ?? '').trim();
      if (!messageId) return jsonError(req, 'messageId required', 400);
      const { data: message } = await createServiceClient()
        .from('social_messages')
        .select('*')
        .eq('organization_id', ctx.orgId)
        .eq('conversation_id', conversationId)
        .eq('id', messageId)
        .maybeSingle();
      if (!message) return jsonError(req, 'Message not found', 404);
      const [refreshed] = await enrichConversationMessageAttachments(
        conv,
        [message as SocialMessageRow]
      );
      return jsonSuccess(req, { message: refreshed ?? message });
    }

    await markConversationRead(ctx.orgId, conversationId);

    // Tell Meta the chat was seen, the way Business Suite does, so the guest is not left on
    // unread. Best effort: a failure here must not stop the host reading the thread.
    if (conv.platform === 'facebook' || conv.platform === 'instagram') {
      void markMetaThreadSeen(conv).catch((error) => {
        console.warn('[social-inbox-messages] mark_seen:', (error as Error).message);
      });
    }

    return jsonSuccess(req, { read: true });
  }

  if (req.method === 'PATCH') {
    const blocked = await metaReplyFeatureBlock(req, conv, user);
    if (blocked) return blocked;
    if (metaBlocksEditOrUnsend(conv)) {
      return jsonError(req, 'Messages sent to Facebook or Instagram cannot be edited.', 400);
    }
    const messageId = String(body.messageId ?? body.message_id ?? '').trim();
    const text = String(body.text ?? '').trim();
    if (!messageId || !text) {
      return jsonError(req, 'messageId and text required', 400);
    }
    try {
      await assertHostCanEditMessage(ctx.orgId, conversationId, messageId);
      const message = await editMessageBody(messageId, text, {
        refreshPreview: true,
        conversationId,
      });
      return jsonSuccess(req, { message });
    } catch (e) {
      const message = (e as Error).message;
      if (message === 'Conversation not found' || message === 'Message not found') {
        return jsonError(req, message, 404);
      }
      if (
        message === 'Cannot edit this message' ||
        message === 'Message already read' ||
        message === 'Guest already replied' ||
        message === 'Message text required'
      ) {
        return jsonError(req, message, 400);
      }
      throw e;
    }
  }

  return jsonError(req, 'Method not allowed', 405);
});
