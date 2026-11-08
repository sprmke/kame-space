#!/usr/bin/env node
/**
 * Edge function coverage ratchet.
 *
 * A function is covered when `supabase/functions/tests/handlers/<fn>.test.ts` exists.
 * Today none do: `serveAdmin` / `servePublic` call `serve()` at module scope, so an
 * `index.ts` cannot be imported without starting a server. That is why this gate is a
 * ratchet rather than a pass/fail on completeness.
 *
 * Rules:
 *   - a function directory that is neither in the baseline nor covered → fail (new debt);
 *   - a baseline entry with no matching directory → fail (the baseline must shrink).
 *
 * When the Phase 1 handler-testability spike lands, delete entries as tests appear.
 *
 * Usage: node scripts/dev/check-edge-test-coverage.mjs [--write]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FUNCTIONS = path.join(ROOT, 'supabase/functions');
const HANDLERS = path.join(FUNCTIONS, 'tests/handlers');
const BASELINE = path.join(ROOT, 'scripts/dev/edge-handler-baseline.json');

const NOT_FUNCTIONS = new Set(['_shared', 'tests', 'node_modules']);

function functionDirs() {
  return readdirSync(FUNCTIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NOT_FUNCTIONS.has(entry.name) && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

function coveredDirs() {
  try {
    return new Set(
      readdirSync(HANDLERS)
        .filter((file) => file.endsWith('.test.ts'))
        .map((file) => file.replace(/\.test\.ts$/, ''))
    );
  } catch {
    return new Set();
  }
}

const all = functionDirs();
const covered = coveredDirs();

if (process.argv.includes('--write')) {
  const uncovered = all.filter((name) => !covered.has(name));
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        $comment:
          'Shrink-only ratchet for check-edge-test-coverage.mjs. Each entry is an edge function with no supabase/functions/tests/handlers/<fn>.test.ts. Delete entries as handler tests land.',
        uncovered,
      },
      null,
      2
    )}\n`
  );
  console.log(`edge handler coverage: baseline rewritten with ${uncovered.length} uncovered functions.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const allowed = new Set(baseline.uncovered ?? []);
const problems = [];

for (const name of all) {
  if (!covered.has(name) && !allowed.has(name)) {
    problems.push(`supabase/functions/${name}: no handler test and no baseline entry`);
  }
}
for (const name of [...allowed].sort()) {
  if (!all.includes(name)) {
    problems.push(`baseline lists ${name}, but that function no longer exists`);
  } else if (covered.has(name)) {
    problems.push(`${name}: now has a handler test. Delete its baseline entry.`);
  }
}

console.log(
  `edge handler coverage: ${covered.size} of ${all.length} functions have a handler test ` +
    `(${allowed.size} baselined).`
);

if (problems.length > 0) {
  console.error('');
  for (const problem of problems) console.error(`  ✖ ${problem}`);
  console.error('');
  process.exit(1);
}
