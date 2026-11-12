#!/usr/bin/env node
/**
 * weekly-report — the "Performance and usage" section, from live sources, read-only.
 *
 * This is the reporting half of the plan's Phase 10. It deliberately does **not** add tables, a
 * cron, or a per-request collector: that is the expensive way to answer "what got slower", and
 * the request path already pays enough (see `-shared/edge-latency` rules).
 *
 * Sources, each optional and each degrading to `skipped` with a reason:
 *
 *   Sentry   transaction and error volume, and errors grouped by route
 *   PostHog  page views grouped by `route_pattern` (shipped 2026-11-12)
 *   bundle   the sizes of the built entry chunks, if `ui/dist` exists
 *   postgres the newest `pg-stat-*.json` snapshot, if one was captured
 *
 * Deliberately absent: p75 latency per page. Sentry's discover endpoint returns an empty list for
 * the transactions dataset with the token this repo has, so the number cannot be read yet. The
 * report says so instead of inventing one.
 *
 * Privacy: route patterns only, never slugs, ids, emails or query strings. No row-level data.
 *
 * Usage:
 *   node scripts/performance/weekly-report.mjs
 *   node scripts/performance/weekly-report.mjs --out=perf-report.md --period=7d
 *
 * Env:
 *   SENTRY_AUTH_TOKEN, SENTRY_ORG (default kame-tech), SENTRY_PROJECT_WEB (default kame-space-web)
 *   POSTHOG_PERSONAL_API_KEY, POSTHOG_HOST (default https://us.posthog.com)
 *   POSTHOG_PROJECT (default @current)
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const outArg = args.find((a) => a.startsWith('--out='));
const periodArg = args.find((a) => a.startsWith('--period='));
const period = periodArg ? periodArg.slice('--period='.length) : '7d';

const SENTRY_ORG = process.env.SENTRY_ORG || 'kame-tech';
const SENTRY_PROJECT_WEB = process.env.SENTRY_PROJECT_WEB || 'kame-space-web';
const POSTHOG_HOST = (process.env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/+$/, '');
const POSTHOG_PROJECT = process.env.POSTHOG_PROJECT || '@current';

/** Reads a key from the repo's local management env file, falling back to process env. */
function readSecret(key) {
  if (process.env[key]) return process.env[key];
  for (const file of ['supabase/.env.management.local', 'supabase/.env.dev.local']) {
    const full = path.join(repoRoot, file);
    if (!existsSync(full)) continue;
    const line = readFileSync(full, 'utf8')
      .split('\n')
      .find((candidate) => candidate.trim().startsWith(`${key}=`));
    if (line)
      return line
        .slice(line.indexOf('=') + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
  }
  return '';
}

const sections = [];
const skipped = [];

function skippedReason(name, reason) {
  skipped.push({ name, reason });
  return { name, reason };
}

/** Sentry: volume per category, and errors grouped by route pattern. */
async function readSentry() {
  const token = readSecret('SENTRY_AUTH_TOKEN');
  if (!token) return skippedReason('Sentry', 'SENTRY_AUTH_TOKEN not set');

  const headers = { Authorization: `Bearer ${token}` };
  const stats = async (category) => {
    const url =
      `https://sentry.io/api/0/organizations/${SENTRY_ORG}/stats_v2/` +
      `?field=sum(quantity)&category=${category}&statsPeriod=${period}&interval=1d`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${category}: HTTP ${response.status}`);
    const body = await response.json();
    return body.groups?.[0]?.totals?.['sum(quantity)'] ?? 0;
  };

  const events = async (field, limit = 15) => {
    const url =
      `https://sentry.io/api/0/organizations/${SENTRY_ORG}/events/` +
      `?project=${encodeURIComponent(SENTRY_PROJECT_WEB)}` +
      `&field=transaction&field=count()&statsPeriod=${period}` +
      `&sort=-count()&per_page=${limit}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`events: HTTP ${response.status}`);
    const body = await response.json();
    return (body.data ?? [])
      .map((row) => ({ route: row.transaction, count: row['count()'] }))
      .sort((a, b) => b.count - a.count);
  };

  try {
    const [transactions, errors, byRoute] = await Promise.all([
      stats('transaction'),
      stats('error'),
      events('transaction'),
    ]);
    return { transactions, errors, byRoute };
  } catch (error) {
    return skippedReason('Sentry', error.message);
  }
}

/** PostHog: page views grouped by route pattern. */
async function readPostHog() {
  const key = readSecret('POSTHOG_PERSONAL_API_KEY');
  if (!key) return skippedReason('PostHog', 'POSTHOG_PERSONAL_API_KEY not set');

  const query = `
    select coalesce(properties.route_pattern, '(before route_pattern shipped)') as route,
           count() as views
    from events
    where event = '$pageview'
      and timestamp > now() - interval ${period === '7d' ? '7 day' : '30 day'}
    group by route
    order by views desc
    limit 15`;

  try {
    const response = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT}/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    });
    if (!response.ok) throw new Error(`HogQL HTTP ${response.status}`);
    const body = await response.json();
    if (body.detail) throw new Error(body.detail);
    return { rows: (body.results ?? []).map(([route, views]) => ({ route, views })) };
  } catch (error) {
    return skippedReason('PostHog', error.message);
  }
}

/**
 * Bundle: the same numbers the build budget enforces, gzipped. The raw size of every lazy chunk is
 * mostly Polotno and video tooling that never loads on a normal page, and including it would drown
 * the signal.
 */
function readBundle() {
  const assets = path.join(repoRoot, 'ui/dist/assets');
  const htmlPath = path.join(repoRoot, 'ui/dist/index.html');
  if (!existsSync(assets) || !existsSync(htmlPath)) {
    return skippedReason('Bundle', 'ui/dist not built');
  }

  const markup = readFileSync(htmlPath, 'utf8');
  const entryMatch = markup.match(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/);
  if (!entryMatch?.[1]) return skippedReason('Bundle', 'no module entry in ui/dist/index.html');

  const initial = new Set([entryMatch[1]]);
  for (const match of markup.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) {
    initial.add(match[1]);
  }

  const gzipBytes = (href) => {
    const file = path.join(repoRoot, 'ui/dist', href.replace(/^\/+/, ''));
    return existsSync(file) ? gzipSync(readFileSync(file)).length : 0;
  };

  let initialGzip = 0;
  for (const href of initial) initialGzip += gzipBytes(href);

  const rawTotal = readdirSync(assets)
    .filter((name) => name.endsWith('.js'))
    .reduce((sum, name) => sum + statSync(path.join(assets, name)).size, 0);

  return {
    entryGzip: gzipBytes(entryMatch[1]),
    initialGzip,
    initialCount: initial.size,
    rawTotal,
    // Keep in step with scripts/performance/check-initial-bundle-budget.mjs.
    entryBudget: 260 * 1024,
    initialBudget: 660 * 1024,
  };
}

/** Postgres: newest captured pg_stat_statements snapshot. */
function readPostgres() {
  const dir = path.join(repoRoot, 'docs/workflow/in-progress/production-readiness/evidence');
  if (!existsSync(dir)) return skippedReason('Postgres', 'no snapshot directory');

  const files = readdirSync(dir)
    .filter((name) => name.startsWith('pg-stat') || name.includes('-pg-stat-'))
    .sort();
  if (files.length === 0) return skippedReason('Postgres', 'no pg-stat snapshot captured');

  try {
    const snapshot = JSON.parse(readFileSync(path.join(dir, files.at(-1)), 'utf8'));
    // Shape written by pg-stat-snapshot.mjs: topByTotalTime / topByMeanTime.
    const rows = (snapshot.topByTotalTime ?? []).slice(0, 8).map((row) => ({
      query: String(row.query ?? '')
        .replace(/\s+/g, ' ')
        .slice(0, 100),
      calls: Number(row.calls ?? 0),
      totalMs: Math.round(Number(row.total_ms ?? 0)),
      meanMs: Number(row.mean_ms ?? 0).toFixed(2),
      share: Number(row.pct_of_total ?? 0).toFixed(1),
      cacheHitPct: row.cache_hit_pct == null ? null : Number(row.cache_hit_pct).toFixed(2),
    }));
    return { file: files.at(-1), rows, capturedAt: snapshot.capturedAt ?? null };
  } catch (error) {
    return skippedReason('Postgres', error.message);
  }
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

const [sentry, posthog] = await Promise.all([readSentry(), readPostHog()]);
const bundle = readBundle();
const postgres = readPostgres();

const lines = [];
lines.push(`# Performance and usage, last ${period}`, '');
lines.push(
  `_Generated ${new Date().toISOString()} from Sentry and PostHog. Route patterns only: no slugs, ids or query strings._`,
  ''
);

lines.push('## Volume', '');
if (sentry.transactions === undefined) {
  lines.push(`- Sentry: skipped (${sentry.reason})`);
} else {
  const errorShare =
    sentry.transactions + sentry.errors > 0
      ? (sentry.errors / (sentry.transactions + sentry.errors)) * 100
      : 0;
  lines.push(`- Sentry transactions: ${sentry.transactions}`);
  lines.push(`- Sentry errors: ${sentry.errors} (${errorShare.toFixed(1)}% of captured events)`);
}
lines.push('');

if (sentry.byRoute?.length) {
  lines.push('## Pages by errors', '');
  lines.push('| Route | Errors |', '| --- | --- |');
  for (const row of sentry.byRoute) lines.push(`| \`${row.route}\` | ${row.count} |`);
  lines.push('');
}

if (posthog.rows?.length) {
  lines.push('## Page views by route pattern', '');
  lines.push('| Route | Views |', '| --- | --- |');
  for (const row of posthog.rows) lines.push(`| \`${row.route}\` | ${row.views} |`);
  lines.push('');
} else if (posthog.reason) {
  lines.push('## Page views by route pattern', '');
  lines.push(`_Skipped: ${posthog.reason}_`, '');
}

if (bundle.entryGzip !== undefined) {
  const over = [];
  if (bundle.entryGzip > bundle.entryBudget) over.push('entry over budget');
  if (bundle.initialGzip > bundle.initialBudget) over.push('initial over budget');
  lines.push('## Frontend weight', '');
  lines.push('| Metric | Value | Budget |', '| --- | --- | --- |');
  lines.push(`| Entry, gzip | ${kb(bundle.entryGzip)} | ${kb(bundle.entryBudget)} |`);
  lines.push(
    `| Initial (${bundle.initialCount} chunks), gzip | ${kb(bundle.initialGzip)} | ${kb(bundle.initialBudget)} |`
  );
  lines.push(`| All built JS, raw | ${kb(bundle.rawTotal)} | n/a, mostly lazy |`);
  lines.push('');
  lines.push(over.length ? `**Over budget: ${over.join(', ')}.**` : 'Within budget.');
  lines.push('');
}

if (postgres.rows?.length) {
  lines.push('## Hot queries', '');
  lines.push(
    `_From \`${postgres.file}\`${postgres.capturedAt ? ` (captured ${postgres.capturedAt.slice(0, 10)})` : ''}, by total time. Run \`bun run perf:pg-stat:snapshot\` to refresh._`,
    ''
  );
  lines.push(
    '| Calls | Total ms | Mean ms | % of total | Cache hit | Statement |',
    '| --- | --- | --- | --- | --- | --- |'
  );
  for (const row of postgres.rows) {
    const cache = row.cacheHitPct == null ? 'n/a' : `${row.cacheHitPct}%`;
    lines.push(
      `| ${row.calls.toLocaleString('en-US')} | ${row.totalMs.toLocaleString('en-US')} | ${row.meanMs} | ${row.share}% | ${cache} | \`${row.query}\` |`
    );
  }
  lines.push('');
}

lines.push('## What this report cannot tell you yet', '');
lines.push(
  '- **Per-page p75 latency.** Sentry ingests transactions, but the API token in this repo cannot read the transactions dataset: `stats_v2` returns volume while `/events/?dataset=transactions` returns an empty list. Until a token with event read on that dataset exists, latency per page is not queryable.',
  '- **Absolute page-view totals.** PostHog capture is consent-gated, so views count consented sessions only.',
  ''
);

if (skipped.length) {
  lines.push('## Skipped sources', '');
  for (const item of skipped) lines.push(`- ${item.name}: ${item.reason}`);
  lines.push('');
}

const report = `${lines.join('\n')}`;
if (outArg) {
  const outPath = path.resolve(repoRoot, outArg.slice('--out='.length));
  writeFileSync(outPath, `${report}\n`);
  console.log(`Written: ${path.relative(repoRoot, outPath)}`);
} else {
  console.log(report);
}
