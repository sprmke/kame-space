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

## 3. One bootstrap call for the admin shell

**Date:** 2026-11-10. `get-session-context`. Phase 3.1, in its safest form.

A cold dashboard open made four to six authenticated calls before it could paint: session,
then organizations and properties, then property-access and entitlements (both blocked on the
property id), then the page. Each call also paid auth and a rate-limit write.

`get-session-context` returns the same payloads, from the same shared loaders, in one request,
and the client seeds the existing query keys from it. **The guards are unchanged.** If the call
fails, nothing is seeded and the guards fetch for themselves, exactly as before, so an outage
degrades to the old behaviour instead of locking anyone out.

Measured from Manila against production, warm, medians:

| Path                                         | Time        |
| -------------------------------------------- | ----------- |
| The four calls it replaces, serial sum       | **3.015 s** |
| `get-session-context`, serial reads          | 1.395 s     |
| `get-session-context`, reads run in parallel | **1.006 s** |

**-67% against the serial sum.** In the browser the baseline is not fully serial (organizations
and properties already ran in parallel, then access and entitlements), so the like-for-like
figure is roughly 1.9 s to 1.0 s, about **-47%**. The bigger point is four fewer round trips,
four fewer rate-limit writes, and one loading state instead of four.

`Server-Timing` on the single call: `auth` 0 ms after the first in a burst, `ratelimit` ~120 ms,
`handler` **484-674 ms** for all four payloads together (it was ~972 ms before the reads were
parallelised).

Payload parity checked against production: organizations 1, properties 1 with stats,
`propertyAccess.accessKind = owner` with 95 permissions, entitlements `planName = Free` with 40
keys. No token and a bad token both return `401`.

### Why this is not the full 3.2

3.2 collapses the six guards into one `TenantGate`. That changes the authorisation control
flow of every dashboard route and needs a role-parity suite across owner, org admin, property
member, plan-limited, revoked, suspended, super-admin and wrong tenant. Seeding the existing
keys buys most of the round-trip saving with none of that risk, so the gate rewrite stays open
as its own decision.

---

## 4. Authenticated wrapper cost

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

### Boot-path handlers, after exact duplicate-verification removal

**Date:** 2026-11-09. The wrapper's verified user is now passed into `verifyPropertyAccess`,
`verifyOrgListAccess` and `resolveScopedPropertyAccess`, so the inner checks reuse it instead
of verifying the same token again. This is exact, not a TTL: no revocation window is widened.
It replaces the five-second cache for these endpoints; the cache stays for the many other
callers that have not been threaded yet.

Medians of seven warm calls each, taken after deploy.

| Endpoint                    | Handler before | Handler after | Change   |
| --------------------------- | -------------- | ------------- | -------- |
| `list-organizations`        | 488 ms         | **128 ms**    | **-74%** |
| `property-access`           | ~390 ms        | **125 ms**    | **-68%** |
| `property-entitlements`     | ~636 ms        | **389 ms**    | **-39%** |
| `list-properties`           | ~400 ms        | **393 ms**    | ~0%      |
| **Boot-path handler total** | **~1914 ms**   | **~1035 ms**  | **-46%** |

The last three improved from `resolve_property_access` (migration `20261325000000`), which
returns the property, its org and both membership rows in one read. `verifyPropertyAccess` used
to fetch those in up to four sequential round trips. **No permission rule moved**: the same
decision tree runs on the same rows, so an authorisation mistake would have to come from the
data, not from a reordered branch. `property-access` is the clearest case: one read replaced
three for an owner.

Access control re-checked against production after deploy: owner `200`; unknown property
`404`; missing `property_id` `400`; no token and bad token `401`; a different org's
`list-properties` `403`.

`auth` reads `0 ms` on every call in a burst, with an occasional 84-121 ms when the five-second
window lapses between calls. Previously every call paid it.

### Still open, and why it is not a quick win

`list-properties` is the one handler whose remaining cost is not round trips. It selects
**every booking row in the organization** and aggregates them in JavaScript into
`activeBookings`, `monthlyRevenue` and `occupancyRate` (`_shared/propertyListStats.ts` to
`computePropertyPeriodStats`).

