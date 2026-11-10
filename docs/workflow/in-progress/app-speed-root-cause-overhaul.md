---
title: 'App speed: root-cause performance overhaul'
status: planned
stage: in-progress
kind: plan
tags: [performance, pwa, supabase, edge-functions, lighthouse, production-readiness, caching]
updated: 2026-11-10
readiness: unverified
launch_gate: A
launch_blocker: true
last_verified: none
---

# App speed: root-cause performance overhaul

## Goal

Make every surface feel fast: public site, host dashboard, guest portal, and the installed PWA. Today a cold open shows the root `AppLoader` for 2 to 3 s and then a skeleton for another 1 to 3 s, so it takes up to about 6 s to see real content. In the PWA, in-app taps take 0.5 to 1 s before the next screen settles.

We fix this by **proving the root cause first and then changing only what the evidence points at**. Every phase starts with a measurement, ends with the same measurement, and records both in one before/after report.

### Targets (p75 on a mid-range phone, 4G, Manila)

| Metric                                         | Today (observed) | Target    |
| ---------------------------------------------- | ---------------- | --------- |
| Root loader visible, cold open (host)          | 2 to 3 s         | < 0.8 s   |
| Root loader + skeleton, cold open to content   | ~6 s             | < 2.0 s   |
| Warm repeat open, installed PWA                | not measured     | < 1.0 s   |
| In-app tap to next screen content (PWA)        | 0.5 to 1 s       | < 300 ms  |
| Lighthouse mobile Perf, public routes (median) | 59 to 63         | >= 85     |
| LCP, public routes (Lighthouse, simulated 4G)  | 6.8 to 11.7 s    | < 2.5 s   |
| Authenticated edge call, warm p95              | not measured     | < 400 ms  |
| Edge function cold start share of boot calls   | not measured     | < 1 call  |
| Public read endpoints p95 at 50 VUs            | 11.0 s (Oct 19)  | < 1.5 s   |
| Initial JS (gzip, entry + modulepreload)       | ~660 KiB         | < 450 KiB |

Targets are a starting point. Phase 0 re-baselines them on real numbers before any code change.

## Relationship to existing work (do not duplicate)

This plan **continues** these docs. It does not replace them.

| Doc                                                                                                                                               | What it already did                                                                                                                                               | What this plan takes over                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`performance-optimization-production-readiness.md`](../in-progress/production-readiness/audits/performance-optimization-production-readiness.md) | Route-level `lazy()`, vendor chunks, entry budget, scoped invalidation, optimistic transitions, SW booking-status cache, gallery `priority`, inbox virtualization | Its open items: `listBookings` follow-up (now an RPC), `contractExpiryCron` scan, `mockProperties` in entry, image transforms                                                                    |
| [`supabase-capacity-and-operational-readiness.md`](../in-progress/supabase-capacity-and-operational-readiness.md)                                 | Nano to Micro, `list_bookings_page` RPC, 57 RLS init-plan rewrites, Realtime binding merge, capture scripts, load scenarios                                       | "Public Vercel cache", "dashboard/finance SQL aggregates", load matrix with the large-tenant seed. Alerts and retention stay in that plan                                                        |
| [`production-readiness/STATUS.md`](../in-progress/production-readiness/STATUS.md) + [`LEDGER.md`](../in-progress/production-readiness/LEDGER.md)  | Gate A scoreboard                                                                                                                                                 | **PR-040** (Lighthouse/LCP/auth-shell CLS), **PR-129** (dashboard in entry), **PR-134** (bundle budget), issue **#183** (public edge caching), next action #5 (Lighthouse 3x median + k6 re-run) |
| [`evidence/phase8-load-test-2026-10-19.md`](../in-progress/production-readiness/evidence/phase8-load-test-2026-10-19.md)                          | Found `cf-cache-status: DYNAMIC` on every public GET and backend saturation near 10 req/s                                                                         | Options A/B/C are decided and built in Phase 5 here                                                                                                                                              |
| [`docs/architecture/pwa.md`](../../architecture/pwa.md)                                                                                           | Precache tiers, network-first navigation, host warming                                                                                                            | PWA launch and tap latency (Phase 7)                                                                                                                                                             |

When a phase here closes a ledger row, update that row and `STATUS.md` in the same PR.

Phase 10 extends the existing weekly operations report ([`weekly-ops-report.md`](../in-progress/weekly-ops-report.md), [`docs/architecture/ops-reports.md`](../../architecture/ops-reports.md)). It uses the PostHog and Vercel source slots that v1 left open. It does not build a second report.

## Evidence gathered while writing this plan (2026-11-07)

Single-sample probes from a developer machine. They point at causes. **They are not the baseline**; Phase 0 produces that.

| Probe                                                | Result                                                                                                                 | Reading                                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `kamespace.com/` HTML                                | TTFB 0.83 s first, then 0.22 to 0.28 s; `x-vercel-cache: HIT`; `max-age=0, must-revalidate`                            | HTML delivery is fine                                                                          |
| `/assets/*.js`                                       | `public, max-age=31536000, immutable`, Vercel HIT                                                                      | Asset caching is correct                                                                       |
| Initial JS + CSS (gzip, from `index.html`)           | entry 257 KiB, react 94, **observability 94**, supabase 58, radix 49, **motion 49**, icons 23, ui 21, query 13, CSS 69 | ~660 KiB JS before the first route chunk is even requested                                     |
| `list-public-properties` x3                          | **5.12 s, 2.86 s, 0.31 s**                                                                                             | First calls are cold starts. Warm is about 0.3 s                                               |
| `list-public-place-groups`, `get-public-property` x3 | **2.2 to 2.3 s** first, then 0.26 to 0.43 s                                                                            | Every function pays its own cold start                                                         |
| Response headers                                     | `x-sb-edge-region: ap-northeast-2`, `cf-cache-status: DYNAMIC`, `cache-control: private, no-store` on the anon call    | Function ran in **Seoul** while Postgres is in **Singapore**; public reads are not edge-cached |
| Function count                                       | 346 directories under `supabase/functions/` (re-counted 2026-11-07)                                                    | Low traffic per function means most first calls in a session are cold                          |
| Prior Lighthouse 3x median (2026-11-02)              | Perf 59 to 63, LCP 6.8 to 11.7 s, TBT < 35 ms, CLS ~0                                                                  | Not CPU-bound. Network and request chaining dominate                                           |
| Prior load test (2026-10-19)                         | p95 11.0 s at 50 VUs; `get-public-property` median 12.4 s                                                              | Backend saturates; nothing absorbs repeat public reads                                         |
| Supabase MCP / `pg_stat_statements`                  | **Not captured**: MCP has no `SUPABASE_ACCESS_TOKEN` in this session                                                   | Phase 0 captures it with `bun run perf:supabase:snapshot` (last snapshot 2026-11-04)           |

## Root-cause map (hypotheses to confirm in Phase 1)

Each row has a confirm-by test. A cause that fails its test is dropped and noted, not fixed anyway.

### Host dashboard cold open (the "2 to 3 s loader then 1 to 3 s skeleton")

**RC-1. Serial guard waterfall before any page code loads.** `PropertyAdminShell` nests `RequireAdmin` → `RequireOrgNotHardRejected` → `RequireOrgContext` → `PropertyPlanLimitedGate` → `AdminLayoutOutlet` → `RequirePropertyPermission` → `RequirePropertySubscriptionAccess` → lazy page. Each layer renders the full-screen loader until its query resolves:

