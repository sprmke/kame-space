import type { InfiniteData } from '@tanstack/react-query';

import type { InboxConversation, InboxMessage } from '@/features/dashboard/inbox/types/inbox';

/**
 * Apply a realtime delta to a cached list.
 *
 * These are pure so a bad patch cannot silently drop a message, and so the behaviour is
 * covered by tests rather than only by clicking. Each returns input unchanged when there is
 * nothing to apply.
 */

/** Any cached page that carries a thread list, so the caller's page type is preserved. */
export type ThreadsPageLike = { conversations: InboxConversation[] };
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
  rows: InboxConversation[]
): InfiniteData<T> | undefined {
  if (!data?.pages?.length || rows.length === 0) return data;

  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const pages = data.pages.map(
    (page) =>
      ({
        ...page,
        conversations: page.conversations.map((conversation) => {
          seen.add(conversation.id);
          return byId.get(conversation.id) ?? conversation;
        }),
      }) as T
  );

  const fresh = rows.filter((row) => !seen.has(row.id) && !row.id.startsWith('mock-'));
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
