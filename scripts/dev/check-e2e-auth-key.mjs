#!/usr/bin/env node
/**
 * The Supabase auth storage key must come from one place.
 *
 * `ui/e2e/shared/ids.ts` owns `SUPABASE_AUTH_STORAGE_KEY`. Seven harnesses used to
 * re-declare the literal, so changing the project ref, or seeding a session under the
 * wrong key, failed silently: the page simply looked signed out and the spec failed
 * somewhere else entirely. The key is derived from the project ref, so it also moves
 * whenever the project does.
 *
 * Fails on any `sb-<ref>-auth-token` literal outside `ui/e2e/shared/ids.ts`.
 *
 * Usage: node scripts/dev/check-e2e-auth-key.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCAN_DIRS = ['ui/e2e', 'ui/src'];
const ALLOWED = path.join('ui/e2e/shared/ids.ts');
const KEY_PATTERN = /sb-[a-z0-9]+-auth-token/;
const CODE_FILE = /\.(ts|tsx|mjs|cjs|js|jsx)$/;

async function walk(dir, out = []) {
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      await walk(rel, out);
    } else if (entry.isFile() && CODE_FILE.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const violations = [];
let scanned = 0;

for (const dir of SCAN_DIRS) {
  for (const rel of await walk(dir)) {
    scanned += 1;
    if (rel === ALLOWED) continue;
    const source = await readFile(path.join(ROOT, rel), 'utf8');
    for (const [index, line] of source.split('\n').entries()) {
      if (!KEY_PATTERN.test(line)) continue;
      // The guard itself mentions the pattern in prose.
      if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue;
      violations.push({ rel, line: index + 1, text: line.trim() });
    }
  }
}

if (violations.length > 0) {
  console.error('Supabase auth storage key is hard-coded outside its single source:\n');
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  ${v.text}`);
  }
  console.error(`\nImport SUPABASE_AUTH_STORAGE_KEY from '${ALLOWED.replace(/\.ts$/, '')}' instead.`);
  process.exit(1);
}

console.log(`e2e auth key: 1 definition, ${scanned} files scanned, no literals.`);
