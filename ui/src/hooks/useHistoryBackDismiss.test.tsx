import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useHistoryBackDismiss } from '@/hooks/useHistoryBackDismiss';

type Props = { open: boolean };

function setup(onDismiss = vi.fn()) {
  const hook = renderHook(({ open }: Props) => useHistoryBackDismiss(open, onDismiss), {
    initialProps: { open: false },
  });
  return { ...hook, onDismiss };
}

function overlayToken(): unknown {
  return (window.history.state as Record<string, unknown> | null)?.__kameOverlay ?? null;
}

describe('useHistoryBackDismiss', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pushes one entry on open and keeps the router state', () => {
    window.history.replaceState({ usr: null, key: 'abc', idx: 3 }, '');
    const push = vi.spyOn(window.history, 'pushState');
    const { rerender } = setup();

    rerender({ open: true });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[0]).toMatchObject({ key: 'abc', idx: 3 });
    expect(overlayToken()).toBeTruthy();
  });

  it('dismisses when Back pops the entry', () => {
    const { rerender, onDismiss } = setup();
    rerender({ open: true });

    act(() => {
      window.history.replaceState({ key: 'abc', idx: 3 }, '');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('pops its own entry when closed from the UI', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { rerender, onDismiss } = setup();
    rerender({ open: true });

    rerender({ open: false });

    expect(back).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('hands the entry to a replace navigation via consume()', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { result, rerender } = setup();
    rerender({ open: true });

    expect(result.current.consume()).toBe(true);
    expect(result.current.consume()).toBe(false);
    rerender({ open: false });

    expect(back).not.toHaveBeenCalled();
  });

  it('does not pop when something else already replaced the entry', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { result, rerender } = setup();
    rerender({ open: true });

    window.history.replaceState({ key: 'next', idx: 4 }, '');
    expect(result.current.consume()).toBe(false);
    rerender({ open: false });

    expect(back).not.toHaveBeenCalled();
  });
});
