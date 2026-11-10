/**
 * Process Meta webhook payloads into social_conversations / social_messages.
 */

import { metaMessagingWindowExpiry, normalizeMetaWebhookTimestamp } from './metaTimestamp.ts';
import {
  fetchMetaMessengerParticipantProfile,
  formatMetaParticipantDisplayName,
  getPageAccessToken,
} from './metaInboxGraph.ts';
import {
  createOrCoalesceNotification,
  inboxNotificationParticipantLabel,
} from './notificationService.ts';
import { inboxNotificationMetadata } from './notificationEnrichment.ts';
import type { MetaMessagingPlatform } from './metaInboxEvents.ts';
import {
  buildDmThreadId,
  getConnectionForMetaWebhook,
  getConversationByExternalThread,
  insertMessageIfNew,
  metaSelfAccountIds,
  migrateLegacyDmThreadId,
  recordWebhookEvent,
  updateConversationAfterMessage,
  upsertConversation,
} from './socialInboxService.ts';
import type { SocialConversationRow } from './socialInboxTypes.ts';

type MetaMessagingEvent = {
  sender?: { id: string; username?: string; name?: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: unknown[];
    is_echo?: boolean;
  };
};

/** What the webhook handler did with one event. */
export type MetaWebhookMessageResult = {
  /** True when the message row was created, not a redelivery. */
  inserted: boolean;
  organizationId: string | null;
  guestId: string | null;
  isOutbound: boolean;
};

const EMPTY_RESULT: MetaWebhookMessageResult = {
  inserted: false,
  organizationId: null,
  guestId: null,
  isOutbound: false,
};

export async function handleMetaMessagingWebhook(
  pageId: string,
  event: MetaMessagingEvent,
  platform: MetaMessagingPlatform
): Promise<MetaWebhookMessageResult> {
  const eventId = event.message?.mid;
  if (!eventId) return EMPTY_RESULT;

  const connection = await getConnectionForMetaWebhook(pageId, platform);
  if (!connection?.encrypted_access_token) return EMPTY_RESULT;

  const orgId = connection.organization_id;
  const senderId = event.sender?.id ?? '';
  // Direction comes from the account's own ids. An Instagram reply sent from the Instagram
  // app carries the Instagram business account id, not the Facebook Page id, so comparing
  // against the Page id alone filed those replies as guest messages.
  const selfIds = metaSelfAccountIds(connection, pageId);
  const isFromPage = event.message?.is_echo === true || selfIds.has(senderId);
  const guestId = isFromPage ? event.recipient?.id : senderId;
  const sentAt = event.timestamp
    ? normalizeMetaWebhookTimestamp(event.timestamp)
    : new Date().toISOString();
  const text = event.message?.text?.trim() ?? '';
  const preview = text || '(attachment)';

  const threadId = buildDmThreadId(platform, guestId ?? 'unknown');
  if (guestId) {
    await migrateLegacyDmThreadId(orgId, platform, guestId, threadId);
  }

  // A message with no resolvable participant cannot be filed anywhere. Record it so Meta
  // stops retrying, and move on rather than creating a `facebook:` thread.
  if (!guestId?.trim()) {
    console.warn('[handleMetaMessagingWebhook] event with no participant id, dropped');
    await recordWebhookEvent(eventId);
    return { ...EMPTY_RESULT, organizationId: orgId };
  }

  const existing = await getConversationByExternalThread(orgId, platform, threadId);
  const identityPatch: {
    participant_name?: string;
    participant_avatar_url?: string;
  } = {};
  const webhookName = formatMetaParticipantDisplayName({
    name: event.sender?.name,
    username: event.sender?.username,
  });
  if (!existing?.participant_name?.trim() && webhookName && !isFromPage) {
    identityPatch.participant_name = webhookName;
  }
  if (
    !existing?.participant_name?.trim() &&
    !identityPatch.participant_name &&
    guestId &&
    guestId !== 'unknown'
  ) {
    try {
      const token = await getPageAccessToken(connection);
      const profile = await fetchMetaMessengerParticipantProfile(guestId, token, platform);
      if (profile.name) identityPatch.participant_name = profile.name;
      if (profile.profilePic) identityPatch.participant_avatar_url = profile.profilePic;
    } catch (e) {
      console.warn('[handleMetaMessagingWebhook] profile lookup:', (e as Error).message);
    }
  }

  const conv = await upsertConversation(
    {
      organization_id: orgId,
      connection_id: connection.id,
      platform,
      external_thread_id: threadId,
      conversation_type: 'dm',
      external_participant_id: guestId ?? null,
      ...identityPatch,
    },
    // The summary is owned by `inbox_bump_conversation`. Set the timestamp on create so a
    // late event cannot rewind the thread, and never on update.
    { insertOnly: { last_message_at: sentAt } }
  );

  const inserted = await insertMessageIfNew({
    organization_id: orgId,
    conversation_id: conv.id,
    direction: isFromPage ? 'outbound' : 'inbound',
    external_message_id: eventId,
    body_text: text || null,
    attachments: (event.message?.attachments as unknown[]) ?? [],
    sent_at: sentAt,
    delivery_status: null,
    sent_by_user_id: null,
    is_ai_generated: false,
  });

  await updateConversationAfterMessage(conv.id, {
    direction: isFromPage ? 'outbound' : 'inbound',
    subject_preview: preview.slice(0, 500),
    last_message_at: sentAt,
    messaging_window_expires_at: isFromPage ? null : metaMessagingWindowExpiry(sentAt),
    // Only a newly stored inbound message moves the badge, and only if the host has not
    // already read past it.
    unread_delta: inserted && !isFromPage ? 1 : 0,
  });

  // Side effects run only for a newly stored message. A redelivered Meta event inserts
  // nothing, so it never notifies twice.
  if (inserted && !isFromPage) {
    await notifyInboundGuestMessage({
      conv,
      text,
      preview,
      sentAt,
    });
  }

  // The dedupe row is written after the message landed. Marking first meant a later failure
  // made Meta's retry look like a duplicate, and the message was lost for good.
  await recordWebhookEvent(eventId);

  return {
    inserted: Boolean(inserted),
    organizationId: orgId,
    guestId: guestId ?? null,
    isOutbound: isFromPage,
  };
}

