import type { InboxConversation, InboxMessage } from '@/features/dashboard/inbox/types/inbox';

import type { InfiniteData } from '@tanstack/react-query';

/**
 * Apply a realtime delta to a cached list.
 *
 * These are pure so a bad patch cannot silently drop a message, and so the behaviour is
 * covered by tests rather than only by clicking. Each returns input unchanged when there is
 * nothing to apply.
 */

/** Any cached page that carries a thread list, so the caller's page type is preserved. */
export type ThreadsPageLike = { conversations: InboxConversation[] };

/** The filters that produced a cached thread list. Mirrors `useInboxThreads` filters. */
export type InboxThreadFilters = {
  status?: string;
  platform?: string;
  search?: string;
};

/** Find the filter object inside an inbox threads query key. */
export function readInboxThreadFilters(queryKey: readonly unknown[]): InboxThreadFilters | null {
  for (const part of queryKey) {
    if (part && typeof part === 'object' && 'status' in part && 'platform' in part) {
      return part as InboxThreadFilters;
    }
  }
  return null;
}

/**
 * A realtime delta arrives without the list's filters, so it must be checked before it is
 * merged. Otherwise a web thread appears under the Facebook tab, or a replied thread under
 * Pending, until the next invalidate.
 */
export function conversationMatchesThreadFilters(
  row: InboxConversation,
  filters: InboxThreadFilters | null
): boolean {
  if (!filters) return true;
  if (filters.platform && filters.platform !== 'all' && row.platform !== filters.platform) {
    return false;
  }
  if (filters.status === 'unread' && row.unread_count <= 0) return false;
  if (filters.status === 'pending' && row.reply_status !== 'pending') return false;
  if (filters.status === 'replied' && row.reply_status !== 'replied') return false;
  const query = filters.search?.trim().toLowerCase();
  if (query) {
    const haystack = `${row.participant_name ?? ''} ${row.subject_preview ?? ''}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

export type MessagesPageLike = { messages: InboxMessage[] };

const byLastMessageDesc = (a: InboxConversation, b: InboxConversation) =>
  (b.last_message_at ?? '').localeCompare(a.last_message_at ?? '');

const bySentAtAsc = (a: InboxMessage, b: InboxMessage) =>
  (a.sent_at ?? '').localeCompare(b.sent_at ?? '');

/**
 * Patch changed thread rows in place, and insert a thread we have never seen at the top.
 *
 * A row that is not on a loaded page is still inserted, because a brand new conversation is
 * exactly the case the host is waiting for.
 */
export function patchThreadRows<T extends ThreadsPageLike>(
  data: InfiniteData<T> | undefined,
  rows: InboxConversation[],
  opts?: { matches?: (row: InboxConversation) => boolean }
): InfiniteData<T> | undefined {
  if (!data?.pages?.length || rows.length === 0) return data;

  const matches = opts?.matches;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const pages = data.pages.map(
    (page) =>
      ({
        ...page,
        conversations: page.conversations.flatMap((conversation) => {
          seen.add(conversation.id);
          const next = byId.get(conversation.id);
          if (!next) return [conversation];
          // A row that no longer satisfies the list's filters leaves that list.
          return matches && !matches(next) ? [] : [next];
        }),
      }) as T
  );

  const fresh = rows.filter(
    (row) => !seen.has(row.id) && !row.id.startsWith('mock-') && (!matches || matches(row))
  );
  if (fresh.length > 0) {
    pages[0] = {
      ...pages[0]!,
      conversations: [...fresh, ...pages[0]!.conversations].sort(byLastMessageDesc),
    } as T;
  }

  return { ...data, pages };
}

/**
 * Patch changed messages in the open thread, keeping send order.
 *
 * The messages pages are newest-first, so an inserted message goes on the first page.
 */
export function patchMessageRows<T extends MessagesPageLike>(
  data: InfiniteData<T> | undefined,
  rows: InboxMessage[]
): InfiniteData<T> | undefined {
  if (!data?.pages?.length || rows.length === 0) return data;

  const byId = new Map(rows.map((row) => [row.id, row]));
  const pages = data.pages.map(
    (page) =>
      ({
        ...page,
        messages: page.messages.map((message) => byId.get(message.id) ?? message),
      }) as T
  );

  const existing = new Set(pages.flatMap((page) => page.messages.map((message) => message.id)));
  const fresh = rows.filter((row) => !existing.has(row.id));
  if (fresh.length > 0) {
    pages[0] = {
      ...pages[0]!,
      messages: [...pages[0]!.messages, ...fresh].sort(bySentAtAsc),
    } as T;
  }

  return { ...data, pages };
}
