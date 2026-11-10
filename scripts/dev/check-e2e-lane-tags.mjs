#!/usr/bin/env node
/**
 * Guard the Playwright lane contract.
 *
 * Every `ui/e2e/**\/*.spec.ts` must carry exactly one lane tag, because the tag is
 * what decides whether CI ever runs it:
 *
 *   @smoke  every PR, three viewports
 *   @ci     every PR, sharded (page + journey specs)
 *   @pwa    project build, service worker
 *   @live   local stack, never PR
 *   @demo   headed, never CI
 *
 * A spec with no tag is collected by no project and silently rots. A spec with two
 * tags runs twice per pipeline.
 *
 * `waitForTimeout` is baselined (shrink-only) so a new one fails the gate. Waits
 * belong on a role, a network idle, or a test id.
 *
 * Usage: node scripts/dev/check-e2e-lane-tags.mjs [--json]
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const E2E = path.join(ROOT, 'ui/e2e');
const BASELINE_PATH = path.join(ROOT, 'scripts/dev/e2e-lane-baseline.json');

const LANES = ['@smoke', '@ci', '@pwa', '@live', '@demo'];

/**
 * `@critical` is a modifier, not a lane: it marks the money, tenancy and workflow
 * journeys that must also run before a production deploy (`test:e2e:critical`).
 * A critical spec still needs exactly one lane tag.
 */
const CRITICAL = '@critical';

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

const rel = (file) => path.relative(ROOT, file);

async function main() {
  const baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'));
  const baselineWaits = baseline.waitForTimeout ?? {};
  const files = (await walk(E2E)).sort();

  const problems = [];
  const waits = {};
  let criticalSpecs = 0;

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const name = rel(file);

    const lanes = LANES.filter((lane) => source.includes(lane));
    if (lanes.length === 0) {
      problems.push(`${name}: no lane tag (add one of ${LANES.join(', ')})`);
    } else if (lanes.length > 1) {
      problems.push(`${name}: ${lanes.join(' + ')} (a spec belongs to exactly one lane)`);
    }

    if (source.includes(CRITICAL)) criticalSpecs += 1;

    if (source.includes(CRITICAL) && lanes.length !== 1) {
      problems.push(`${name}: ${CRITICAL} needs exactly one lane tag, found ${lanes.length}`);
    }

    if (/\btest\s*\.\s*only\s*\(|\bdescribe\s*\.\s*only\s*\(/.test(source)) {
      problems.push(`${name}: .only committed (use a --grep filter locally instead)`);
    }

    const waitCount = (source.match(/waitForTimeout\s*\(/g) ?? []).length;
    if (waitCount > 0) waits[name] = waitCount;
  }

  for (const [file, count] of Object.entries(waits)) {
    const allowed = baselineWaits[file] ?? 0;
    if (count > allowed) {
      problems.push(
        `${file}: ${count} waitForTimeout call(s), baseline ${allowed}. ` +
          'Wait on a role, a mock response, or a test id instead.'
      );
    }
  }
  for (const [file, allowed] of Object.entries(baselineWaits)) {
    const count = waits[file] ?? 0;
    if (count < allowed) {
      problems.push(
        `${file}: baseline says ${allowed} waitForTimeout call(s) but the file has ${count}. ` +
          'Lower the baseline so the guard keeps shrinking.'
      );
    }
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ specs: files.length, problems, waitForTimeout: waits }, null, 2));
  } else {
    console.log(
      `e2e lane guard: ${files.length} specs, one lane tag each, ${criticalSpecs} critical, ` +
        `${Object.values(waits).reduce((total, count) => total + count, 0)} baselined waitForTimeout call(s).`
    );
  }

  if (problems.length > 0) {
    console.error('');
    for (const problem of problems) console.error(`  ✖ ${problem}`);
    console.error('');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
