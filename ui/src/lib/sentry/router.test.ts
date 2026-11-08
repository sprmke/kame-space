import type { createBrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isSentrySdkEnabled = { value: false };
const wrapCreateBrowserRouter = vi.fn();

vi.mock('@/lib/sentry/init', () => ({
  get isSentrySdkEnabled() {
    return isSentrySdkEnabled.value;
  },
}));

vi.mock('@sentry/react', () => ({ wrapCreateBrowserRouter }));

const { wrapRouterForSentry } = await import('@/lib/sentry/router');

/** The wrapper only passes the factory through, so the value is opaque to this test. */
function factoryReturning(value: string): typeof createBrowserRouter {
  return (() => value) as unknown as typeof createBrowserRouter;
}

describe('wrapRouterForSentry', () => {
  beforeEach(() => {
    isSentrySdkEnabled.value = false;
    wrapCreateBrowserRouter.mockReset();
  });

  it('returns the factory untouched when the SDK is off', () => {
    const factory = factoryReturning('router');

    expect(wrapRouterForSentry(factory)).toBe(factory);
    expect(wrapCreateBrowserRouter).not.toHaveBeenCalled();
  });

  it('wraps the factory when the SDK is on', () => {
    isSentrySdkEnabled.value = true;
    const wrapped = factoryReturning('wrapped');
    wrapCreateBrowserRouter.mockReturnValue(wrapped);
    const factory = factoryReturning('router');

    expect(wrapRouterForSentry(factory)).toBe(wrapped);
    expect(wrapCreateBrowserRouter).toHaveBeenCalledWith(factory);
  });

  it('falls back to the raw factory when wrapping throws', () => {
    isSentrySdkEnabled.value = true;
    wrapCreateBrowserRouter.mockImplementation(() => {
      throw new Error('unsupported router');
    });
    const factory = factoryReturning('router');

    expect(wrapRouterForSentry(factory)).toBe(factory);
  });
});
