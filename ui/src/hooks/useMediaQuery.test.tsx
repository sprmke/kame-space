import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useIsBelowLg,
  useIsBelowMd,
  useIsBelowXl,
  useIsHoverFine,
  useIsMobile,
  usePrefersReducedMotion,
} from '@/hooks/useMediaQuery';

type Listener = () => void;

/** Controllable `matchMedia`: flip `matches` and fire the change listeners. */
function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Map<string, Set<Listener>>();
  const queries = new Map<string, boolean>();

  const setMatches = (query: string, matches: boolean) => {
    queries.set(query, matches);
    for (const listener of listeners.get(query) ?? []) listener();
  };

  vi.stubGlobal('matchMedia', (query: string) => {
    if (!queries.has(query)) queries.set(query, initialMatches);
    return {
      get matches() {
        return queries.get(query) ?? false;
      },
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: Listener) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)!.add(listener);
      },
      removeEventListener: (_event: string, listener: Listener) => {
        listeners.get(query)?.delete(listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  });

  return {
    setMatches,
    listenerCount: (query: string) => listeners.get(query)?.size ?? 0,
    queries: () => [...queries.keys()],
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery-backed hooks', () => {
  it('reports the current match on first render', () => {
    stubMatchMedia(false);
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);

    vi.unstubAllGlobals();
    stubMatchMedia(true);
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
  });

  it('updates when the query starts or stops matching', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());

    act(() => media.setMatches('(max-width: 639px)', true));
    expect(result.current).toBe(true);

    act(() => media.setMatches('(max-width: 639px)', false));
    expect(result.current).toBe(false);
  });

  it('subscribes to the breakpoint each hook documents', () => {
    const media = stubMatchMedia(false);

    renderHook(() => useIsMobile());
    renderHook(() => useIsBelowMd());
    renderHook(() => useIsBelowLg());
    renderHook(() => useIsBelowXl());
    renderHook(() => usePrefersReducedMotion());
    renderHook(() => useIsHoverFine());

    expect(media.queries()).toEqual(
      expect.arrayContaining([
        '(max-width: 639px)',
        '(max-width: 767px)',
        '(max-width: 1023px)',
        '(max-width: 1279px)',
        '(prefers-reduced-motion: reduce)',
        '(hover: hover) and (pointer: fine)',
      ])
    );
  });

  it('removes its listener on unmount, so a page visit cannot leak one', () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());

    expect(media.listenerCount('(max-width: 639px)')).toBe(1);
    unmount();
    expect(media.listenerCount('(max-width: 639px)')).toBe(0);
  });

  it('honours the OS reduced-motion preference', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());

    act(() => media.setMatches('(prefers-reduced-motion: reduce)', true));

    expect(result.current).toBe(true);
  });

  it('treats a fine pointer separately from layout, because touch laptops have both', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useIsHoverFine());

    act(() => media.setMatches('(hover: hover) and (pointer: fine)', true));
    expect(result.current).toBe(true);
  });
});
