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

## 15. Why the dashboard boot was slow: two calls, not ten

Measured 2026-11-11 on production, mobiles at 4x CPU throttle, three runs, medians.

Section 11 counted the calls and concluded the ten-call burst at ~4.1s was the critical path.
Measuring **durations** instead of start times shows that was half right. The burst is real,
but its members return in 0.8-2.6s. Two calls outside that reasoning were the actual cost:

| Call                    | Handler time, warm | Why                                                                        |
| ----------------------- | ------------------ | -------------------------------------------------------------------------- |
| `property-team-members` | **3105-3904 ms**   | a seat reconcile on a GET, plus one GoTrue admin call per member in series |
| `app-settings`          | **2456-3719 ms**   | nine sequential independent reads                                          |

Both were verified with `Server-Timing` directly against the deployed functions, three times
each, so this is handler time, not cold start or network.

### `property-team-members` was not needed on the dashboard at all

The dashboard never shows the team. The calls came from the AI composer's mention catalog:
`useAssistantContextCatalog` fetched the org team, property team and parking team on mount,
and `ChatComposerContextHub` mounts it with its popover **closed**. The catalog was loading the
data for a menu nobody had opened.

`useAssistantContextCatalog({ enabled })` now holds every request until a caller opens it.
`ChatComposerContextHub` passes its own `open` state. Callers that only mount when the picker
is visible (`ChatContextCommandPalette`, `MentionCandidatesLoader`) keep the default and are
unchanged.

`usePropertyTeam` gained an `enabled` option, the same shape `useParkings` already had.

### `app-settings` stays, so it had to get faster

`AdminBrandTheme` is mounted by `AdminLayout` and needs the brand colour, so this call is
legitimate. The handler ran nine independent reads one after another. `resolveAppSettings` was
already parallel internally; the outer function was not.

They now fan out in one wave behind a single `Promise.all`. The two that genuinely depend on the
resolved property id (residence name, then the PMO email derived from it) stay sequenced.

### The N+1 nobody would notice until it mattered

`listPropertyTeamMembers` awaited `getAuthProfile` inside its loops. One GoTrue admin round trip
per member, plus one per inviter, in series. The test tenant has a single owner, so it cost one
call there and would cost twenty on a ten-seat property. Profiles are now collected first and
fetched together, then the rows are built from a map.

### Code paths

| Change            | File                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| Catalog gating    | `ui/src/features/dashboard/ai-assistant/hooks/useAssistantContextCatalog.ts`   |
| Hub passes `open` | `ui/src/features/dashboard/ai-assistant/components/ChatComposerContextHub.tsx` |
| `enabled` option  | `ui/src/features/dashboard/team/hooks/usePropertyTeam.ts`                      |
| Fan-out           | `supabase/functions/_shared/appSettings.ts`                                    |
| Batched profiles  | `supabase/functions/_shared/propertyTeamService.ts`                            |

### Reproduction

```bash
# per-call durations, not just start times
bun run perf:boot-durations

# handler time for a single function, warm
curl -s -D - -o /dev/null \
  -H "Authorization: Bearer $TOKEN" \
  "$SUPABASE_URL/functions/v1/property-team-members?propertyId=$PID" | grep -i server-timing
```

The read-path seat reconcile is left in place. It is a write on a GET, which is why it is slow,
but enforcement also runs on every plan and subscription change (`subscriptionOrchestrator`,
`planEntitlements`), and removing the lazy catch-up would change how quickly a downgrade
deactivates seats. That is a product decision, not a latency one, so it is recorded here rather
than changed.

### Measured after

Production, 2026-11-11, probe account, 4x CPU throttle.

### Read this first: the first version of this section was measured wrong

The numbers below were first produced with `performance.getEntriesByType('resource')`. That API
reads a **fixed-size ring buffer**. Once it fills, entries are evicted and the list comes back
short without any error. Two conclusions were drawn from a short list and both were wrong:

- "`property-team-members` is gone from the boot" was published twice. The call never stopped.
- "21 distinct calls" was an undercount. Counting the same boot through CDP
  `Network.requestWillBeSent` shows **24**.

`perf:boot-durations` now reads CDP network events, which are not evicted. Treat any call-set
claim made before that change as unverified.

### What is method-consistent and holds

