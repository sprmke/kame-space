# Performance: before and after

A running record of measured changes on the app-speed plan, with the method for each number
so a later reader can reproduce or dispute it. Everything here is production unless the row
says otherwise.

Plan: `docs/workflow/in-progress/app-speed-root-cause-overhaul.md`.

---

## 1. `list-organizations`: 7 round trips to 1

**Date:** 2026-11-09. **Phase 4.4.** Migration `20261324000000_list_user_organizations_rpc`.

The handler issued up to seven sequential PostgREST queries (owned orgs, active property
memberships, plan-limited inactive ones, the properties behind both, org-hub memberships,
then one or two more organization reads). Database index and table cache hit rates were
both `1.00` and the database is 101 MB, so the cost was round trips, not query work.

Method: production probe account, warm session, six consecutive calls, reading the
`Server-Timing` header added in Phase 0.2. First call after deploy is cold and excluded.

| Metric                       | Before      | After       | Change   |
| ---------------------------- | ----------- | ----------- | -------- |
| `handler` (median)           | **488 ms**  | **128 ms**  | **-74%** |
| Total request, warm (median) | **0.999 s** | **0.554 s** | **-45%** |

Raw before (`handler`): 488, 507, 546, 488, 476, 470 ms.
Raw after (`handler`): 144, 131, 130, 115, 114, 126 ms.

Payload parity: the response for the probe account before and after deploy is byte-identical
for `slug`, `accessKind` and `planLimited`. The RPC was also evaluated against five real users
with mixed access kinds (owner, org admin) inside a rolled-back transaction before it shipped.

---

## 2. Duplicate `auth.getUser` per request

**Date:** 2026-11-09. `verifyAuthenticatedUser` in `_shared/orgAuth.ts`.

A property-scoped request verified the same JWT **twice**: once in the `serveAuthenticated`
wrapper, then again inside `verifyPropertyAccess`. Each `auth.getUser` is a network round trip.

Fix: a five-second cache keyed by the bearer token. It collapses the duplicate inside one
request (milliseconds apart) without meaningfully widening the revocation window, and it is
deliberately short so it is not the D-2 trade-off in disguise.

| Metric                                          | Before         | After     |
| ----------------------------------------------- | -------------- | --------- |
| `auth` phase, first call in a burst             | 84-110 ms      | 84-126 ms |
| `auth` phase, following calls in the same burst | 84-110 ms each | **0 ms**  |

Observed live after deploy: `list-properties` reported `auth;dur=0.0` on every call after the
first, where it previously paid the round trip each time. A dashboard boot makes 4 to 6
authenticated calls in quick succession, so this removes roughly 90 ms multiplied by the
number of calls after the first.

Not claimed: this does not remove the _first_ verification per burst. Doing that is D-2 (local
JWT verification), which is still open.

---

## 3. Authenticated wrapper cost

**Date:** 2026-11-09. Measured, not yet reduced.

Every authenticated call runs `auth`, `blocklist`, `settings`, `ratelimit` then `handler`.

| Phase              | Warm cost  | Notes                               |
| ------------------ | ---------- | ----------------------------------- |
| `auth` (`getUser`) | 84-110 ms  | network call to Auth, every request |
| `blocklist`        | 0 ms       | isolate cache after the first call  |
| `settings`         | 0 ms       | 60 s cache                          |
| `ratelimit`        | 120-280 ms | `bump_rate_limit`, a database write |

