#!/usr/bin/env bun
/**
 * Every adopted page guide must have a decision for each of its behavioural sections.
 *
 * `ui/e2e/pages/**\/*.coverage.ts` manifests claim a guide section with a spec, or mark it
 * `na` with a reason. This check fails when a section has neither, when a claimed spec does
 * not exist, or when a claim points at a heading the guide no longer has. Sections that are
 * not covered yet live in `ui/e2e/coverage-baseline.json`, which is shrink-only: an entry
 * that is no longer needed fails the check until it is removed.
 *
 * Adoption is per page. A guide without a manifest is simply not adopted yet and is counted
 * in the progress line, not failed.
 *
 * Usage:
 *   bun scripts/dev/check-test-coverage.ts            # check
 *   bun scripts/dev/check-test-coverage.ts --write    # rewrite the baseline
 *   bun scripts/dev/check-test-coverage.ts --report   # regenerate coverage-report.md
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { PageCoverage } from '../../ui/e2e/shared/pageCoverage/definePageCoverage.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST_DIR = 'ui/e2e/pages';
const GUIDE_DIR = 'docs/guides/routes';
const BASELINE = 'ui/e2e/coverage-baseline.json';

/** Headings that describe the document rather than page behaviour. */
const BOILERPLATE = new Set([
  'Progress overview',
  'Overview',
  'Host-facing knowledge',
  'API reference',
  'Implementation map',
  'Testing',
  'Related docs',
]);

type Baseline = Record<string, string[]>;

async function walk(dir: string, suffix: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(rel, suffix, out);
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push(rel);
  }
  return out;
}

async function exists(rel: string): Promise<boolean> {
  try {
    return (await stat(path.join(ROOT, rel))).isFile();
  } catch {
    return false;
  }
}

/** `##` headings outside fenced code blocks. */
function behaviourHeadings(markdown: string): string[] {
  const headings: string[] = [];
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    if (!line.startsWith('## ')) continue;
    const heading = line.slice(3).trim();
    if (!BOILERPLATE.has(heading)) headings.push(heading);
  }
  return headings;
}

function specPath(claim: string): string {
  return claim.split('#')[0];
}

async function readBaseline(): Promise<Baseline> {
  try {
    return JSON.parse(await readFile(path.join(ROOT, BASELINE), 'utf8')) as Baseline;
  } catch {
    return {};
  }
}

const write = process.argv.includes('--write');
const report = process.argv.includes('--report');
const REPORT = 'docs/guides/testing/coverage-report.md';

type GuideStats = {
  guide: string;
  archetype: string;
  levels: string[];
  claimed: number;
  na: number;
  baselined: number;
  gaps: string[];
};
const stats: GuideStats[] = [];

const manifestFiles = await walk(MANIFEST_DIR, '.coverage.ts');
const guides = await walk(GUIDE_DIR, '.md');
const baseline = await readBaseline();

const problems: string[] = [];
const claimsByGuide = new Map<string, PageCoverage>();
const nextBaseline: Baseline = {};

let claimed = 0;
let markedNa = 0;
let baselined = 0;