async function notifyInboundGuestMessage(opts: {
  conv: SocialConversationRow;
  text: string;
  preview: string;
  sentAt: string;
}): Promise<void> {
  try {
    const { notifyTelegramChatInbound } = await import('./telegramChat.ts');
    await notifyTelegramChatInbound({
      conversation: opts.conv,
      text: opts.text || null,
      attachments: [],
      sentAt: opts.sentAt,
    });
  } catch (e) {
    console.warn('[handleMetaMessagingWebhook] telegram notify:', e);
  }
  try {
    const participantLabel = inboxNotificationParticipantLabel(
      opts.conv.participant_name,
      opts.conv.conversation_type
    );
    await createOrCoalesceNotification({
      organizationId: opts.conv.organization_id,
      propertyId: opts.conv.property_id ?? null,
      parkingId: opts.conv.parking_id ?? null,
      type: 'inbox_new_message',
      title: participantLabel,
      body: opts.preview.slice(0, 200),
      conversationId: opts.conv.id,
      metadata: inboxNotificationMetadata(opts.conv),
      dedupeKey: `${opts.conv.id}:inbox_new_message`,
    });
  } catch (e) {
    console.warn('[handleMetaMessagingWebhook] notification create:', e);
  }
}

/**
 * A guest read the host's messages.
 *
 * The read watermark is the guest's read state, not the host's. It marks the host's
 * outbound messages read and moves `guest_last_read_at`. It never clears the host's
 * unread badge, which counts what the host has not read yet.
 */
export async function handleMetaReadReceipt(
  pageId: string,
  senderId: string,
  platform: MetaMessagingPlatform,
  watermark?: number
): Promise<void> {
  const connection = await getConnectionForMetaWebhook(pageId, platform);
  if (!connection) return;

  const readAt = watermark
    ? normalizeMetaWebhookTimestamp(watermark)
    : new Date().toISOString();
  const sb = (await import('./socialInboxService.ts')).socialInboxDb();
  const { error } = await sb.rpc('inbox_apply_meta_read', {
    p_organization_id: connection.organization_id,
    p_platform: platform,
    p_external_thread_id: buildDmThreadId(platform, senderId),
    p_read_at: readAt,
  });
  if (error) throw new Error(error.message);
}
