---
title: 'PR-131: public read caching, 2026-11-20'
status: active
stage: in-progress
kind: reference
readiness: verified
launch_gate: A
last_verified: 'hosted 2026-11-19, deploy run 44575415204'
---

# PR-131 / issue #183: public reads under load

Plan context: [`phase8-load-test-2026-10-19.md`](./phase8-load-test-2026-10-19.md) (50 visitors, p95 11 s, listing detail median 12 s). Architecture: [`docs/architecture/edge-functions.md`](../../../../architecture/edge-functions.md) (anonymous public reads).

## Root cause (from code, not guessed)

1. `get-public-property` ran about fifteen queries per call with **no response cache**. The list endpoints had an isolate cache, but `search-listings` and `search-suggestions` had none.
2. **Every** public GET paid a durable `bump_rate_limit` database write before it looked at any cache. The repo measured that write at 120 to 280 ms on 2026-11-09, and a single caller serializes on one counter row, which is also why the single-IP load test saw 27% 429s.
3. Supabase's front does not cache edge responses (`cf-cache-status: DYNAMIC`), so every request reached a function and Postgres.

The database itself is not the limit: after the Micro upgrade the cache hit rate is 1.00 and connections are far below the cap ([`supabase-capacity-2026-11-04.md`](./supabase-capacity-2026-11-04.md)). The load test ran on Nano, before that upgrade.

## Change

- `get-public-property`: isolate cache (30 s, catalog-version keyed, never stores a missing listing, host preview bypasses it).
- Rate limit and cache order is now hit (in memory) then miss (durable). `list-public-*`, `search-listings` and `search-suggestions` use the same wrapper. Date-filtered reads bypass the cache.
- The `?slug=` branch of `list-public-developments` reads the database before the cache and keeps its own durable gate.

## Measured locally

Same handler code, same local Postgres, one Deno process, 400 requests at 25 concurrent clients (`/?property=kame-home`). The old handler is `HEAD`'s file.

|        | Requests/s | p50    | p95    | Max     |
| ------ | ---------- | ------ | ------ | ------- |
| Before | 44         | 541 ms | 839 ms | 1057 ms |
| After  | 953        | 1 ms   | 2 ms   | 3 ms    |

Single requests: miss 56 ms, hit 0.6 ms. Durable counter writes for 6 requests: 1 (the miss).

Per endpoint on a long-lived process, four requests each: one durable write and a sub-2 ms hit for `list-public-properties`, `-parkings`, `-developments`, `-place-groups`, `search-listings` and `search-suggestions`. Miss and hit bodies were identical for all six.

Edge cases exercised: catalog write invalidates within the 5 s version window (renamed listing showed the new name after 6 s and the original after restore); `preview=1` bypasses the cache and writes the counter every call; the `?slug=` branch is metered (3 calls, 3 writes); date-filtered `list-public-properties` is never cached (3 calls, 3 writes); over-limit hits return a CORS 429 with `Retry-After`; a miss over the durable limit returns 429 before any compute; a failing compute is not cached.

Suites: `_shared` 2,084 edge unit tests, 1,148 handler tests, plus `check-cache-class`, `check-serve-public-rate-limit`, `check-authenticated-rate-limit`, `check-select-star` and `check-edge-test-coverage`: all pass. New tests: `publicListingCache_test.ts`, `publicPropertyDetailCache_test.ts`, `publicCachedRead_test.ts`, `rateLimit_test.ts`.

## Verified on the hosted project (2026-11-19)

Merged in [#540](https://github.com/sprmke/kame-space/pull/540) and deployed by `cd-prod.yml` run [44575415204](https://github.com/sprmke/kame-space/actions/runs/44575415204) to `fwor…`, the project that serves production. The deploy redeployed all functions because `_shared/**` moved, then passed its own schema diff, pre-deploy backup, public smoke and migration-parity steps.

Read-only GETs with the anon key against `fwor…` (`x-served-by: supabase-edge-runtime`, `cf-cache-status: DYNAMIC`, so every request did execute in the edge runtime; no CDN answer is inflating the numbers).

| Check                                                  | Result                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| All seven public endpoints                              | 200, and repeat bodies byte-identical                            |
| `get-public-property`, 10 calls                        | **0** durable counter writes                                    |
| `search-listings`, 8 calls                             | **1** durable write (the miss), 7 hits                          |
| `search-suggestions`, 8 calls                          | **0** durable writes                                            |
| `get-public-property` with `preview=1`, 3 calls        | 3 durable writes (bypass, never cached)                         |
| `list-public-properties` date-filtered, 3 calls        | 3 durable writes (bypass, availability never stale)             |
| `list-public-developments?slug=`, 3 calls              | 3 durable writes (database read before the cache)                |
| `get-public-property` control, 3 calls                 | 0 durable writes                                                |

Counter writes were measured by diffing `request_rate_limits` rows for the scope before and after each burst, not inferred from latency.

Latency floor for a single client is about 95 to 110 ms p50, which is network round trip to `ap-northeast-2` plus edge overhead, not cache work. It is the wrong instrument for this change on a warmed isolate; the counter delta above is the measurable proof. Throughput at 25 concurrent clients was measured locally (44 to 953 req/s), not repeated against production, because the shipped k6 script refuses that project and a single IP hits the 60/min public limit.

## Not verified

- **Per-isolate hit rate in production.** Supabase decides how many isolates serve a function. The cache helps most for hot listings and common queries and little for a long tail of distinct queries. The counter deltas above show repeats on one isolate are free; the overall hit rate needs production traffic over time.
- **Sustained throughput under many concurrent visitors.** Not re-run against production on purpose (single-IP limits, and the script refuses the prod ref). The local 25-client figure stands as the throughput evidence.
- **Single-IP 429s** in the old test are unchanged by design.
- Static CDN caching (option A in the load-test write-up) is not done. It would add a Vercel proxy and CORS changes for a smaller gain once the isolate cache absorbs repeats.

## Staleness the guest can see

Up to 30 s for property detail and up to 60 s for lists, on top of the 60 s browser `max-age` the response already advertised. A listing change shows after the next catalog-version read (about 5 s) for lists and search, and after at most 30 s for the detail fields the version does not track (contact info, badges, page config).
