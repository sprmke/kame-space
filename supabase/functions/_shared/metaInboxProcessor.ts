/**
 * Meta webhook processor.
 *
 * Runs after the acknowledgement: claims outbox rows, applies each one through the shared
 * database writer, and schedules a retry with backoff. Side effects (in-app notification,
 * Telegram, AI auto-reply) fire only for a newly stored inbound message, so a retry or a
 * reconciler can never notify twice.
 */

import { buildDmThreadId, getConnectionForMetaWebhook, metaSelfAccountIds } from './socialInboxService.ts';
import { socialInboxDb } from './socialInboxDb.ts';
import type { SocialChannelConnectionRow } from './socialInboxTypes.ts';
import { metaMessagingWindowExpiry } from './metaTimestamp.ts';
import {
  createOrCoalesceNotification,
  inboxNotificationParticipantLabel,
} from './notificationService.ts';
import { inboxNotificationMetadata } from './notificationEnrichment.ts';
import {
  fetchMetaMessengerParticipantProfile,
  formatMetaParticipantDisplayName,
  getPageAccessToken,
} from './metaInboxGraph.ts';
import type {
  MetaEventChannel,
  MetaMessagingPlatform,
  MetaNormalizedEvent,
  MetaNormalizedEventType,
} from './metaInboxEvents.ts';
import { captureSentryException } from './sentry.ts';

/** Retry ladder in seconds. Attempt n waits BACKOFF_SECONDS[n - 1]. */
export const META_WEBHOOK_BACKOFF_SECONDS = [30, 120, 600, 3600, 21600] as const;
export const META_WEBHOOK_MAX_ATTEMPTS = META_WEBHOOK_BACKOFF_SECONDS.length + 1;
const CLAIM_LIMIT = 20;
const LOCK_SECONDS = 120;

type OutboxRow = {
  id: string;
  platform: string;
  entry_id: string;
  channel: string;
  event_type: string;
  event_key: string;
  event_time: string;
  payload: Record<string, unknown>;
  attempts: number;
  organization_id: string | null;
};

