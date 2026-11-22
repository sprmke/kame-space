/**
 * Guest account list loading layout — keep the skeleton aligned with empty vs
 * list so first paint does not flash the wrong chrome (mascot empty vs rows).
 *
 * Same pattern as `ticketsWorkspaceLayout.ts`. Prefer a session hint or cached
 * count; cold defaults are per page (sparse lists → empty, Help → list).
 */

export type GuestAccountListLayout = 'empty' | 'list';

export type GuestAccountListLoadState = GuestAccountListLayout | 'ready';

export function guestAccountListLayoutStorageKey(page: string): string {
  return `kame-guest-account-layout:${page}`;
}

export function readGuestAccountListLayoutHint(key: string): GuestAccountListLayout | null {
  try {
    const value = sessionStorage.getItem(key);
    return value === 'empty' || value === 'list' ? value : null;
  } catch {
    return null;
  }
}

export function writeGuestAccountListLayoutHint(
  key: string,
  layout: GuestAccountListLayout
): void {
  try {
    sessionStorage.setItem(key, layout);
  } catch {
    // Private mode / blocked storage: cold loads use coldDefault.
  }
}

/**
 * Prefer cached item count, then a session hint from the last visit.
 * When neither exists, use `coldDefault` (not a generic list).
 */
export function resolveGuestAccountListLoadState(input: {
  isPending: boolean;
  /** Present when the query has (cached) data. */
  itemCount: number | undefined;
  hint: GuestAccountListLayout | null;
  /** Cold load when no cache/hint. Sparse account lists default to empty. */
  coldDefault?: GuestAccountListLayout;
}): GuestAccountListLoadState {
  if (!input.isPending) return 'ready';
  if (input.itemCount !== undefined) {
    return input.itemCount > 0 ? 'list' : 'empty';
  }
  return input.hint ?? input.coldDefault ?? 'empty';
}

export function guestAccountListLayoutFromCount(count: number): GuestAccountListLayout {
  return count > 0 ? 'list' : 'empty';
}
