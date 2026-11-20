/**
 * Light haptics for native gestures. No-ops when unsupported or reduced-motion.
 * Never throws; never blocks the UI thread beyond the browser API.
 */

export type HapticKind = 'light' | 'medium' | 'success' | 'warning';

const PATTERN: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  success: [10, 40, 10],
  warning: [30, 40, 30],
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function triggerHaptic(kind: HapticKind = 'light'): void {
  if (typeof navigator === 'undefined') return;
  if (prefersReducedMotion()) return;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) return;
  try {
    vibrate(PATTERN[kind]);
  } catch {
    // Some browsers expose vibrate but reject it outside a user gesture.
  }
}