1. Lazy shell chunk (`OrgAdminShell` / `PropertyAdminShell`) downloads only after the entry runs.
2. `supabase.auth.getSession()` (can refresh the token over the network).
3. `list-organizations` and `list-properties` (parallel).
4. `property-access` needs `property.id`, which comes from step 3, so it is **serial**.
5. `AdminLayout` mounts and fans out its own calls (see RC-3).
6. `property-entitlements` for the subscription guard.
7. The lazy **page chunk is requested only now**, after all the data above.
8. The page's own queries run, so the skeleton shows.

Confirm by: Playwright trace + HAR of a cold property dashboard open, listing each request's start and end. Expect 3 to 4 serial network phases before the page chunk starts.

> **CONFIRMED IN THE LAB 2026-11-08, hosted trace still open.** With every edge call mocked to
> answer instantly, the loader is still **587 ms** (748 ms at 4x CPU), of which **220 ms is the
> fixed `HIDE_BRIDGE_MS`** in `appLoaderHost.ts`. The loader barely reacts to CPU throttle
> (+27%) while `routeContentMs` doubles (812 to 1410), so the loader is time spent **waiting on
> promises**, not parsing. Substituting the probes' real edge latency (2.2 to 5.1 s cold, ~0.3 s
> warm) reproduces the reported 2 to 3 s exactly. Phase 3.1 is the right fix.
> Harness: `bun run perf:boot-timeline`. Numbers: `perf-2026-11-08-before.md`.

**RC-2. Every authenticated edge call pays 3 to 4 round trips before its handler runs.** `serveAuthenticated` / `serveAdmin` call `supabase.auth.getUser(jwt)` (HTTP to Auth), `isIdentityBlocked` (cached), `getPlatformSettingsSnapshot` (60 s cache), and `checkRateLimit` (a `bump_rate_limit` write). `verifyAdminJwt` adds an org ownership count. `list-organizations` then runs up to 6 **sequential** PostgREST queries.

Confirm by: add `Server-Timing` to the wrappers (auth, ratelimit, handler, db) and read it in the HAR.

**RC-3. `AdminLayout` fans out an estimated 12 to 20 edge calls on mount.** Parkings list, org permissions, parking permissions, account identity, AI assistant access, notifications preview, announcements unread, feature availability, setup guide, contract renewal, verification CTA, plus the page's own reads. Each one is a separate function, which means a separate cold start and a separate `getUser`. They compete with the page's critical reads on a phone's 4 to 6 parallel connections.

Confirm by: count requests between `loader:hide` and `content:visible` in the trace. Tag each one critical or deferrable.

**RC-4. Edge region mismatch.** The probe ran in `ap-northeast-2` (Seoul) while Postgres is in `ap-southeast-1` (Singapore). With 5 to 10 database round trips per call, that adds roughly 70 to 90 ms each.

Confirm by: repeat the probe from Manila and from a Singapore VM, then compare a forced Singapore region (`x-region: ap-southeast-1` header, verified against current Supabase docs via context7) with the default routing.

> **REJECTED 2026-11-08, with numbers.** `x-region` is real and `ap-southeast-1` is a valid
> region for edge functions (confirmed via context7 and by reading `x-sb-edge-region` back).
> Measured from Manila against `list-public-properties`, 5 warm calls each:
>
> - default routing (`ap-northeast-2`): 0.242, 0.296, 0.268, 0.357 s
> - forced `ap-southeast-1`: 0.376, 0.353, 0.416, 0.426, 0.363 s
>
> Forcing the database's region is **~34% slower**. The extra hop from the client costs more
> than the saved database round trips, at least for a handler that makes few queries. Phase
> 4.1 is dropped. A function that makes 10+ round trips might differ, which would need its own
> measurement before it ships.

**RC-5. Cold starts across 351 functions.** At low traffic, most first calls in a session are cold (2.2 to 5.1 s observed). The dashboard boot touches about 15 distinct functions, so several boot cold on every open.

Confirm by: cold/warm split in `perf:edge-latency` (authenticated endpoints too), plus `function_edge_logs` boot time if the logs API is reachable.

**RC-6. Shell gate data is not persisted.** `PwaQueryPersistence` restores bookings, stats, and inbox, but **not** `organizations`, `properties`, `property-access`, `org-access`, or entitlements, which are exactly the queries the guards block on. A returning host waits on the network every time even though the answer rarely changes.

Confirm by: a warm repeat-open trace with persistence on. Guards should still wait on the network.

> **CONFIRMED 2026-11-07 (verified against the tree).** `ui/src/lib/pwa/offlineQueryAllowlist.ts`
> persists bookings, notifications, inbox, dashboards, finance, pricing, settings and the
> guest portal. It contains **no** `organizations`, `properties`, `property-access`,
> `org-access`, or `property-entitlements` row, and those are exactly the queries every
> shell guard blocks on. The allowlist is pinned by `offlineQueryAllowlist.test.ts`, so this
> is a deliberate omission to change, not an accident. Phase 3.4 stands.

### Public site cold open

**RC-7. Request chain: entry JS → route chunk → cold function → content.** The lazy page chunk is not `modulepreload`ed, so it starts only after the ~660 KiB entry has parsed. Then the page's first data call usually hits a cold function (2 to 5 s).

**RC-8. Public reads are not cached anywhere we control.** Supabase's front returns `DYNAMIC`, and the anon probe returned `private, no-store`. Find out why the anon call got `no-store` (the `Authorization: Bearer <anon>` header may push it down the private path).

> **PARTLY RESOLVED 2026-11-07 (verified against the tree).** An explicit cache-class
> contract already ships: `jsonResponse`/`jsonSuccess` take a `CacheClass`, and
> `docs/architecture/edge-functions.md` lists `publicStatic` / `publicDynamic` /
> `publicAvailability` with the real call-site inventory, plus
> `scripts/dev/check-cache-class.sh` as a two-way CI guard. So the `private, no-store` in
> the probe was a call site that forgot a class, not a framework default. What is still
> open is the one that matters: **`s-maxage` is not honoured in front of Supabase**
> (`cf-cache-status: DYNAMIC`, verified 2026-10-19). That is Phase 5 / D-1 and needs
> `kamewave` to test, so it stays open.

**RC-9. Boot-critical weight that is not needed for first paint.** Observability vendor (94 KiB, Sentry + PostHog) and motion (49 KiB) are on the critical path. The Google Fonts preload covers 15 families. Unsplash hero images are `w=1200` on a 412 px phone (PR-040). `mockProperties`/`mockDevelopments` are still in the entry.

Confirm by: `perf:chunk-graph` + Lighthouse "unused JS", plus an A/B with deferred telemetry init.

> **PARTLY REJECTED 2026-11-07.** `mockProperties` / `mockDevelopments` are **not** in the
> entry: the only importers are `useShowcaseData` and `resolvePublicDevelopment`, both reached
> from lazy page modules, and the built entry chunk contains neither name.
> `perf:chunk-graph` reports no forbidden chunk in the initial graph. What remains from RC-9
> is server data weight: `observability-vendor` 90.7 KiB and `motion-vendor` 46.7 KiB gzip are
> still module-preloaded (see the measurement note under 2.3).

