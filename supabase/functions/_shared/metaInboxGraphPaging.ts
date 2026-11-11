/**
 * Pure helpers for the Meta conversation import paging.
 *
 * Split out from `metaInboxGraph.ts` so the URL and cursor rules can be tested without
 * pulling in the Graph client's runtime dependencies.
 */

import { META_GRAPH_BASE } from './metaInboxConfig.ts';

const META_MESSAGE_FIELDS =
  'id,message,created_time,from,attachments{type,mime_type,name,image_data,video_data,file_url,payload}';

export function buildMetaConversationsUrl(
  pageId: string,
  pageAccessToken: string,
  platform: 'messenger' | 'instagram',
  opts?: { light?: boolean; after?: string | null }
): string {
  const url = new URL(`${META_GRAPH_BASE}/${pageId}/conversations`);
  url.searchParams.set('platform', platform);
  const msgLimit = opts?.light ? 3 : 10;
  const fields = `id,updated_time,participants{id,name,username},messages.limit(${msgLimit}){${META_MESSAGE_FIELDS}}`;
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', opts?.light ? '25' : '50');
  const after = opts?.after?.trim();
  if (after) url.searchParams.set('after', after);
  url.searchParams.set('access_token', pageAccessToken);
  return url.toString();
}

/**
 * Read the opaque paging cursor out of a Graph `paging.next` URL.
 *
 * The paging URL carries the Page access token, so it must never be persisted, returned to
 * a client, or fetched back. Only the `after` cursor is kept, and only when the URL really
 * points at Meta.
 */
export function extractMetaPagingCursor(pagingNext: string | null | undefined): string | null {
  if (!pagingNext) return null;
  let url: URL;
  try {
    url = new URL(pagingNext);
  } catch {
    return null;
  }
  if (url.hostname !== 'graph.facebook.com' && url.hostname !== 'graph.facebook.net') return null;
  const after = url.searchParams.get('after')?.trim();
  return after ? after : null;
}


/** Conversation head page: ids and updated_time only. The cheap reconcile scan. */
export function buildMetaConversationHeadUrl(
  pageId: string,
  pageAccessToken: string,
  platform: 'messenger' | 'instagram'
): string {
  const url = new URL(`${META_GRAPH_BASE}/${pageId}/conversations`);
  url.searchParams.set('platform', platform);
  url.searchParams.set('fields', 'id,updated_time');
  url.searchParams.set('limit', '25');
  url.searchParams.set('access_token', pageAccessToken);
  return url.toString();
}

/**
 * One request for up to 25 changed conversations, each with its newest 20 messages.
 *
 * Meta caps a conversation at its latest 20 messages and returns nothing older, which is
 * why the thread shows a gap divider rather than pretending the history is complete.
 */
export function buildMetaConversationsByIdsUrl(
  pageId: string,
  pageAccessToken: string,
  platform: 'messenger' | 'instagram',
  conversationIds: string[]
): string {
  const url = new URL(`${META_GRAPH_BASE}/`);
  url.searchParams.set('ids', conversationIds.slice(0, 25).join(','));
  url.searchParams.set('platform', platform);
  url.searchParams.set(
    'fields',
    'id,updated_time,participants{id,name,username},messages.limit(20){id,message,created_time,from,attachments{type,mime_type,name,image_data,video_data,file_url,payload}}'
  );
  url.searchParams.set('access_token', pageAccessToken);
  return url.toString();
}

/** Which app owns a chat. Meta Business AI and routing apps answer on `standby`. */
export function buildMetaThreadOwnerUrl(pageId: string, pageAccessToken: string): string {
  const url = new URL(`${META_GRAPH_BASE}/${pageId}/thread_owner`);
  url.searchParams.set('access_token', pageAccessToken);
  return url.toString();
}

/**
 * Read Meta's own rate-limit headers.
 *
 * `X-Business-Use-Case-Usage` is a JSON map per business use case; the highest call count
 * percentage is what matters. Returns null when the headers are absent.
 */
export function readMetaRateLimitPct(headers: Headers): number | null {
  const raw = headers.get('x-business-use-case-usage') ?? headers.get('x-app-usage');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const percentages: number[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
        return;
      }
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const callCount = record.call_count;
        if (typeof callCount === 'number') percentages.push(callCount);
        for (const item of Object.values(record)) walk(item);
      }
    };
    walk(parsed);
    if (!percentages.length) return null;
    return Math.min(100, Math.max(...percentages));
  } catch {
    return null;
  }
}
