import type { InboxMessage } from '@/features/dashboard/inbox/types/inbox';

/**
 * What to show for a Meta message that has no readable text of its own.
 *
 * Story replies, shared posts and unsupported types arrive as attachments with a Meta kind.
 * Naming them beats a bare "(attachment)", which reads like a bug. Returns null when the
 * message has text, so the bubble shows the text instead.
 */
export function inboxMessageKindLabel(
  kind: InboxMessage['message_kind'] | undefined,
  hasText: boolean
): string | null {
  if (hasText) return null;
  if (kind === 'story_reply') return 'Replied to a story';
  if (kind === 'share') return 'Shared a post';
  if (kind === 'unsupported') return 'This message only opens in Meta';
  return null;
}
