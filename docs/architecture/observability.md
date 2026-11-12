---
title: Observability — faults vs outcomes
status: in-progress
tags: [architecture, observability, sentry, posthog]
updated: 2026-11-09
---

# Observability — faults vs outcomes

Each vendor has exactly one job. Anything that crosses that line is a bug in how we
instrument, not a preference.

| Vendor      | Owns                                                                                                     | Never does                                         |
| ----------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Sentry**  | Exceptions, crashes, failed requests, failed crons, failed webhooks, third-party faults, alerts, tracing | Product analytics, funnels, feature flags          |
| **PostHog** | Pageviews, named product events, funnels, identify, groups, (masked) session replay when enabled         | Exception capture, error alerts, error source maps |

Full plan and phase order: `docs/workflow/done/observability-sentry-posthog-split/`.
Org: **`kame-tech`** (US). Projects: **`kame-space-web`** / **`kame-space-edge`**.
Agent skill: **`sentry`**. OpenCode MCP: `opencode mcp auth sentry`.

## The rule

- **Fault** = something an engineer must fix. Exception, 5xx, provider outage, failed cron.
  Goes to **Sentry**, once.
- **Outcome** = what a user experienced in a journey. `guest_form_rejected`,
  `parking_payment_failed`, `marketing_publish_failed`. Goes to **PostHog**.
- An outcome can have a fault behind it. They are joined by `request_id` and release id,
  never by sending the same event to both vendors.

An expected result is never a Sentry issue: a validation failure, a blocked captcha, a
heuristic anti-spam block, a 404 route, or a deliberate 4xx `EdgeError` is an outcome.
Browser fetch helpers that unwrap an edge envelope keep the HTTP status on the thrown error
(`EdgeResponseError`), because `reportQueryError` can only apply this rule when it can see
the status.

## Browser noise filters

The browser half of the rule is applied at two seams, `reportQueryError` and
`reportEdgeFailure`, so no call site decides on its own:

| Condition                                                                      | Why it is not a Sentry fault                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport failure (status 0, or a fetch `TypeError`)                           | The request never reached the server. Dropped Wi-Fi, a captive portal, DNS/ad-blocker interference. `navigator.onLine` stays true with no route, so it cannot gate this. PostHog owns the outcome. |
| Missing session (`Not signed in`, `No active session`, `Session expired`)      | The dashboard mounted before the session landed, or the auth flow already redirected.                                                                                                              |
| 4xx / 401                                                                      | The handler answered correctly; the auth flow owns 401.                                                                                                                                            |
| Aborted request                                                                | Cancelled on purpose.                                                                                                                                                                              |
| Recoverable chunk load                                                         | An open tab from a previous release reloads (then resets its worker). Only a failure that survives both attempts is reported.                                                                      |
| Service-worker storage failure (`Unable to open database file on disk`, quota) | Browser storage eviction, not app code.                                                                                                                                                            |
| Local host                                                                     | A production build served on `localhost` / `127.0.0.1` never initialises Sentry, and `environment` resolves to `local`.                                                                            |

Server faults (5xx), thrown logic errors, and a chunk load that survives recovery still
report. Filtering belongs in those two modules, not in per-feature catches.

## Shared ids

| Field         | Browser                                            | Edge                                   |
| ------------- | -------------------------------------------------- | -------------------------------------- |
| `release`     | `VITE_APP_VERSION` (git SHA)                       | `APP_RELEASE` secret (same SHA)        |
| `environment` | `local` \| `preview` \| `production`               | same, resolved from the deployment env |
| `app_track`   | `mt` \| `legacy`                                   | same                                   |
| `request_id`  | `x-request-id` header                              | `resolveRequestId(req)`                |
| `user.id`     | Supabase auth uid, no email                        | `auth.getUser` uid, no email           |
| tenant tags   | `org_id` / `property_id` / `parking_id` UUIDs only | from the `verify*Access` result        |

`VITE_APP_VERSION` is injected by `vite.config.ts` `define` from `ui/vite-plugins/releaseId.ts`.
`APP_RELEASE` is stamped by the deploy scripts from `git rev-parse HEAD`. They must always
name the same commit, or "which deploy introduced this?" stops being answerable.

## Scrub rule

