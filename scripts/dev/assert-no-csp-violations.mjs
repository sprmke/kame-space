#!/usr/bin/env node
/**
 * Fails when the `csp` Playwright project recorded any Content-Security-Policy violation.
 * Production readiness PR-012. Reports are written by `ui/vite-plugins/cspPreview.ts`.
 *
 *   bun run test:e2e:csp
 *
 * Exit 0: the file is absent or empty. Exit 1: one or more violations, grouped for triage.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** `ui/e2e/features/security/cspEnforced.spec.ts` triggers blocked requests on purpose from here. */
export const SELFTEST_PATH_PREFIX = '/__csp-selftest';

function isSelftest(row) {
  if (!row.document) return false;
  return new URL(row.document, 'http://x').pathname.startsWith(SELFTEST_PATH_PREFIX);
}

export function summarizeViolations(ndjson) {
  const rows = ndjson
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { directive: 'unparseable-report' };
      }
    });
  const groups = new Map();
  for (const row of rows.filter((r) => !isSelftest(r))) {
    const key = `${row.directive ?? 'unknown'} | ${row.blocked || '(inline/eval)'}`;
    const entry = groups.get(key) ?? { count: 0, pages: new Set() };
    entry.count += 1;
    if (row.document) entry.pages.add(new URL(row.document, 'http://x').pathname);
    groups.set(key, entry);
  }
  return { total: [...groups.values()].reduce((sum, g) => sum + g.count, 0), groups };
}

const file = resolve(process.argv[2] ?? 'test-results/csp-violations.ndjson');
if (import.meta.url === `file://${process.argv[1]}`) {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const { total, groups } = summarizeViolations(text);
  if (total === 0) {
    console.log('assert-no-csp-violations: OK (0 violations)');
    process.exit(0);
  }
  console.error(`assert-no-csp-violations: ${total} violation(s) in ${groups.size} group(s)`);
  for (const [key, { count, pages }] of groups) {
    console.error(`  ${count}x ${key}\n     on: ${[...pages].slice(0, 5).join(', ')}`);
  }
  process.exit(1);
}
