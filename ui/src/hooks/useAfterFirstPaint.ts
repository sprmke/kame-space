import { useEffect, useState } from 'react';

/**
 * `false` for the first paint, `true` once the browser has painted and gone idle.
 *
 * Used to hold non-critical reads (notification preview, announcement unread dot) out of
 * the cold-open critical path. The value only ever goes one way, so a component that gates
 * a query on it will not toggle back and forth.
 *
 * Falls back to a timer where `requestIdleCallback` does not exist (Safari), and to `true`
 * on the very next tick when neither is available, so callers never hang.
 */
export function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setReady(true);
      return;
    }

    let cancelled = false;
    let frame = 0;
    let idle = 0;
    let timer = 0;

    const finish = () => {
      if (!cancelled) setReady(true);
    };

    // Two frames: the first paints the shell, the second proves the paint landed.
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        if (typeof window.requestIdleCallback === 'function') {
          idle = window.requestIdleCallback(finish, { timeout: 2000 });
        } else {
          timer = window.setTimeout(finish, 300);
        }
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (idle && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return ready;
}
