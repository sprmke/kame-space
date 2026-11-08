import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * DOM test environment shared by every `*.test.tsx` file.
 *
 * happy-dom does not implement `matchMedia` or `ResizeObserver`, and Radix
 * primitives call both on mount. Stubs live here so a component test never has to
 * repeat them.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
