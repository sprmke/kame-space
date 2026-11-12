#!/usr/bin/env node
/**
 * merge-guard — blocks merge and deploy for guarded plans.
 *
 * Why: in this repo `develop` is the production deploy branch (`cd-prod.yml` runs on every
 * push to `develop`), so "do not deploy this plan" is enforced as "do not merge it".
 *
 * Registry: docs/workflow/merge-guard.json
 *
 * Modes:
 *   --mode=merge   (default) fail when the checked-out branch is a guarded branch
 *   --mode=deploy  fail when a guarded module is present in the tree and not cleared
 *
 * Options:
 *   --branch=<name>   override the detected branch (CI uses GITHUB_HEAD_REF)
 *   --root=<path>     repo root, for tests
 *   --self-test       run the built-in cases and exit
 *
 * Clearing: only the owner sets `clearedAt` and `clearedBy` in the registry. Do not remove
 * the entry: a missing registry fails closed.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REGISTRY_PATH = 'docs/workflow/merge-guard.json';

export function readRegistry(root) {
  const file = join(root, REGISTRY_PATH);
  if (!existsSync(file)) {
    return { error: `Missing ${REGISTRY_PATH}. Failing closed.` };
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { error: `Cannot parse ${REGISTRY_PATH}: ${error.message}` };
  }
  if (!parsed || !Array.isArray(parsed.plans)) {
    return { error: `${REGISTRY_PATH} has no plans array. Failing closed.` };
  }
  return { registry: parsed };
}

function isCleared(plan) {
  return typeof plan.clearedAt === 'string' && plan.clearedAt.trim() !== '';
}

export function detectBranch(root) {
  const fromCi = (process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '').trim();
  if (fromCi) return fromCi;
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

/** Pure evaluation so the cases are testable without touching the real tree. */
export function evaluate({ registry, mode, branch, fileExists }) {
  const failures = [];

  for (const plan of registry.plans) {
    if (isCleared(plan)) continue;

    if (mode === 'merge' && plan.blockMerge) {
      const branches = Array.isArray(plan.branches) ? plan.branches : [];
      if (branch && branches.includes(branch)) {
        failures.push({ plan, kind: 'merge' });
      }
      continue;
    }

    if (mode === 'deploy' && plan.blockDeploy) {
      const markers = Array.isArray(plan.deployMarkerFiles) ? plan.deployMarkerFiles : [];
      if (markers.some((marker) => fileExists(marker))) {
        failures.push({ plan, kind: 'deploy' });
      }
    }
  }

  return failures;
}

function describeFailure(failure, mode) {
  const { plan, kind } = failure;
  const lines = [];
  lines.push('');
  lines.push('  ============================================================');
  lines.push(`  MERGE GUARD: ${kind === 'merge' ? 'MERGE' : 'DEPLOY'} BLOCKED`);
  lines.push('  ============================================================');
  lines.push(`  Plan:   ${plan.title ?? plan.slug}`);
  lines.push(`  Slug:   ${plan.slug}`);
  if (kind === 'merge') {
    lines.push(`  Branch: ${(plan.branches ?? []).join(', ')}`);
  }
  lines.push(`  Reason: ${plan.reason ?? 'Guarded by docs/workflow/merge-guard.json'}`);
  lines.push('');
  lines.push('  Merging into develop deploys Supabase to production in this repo.');
  lines.push('  Do not bypass this check, do not remove the registry entry, and do not');
  lines.push('  mark the PR ready. Only the owner clears it, by setting clearedAt and');
  lines.push(`  clearedBy in ${REGISTRY_PATH}.`);
  lines.push('  ============================================================');
  lines.push('');
  return lines.join('\n');
}

function selfTest() {
  const registry = {
    plans: [
      {
        slug: 'guarded',
        branches: ['feat/guarded'],
        blockMerge: true,
        blockDeploy: true,
        deployMarkerFiles: ['module.ts'],
        clearedAt: null,
      },
      {
        slug: 'cleared',
        branches: ['feat/cleared'],
        blockMerge: true,
        blockDeploy: true,
        deployMarkerFiles: ['cleared.ts'],
        clearedAt: '2026-11-20T00:00:00Z',
      },
    ],
  };
  const cases = [
    {
      name: 'merge blocks the guarded branch',
      input: { registry, mode: 'merge', branch: 'feat/guarded', fileExists: () => false },
      expected: 1,
    },
    {
      name: 'merge allows another branch',
      input: { registry, mode: 'merge', branch: 'feat/other', fileExists: () => false },
      expected: 0,
    },
    {
      name: 'merge allows a cleared plan',
      input: { registry, mode: 'merge', branch: 'feat/cleared', fileExists: () => false },
      expected: 0,
    },
    {
      name: 'deploy blocks when the module is present',
      input: { registry, mode: 'deploy', branch: 'develop', fileExists: (f) => f === 'module.ts' },
      expected: 1,
    },
    {
      name: 'deploy allows when the module is absent',
      input: { registry, mode: 'deploy', branch: 'develop', fileExists: () => false },
      expected: 0,
    },
    {
      name: 'deploy allows a cleared plan',
      input: { registry, mode: 'deploy', branch: 'develop', fileExists: (f) => f === 'cleared.ts' },
      expected: 0,
    },
  ];

  let failed = 0;
  for (const testCase of cases) {
    const actual = evaluate(testCase.input).length;
    const pass = actual === testCase.expected;
    if (!pass) failed += 1;
    console.log(
      `${pass ? 'PASS' : 'FAIL'}  ${testCase.name} (expected ${testCase.expected}, got ${actual})`
    );
  }
  if (failed > 0) {
    console.error(`\nmerge-guard self-test: ${failed} case(s) failed`);
    process.exit(1);
  }
  console.log('\nmerge-guard self-test: all cases passed');
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--self-test')) {
    selfTest();
    return;
  }

  const modeArg = argv.find((arg) => arg.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'merge';
  if (mode !== 'merge' && mode !== 'deploy') {
    console.error(`Unknown --mode=${mode}. Use merge or deploy.`);
    process.exit(2);
  }

  const rootArg = argv.find((arg) => arg.startsWith('--root='));
  const root = rootArg
    ? rootArg.split('=')[1]
    : join(fileURLToPath(new URL('.', import.meta.url)), '../..');

  const branchArg = argv.find((arg) => arg.startsWith('--branch='));
  const branch = branchArg ? branchArg.split('=')[1] : detectBranch(root);

  const { registry, error } = readRegistry(root);
  if (error) {
    console.error(error);
    process.exit(1);
  }

  const failures = evaluate({
    registry,
    mode,
    branch,
    fileExists: (file) => existsSync(join(root, file)),
  });

  if (failures.length === 0) {
    console.log(`merge-guard (${mode}): clear (branch: ${branch || 'unknown'})`);
    return;
  }

  for (const failure of failures) {
    console.error(describeFailure(failure, mode));
  }
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
