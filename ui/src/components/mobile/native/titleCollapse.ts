/**
 * Large → compact title handoff. Opacity + 4px translate only (no layout animation).
 * Driven by IntersectionObserver on the large-title sentinel, not scroll listeners.
 */

export type TitleCollapseState = {
  /** 0 = large title fully visible, 1 = compact title fully visible. */
  progress: number;
  compactVisible: boolean;
};

export const TITLE_COLLAPSE_THRESHOLD = 0.35;

export function titleCollapseFromRatio(intersectionRatio: number): TitleCollapseState {
  const clamped = Math.min(1, Math.max(0, intersectionRatio));
  // As the large title leaves the viewport, ratio falls; invert for compact progress.
  const progress = 1 - clamped;
  return {
    progress,
    compactVisible: progress >= TITLE_COLLAPSE_THRESHOLD,
  };
}

export function largeTitleStyle(progress: number): { opacity: number; transform: string } {
  const opacity = Math.max(0, 1 - progress);
  const y = -4 * progress;
  return {
    opacity,
    transform: `translate3d(0, ${y.toFixed(2)}px, 0)`,
  };
}

export function compactTitleStyle(progress: number): { opacity: number; transform: string } {
  const opacity = Math.min(
    1,
    Math.max(0, (progress - TITLE_COLLAPSE_THRESHOLD) / (1 - TITLE_COLLAPSE_THRESHOLD))
  );
  const y = 4 * (1 - opacity);
  return {
    opacity,
    transform: `translate3d(0, ${y.toFixed(2)}px, 0)`,
  };
}
