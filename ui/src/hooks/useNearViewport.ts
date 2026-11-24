import { useEffect, useRef, useState } from 'react';

/**
 * True once the element has come within `rootMargin` of the viewport, then stays true.
 *
 * Used to defer mounting heavy, below-the-fold admin sections. The element itself is
 * always rendered (headings and anchors need to exist); only its content waits.
 */
export function useNearViewport<T extends Element>(rootMargin = '600px 0px') {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, rootMargin]);

  return { ref, near };
}