### PWA in-app navigation (the "0.5 to 1 s per tap")

**RC-10. Built-in skeleton hold.** `useDelayedLoading` waits 180 ms and then holds the skeleton for at least 300 ms. Any fetch slower than 180 ms costs at least 480 ms of skeleton, even if the data lands at 200 ms.

> **REJECTED 2026-11-07 (Phase 1).** The route Suspense fallbacks already disable the
> hold: `RouteFallback.tsx` calls `useDelayedLoading(true, { minVisibleMs: 0 })` precisely
> because Suspense unmounts the fallback the moment the child resolves, so a hold could
> never apply. The only remaining default-parameter caller is `BookingTable.tsx`, and it
> shows the skeleton immediately when it has no rows
> (`isLoading && (rows.length === 0 || delayedSkeleton)`), so the hold only affects a
> refresh of an already-populated table. There is no 480 ms skeleton floor on navigation.
> Phase 7.1 is dropped. The real tap cost is chunk load plus the page's own edge calls
> (RC-11, RC-12), not the skeleton timer.

**RC-11. No data prefetch on intent, and no prefetch on the phone tab bar.** `adminNavPrefetch` warms chunks on sidebar hover only. The bottom tab bar (the PWA's main navigation) gets no chunk or data prefetch, and nothing prefetches page queries anywhere.

> **CONFIRMED AND FIXED 2026-11-07 (chunk half).** The sidebar already wired
> `onMouseEnter` / `onFocus` / `onTouchStart`; the phone tab bar had none. Worse, the single
> trailing-segment map handed the org bookings tab the _property_ bookings chunk, so even the
> sidebar warmed bytes it never used for two of three scopes. Fixed in Phase 7.2 below.
> Data prefetch is deliberately still absent: the query keys belong to the page.

**RC-12. Each tap's queries are cold or stale.** The default `staleTime` is 15 s, and every page read is a separate edge call with its own auth round trips (RC-2) and possibly a cold start (RC-5).

**RC-13. Route chunks outside the precache.** Host-tier chunks are warmed only after sign-in. A first tap on a module before warming finishes goes to the network.

**RC-14. Main-thread cost of `AdminLayout` re-rendering on navigation.** The layout is 1,401 lines with many hooks, and a route change can re-render the whole shell, the sliding pill, and view-transition names.

Confirm by: a React Profiler commit on a tab switch, plus a Performance trace with 4x CPU throttle in mobile emulation. Measure tap → `content:visible`.

**RC-15. Cold launch in standalone waits for the network.** Navigation is network-first with a 3 s timeout and `cache: 'no-cache'`, and navigation preload is off. On a weak signal, a PWA launch can wait up to 3 s for HTML before falling back.

Confirm by: launch timing under "Slow 4G" and "offline-ish" (high latency) profiles. Compare with navigation preload enabled.

### Database and backend

**RC-16. Slow or hot queries.** Last known: `realtime.list_changes` was 84% of DB time (Postgres Changes polling) and `net.http_post` led the outliers (cron fan-out). Since the 2026-11-04 fixes this is unmeasured.

Confirm by: `perf:supabase:snapshot` + `perf:pg-stat-statements` before/after, reset stats at the baseline point with operator approval, and `EXPLAIN (ANALYZE, BUFFERS)` the top 10 by total and by mean time against the large-tenant seed locally.

> **CONFIRMED 2026-11-08, and worse than recorded.** `pg_stat_statements` on production
> (96 days since reset, no reset performed) puts Realtime `list_changes` at **85.02%** of all
> database time, 12.88M ms across 1,664,792 calls. Index and table cache hit rates are both
> **1.00**, so no index can help. Two findings the plan did not have:
> `SELECT name FROM pg_timezone_names` costs **393 ms per call** over 869 calls, and a
> recursive domain base-type walk costs ~113 ms over the same 869 calls. Details:
> `production-readiness/evidence/perf-2026-11-08-before.md`.

**RC-17. Remaining app-side heavy reads.** `fetchAllBookingsForFinance` (`select('*')`, period filtering in JS), dashboard stat endpoints, `contractExpiryCron` full scan, and `get-public-property` (many queries per call).

## Guardrails (what we will not do)

- No change ships without a before number, an after number, and the test that protects the behavior.
- No blanket `staleTime` raises, no `React.memo` sprinkling, no new caching layer "just in case". Every cache has a named invalidation path and a test.
- No security regression for speed. Auth tiers in `CLAUDE.md` stay the same. Any change to JWT verification is a decision (D-2) with the revocation tradeoff written down.
- No booking workflow side-effect changes. Everything still goes through `workflowOrchestrator#transition()`.
- No edits to shipped migrations. Any production deploy needs `kamewave`.
- Do not stack a second loader on top of a first one. The goal is fewer loading states, not prettier ones.

## Phase 0: measurement harness and "before" baseline

No product behavior change in this phase, only instrumentation that stays in.

### 0.1 In-app timing marks (kept permanently, sampled to RUM)

Add one small module, `ui/src/lib/perf/bootMarks.ts`, that records `performance.mark` at:

- `app:script-start` (top of `main.tsx`), `app:first-render`
- `loader:show` / `loader:hide` (inside `AppLoader`'s acquire/release), so we measure exactly the screen the user complains about
- `skeleton:show` / `skeleton:hide` (route skeletons + `SectionLoadingFallback`)
- `route:content` (first commit of a page with its primary data, set by a `useRouteContentReady(isReady)` hook on the 10 most used pages)
- `nav:start` (link/tab click) → `nav:content` for in-app navigation

Report them as Sentry custom measurements on the route transaction (route pattern names, never slugs) and as one PostHog event per session, sampled. This becomes the real-user source for the report.

Tests: Vitest for the mark helper (idempotent, no throw without `performance`), and an E2E assertion that the marks exist on `/` and on the property dashboard.

### 0.2 `Server-Timing` on edge wrappers

In `_shared/serveEdge.ts`, time the `auth`, `blocklist`, `ratelimit`, and `handler` steps and emit `Server-Timing` (durations only, no identifiers). Add `Timing-Allow-Origin` for the app origins. Deno test: header present, no PII, no extra DB call.

### 0.3 Repeatable benchmark suite (`bun run perf:report`)

One command that writes `docs/workflow/in-progress/production-readiness/evidence/perf-<date>-<label>.md` + JSON:

| Suite                | Tool                                                                                         | Routes / scope                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse 3x median | existing `lighthouse-medians.mjs`, extended to accept a Playwright storage state             | 9 public budget routes + host `/org/:o/property/:p` dashboard, bookings, booking detail, finance, inbox; guest `/account/trips` |
| Boot timeline (lab)  | new Playwright script, Moto G Power emulation, 4x CPU, Slow 4G, cold + warm                  | same routes; reads the 0.1 marks; reports loader ms, skeleton ms, content ms, request count, serial depth, cold-start count     |
| PWA navigation       | Playwright, standalone display mode, SW active, host tier warmed and not warmed              | 10 tab switches on the phone tab bar; tap → `nav:content` p50/p95                                                               |
| Edge latency         | existing `perf:edge-latency` + authenticated endpoints (test session token on dev data only) | the ~15 boot functions + top public reads; cold vs warm; region header recorded                                                 |
| Load                 | k6 `public-api.js`, `authenticated-api.js` with the large-tenant seed                        | 50 VUs, 8 min hold; per-endpoint p50/p95, error and 429 share                                                                   |
| Database             | `perf:supabase:snapshot`, `perf:pg-stat-statements`                                          | top 25 by total and mean time, cache hit, connections, Realtime share                                                           |
| Bundle               | `build` + `check-initial-bundle-budget.mjs` + `perf:chunk-graph`                             | entry, initial total, per-route first-load JS                                                                                   |
| RUM                  | Sentry performance + PostHog web vitals (7-day p75)                                          | LCP, INP, CLS, custom boot marks per route pattern                                                                              |

Rules: same device profile, same time of day, 3 runs minimum, median reported, SW cleared for "cold" and kept for "warm", hosted runs read-only. The "before" report is committed before Phase 2 starts.

### 0.4 Start the usage collectors early

Ship the Phase 10 collectors (10.1 to 10.4) together with Phase 0, so a full week of real usage and latency is on record before the first fix lands. That week is the real-user "before". The weekly report section (10.5) can follow later.

**Exit criteria:** before report committed, with a request-waterfall diagram for host cold open, public cold open, and a PWA tab switch.

## Phase 1: confirm root causes (spikes, thrown away)

Each spike runs on a throwaway branch and only answers a question.

| Spike | Question                                                                                          | Method                                                                                          | Decides         |
| ----- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------- |
| S-1   | How much of host cold open is guard serialization vs. raw call latency?                           | Stub guards to pass instantly with cached data; re-run the boot timeline                        | Phase 3 scope   |
| S-2   | Does pinning the function region to Singapore help from Manila?                                   | `x-region` A/B in `perf:edge-latency`                                                           | Phase 4.1       |
| S-3   | What is the cost split per authenticated call (auth / rate limit / handler)?                      | `Server-Timing` from 0.2                                                                        | Phase 4.2 / D-2 |
| S-4   | Do cold starts dominate boot? Does one bootstrap function remove them?                            | Prototype `get-session-context` returning orgs + properties + access + entitlements in one call | Phase 3.1       |
| S-5   | Can a same-origin Vercel proxy cache public GETs and drop CORS preflights without adding latency? | One rewrite for `list-public-properties` on a preview; measure `x-vercel-cache` and TTFB        | Phase 5 / D-1   |
| S-6   | How much does the skeleton hold (RC-10) add to tap latency?                                       | Set `showAfterMs` 0/180 and `minVisibleMs` 0/300 and compare tap → content                      | Phase 7.1       |
| S-7   | Is tap latency network or main thread?                                                            | Profiler + trace with network fully cached                                                      | Phase 7 split   |

**Exit criteria:** every RC row is marked **confirmed** (with its number) or **rejected** in this doc. Only confirmed rows move on.

## Phase 2: public site critical path

| #   | Change                                                                                                                                                                | Root cause | Tests                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| 2.1 | Modulepreload the route chunk for the landing URL and the top public routes (Vite plugin or `<link rel=modulepreload>` generated from the build manifest per route)   | RC-7       | Build test: preload tags exist and resolve; E2E: no extra 404s                           |
| 2.2 | Start the page's first data request in parallel with the chunk: route-level `queryClient.prefetchQuery` in a loader-style hook registered by route pattern            | RC-7       | Vitest: prefetch key equals hook key (no double fetch); E2E: one request per resource    |
| 2.3 | Defer Sentry tracing extras and PostHog until after first render / `requestIdleCallback`. Keep Sentry's error handler installed first so boot errors are still caught | RC-9       | Vitest: errors before idle are still captured (queued); E2E: telemetry events still sent |

> **BLOCKED 2026-11-07: the change contradicts Phase 0.1.** Deferring
> `Sentry.reactRouterBrowserTracingIntegration` loses the **first pageload transaction**,
> which is the exact transaction the boot measurements attach to. Deferring
> `bootstrapPostHogTelemetry()` is unsafe for a different reason: `pwaTelemetry()` dispatches
> a `window` CustomEvent and the only listener is registered there, so a deferred attach can
> drop an early `beforeinstallprompt` / `appinstalled` / `launch-offline-fallback`.
> `posthog.init()` is the real byte cost and cannot be deferred without a queueing shim
> across every `captureAppEvent` call site.
>
> Resolved by choosing the safer option: **keep both eager**. Measured baseline for this
> branch: entry 246.5 KiB gzip, 9 initial chunks 633.2 KiB gzip, `observability-vendor`
> 90.7 KiB gzip. The observability chunk stays on the critical path until a queueing shim
> ships with its own before/after measurement.
> | 2.4 | Move `motion` and `mockProperties`/`mockDevelopments` out of the entry where the chunk graph shows they are not needed for first paint | RC-9 | `check-initial-bundle-budget` lowered to the new size so regressions fail CI |
> | 2.5 | Hero images: `srcset`/`sizes`, eager + `fetchpriority=high` only on the LCP image (PR-040). Use Supabase image transforms for Storage images if S-5/plan tier allows | RC-9 | `audit-image-loading.mjs` gate; Lighthouse LCP element check |
> | 2.6 | Fonts: preload only the default family's CSS. Load a host-selected family when a page that uses it renders | RC-9 | Visual check of branded public pages; no FOIT; CSP unchanged |

## Phase 3: host dashboard boot waterfall

| #   | Change                                                                                                                                                                                                                                                   | Root cause                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Tests                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | **One bootstrap call**, `get-session-context?orgSlug&propertySlug                                                                                                                                                                                        | parkingSlug`: returns organizations, the scoped listing list, access/permissions, plan-limited state, entitlements, and feature availability in one authenticated request with one `getUser`. Server reuses the existing `orgAuth`/`propertyScope`/`parkingScope` helpers so the authorization logic is the same code. Seed the existing query keys (`organizations`, `properties`, `property-access`, entitlements) from the response so every current hook keeps working | RC-1, RC-2, RC-5                                                                                                                                                                | Deno handler tests per role (owner, org admin, property member, plan-limited, revoked, super-admin, wrong org): payload equals what the separate endpoints return today. RBAC matrix + IDOR probes re-run |
| 3.2 | Collapse the guard chain into one `TenantGate` that reads the bootstrap query once and renders exactly one loading state, then the page. Keep the per-section permission and subscription checks as pure functions over the same data, so no extra fetch | RC-1                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Vitest for the decision function (every deny/redirect branch from the 6 current guards); E2E: plan-limited, hard-rejected, suspended, revoked, and wrong-tenant flows unchanged |
| 3.3 | Start the page chunk download in parallel with the bootstrap call (prefetch the matched route's lazy import when the shell mounts)                                                                                                                       | RC-1                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | E2E: chunk request starts before the bootstrap call ends                                                                                                                        |
| 3.4 | Persist the bootstrap result (per viewer, existing IndexedDB persister) and render the shell from it on warm opens while it revalidates. Access-denying changes still apply once the revalidation lands                                                  | RC-6                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Vitest: never restored across viewers; purge on sign-out; E2E: revoked member is denied after revalidation                                                                      |
| 3.5 | Split `AdminLayout` fan-out into **critical** (needed for the first frame) and **deferred** (notifications preview, announcements) loaded after first paint                                                                                              | RC-3                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | E2E: badges and CTAs still appear                                                                                                                                               |
| 3.6 | Same treatment for org shell, parking shell, super-admin shell, and the guest portal (`/account`)                                                                                                                                                        | RC-1                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Same suites per shell                                                                                                                                                           |

**Shipped 2026-11-08.**

- **3.3** `useAdminRouteChunkPrefetch` mounts in all three admin shells, outside their guards.
- **3.4** the gate query roots are allowlisted, so the existing per-viewer persister carries them
  and the guards render from IndexedDB instead of waiting on the network. Staleness is bounded
  by each guard's `staleTime` (60 s for access, longer for org structure). A stale shell is
  **not** an access bypass: the edge checks remain the boundary. Pinned in
  `offlineQueryAllowlist.test.ts`.
- **3.5** `useAfterFirstPaint` gates the notification preview and the announcement unread dot.
  Setup guide, renewal and verification CTA live outside `AdminLayout`, so they were not part
  of this fan-out.

`activity-log: N/A — read-only paths.` `Plans/RBAC:` no new gates; the bootstrap reuses current entitlement and permission resolution, and the plan-tier suite must stay green.

## Phase 4: edge function overhead

| #   | Change                                                                                                                                                                                                                        | Root cause | Tests                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 4.1 | If S-2 confirms it: pin function region to `ap-southeast-1` from the client (`x-region` header in `edgeClient`, `adminEdgeFetch`, public fetchers) so functions run next to Postgres                                          | RC-4       | Unit test the header is set on every edge helper; edge-latency before/after                               |
| 4.2 | Decision D-2: verify JWTs locally (`auth.getClaims()` with the project's asymmetric signing keys and cached JWKS) for **reads**, keep `getUser` for writes and sensitive actions. Revocation lag is bounded by token lifetime | RC-2       | Deno tests: expired, wrong-issuer, wrong-signature, missing-email tokens rejected; adversarial auth suite |
| 4.3 | Make the authenticated rate-limit bump cheap: one RPC that does block-list check + bump, or a short in-isolate token bucket in front of the durable counter. Limits must still return 429 at the same thresholds              | RC-2       | Existing rate-limit tests + hosted 429 probe                                                              |
| 4.4 | Rewrite `list-organizations` as one SQL function (owned + member + org-admin + plan-limited in one query)                                                                                                                     | RC-2       | Deno parity test against the old handler on seeded roles                                                  |
| 4.5 | Cold-start reduction: shrink the import graph of boot-path functions (no unused heavy `_shared` imports), and check whether boot-critical reads can share one function (3.1 already covers the biggest group)                 | RC-5       | Boot time from `function_edge_logs` before/after                                                          |

## Phase 5: public read caching (closes #183)

Decision D-1 picks one option from the 2026-10-19 load test. Recommended order:

1. **Same-origin Vercel proxy** for the allowlisted public GETs (`/api/public/*` → Supabase function), so `s-maxage` + `stale-while-revalidate` are honored by Vercel's CDN and the browser skips CORS preflights.
2. **Fix the `no-store` on anon public reads** (RC-8) whatever option is chosen.
3. **Fewer queries per call** for `get-public-property` (one RPC for contact, settings, reviews, availability summary).

Invalidation: cache keys include the listing slug. Writes that change public data (property, pricing, reviews, showcase publish) purge or rely on a short `s-maxage` (60 to 300 s) with SWR. Document the staleness each endpoint accepts.

Tests: header tests per endpoint class; E2E publish → public view reflects within the documented window; k6 re-run with p95 < 1.5 s at 50 VUs; SW `SW_CACHEABLE_FUNCTIONS` updated to the new paths.

## Phase 6: database and slow queries

| #   | Change                                                                                                                                                                                      | Root cause | Tests                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| 6.1 | Fix the top N statements from the Phase 0 snapshot, each with `EXPLAIN (ANALYZE, BUFFERS)` before/after on the large-tenant seed. Indexes only where a plan proves a seq scan or sort costs | RC-16      | Migration replay lint; `db:reset` clean; plan diff in the evidence file |
| 6.2 | Finance: push period filters and paging into SQL (needs ISO date columns or generated columns; new migration only)                                                                          | RC-17      | Finance Deno tests + report parity on seeded data                       |
| 6.3 | Dashboard stats: one SQL aggregate per scope instead of several reads                                                                                                                       | RC-17      | Stat parity test                                                        |
| 6.4 | `contractExpiryCron`: filter near-expiry rows in SQL                                                                                                                                        | RC-17      | Cron Deno test with boundary dates (Asia/Manila)                        |
| 6.5 | Realtime: re-measure `realtime.list_changes` share; if still dominant, move the busiest Postgres Changes channels to Broadcast from Database triggers                                       | RC-16      | Realtime E2E (inbox, notifications, guest chat) still update            |

## Phase 7: PWA and in-app navigation

| #   | Change                                                                                                                                                                    | Root cause | Tests                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| 7.1 | Tune `useDelayedLoading` from S-6: keep the anti-flash delay but drop the forced minimum when data lands before the skeleton paints; never hold content behind a skeleton | RC-10      | Vitest for the hook's timing table; visual check for strobing               |
| 7.2 | Intent prefetch on the **phone tab bar** and "More" sheet (`pointerdown`/`touchstart`) for both the chunk and the page's primary query                                    | RC-11      | E2E: tap triggers one chunk + one data request; no prefetch storm on scroll |

> **Chunk half shipped 2026-11-08; data half still open.** `BottomTabItem.onIntent` fires on
> `pointerdown` and `focus`; `AdminLayout` maps each tab href through
> `resolveAdminNavPrefetch`. The prefetch map is now split per scope, which also fixes the
> sidebar warming the wrong chunk for org and parking scopes. Coverage is a unit test
> (`adminNavPrefetch.test.ts`, 12 cases) rather than an E2E network assertion: the mocked
> admin harness can already have the module loaded, so a request-based assertion is flaky and
> a flaky gate is worse than a scoped one. Data prefetch stays out on purpose, per the
> no-guessed-cache-keys guardrail.
> | 7.3 | Keep the previous screen until the next screen's primary data is ready (`startTransition` navigation + `placeholderData`/Suspense-query on top pages), with a thin top progress bar instead of a skeleton for fast fetches | RC-10, RC-12 | E2E: no blank frame; back navigation instant from cache |
> | 7.4 | Per-resource `staleTime` from the data's change rate (documented table), for module landing reads only | RC-12 | Invalidation tests for each raised key |
> | 7.5 | Warm host-tier chunks right after the bootstrap call resolves (not only after sign-in), at idle priority | RC-13 | Precache budget unchanged; SW test |
> | 7.6 | Enable **navigation preload** in the SW and shorten the standalone launch timeout; serve the precached shell first in standalone when a cached build matches `pwa-version.json` (keeps the stale-build fix) | RC-15 | SW unit tests; E2E offline boot; update flow ("new version" toast) still works |
> | 7.7 | `AdminLayout` re-render audit from S-7: memoize only the subtrees the profiler names | RC-14 | Profiler commit count before/after recorded |
> | 7.8 | Touch feedback: `:active` states and `touch-action: manipulation` on nav targets so the tap acknowledges instantly | perceived | Mobile E2E at 375 px |

> **Already done, verified 2026-11-08.** `BottomTabBar`'s `mobileBottomBarClassName` already
> carries `touch-manipulation`, and the tab surface uses `native-press` for the active state.
> Nothing to add here.

## Phase 8: regression gates (keep it fast)

- `check-initial-bundle-budget.mjs` thresholds lowered to the new numbers.
- New CI job (non-blocking first, blocking after 2 green weeks): Lighthouse CI on 3 public routes against the preview deploy, failing on Perf < 80 or LCP > 3 s.
- A Playwright `@perf` tag that fails when host cold open has more than 1 serial network phase before the page chunk, or more than N requests before `route:content`.
- Sentry alert on p75 `route:content` regression per route pattern; PostHog web vitals dashboard.
- `.claude/skills/performance` + `.cursor/rules` mirror: new rules ("one bootstrap call per shell", "no guard fetches", "prefetch on tab intent", "every cache names its invalidation").

## Phase 9: "after" report

Re-run `bun run perf:report --label=after` with the exact Phase 0 settings, and add the 7-day RUM p75 after production release.

The report (`evidence/perf-<date>-before-vs-after.md`) contains:

1. Headline table: every target metric, before, after, delta, pass/fail against target.
2. Per-route Lighthouse medians (Perf, LCP, FCP, TBT, CLS, transfer).
3. Boot timelines: loader ms, skeleton ms, content ms, request count, serial depth, cold starts, before vs after, with the two waterfall diagrams side by side.
4. PWA tap latency p50/p95 per tab, warmed and unwarmed.
5. Edge latency per boot function, cold and warm, with `Server-Timing` breakdown.
6. k6 per-endpoint p50/p95 and error/429 share.
7. Top 25 statements before/after, with plan diffs for the ones changed.
8. Bundle sizes per tier.
9. Root causes rejected in Phase 1, with the numbers that rejected them.
10. Known remaining gaps and follow-ups.
11. The first two weekly "Performance and usage" sections (Phase 10), showing the hot list before and after.

## Phase 10: continuous hot-path telemetry and weekly review

**Goal:** every week, know which pages, actions, APIs, queries, and vendors get used most and cost the most time. Then pick the next fix from data: cache it, index it, batch it, or split it. This turns speed work from a one-off project into a loop.

### What exists today

| Signal             | Today                                                                                                                                 | Gap                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| PostHog            | `$pageview` with a sanitized URL; autocapture; server events from edge (`_shared/posthog.ts`); `capture_performance: false` by design | No **route pattern** property, so pages split by slug; nothing reads PostHog back into reports |
| Sentry browser     | Route-pattern transactions, 5% trace sample in production                                                                             | No custom boot marks; nothing pulls top or slow transactions into the report                   |
| Sentry edge        | Exceptions and one cron monitor                                                                                                       | No per-function latency                                                                        |
| Edge function logs | Supabase keeps per-request status and execution time                                                                                  | Logs roll off and nobody aggregates them                                                       |
| Postgres           | `pg_stat_statements`, capacity snapshot already in the report                                                                         | No week-over-week diff; no index or seq-scan signals                                           |
| Weekly ops report  | Health, capacity, DB weekly counts, Sentry issues, AI-agent handoff                                                                   | No performance or usage section; PostHog/Vercel adapters not built                             |

### Design rules

- **No new work on the request path.** Each request already pays 3 to 4 extra round trips (RC-2), so collection must never add a database write per request. Collectors read logs and stats after the fact.
- **Aggregates only.** Route patterns (`/org/:orgSlug/property/:propertySlug/bookings`), function names, normalized query IDs, counts, and percentiles. Never slugs, IDs, emails, tokens, query literals, or request bodies. Same privacy rules as `ops-reports.md`.
- **Rank by impact, not by count.** Impact = calls × p95 (total user-waiting time). A page hit 10,000 times at 200 ms ranks above one hit 50 times at 3 s, but both show.
- **Every finding suggests one action** from a fixed set: cache, index, batch/merge calls, defer, split chunk, prefetch, or investigate. No auto-generated indexes; an index needs an `EXPLAIN` before it ships (guardrail above).
- **Fit the free tiers.** Use sampling and daily rollups so PostHog, Sentry, and Supabase log quotas are not exceeded. Record each vendor's quota use in the report.

### 10.1 Frontend: pages and actions (PostHog + Sentry)

- Register `route_pattern` and `surface` (`public`, `guest-portal`, `host-property`, `host-parking`, `host-org`, `super-admin`) as PostHog super properties on every navigation, using `matchRoutes` (the same patterns Sentry already uses). Also send them on `$pageview` and `$pageleave` so time on page is per pattern.
- Name the top host and guest actions in `posthogCatalog` (booking transition, save settings, send message, publish, search, reserve), checked against what autocapture already sends so nothing is counted twice.
- Send the Phase 0 boot marks (`loader ms`, `skeleton ms`, `route:content ms`, `nav:content ms`) as Sentry measurements on the route transaction. Sentry keeps owning performance, so PostHog stays `capture_performance: false`.
- Tests: Vitest for pattern resolution (a slug never leaks, unknown routes map to `unmatched`); `before_send` sanitizer tests extended.

### 10.2 Edge APIs: calls, latency, errors, cold starts

- A daily `perf-rollup-cron` (`serveCronPost`, heartbeat, Vault secret) reads the previous day's edge function logs through the Supabase Management API analytics endpoint. It writes one row per function per day to `edge_function_daily_stats`: calls, 2xx/4xx/429/5xx counts, p50/p95/p99/max execution time, cold-boot count, and the mean `Server-Timing` split (auth, rate limit, handler) from Phase 0.2.
- If the logs endpoint is unavailable or over quota, the run records a source error and the report says so. It never falls back to per-request inserts.
- Vendor latency: the existing vendor wrappers (Resend, Gemini, PayMongo, Meta, Google, Telegram) log one structured line (`vendor`, `op`, `ms`, `ok`). The same rollup aggregates those lines into `vendor_daily_stats`.
- Tests: Deno tests for log parsing, percentile math, idempotent upsert per `(day, function)`, and missing-source handling.

### 10.3 Database: slow and hot queries, index signals

- The same cron stores a daily `pg_stat_statements` snapshot of the top 100 statements: `queryid`, normalized text (already `$1` placeholders, truncated), calls, total and mean time, rows, and shared block hits and reads. Weekly numbers come from the **difference** between snapshots, so no stats reset is ever needed.
- Table and index signals from `pg_stat_user_tables` / `pg_stat_user_indexes`: seq scans vs index scans per table, unused indexes, dead-tuple ratio. The Supabase performance advisors (`perf:supabase:advisors`) are pulled weekly.
- Index candidates go to the report as "investigate with EXPLAIN", with the query and table. Shipping an index stays a normal migration PR.
- Tests: Deno tests for delta math across a stats reset (negative deltas are treated as a reset), and a SQL test that the snapshot function returns no literals.

### 10.4 Retention and storage

- New tables are service-role only (RLS on, no policies), like `ops_reports`. Daily rows are kept 180 days and pruned by the existing nightly retention job.
- Rough size: about 350 functions + 100 statements + ~10 vendors per day, roughly 85k rows over 180 days. Small.

### 10.5 Weekly report: "Performance and usage" section

Added to `buildOpsReport()` (bump `summary.schemaVersion` to 2, keep v1 readers working) and rendered on `/admin/ops-reports/:id` and in the email summary.

| Block            | Content                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Top pages        | Top 15 route patterns by views and unique users, p75 `route:content`, p75 LCP, week-over-week change (PostHog HogQL + Sentry API) |
| Top actions      | Top 15 named actions by count, with their API calls' p95                                                                          |
| Hot APIs         | Top 15 functions by impact (calls × p95), with error rate, 429 share, cold-start share, `Server-Timing` split                     |
| Hot queries      | Top 15 statements by total time and the top 5 by mean time, with calls and cache hit                                              |
| Regressions      | Any page, API, or query whose p95 rose more than 20% week over week with at least 100 calls                                       |
| Cache candidates | High-read, low-write public or per-tenant reads not yet in a cache class                                                          |
| Index candidates | Tables with high seq scans on hot queries; unused indexes (write cost)                                                            |
| Third parties    | Vendor p95, error rate, and quota use (PostHog, Sentry, Supabase logs, Resend, Gemini)                                            |
| Frontend weight  | Entry and initial JS from the latest production build, compared with the budget                                                   |

Findings use the existing stable-ID scheme: `perf:page:<pattern>`, `perf:edge:<function>`, `perf:db:<queryid>`, `perf:vendor:<name>`, `perf:bundle:<chunk>`. Severity thresholds are fixed and documented, so the same data always produces the same findings. Each one lands in the existing AI-agent handoff, which already asks for reproduce, root-cause fix, test, and `ci:quality`. That makes the weekly report the work queue for this loop.

Tests: `opsReport_test.ts` cases for each block, deterministic finding IDs, threshold edges, missing sources (`skipped` vs `error`), and Markdown snapshot. UI: the detail page handles schema v1 and v2; mobile layout at 375 px uses stacked cards instead of wide tables.

### 10.6 Weekly loop (process)

1. Monday 08:00 Manila: the report generates and emails.
2. Triage: pick the top 1 to 3 `perf:*` findings by impact.
3. Each fix follows this plan's guardrails: measure, root cause, smallest change, test, before/after numbers in the PR.
4. Next week's report confirms the change (the finding clears or its numbers drop). If it doesn't, the PR's assumption was wrong and gets revisited.

`Plans/RBAC: N/A — super-admin only surface, no host feature.` `activity-log: N/A — read-only aggregates; the cron records a job heartbeat.`

Then update `STATUS.md` Gate A and the ledger rows this closes (PR-040, PR-129, PR-134, #183, next action #5).

## Testing strategy

Every phase must pass `bun run ci:quality` (lint, type-check, Vitest, Deno, `@smoke`, build) plus:

| Area               | Required tests                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bootstrap endpoint | Deno handler tests per role and tier; payload parity with the old endpoints; IDOR + RBAC matrix + adversarial auth suites re-run on dev               |
| Tenant gate        | Vitest decision table covering every branch of the 6 guards it replaces; Playwright for plan-limited, suspended, hard-rejected, revoked, wrong tenant |
| Caching            | Header tests per class; publish → visible window E2E; persisted cache never crosses viewers; sign-out purge                                           |
| Prefetch           | No duplicate requests (query key parity); no prefetch on scroll                                                                                       |
| SW                 | Navigation preload, offline boot, update toast, booking-status cache TTL unchanged                                                                    |
| DB                 | Migration replay lint, clean `db:reset`, EXPLAIN plans stored, parity tests for rewritten queries                                                     |
| Full regression    | `test:e2e:ci` (currently 301 pass / 9 skip) stays at 0 failed; `test:e2e:plans`; a11y axe sweep (35 routes)                                           |
| Mobile             | 375 / 768 / 1024 checks on touched shells (`mobile-responsive` skill)                                                                                 |

Note: Vitest silently ignores `.test.tsx` component tests in this repo, so put component logic in `.ts` helpers to keep it under unit test.

## Decisions needed (one at a time, before the phase that needs it)

| ID  | Decision                                                                       | Recommended                                                                    | Needed by  |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------- |
| D-1 | Public read caching option                                                     | Same-origin Vercel proxy + fix anon `no-store`, then fewer queries per call    | Phase 5    |
| D-2 | Local JWT verification for reads (revocation lag up to token lifetime)         | **DEFERRED** — see the note below                                              | Phase 4.2  |
| D-3 | Accepted staleness per public endpoint class                                   | 60 s listings/search, 300 s static content, 30 s availability                  | Phase 5    |
| D-4 | `pg_stat_statements_reset()` at the baseline point on production               | Yes, once, with `kamewave`, after the before snapshot is saved                 | Phase 0    |
| D-5 | Make the Lighthouse CI gate blocking                                           | After 2 green weeks                                                            | Phase 8    |
| D-6 | Edge latency source: daily log pull vs. in-isolate counters flushed on a timer | Daily log pull (zero request-path cost); counters only if logs prove too lossy | Phase 0.4  |
| D-7 | Regression threshold for a `perf:*` finding                                    | p95 up > 20% week over week with >= 100 calls                                  | Phase 10.5 |

> **D-2 deferred (2026-11-09), with the reasoning.** Local verification is technically
> available: tokens are ES256 and the project publishes a matching JWKS. It is not worth it
> now. The five-second token cache plus threading the verified user into the inner checks
> already removed the duplicate verification, so D-2's remaining gain is **~90 ms once per
> burst**, about 3-5% of what is left on the authenticated path. Against that, `getUser` is
> what makes sign-out, session revocation and account disable take effect **immediately**; local
> verification would leave each of those accepting reads for up to the token lifetime
> (measured: 3600 s) on a surface that exposes guest PII. Revisit only as an explicit product
> decision with a stated maximum offboarding delay, and then for reads only.

## Operator inputs

**Test tenant (2026-11-08).** `kame-test-tenant` exists in production so the remaining
phases can be measured against real latency without touching a host's data. The database
enforces exactly one and forbids an ACTIVE test listing, so it cannot appear publicly.
Verified live: the guest property endpoint 404s, listing and parking search return zero
rows, and the served HTML contains no test-property data. Reference:
`docs/architecture/test-tenant.md`.

- `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` exported locally for MCP/`supabase inspect` (missing in this session).
- PR-025 GitHub secrets (`DEV_DB_URL`, etc.) for CI-side advisors and pg_stat capture.
- A test host account on production data for read-only authenticated Lighthouse/boot runs (or a dedicated demo org).
- `kamewave` for every production deploy and the stats reset.
- For Phase 10: a Supabase Management API token for the rollup cron (edge secret, read-only analytics use), a PostHog personal API key + project ID for HogQL reads, and the existing Sentry token (`SENTRY_AUTH_TOKEN`) with transaction read scope. Confirm Supabase log retention on our plan covers a daily pull.

## Rollout and rollback

- One PR per phase (Phase 3 may be two: endpoint, then gate). Each ships behind a short-lived flag where behavior changes (bootstrap gate, SW navigation preload, Vercel proxy), defaulting on in dev first.
- Deploy to dev, run the phase's before/after, then production with `kamewave`.
- Rollback is a flag flip for gated items and a revert for the rest. New migrations are additive so a revert does not need a down migration.

## Docs to update in the same PRs

- `docs/architecture/overview.md`, `docs/PROJECT.md`: bootstrap endpoint, public proxy path, region pinning, `Server-Timing`.
- `docs/architecture/edge-functions.md`: wrapper cost, cache classes, the anon `no-store` fix.
- `docs/architecture/pwa.md` + `.cursor/rules/pwa.mdc`: navigation preload, warming trigger, launch timeout.
- `docs/architecture/routing.md` + `docs/architecture/skeleton-loaders.md`: one gate per shell, loading-state rules, tap prefetch.
- `docs/architecture/supabase-capacity.md`: query fixes and Realtime share.
- `.cursor/rules/admin-auth.mdc`: if D-2 lands.
- Route guides for any shell whose loading behavior changes (`route-guides` skill). Support content N/A unless host-visible behavior changes.
- `docs/architecture/ops-reports.md` + `docs/guides/routes/admin/ops-reports.md`: Performance and usage section, new sources, schema v2, new finding IDs.
- `docs/architecture/observability.md`: `route_pattern`/`surface` properties, boot measurements, rollup tables, retention.
- `docs/architecture/data-model.md`: `edge_function_daily_stats`, `vendor_daily_stats`, query snapshot table.
- This plan's status ledger, `STATUS.md`, `LEDGER.md`.

## Status ledger

| Phase | State                                                   | Evidence                                                                                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | partial (0.1, 0.2, DB capture shipped)                  | `bootMarks.ts` + 10 Vitest, `serverTiming.ts` + 10 Deno, `bootMarks.spec.ts` 3 E2E. Baseline captured: `perf-2026-11-08-before.md` + `2026-11-08-pg-stat-before.json`, via the new `perf:pg-stat:snapshot` (no `psql` needed). Lighthouse and authenticated edge latency still open.                                    |
| 1     | partial (RC-6, RC-8, RC-9, RC-10, RC-11, RC-16 decided) | RC-6 and RC-16 confirmed with numbers, RC-9 and RC-8 partly rejected, RC-10 rejected, RC-11 confirmed and fixed. Remaining RCs need a hosted HAR trace.                                                                                                                                                                 |
| 2     | 2.3 blocked, 2.5 already present                        | Deferring telemetry contradicts 0.1 (see note). `MarketingImage` + `responsiveImage.ts` already ship `srcset`, `sizes` and `fetchPriority` on the LCP image. Bundle unchanged: 246.4 / 633.2 KiB.                                                                                                                       |
| 3     | partial (3.1 safe form, 3.3, 3.4, 3.5)                  | `get-session-context` bootstraps the shell in one call (3.015 s to 1.006 s). Page chunk starts with the shell, gate queries persist, shell extras deferred. **3.2 TenantGate and 3.6 other shells remain.**                                                                                                             |
| 4     | 4.1 rejected                                            | `x-region: ap-southeast-1` measured 34% slower than default routing (0.376 s vs 0.28 s warm). Not shipping a pessimization. 4.2 (local JWT verification) is D-2 and stays open.                                                                                                                                         |
| 5     | not started                                             | Needs D-1 and `kamewave` to test the Vercel proxy.                                                                                                                                                                                                                                                                      |
| 6     | analysed, no fix yet                                    | Top statements captured (`perf-2026-11-08-before.md`). RC-16 confirmed at 85% Realtime. 6.1 to 6.5 need a decision on whether to move Realtime to Broadcast, which is a behaviour change and not a query fix.                                                                                                           |
| 7     | partial                                                 | 7.1 dropped (RC-10 rejected), 7.2 chunk half shipped, 7.8 already present. 7.3 to 7.7 need a standalone-PWA trace.                                                                                                                                                                                                      |
| 8     | partial                                                 | Bundle budget ratcheted to the measured build (260 / 660 KiB, was 500 / 1200, which passed at ~2x the real size and could not catch a regression). Durable rules captured in `.cursor/rules/edge-latency.mdc`. Lighthouse CI, the `@perf` regression lane and Sentry alerts need hosted infrastructure and remain open. |
| 9     | not started                                             | Depends on Phase 0.3 and a production release.                                                                                                                                                                                                                                                                          |
| 10    | not started                                             | Needs Management API + PostHog + Sentry read tokens.                                                                                                                                                                                                                                                                    |

## Plan revisions

Reviewed against the tree on 2026-11-07 while starting execution. Changes made to this
document, and why.

**Corrected facts**

- Function count is 346, not 351 (re-counted). The conclusion is unchanged: most functions
  see too little traffic to stay warm.
- `lighthouse-medians.mjs` lives at `scripts/performance/lighthouse-medians.mjs`, not
  `scripts/dev/`. The whole perf suite is under `scripts/performance/`.
- There is no `perf:report` script yet. Phase 0.3 has to build it; the individual pieces
  (`perf:lighthouse`, `perf:edge-latency`, `perf:supabase:snapshot`,
  `perf:chunk-graph`, `perf:baseline`, `load-test`) already exist and can be composed.
- `check-initial-bundle-budget.mjs` currently allows 500 KiB entry / 1200 KiB initial, so
  today's 246.5 / 633.2 passes with a lot of headroom. Phase 8.1 has to lower these to the
  post-fix numbers or the gate cannot catch a regression.

**Root causes decided or dropped**

- **RC-10 rejected.** The 300 ms skeleton hold does not apply to route navigation (see the
  note in the RC section). Phase 7.1 dropped.
- **RC-6 confirmed.** The offline allowlist omits every shell-gate query. Phase 3.4 stands.
- **RC-8 partly resolved.** The cache-class contract already exists and is CI-guarded; what
  is missing is CDN honouring of `s-maxage`. That is Phase 5, not a bug to hunt.

**Phases changed**

- **Phase 2.3 blocked.** Deferring Sentry tracing would delete the pageload transaction that
  Phase 0.1 measures, and deferring the PostHog telemetry wiring can lose early PWA events.
  Resolved by keeping both eager and recording the measurement instead of the change.
- **Phase 0.1 scope clarified.** Marks are first-wins except navigation pairs, and any mark
  that never fires reports `null` rather than zero, so a page that is not instrumented cannot
  look fast. `nav:start` fires on route commit, which makes `navContentMs` a documented lower
  bound on tap-to-content.
- **Phase 0.2 scope clarified.** Per-phase header is `auth`, `settings`, `blocklist`,
  `ratelimit`, `handler`. A throwing phase is still recorded. Durations only, which is what
  makes `Timing-Allow-Origin: *` defensible.

**Still requires an operator**

`SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` (0.3, 6, 10), a read-only production host
account or a demo org (host Lighthouse/boot runs), a PostHog personal API key and project id
(10.5), and `kamewave` for the production deploy, the stats reset and the Vercel proxy test.

**3.1 shipped in its safe form (2026-11-10).** `get-session-context` returns the same payloads from the same shared loaders in one request, and the client seeds the existing query keys. The guards are untouched: a failed bootstrap seeds nothing and they fetch for themselves, so the behaviour degrades to the old path rather than locking anyone out. Four calls in 3.015 s became one in 1.006 s, about -67% serially and -47% against the browser's two parallel pairs. **3.2 (the `TenantGate` rewrite) stays open** because it changes the control flow of every dashboard route and needs a role-parity suite.
