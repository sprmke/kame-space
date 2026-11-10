/**
 * Meta inbox conversation backfill (Graph Conversations API → DB).
 * Kept separate from webhook handlers so sync workers stay lightweight.
 */

import {
  fetchMetaConversationsPage,
  formatMetaParticipantDisplayName,
  getPageAccessToken,
  type MetaConversationItem,
} from './metaInboxGraph.ts';
import { metaMessagingWindowExpiry } from './metaTimestamp.ts';
import {
  buildDmThreadId,
  insertMessageIfNew,
  metaSelfAccountIds,
  migrateLegacyDmThreadId,
  updateConversationAfterMessage,
  upsertConversation,
} from './socialInboxService.ts';
import type {
  ConversationType,
  SocialChannelConnectionRow,
  SocialPlatform,
} from './socialInboxTypes.ts';

type MetaBackfillMessage = {
  from?: { id?: string };
  created_time?: string;
};

/** Pending when the latest message is from the guest; replied when the account spoke last. */
export function deriveReplyStatusFromMetaMessages(
  messages: MetaBackfillMessage[],
  selfIds: Set<string>
): 'pending' | 'replied' | 'none' {
  if (messages.length === 0) return 'none';

  let latest = messages[0];
  for (const msg of messages) {
    if (!msg.created_time) continue;
    if (!latest?.created_time || msg.created_time > latest.created_time) {
      latest = msg;
    }
  }

  return latest?.from?.id && selfIds.has(latest.from.id) ? 'replied' : 'pending';
}

export function latestInboundMessageAt(
  messages: MetaBackfillMessage[],
  selfIds: Set<string>
): string | null {
  let latest: string | null = null;
  for (const msg of messages) {
    if (!msg.created_time) continue;
    if (msg.from?.id && selfIds.has(msg.from.id)) continue;
    if (!latest || msg.created_time > latest) latest = msg.created_time;
  }
  return latest;
}

function participantFromConversation(
  conv: MetaConversationItem,
  selfIds: Set<string>
): { id: string; name: string | null } {
  const parts = conv.participants?.data ?? [];
  const guest = parts.find((p) => !selfIds.has(p.id)) ?? parts[0];
  return {
    id: guest?.id ?? 'unknown',
    name: formatMetaParticipantDisplayName({
      name: guest?.name,
      username: guest?.username,
    }),
  };
}

export async function syncMetaConversationToDb(opts: {
  orgId: string;
  connection: SocialChannelConnectionRow;
  platform: SocialPlatform;
  conv: MetaConversationItem;
  pageId: string;
  conversationType?: ConversationType;
  /** Scroll sync: upsert thread + latest message only. */
  metadataOnly?: boolean;
}): Promise<string | null> {
  const { orgId, connection, platform, conv, pageId } = opts;
  const conversationType = opts.conversationType ?? 'dm';
  const metadataOnly = opts.metadataOnly === true;
  // Instagram messages carry the Instagram business account id, not the Facebook Page id.
  // Comparing against the Page id alone filed imported host replies as guest messages.
  const selfIds = metaSelfAccountIds(connection, pageId);
  const participant = participantFromConversation(conv, selfIds);
  const messages = conv.messages?.data ?? [];
  const latest = messages.reduce<(typeof messages)[number] | undefined>((acc, msg) => {
    if (!msg.created_time) return acc ?? msg;
    if (!acc?.created_time || msg.created_time > acc.created_time) return msg;
    return acc;
  }, messages[0]);
  const preview = latest?.message?.trim() || '(attachment)';
  const lastAt = latest?.created_time ?? conv.updated_time ?? new Date().toISOString();
  const lastInboundAt = latestInboundMessageAt(messages, selfIds);
  const latestIsOutbound = deriveReplyStatusFromMetaMessages(messages, selfIds) === 'replied';

  const externalThreadId =
    conversationType === 'dm' ? buildDmThreadId(platform, participant.id) : conv.id;

  if (conversationType === 'dm') {
    await migrateLegacyDmThreadId(orgId, platform, participant.id, externalThreadId, conv.id);
  }

  const row = await upsertConversation(
    {
      organization_id: orgId,
      connection_id: connection.id,
      platform,
      external_thread_id: externalThreadId,
      conversation_type: conversationType,
      external_participant_id: participant.id,
      participant_name: participant.name,
    },
    // The summary is owned by `inbox_bump_conversation`. The timestamp is written on create
    // so a freshly imported old thread is not dated "now", and never on update, so a late
    // event cannot rewind the thread.
    { insertOnly: { last_message_at: lastAt } }
  );

  const messagesToStore = metadataOnly ? (latest ? [latest] : []) : [...messages].reverse();

  let storedSomethingNew = false;
  for (const msg of messagesToStore) {
    const isOutbound = Boolean(msg.from?.id && selfIds.has(msg.from.id));
    try {
      const stored = await insertMessageIfNew({
        organization_id: orgId,
        conversation_id: row.id,
        direction: isOutbound ? 'outbound' : 'inbound',
        external_message_id: msg.id,
        body_text: msg.message ?? null,
        attachments: msg.attachments?.data ?? [],
        sent_at: msg.created_time ?? new Date().toISOString(),
        delivery_status: null,
        sent_by_user_id: null,
        is_ai_generated: false,
      });
      if (stored) storedSomethingNew = true;
    } catch (e) {
      console.warn('[syncMetaConversationToDb] skip message:', (e as Error).message);
    }
  }

  // Re-importing a thread that is already stored cannot change its summary, so the extra
  // round trip is skipped. A scroll-sync page of 25 known threads now costs no summary write.
  if (storedSomethingNew) {
    await updateConversationAfterMessage(row.id, {
      direction: latestIsOutbound ? 'outbound' : 'inbound',
      subject_preview: preview.slice(0, 500),
      last_message_at: lastAt,
      last_inbound_at: lastInboundAt,
      messaging_window_expires_at: lastInboundAt ? metaMessagingWindowExpiry(lastInboundAt) : null,
    });
  }

  return row.id;
}