export type MetaProcessorResult = {
  claimed: number;
  applied: number;
  skipped: number;
  retried: number;
  dead: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Seconds to wait before the next attempt, or `null` when the row is out of attempts. */
export function metaWebhookBackoffSeconds(attempts: number): number | null {
  if (attempts >= META_WEBHOOK_MAX_ATTEMPTS) return null;
  const index = Math.min(Math.max(attempts - 1, 0), META_WEBHOOK_BACKOFF_SECONDS.length - 1);
  return META_WEBHOOK_BACKOFF_SECONDS[index]!;
}

function connectionCacheKey(entryId: string, platform: string): string {
  return `${platform}:${entryId}`;
}

/**
 * Process one batch of due outbox rows.
 *
 * Returns counters rather than throwing, so one bad row cannot stop the rest of the batch.
 */
export async function processMetaWebhookBatch(
  opts: { limit?: number } = {}
): Promise<MetaProcessorResult> {
  const sb = socialInboxDb();
  const result: MetaProcessorResult = { claimed: 0, applied: 0, skipped: 0, retried: 0, dead: 0 };

  const { data, error } = await sb.rpc('meta_webhook_claim', {
    p_limit: opts.limit ?? CLAIM_LIMIT,
    p_lock_seconds: LOCK_SECONDS,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as OutboxRow[];
  result.claimed = rows.length;
  if (!rows.length) return result;

  // Per-batch connection cache. A burst from one Page resolves the row once.
  const connections = new Map<string, SocialChannelConnectionRow | null>();

  for (const row of rows) {
    try {
      const outcome = await processOne(row, connections);
      await sb.rpc('meta_webhook_complete', {
        p_id: row.id,
        p_status: outcome.status,
        p_result: outcome.result ?? null,
      });
      if (outcome.status === 'done') result.applied += 1;
      else result.skipped += 1;
    } catch (err) {
      const message = (err as Error)?.message ?? 'unknown error';
      const backoff = metaWebhookBackoffSeconds(row.attempts);
      const dead = backoff === null;
      await sb.rpc('meta_webhook_fail', {
        p_id: row.id,
        p_error: message,
        p_retry_in_seconds: backoff ?? 0,
        p_dead: dead,
        p_organization_id: row.organization_id,
      });
      if (dead) {
        result.dead += 1;
        await captureSentryException(err, {
          logPrefix: 'meta-inbox-processor',
          tags: { provider: 'meta', event_type: row.event_type, platform: row.platform },
          fingerprint: ['meta-inbox-processor', row.event_type, row.platform],
          extra: { eventKey: row.event_key, attempts: row.attempts },
        });
      } else {
        result.retried += 1;
      }
    }
  }

  return result;
}

type Outcome = {
  status: 'done' | 'skipped';
  result?: Record<string, unknown>;
};

async function processOne(
  row: OutboxRow,
  connections: Map<string, SocialChannelConnectionRow | null>
): Promise<Outcome> {
  const platform = row.platform as MetaMessagingPlatform;
  const key = connectionCacheKey(row.entry_id, platform);
  let connection = connections.get(key);
  if (connection === undefined) {
    connection = await getConnectionForMetaWebhook(row.entry_id, platform);
    connections.set(key, connection);
  }
  if (!connection?.encrypted_access_token) {
    // No connected Page for this entry id. Nothing to store, and a retry will not help.
    return { status: 'skipped', result: { reason: 'no_connection' } };
  }

  const event: MetaNormalizedEvent = {
    object: '',
    platform,
    entryId: row.entry_id,
    channel: row.channel as MetaEventChannel,
    eventType: row.event_type as MetaNormalizedEventType,
    eventKey: row.event_key,
    eventTime: row.event_time,
    payload: row.payload,
  };

  return applyMetaEvent(event, connection, { unreadDelta: 1, source: 'webhook' });
}

/**
 * Apply one normalized event. Shared by the webhook processor and the reconciler, so a
 * message Backfill and a message webhook take exactly the same path.
 */
export async function applyMetaEvent(
  event: MetaNormalizedEvent,
  connection: SocialChannelConnectionRow,
  opts: { unreadDelta?: 0 | 1; source?: 'webhook' | 'reconcile' | 'import' } = {}
): Promise<Outcome> {
  const sb = socialInboxDb();
  const orgId = connection.organization_id;
  const platform = event.platform;

  switch (event.eventType) {
    case 'read': {
      const sender = asString(asRecord(event.payload.sender).id);
      const watermark = asRecord(asRecord(event.payload.read).watermark);
      if (!sender) return { status: 'skipped', result: { reason: 'no_sender' } };
      const selfIdsForRead = metaSelfAccountIds(connection, event.entryId);
      const guestIdForRead = selfIdsForRead.has(sender)
        ? asString(asRecord(event.payload.recipient).id)
        : sender;

      // A read receipt whose sender is the account itself means the host read the thread in
      // Business Suite or another app. Clear the host badge, so it does not stay lit for a
      // conversation that was already dealt with.
      if (selfIdsForRead.has(sender)) {
        const { data: conv } = await sb
          .from('social_conversations')
          .select('id')
          .eq('organization_id', orgId)
          .eq('platform', platform)
          .eq('external_thread_id', buildDmThreadId(platform, guestIdForRead))
          .maybeSingle();
        const conversationId = (conv as { id?: string } | null)?.id;
        if (conversationId) {
          const { error: hostReadError } = await sb.rpc('inbox_mark_host_read', {
            p_organization_id: orgId,
            p_conversation_id: conversationId,
            p_read_at: event.eventTime,
          });
          if (hostReadError) throw new Error(hostReadError.message);
        }
        return { status: 'skipped', result: { reason: 'host_read_elsewhere' } };
      }

      const { error } = await sb.rpc('inbox_apply_meta_read', {
        p_organization_id: orgId,
        p_platform: platform,
        p_external_thread_id: buildDmThreadId(platform, guestIdForRead),
        p_read_at:
          typeof watermark === 'number'
            ? new Date(watermark < 1e12 ? watermark * 1000 : watermark).toISOString()
            : new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return { status: 'done' };
    }

    case 'seen': {
      // `classifyMetaEvent` maps both Instagram `seen.mid` and a mid-shaped read receipt
      // to `seen`, so either key may carry it.
      const seenMid =
        asString(asRecord(event.payload.seen).mid) || asString(asRecord(event.payload.read).mid);
      if (!seenMid) return { status: 'skipped', result: { reason: 'no_mid' } };
      const { error } = await sb.rpc('inbox_apply_meta_seen', {
        p_organization_id: orgId,
        p_external_message_id: seenMid,
        p_read_at: event.eventTime,
      });
      if (error) throw new Error(error.message);
      return { status: 'done' };
    }

    case 'reaction': {
      const mid = asString(asRecord(event.payload.message).mid);
      if (!mid) return { status: 'skipped', result: { reason: 'no_mid' } };
      const reaction = asRecord(event.payload.reaction);
      const emoji = asString(reaction.emoji);
      const action = asString(reaction.action) || 'react';
      const { error } = await sb.rpc('inbox_apply_meta_reaction', {
        p_organization_id: orgId,
        p_external_message_id: mid,
        p_reactions: action === 'unreact' || !emoji ? {} : { [emoji]: 1 },
      });
      if (error) throw new Error(error.message);
      return { status: 'done' };
    }

    case 'edit': {
      const source = asRecord(event.payload.edited_message ?? event.payload.message_edit);
      const mid = asString(source.mid);
      const text = asString(source.text) || asString(asRecord(event.payload.message).text);
      if (!mid) return { status: 'skipped', result: { reason: 'no_mid' } };
      const { error } = await sb.rpc('inbox_apply_meta_edit', {
        p_organization_id: orgId,
        p_external_message_id: mid,
        p_body_text: text,
        p_edited_at: event.eventTime,
      });
      if (error) throw new Error(error.message);
      return { status: 'done' };
    }

    case 'unsend': {
      const mid = asString(asRecord(event.payload.message).mid);
      if (!mid) return { status: 'skipped', result: { reason: 'no_mid' } };
      const { error } = await sb.rpc('inbox_apply_meta_unsend', {
        p_organization_id: orgId,
        p_external_message_id: mid,
      });
      if (error) throw new Error(error.message);
      return { status: 'done' };
    }

    case 'postback':
    case 'message':
    case 'echo':
    case 'unsupported': {
      return applyMetaMessageEvent(event, connection, opts);
    }

    case 'referral': {
      // Where the guest came from: an ad, an m.me link, or a post. Stored on the thread for
      // attribution; nothing in the thread renders it yet.
      const sender = asString(asRecord(event.payload.sender).id);
      const selfIds = metaSelfAccountIds(connection, event.entryId);
      const guestId = selfIds.has(sender) ? asString(asRecord(event.payload.recipient).id) : sender;
      if (!guestId) return { status: 'skipped', result: { reason: 'no_participant' } };
      const { error } = await sb.rpc('inbox_apply_meta_referral', {
        p_organization_id: orgId,
        p_platform: platform,
        p_external_thread_id: buildDmThreadId(platform, guestId),
        p_referral: (event.payload.referral as Record<string, unknown>) ?? null,
      });
      if (error) throw new Error(error.message);
      return { status: 'done' };
    }

    case 'delivery':
    case 'handover':
      // Subscribed for completeness. Nothing in the thread renders these yet.
      return { status: 'skipped', result: { reason: `ignored_${event.eventType}` } };

    default:
      return { status: 'skipped', result: { reason: 'unhandled_type' } };
  }
}

/**
 * Which display kind a Meta message is.
 *
 * Story replies, shared posts and stickers arrive as attachments with a Meta type, not as
 * text. Naming them lets the thread show a card instead of a bare "(attachment)".
 */
function messageKindFor(
  message: Record<string, unknown>,
  isPostback: boolean,
  eventType: string
): 'text' | 'postback' | 'unsupported' | 'story_reply' | 'share' {
  if (isPostback) return 'postback';
  if (eventType === 'unsupported') return 'unsupported';

  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const types = attachments
    .map((item) => asString(asRecord(item).type))
    .filter(Boolean);
  if (types.includes('story_mention')) return 'story_reply';
  if (types.includes('share')) return 'share';
  // A message with a body is still readable text even when Meta also marks it unsupported.
  if (types.includes('fallback') && !asString(message.text)) return 'unsupported';
  return 'text';
}

async function applyMetaMessageEvent(
  event: MetaNormalizedEvent,
  connection: SocialChannelConnectionRow,
  opts: { unreadDelta?: 0 | 1; source?: 'webhook' | 'reconcile' | 'import' }
): Promise<Outcome> {
  const sb = socialInboxDb();
  const orgId = connection.organization_id;
  const platform = event.platform;
  const payload = event.payload;

  const senderId = asString(asRecord(payload.sender).id);
  const selfIds = metaSelfAccountIds(connection, event.entryId);
  const isEcho = event.eventType === 'echo' || asRecord(payload.message).is_echo === true;
  const isFromPage = isEcho || selfIds.has(senderId);
  const guestId = isFromPage
    ? asString(asRecord(payload.recipient).id)
    : senderId;

  if (!guestId) {
    return { status: 'skipped', result: { reason: 'no_participant' } };
  }

  const threadId = buildDmThreadId(platform, guestId);

  // Postbacks are guest taps on an ice breaker or Get Started. They are stored as a guest
  // message so the thread shows why the conversation started.
  const postback = asRecord(payload.postback);
  const message = asRecord(payload.message);
  const isPostback = event.eventType === 'postback';
  const externalMessageId = isPostback
    ? asString(message.mid) || `pb:${event.eventKey}`
    : asString(message.mid);
  if (!externalMessageId) {
    return { status: 'skipped', result: { reason: 'no_mid' } };
  }

  const postbackTitle = asString(postback.title);
  const postbackPayload = asString(postback.payload);
  const bodyText = isPostback
    ? postbackTitle || postbackPayload || 'Started the conversation'
    : asString(message.text);
  const preview = bodyText || '(attachment)';

  const identity = await resolveParticipantIdentity(connection, guestId, platform, isFromPage);

  const { data, error } = await sb.rpc('inbox_apply_meta_message', {
    p: {
      organization_id: orgId,
      connection_id: connection.id,
      platform,
      external_thread_id: threadId,
      external_participant_id: guestId,
      participant_name: identity.name,
      participant_avatar_url: identity.avatarUrl,
      direction: isFromPage ? 'outbound' : 'inbound',
      external_message_id: externalMessageId,
      body_text: bodyText || null,
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
      sent_at: event.eventTime,
      message_kind: messageKindFor(message, isPostback, event.eventType),
      source: opts.source ?? 'webhook',
      sender_app: isFromPage ? (isEcho ? 'kame' : 'other') : null,
      routing: event.channel,
      subject_preview: preview.slice(0, 500),
      messaging_window_expires_at: isFromPage ? null : metaMessagingWindowExpiry(event.eventTime),
      unread_delta: opts.unreadDelta ?? 1,
    },
  });
  if (error) throw new Error(error.message);

  const applied = (data ?? {}) as {
    conversation_id?: string;
    inserted?: boolean;
    conversation_created?: boolean;
  };

  // Side effects only for a message that was actually stored now.
  if (applied.inserted && !isFromPage && applied.conversation_id) {
    await notifyInboundGuestMessage({
      orgId,
      conversationId: applied.conversation_id,
      text: bodyText,
      preview,
      sentAt: event.eventTime,
    });
  }

  return {
    status: 'done',
    result: {
      inserted: Boolean(applied.inserted),
      conversation_id: applied.conversation_id ?? null,
      conversation_created: Boolean(applied.conversation_created),
      outbound: isFromPage,
    },
  };
}

/**
 * Guest display name and avatar for a new thread.
 *
 * Only fetched when the thread has no name yet, and never before the acknowledgement: this
 * runs in the background task, not on the webhook request.
 */
async function resolveParticipantIdentity(
  connection: SocialChannelConnectionRow,
  guestId: string,
  platform: MetaMessagingPlatform,
  isFromPage: boolean
): Promise<{ name: string | null; avatarUrl: string | null }> {
  if (isFromPage) return { name: null, avatarUrl: null };

  try {
    const token = await getPageAccessToken(connection);
    const profile = await fetchMetaMessengerParticipantProfile(guestId, token, platform);
    return {
      name: formatMetaParticipantDisplayName({ name: profile.name }) ?? null,
      avatarUrl: profile.profilePic ?? null,
    };
  } catch {
    return { name: null, avatarUrl: null };
  }
}

async function notifyInboundGuestMessage(opts: {
  orgId: string;
  conversationId: string;
  text: string;
  preview: string;
  sentAt: string;
}): Promise<void> {
  const sb = socialInboxDb();
  const { data } = await sb
    .from('social_conversations')
    .select('*')
    .eq('id', opts.conversationId)
    .maybeSingle();
  if (!data) return;

  try {
    const { notifyTelegramChatInbound } = await import('./telegramChat.ts');
    await notifyTelegramChatInbound({
      conversation: data as never,
      text: opts.text || null,
      attachments: [],
      sentAt: opts.sentAt,
    });
  } catch (e) {
    console.warn('[metaInboxProcessor] telegram notify:', e);
  }

  try {
    const conversation = data as { participant_name?: string | null; conversation_type?: string };
    await createOrCoalesceNotification({
      organizationId: opts.orgId,
      propertyId: (data as { property_id?: string | null }).property_id ?? null,
      parkingId: (data as { parking_id?: string | null }).parking_id ?? null,
      type: 'inbox_new_message',
      title: inboxNotificationParticipantLabel(
        conversation.participant_name ?? null,
        (conversation.conversation_type ?? 'dm') as 'dm' | 'comment'
      ),
      body: opts.preview.slice(0, 200),
      conversationId: opts.conversationId,
      metadata: inboxNotificationMetadata(data as never),
      dedupeKey: `${opts.conversationId}:inbox_new_message`,
    });
  } catch (e) {
    console.warn('[metaInboxProcessor] notification create:', e);
  }
}
