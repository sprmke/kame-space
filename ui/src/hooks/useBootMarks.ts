import { useLayoutEffect, useRef } from 'react';

import { useLocation } from 'react-router-dom';

import { markBoot } from '@/lib/perf/bootMarks';

/**
 * Boot-level marks that need router context. Mount once, in `AppShell`.
 *
 * - `app:first-render` fires after the first commit has painted (one rAF later), so
 *   it is the shell being visible, not React having decided to render it.
 * - `nav:start` fires on each later location change. It measures from the commit of
 *   the new route, which is a **lower bound** on tap-to-content: the tap handler and
 *   the router's own work happen before this point. `useRouteContentReady` closes
 *   the pair, so `navContentMs` is honest about what it covers.
 */
export function useBootMarks(): void {
  const location = useLocation();
  const firstCommitRef = useRef(false);
  const lastKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!firstCommitRef.current) {
      firstCommitRef.current = true;
      lastKeyRef.current = location.key;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => markBoot('app:first-render'));
      } else {
        markBoot('app:first-render');
      }
      return;
    }

    if (lastKeyRef.current !== location.key) {
      lastKeyRef.current = location.key;
      markBoot('nav:start');
    }
  }, [location.key]);
}