| Metric                                             | Before       | After            | Change                             |
| -------------------------------------------------- | ------------ | ---------------- | ---------------------------------- |
| `app-settings` handler, direct `curl`, warm        | 2456-3719 ms | **1793-1950 ms** | **-30%**                           |
| `property-team-members`, browser-observed duration | 5822 ms      | **174 ms**       | queueing relief, not handler speed |

Both endpoints were called directly, three times each, with `Server-Timing`, so the `app-settings`
figure is the same measurement before and after. The `property-team-members` figure is the
browser-observed request duration, and the improvement is **its position in the queue**, not its
handler: measured directly it still costs 2986-3522 ms, because on the single-owner test tenant
the cost is the seat reconcile rather than the per-member lookups the N+1 fix targets.

### State at that point, measured with CDP (before the prefetch below)

| Metric                                       | Value                          |
| -------------------------------------------- | ------------------------------ |
| `route:content` median, `/dashboard`, 3 runs | **5132 ms** (5317, 5132, 4831) |
| Distinct boot calls, `/dashboard`            | 24                             |
| Distinct boot calls, `/bookings`             | 19                             |
| `app-settings`                               | 1660 ms                        |
| `org-plan`                                   | 1283 ms                        |
| `dashboard-stats`                            | 827 ms                         |

Content is gated on `dashboard-stats`, which starts about 400 ms after the chrome burst because it
queues behind it.

### The team calls: found, and it was not what it looked like

Traced in a local dev build with unminified frames, which is what should have been done first:

```
usePropertyTeam
  <- usePropertySettingsController   (PropertySettingsCard.tsx:180)
  <- PropertySectionsInner           (SetupGuideStepBody.tsx:207)
```

`SetupGuideProvider` mounts the setup guide on every admin route, and the guide renders the
property settings sections. The probe property is `INACTIVE` with no settings, so the guide
**opens automatically**, and its building-forms step needs the team to prefill contact defaults.
That is a legitimate read. It also explains why the calls appeared on `/dashboard`, `/bookings`
and `/settings`: one open overlay, not three page-level consumers.

The earlier hypotheses were all wrong for the same reason: they were reasoned from the source
tree instead of traced. The catalog was innocent (none of its eleven other queries fired), the
composer picker was dead code (its label is in no shipped chunk), and the answer was a component
two levels above the one that looked responsible.

**A regression this pass introduced, now fixed.** Making the query opt-in broke
`PropertySettingsCard`'s team defaults, and a later commit (`103047497`) had already dropped the
`enabled: true` meant to keep it working. The controller now opts in explicitly, so the settings
and setup-guide surfaces behave exactly as before, and only a future caller that forgets to opt
in gets no request.

### Content gate moved ahead of the burst

`dashboard-stats` is the only call `route:content` waits on, and it used to start ~300 ms after the
chrome burst because the burst had taken the connections. `useSessionBootstrap` now prefetches it
as soon as the session context resolves, on the property dashboard route only
(`isPropertyDashboardPath`, exact match, unit-tested). Same query key and `staleTime`, so the page
reuses the in-flight request rather than firing a second one.

Local ordering after the change, before deploy:

```
1  get-session-context
2  dashboard-stats      <- now ahead of the chrome burst
3  app-settings
4  org-settings
5  org-plan
```

### A testing trap worth recording

Running the `org/unsavedChangesGuard` spec inside this worktree failed 11 of 14 while the same
spec passed 7/7 on a clean checkout. The cause was not the code: copying real `ui/.env*` files into
the worktree to run a dev server changed what the E2E app pointed at. Remove those files before
running Playwright in a worktree, or the run measures the wrong thing. Bisecting by reverting
source changes would never have found it.

### Telemetry had been measuring one page named `/*`

Starting the report work surfaced this: seven days of Sentry contained **one** transaction name,
`/*`, across 377 events.

The router is deliberately a single splat route with `<Routes>` inside `AppRoutes` (see
`ui/src/main.tsx`), so `reactRouterBrowserTracingIntegration` and `wrapCreateBrowserRouter` can
only ever see the splat. Every transaction, and every `boot.*` measurement attached to it, was
anonymous. Fixing the latency without noticing this would have left no way to prove the fix held
beyond the day it shipped.