for (const rel of manifestFiles) {
  let manifest: PageCoverage;
  try {
    manifest = ((await import(pathToFileURL(path.join(ROOT, rel)).href)) as { default: PageCoverage })
      .default;
  } catch (error) {
    problems.push(`${rel}: cannot import manifest (${(error as Error).message})`);
    continue;
  }

  if (!(await exists(manifest.guide))) {
    problems.push(`${rel}: guide not found: ${manifest.guide}`);
    continue;
  }
  if (claimsByGuide.has(manifest.guide)) {
    problems.push(`${rel}: ${manifest.guide} is already claimed by another manifest`);
    continue;
  }
  claimsByGuide.set(manifest.guide, manifest);

  const headings = behaviourHeadings(await readFile(path.join(ROOT, manifest.guide), 'utf8'));
  const known = new Set(headings);

  for (const [heading, claim] of Object.entries(manifest.sections)) {
    if (!known.has(heading)) problems.push(`${rel}: guide has no section "${heading}"`);
    const spec = specPath(claim);
    if (!(await exists(spec))) problems.push(`${rel}: spec not found for "${heading}": ${spec}`);
  }
  for (const heading of Object.keys(manifest.na)) {
    if (!known.has(heading)) problems.push(`${rel}: guide has no section "${heading}" (na)`);
  }
  for (const unit of manifest.unit) {
    if (!(await exists(unit))) problems.push(`${rel}: unit suite not found: ${unit}`);
  }

  const allowed = new Set(baseline[manifest.guide] ?? []);
  const unclaimed: string[] = [];

  for (const heading of headings) {
    if (heading in manifest.sections) {
      claimed += 1;
      continue;
    }
    if (heading in manifest.na) {
      markedNa += 1;
      continue;
    }
    unclaimed.push(heading);
    if (allowed.has(heading)) baselined += 1;
  }

  if (!write) {
    for (const heading of unclaimed) {
      if (allowed.has(heading)) continue;
      problems.push(
        `${rel}: section "${heading}" is neither claimed nor na. Claim a spec, mark it na with a reason, or add it to ${BASELINE}.`
      );
    }
    // Shrink-only: an allowed entry that is now claimed, or gone from the guide, is stale.
    for (const heading of allowed) {
      if (unclaimed.includes(heading)) continue;
      problems.push(
        `${BASELINE}: "${heading}" in ${manifest.guide} is no longer needed. Re-run with --write.`
      );
    }
  }

  if (unclaimed.length > 0) nextBaseline[manifest.guide] = unclaimed;

  stats.push({
    guide: manifest.guide,
    archetype: manifest.archetype,
    levels: manifest.levels,
    claimed: headings.filter((h) => h in manifest.sections).length,
    na: headings.filter((h) => h in manifest.na).length,
    baselined: unclaimed.length,
    gaps: unclaimed,
  });
}

const progress =
  `${manifestFiles.length}/${guides.length} guides adopted · ` +
  `${claimed} sections claimed · ${markedNa} na · ${baselined} baselined`;

if (report) {
  const adopted = new Set(stats.map((row) => row.guide));
  const unadopted = guides
    .map((rel) => rel.split(path.sep).join('/'))
    .filter((rel) => ![...adopted].some((guide) => guide === rel));

  const lines = [
    '# Page coverage report',
    '',
    'Generated by `bun scripts/dev/check-test-coverage.ts --report`. Do not hand-edit.',
    '',
    `**${stats.length} of ${guides.length} guides adopted.** ${claimed} sections claimed by a spec, ${markedNa} marked na, ${baselined} baselined as known gaps.`,
    '',
    '## Adopted pages',
    '',
    '| Guide | Archetype | Levels | Claimed | na | Gap | Open gaps |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...stats.map(
      (row) =>
        `| \`${row.guide.replace('docs/guides/routes/', '')}\` | ${row.archetype} | ${row.levels.join(', ')} | ${row.claimed} | ${row.na} | ${row.baselined} | ${row.gaps.length === 0 ? 'none' : row.gaps.map((gap) => `${gap}`).join('; ')} |`
    ),
    '',
    '## Not adopted yet',
    '',
    ...(unadopted.length === 0
      ? ['Every guide has a manifest.']
      : [
          `${unadopted.length} guides have no manifest. Adoption is per page: add ` +
            '`ui/e2e/pages/<guide path>/<page>.coverage.ts` with `definePageCoverage`.',
          '',
          ...unadopted.map((rel) => `- \`${rel.replace('docs/guides/routes/', '')}\``),
        ]),
    '',
  ];

  await writeFile(path.join(ROOT, REPORT), lines.join('\n'), 'utf8');
  console.log(`test coverage: report written to ${REPORT} (${progress}).`);
  // Fall through to the check: a broken manifest must not produce a report that reads as
  // green, and the exit code still has to reflect the same problems as a plain run.
}

if (write) {
  await writeFile(path.join(ROOT, BASELINE), `${JSON.stringify(nextBaseline, null, 2)}\n`, 'utf8');
  console.log(`test coverage: baseline written (${progress}).`);
  process.exit(0);
}

if (problems.length > 0) {
  console.error(`test coverage: ${problems.length} problem(s)\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`\n${progress}`);
  process.exit(1);
}

console.log(`test coverage: ok. ${progress}`);
