import { useCallback, useEffect, useRef } from 'react';

const HISTORY_KEY = '__kameOverlay';

let tokenSeq = 0;

function currentToken(): unknown {
  const state: unknown = window.history.state;
  return state && typeof state === 'object'
    ? (state as Record<string, unknown>)[HISTORY_KEY]
    : null;
}

/**
 * Lets the system Back action (Android back, iOS PWA edge swipe, browser back) close a
 * full-screen layer instead of leaving the page.
 *
 * Opening pushes one history entry on the current URL (the router's own state is copied, so
 * the router sees the same location). Back pops it and calls `onDismiss`. Closing from the UI
 * pops the entry itself so history stays clean.
 *
 * Navigating away while open: call `consume()` first and navigate with `replace: true` when it
 * returns `true`. That swaps the overlay entry for the destination, so Back from the
 * destination lands on the page in one step.
 */
export function useHistoryBackDismiss(open: boolean, onDismiss: () => void) {
  const tokenRef = useRef<string | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const token = `overlay-${(tokenSeq += 1)}`;
    const base: unknown = window.history.state;
    window.history.pushState(
      { ...(base && typeof base === 'object' ? base : {}), [HISTORY_KEY]: token },
      ''
    );
    tokenRef.current = token;

    const onPopState = () => {
      if (tokenRef.current !== token || currentToken() === token) return;
      tokenRef.current = null;
      onDismissRef.current();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      // Closed from the UI (or unmounted) while our entry is still on top: pop it.
      if (tokenRef.current === token && currentToken() === token) {
        tokenRef.current = null;
        window.history.back();
      }
      tokenRef.current = null;
    };
  }, [open]);

  /** `true` when the overlay entry is on top; navigate with `replace: true` to reuse it. */
  const consume = useCallback(() => {
    const token = tokenRef.current;
    if (!token || typeof window === 'undefined' || currentToken() !== token) return false;
    tokenRef.current = null;
    return true;
  }, []);

  return { consume };
}
