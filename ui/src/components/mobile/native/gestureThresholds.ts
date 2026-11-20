/**
 * Swipe-row and pull-to-refresh thresholds (design-system §10 / v2 G catalogue).
 * Pure numbers so gesture handlers and tests share one source.
 */

/** Fraction of row width at which a swipe snaps open. */
export const SWIPE_SNAP_RATIO = 0.3;

/** Velocity (px/ms) that commits a full swipe regardless of distance. */
export const SWIPE_COMMIT_VELOCITY = 0.5;

/** Max rubber-band pull before the refresh spinner locks (px). */
export const PULL_REFRESH_DISTANCE = 64;

/** Pull distance that arms refresh (px). */
export const PULL_REFRESH_ARM = 48;

export function swipeShouldSnapOpen(deltaX: number, rowWidth: number, velocityX: number): boolean {
  if (rowWidth <= 0) return false;
  if (Math.abs(velocityX) >= SWIPE_COMMIT_VELOCITY) return Math.abs(deltaX) > 8;
  return Math.abs(deltaX) / rowWidth >= SWIPE_SNAP_RATIO;
}

export function pullRefreshArmed(offsetY: number): boolean {
  return offsetY >= PULL_REFRESH_ARM;
}

export function pullRefreshClamped(offsetY: number): number {
  return Math.min(Math.max(0, offsetY), PULL_REFRESH_DISTANCE);
}