No names, emails, phone numbers, addresses, message bodies, ID or receipt contents, file
URLs, or capability-token query values reach either vendor.

The list is single-sourced:

- Browser: `ui/src/lib/telemetry/scrub.ts`
- Edge: `supabase/functions/_shared/telemetryScrub.ts`
- Parity test: `ui/src/lib/telemetry/scrubParity.test.ts`

Edge isolates cannot import from `ui/`, so the two files are duplicated by hand. Editing one
without the other fails CI.

Sentry additionally gets `sendDefaultPii: false`, IP storage off, and a project-level data
scrubber. PostHog keeps today's rule: host and super-admin email on the person profile,
never a guest's.

## Choke points

Capture at the shared seam, not at each call site. Per-call capture is only for a swallowed
failure that never reaches a choke point.

| Runtime | Seam                                                              | Phase |
| ------- | ----------------------------------------------------------------- | ----- |
| Edge    | `_shared/httpResponse.ts#handleEdgeError`, `_shared/serveEdge.ts` | S2    |
| Edge    | `_shared/serveEdge.ts#serveCronPost` (cron check-ins)             | S3    |
| Browser | `@sentry/react` init, React root hooks, error boundaries          | S1    |
| Browser | TanStack `QueryCache` / `MutationCache` `onError`                 | S1    |
| Browser | edge-call wrappers (`adminEdgeFetch`, `callEdgeFunction`)         | S1    |

PostHog analytics on the edge run after the response (`_shared/backgroundTask.ts`), never on
the response path.

## Adding a new surface

1. Decide the event: name it `object_action` (snake_case, past tense), add it to
   `ui/src/lib/posthog/catalog.ts` and, if emitted on the edge,
   `supabase/functions/_shared/posthogCatalog.ts`. Properties are ids, enums, counts,
   booleans and buckets, never free text.
2. Decide where the outcome is decided. Server-decided outcomes are emitted on the edge
   after the write succeeds. Browser is for intent and UI-only steps. Never both.
3. Decide the fault path. If the new code can throw, it must reach a choke point above.
   A swallowed failure needs an explicit `captureSentryException` with a provider or
   side-effect tag.
4. If it schedules work, register it in `_shared/systemHealth/jobsRegistry.ts` so
   `/admin/health` shows last run and last status. Sentry cron monitors are capped at one on
   the free tier (`sd-refund-cron`); every other job is covered by the registry.
5. If the job is a batch and some items can fail while the run still succeeds, call
   `_shared/sentryCron.ts#reportCronPartialFailure` after the loop. One sampled `warning`
   per run with `failed_count` / `attempted_count` — without it, "3 of 40 failed" looks
   exactly like a clean sweep.
6. Mark the row N/A with a reason if the surface genuinely has neither.

## Boot and request timing

Speed work needs the same discipline as fault work: a number before the change, the same
number after it, or the change is a guess. Two permanent instruments provide it.

### Browser boot marks (`ui/src/lib/perf/bootMarks.ts`)

One fixed set of `performance.mark` names, written once per session and never removed:

| Mark               | Fires when                                             |
| ------------------ | ------------------------------------------------------ |
| `app:script-start` | top of `main.tsx`, before Sentry and PostHog init      |
| `app:first-render` | one frame after the first commit of `AppShell`         |
| `loader:show`      | the full-screen `AppLoader` host is attached to `body` |
| `loader:hide`      | that host is removed                                   |
| `skeleton:show`    | a route skeleton actually paints                       |
| `skeleton:hide`    | that skeleton unmounts                                 |
| `route:content`    | first page of the session reaches its primary data     |
| `nav:start`        | a later route change commits                           |
| `nav:content`      | that route reaches its primary data                    |

Boot marks are **first-wins** so a re-mount cannot shrink a measured duration. Navigation
marks are the exception: each tap is its own pair, so they overwrite.

Pages call `useRouteContentReady(isReady)` (`ui/src/hooks/useRouteContentReady.ts`) with one
boolean that is true only when the content a user came for is on screen. Not "loading is
false", not "the fetch resolved": the thing they came for. Wire it to the top pages first;
every route without it reports `null` rather than a fabricated number.

