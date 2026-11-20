/**
 * Tickets workspace loading layout — keep the skeleton aligned with empty vs list
 * so first paint does not flash the wrong chrome.
 */

export type TicketsWorkspaceLayout = 'empty' | 'list';

export type TicketsWorkspaceLoadState = TicketsWorkspaceLayout | 'ready';

export function ticketsWorkspaceLayoutStorageKey(parts: Array<string | null | undefined>): string {
  return `kame-tickets-workspace-layout:${parts.map((p) => p ?? '').join(':')}`;
}

export function readTicketsWorkspaceLayoutHint(key: string): TicketsWorkspaceLayout | null {
  try {
    const value = sessionStorage.getItem(key);
    return value === 'empty' || value === 'list' ? value : null;
  } catch {
    return null;
  }
}

export function writeTicketsWorkspaceLayoutHint(key: string, layout: TicketsWorkspaceLayout): void {
  try {
    sessionStorage.setItem(key, layout);
  } catch {
    // Private mode / blocked storage: cold loads fall back to empty.
  }
}

/**
 * Prefer cached ticket count, then a session hint from the last visit in this scope.
 * Cold loads default to `empty` so hosts without tickets do not see a fake list.
 */
export function resolveTicketsWorkspaceLoadState(input: {
  isPending: boolean;
  /** Present when the query has (cached) data. */
  ticketCount: number | undefined;
  hint: TicketsWorkspaceLayout | null;
}): TicketsWorkspaceLoadState {
  if (!input.isPending) return 'ready';
  if (input.ticketCount !== undefined) {
    return input.ticketCount > 0 ? 'list' : 'empty';
  }
  return input.hint ?? 'empty';
}

export function ticketsWorkspaceLayoutFromCount(count: number): TicketsWorkspaceLayout {
  return count > 0 ? 'list' : 'empty';
}
