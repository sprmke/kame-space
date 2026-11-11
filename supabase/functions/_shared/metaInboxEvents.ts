/**
 * Pure parsers for Meta webhook payloads.
 *
 * The webhook acknowledgement must not do any work, so everything here is synchronous and
 * side-effect free: it turns a signed payload into one normalized row per event, each with
 * a stable key so a retried batch is a no-op. The processor does the writing.
 */

import { normalizeMetaWebhookTimestamp } from './metaTimestamp.ts';

export type MetaMessagingPlatform = 'facebook' | 'instagram';

export type MetaEventChannel = 'messaging' | 'standby';

export type MetaNormalizedEventType =
  | 'message'
  | 'echo'
  | 'read'
  | 'seen'
  | 'postback'
  | 'reaction'
  | 'edit'
  | 'unsend'
  | 'handover'
  | 'referral'
  | 'delivery'
  | 'unsupported';

/** The raw `entry.messaging[]` item, kept verbatim so the parser can be re-run later. */
export type MetaRawMessagingEvent = Record<string, unknown>;

export type MetaNormalizedEvent = {
  object: string;
  platform: MetaMessagingPlatform;
  entryId: string;
  channel: MetaEventChannel;
  eventType: MetaNormalizedEventType;
  eventKey: string;
  /** Meta's own event timestamp, normalized to ISO. Used for ordering, never `received_at`. */
  eventTime: string;
  payload: MetaRawMessagingEvent;
};

/** Platform from the webhook `object` field. `null` when the object is not a messaging one. */
export function platformFromMetaObject(object: string | undefined): MetaMessagingPlatform | null {
  if (object === 'page') return 'facebook';
  if (object === 'instagram') return 'instagram';
  return null;
}

/** FNV-1a. Only used to make a postback payload hash stable and short. */
function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

type RawMessage = {
  mid?: string;
  is_echo?: boolean;
  is_deleted?: boolean;
  text?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function senderIdOf(event: Record<string, unknown>): string {
  return String(asRecord(event.sender).id ?? '');
}

function timestampOf(event: Record<string, unknown>): number | null {
  const raw = event.timestamp;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function eventTimeOf(event: Record<string, unknown>): string {
  const ts = timestampOf(event);
  return ts === null ? new Date().toISOString() : normalizeMetaWebhookTimestamp(ts);
}

/**
 * Classify one `entry.messaging[]` item.
 *
 * Order matters: `read` and `seen` are not messages, a deleted message is an unsend, and an
 * echo is still a message. Anything unrecognized is kept as `unsupported` rather than
 * dropped, so a new Meta event type shows up in the outbox instead of vanishing.
 */
export function classifyMetaEvent(
  entryId: string,
  event: Record<string, unknown>,
  channel: MetaEventChannel
): { eventType: MetaNormalizedEventType; eventKey: string } | null {
  const sender = senderIdOf(event);
  const ts = timestampOf(event);
  const tsPart = ts === null ? '0' : String(ts);
  const message = asRecord(event.message) as RawMessage;
  const mid = message.mid?.trim();

  if (asRecord(event.read).watermark !== undefined || asRecord(event.read).mid !== undefined) {
    if (!sender) return null;
    const watermark = asRecord(event.read).watermark;
    if (typeof watermark === 'number') {
      return { eventType: 'read', eventKey: `read:${entryId}:${sender}:${watermark}` };
    }
    // Instagram read receipts carry a mid instead of a watermark.
    const readMid = String(asRecord(event.read).mid ?? '').trim();
    return readMid ? { eventType: 'seen', eventKey: `seen:${readMid}` } : null;
  }

  if (message.is_deleted === true) {
    if (!mid) return null;
    return { eventType: 'unsend', eventKey: `del:${mid}` };
  }

  if (mid) {
    if (message.is_echo) return { eventType: 'echo', eventKey: `msg:${mid}` };
    if (event.message !== undefined) return { eventType: 'message', eventKey: `msg:${mid}` };
  }

  if (event.postback !== undefined) {
    if (mid) return { eventType: 'postback', eventKey: `msg:${mid}` };
    if (!sender) return null;
    const hash = stableHash(JSON.stringify(event.postback ?? {}));
    return { eventType: 'postback', eventKey: `pb:${sender}:${tsPart}:${hash}` };
  }

  const seen = asRecord(event.seen);
  if (seen.mid !== undefined) {
    const seenMid = String(seen.mid).trim();
    return seenMid ? { eventType: 'seen', eventKey: `seen:${seenMid}` } : null;
  }

  if (event.reaction !== undefined) {
    // A reaction names the message in `reaction.mid`, not in `message.mid`.
    const reaction = asRecord(event.reaction);
    const reactionMid = String(reaction.mid ?? '').trim();
    if (!reactionMid) return null;
    const action = String(reaction.action ?? 'react');
    const emoji = String(reaction.emoji ?? reaction.reaction ?? '');
    return {
      eventType: 'reaction',
      eventKey: `react:${reactionMid}:${sender}:${action}:${emoji}:${tsPart}`,
    };
  }

  if (event.edited_message !== undefined || event.message_edit !== undefined) {
    // Same for an edit: the mid lives on the edited payload.
    const editSource = asRecord(event.edited_message ?? event.message_edit);
    const editMid = String(editSource.mid ?? '').trim();
    if (!editMid) return null;
    return { eventType: 'edit', eventKey: `edit:${editMid}:${tsPart}` };
  }

  if (event.pass_thread_control !== undefined || event.take_thread_control !== undefined) {
    if (!sender) return null;
    return { eventType: 'handover', eventKey: `hand:${entryId}:${sender}:${tsPart}` };
  }

  if (event.referral !== undefined) {
    if (!sender) return null;
    return { eventType: 'referral', eventKey: `ref:${entryId}:${sender}:${tsPart}` };
  }

  if (event.delivery !== undefined) {
    if (!sender) return null;
    return { eventType: 'delivery', eventKey: `deliv:${entryId}:${sender}:${tsPart}` };
  }

  if (event.message !== undefined) {
    // A message without a mid cannot be deduped by id, but it is still worth keeping.
    if (!sender) return null;
    return {
      eventType: 'unsupported',
      eventKey: `unsup:${sender}:${tsPart}:${stableHash(JSON.stringify(event.message ?? {}))}`,
    };
  }

  return null;
}

/**
 * Flatten a verified webhook body into one row per event.
 *
 * `entry.messaging[]` and `entry.standby[]` are both read. A message that arrives on both
 * channels shares `msg:<mid>` and is therefore stored once.
 */
export function flattenMetaWebhookPayload(
  payload: { object?: string; entry?: unknown[] },
  platform: MetaMessagingPlatform
): { events: MetaNormalizedEvent[]; skipped: number } {
  const events: MetaNormalizedEvent[] = [];
  let skipped = 0;
  const object = payload.object ?? '';

  for (const rawEntry of payload.entry ?? []) {
    const entry = asRecord(rawEntry);
    const entryId = String(entry.id ?? '').trim();
    if (!entryId) {
      skipped += 1;
      continue;
    }

    const channels: MetaEventChannel[] = ['messaging', 'standby'];
    for (const channel of channels) {
      const items = entry[channel];
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const event = asRecord(item);
        const classified = classifyMetaEvent(entryId, event, channel);
        if (!classified) {
          skipped += 1;
          continue;
        }
        events.push({
          object,
          platform,
          entryId,
          channel,
          eventType: classified.eventType,
          eventKey: classified.eventKey,
          eventTime: eventTimeOf(event),
          payload: event,
        });
      }
    }
  }

  return { events, skipped };
}
