/**
 * Pick a conversation id to open when the host has none (or the current id is
 * outside the filtered list). Returns null when nothing should change.
 *
 * Does not chase newly arrived threads while a valid selection exists — that
 * would yank the host out of the thread they are reading.
 */
export function resolveInboxAutoSelectId(
  conversationIds: readonly string[],
  selectedId: string | null | undefined
): string | null {
  if (conversationIds.length === 0) return null;
  if (selectedId && conversationIds.includes(selectedId)) return null;
  return conversationIds[0] ?? null;
}

/** Matches Tailwind `@2xl` (42rem) used by the inbox split list + thread layout. */
export const INBOX_SPLIT_PANE_MIN_WIDTH_PX = 672;
