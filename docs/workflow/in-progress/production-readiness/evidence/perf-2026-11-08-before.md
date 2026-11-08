# Perf baseline: before (2026-11-08)

Production project `fworvijbrwpyngycotbz`. Every capture here is read-only: `pg_stat_statements`,
`pg_stat_user_tables`, and the Management API advisors. No reset, no writes.

Companion to `docs/workflow/in-progress/app-speed-root-cause-overhaul.md`.
Machine-readable query snapshot: `2026-11-08-pg-stat-before.json`.

## Database

| Metric                  | Value                               |
| ----------------------- | ----------------------------------- |
| Database size           | 101 MB                              |
| Table size / index size | 3.8 MB / 9.5 MB                     |
| Index hit rate          | 1.00                                |
| Table hit rate          | 1.00                                |
| Stats reset             | 2026-08-04 (96 days before capture) |
| WAL size                | 128 MB                              |

Cache is not the problem. The database is small and every read hits cache. Any DB work has to
be justified by a slow or frequent statement, not by "add an index".

### Top statements by total execution time

| Share of DB time | Total         | Calls     | Statement                                                                                                                 |
| ---------------- | ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| **85.02%**       | 12,880,918 ms | 1,664,792 | `SELECT wal->>$5 as type, wal->>$6 as schema, wal->>$7 as table, COALESCE(wal->>$8, $9) as ...` (Realtime `list_changes`) |
| 2.25%            | 341,562 ms    | 869       | `SELECT name FROM pg_timezone_names`                                                                                      |
| 1.85%            | 279,653 ms    | 24,923    | `SELECT net.http_post(...)` (cron fan-out)                                                                                |
| 0.71%            | 107,219 ms    | 177       | extension inventory query                                                                                                 |
| 0.65%            | 98,237 ms     | 869       | recursive base-type walk (domain resolution)                                                                              |

**RC-16 confirmed, and worse than the 84% recorded in the plan.** Realtime Postgres Changes
polling is 85% of all database time. It is ~7.7 ms per call across 1.66 million calls.

Two secondary findings the plan did not have:

- `SELECT name FROM pg_timezone_names` costs **393 ms per call** and runs 869 times. That is
  341 seconds of database time for a static catalogue. It is a candidate for a one-off cache or
  a narrower query.
- The recursive domain base-type walk runs 869 times at ~113 ms per call, on the same cadence.

Two reads share the same 869 call count, which points at a single repeated introspection pass
rather than application traffic.

## Advisors

`perf:supabase:advisors` on the same project:

| Class       | Findings                   |
| ----------- | -------------------------- |
| Security    | 119 (`INFO` 114, `WARN` 5) |
| Performance | 218 (`INFO` 218, `WARN` 0) |

No performance `WARN`. The five security `WARN`s belong to the security plan, not this one.

## Bundle

`bun run build` on `origin/develop` plus `check-initial-bundle-budget.mjs`:

| Metric                                   | Gzip      |
| ---------------------------------------- | --------- |
| Entry                                    | 246.5 KiB |
| 9 initial chunks (entry + modulepreload) | 633.2 KiB |

Initial graph, gzip: entry 246.5, react-vendor 90.8, observability-vendor 90.7, supabase-vendor
55.9, radix-vendor 47.2, motion-vendor 46.7, icons-vendor 22.2, ui-vendor 20.6, query-vendor 12.7.

`observability-vendor` is 90.7 KiB on the critical path even though nothing it records is needed
for first paint. `motion-vendor` is 46.7 KiB.

The budget gate currently allows 500 KiB entry and 1200 KiB initial, so today's numbers pass with
~2x headroom and the gate cannot catch a regression. Lowering it is Phase 8.1.

## Dashboard cold open, measured in the lab

`bun run perf:boot-timeline` (`ui/e2e/features/observability/adminBootTimeline.spec.ts`) opens
the property dashboard against mocked edge calls and reads the Phase 0.1 boot marks. Three
runs each, 390x844.

| Mark             | 1x CPU | 4x CPU throttle |
| ---------------- | ------ | --------------- |
| `firstRenderMs`  | 40 ms  | 130 ms          |
| `loaderMs`       | 587 ms | 748 ms          |
| `routeContentMs` | 812 ms | 1410 ms         |

What this proves, and what it does not.

- The loader **is not CPU-bound**. At 4x CPU it grows 27%. With the network fully mocked,
  a 587 ms loader is time spent waiting on promises, not parsing or rendering.
- `HIDE_BRIDGE_MS` in `appLoaderHost.ts` is a fixed **220 ms** of that number, on purpose:
  it bridges Suspense to the guards without a blank flash.
- So roughly 370 ms is the guard and query chain even when every response is instant. Against
  real edge calls, which the probes measured at 2.2 to 5.1 s cold and ~0.3 s warm, the same
  chain is the 2 to 3 s the user reports.
- `routeContentMs` doubles under 4x CPU (812 to 1410), so the phase after the loader is the
  CPU-sensitive one. That is where `AdminLayout` render cost (RC-14) lives.

Conclusion: the cold open is a **network waterfall with a CPU tail**, not a bundle problem.
Phase 3.1 (one bootstrap call) is the right fix for the loader; RC-14 is the right fix for the
tail. Neither can be measured further without a read-only host account, because this harness
answers every call instantly.

## Not captured in this pass

- Lighthouse on production routes. Needs to run without other work on the machine.
- Authenticated edge latency per function. Needs a real host session token.
- `Server-Timing` phase split from production. Needs the Phase 0.2 build deployed.
