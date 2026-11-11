#!/usr/bin/env node
/**
 * boot-durations — per-call start and duration for an authenticated dashboard boot.
 *
 * Why CDP and not `performance.getEntriesByType('resource')`
 * ---------------------------------------------------------
 * The Resource Timing buffer is a fixed ring: once it fills, older entries are dropped and
 * your list silently comes back short. That is not theoretical here. A run that used it
 * reported `property-team-members` absent, which was read as "the call is gone" when the
 * entry had simply been evicted. Twice.
 *
 * CDP `Network.requestWillBeSent` / `responseReceived` events are not buffered the same way,
 * so the request set is complete. Use this, not the Resource Timing API, whenever the
 * question is "did this call happen".
 *
 * Usage:
 *   node scripts/performance/boot-durations.mjs
 *
 * Env:
 *   PERF_SESSION    path to a saved Supabase session JSON   (default /tmp/session.json)
 *   PERF_URL        dashboard URL to open                   (default test tenant)
 *   PERF_ROUTES     comma-separated paths to sample         (default: dashboard only)
 *   PERF_RUNS       runs per route to median over           (default 3)
 *
 * Clear `ui/node_modules/.vite` before a comparison: a dep cache built from a stashed tree
 * serves a stale module graph and silently invalidates the numbers.
 */

import { readFileSync } from 'node:fs';

import { chromium } from 'playwright';

const SESSION_PATH = process.env.PERF_SESSION ?? '/tmp/session.json';
const BASE_URL = process.env.PERF_BASE ?? 'https://kamespace.com';
const DEFAULT_PATH = '/org/kame-test-tenant/property/kame-test-property';
const PATHS = (process.env.PERF_ROUTES ?? DEFAULT_PATH).split(',').map((path) => path.trim());
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

const collect = async (path) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  /** url key -> pending request record */
  const pending = new Map();
  const calls = [];
  let base = null;

  cdp.on('Network.requestWillBeSent', (event) => {
    const url = event.request.url;
    if (!url.includes('/functions/v1/')) return;
    base ??= event.timestamp;
    pending.set(event.requestId, {
      name: url.split('/functions/v1/')[1].split('?')[0],
      start: Math.round((event.timestamp - base) * 1000),
    });
  });

  cdp.on('Network.loadingFinished', (event) => {
    const record = pending.get(event.requestId);
    if (!record) return;
    pending.delete(event.requestId);
    const end = Math.round((event.timestamp - base) * 1000);
    calls.push({
      name: record.name,
      start: record.start,
      duration: Math.max(0, end - record.start),
    });
  });

  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [AUTH_KEY, JSON.stringify(session)]
  );
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await page
    .waitForFunction(
      () => performance.getEntriesByType('mark').some((m) => m.name === 'route:content'),
      undefined,
      { timeout: 60_000 }
    )
    .catch(() => {});
  await page.waitForTimeout(3_000);

  const content = await page.evaluate(
    () =>
      performance.getEntriesByType('mark').find((m) => m.name === 'route:content')?.startTime ?? 0
  );

  await context.close();
  return { calls, content: Math.round(content) };
};

for (const path of PATHS) {
  const runs = [];
  for (let run = 0; run < RUNS; run++) runs.push(await collect(path));

  const label = path === DEFAULT_PATH ? '/dashboard' : path;
  const content = median(runs.map((run) => run.content));

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

  console.log(`\n=== ${label} ===`);
  console.log(
    `route:content median = ${content} ms  (runs: ${runs.map((r) => r.content).join(', ')})`
  );
  console.log(`distinct calls = ${rows.length}`);
  console.log('start   dur    end    call');
  for (const row of rows) {
    const position = row.start <= content ? 'BEFORE' : 'after ';
    console.log(
      `${String(row.start).padStart(5)}  ${String(row.duration).padStart(5)}  ` +
        `${String(row.end).padStart(5)}  ${position}  ${row.name}`
    );
  }
  console.log(
    `slowest 4: ${[...rows]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 4)
      .map((row) => `${row.name} ${row.duration}ms`)
      .join(', ')}`
  );
}

await browser.close();
