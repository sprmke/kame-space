#!/usr/bin/env node
/**
 * Route guides must not point at tests that no longer exist.
 *
 * Every `docs/guides/routes/**` page ends with a `## Testing` table naming the specs that
 * cover it. Those paths are hand-written prose, so a renamed or deleted spec leaves the
 * guide lying, and nobody notices until they go looking for the test.
 *
 * This check fails on a referenced `ui/e2e/**\/*.spec.ts` path that is not on disk. It also
 * prints how much of the spec suite is claimed by a guide, as a progress number for the
 * page-manifest work (Phase 3 of the test architecture plan) rather than a gate.
 *
 * Usage: node scripts/dev/check-guide-spec-refs.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GUIDES = path.join(ROOT, 'docs/guides/routes');
const SPEC_PATH = /ui\/e2e\/[A-Za-z0-9_./-]+\.spec\.ts/g;

async function walkMarkdown(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkMarkdown(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

async function exists(rel) {
  try {
    await stat(path.join(ROOT, rel));
    return true;
  } catch {
    return false;
  }
}

const guides = await walkMarkdown(GUIDES);
const problems = [];
const referenced = new Set();
let referenceCount = 0;

for (const guide of guides) {
  const rel = path.relative(ROOT, guide);
  const source = await readFile(guide, 'utf8');

  for (const match of source.matchAll(SPEC_PATH)) {
    referenceCount += 1;
    const spec = match[0];
    referenced.add(spec);
    if (!(await exists(spec))) {
      problems.push(`${rel}: points at ${spec}, which does not exist`);
    }
  }
}

const specs = [];
for (const dir of ['ui/e2e']) {
  const walk = async (current) => {
    for (const entry of await readdir(path.join(ROOT, current), { withFileTypes: true })) {
      const rel = `${current}/${entry.name}`;
      if (entry.isDirectory()) await walk(rel);
      else if (entry.name.endsWith('.spec.ts')) specs.push(rel);
    }
  };
  await walk(dir);
}

const unclaimed = specs.filter((spec) => !referenced.has(spec));

console.log(
  `guide → spec refs: ${referenceCount} references across ${guides.length} guides; ` +
    `${specs.length - unclaimed.length}/${specs.length} specs are claimed by a guide.`
);

if (problems.length > 0) {
  console.error('');
  for (const problem of problems) console.error(`  ✖ ${problem}`);
  console.error('');
  process.exit(1);
}

if (process.argv.includes('--list-unclaimed')) {
  for (const spec of unclaimed.sort()) console.log(spec);
}