`routePatternFor` derives the pattern from the pathname instead. Route names only: the segment
after a tenant parent, and any UUID, long hex id or email-shaped segment, becomes `:param`. Fifteen
unit cases assert that no identifier survives.

**Not yet confirmed in Sentry.** Transactions are ingesting (2 in the hour after the release, which
is the configured 5% of 40 dwelled loads), but the available API token cannot read the
transactions dataset: `stats_v2?category=transaction` returns volume while
`/events/?dataset=transactions` returns an empty list. Confirming names needs the Sentry UI or a
token with event read on that dataset. Stated here rather than claimed as verified.

### Remaining structural option

1. **Collapse the burst into `get-session-context`**, the pattern that already took the boot chain
   from four calls to one. It is the only structural win left, and worth less than it was now that
   `app-settings` is 30% cheaper and `dashboard-stats` no longer queues behind the burst.

The `dashboard-stats` prefetch ships with this change and is measured after deploy.

### What gates content now

```
2655 ms   burst starts (org-settings, org-plan, list-parkings, notifications-list, ...)
2976 ms   dashboard-stats starts  <- 320 ms after the burst got the connections
4613 ms   dashboard-stats ends
4599 ms   route:content
```

Content is gated on `dashboard-stats`, and `dashboard-stats` now starts late because it queues
behind ten chrome calls. Two ways forward, in order of value:

1. **Start `dashboard-stats` as soon as the session context resolves**, instead of waiting for the
   page to mount. It is the only call content waits on, so it should not queue at all. This is the
   cheapest remaining win, roughly 400-600 ms.
2. **Collapse the burst into `get-session-context`**, the pattern that already took the boot chain
   from four calls to one. Larger, and less valuable now that the two genuinely slow calls are
   fixed.

### Measured after the prefetch, production

Same probe account, same 4x CPU throttle, CDP counting, two independent three-run sets.

| Metric                  | Before  | After                | Change    |
| ----------------------- | ------- | -------------------- | --------- |
| `route:content` median  | 5132 ms | **3832 ms** (5 runs) | **-25%**  |
| `dashboard-stats` start | 2976 ms | **1356 ms**          | **-54%**  |
| Distinct boot calls     | 24      | 24                   | no change |

Raw runs, four independent sets: 3215, 3888, 3057 / 6954, 3340, 3433 / 7798, 2997, 4121 /
3832, 4398, 2929, 4234, 3353. The first run of a set is usually the slowest, which is a cold edge
isolate rather than the change. Quoted is the five-run median, the least favourable of the four,
because this machine is noisy and the conservative number is the one worth publishing.

The call count did not change, and that is the point: the win is ordering, not volume.
`dashboard-stats` used to start 320 ms after the chrome burst had taken the connections; it now
starts 150 ms after the session context returns, ahead of everything else.

```
 279 ms  get-session-context starts
 878 ms  get-session-context ends
1356 ms  dashboard-stats starts   <- was 2976
1945 ms  dashboard-stats ends
1534 ms  chrome burst starts (app-settings, org-plan, list-parkings, ...)
3215 ms  route:content
```

Content now lands about 1.3 s after the stats response, which is React render and paint rather
than network. The remaining structural option is collapsing the burst; it is worth less now.

The opt-in team query shipped in #422. It did not remove the team calls, and the trace above
explains why: they come from the setup guide, which only mounts when it is open.

## 16. Uploads

Measured 2026-11-12 against production, `upload-app-settings-asset`, warm, two samples per size,
real JPEGs encoded to size.

| File     | Total time  |
| -------- | ----------- |
| 10 KiB   | 0.89-1.40 s |
| 64 KiB   | 0.86-1.12 s |
| 1.55 MiB | 1.75-1.78 s |
| 4.53 MiB | 2.48-3.25 s |

Two numbers fall out of that: a **fixed ~0.85 s per upload** regardless of size, and roughly
**0.5 s per MiB** on top. The fixed part is auth plus the storage round trip plus the row write;
the linear part is the file being proxied through the edge function.

### What the path actually does

- Every upload is a multipart POST to an edge function, which then uploads to Storage. File bytes
  travel to the function and then to storage; nothing streams end to end.
- `UploadService.uploadFile` buffered the **entire file** (`arrayBuffer()`) only to sniff its MIME
  type, then uploaded the copy. The sniffer reads the first 12 bytes.
