#!/usr/bin/env node
/**
 * Fails when local-only tooling points at the retired `monaco-2612` identity
 * or the old `org/kame-home` path.
 *
 * Canonical local identity: kame-homes / kame-home / monaco-level-2-slot-27.
 * See docs/guides/testing/local-seed-data.md.
 *
 * Scans scripts/dev, ui/e2e, and docs/guides. Archived docs and unit-test
 * fixtures are intentionally out of scope.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const TARGETS = ['scripts/dev', 'ui/e2e', 'docs/guides'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.sql', '.sh', '.md', '.json', '.toml']);
const FORBIDDEN = [
  { pattern: /monaco-2612/g, hint: 'use kame-home' },
  { pattern: /org\/kame-home\//g, hint: 'use org/kame-homes/' },
  { pattern: /seed:monaco-2612/g, hint: 'retired seed' },
];

const IGNORE = new Set(['scripts/dev/check-seed-identity.mjs']);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full);
    if (IGNORE.has(rel)) continue;
    if (entry === 'node_modules' || entry === '.worktrees' || entry === 'artifacts') continue;
    const stats = statSync(full);
    if (stats.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) yield full;
  }
}

const failures = [];
for (const target of TARGETS) {
  let dir;
  try {
    dir = join(ROOT, target);
    statSync(dir);
  } catch {
    continue;
  }
  for (const file of walk(dir)) {
    const rel = relative(ROOT, file);
    const text = readFileSync(file, 'utf8');
    for (const { pattern, hint } of FORBIDDEN) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (!match) continue;
      const line = text.slice(0, match.index).split('\n').length;
      failures.push(`${rel}:${line}  ${match[0]}  (${hint})`);
    }
  }
}

if (failures.length > 0) {
  console.error('Retired local seed identity found:\n');
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('\nCanonical: kame-homes / kame-home / monaco-level-2-slot-27');
  process.exit(1);
}

console.log('seed identity OK: no retired monaco-2612 references');
