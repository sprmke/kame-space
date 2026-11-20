import { useCallback, useState } from 'react';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

/**
 * Press scale state for custom controls that cannot use `.native-v3-press`.
 * Under reduced motion, only the pressed flag flips (tint), never scale.
 */
export function usePressFeedback() {
  const reduced = usePrefersReducedMotion();
  const [pressed, setPressed] = useState(false);

  const onPointerDown = useCallback(() => setPressed(true), []);
  const onPointerUp = useCallback(() => setPressed(false), []);
  const onPointerLeave = useCallback(() => setPressed(false), []);
  const onPointerCancel = useCallback(() => setPressed(false), []);

  return {
    pressed,
    scale: reduced || !pressed ? 1 : 0.97,
    handlers: {
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
    },
  };
}
