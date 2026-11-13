import { useEffect } from 'react';

import {
  captureFirstTouch,
  sessionStorageSafe,
} from '@/features/guest/lib/firstTouchUtm';

/**
 * Records the first tracked visit for guest attribution. Runs once per public page mount;
 * `captureFirstTouch` keeps the earliest touch, so later navigation cannot overwrite it.
 */
export function useFirstTouchUtm(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    captureFirstTouch(window.location.search, window.location.pathname, sessionStorageSafe());
  }, []);
}
