/**
 * Postgres helpers for org-scoped social inbox data.
 */

import { aiHandoffColumns, type AiHandoffPatch } from './aiHandoff.ts';
import { socialInboxDb, upsertChannelConnection } from './socialInboxDb.ts';
import type {
  ConversationType,
  InboxThreadFilter,
  SocialChannelConnectionRow,
  SocialConversationRow,
  SocialMessageRow,
  SocialPlatform,
} from './socialInboxTypes.ts';

export { socialInboxDb, upsertChannelConnection };

export async function ensureSocialInboxSettings(
  orgId: string,
  parkingId: string | null = null
): Promise<void> {
  const sb = socialInboxDb();
  let query = sb
    .from('social_inbox_settings')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);
  query = parkingId ? query.eq('parking_id', parkingId) : query.is('parking_id', null);
  const { count } = await query;
  if ((count ?? 0) > 0) return;

  await sb.from('social_inbox_settings').insert({ organization_id: orgId, parking_id: parkingId });
}

export async function listChannelConnections(orgId: string): Promise<SocialChannelConnectionRow[]> {
  const sb = socialInboxDb();
  const { data, error } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('organization_id', orgId)
    .order('platform', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SocialChannelConnectionRow[];
}

/** Deletes inbox threads for disconnected Meta channels (`social_messages` cascade). */
export async function deleteConversationsForConnections(connectionIds: string[]): Promise<number> {
  if (!connectionIds.length) return 0;
  const sb = socialInboxDb();
  const { error, count } = await sb
    .from('social_conversations')
    .delete({ count: 'exact' })
    .in('connection_id', connectionIds);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getConnectionByMetaPageId(
  metaPageId: string
): Promise<SocialChannelConnectionRow | null> {
  return getConnectionForMetaWebhook(metaPageId, 'facebook');
}

/** Resolve a connected Meta channel row from webhook `entry.id` (Page id or IG business account id). */
export async function getConnectionForMetaWebhook(
  entryId: string,
  platform: 'facebook' | 'instagram'
): Promise<SocialChannelConnectionRow | null> {
  const sb = socialInboxDb();
  if (platform === 'instagram') {
    const { data, error } = await sb
      .from('social_channel_connections')
      .select('*')
      .eq('platform', 'instagram')
      .eq('status', 'connected')
      .or(`meta_ig_user_id.eq.${entryId},external_account_id.eq.${entryId}`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as SocialChannelConnectionRow;

    const { data: byPage, error: pageError } = await sb
      .from('social_channel_connections')
      .select('*')
      .eq('platform', 'instagram')
      .eq('status', 'connected')
      .eq('meta_page_id', entryId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pageError) throw new Error(pageError.message);
    return (byPage as SocialChannelConnectionRow | null) ?? null;
  }

  const { data, error } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('meta_page_id', entryId)
    .eq('platform', 'facebook')
    .eq('status', 'connected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SocialChannelConnectionRow | null) ?? null;
}

function applyInboxScopeFilters(
  // deno-lint-ignore no-explicit-any
  q: any,
  filter: InboxThreadFilter
  // deno-lint-ignore no-explicit-any
): any {
  const propertyId = filter.propertyId ?? null;
  const parkingId = filter.parkingId ?? null;
  const metaIds = filter.metaConnectionIds ?? null;

  if (!propertyId && !parkingId) {
    return q;
  }

  const platform = filter.platform ?? 'all';

  if (platform === 'web') {
    if (propertyId) return q.eq('property_id', propertyId);
    if (parkingId) return q.eq('parking_id', parkingId);
    return q;
  }

  if (
    platform === 'facebook' ||
    platform === 'instagram' ||
    platform === 'tiktok' ||
    platform === 'airbnb'
  ) {
    if (metaIds?.length) return q.in('connection_id', metaIds);
    // No Meta connection for this scope — force empty
    return q.eq('id', '00000000-0000-0000-0000-000000000000');
  }

  // platform === 'all': web scoped OR meta on effective connection ids
  const orParts: string[] = [];
  if (propertyId) {
    orParts.push(`and(platform.eq.web,property_id.eq.${propertyId})`);
  } else if (parkingId) {
    orParts.push(`and(platform.eq.web,parking_id.eq.${parkingId})`);
  }
  if (metaIds?.length) {
    orParts.push(`connection_id.in.(${metaIds.join(',')})`);
  }
  if (!orParts.length) {
    return q.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  return q.or(orParts.join(','));
}

export async function listConversations(
  orgId: string,
  filter: InboxThreadFilter
): Promise<{ conversations: SocialConversationRow[]; nextCursor: string | null }> {
  const sb = socialInboxDb();
  const limit = Math.min(Math.max(filter.limit ?? INBOX_THREAD_PAGE_SIZE, 1), 100);
  let q = sb
    .from('social_conversations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('conversation_type', 'dm')
    .order('last_message_at', { ascending: false })
    .limit(limit + 1);

  if (filter.platform && filter.platform !== 'all') {
    q = q.eq('platform', filter.platform);
  }
  if (filter.status === 'unread') {
    q = q.gt('unread_count', 0);
  } else if (filter.status === 'pending') {
    q = q.eq('reply_status', 'pending');
  } else if (filter.status === 'replied') {
    q = q.eq('reply_status', 'replied');
  }
  if (filter.search?.trim()) {
    const term = `%${filter.search.trim()}%`;
    q = q.or(`participant_name.ilike.${term},subject_preview.ilike.${term}`);
  }
  if (filter.cursor) {
    q = q.lt('last_message_at', filter.cursor);
  }

  q = applyInboxScopeFilters(q, filter);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SocialConversationRow[];
  const hasMore = rows.length > limit;
  const conversations = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? (conversations[conversations.length - 1]?.last_message_at ?? null)
    : null;
  return { conversations, nextCursor };
}

export async function getConversationById(
  orgId: string,
  conversationId: string
): Promise<SocialConversationRow | null> {
  const sb = socialInboxDb();
  const { data } = await sb
    .from('social_conversations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', conversationId)
    .maybeSingle();
  return (data as SocialConversationRow | null) ?? null;
}

export async function attachConversationConnectionStatus(
  conversations: SocialConversationRow[]
): Promise<SocialConversationRow[]> {
  if (!conversations.length) return conversations;

  const connectionIds = [...new Set(conversations.map((row) => row.connection_id).filter(Boolean))];
  if (!connectionIds.length) return conversations;

  const sb = socialInboxDb();
  const { data, error } = await sb
    .from('social_channel_connections')
    .select('id,status')
    .in('id', connectionIds);
  if (error) throw new Error(error.message);

  const statusById = new Map<string, string>();
  for (const row of data ?? []) {
    statusById.set(String(row.id), String(row.status));
  }

  return conversations.map((conversation) => ({
    ...conversation,
    connection_status:
      (statusById.get(conversation.connection_id) as SocialConversationRow['connection_status']) ??
      null,
  }));
}

/** Canonical DM thread key — must match webhook + backfill. */
export function buildDmThreadId(platform: SocialPlatform, participantId: string): string {
  return `${platform}:${participantId}`;
}

/**
 * The account's own Meta ids.
 *
 * A message from any of them is an outbound message. Instagram replies sent from the
 * Instagram app carry the Instagram business account id, not the Facebook Page id, so
 * comparing against the Page id alone files them as guest messages.
 */
export function metaSelfAccountIds(
  connection: SocialChannelConnectionRow,
  pageId?: string | null
): Set<string> {
  return new Set(
    [
      pageId,
      connection.meta_page_id,
      connection.meta_ig_user_id,
      connection.external_account_id,
    ].filter((id): id is string => Boolean(id?.trim()))
  );
}

export async function findDmConversationByParticipant(
  orgId: string,
  platform: SocialPlatform,
  participantId: string
): Promise<SocialConversationRow | null> {
  const sb = socialInboxDb();
  const { data } = await sb
    .from('social_conversations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('platform', platform)
    .eq('conversation_type', 'dm')
    .eq('external_participant_id', participantId)
    .maybeSingle();
  return (data as SocialConversationRow | null) ?? null;
}

/** Re-key legacy backfill rows (Meta conv id) to platform:participantId. */
export async function migrateLegacyDmThreadId(
  orgId: string,
  platform: SocialPlatform,
  participantId: string,
  canonicalThreadId: string,
  legacyMetaConvId?: string
): Promise<void> {
  const sb = socialInboxDb();
  const existing = await findDmConversationByParticipant(orgId, platform, participantId);
  if (existing && existing.external_thread_id !== canonicalThreadId) {
    await sb
      .from('social_conversations')
      .update({ external_thread_id: canonicalThreadId, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return;
  }
  if (!legacyMetaConvId || legacyMetaConvId === canonicalThreadId) return;
  const legacy = await getConversationByExternalThread(orgId, platform, legacyMetaConvId);
  if (legacy && legacy.external_thread_id !== canonicalThreadId) {
    await sb
      .from('social_conversations')
      .update({
        external_thread_id: canonicalThreadId,
        external_participant_id: participantId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', legacy.id);
  }
}

export async function getConversationByExternalThread(
  orgId: string,
  platform: SocialPlatform,
  externalThreadId: string
): Promise<SocialConversationRow | null> {
  const sb = socialInboxDb();
  const { data, error } = await sb
    .from('social_conversations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('platform', platform)
    .eq('external_thread_id', externalThreadId)
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return (row as SocialConversationRow | undefined) ?? null;
}

const UPSERT_PRESERVE_NULL_FIELDS = [
  'participant_name',
  'external_participant_id',
  'participant_avatar_url',
  'linked_post_id',
  'linked_post_url',
] as const;

function buildConversationUpdatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const update = { ...payload };
  for (const key of UPSERT_PRESERVE_NULL_FIELDS) {
    if (update[key] == null) delete update[key];
  }
  return update;
}

/**
 * Insert or update a conversation.
 *
 * `opts.insertOnly` fields are written when the row is created and left alone on update.
 * The summary fields belong there: `last_message_at` is set on create so a freshly
 * imported old thread is not dated "now", and it is never written on update so a late
 * event cannot rewind a thread. `inbox_bump_conversation` owns the forward-only rule.
 */
export async function upsertConversation(
  fields: Partial<SocialConversationRow> & {
    organization_id: string;
    connection_id: string;
    platform: SocialPlatform;
    external_thread_id: string;
    conversation_type: ConversationType;
  },
  opts?: { insertOnly?: Partial<SocialConversationRow> }
): Promise<SocialConversationRow> {
  const sb = socialInboxDb();
  const payload = { ...fields, updated_at: new Date().toISOString() };
  const insertOnly = opts?.insertOnly ?? {};

  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = await getConversationByExternalThread(
      fields.organization_id,
      fields.platform,
      fields.external_thread_id
    );
    if (existing) {
      const updatePayload = buildConversationUpdatePayload(payload);
      for (const key of Object.keys(insertOnly)) delete updatePayload[key];
      const { error } = await sb
        .from('social_conversations')
        .update(updatePayload)
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
      return { ...existing, ...updatePayload } as SocialConversationRow;
    }

    const { error: insertError } = await sb
      .from('social_conversations')
      .insert({ ...payload, ...insertOnly });
    if (!insertError) {
      const created = await getConversationByExternalThread(
        fields.organization_id,
        fields.platform,
        fields.external_thread_id
      );
      if (created) return created;
    } else if (insertError.code !== '23505') {
      throw new Error(insertError.message);
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }

  throw new Error('Failed to upsert conversation');
}

export async function listMessages(
  orgId: string,
  conversationId: string,
  opts?: { before?: string; limit?: number }
): Promise<{ messages: SocialMessageRow[]; hasMore: boolean }> {
  const sb = socialInboxDb();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  let q = sb
    .from('social_messages')
    .select('*')
    .eq('organization_id', orgId)
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: false })
    .limit(limit + 1);
  if (opts?.before) {
    q = q.lt('sent_at', opts.before);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SocialMessageRow[];
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return { messages: slice.reverse(), hasMore };
}

const ATTACHMENT_ENRICH_LIMIT = 12;

/** Backfill attachment metadata from Graph for media-only messages stored without URLs. */
export async function enrichConversationMessageAttachments(
  conv: SocialConversationRow,
  messages: SocialMessageRow[]
): Promise<SocialMessageRow[]> {
  const { messageNeedsAttachmentEnrichment } = await import('./inboxAttachments.ts');
  const { fetchMetaMessageAttachments, getPageAccessToken } = await import('./metaInboxGraph.ts');

  const needs = messages.filter((m) => messageNeedsAttachmentEnrichment(m));
  if (!needs.length) return messages;

  const sb = socialInboxDb();
  const { data: connRow } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('id', conv.connection_id)
    .maybeSingle();
  if (!connRow?.encrypted_access_token) return messages;

  let token: string;
  try {
    token = await getPageAccessToken(connRow as SocialChannelConnectionRow);
  } catch {
    return messages;
  }

  const updates = new Map<string, SocialMessageRow>();
  for (const msg of needs.slice(0, ATTACHMENT_ENRICH_LIMIT)) {
    const attachments = await fetchMetaMessageAttachments(msg.external_message_id, token);
    if (!attachments.length) continue;
    const { error } = await sb.from('social_messages').update({ attachments }).eq('id', msg.id);
    if (!error) updates.set(msg.id, { ...msg, attachments });
  }

  return messages.map((m) => updates.get(m.id) ?? m);
}

/** Fill Instagram/Facebook DM display name when webhook stored the thread as Guest. */
export async function fillMissingMetaParticipantIdentity(
  conv: SocialConversationRow
): Promise<SocialConversationRow> {
  if (conv.participant_name?.trim()) return conv;
  if (conv.conversation_type !== 'dm') return conv;
  if (conv.platform !== 'facebook' && conv.platform !== 'instagram') return conv;
  const guestId = conv.external_participant_id?.trim();
  if (!guestId) return conv;

  const { fetchMetaMessengerParticipantProfile, getPageAccessToken } =
    await import('./metaInboxGraph.ts');
  const sb = socialInboxDb();
  const { data: connRow } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('id', conv.connection_id)
    .maybeSingle();
  if (!connRow?.encrypted_access_token) return conv;

  let token: string;
  try {
    token = await getPageAccessToken(connRow as SocialChannelConnectionRow);
  } catch {
    return conv;
  }

  const profile = await fetchMetaMessengerParticipantProfile(guestId, token, conv.platform);
  if (!profile.name && !profile.profilePic) return conv;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (profile.name) patch.participant_name = profile.name;
  if (profile.profilePic) patch.participant_avatar_url = profile.profilePic;
  const { error } = await sb.from('social_conversations').update(patch).eq('id', conv.id);
  if (error) {
    console.warn('[fillMissingMetaParticipantIdentity]', error.message);
    return conv;
  }
  return { ...conv, ...patch } as SocialConversationRow;
}

/**
 * Insert a message unless its Meta message id is already stored.
 *
 * Returns the inserted row, or `null` when the message was already there. Callers use that
 * to fire side effects only for a newly arrived message: a redelivered Meta event must not
 * notify twice.
 */
export async function insertMessageIfNew(
  fields: Omit<SocialMessageRow, 'id' | 'created_at'>
): Promise<SocialMessageRow | null> {
  const sb = socialInboxDb();
  const { data: existingRows, error: readError } = await sb
    .from('social_messages')
    .select('id')
    .eq('external_message_id', fields.external_message_id)
    .limit(1);
  if (readError) throw new Error(readError.message);
  if (existingRows?.[0]) return null;

  const { data, error } = await sb.from('social_messages').insert(fields).select('*').maybeSingle();
  if (error) {
    // Another delivery of the same Meta event won the race. The unique index on
    // external_message_id is the real guard, so a duplicate is not an error.
    if (error.code === '23505') return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  void import('./inboxThreadMetrics.ts')
    .then(({ recordInboxMessageForMetrics }) =>
      recordInboxMessageForMetrics({
        organization_id: fields.organization_id,
        conversation_id: fields.conversation_id,
        direction: fields.direction,
        sent_at: fields.sent_at,
      })
    )
    .catch((err) => console.warn('[insertMessageIfNew] superhost metrics:', err));

  return data as SocialMessageRow;
}

/** Outbound Meta send that is written before the network call. */
export type OutboundMetaSendRow = {
  organizationId: string;
  conversationId: string;
  clientMessageId: string;
  bodyText: string;
  sentAt: string;
  sentByUserId: string | null;
  isAiGenerated: boolean;
  messageTag: 'human_agent' | null;
  replyToMessageId?: string | null;
  replyPreviewText?: string | null;
  templateSnapshot?: unknown | null;
};

/** Synthetic id used until Meta returns the real message id. Never collides with a mid. */
export function pendingMetaExternalId(clientMessageId: string): string {
  return `kame:${clientMessageId}`;
}

/**
 * Write the outbound row before calling the Send API.
 *
 * The thread shows the message immediately, and a crash after Meta accepted it leaves a row
 * to reconcile instead of a message the host cannot see. `client_message_id` is unique, so a
 * retried send cannot insert twice.
 */
export async function beginOutboundMetaSend(row: OutboundMetaSendRow): Promise<void> {
  const sb = socialInboxDb();
  const { error } = await sb.from('social_messages').insert({
    organization_id: row.organizationId,
    conversation_id: row.conversationId,
    direction: 'outbound',
    external_message_id: pendingMetaExternalId(row.clientMessageId),
    client_message_id: row.clientMessageId,
    body_text: row.bodyText || null,
    attachments: [],
    sent_at: row.sentAt,
    delivery_status: 'sending',
    sent_by_user_id: row.sentByUserId,
    is_ai_generated: row.isAiGenerated,
    message_tag: row.messageTag,
    reply_to_message_id: row.replyToMessageId ?? null,
    reply_preview_text: row.replyPreviewText ?? null,
    template_snapshot: row.templateSnapshot ?? null,
    message_kind: 'text',
    source: 'kame_send',
    sender_app: 'kame',
    routing: 'messaging',
  });
  // 23505 means this composer submit was already recorded. Not an error.
  if (error && error.code !== '23505') throw new Error(error.message);
}

/**
 * Attach Meta's message id to the row that was written before the send.
 *
 * If Meta's echo landed first it already stored this mid, so the metadata is merged onto the
 * echo row and the placeholder is dropped. Either order ends with one row.
 */
export async function completeOutboundMetaSend(
  row: OutboundMetaSendRow,
  externalMessageId: string
): Promise<void> {
  const sb = socialInboxDb();
  const { error } = await sb
    .from('social_messages')
    .update({ external_message_id: externalMessageId, delivery_status: 'sent' })
    .eq('client_message_id', row.clientMessageId);
  if (!error) return;
  if (error.code !== '23505') throw new Error(error.message);

  const { error: mergeError } = await sb.rpc('inbox_apply_meta_message', {
    p: {
      organization_id: row.organizationId,
      connection_id: null,
      platform: 'facebook',
      external_thread_id: null,
      direction: 'outbound',
      external_message_id: externalMessageId,
      sent_at: row.sentAt,
      body_text: row.bodyText || null,
      sent_by_user_id: row.sentByUserId,
      is_ai_generated: String(row.isAiGenerated),
      message_tag: row.messageTag,
      reply_to_message_id: row.replyToMessageId ?? null,
      reply_preview_text: row.replyPreviewText ?? null,
      template_snapshot: row.templateSnapshot ?? null,
      source: 'kame_send',
      sender_app: 'kame',
    },
  });
  // The merge is best effort: the echo row already holds the message.
  if (mergeError) console.warn('[completeOutboundMetaSend] merge:', mergeError.message);

  const { error: deleteError } = await sb
    .from('social_messages')
    .delete()
    .eq('client_message_id', row.clientMessageId)
    .like('external_message_id', 'kame:%');
  if (deleteError) console.warn('[completeOutboundMetaSend] placeholder cleanup:', deleteError.message);
}

/** Mark a send that Meta did not accept. The thread shows "Not sent" with a Retry action. */
export async function failOutboundMetaSend(
  clientMessageId: string,
  errorCode: string | null
): Promise<void> {
  const sb = socialInboxDb();
  const { error } = await sb
    .from('social_messages')
    .update({ delivery_status: 'failed', send_error_code: errorCode })
    .eq('client_message_id', clientMessageId);
  if (error) console.warn('[failOutboundMetaSend]', error.message);
}

/**
 * Flag a Meta connection whose Page token Meta no longer accepts.
 *
 * The Facebook and Instagram rows for one Page share the same token, so both are flagged.
 */
export async function markMetaConnectionTokenInvalid(
  connection: SocialChannelConnectionRow
): Promise<void> {
  if (!connection.meta_page_id) return;
  const sb = socialInboxDb();
  const { error } = await sb
    .from('social_channel_connections')
    .update({
      status: 'error',
      error_message: 'Meta session expired. Reconnect Facebook in Channels.',
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', connection.organization_id)
    .eq('meta_page_id', connection.meta_page_id)
    .in('status', ['connected', 'pending']);
  if (error) console.warn('[markMetaConnectionTokenInvalid]', error.message);
}

export async function markConversationRead(orgId: string, conversationId: string): Promise<void> {
  const { markHostConversationRead } = await import('./chatMessageLifecycle.ts');
  await markHostConversationRead(orgId, conversationId);
}

/**
 * Move a conversation's summary forward after a message.
 *
 * The summary lives in the `inbox_bump_conversation` database function so it only ever moves
 * forward: `last_message_at` is the newest message, the preview and reply status belong to
 * the newest message, and the unread badge is an atomic increment instead of a reset
 * followed by an add. Meta does not guarantee event order, so an older event arriving late
 * must not rewind a thread.
 */
export async function updateConversationAfterMessage(
  conversationId: string,
  patch: {
    direction: 'inbound' | 'outbound';
    subject_preview?: string;
    last_message_at: string;
    /**
     * sent_at of the newest inbound message. Only the import knows this from history:
     * a thread whose newest message is the host's reply still has an open window.
     */
    last_inbound_at?: string | null;
    messaging_window_expires_at?: string | null;
    participant_name?: string;
    /** Host unread increment. Only inbound messages move it. */
    unread_delta?: number;
    /** Guest unread increment. */
    guest_unread_delta?: number;
    /** Set/clear the guest-AI handoff state (see aiHandoff.ts). */
    aiHandoff?: AiHandoffPatch;
  }
): Promise<void> {
  const sb = socialInboxDb();
  const { error } = await sb.rpc('inbox_bump_conversation', {
    p_conversation_id: conversationId,
    p_sent_at: patch.last_message_at,
    p_direction: patch.direction,
    p_subject_preview: patch.subject_preview ?? null,
    p_last_inbound_at: patch.last_inbound_at ?? null,
    p_messaging_window_expires_at: patch.messaging_window_expires_at ?? null,
    p_unread_delta: patch.unread_delta ?? 0,
    p_guest_unread_delta: patch.guest_unread_delta ?? 0,
  });
  if (error) throw new Error(error.message);

  // The summary function does not own the guest name or the AI handoff state.
  const extra: Record<string, unknown> = {};
  if (patch.participant_name) extra.participant_name = patch.participant_name;
  if (patch.aiHandoff) Object.assign(extra, aiHandoffColumns(patch.aiHandoff));
  if (!Object.keys(extra).length) return;

  const { error: extraError } = await sb
    .from('social_conversations')
    .update({ ...extra, updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (extraError) throw new Error(extraError.message);
}

export const INBOX_THREAD_PAGE_SIZE = 40;

export async function getFacebookConnectionForOrg(
  orgId: string
): Promise<SocialChannelConnectionRow | null> {
  const { getOrgDefaultFacebookConnection } = await import('./metaInboxScope.ts');
  return getOrgDefaultFacebookConnection(orgId);
}

export async function countOrgMetaConversations(orgId: string): Promise<number> {
  const sb = socialInboxDb();
  const { count, error } = await sb
    .from('social_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .in('platform', ['facebook', 'instagram']);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** True when more Graph pages should be synced (scroll / search). */
/**
 * True while the server still has older Meta chats to import for this org.
 *
 * The import is server state now (`meta_sync_state`), so this is a read of its completion,
 * not a heuristic over the local thread count.
 */
export async function resolveMetaHasMore(orgId: string): Promise<boolean> {
  const sb = socialInboxDb();
  const { data } = await sb
    .from('meta_sync_state')
    .select('import_completed_at, connection_id')
    .eq('organization_id', orgId)
    .limit(1)
    .maybeSingle();
  const row = data as { import_completed_at?: string | null } | null;
  if (!row) return false;
  return !row.import_completed_at;
}

/**
 * Import state from a connection row that is already loaded.
 *
 * The chunk caller fetches the connection for the token, so reading the phase and cursor
 * from that row saves the second lookup `getMetaBackfillState` used to cost.
 */
export function metaBackfillStateFromConnection(
  connection: SocialChannelConnectionRow | null
): { phase: 'messenger' | 'instagram'; nextCursor: string | null } {
  const phase = connection?.meta_backfill_phase;
  if (phase === 'messenger' || phase === 'instagram') {
    return { phase, nextCursor: connection?.meta_backfill_cursor ?? null };
  }
  return { phase: 'messenger', nextCursor: null };
}

export async function getMetaBackfillState(
  orgId: string
): Promise<{ phase: 'messenger' | 'instagram'; nextCursor: string | null }> {
  return metaBackfillStateFromConnection(await getFacebookConnectionForOrg(orgId));
}

/**
 * Persist the import cursor.
 *
 * Only the opaque Graph `after` cursor is stored. The old column held a full Graph paging
 * URL, which carries the Page access token, and that URL was handed to the browser.
 */
export async function setMetaBackfillState(
  orgId: string,
  state: { phase: 'messenger' | 'instagram' | null; nextCursor: string | null }
): Promise<void> {
  const sb = socialInboxDb();
  const now = new Date().toISOString();
  await sb
    .from('social_channel_connections')
    .update({
      meta_backfill_phase: state.phase,
      meta_backfill_cursor: state.nextCursor,
      updated_at: now,
    })
    .eq('organization_id', orgId)
    .eq('platform', 'facebook')
    .eq('status', 'connected')
    .is('property_id', null)
    .is('parking_id', null);
}

export async function markMetaInitialSyncComplete(orgId: string): Promise<void> {
  const sb = socialInboxDb();
  const now = new Date().toISOString();
  await sb
    .from('social_channel_connections')
    .update({ last_sync_at: now, error_message: null, updated_at: now })
    .eq('organization_id', orgId)
    .eq('platform', 'facebook')
    .eq('status', 'connected')
    .is('property_id', null)
    .is('parking_id', null)
    .is('last_sync_at', null);
  const { data: igRows } = await sb
    .from('social_channel_connections')
    .select('id')
    .eq('organization_id', orgId)
    .eq('platform', 'instagram')
    .eq('status', 'connected')
    .is('property_id', null)
    .is('parking_id', null)
    .limit(1);
  if (igRows?.[0]) {
    await sb
      .from('social_channel_connections')
      .update({ last_sync_at: now, error_message: null, updated_at: now })
      .eq('organization_id', orgId)
      .eq('platform', 'instagram')
      .eq('status', 'connected')
      .is('property_id', null)
      .is('parking_id', null)
      .is('last_sync_at', null);
  }
}

export async function markMetaBackfillFullyComplete(
  orgId: string,
  igConnection: SocialChannelConnectionRow | null
): Promise<void> {
  const sb = socialInboxDb();
  const now = new Date().toISOString();
  await setMetaBackfillState(orgId, { phase: null, nextCursor: null });
  await sb
    .from('social_channel_connections')
    .update({
      meta_backfill_done: true,
      last_sync_at: now,
      error_message: null,
      updated_at: now,
    })
    .eq('organization_id', orgId)
    .eq('platform', 'facebook')
    .eq('status', 'connected');
  if (igConnection) {
    await sb
      .from('social_channel_connections')
      .update({ last_sync_at: now, error_message: null, updated_at: now })
      .eq('organization_id', orgId)
      .eq('platform', 'instagram')
      .eq('status', 'connected');
  }
}

export async function clearMetaBackfillState(orgId: string): Promise<void> {
  await setMetaBackfillState(orgId, { phase: null, nextCursor: null });
}

export async function searchInboxConversations(
  orgId: string,
  filter: InboxThreadFilter
): Promise<{ conversations: SocialConversationRow[]; nextCursor: string | null }> {
  const search = filter.search?.trim();
  if (!search) return listConversations(orgId, filter);

  const limit = Math.min(Math.max(filter.limit ?? INBOX_THREAD_PAGE_SIZE, 1), 100);
  const sb = socialInboxDb();
  const term = `%${search}%`;

  const { data: previewRows, error: previewError } = await sb
    .from('social_conversations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('conversation_type', 'dm')
    .or(`participant_name.ilike.${term},subject_preview.ilike.${term}`)
    .order('last_message_at', { ascending: false })
    .limit(limit + 1);
  if (previewError) throw new Error(previewError.message);

  const { data: msgRows, error: msgError } = await sb
    .from('social_messages')
    .select('conversation_id')
    .eq('organization_id', orgId)
    .ilike('body_text', term)
    .limit(200);
  if (msgError) throw new Error(msgError.message);

  const messageIds = [...new Set((msgRows ?? []).map((r) => r.conversation_id as string))];
  let messageMatches: SocialConversationRow[] = [];
  if (messageIds.length) {
    const { data: msgConvRows, error: msgConvError } = await sb
      .from('social_conversations')
      .select('*')
      .eq('organization_id', orgId)
      .eq('conversation_type', 'dm')
      .in('id', messageIds);
    if (msgConvError) throw new Error(msgConvError.message);
    messageMatches = (msgConvRows ?? []) as SocialConversationRow[];
  }

  const merged = new Map<string, SocialConversationRow>();
  for (const row of [...(previewRows ?? []), ...messageMatches] as SocialConversationRow[]) {
    merged.set(row.id, row);
  }

  let rows = [...merged.values()].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  if (filter.platform && filter.platform !== 'all') {
    rows = rows.filter((r) => r.platform === filter.platform);
  }
  if (filter.status === 'unread') {
    rows = rows.filter((r) => r.unread_count > 0);
  } else if (filter.status === 'pending') {
    rows = rows.filter((r) => r.reply_status === 'pending');
  } else if (filter.status === 'replied') {
    rows = rows.filter((r) => r.reply_status === 'replied');
  }

  const propertyId = filter.propertyId ?? null;
  const parkingId = filter.parkingId ?? null;
  const metaIds = filter.metaConnectionIds ? new Set(filter.metaConnectionIds) : null;
  if (propertyId || parkingId) {
    rows = rows.filter((r) => {
      if (r.platform === 'web') {
        if (propertyId) return r.property_id === propertyId;
        if (parkingId) return r.parking_id === parkingId;
        return false;
      }
      if (!metaIds) return false;
      return metaIds.has(r.connection_id);
    });
  }

  if (filter.cursor) {
    const cursorMs = new Date(filter.cursor).getTime();
    rows = rows.filter((r) => new Date(r.last_message_at).getTime() < cursorMs);
  }

  const hasMore = rows.length > limit;
  const conversations = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? (conversations[conversations.length - 1]?.last_message_at ?? null)
    : null;
  return { conversations, nextCursor };
}

export async function searchConversationsByMessageText(
  orgId: string,
  search: string,
  limit = 30
): Promise<SocialConversationRow[]> {
  const sb = socialInboxDb();
  const term = `%${search.trim()}%`;
  const { data: msgRows } = await sb
    .from('social_messages')
    .select('conversation_id')
    .eq('organization_id', orgId)
    .ilike('body_text', term)
    .limit(100);
  const ids = [...new Set((msgRows ?? []).map((r) => r.conversation_id as string))];
  if (!ids.length) return [];
  const { data } = await sb
    .from('social_conversations')
    .select('*')
    .eq('organization_id', orgId)
    .in('id', ids)
    .order('last_message_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as SocialConversationRow[];
}

/**
 * True if `conv` falls within the given property/parking/Meta-connection scope. Single source of
 * truth for this check — import it rather than redefining it (it was previously duplicated
 * privately in `social-inbox-send`/`social-inbox-messages`; add call sites there too when next
 * touching either file, rather than leaving a third private copy).
 */
export function conversationAllowedInScope(
  conv: SocialConversationRow,
  ctx: { propertyId: string | null; parkingId: string | null; metaIds: Set<string> }
): boolean {
  if (!ctx.propertyId && !ctx.parkingId) return true;
  if (conv.platform === 'web') {
    if (ctx.propertyId) return conv.property_id === ctx.propertyId;
    if (ctx.parkingId) return conv.parking_id === ctx.parkingId;
    return false;
  }
  return ctx.metaIds.has(conv.connection_id);
}