`activeBookings` deliberately counts non-cancelled, non-completed bookings **regardless of
date**, while revenue and occupancy are month-scoped. A naive date or status filter in SQL
would therefore change numbers a host sees. Porting it needs a full KPI-parity test against
the current implementation, which is a dedicated change rather than something to fold into a
latency pass. Recorded here so it is not lost.

---

## 5. Landing chunk preloaded

**Date:** 2026-11-10. `ui/vite-plugins/preloadLandingChunk.ts`. Phase 2.1.

Vite preloads the entry's static imports. A lazy route chunk is fetched only when the router
reaches the route, which is after the entry has parsed and executed. On `/` that is a
guaranteed extra round trip before the hero can paint.

A build plugin now reads the manifest after the bundle is written and adds one
`modulepreload` for the landing chunk. It fails silently by design, so
`check:landing-preload` turns a silent loss into a CI failure, and also checks the preloaded
file exists.

| Metric                               | Before                   | After                      |
| ------------------------------------ | ------------------------ | -------------------------- |
| `modulepreload` tags in `index.html` | 8                        | **9**                      |
| Landing chunk request starts         | after the entry executes | **with the entry**         |
| Landing chunk size                   | n/a                      | 9.8 KiB gzip               |
| Initial chunks (budget)              | 633-634 KiB              | **643.9 KiB** (budget 660) |

The win is the round trip, not the bytes. It does not change the byte budget materially and
it does not change rendering order.

---

## 6. Public site

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

## 7. Database

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

## 8. Dashboard cold open (lab)

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

## 9. Bundle

**Date:** 2026-11-08.

| Metric                  | Value                         |
| ----------------------- | ----------------------------- |
| Entry (gzip)            | 246.4 KiB                     |
| 9 initial chunks (gzip) | 633.2 KiB                     |
| `observability-vendor`  | 90.7 KiB on the critical path |
| `motion-vendor`         | 46.7 KiB on the critical path |

---

## 10. Rejected, with numbers

| Change                                             | Result                                             |
| -------------------------------------------------- | -------------------------------------------------- |
| Pin edge functions to `ap-southeast-1` (Phase 4.1) | **34% slower** from Manila: 0.376 s vs 0.28 s warm |
| Skeleton minimum-visible hold (Phase 7.1)          | Already absent on route navigation                 |
| `mockProperties` out of the entry (RC-9)           | Already absent from the built entry                |
| Hero `srcset` / `fetchPriority` (Phase 2.5)        | Already shipped in `MarketingImage`                |

Recording rejections matters as much as recording wins: three of these would have been
plausible-sounding changes that either did nothing or made the app slower.

---

## 11. Authenticated dashboard boot (first real measurement)

**Date:** 2026-11-11. Production, signed in as the probe account, 390x844, 4x CPU throttle,
median of three warm runs, read from the Phase 0.1 boot marks.

| Metric                                          | Value       |
| ----------------------------------------------- | ----------- |
| First render                                    | 134 ms      |
| Full-screen loader visible                      | **1754 ms** |
| Content ready                                   | **4201 ms** |
| Authenticated edge calls for one dashboard load | **24**      |

That corrects an earlier estimate in this document: the boot path is not four to six calls, it
is twenty-four.

### Where those calls sit on the timeline

Each row is the first request for that endpoint, relative to navigation start.

| At          | Phase          | Calls                                                                                                                                                                                                                |
| ----------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1484 ms     | before content | `get-public-platform-status`                                                                                                                                                                                         |
| 1819 ms     | before content | `get-session-context`                                                                                                                                                                                                |
| **3747 ms** | before content | burst of 9: `app-settings`, `org-settings`, `org-plan`, `list-parkings`, `notifications-list`, `org-access`, `get-feature-availability`, `property-lifecycle`, `dashboard-assistant-settings`, `user-ui-preferences` |
| 3801 ms     | before content | `guest-profile`                                                                                                                                                                                                      |
| 3962 ms     | before content | `list-host-announcements`                                                                                                                                                                                            |
| **4298 ms** | before content | `dashboard-stats` plus `property-team-members`, `-invitations`, `-custom-roles`                                                                                                                                      |
| 6738 ms     | at content     | `maintenance-summary`, `maintenance-items`, `finance-line-items`, `finance-bookings`, `list-bookings`                                                                                                                |

Content was ready at 6749 ms. Three things this shows that guessing had got wrong:

