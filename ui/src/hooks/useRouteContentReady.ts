import { useEffect, useRef } from 'react';

import { markBoot } from '@/lib/perf/bootMarks';
import { reportBootMeasurements } from '@/lib/sentry/bootMeasurements';

/**
 * Fires the "content is actually here" mark for a page.
 *
 * Call it with one boolean that is true only when the content the user came for is
 * on screen, not merely "the fetch finished" and not "loading is false". On the
 * first route of a session this closes the cold open (`route:content`); on every
 * later route it closes the navigation pair that `useRouteNavigationMarks` opened.
 *
 * Safe to pass `false` forever; it then never fires.
 */
export function useRouteContentReady(isReady: boolean): void {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isReady || firedRef.current) return;
    firedRef.current = true;

    markBoot('route:content');
    markBoot('nav:content');
    reportBootMeasurements();
  }, [isReady]);
}
