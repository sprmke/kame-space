import { useTransform, type MotionValue } from 'framer-motion';

/**
 * A 0..1 value that comes from the scroll position. Home page scenes read it instead of
 * running on a timer, so they play forward, backward, and hold with the visitor's scroll.
 *
 * test: N/A. Thin wrapper over framer-motion's `useTransform`; covered by the home page E2E.
 */
export type Progress = MotionValue<number>;

/** A 0..1 window of a longer progress value. Clamped, so it holds at both ends. */
export function useSlice(p: Progress, from: number, to: number) {
  return useTransform(p, [from, to], [0, 1]);
}
