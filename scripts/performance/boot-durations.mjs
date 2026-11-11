#!/usr/bin/env node
/**
 * boot-durations — per-call durations for an authenticated dashboard boot.
 *
 * `perf:boot-timeline` (the Playwright spec) records *when* each edge call starts. That is
 * enough to see ordering, but it cannot separate "started early and took 6s" from "started
 * late and took 100ms", which is the difference between a real defect and a queueing artefact.
 * This script reads the Navigation Timing resource entries instead, so every call gets a
 * start, a duration and an end.
 *
 * Usage:
 *   node scripts/performance/boot-durations.mjs
 *
 * Env:
 *   PERF_SESSION    path to a saved Supabase session JSON   (default /tmp/session.json)
 *   PERF_URL        dashboard URL to open                   (default test tenant)
 *   PERF_RUNS       runs to median over                      (default 3)
 *
 * The saved session must be injected into the Supabase auth localStorage key, so the mint
 * step is separate (a magic-link `generate_link` + `verify` leaves no password grant).
 * Clear `ui/node_modules/.vite` first: a dep cache built from a stashed tree serves a stale
 * module graph and silently invalidates the comparison.
 */

import { readFileSync } from 'node:fs';

import { chromium } from 'playwright';

const SESSION_PATH = process.env.PERF_SESSION ?? '/tmp/session.json';
const URL =
  process.env.PERF_URL ?? 'https://kamespace.com/org/kame-test-tenant/property/kame-test-property';
const RUNS = Number(process.env.PERF_RUNS ?? 3);
const AUTH_KEY = 'sb-fworvijbrwpyngycotbz-auth-token';

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  return sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
};

const session = JSON.parse(readFileSync(SESSION_PATH, 'utf8'));
const browser = await chromium.launch();
const runs = [];

for (let run = 0; run < RUNS; run++) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  // Matches the mid-range phone the mobile budget assumes.
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [AUTH_KEY, JSON.stringify(session)]
  );

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page
    .waitForFunction(
      () => performance.getEntriesByType('mark').some((m) => m.name === 'route:content'),
      undefined,
      { timeout: 60_000 }
    )
    .catch(() => {});
  await page.waitForTimeout(3_000);

  runs.push(
    await page.evaluate(() => {
      const marks = Object.fromEntries(
        performance.getEntriesByType('mark').map((m) => [m.name, Math.round(m.startTime)])
      );
      const calls = performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('/functions/v1/'))
        .map((entry) => ({
          name: entry.name.split('/functions/v1/')[1].split('?')[0],
          start: Math.round(entry.startTime),
          duration: Math.round(entry.duration),
        }));
      return { marks, calls };
    })
  );
  await context.close();
}

await browser.close();

const contentMedians = runs.map((run) => run.marks['route:content'] ?? 0);
const content = median(contentMedians);

const byName = new Map();
for (const run of runs) {
  for (const call of run.calls) {
    const bucket = byName.get(call.name) ?? { start: [], duration: [] };
    bucket.start.push(call.start);
    bucket.duration.push(call.duration);
    byName.set(call.name, bucket);
  }
}

const rows = [...byName.entries()]
  .map(([name, bucket]) => {
    const start = median(bucket.start);
    const duration = median(bucket.duration);
    return { name, start, duration, end: start + duration };
  })
  .sort((a, b) => a.start - b.start);

console.log(`route:content median = ${content} ms  (runs: ${contentMedians.join(', ')})\n`);
console.log('start   dur    end    call');
for (const row of rows) {
  const position = row.start <= content ? 'BEFORE' : 'after ';
  console.log(
    `${String(row.start).padStart(5)}  ${String(row.duration).padStart(5)}  ` +
      `${String(row.end).padStart(5)}  ${position}  ${row.name}`
  );
}

const before = rows.filter((row) => row.start <= content);
console.log(`\ndistinct calls: ${rows.length}, started before content: ${before.length}`);
console.log(`sum of durations: ${rows.reduce((total, row) => total + row.duration, 0)} ms`);
console.log(
  `slowest 6 by duration: ${[...rows]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 6)
    .map((row) => `${row.name} ${row.duration}ms`)
    .join(', ')}`
);