- The guest booking submit awaited **eight uploads in series**: pet document, pet photo, payment
  receipt, then up to five ID documents. At the measured fixed cost that is roughly 6.8 s of pure
  waiting before the booking row is written.

Images are not the problem: the client already runs `prepareImageForUpload` before sending. The
linear cost lands on **documents and video**, which are never compressed.

### Changed

| Change                                                                             | File                              |
| ---------------------------------------------------------------------------------- | --------------------------------- |
| Sniff 512 bytes, upload the `File` so the runtime streams it                       | `_shared/uploadService.ts`        |
| Booking submit runs its uploads concurrently                                       | `_shared/databaseService.ts`      |
| Bounded pool, 3 in flight, so a five-guest form cannot hold five documents at once | `_shared/concurrency.ts`          |
| Immutable marketing exports cached for a year instead of five minutes              | `_shared/marketingMediaUpload.ts` |

### Expected effect

A form with eight uploads goes from eight waves to three at the bounded pool size: about
**6.8 s to 2.6 s** of upload waiting, derived from the measured per-upload cost above. That is a
calculation, not an end-to-end measurement: a real booking submit needs a full valid payload, and
the load-test tooling deliberately refuses to write to production. The mechanism is proven by
`concurrency_test.ts`, where three 40 ms jobs finish in 41 ms rather than 120 ms.

What is **not** addressed: the bytes still proxy through the function. Direct-to-Storage uploads
with a signed URL would remove the ~0.5 s/MiB entirely, but that has to re-do authorisation and
post-upload validation on ten endpoints, which is a deliberate migration rather than a tweak.

## 17. Listing pages: the LCP was a lazy image

Measured 2026-11-12 on production, mobile viewport, LCP element from a PerformanceObserver.

| Route           | LCP element                    | LCP         |
| --------------- | ------------------------------ | ----------- |
| `/developments` | `IMG`, remote Unsplash `w=480` | **7668 ms** |
| `/for-hosts`    | `H1` text                      | 1624 ms     |

`/for-hosts` is fine: its largest paint is text. `/developments` was not. The largest element was
a card cover image that carried `loading="lazy"` and no priority hint, so the browser only
discovered it **after layout**. There was also no `preconnect` to `images.unsplash.com`, putting
DNS and TLS for the image host on the critical path.

`MarketingImage` already supported `priority` (eager + `fetchPriority="high"`); the listing cards
simply never passed it.

### Changed

| Change                                                 | File                                          |
| ------------------------------------------------------ | --------------------------------------------- |
| `preconnect` + `dns-prefetch` to `images.unsplash.com` | `ui/index.html`                               |
| First development card eager with high priority        | `developments/components/DevelopmentCard.tsx` |
| First property card cover eager with high priority     | `properties/components/PropertyCard.tsx`      |
| First row's first gallery image eager                  | `properties/components/PropertyListItem.tsx`  |

No visual change: the same image at the same size, loaded earlier.

### Measured after

Released 2026-11-12, same mobile viewport, LCP element read from a PerformanceObserver. The element
now reports `loading=eager` and `fetchPriority=high`, which is the proof the change applied.

| Route           | Before  | After       | Change                 |
| --------------- | ------- | ----------- | ---------------------- |
| `/properties`   | 8507 ms | **4320 ms** | **-49%**               |
| `/developments` | 7668 ms | 6628 ms     | -14%                   |
| `/`             | -       | 1112 ms     | hero already optimised |

`/properties` halved. `/developments` improved less, and the reason matters: its cover still comes
from `images.unsplash.com` with a `w=480` transform, and that third-party fetch is now most of the
remaining 6.6 s. Real developments carry Supabase Storage covers (the `/properties` LCP is a
Supabase `.avif`), so this is a fixture problem, not an app one. Making `/developments` fast would
mean serving local covers in the demo data, which is a content change rather than a performance
one.

`/parkings` measured 5991 ms in the same run, with the same lazy-first-card pattern, which is why
the fix went into the property cards too.

## 18. `app-settings`: stop paying for integrations on every load

Measured on production, `Server-Timing` on the handler, three warm calls: **1566-2424 ms**.

