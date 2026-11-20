import { useEffect, useRef, useState } from 'react';

import { useLocation, useNavigationType } from 'react-router-dom';

import {
  type NavDirection,
  type NavHistorySnapshot,
  resolveNavDirection,
} from '@/components/mobile/native/navDirection';

/**
 * Tracks push / pop / tab for View Transitions. Sets `html[data-nav-transition]`
 * for the CSS in `index.css`. Call once near the app shell (Phase 2 wires it).
 */
export function useNavDirection(options?: { sameTabFamily?: boolean }): NavDirection {
  const location = useLocation();
  const navType = useNavigationType();
  const previousRef = useRef<NavHistorySnapshot | null>(null);
  const [direction, setDirection] = useState<NavDirection>('none');

  useEffect(() => {
    const next: NavHistorySnapshot = {
      // React Router does not expose history.index; approximate with PUSH/POP/REPLACE.
      index:
        navType === 'POP'
          ? (previousRef.current?.index ?? 1) - 1
          : navType === 'PUSH'
            ? (previousRef.current?.index ?? 0) + 1
            : (previousRef.current?.index ?? 0),
      key: location.key,
    };
    const resolved = resolveNavDirection({
      previous: previousRef.current,
      next,
      sameTabFamily: options?.sameTabFamily,
    });
    setDirection(resolved);
    previousRef.current = next;

    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (resolved === 'none') {
      root.removeAttribute('data-nav-transition');
      return;
    }
    root.setAttribute('data-nav-transition', resolved);
    const clear = window.setTimeout(() => {
      if (root.getAttribute('data-nav-transition') === resolved) {
        root.removeAttribute('data-nav-transition');
      }
    }, 400);
    return () => window.clearTimeout(clear);
  }, [location.key, navType, options?.sameTabFamily]);

  return direction;
}
