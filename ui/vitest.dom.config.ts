import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Component and hook tests. Separate from `vitest.config.ts` on purpose:
 *
 * - the node project stays exactly as it is (863 files, no DOM, fast);
 * - only `*.test.tsx` runs here, so a file cannot be silently matched by neither
 *   project. A `.ts` file claims the node project, a `.tsx` file claims this one.
 *
 * Scope: stateful UI logic only (hooks with state, guards, gate wrappers, small
 * components with behaviour). Layout, Tailwind classes and shadcn primitives stay
 * in Playwright, which can see a real browser.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    name: 'dom',
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts', './vitest.dom.setup.ts'],
    include: ['src/**/*.test.tsx'],
    passWithNoTests: false,
  },
});
