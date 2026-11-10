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
