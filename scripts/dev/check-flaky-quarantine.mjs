#!/usr/bin/env node
/**
 * Quarantine discipline for Playwright.
 *
 * A `@flaky` test is excluded from every CI lane (`grepInvert` in playwright.config.ts),
 * which makes it invisible. That is only acceptable with a paper trail:
 *
 *   - a GitHub issue that owns the fix;
 *   - an expiry date, so it cannot rot forever;
 *   - a reason a reader can act on.
 *
 * This guard fails when an entry is missing, expired, or when a spec carries `@flaky`
 * without a registry entry. Remove the entry and the tag together once the test is fixed.
 *
 * Usage: node scripts/dev/check-flaky-quarantine.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY = path.join(ROOT, 'ui/e2e/flaky-quarantine.json');

const ISSUE_PATTERN = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const entries = JSON.parse(await readFile(REGISTRY, 'utf8'));
  const today = todayIso();
  const problems = [];

  if (!Array.isArray(entries)) {
    console.error('flaky-quarantine: expected a JSON array');
    process.exit(1);
  }

  for (const entry of entries) {
    const { spec, test, issue, expires, reason } = entry ?? {};
    const label = `${spec} › ${test}`;

    if (!spec || !test) {
      problems.push(`${label}: spec and test are required`);
      continue;
    }
    if (!issue || !ISSUE_PATTERN.test(issue)) {
      problems.push(`${label}: issue must be a GitHub issue URL`);
    }
    if (!expires || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
      problems.push(`${label}: expires must be YYYY-MM-DD`);
    } else if (expires < today) {
      problems.push(`${label}: quarantine expired on ${expires}. Fix it, or extend with a real reason.`);
    }
    if (!reason || reason.trim().length < 10) {
      problems.push(`${label}: reason must explain what broke`);
    }

    let source;
    try {
      source = await readFile(path.join(ROOT, spec), 'utf8');
    } catch {
      problems.push(`${label}: spec file not found`);
      continue;
    }

    const line = source.split('\n').find((candidate) => candidate.includes(test));
    if (!line) {
      problems.push(`${label}: test title not found in the spec`);
    } else if (!line.includes('@flaky')) {
      problems.push(`${label}: test is registered but not tagged @flaky (remove the entry)`);
    }
  }

  const registered = new Set(entries.map((entry) => entry?.spec));
  const { globbySpecs } = await import('./lib/e2e-specs.mjs');
  for (const { name, source } of await globbySpecs(ROOT)) {
    if (source.includes('@flaky') && !registered.has(name)) {
      problems.push(`${name}: uses @flaky with no entry in ui/e2e/flaky-quarantine.json`);
    }
  }

  if (problems.length > 0) {
    console.error(`flaky quarantine: ${problems.length} problem(s)\n`);
    for (const problem of problems) console.error(`  ✖ ${problem}`);
    console.error('');
    process.exit(1);
  }

  console.log(`flaky quarantine: ${entries.length} entry(ies), all owned and in date.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
