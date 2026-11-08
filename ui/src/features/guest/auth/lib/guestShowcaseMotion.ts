/** Shared motion presets for the guest auth showcase scenes. Delays are in seconds. */

export const SHOWCASE_EASE = [0.22, 1, 0.36, 1] as const;

export function rise(delay: number, distance = 8) {
  return {
    initial: { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay, ease: SHOWCASE_EASE },
  };
}

export function pop(delay: number) {
  return {
    initial: { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: 'spring' as const, stiffness: 420, damping: 24, delay },
  };
}

/** Swap animation for content that changes state in place (labels, values, buttons). */
export const SWAP = {
  initial: { opacity: 0, y: 6, filter: 'blur(2px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -6, filter: 'blur(2px)' },
  transition: { duration: 0.28, ease: SHOWCASE_EASE },
} as const;

export function formatPeso(value: number) {
  return `₱${value.toLocaleString('en-PH')}`;
}