`serializeAppSettingsForAdmin` returns one payload used by eight call sites: the dashboard theme,
the bookings list, the booking edit form, the workflow panel, the inbox insert menu, the page
editor, the guest-experience readiness card, and the property settings page. Only the last one
renders `propertyIntegrations`, which is six Telegram credential reads.

Every other caller paid for those reads on every load. The endpoint now takes `?lean=1`, which
skips that block and returns `propertyIntegrations: null`. Seven call sites ask for lean; the
settings controller keeps the full payload and guards the panel on the value.

Lean and full use separate cache keys, and the save mutations write both, so a save cannot leave
one variant stale.

### Measured after

Same `Server-Timing` method, three warm calls each, after the deploy.

| Variant                           | Handler          |
| --------------------------------- | ---------------- |
| Full (settings page)              | 1591-1645 ms     |
| Lean (the other seven call sites) | **1442-1532 ms** |

So the integrations block is worth about **100-150 ms**, not the larger figure this section
originally predicted. That prediction was wrong and is corrected here: the six credential reads run
in parallel and are cached, so they never cost what six serial reads would.

What the change still buys is real but smaller: six fewer reads and their decryption on every
dashboard load, which is work off the edge function and off the database rather than a large
latency drop.

The remaining ~1.5 s is elsewhere in the payload: the settings row, the org settings row, the
residence name, the derived PMO email and the two document-requirement resolutions. Cutting that
further means splitting the payload by consumer, which changes the API surface for eight call
sites, so it is recorded rather than attempted.

## 19. Per-page latency, finally readable, and what it showed

The Sentry token blocked this for a while. The cause was not scopes: this organisation ingests the
**spans** dataset, so `dataset=transactions` returns nothing while `dataset=spans` returns data.
`sentry.io/api/0/organizations/{org}/events/?field=transaction&field=p75(span.duration)&field=count()&dataset=spans`
now gives per-route p75 over any period.

### The ranking, 7 days

| Page                                      | p75         | Samples |
| ----------------------------------------- | ----------- | ------- |
| `/org/:param/property/:param/analytics`   | **3139 ms** | 100     |
| `/org/:param/property/:param/maintenance` | **2264 ms** | 140     |
| `/org/:param/property/:param/marketing`   | **2053 ms** | 240     |
| `/org/:param/dashboard`                   | **1883 ms** | 200     |
| `/org/:param/property/:param`             | 1384 ms     | 280     |
| `/org/:param/property/:param/bookings`    | 1177 ms     | 200     |
| `/org/:param/bookings`                    | 892 ms      | 40      |
| `/org/:param/property/:param/finance`     | 660 ms      | 20      |

Also visible: `GET fwor…supabase.co` spans at **p75 4758 ms** across 3 320 samples. The individual
calls are cheap in isolation; under a page load that fires a dozen of them at once, they are not.

### Two defects this exposed

**1. `app-settings` had no `staleTime`,** so every component that mounted refetched it. One bookings
page load produced **six** requests for a payload that changes only when someone edits settings.
`useAppSettings` now uses 60 s, and `useParkings` matches it. Every mutation that changes either
already invalidates the key, so this cannot serve stale data after a save.

Measured after release, one browser session:

| Action                       | `app-settings` requests |
| ---------------------------- | ----------------------- |
| First load of `/bookings`    | 6                       |
| Navigate to the dashboard    | **0**                   |
| Navigate back to `/bookings` | **0**                   |

So the fix removes the refetch on every navigation, which is the common case. It does **not**
remove the six on first load, because those six are three distinct keys each fetched twice by the
double mount below — and a stale time cannot help two simultaneous mounts.

**2. Shell calls fire twice, simultaneously.** `get-session-context` at 298 and 299 ms,
`org-settings` at 2123 and 2130 ms, and so on for every shell read. Simultaneous duplicates mean
two mounts, not a refetch — React Query deduplicates in-flight queries, so these are two distinct
query executions. The page also renders two `<h1>` elements, which may be responsive variants
rather than proof of a double render.

Cause not yet identified. Instrumenting `window.fetch` showed two `useAppSettings` `queryFn`
executions plus one from `AdminLayout`, which points at two property contexts rather than one
component mounting twice. That needs the next session's attention; it is the largest remaining
multiplier on dashboard cost.

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