**Nothing has been shaved off this yet.** An in-isolate counter now handles the log-only mode
(PR #357), but production runs with `authenticated_rate_limit_enforce = true`, so it still
pays the write. Correcting this after the fact: the log-only change is a speed _option_, not
a saving this deployment collected.

Open decision: local JWT verification for reads would remove the `auth` cost for the first
call in a burst too, at the price of revocation lag up to token lifetime.

### Remaining handler hotspots (measured, not yet fixed)

| Endpoint                | Handler, warm               |
| ----------------------- | --------------------------- |
| `property-entitlements` | 505-743 ms                  |
| `list-properties`       | 381-800 ms                  |
| `property-access`       | 261-399 ms                  |
| `list-organizations`    | 128 ms, after the fix above |
| `parkings`              | fast (no per-phase header)  |

These three are the remaining dashboard-boot cost: about 1.0 to 1.4 s of handler time per
boot, on top of ~90 ms auth and ~130 ms rate limit per call. Each is a multi-query PostgREST
handler like `list-organizations` was, so the same treatment applies.

---

## 4. Public site

**Date:** 2026-11-09. Measured, no change shipped in this window.

Real production landing page, mobile viewport, three cold runs:

| Metric                   | Value           |
| ------------------------ | --------------- |
| TTFB                     | 38 ms           |
| First render             | 34 ms           |
| `route:content` (median) | **332 ms**      |
| Root loader shown        | **0 of 3 runs** |

Public edge handlers, warm:

| Endpoint                 | Handler    | Total       |
| ------------------------ | ---------- | ----------- |
| `list-public-properties` | 119-139 ms | 0.33-0.44 s |
| `get-public-property`    | 250-252 ms | 0.51 s      |

---

## 5. Database

**Date:** 2026-11-08. `pg_stat_statements`, 96 days since reset (no reset performed).

| Metric                                       | Value                       |
| -------------------------------------------- | --------------------------- |
| Database size                                | 101 MB                      |
| Index hit rate                               | 1.00                        |
| Table hit rate                               | 1.00                        |
| **Realtime `list_changes` share of DB time** | **85.02%**                  |
| `SELECT name FROM pg_timezone_names`         | 393 ms per call, 869 calls  |
| Recursive domain base-type walk              | ~113 ms per call, 869 calls |

No index can help; cache is already perfect. The 85% is background Postgres Changes polling.

---

## 6. Dashboard cold open (lab)

**Date:** 2026-11-08. Local build, mocked edge calls, Phases 0.1 marks. Directional only:
mocks answer instantly, so this cannot show a network saving.

| Mark                      | 1x CPU | 4x CPU  |
| ------------------------- | ------ | ------- |
| `firstRenderMs`           | 40 ms  | 130 ms  |
| `loaderMs` (first window) | 587 ms | 748 ms  |
| `routeContentMs`          | 812 ms | 1410 ms |

The loader barely reacts to CPU throttle (+27%) while content doubles, so the loader is time
spent waiting on promises, not parsing. ~220 ms of it is the deliberate anti-flash bridge.

---

## 7. Bundle

**Date:** 2026-11-08.

| Metric                  | Value                         |
| ----------------------- | ----------------------------- |
| Entry (gzip)            | 246.4 KiB                     |
| 9 initial chunks (gzip) | 633.2 KiB                     |
| `observability-vendor`  | 90.7 KiB on the critical path |
| `motion-vendor`         | 46.7 KiB on the critical path |

---

## 8. Rejected, with numbers

| Change                                             | Result                                             |
| -------------------------------------------------- | -------------------------------------------------- |
| Pin edge functions to `ap-southeast-1` (Phase 4.1) | **34% slower** from Manila: 0.376 s vs 0.28 s warm |
| Skeleton minimum-visible hold (Phase 7.1)          | Already absent on route navigation                 |
| `mockProperties` out of the entry (RC-9)           | Already absent from the built entry                |
| Hero `srcset` / `fetchPriority` (Phase 2.5)        | Already shipped in `MarketingImage`                |

Recording rejections matters as much as recording wins: three of these would have been
plausible-sounding changes that either did nothing or made the app slower.

---

## How to reproduce

```bash
# database
bun run perf:pg-stat:snapshot -- --label=after

# edge phases (public)
curl -D - -o /dev/null https://fworvijbrwpyngycotbz.supabase.co/functions/v1/list-public-properties

# edge phases (authenticated, probe account)
node /tmp/mint.cjs && curl -D - -o /dev/null \
  -H "Authorization: Bearer $(cat /tmp/probe.token)" \
  https://fworvijbrwpyngycotbz.supabase.co/functions/v1/list-organizations

# dashboard boot (lab, manual lane)
bun run perf:boot-timeline
```

Clear `ui/node_modules/.vite` before any comparison run. A dep cache built while the tree was
stashed serves a stale module graph and silently invalidates the measurement. That mistake is
how an earlier before/after in this plan was produced incorrectly.