`readBootTimeline()` returns `firstRenderMs`, `loaderMs`, `skeletonMs`, `routeContentMs`,
`navContentMs`, with `null` for anything that never fired. `lib/sentry/bootMeasurements.ts`
sends the non-null values to Sentry as `boot.first_render`, `boot.loader`, `boot.skeleton`,
`boot.route_content` and `boot.nav_content` on the active route transaction. PostHog stays
outcome-only, so there is deliberately no PostHog counterpart.

`nav:start` measures from the commit of the new route, so `navContentMs` is a **lower bound**
on tap-to-content. This is stated in the code comment and must stay stated; a lower bound
presented as a full number is how a regression hides.

### Edge phase timings (`_shared/serverTiming.ts`)

`serveAdmin`, `serveAuthenticated`, `serveSuperAdmin` and `servePublic` time each phase and
return them as `Server-Timing: auth;dur=12.3, settings;dur=0.4, ratelimit;dur=4.1,
blocklist;dur=1.2, handler;dur=88.2`. A phase that throws is still recorded, so a failed
auth shows up instead of disappearing.

Durations only. No ids, no function arguments, no counts, which is why
`Timing-Allow-Origin: *` is safe here. `timePhase` records even on throw; `withServerTiming`
passes the body through untouched and returns the original response if the body was already
read.

### Route patterns for transactions and events

The router is **one splat route** (`{ path: '*' }`) with `<Routes>` inside `AppRoutes`. That is
deliberate, but it means router-based integrations can only ever see `/*`: for seven days every
browser transaction in Sentry was named `/*`, one name in total. Per-route latency, and the boot
measurements attached to that transaction, were unreadable.

`ui/src/lib/telemetry/routePattern.ts#routePatternFor` derives the pattern from the pathname
instead. It replaces the segment after a known tenant parent (`org`, `property`, `properties`,
`parking`, `developments`) and any UUID, long hex id or email-shaped segment with `:param`, so
`/org/acme/property/villa/bookings` becomes `/org/:param/property/:param/bookings`.

`RoutePatternSync` (`lib/sentry/RoutePatternSync.tsx`, mounted in `AppShell`) renames the active
Sentry transaction on every navigation and tags it `route_pattern`.

PostHog needs **both** halves, and the distinction cost a debugging round:

- `PostHogRouteSync` registers `route_pattern` and `surface` with `posthog.register(...)`, which
  makes them **super properties**. This is what the SDK's automatic `$pageview` actually carries.
- `buildSharedAnalyticsProperties` also includes `route_pattern`, which decorates events captured
  through `captureAppEvent`.

Adding it only to the builder measured 1,146 page views with no pattern on any of them, because
`$pageview` never goes through the builder. If a future property must appear on page views, it has
to be registered.

The pattern is safe to send: route names only, never a slug, id, email or token. Tests in
`routePattern.test.ts` assert that no identifier survives, and `context.test.ts` asserts a tenant
slug never reaches the PostHog properties.

### Verifying route patterns after a deploy

The change is only useful if transactions actually carry the pattern, so verify it rather than
assume it:

1. Open the dashboard and a couple of child routes in a real browser for a minute. Pageload
   transactions flush on idle; rapid navigation cancels them, so a headless page that leaves in
   under a second produces none.
2. In Sentry, filter the `kame-space-web` project to transactions for the last hour and check the
   names are `/org/:param/property/:param` style, not `/*`.

**You cannot do step 2 through the API with the token in `supabase/.env.management.local`.** The
`/events/?dataset=transactions` endpoint returns an empty `data` array for it, while
`stats_v2?category=transaction` shows the volume, so the data is there and the token simply cannot
read that dataset. Verified 2026-11-12: 2 transactions in the hour after the release build, which
is the configured 5% of 40 dwelled loads. Use the Sentry UI, or issue a token with event read on
the transactions dataset, before building anything that aggregates transaction names or durations.

PostHog pageviews are consent-gated: an unattended browser with no cookie consent records nothing,
so a zero result there is not evidence of a broken client.

## Do not

- Emit `activity_log` from either vendor, or a telemetry event to replace `activity_log`.
  Accountability records are not analytics.
- Feed the host Analytics module (occupancy / ADR / RevPAR) from PostHog.
- Use PostHog feature flags for plan or RBAC gates. Entitlements stay in `planFeatures`.
- Capture an expected user outcome as an exception.
