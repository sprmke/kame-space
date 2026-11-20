/**
 * Push vs pop vs tab from history index. Used with React Router viewTransition
 * and `html[data-nav-transition]`.
 */

export type NavDirection = 'push' | 'pop' | 'tab' | 'none';

export type NavHistorySnapshot = {
  index: number;
  key: string;
};

/**
 * Compare previous and next history indices.
 * Same index (or missing) → tab / replace / first mount → `'tab'` when `sameTabFamily`, else `'none'`.
 */
export function resolveNavDirection(args: {
  previous: NavHistorySnapshot | null;
  next: NavHistorySnapshot;
  /** True when both routes share a bottom-tab root (lateral change). */
  sameTabFamily?: boolean;
}): NavDirection {
  const { previous, next, sameTabFamily = false } = args;
  if (!previous) return sameTabFamily ? 'tab' : 'none';
  if (previous.key === next.key) return 'none';
  if (sameTabFamily && previous.index === next.index) return 'tab';
  if (next.index > previous.index) return 'push';
  if (next.index < previous.index) return 'pop';
  return sameTabFamily ? 'tab' : 'none';
}
