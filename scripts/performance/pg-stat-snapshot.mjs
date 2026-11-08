#!/usr/bin/env node
/**
 * Read-only `pg_stat_statements` snapshot.
 *
 * The shell version (`capture-pg-stat-statements.sh`) needs `psql`, which is not
 * installed everywhere and is a hard blocker for the query phase of the app-speed
 * plan. This does the same read through the `pg` package the repo already depends on,
 * so a developer with only Bun installed can still capture a baseline.
 *
 * Read-only. It runs two SELECTs and writes a JSON file. It never resets stats;
 * week-over-week deltas come from diffing snapshots (see the app-speed plan, 10.3).
 *
 *   DB_URL='postgresql://...' node scripts/performance/pg-stat-snapshot.mjs \
 *     [--label=prod] [--limit=25]
 *
 * or put the connection string in `supabase/.env.management.local` as
 * `PROD_DB_URL` and run `bun run perf:pg-stat:snapshot -- --label=prod`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const args = process.argv.slice(2);
const labelArg = args.find((a) => a.startsWith('--label='));
const limitArg = args.find((a) => a.startsWith('--limit='));
const label = labelArg ? labelArg.slice('--label='.length) : 'snapshot';
const limit = limitArg ? Number(limitArg.split('=')[1]) : 25;

/** Read one KEY from a dotenv file without sourcing it into the shell. */
function readEnvFileVar(file, key) {
  try {
    const body = readFileSync(file, 'utf8');
    const line = body.split('\n').find((l) => l.trim().startsWith(`${key}=`));
    if (!line) return '';
    return line
      .slice(line.indexOf('=') + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  } catch {
    return '';
  }
}

const dbUrl =
  process.env.DB_URL ||
  process.env.PROD_DB_URL ||
  process.env.DEV_DB_URL ||
  readEnvFileVar(path.join(repoRoot, 'supabase/.env.management.local'), 'PROD_DB_URL');

if (!dbUrl) {
  console.error(
    'pg-stat-snapshot: no connection string. Set DB_URL, or PROD_DB_URL in ' +
      'supabase/.env.management.local.'
  );
  process.exit(1);
}

const TOP_BY_TOTAL = `
  SELECT
    queryid::text                                   AS queryid,
    regexp_replace(left(query, 200), '\\s+', ' ', 'g') AS query,
    calls,
    round(total_exec_time::numeric, 1)              AS total_ms,
    round(mean_exec_time::numeric, 2)               AS mean_ms,
    round((100 * total_exec_time / NULLIF(sum(total_exec_time) OVER (), 0))::numeric, 2)
                                                    AS pct_of_total,
    rows,
    shared_blks_hit                                 AS cache_hits,
    shared_blks_read                                AS disk_reads,
    round((100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 2)
                                                    AS cache_hit_pct
  FROM pg_stat_statements
  WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  ORDER BY total_exec_time DESC
  LIMIT $1
`;

const TOP_BY_MEAN = `
  SELECT
    queryid::text                                   AS queryid,
    regexp_replace(left(query, 200), '\\s+', ' ', 'g') AS query,
    calls,
    round(total_exec_time::numeric, 1)              AS total_ms,
    round(mean_exec_time::numeric, 2)               AS mean_ms,
    rows
  FROM pg_stat_statements
  WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    AND calls >= 5
  ORDER BY mean_exec_time DESC
  LIMIT $1
`;

const OVERVIEW = `
  SELECT
    round(sum(total_exec_time)::numeric, 0)                        AS total_exec_ms,
    count(*)                                                       AS statements,
    (SELECT stats_reset FROM pg_stat_statements_info)               AS stats_reset,
    (SELECT pg_size_pretty(pg_database_size(current_database())))   AS db_size
  FROM pg_stat_statements
`;

/** `queryid` is stable across snapshots, so week-over-week deltas key on it. */
async function main() {
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const overview = (await client.query(OVERVIEW)).rows[0] ?? {};
    const byTotal = (await client.query(TOP_BY_TOTAL, [limit])).rows;
    const byMean = (await client.query(TOP_BY_MEAN, [limit])).rows;

    const snapshot = {
      capturedAt: new Date().toISOString(),
      label,
      mode: 'pg_stat_statements-read-only',
      overview,
      topByTotalTime: byTotal,
      topByMeanTime: byMean,
    };

    const outDir = path.join(repoRoot, 'docs/workflow/in-progress/production-readiness/evidence');
    mkdirSync(outDir, { recursive: true });
    const stamp = snapshot.capturedAt.slice(0, 10);
    const outFile = path.join(outDir, `${stamp}-pg-stat-${label}.json`);
    writeFileSync(outFile, `${JSON.stringify(snapshot, null, 2)}\n`);

    console.log(
      `[pg-stat] ${byTotal.length} statements, db ${overview.db_size ?? '?'}, ` +
        `stats reset ${overview.stats_reset ?? 'never'}`
    );
    console.log(`[pg-stat] snapshot in ${outFile}`);
    for (const row of byTotal.slice(0, 8)) {
      console.log(
        `  ${String(row.pct_of_total).padStart(6)}%  ${String(row.total_ms).padStart(10)}ms  ` +
          `${String(row.calls).padStart(8)} calls  ${row.query.slice(0, 90)}`
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`pg-stat-snapshot failed: ${error.message}`);
  process.exit(1);
});
