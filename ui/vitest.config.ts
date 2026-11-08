import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Unit tests only (pure logic). No DOM env — the DOM-touching orchestrator
// (`optimizeImage`) is exercised by the Playwright quality/perf checks, not here.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*Test.ts', 'src/**/*.test.ts'],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      include: ['src/**/lib/**/*.ts', 'src/utils/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*Test.ts', '**/types.ts', '**/*Mock*.ts', '**/*mock*.ts'],
      // Floor at this branch's measured value (2026-11-08: 39.9 / 33.0 / 37.1 / 41.4).
      // Ratchet up only. A new lib file with no test lowers the average, which is the
      // point: it fails the gate. Raise these numbers with the behavioural work.
      thresholds: {
        statements: 39.9,
        branches: 33,
        functions: 37,
        lines: 41.4,
      },
    },
  },
});