1. The **9-call burst at 3747 ms** is the critical path, not the tail. It starts 1.9 s after the
   bootstrap resolves (shell-chunk download plus render) and competes for the phone's 4 to 6
   connections while `dashboard-stats` is in flight.
2. `notifications-list` and `list-host-announcements` are already gated behind first paint and
   still land before content, because first paint is at 3747 ms and content at 6749 ms. The gate
   bought paint time, not content time.
3. The five calls below land **exactly at** content, which is what the gate is meant to do.

### Five calls moved off the critical path

`maintenance-summary`, `maintenance-items` (the maintenance reminders card) and
`finance-line-items`, `finance-bookings`, `list-bookings` (the finance calendar section) now gate
on `useAfterFirstPaint`, the same mechanism already used for the notification preview. The cards
still render, with their existing skeletons, and the data arrives one idle tick later.

### Still to find

The three `property-team-*` calls fire in the same millisecond as `dashboard-stats`, so they live
in the dashboard render tree, but no call site on that tree references `usePropertyTeam`. The
built chunk `usePropertyTeam-*.js` is imported by `AdminLayout`, so the consumer is somewhere in
that graph and needs elimination rather than grep. `guest-profile` fires on an admin route
because the guest auth provider wraps every route. Both are recorded so the next pass starts from
evidence.

## 13. Decisions, settled

**Date:** 2026-11-11. Both were open questions in the plan; the owner delegated the call.

### D-2, local JWT verification: **not doing it**

`getUser` costs 84-121 ms, and after the token cache and the verified-user threading it is paid
**once per burst**, not per call. Against that saving, `getUser` is what makes sign-out, session
revocation and account disable take effect immediately. Local ES256 verification would leave each
of those accepting reads for up to the token lifetime, measured at **3600 s**, on a surface that
returns guest names, contact details and bookings.

Bounded, quantified, and on the wrong side of the trade. Revisit only with a stated maximum
offboarding delay and reads-only scope.

### Realtime Postgres Changes: **not changing it now**

Realtime `list_changes` is **85.02%** of all database time, 12.88M ms across 1,664,792 calls. It
is also the largest single number in this document.

It is not, however, user-facing latency today: index and table cache hit rates are both `1.00`
and the slow handlers in the call timeline are round trips, not query time. Moving to Broadcast
from Database triggers changes how inbox, notifications and guest chat receive updates, which
needs its own realtime test pass.

So: measured, prioritised, and deliberately deferred to a focused change rather than folded into
a latency pass. The number stays here so it is not forgotten.

## 14. Credentials available on this machine

Checked 2026-11-11, read-only.

| Credential                 | Where                            | Status                                                                     |
| -------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `SENTRY_AUTH_TOKEN`        | `supabase/.env.management.local` | **works**, 2 projects reachable                                            |
| `POSTHOG_PERSONAL_API_KEY` | `supabase/.env.management.local` | valid but **project-scoped and missing `query:read`**, so HogQL is refused |
| `SUPABASE_ACCESS_TOKEN`    | `supabase/.env.management.local` | works                                                                      |
| `VERCEL_TOKEN` (env)       | `supabase/.env.management.local` | invalid; the working credential is the Vercel CLI login                    |

The weekly report's Sentry source is unblocked. Its PostHog source needs a personal API key with
**`query:read`** (and `project:read`); the existing key cannot run the HogQL queries the report
depends on.

## Release state

**2026-11-10.** PR #371 synced `main` to `develop`'s tree and shipped the UI side.

`main` and `develop` share **no commits** (`git merge-base` is empty). Releases on this repo are
squashed, so ancestry never carries over and a `develop` to `main` PR is a tree sync by design,
not a merge. That is worth knowing before panicking at a 3412-commit divergence: compare trees,
not commit counts.

Verified after the release:

| Check                               | Result                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `SessionBootstrapGate` chunk served | yes, and it contains the `get-session-context` call                                       |
| `get-session-context` live          | `401` without a token, `200` with one                                                     |
| Public routes                       | `/`, `/properties`, `/for-hosts`, `/for-hosts/pricing`, `/support`, `/parkings` all `200` |
| Public landing, 3 cold runs         | **332 ms to content, root loader 0 of 3**, identical to before the release                |

The backend half was already live before the release, because edge functions deploy from
`develop` on every push. The release is what makes the browser use them.

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
