#!/usr/bin/env node
/**
 * Stop export-only unit tests from growing.
 *
 * `lib-behavioral-coverage-audit.mjs` finds tests that assert only that an export exists
 * (`typeof x === 'function'`). Those pass whether or not the code works, so they inflate
 * confidence without proving anything.
 *
 * The audit's current list is the baseline. This gate fails when:
 *   - a file becomes export-only and is not in the baseline (new debt), or
 *   - a baseline entry no longer is (the baseline must shrink, so it stays honest).
 *
 * Fix by writing a behavioural test (an input, an expected output, an edge case), not by
 * regenerating the baseline. `--write` exists for the day the audit's own heuristic changes.
 *
 * Usage: node scripts/dev/check-unit-test-quality.mjs [--write]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE = path.join(ROOT, 'scripts/dev/unit-test-quality-baseline.json');

const raw = execFileSync(process.execPath, ['scripts/dev/lib-behavioral-coverage-audit.mjs', '--json'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
const audit = JSON.parse(raw);
const current = new Set(audit.exportOnly);

if (process.argv.includes('--write')) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        $comment:
          'Shrink-only ratchet for check-unit-test-quality.mjs. Each entry is a branching lib whose test only asserts that exports exist. Replace the test with behavioural cases and delete the entry.',
        exportOnly: [...current].sort(),
      },
      null,
      2
    )}\n`
  );
  console.log(`unit test quality: baseline rewritten with ${current.size} entries.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const allowed = new Set(baseline.exportOnly ?? []);
const problems = [];

for (const file of [...current].sort()) {
  if (!allowed.has(file)) problems.push(`${file}: export-only test, not in the baseline`);
}
for (const file of [...allowed].sort()) {
  if (!current.has(file)) {
    problems.push(`${file}: baseline entry is stale (the test is behavioural now). Delete it.`);
  }
}

console.log(
  `unit test quality: ${current.size} export-only branching libs (baseline ${allowed.size}).`
);

if (problems.length > 0) {
  console.error('');
  for (const problem of problems) console.error(`  ✖ ${problem}`);
  console.error('');
  process.exit(1);
}
