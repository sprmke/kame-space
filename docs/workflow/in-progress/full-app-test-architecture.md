---
title: 'Full-app test architecture: page-mirrored suites, access matrix, enforced coverage'
status: planned
tags: [planning, testing, vitest, playwright, deno, pgtap, ci-cd, rbac, plans, governance]
updated: 2026-11-08
stage: in-progress
kind: plan
---

# Full-app test architecture

## Progress

Branch `test/full-app-test-architecture`. Phases land in separate PRs; this section tracks
what is actually shipped, not what is planned.

| Phase  | State       | Evidence                                                                                                                                                                                                                        |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | **shipped** | `e2e-ci` job in `ci.yml` (4 shards, required by `quality`); `test:e2e:ci` in `ci-quality-gate.sh`; 17 orphan specs tagged; `check:e2e-lane-tags`; `check:flaky-quarantine`; Vitest pinned to `TZ=Asia/Manila` with a guard test |
| 1      | **partly**  | `dom` Vitest project shipped (`vitest.dom.config.ts`, happy-dom + Testing Library, `*.test.tsx`), first hook tests green; personas, `mockTenant`, `edgeMocks`, handler spike still to do                                        |
| 2      | partly      | lane + quarantine guards exist; `check:test-coverage`, `check:unit-test-quality`, `check:edge-test-coverage` still to build                                                                                                     |
| 3 to 9 | not started |                                                                                                                                                                                                                                 |

First full `@ci` run on this branch: **338 passed, 8 failed, 3.5 min**. Triage:

- **Fixed here:** a11y `target-size` on `InfoHint` (button box was 16 px tall, axe wants 24; the
  44 px hit pad is a pseudo-element so axe cannot see it) and the plan review dialog's
  "skipped tiers" expectation (media storage now rolls up like team seats and AI credits).
- **Quarantined with issue + expiry:** `notifications Telegram hub shows maintenance when off`,
  `Automated sends ... Manage modal`, `one toolbar menu holds Recent publishes and Recently
deleted`. All three are drift against in-progress tickets (notifications restructure,
  settings cleanup, marketing responsive pass). Registry: `ui/e2e/flaky-quarantine.json`,
  issue [#330](https://github.com/sprmke/kame-space/issues/330).
- **Flaky, quarantined:** `parkingGuestHostOutcomes` (decline flow, 2 failures in 4 runs).
- **Flaky, watched:** `adminAiConsole`, `assistantAiMode`, `voucherRedemptionMocked` passed on
  rerun and stay in the lane; CI retries (2) cover them. Promote to quarantine if either
  appears twice on `develop`.

Final lane state: 96 specs, one tag each — `@smoke` 23, `@ci` 68 (62 executable, 6 quarantined),
`@pwa` 1, `@live` 2, `@demo` 2. `@ci` runs in 3.1 min locally.

### Handler testability (shipped 2026-11-08)

`index.ts` could not be imported because `serve*` called `serve()` at module scope. Fixed in
one file: `_shared/serveEdge.ts` now mounts the composed handler in a registry when
`EDGE_HANDLER_TEST=1`, and still calls `serve()` in production. No `index.ts` changed.

```ts
Deno.env.set('EDGE_HANDLER_TEST', '1');
await import('../../get-feature-availability/index.ts');
const handler = getMountedEdgeHandler('get-feature-availability')!;
const res = await handler(new Request(url, { headers: { Authorization: 'Bearer token' } }));
```

The first test (`tests/handlers/get-feature-availability.test.ts`) drives the real wrapper:
401 on a missing bearer, 401 on an invalid session, the `{ success, data }` envelope, the
per-viewer `Cache-Control: private`, no PII in the body, and a super-admin seeing a
bypassable kill switch as `bypassed` rather than as a missing feature. Supabase is stubbed
at `fetch`, the only boundary the handler crosses.

Next: the same shape for `cancel-booking`, `guest-cancel-booking`, `submit-form` and the
webhooks, which is where `stubDb()` / `stubProvider()` from §1 pay off.

### Decisions taken

| Decision                   | Choice                                                                                                         | Why                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Lane ownership             | exactly one lane tag per spec, `@smoke` wins when both were present                                            | a spec with two tags runs twice per pipeline; 18 specs carried `@smoke @ci`                                                              |
| Quarantine mechanism       | `@flaky` in the test title + `ui/e2e/flaky-quarantine.json` (issue, expiry, reason) + `check:flaky-quarantine` | `grepInvert` makes `@flaky` invisible, so the paper trail has to be enforced                                                             |
| `waitForTimeout`           | baselined in `scripts/dev/e2e-lane-baseline.json`, shrink-only                                                 | removing 11 existing calls without knowing what each waits for risks new flakes                                                          |
| Test timezone              | `process.env.TZ = 'Asia/Manila'` in `ui/vitest.setup.ts` + `timeZoneDeterminism.test.ts`                       | verified green across all 804 unit files before adopting                                                                                 |
| Deno timezone              | deferred                                                                                                       | `deno test` cannot resolve `npm:dayjs` in a fresh worktree, so the change cannot be verified here; do not ship an unverified gate change |
| Playwright `reducedMotion` | deferred                                                                                                       | global `reduce` changes animation behaviour and needs its own verified run                                                               |

## Goal

Every page, section, tab, plan tier, team role, and tenancy level (org, property, parking) in Kame Space has the **right kind** of automated test, organized so anyone can open one folder and see exactly what protects a page. Coverage is **enforced by CI**, not by convention. A future change that adds a route, section, plan key, permission leaf, or edge function fails CI until its tests (or an explicit, reasoned exemption) exist.

This plan builds on, and does not redo:

- [`sitewide-automated-testing.md`](../done/sitewide-automated-testing.md) (pyramid, tags, folder basics)
- [`plan-tier-test-suite.md`](../done/plan-tier-test-suite.md) (golden tier matrix, `GATE_COVERAGE`)
- [`comprehensive-unit-test-coverage.md`](../done/comprehensive-unit-test-coverage.md) (colocated lib tests)
- Production readiness [`29-sdlc-testing.md`](../in-progress/production-readiness/checklist/29-sdlc-testing.md). This plan **absorbs** its open rows 1, 2, 4, 5, 6 (risk tiers, handler harness, contract tests, WebKit + Manila TZ, flake policy). Doc 29 links here once Phase 0 lands.

## What "100% coverage" means here

Line coverage of 1,568 `.tsx` files is the wrong target: it rewards shallow tests and punishes refactors. "100%" in this plan is **100% of an enforced inventory**, each with a CI check:

| #   | Inventory (source of truth)                                            | 100% means                                                                                             | Enforced by (new unless noted)                     |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| C1  | Every router path (`ui/src/**/routes`)                                 | Mapped to one route guide and one E2E page folder, or listed as a redirect with a redirect test        | `check:test-coverage` (route tree vs manifests)    |
| C2  | Every `##` behavior section in a route guide                           | Has a spec file / `test()` id in the page manifest, or an `na` entry with a reason                     | `check:test-coverage` (guide headings vs manifest) |
| C3  | Every `PlanFeatureKey`                                                 | Client gate + server gate test, and an E2E allowed/blocked pair on each page that surfaces it          | `GATE_COVERAGE` (exists) + manifest `gates`        |
| C4  | Every permission leaf (property, org, parking catalogs)                | Server denial test, UI view-only/hidden test on the page that owns it                                  | `check:test-coverage` (catalog vs manifests)       |
| C5  | Every edge function directory (347 today)                              | Handler test, or exemption with reason in `tests/coverage-exemptions.json` (ratchet down to near zero) | `check:edge-test-coverage`                         |
| C6  | Every mutating capability                                              | Handler test asserts the `activity_log` event (or `activity-log: N/A` in the manifest)                 | handler test helper `expectActivity()`             |
| C7  | Every UI to edge contract with a mock in E2E                           | Mock body comes from a contract fixture that a Deno test validates against the edge response schema    | `test:contracts`                                   |
| C8  | Every `lib/` and `utils/` module                                       | Behavioral test (no export-only scaffolds); line + branch thresholds per risk tier (below)             | `check:unit-test-quality` + Vitest `thresholds`    |
| C9  | Critical DB invariants (overlap, status CHECK, storage policies, RPCs) | pgTAP test                                                                                             | `test:db` (nightly + migration-replay)             |
| C10 | Manual-only surfaces (PayMongo live, OAuth, Meta, Resend inbound)      | Listed in a `*-manual.md` guide **and** the mocked half is automated                                   | manifest `manual` field links an existing guide    |

Line/branch thresholds by risk tier (Vitest + `deno test --coverage`):

| Tier          | Modules (globs)                                                                                                                                                                                                                        | Lines | Branches |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- |
| T0 money/auth | booking workflow mirrors, `statusMachine`, `workflowOrchestrator`, plan entitlements, team permissions, pricing math, finance math, vouchers, cancellation/refund, parking payment, `auth`, `orgAuth`, `propertyScope`, `parkingScope` | 95%   | 90%      |
| T1 core       | remaining `features/dashboard/**/lib`, `features/guest/**/lib`, `_shared/*Service.ts`                                                                                                                                                  | 85%   | 75%      |
| T2 rest       | `utils/**`, presentation helpers                                                                                                                                                                                                       | 70%   | 60%      |

Thresholds start at today's measured value per glob and **ratchet up only** (a script rewrites the floor when coverage rises; CI fails when it drops).

## Current state (measured 2026-11-08)

| Layer                     | Count                                                                    | Notes                                                                                        |
| ------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Vitest files / tests      | 863 files, 5,765 tests, all pass in ~10 s                                | Node env only, pinned to `TZ=Asia/Manila`; `include` matches `.test.ts` only                 |
| Vitest lib/utils coverage | **42.7% lines, 34.8% branches**                                          | `test:coverage:lib`; the file inventory is complete (0 libs without a test or an N/A marker) |
| Export-only unit tests    | **518** branching libs whose tests only assert `typeof x === 'function'` | `lib-behavioral-coverage-audit.mjs`                                                          |
| Hooks                     | 329 hook files, **2** tests                                              | No DOM project, so hooks are untestable today                                                |
| Deno `_shared` tests      | 192 `*_test.ts` for 530 modules                                          | Modules without a colocated test are partly covered through `tests/`                         |
| Deno handler tests        | ~40 files in `supabase/functions/tests/`                                 | `serve()` runs at module scope, so no `index.ts` handler body is directly importable         |
| Edge functions            | 348                                                                      | 169 are not even referenced by name in any test or E2E mock                                  |
| Playwright specs          | 96 specs, 24 domain folders                                              | One lane tag each, enforced by `check:e2e-lane-tags`                                         |
| Playwright lanes          | `@smoke` 23 · `@ci` 68 · `@pwa` 1 · `@live` 2 · `@demo` 1 · `@flaky` 3   | `@ci` runs on every PR, sharded 4 ways (shipped 2026-11-08)                                  |
| Route guides              | 105, 98 with a `## Testing` table                                        | Testing tables are prose; nothing validates them                                             |
| DB tests                  | none (no pgTAP)                                                          | `migration-replay.yml` replays migrations weekly but asserts no invariants                   |

### Critique (ranked by risk)

1. **~~The `@ci` Playwright suite runs nowhere.~~ Fixed 2026-11-08.** `cd-dev.yml` was deleted in `d77bfade3` ("one deploy pipeline"). `ci.yml` and `cd-prod.yml` ran only `@smoke` + `@pwa`, so the **52 `@ci`-only specs** (plans, team RBAC, dashboard modules, marketing, reviews, inbox) had no CI gate. `ci.yml` now has an `e2e-ci` job (4 shards) that `quality` requires, and `ci-quality-gate.sh` runs the lane.
2. **~~17 specs carry no tag and are invisible to every CI project.~~ Fixed 2026-11-08.** 16 got `@ci`, `parkingGuestHostSideBySide` got `@demo` (it is the headed demo lane). `check:e2e-lane-tags` now fails on a missing or duplicate lane tag, so this cannot recur.
3. **509 export-only unit tests inflate confidence.** They pass if a function exists, regardless of behavior. The scaffold scripts (`scaffold-missing-lib-unit-tests.mjs`, `enrich-lib-unit-tests.mjs`) keep producing them.
4. **Edge handlers are structurally untestable.** `serveAdmin` / `servePublic` call `serve()` on import. The money and trust paths with no direct handler test include `paymongo-webhook`, `cancel-booking`, `guest-cancel-booking`, `submit-sd-form`, `create-parking-booking`, `record-booking-refund`, `approval-email-webhook`, `meta-inbox-webhook`, every `upload-*` function, every `*-cron`, and every `accept-*-invite`.
5. **E2E mocks can drift from real responses.** Mocks are hand-written JSON in harnesses. Nothing checks them against edge response shapes, so a renamed field ships green.
6. **One 1,920-line harness serves 42 specs** (`propertyTeamRbacHarness.ts`). It accumulated 15+ unrelated options (marketing, inbox, templates, assistant). Any change risks breaking unrelated specs and nobody can tell which mocks a spec actually needs.
7. **The auth seam only knows `host | guest`.** Personas (org owner, org admin, property Full Access / Operations / Read Only / custom, parking Manager / Staff / Viewer, super-admin) are re-derived per harness. The Supabase storage key `sb-127-auth-token` is hard-coded in 8 places.
8. **The access matrix is tested at the wrong layer for most pages.** Plans have a strong golden-matrix design; team permissions have catalog drift tests. But per page, only nav visibility (6 RBAC tests) and 12 gate surfaces are exercised. Read-only behavior inside pages (disabled Save, hidden destructive actions), parking-level RBAC, and org-level RBAC are mostly untested.
9. **Parking level is a second-class citizen.** Parking reuses property modules (finance, activity, announcements, help, inbox, notifications, team) but no spec runs a shared module at parking level except bookings.
10. **No component/hook layer.** Multi-step forms, unsaved-changes guards, feature-gate wrappers, and 329 hooks can only be tested by full browser journeys, which is slow and pushes people to skip them.
11. **No time determinism.** No `TZ=Asia/Manila`, no `page.clock`. Date-boundary bugs (UTC midnight vs Manila) and cron windows are unprotected.
12. **No DB-level tests.** Booking overlap is filtered in app memory (`databaseService.ts`), status CHECK constraints and storage policies are never asserted, and the weekly replay proves only that migrations apply.
13. **~~Docs disagree with reality.~~ Fixed 2026-11-08** for the lane and coverage baseline: `testing.mdc`, the `testing` skill, and `docs/guides/testing/README.md` now describe the real lanes (`@smoke` / `@ci` / `@pwa` / `@live` / `@demo`) and the measured 42.7% / 34.8% baseline.
14. **28 `skip`/`fixme` in E2E, 12 `waitForTimeout` calls.** No issue links, no expiry.

What is already good and must be kept: `getByRole`-first locators (1,010 uses vs 66 CSS locators), the golden plan matrix and `GATE_COVERAGE`, `PLAN_FEATURE_PERMISSION_COVERAGE`, the axe sweep, three-viewport smoke, PWA project on a production build, telemetry-off guarantee, parking's two-surface harness pattern, and the adversarial auth live test.

## Target architecture

### 1. Test kinds and when each is necessary

Not every page gets every kind. Each page is assigned an **archetype**; the archetype decides the required kinds. The manifest records the archetype, and `check:test-coverage` enforces its required kinds.

| Kind                     | Tool / location                                                        | Proves                                                                       | Never use it for                       |
| ------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| **Unit (logic)**         | Vitest node, `ui/src/**/lib/*.test.ts`                                 | Pure rules: validators, mirrors, gates, math, dates                          | Rendering                              |
| **Component / hook**     | Vitest `dom` project (happy-dom + Testing Library), `*.test.tsx`       | Stateful UI logic: multi-step forms, guards, gate wrappers, hooks with state | Layout, Tailwind, shadcn primitives    |
| **Edge unit**            | Deno, `_shared/*_test.ts`                                              | Server rules, state machines, entitlements                                   | HTTP wiring                            |
| **Handler**              | Deno, `supabase/functions/tests/handlers/<fn>.test.ts`                 | Auth tier, validation, permission leaf, plan gate, side effects, activity    | Real network                           |
| **Contract**             | Deno, `supabase/functions/tests/contracts/*.test.ts` + shared fixtures | E2E mock bodies match real edge response schemas                             | Business logic                         |
| **DB**                   | pgTAP, `supabase/tests/database/*.test.sql`                            | Constraints, triggers, RPCs, storage policies, overlap exclusion             | App logic                              |
| **E2E page (mocked)**    | Playwright, `ui/e2e/pages/<guide path>/`                               | A page's sections, tabs, saves, access matrix, states                        | Every field permutation (that is unit) |
| **E2E journey (mocked)** | Playwright, `ui/e2e/journeys/`                                         | Cross-page flows: book → review → check-in; guest ↔ host                     | Single-page behavior                   |
| **E2E live**             | Playwright `@live`, `ui/e2e/live/`, local Supabase                     | Real DB + edge stack for the top 8 journeys                                  | PR gate                                |
| **Quality**              | Playwright `ui/e2e/quality/` (a11y, responsive, brand, telemetry, pwa) | Cross-cutting non-functional rules                                           | Feature behavior                       |
| **Mutation (nightly)**   | Stryker on T0 libs only                                                | Tests actually catch bugs in money/auth logic                                | Whole repo                             |
| **Manual**               | `docs/guides/testing/*-manual.md`                                      | Third-party live paths                                                       | Anything mockable                      |

Rejected on purpose: visual screenshot regression of every screen (high churn, low signal; only email HTML and PDF templates get snapshot tests), Cypress/Jest (second runner), 100% `.tsx` line coverage, Playwright MCP as a regression suite.

**Page archetypes and required kinds**

| Archetype                     | Examples                                                                 | Required                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **R** redirect / alias        | `/sign-in`, `/account/wishlist`, `/account/messages`, legacy flat routes | One redirect assertion in `pages/_redirects/redirects.spec.ts` (table-driven)                                                                  |
| **S** static                  | legal pages, services, help                                              | E2E render + meta + a11y (shared table spec)                                                                                                   |
| **P** public data             | landing, search, listings, parkings, developments, hosts                 | Unit (lib) · contract · E2E (load, filters, empty, error, not-found, SEO meta) · a11y · responsive                                             |
| **G** guest operational       | form, calendar, sd-form, trip, success, stay guide, document, chat       | Unit (schema) · component (step state) · handler (submit fns) · E2E (happy, validation, server error, token invalid/expired) · `@live` journey |
| **DR** dashboard read         | dashboards, analytics, activity, reviews, org bookings                   | Unit (aggregators) · contract · E2E (load per level, empty, error, gate pair, role view/denied)                                                |
| **DW** dashboard write        | settings, pricing, templates, team, notifications, finance, maintenance  | DR + component (form + unsaved guard) · handler per write fn (leaf, gate, validation, activity) · E2E per section save + read-only role        |
| **WF** workflow               | booking detail, parking bookings, cancellations, approvals               | DW + both status-machine mirrors · orchestrator · table-driven E2E transition spec · `@live` lifecycle                                         |
| **SA** super-admin            | `/admin/*`                                                               | Unit · handler (super-admin gate + validation) · E2E shell + one action per page; destructive actions manual                                   |
| **X** third-party integration | inbox (Meta), marketing publish, PayMongo, Telegram, Resend inbound      | Handler with stubbed provider (signature, idempotency, retries) · E2E mocked · manual guide                                                    |

### 2. Directory layout

Unit, component, and edge tests stay **colocated** (they test modules). Browser tests move to a tree that **mirrors `docs/guides/routes/`** one-to-one, so guide and tests are found by the same path.

```
ui/e2e/
  shared/                      # framework only, no domain mocks
    personas.ts                # typed personas (see §3)
    tenant.ts                  # mockTenant() builder: persona × tier × level × state
    edgeMocks/                 # one typed module per edge function: mockGetBookings(page, fixture)
    clock.ts                   # Manila clock + page.clock helpers
    assertions/                # layout, a11y, gate, readOnly, toast, unsavedGuard
    matrix.ts                  # forEachPersona / forTiers / forLevels helpers (pairwise, see §3)
    tags.ts                    # tag constants, no string literals in specs
  fixtures/contracts/          # JSON fixtures shared with Deno contract tests (see §4)
  pages/                       # mirrors docs/guides/routes/*
    _redirects/redirects.spec.ts
    index-landing/  search/  properties/  parkings/  developments/  for-hosts/  legal/
    form/  calendar/  sd-form/  success/  trip/  stay-guide/  property-showcase/
    guest-booking-document/  properties/chat/  bookings/parking/  app/
    auth/  sign-in/  onboarding/  accept-invite/
    account/{profile,stays,trips,favorites,vouchers,reviews,tickets,help}/
    org/{dashboard,bookings,properties,parkings,team,settings,activity,analytics,
         announcements,reviews,inbox,help-support,plans,assistant,setup-guide,selector}/
    org/property/{dashboard,bookings,bookings-detail,calendar,finance,pricing,
                  maintenance,marketing,inbox,notifications,templates,public-pages,
                  custom-pages,team,reviews,activity,announcements,analytics,
                  settings,help-support,operations,staff}/
    org/parking/{dashboard,bookings,finance,pricing,inbox,notifications,team,
                 settings,activity,announcements,help-support}/
    admin/{overview,hosts,host-detail,orgs,org-properties,org-subscriptions,
           platform-properties,developments,development-detail,approvals,ai,
           announcements,feature-availability,health,ops-reports,parking-payouts,
           payment-settings,pricing-plans,playbook,platform-tools,settings,support}/
  components/                  # page objects for modules reused across levels
    financeModule.ts  activityModule.ts  announcementsModule.ts  teamModule.ts ...
  journeys/                    # cross-page mocked flows
    booking-lifecycle/  parking-guest-host/  vouchers/  plan-checkout/  onboarding-to-first-booking/
  quality/                     # a11y/ responsive/ brand/ observability/ pwa/
  live/                        # @live specs against ./dev.sh stack
  demo/                        # @demo, never CI

Each page folder:
  <page>.coverage.ts           # manifest (see §5)
  <page>.page.ts               # page object: locators + actions, no assertions
  <section>.spec.ts            # one spec per guide section or tab
  access.spec.ts               # tier × role × level matrix for this page
  states.spec.ts               # loading, empty, error, not-found, archived/suspended

supabase/functions/tests/
  handlers/<fn>.test.ts        # one per edge function
  contracts/<fn>.test.ts       # fixture vs response schema
  harness/                     # makeRequest(), stubDb(), stubProvider(), expectActivity()
  coverage-exemptions.json     # fn → reason, owner, expiry
supabase/tests/database/*.test.sql   # pgTAP
```

Shared modules used at both property and parking level (finance, activity, announcements, help-support, inbox, notifications, team) get **one page object** in `ui/e2e/components/` and **two thin spec folders** that call `describeModule(level)`. That keeps the guide mirror exact without duplicating test bodies.

### 3. Access matrix: personas, tiers, levels, states

Dimensions:

| Dimension    | Values                                                                                                                                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persona      | `anon`, `guest`, `orgOwner`, `orgAdmin` (Full Access template), `orgOperations`, `orgReadOnly`, `orgCustom(leaves)`, `propFull`, `propOperations`, `propReadOnly`, `propCustom(leaves)`, `parkingManager`, `parkingStaff`, `parkingViewer`, `parkingCustom(leaves)`, `superAdmin`, `stranger` (valid host, other org) |
| Tier         | `free`, `starter`, `growth` (Pro), `pro` (Business), `managed` (from `planTierGolden.ts`; retired tiers only in unit tests)                                                                                                                                                                                           |
| Level        | `org`, `property`, `parking`                                                                                                                                                                                                                                                                                          |
| Entity state | property `active` / `paused` / `suspended` / `archived`; org verification tier; enrolled vs not enrolled in subscription; feature-availability kill switch off                                                                                                                                                        |
| Viewport     | desktop 1440, tablet 768, phone 375                                                                                                                                                                                                                                                                                   |

A full cartesian product is ~17 × 5 × 3 × 6 × 3 ≈ 4,600 runs per page. Instead, each dimension is tested **exhaustively at the cheapest layer that can prove it**, and E2E samples boundaries:

| Proof                               | Layer                                   | Exhaustive?                                                                                                           |
| ----------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Tier × feature key → allowed        | Vitest + Deno (exists)                  | Yes, every key × every tier                                                                                           |
| Persona × permission leaf → allowed | Vitest + Deno catalog tests             | Yes, every leaf × every built-in role                                                                                 |
| Endpoint enforces leaf + gate       | Handler tests (table-driven)            | Yes, per write endpoint: owner ok, missing leaf 403, below-tier upgrade envelope, stranger 404/403, suspended blocked |
| Page reflects the decision          | E2E `access.spec.ts`                    | **Boundary sampling** (below)                                                                                         |
| Layout per viewport                 | E2E `@smoke` 3 projects + quality suite | Primary pages only                                                                                                    |

**E2E boundary sampling rule** (per page, generated by `matrix.ts` from the manifest):

1. Owner on the page's minimum tier: full UI works.
2. Owner one tier below the minimum (for each gated section): upgrade affordance, no request fired, Plans link correct.
3. Read-only persona at the page's level: data visible, every write control disabled or hidden, no write request fires.
4. Persona missing the page's view leaf: nav item hidden and direct URL redirects / shows no-access.
5. `stranger` on a valid slug from another org: no data leak (cross-tenant guard).
6. Each level the page exists at (property and/or parking, plus org rollup) runs cases 1 and 3.
7. Entity states that change UI (archived read-only, suspended banner, paused, plan unknown fail-open, kill switch off): one case each where the guide documents behavior.

That is roughly 6 to 12 E2E cases per page instead of thousands, while the exhaustive matrices live in fast unit and handler tests.

### 4. Mocks and contract fixtures (stop drift)

- One typed mock module per edge function in `ui/e2e/shared/edgeMocks/<fn>.ts`. Specs compose only what they need via `mockTenant({ persona, tier, level, state }).with(mockGetBookings(fixture))`. This replaces the god harnesses gradually (no big-bang rewrite).
- Fixture bodies live in `ui/e2e/fixtures/contracts/<fn>/<case>.json`.
- A Deno contract test loads each fixture and validates it against the edge function's response schema (Zod, adopted per the architecture modernization plan, or a TypeScript `satisfies` check against the exported response type for functions not yet on Zod). A renamed field fails `test:contracts` before E2E runs green on stale data.
- Unmocked edge calls in E2E **fail the test** (a catch-all route that throws), instead of hanging or silently hitting `127.0.0.1:54321`.
- `stranger` and error fixtures are first-class (`403.json`, `404.json`, `429-rate.json`, `402-upgrade.json`, `500.json`) so every page can run `states.spec.ts` cheaply.

### 5. Coverage manifest (machine-checked)

Each page folder exports a manifest:

```ts
// ui/e2e/pages/org/property/finance/finance.coverage.ts
export default definePageCoverage({
  guide: 'docs/guides/routes/org/property/finance.md',
  routes: ['/org/:orgSlug/property/:propertySlug/finance'],
  archetype: 'DW',
  levels: ['property', 'parking'], // parking variant lives in org/parking/finance
  sections: {
    'Summary cards & charts': 'summary.spec.ts',
    'Unified ledger': 'ledger.spec.ts',
    'Transaction CRUD (`finance_line_items`)': 'transactions.spec.ts',
    'Export report': 'export.spec.ts',
    'Entry activity history': 'transactions.spec.ts#activity history',
  },
  gates: ['financeReporting'], // PlanFeatureKeys surfaced on this page
  permissions: ['finance:view', 'finance:edit'],
  edgeFunctions: ['finance-ledger', 'finance-export'],
  activity: ['finance.line_item.created', 'finance.line_item.updated'],
  unit: ['features/dashboard/finance/lib/*.test.ts', '_shared/financeRecurrence_test.ts'],
  manual: [],
  na: { 'Telegram finance reminders': 'cron covered by handlers/telegram-finance-cron.test.ts' },
});
```

`bun run check:test-coverage` (Node script + one Vitest test that builds the real route tree with `createRoutesFromElements`) fails when:

- a router path has no manifest and is not in the redirect table (C1);
- a guide `##` behavior section has no `sections` or `na` entry (C2; boilerplate headings like Overview, API reference, Testing, Related docs are ignored by a fixed allow-list);
- a spec file or `#test title` named in the manifest does not exist;
- a `PlanFeatureKey` with a UI surface in `GATE_COVERAGE` is not claimed by any page manifest (C3);
- a permission leaf in any catalog is not claimed by any page manifest (C4);
- the required kinds for the archetype are missing (e.g. `DW` with no handler test for a listed edge function);
- a guide's `## Testing` table disagrees with the manifest. The table becomes **generated** from the manifest (`bun run gen:route-testing-tables`), so humans stop hand-editing it.

The same script emits `docs/guides/testing/coverage-report.md` (generated, committed) with a per-page row: archetype, kinds present, gates, leaves, levels, gaps. That page is the single place to answer "is this page fully tested?".

### 6. Determinism

- Vitest and Deno run with `TZ=Asia/Manila`; Playwright sets `timezoneId: 'Asia/Manila'` and `locale: 'en-PH'` on every project.
- `shared/clock.ts` installs `page.clock` at a fixed instant per spec; cases around 23:30 to 00:30 Manila (16:00 UTC) and month end are explicit tests for date-range pages, calendars, crons.
- Deterministic ids (`ids.ts` extended), seeded random, `prefers-reduced-motion: reduce` on all projects except `@demo`.
- No `waitForTimeout` (ESLint rule in `ui/e2e/**`; existing 12 removed). Wait on network idle per mock, a role, or a test id.
- One storage-key constant exported from `ids.ts`; the 8 hard-coded copies removed.

### 7. Tags, lanes, and CI wiring

| Tag / lane | Content                                                        | Runs                                                                      | Budget        |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------- |
| `@smoke`   | Top journey per surface, 3 viewports                           | Every PR + push                                                           | < 8 min       |
| `@ci`      | All mocked page + journey specs                                | **Every PR, sharded 4 ways**, plus push to `develop`/`main`               | < 12 min wall |
| affected   | `playwright test --only-changed=origin/develop` (1.62)         | PR fast feedback before full `@ci`                                        | < 3 min       |
| `@pwa`     | Production build checks                                        | Every PR (exists)                                                         |               |
| `@webkit`  | Guest form, calendar, sd-form, trip, parking request on WebKit | Nightly + release branch                                                  |               |
| `@live`    | Top 8 journeys on `supabase start` in GitHub Actions           | Nightly + release branch                                                  | < 25 min      |
| `test:db`  | pgTAP                                                          | Nightly + `migration-replay.yml` + any PR touching `supabase/migrations/` |               |
| mutation   | Stryker on T0 libs                                             | Weekly, report only                                                       |               |
| `@demo`    | Headed/video                                                   | Never                                                                     |               |
| `@flaky`   | Quarantine; must carry an issue link and expiry date           | Excluded; `check:flaky-quarantine` fails past expiry                      |               |

Every spec must carry exactly one of `@smoke`, `@ci`, `@live`, `@demo`, `@pwa` (lint rule + `check:test-coverage`). That closes the untagged-spec hole for good. `cd-prod.yml` runs the full gate including `@ci`; production deploys never proceed on smoke alone.

### 8. Governance (agents and humans)

Changes that fail without tests are only real if the tooling says so. Updates:

- **Rule** `.cursor/rules/testing.mdc` (always-on): replace the layout with the page-mirrored tree, archetypes, manifest, access sampling rule, tags, and the "100% of inventory" definition. Fix the stale `@ci` lane claim.
- **Skill** `testing` (`.cursor/skills/testing/SKILL.md` + `.claude/skills/testing/SKILL.md`, kept in sync by `check:ai-tooling-sync`): step-by-step "add a page", "add a section", "add a plan key", "add a permission leaf", "add an edge function", "add a mock" recipes, each ending with `bun run check:test-coverage`.
- **New skill** `test-architecture` (review/critique mode): audit a module's tests against its manifest, flag export-only tests, missing access cases, drifted fixtures. Used by `/self-review` and the `verifier` agent.
- **`CLAUDE.md`** "Before claiming any material task done": add step "Run `bun run check:test-coverage` and update the page manifest", mirrored in `documentation-maintenance.mdc` and `.opencode` plugin per the sync rule.
- **`route-guides` skill**: new or renamed `##` section requires a manifest entry in the same change; Testing table is generated.
- **`plans-and-permissions` skill**: new key or leaf requires manifest claim + handler table row + E2E boundary case.
- **`audit-logging` skill**: handler test must call `expectActivity()` or the manifest records N/A.
- **Hook** (PostToolUse, Claude Code + OpenCode plugin): when a file under `ui/src/features/**/pages|components` or `supabase/functions/<fn>/` is edited and no file in its mapped test folder changed in the session, print a reminder with the folder path (reminder only, no block).
- **CI** `test-impact` job: maps changed source paths to page folders via manifests; posts which page suites ran and fails if a changed module's manifest is now invalid.
- **PR template**: "Tests" section auto-filled by `test-impact`.
- **Scaffold scripts**: delete `scaffold-missing-lib-unit-tests.mjs`, `enrich-lib-unit-tests.mjs`, `deepen-lib-unit-tests.mjs` once Phase 3 converts the 509 files. Replace with `check:unit-test-quality` (fails on a test file whose only assertions are `typeof`/`toBeDefined`, with a shrinking baseline).

## Page catalog

Legend: archetype from §1 · **L** levels · **Gate** = has plan-gated sections · **RBAC** = has permission leaves · **Migrate** = existing specs that move into the folder (moved with `git mv`, not rewritten) · **P** priority (P0 money/booking/auth/tenancy, P1 core host, P2 rest).

Section spec files follow the guide's `##` headings. Only non-obvious ones are listed.

### Public marketing and marketplace

| Guide → `ui/e2e/pages/…`                                              | Arch | Section specs                                                            | Migrate                                                                             | P   |
| --------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --- |
| `index-landing`                                                       | P    | `sections`, `explore-preview`                                            | `publicPagesSmoke` (landing cases)                                                  | P1  |
| `search`                                                              | P    | `typeahead`, `intents`, `results`, `filters`                             | `publicPagesSmoke`, `publicListingBrowse`                                           | P1  |
| `properties`                                                          | P    | `list`, `location-browse`, `detail`, `calendar`, `sort`, `host-profile`  | `publicListingBrowse`                                                               | P1  |
| `properties/chat`                                                     | G    | `entry`, `full-screen`                                                   | —                                                                                   | P2  |
| `property-showcase`                                                   | P    | `guest-view`                                                             | —                                                                                   | P2  |
| `parkings`                                                            | P    | `list`, `location-browse`, `detail`, `form`, `request-status`            | `parkingGuestRequest`, `parkingMarketplaceEdgeCases`                                | P0  |
| `developments`                                                        | P    | `list`, `location`, `detail`, `properties`, `parking`                    | `publicPagesSmoke` (developments)                                                   | P2  |
| `for-hosts`                                                           | P    | `landing`, `pricing` (cards, compare, toggles), `v2`, `v3`               | `forHostsPricing`                                                                   | P1  |
| `legal`, `services`                                                   | S    | table-driven `pages.spec.ts`                                             | `publicPagesSmoke` (legal)                                                          | P2  |
| `auth`                                                                | G    | `host-login`, `host-register`, `guest-login`, `guest-register`, `otp-ui` | `authPagesSmoke`, `authRedirectSmoke`                                               | P0  |
| `sign-in`, `bookings/parking`, `account/messages`, `account/wishlist` | R    | `_redirects` table                                                       | `legacyRedirectSmoke`, `legacyRouteRedirectSmoke`, `payParkingFlow` (redirect half) | P1  |
| `app`                                                                 | G    | `pwa-launch` (`?source=pwa`, shortcuts)                                  | part of `pwaFoundation`                                                             | P2  |

### Guest operational

| Guide → `ui/e2e/pages/…` | Arch | Section specs                                                                                                    | Migrate                                                                       | P   |
| ------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --- |
| `calendar`               | G    | `range-pick`, `blocked-dates`, `query-params`                                                                    | `guestCalendarSmoke`                                                          | P0  |
| `form`                   | G    | `steps` (one per step), `fields-validation`, `documents-upload`, `parking-cta`, `voucher-apply`, `submit-errors` | `guestFormLoad`, `guestFormSubmit`, `guestFormParkingCta`, `voucherFormApply` | P0  |
| `success`                | G    | `page-behavior`                                                                                                  | covered via form journey                                                      | P0  |
| `sd-form`                | G    | `review`, `voucher-reveal`, `refund-details`, `guest-review`, `trip-links`                                       | `sdFormSubmit`, `voucherRevealClaim`, `guestWriteReview`                      | P0  |
| `trip`                   | G    | `page-behavior`, `cancellation`, `access-token`                                                                  | —                                                                             | P0  |
| `stay-guide`             | G    | `sections`, `token-invalid`                                                                                      | `stayGuideToken`                                                              | P1  |
| `guest-booking-document` | G    | `token`, `doc-types`                                                                                             | —                                                                             | P1  |

### Guest account (authenticated guest identity)

| Guide → `ui/e2e/pages/account/…` | Arch | Section specs                   | Migrate                | P   |
| -------------------------------- | ---- | ------------------------------- | ---------------------- | --- |
| `index`                          | DR   | `shell-nav`                     | `accountSmoke`         | P1  |
| `profile`                        | DW   | `profile-save`, `avatar-upload` | `accountSmoke`         | P1  |
| `stays`, `trips`                 | DR   | `stays-hub`, `load-path`        | `accountSmoke` (stays) | P1  |
| `favorites`                      | DW   | `grid`, `toggle`                | `favoritesSmoke`       | P2  |
| `vouchers`                       | DR   | `wallet`                        | `voucherWallet`        | P1  |
| `reviews`                        | DW   | `tabs`, `write`                 | `accountReviews`       | P2  |
| `tickets`, `help`                | DW   | `compose`, `thread`             | —                      | P2  |

Guest identity isolation is an explicit case in `access.spec.ts`: a guest session cannot open any `/org/*` route, and a host session on `/account/*` sees only its guest identity.

### Host app level

| Guide → `ui/e2e/pages/…` | Arch | Section specs                                                                                       | Migrate                       | P   |
| ------------------------ | ---- | --------------------------------------------------------------------------------------------------- | ----------------------------- | --- |
| `onboarding`             | DW   | `steps`, `save-path`, `enhanced-verification`, `rejected`                                           | `onboardingSmoke`             | P0  |
| `accept-invite`          | G    | `org`, `property`, `parking`, `invalid`, `expired`, `wrong-account`                                 | `acceptInviteSmoke`           | P0  |
| `org/selector`           | R    | `auto-redirect`, `no-org`                                                                           | `orgHubSmoke` (selector)      | P1  |
| `org/setup-guide`        | DW   | `stepper`, `persistence`, `recommended-reward`                                                      | —                             | P2  |
| `org/assistant`          | DW   | `mode-toggle`, `rail`, `composer`, `briefing`, `canvas`, `handoffs`, `confirm-cards`, `action-plan` | all `assistant/*` except live | P1  |

### Org level (`ui/e2e/pages/org/…`)

| Guide           | Arch | Section specs                                                                                                               | Gate | RBAC       | Migrate                                                             | P   |
| --------------- | ---- | --------------------------------------------------------------------------------------------------------------------------- | ---- | ---------- | ------------------------------------------------------------------- | --- |
| `dashboard`     | DR   | `date-range`, `stat-cards`, `revenue-chart`, `booking-status`, `recent-bookings`, `pending-actions`, `listings-performance` | —    | ✓          | `orgHubSmoke`, `statCardHelp`                                       | P1  |
| `bookings`      | DR   | `views`, `filters`, `property-column`                                                                                       | —    | ✓          | `orgHubSmoke`                                                       | P1  |
| `properties`    | DW   | `stats-period`, `cards`, `filters`, `actions-menu`, `add-property`, `copy-settings`                                         | ✓    | ✓          | `copyPropertySettingsDryRun`, `propertyLifecycle`                   | P0  |
| `parkings`      | DW   | `sections`, `add-parking`                                                                                                   | —    | ✓          | —                                                                   | P1  |
| `team`          | DW   | `tabs`, `invite`, `role-editor`, `manage-member`, `member-activity`                                                         | ✓    | ✓          | `orgHubSmoke` (team)                                                | P0  |
| `settings`      | DW   | one spec per section, `validation`, `otp-gated-fields`                                                                      | ✓    | owner-only | `orgSettingsSave`, `orgAiSettingsToggleOnly`, `unsavedChangesGuard` | P0  |
| `activity`      | DR   | `entity-panels`, `export`                                                                                                   | ✓    | ✓          | —                                                                   | P1  |
| `analytics`     | DR   | `listings-table`, `plan-gate`, `calculations`, `export-csv`                                                                 | ✓    | ✓          | (org CSV export gap from plan matrix closes here)                   | P1  |
| `announcements` | DW   | `feed`, `detail`                                                                                                            | —    | ✓          | —                                                                   | P2  |
| `reviews`       | DR   | `kpis`, `tabs`, `toolbar`, `by-property`                                                                                    | ✓    | ✓          | `orgReviewsPage`                                                    | P2  |
| `inbox`         | X    | `unified-threads`                                                                                                           | ✓    | ✓          | —                                                                   | P1  |
| `help-support`  | DW   | `faqs`, `docs`, `tickets`                                                                                                   | —    | —          | `contextualHelp`                                                    | P2  |
| `plans`         | WF   | `cards`, `compare`, `review-dialog`, `checkout`, `downgrade`                                                                | ✓    | owner-only | all `plans/org/*`                                                   | P0  |

### Property level (`ui/e2e/pages/org/property/…`)

| Guide                          | Arch | Section specs                                                                                                                                                                                                                                                                                                    | Gate | RBAC | Migrate                                                                                                                                                                              | P   |
| ------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| `dashboard`                    | DR   | `date-range`, `view-property`, `needs-attention`, `maintenance-reminders`, `stat-cards`, `board`                                                                                                                                                                                                                 | ✓    | ✓    | `dashboardModulesSmoke` (dashboard)                                                                                                                                                  | P1  |
| `bookings`                     | DW   | `new-booking`, `csv-import`, `stage-cards`, `views`, `kanban`, `filters-query-params`                                                                                                                                                                                                                            | ✓    | ✓    | —                                                                                                                                                                                    | P0  |
| `bookings-detail`              | WF   | `view-mode`, `edit-mode`, `progress-panel` (table-driven transitions), `activity-log`, `ai-validation`, `pay-parking`, `cancellation-refunds`                                                                                                                                                                    | ✓    | ✓    | `propertyBookingProceed`, `propertyBookingParkingEdit`, `bookingDetailPlanGates`, `propertyBookingLinkedParking`, `propertyBookingFreeManualWorkflow`, `voucherBookingDetailPricing` | P0  |
| `calendar`                     | DR   | `grid`, `blocks`                                                                                                                                                                                                                                                                                                 | —    | ✓    | —                                                                                                                                                                                    | P1  |
| `finance`                      | DW   | `summary`, `ledger`, `transactions`, `export`                                                                                                                                                                                                                                                                    | ✓    | ✓    | `dashboardModulesSmoke` (finance)                                                                                                                                                    | P0  |
| `pricing`                      | DW   | `channel-sync`, `smart-pricing`, `grid`, `rates-fees`                                                                                                                                                                                                                                                            | ✓    | ✓    | gate cases in `featureGates`                                                                                                                                                         | P0  |
| `maintenance`                  | DW   | `reminders`, `activity`, `guest-reported`                                                                                                                                                                                                                                                                        | ✓    | ✓    | —                                                                                                                                                                                    | P1  |
| `marketing`                    | X    | `studio`, `generate`, `ai-post`, `collage`, `library`, `themes`, `video-editor`, `publish`                                                                                                                                                                                                                       | ✓    | ✓    | all `marketing/*`                                                                                                                                                                    | P1  |
| `inbox`                        | X    | `threads`, `handoff`, `templates`, `cross-property`                                                                                                                                                                                                                                                              | ✓    | ✓    | `inboxThreadListSmoke`, `inboxHandoffBadge`, `inboxChatTemplates`, `inboxStayGuideGate`                                                                                              | P1  |
| `notifications`                | DW   | `sections`, `save-paths`                                                                                                                                                                                                                                                                                         | ✓    | ✓    | `notificationsHub`                                                                                                                                                                   | P1  |
| `templates`                    | DW   | `sections`, `preview`, `placeholders`, `send-to-guest`                                                                                                                                                                                                                                                           | ✓    | ✓    | `propertyTemplatesWorkbench`                                                                                                                                                         | P1  |
| `public-pages`, `custom-pages` | DW   | `gallery`, `editor`, `autosave`                                                                                                                                                                                                                                                                                  | ✓    | ✓    | `dashboardModulesSmoke` (public pages)                                                                                                                                               | P2  |
| `team`                         | DW   | `members`, `invite`, `custom-roles`, `permission-catalog`, `nav-rbac`                                                                                                                                                                                                                                            | ✓    | ✓    | `propertyTeamNavRbac`, `propertyTeamPermissionCatalog`, `propertySettingsCleanNavigation`                                                                                            | P0  |
| `reviews`                      | DW   | `kpis`, `breakdown`, `toolbar`, `views`, `tabs`, `reply`                                                                                                                                                                                                                                                         | ✓    | ✓    | `hostReviewsPage`                                                                                                                                                                    | P2  |
| `activity`                     | DR   | `feed`, `export`                                                                                                                                                                                                                                                                                                 | ✓    | ✓    | —                                                                                                                                                                                    | P1  |
| `announcements`                | DR   | `summary`, `archive`                                                                                                                                                                                                                                                                                             | —    | ✓    | —                                                                                                                                                                                    | P2  |
| `analytics`                    | DR   | `plan-gate`, `states`, `ai-review`, `export-pdf`                                                                                                                                                                                                                                                                 | ✓    | ✓    | `aiReviewPlaybook`                                                                                                                                                                   | P1  |
| `settings`                     | DW   | one spec per section: `listing-status`, `basic-info`, `details`, `media`, `description`, `amenities`, `house-rules`, `guest-form`, `cancellation-policy`, `location`, `socials`, `reviews-vouchers`, `payment` (OTP), `building-forms`, `email-automations`, `integrations`, `ai-features`, `activity`, `delete` | ✓    | ✓    | `propertySettingsEmailAutomations`, `voucherRevealStyleSettings`, `propertyLifecycle`                                                                                                | P0  |
| `help-support`                 | DW   | `app-card`, `faqs`, `guides`, `tickets`                                                                                                                                                                                                                                                                          | —    | —    | `contextualHelp`                                                                                                                                                                     | P2  |
| `operations`, `staff`          | R/DR | confirm route still exists; redirect or one load spec                                                                                                                                                                                                                                                            | —    | ✓    | —                                                                                                                                                                                    | P2  |

### Parking level (`ui/e2e/pages/org/parking/…`)

Shared modules call the same page object as property, with `level: 'parking'` and parking personas (Manager, Staff, Viewer).

| Guide                                                                 | Arch  | Section specs                                                        | Gate | RBAC | Migrate                                     | P   |
| --------------------------------------------------------------------- | ----- | -------------------------------------------------------------------- | ---- | ---- | ------------------------------------------- | --- |
| `dashboard`                                                           | DR    | `sections`                                                           | —    | ✓    | —                                           | P1  |
| `bookings`                                                            | WF    | `list`, `new-booking`, `detail`, `transitions`, `claim`, `broadcast` | ✓    | ✓    | `parkingHostClaim`, `parkingHostNewBooking` | P0  |
| `finance`                                                             | DW    | shared finance module minus stays, `payouts-view`                    | ✓    | ✓    | —                                           | P0  |
| `pricing`                                                             | DW    | `sections`                                                           | ✓    | ✓    | —                                           | P0  |
| `settings`                                                            | DW    | `setup-completeness`, per section, `save-paths`                      | ✓    | ✓    | —                                           | P1  |
| `team`                                                                | DW    | `standard-roles`, `custom-roles`, `invite`                           | ✓    | ✓    | —                                           | P0  |
| `inbox`, `notifications`, `activity`, `announcements`, `help-support` | DR/DW | shared modules                                                       | ✓    | ✓    | —                                           | P1  |

### Super admin (`ui/e2e/pages/admin/…`)

All 22 guides are archetype **SA**. Each folder gets `shell.spec.ts` (load, nav, non-super-admin is rejected) plus one spec per guide section with a write action. Destructive actions (org delete, payouts settlement) stay manual in `super-admin-manual.md` with the mocked confirmation dialog automated.

Migrate: `adminShellSmoke`, `adminApprovalsSmoke`, `adminAiConsole`, `adminSystemHealth`, `superAdminToggle` (→ `admin/feature-availability`). P0: `approvals`, `pricing-plans`, `payment-settings`, `parking-payouts`, `org-subscriptions`, `feature-availability`. The rest P2.

### Journeys (`ui/e2e/journeys/…`)

| Journey                       | Covers                                                                                            | Migrate                                                                                                                 | Mocked | `@live`                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------- |
| `booking-lifecycle`           | calendar → form → success → host review → documents → check-in → checkout → SD refund → completed | —                                                                                                                       | ✓      | ✓                           |
| `booking-cancellation`        | guest cancel request → host respond → refund record                                               | —                                                                                                                       | ✓      | ✓                           |
| `parking-guest-host`          | request → claim → pay → outcomes                                                                  | `parkingGuestHostOutcomes`, `parkingGuestHostExtraScenarios`, `parkingGuestHostSideBySide` (side-by-side stays `@demo`) | ✓      | ✓ (`parkingGuestHostLocal`) |
| `vouchers`                    | reveal → wallet → apply on form → host pricing                                                    | `voucherRedemptionMocked`                                                                                               | ✓      | —                           |
| `plan-checkout`               | public pricing → org plans → checkout handoff → entitlement visible on property page              | parts of `plans/org/*`                                                                                                  | ✓      | —                           |
| `onboarding-to-first-booking` | register → onboarding → add property → publish → public listing visible                           | —                                                                                                                       | ✓      | ✓                           |
| `team-invite`                 | invite → accept (each level) → member sees scoped nav                                             | —                                                                                                                       | ✓      | ✓                           |
| `review-double-blind`         | guest review + host review → reveal                                                               | `guestWriteReview` (journey half)                                                                                       | ✓      | —                           |

### Quality (`ui/e2e/quality/…`)

Keep and move: `axeSweep` (extend to every page manifest with `a11y: true`, generated list), `mobileBottomChrome`, `mobileOverflow`, `mobileChromeScreens` (tag `@ci`), `brandSmoke`, `telemetry`, `pwaFoundation`.

## Edge function coverage strategy

Make handlers importable first, then cover by category with shared table-driven helpers.

| Category                            | Count (approx.) | Required cases                                                                                                                                 |
| ----------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin writes (org/property/parking) | ~140            | auth tier rejection (generic), leaf allowed/denied per built-in role, plan gate envelope, validation 400s, stranger tenant, `expectActivity()` |
| Public reads                        | ~50             | property resolution by slug, not-found, rate-limit wrapper present, no PII fields in response (snapshot of key set)                            |
| Public writes (guest)               | ~25             | validation, token checks (invalid/expired/reused), idempotency on double submit, side effects through orchestrator                             |
| Uploads (`upload-*`)                | 14              | size/MIME limits, path scoping (no cross-tenant path), `cacheControl` set                                                                      |
| Webhooks                            | ~6              | signature valid/invalid, replay/duplicate event idempotency, unknown event ignored, out-of-order events                                        |
| Crons (`*-cron`)                    | ~20             | `serveCronPost` secret check, empty run, window boundary at Manila midnight, heartbeat written, partial failure continues                      |
| Super-admin                         | ~40             | non-super-admin rejected, step-up required where documented, audit row written                                                                 |
| AI / assistant                      | ~25             | gateway only, quota exceeded envelope, tool allow-list (existing parity tests stay)                                                            |

## Phases

Each phase ends green on `bun run ci:quality` and leaves the repo better than it found it. Phases 0 to 2 are prerequisites; 4 to 7 can run in parallel slices by module once 2 is done.

### Phase 0: stop the bleeding (CI truth)

- [ ] Add a `@ci` job to `ci.yml`: `test:e2e:ci` sharded 4 ways, required on PRs to `develop` and `main`. Add it to `ci-quality-gate.sh` and `cd-prod.yml`.
- [ ] Triage every currently untagged spec (17): tag `@ci`, `@demo`, or `@live`; fix or quarantine failures with `@flaky` + issue + expiry.
- [ ] Run the full `@ci` suite once; record failures; fix or quarantine each with an issue. Nothing is silently skipped.
- [ ] Lint rule (ESLint `no-restricted-syntax` or a small script): every `test.describe` in `ui/e2e/**` carries exactly one lane tag; no `waitForTimeout`; no `test.only`.
- [ ] Audit the 28 `skip`/`fixme`: delete obsolete, fix, or convert to `@flaky` with issue + expiry.
- [ ] Set `TZ=Asia/Manila` for Vitest and Deno scripts; `timezoneId`/`locale`/`reducedMotion` on all Playwright projects.
- [ ] Fix stale facts in `testing.mdc`, `testing` skill, `docs/guides/testing/README.md`, `application-coverage-model.md` (coverage baseline 41%/33%, real CI lanes).

Exit: every spec runs in some CI lane; `@ci` blocks PRs; docs match CI.

### Phase 1: foundations (harness, personas, determinism)

- [ ] `ui/e2e/shared/personas.ts` with all personas in §3, built from the real catalogs (`teamPermissions`, `parkingTeamConstants`, org templates) so a catalog change flows into tests.
- [ ] `ui/e2e/shared/tenant.ts` `mockTenant()` builder composing org, property/parking, plan (from `planTierGolden.ts`), entitlements, feature availability, entity state.
- [ ] `ui/e2e/shared/edgeMocks/` registry with a catch-all that fails on unmocked edge calls.
- [ ] `ui/e2e/shared/matrix.ts` boundary sampling generator (§3 rules 1 to 7) driven by a page manifest.
- [ ] `ui/e2e/shared/assertions/`: `expectReadOnly(page)`, `expectUpgradeGate(page, key)`, `expectNoAccess(page)`, `expectNoWriteRequests(page)`, `expectUnsavedGuard(page)`.
- [ ] `ui/e2e/shared/clock.ts` and storage key constant; remove the 8 duplicates.
- [ ] Vitest `projects`: `node` (existing, unchanged) and `dom` (happy-dom + `@testing-library/react` + `@testing-library/user-event`, `include: ['src/**/*.test.tsx']`, shared alias and setup). Add a guard test that fails if any `*.test.ts(x)` file is matched by neither project (fixes the silent-ignore trap).
- [ ] Edge handler testability spike: choose between (a) `serveEdge` wrappers returning the composed handler and skipping `serve()` when `EDGE_HANDLER_TEST=1`, or (b) each `index.ts` exporting `handler` with `if (import.meta.main) serve…`. Verify under `supabase functions serve` and hosted runtime before rollout. Then codemod all 347 `index.ts` files in one mechanical change.
- [ ] `supabase/functions/tests/harness/`: `makeRequest({ persona, body, query })`, `stubDb()` (PostgREST stub, reuse the one in `planFeatureGateResolution.test.ts`), `stubProvider()` (Resend, PayMongo, Meta, Gemini, Telegram), `expectActivity()`.
- [ ] Add `test:handlers`, `test:contracts`, `test:db`, `check:test-coverage`, `check:edge-test-coverage`, `check:unit-test-quality`, `check:flaky-quarantine` scripts (empty-but-passing initially, then enforced by baseline).

Exit: a new page spec can be written in under 30 lines using personas + tenant + matrix; one handler is tested end to end through its real `index.ts`.

### Phase 2: inventory and enforcement scaffolding

- [ ] `definePageCoverage()` type + `check:test-coverage` script + route-tree Vitest test (C1, C2, C3, C4).
- [ ] Generate a starter manifest for all 105 guides from guide headings, marking every unmapped section `todo` (allowed only via a shrinking baseline file `coverage-baseline.json`).
- [ ] `gen:route-testing-tables` replaces each guide's `## Testing` table from its manifest.
- [ ] Generate `docs/guides/testing/coverage-report.md`.
- [ ] `check:edge-test-coverage` with `coverage-exemptions.json` seeded from today's untested list (each with reason and owner), fail on any new untested function.
- [ ] `check:unit-test-quality` with today's 509 as baseline; fail on any new export-only test.
- [ ] Vitest coverage `thresholds` per T0/T1/T2 glob at today's measured values; ratchet script.

Exit: CI fails on any new uncovered route, section, key, leaf, function, or export-only test. Baselines only shrink.

### Phase 3: restructure existing E2E into the page tree

- [ ] `git mv` every spec into `pages/`, `journeys/`, `quality/`, `live/`, `demo/` per the catalog (history preserved). Update `package.json` `test:e2e:<domain>` scripts to new paths.
- [ ] Split `propertyTeamRbacHarness.ts` by moving each option into `edgeMocks/` modules; specs switch to `mockTenant().with(...)`. Delete options as their last user migrates. Same for `parkingFlowHarness.ts`.
- [ ] Split multi-module specs (`dashboardModulesSmoke`, `featureGates`) so each page owns its cases; `featureGates` becomes per-page `access.spec.ts` rows generated from `tierGateMocks`.
- [ ] Update the testing guides under `docs/guides/testing/*-playwright.md` to new paths (or fold into the generated report and delete redundant ones).

Exit: no spec left under `ui/e2e/features/`; the folder is deleted; all lanes green.

### Phase 4: P0 surfaces to full manifest coverage

Order: guest form + calendar + success + sd-form + trip → booking detail + bookings → plans → team (org, property, parking) → org settings + property settings → finance + pricing (property + parking) → parking bookings + marketplace → onboarding + accept-invite + auth → super-admin P0 pages.

For each page:

- [ ] Section specs per manifest; `access.spec.ts` from the matrix generator; `states.spec.ts` (loading skeleton, empty, 403, 404, 429, 402 upgrade, 500, plan unknown fail-open, archived/suspended where relevant).
- [ ] Component tests (`dom`) for its forms: step state, validation messages, unsaved guard (`useUnsavedChangesGuard` / `useGuardedClose`), gate wrappers.
- [ ] Handler tests for every edge function in its manifest, table-driven over personas and tiers.
- [ ] Contract fixtures for every mocked function.
- [ ] Replace export-only unit tests in its `lib/` with behavioral tests; raise T0 thresholds.
- [ ] `@live` spec for its journey where listed in the journey catalog.
- [ ] Manifest `todo` count for the page reaches zero; route guide Testing table regenerated.

Exit: P0 pages have zero `todo`, T0 modules meet 95/90.

### Phase 5: P1 surfaces

Same checklist as Phase 4 for every P1 page, including the parking-level shared modules and org rollups.

### Phase 6: P2 surfaces, super-admin rest, redirects, static

Same checklist; most are archetype R/S/DR with small manifests.

### Phase 7: edge, DB, contracts completion

- [ ] Burn down `coverage-exemptions.json` by category (webhooks and crons first, then uploads, then admin writes, then public reads). Target: only genuinely untestable or deprecated functions remain, each with a reason.
- [ ] Colocated Deno tests for every `_shared` module with branching logic not covered by handler tests; Deno coverage thresholds for T0 `_shared`.
- [ ] pgTAP suite: booking overlap (and the planned `EXCLUDE` constraint once it lands), status CHECK values match `statusMachine.ts`, parking status CHECK, storage policies per bucket (owner vs stranger vs anon), key RPCs (bookings list RPC, entitlement resolution), `activity_log` insert triggers, cascade deletes on org/property delete.
- [ ] Hook pgTAP into `migration-replay.yml` and a PR job when `supabase/migrations/**` changes.
- [ ] Email template snapshot tests (rendered HTML for each template × placeholder set, no `{{` left unrendered, no dead `{{urgentBlock}}`); PDF template field-map test that both template copies (Storage `templates` vs `ui/public/templates`) carry the same fields.

### Phase 8: nightly depth and test quality

- [ ] Nightly workflow: `supabase start` in Actions, `@live` top journeys, `test:db`, WebKit `@webkit` lane, full `@ci` on Firefox once a week.
- [ ] Stryker on T0 libs (UI) weekly, report surviving mutants as issues; no gate initially, then a mutation score floor on `statusMachine`, plan entitlements, team permissions, pricing math.
- [ ] Large-tenant fixture (50 properties, 5k bookings) for pagination, virtualization, and export specs (ties to doc 10 seed).
- [ ] Flake dashboard: Playwright JSON report artifact + script listing tests that needed a retry over the last 20 runs.

### Phase 9: governance and docs

- [ ] Rule, skills, CLAUDE.md, OpenCode plugin, hook, PR template, `test-impact` CI job per §8; `check:ai-tooling-sync` green.
- [ ] Delete the scaffold scripts once `check:unit-test-quality` baseline reaches zero.
- [ ] `docs/guides/testing/README.md` rewritten around the page tree, lanes, manifest, and recipes; `application-coverage-model.md` replaced by the "100% of inventory" table; `docs/PROJECT.md` and `docs/architecture/overview.md` testing sections updated; `29-sdlc-testing.md` rows marked done with links.
- [ ] Memory note `vitest-cannot-run-component-tests` retired once the `dom` project ships.

## Global edge cases every relevant page must consider

The manifest has an `edgeCases` list; `check:test-coverage` warns (then fails in Phase 9) when a page of a given archetype omits an applicable one.

**Tenancy and access**: wrong org slug, property slug from another org, parking slug used on a property route, deleted/archived entity deep link, member removed mid-session (next request 403 → redirect), role changed mid-session, owner-only actions for org admins, super-admin viewing a host page, guest session on host routes and vice versa.

**Plans**: plan loading (no flash of Free copy), plan fetch failure (fail-open + server envelope), property not enrolled (resolves Free), suspended subscription, downgrade with over-limit usage, 429 rate limit shown as plain error not upgrade, `upgradeHook: true` envelope opens upgrade modal, feature-availability kill switch overrides tier.

**Data states**: empty, one item, pagination boundary, very long strings and names, emoji and non-Latin input, missing optional media, slow response (skeleton, no layout shift), partial failure of one widget on a multi-widget page.

**Time**: Manila midnight crossover, month end, leap day, check-in equals check-out, past dates, date range across months, cron window edges, legacy `MM-DD-YYYY` vs `YYYY-MM-DD` normalization.

**Writes**: double submit, unsaved changes on navigate/close/reload, validation on server only (client bypass), optimistic update rollback on error, concurrent edit (stale `updated_at`), upload over size limit, wrong MIME, network drop mid-upload, OTP-gated fields.

**Money**: zero-amount bookings (free parking manual flow), vouchers stacking/expired/used, refunds partial and full, currency rounding, volume discount boundaries (10, 20, 50, 100, 200, 300 properties), duplicate PayMongo webhook, out-of-order payment events.

**Workflow**: every allowed transition once, every disallowed transition rejected server-side, revert-to-review, legacy nested statuses render, `compareFormData` skipping `petType` (pin with a failing-then-fixed test or an explicit known-gap test), side-effect failure does not corrupt status.

**Mobile and a11y**: 375/768/1440 overflow, bottom sheet vs dialog switch, bottom nav, touch target size, keyboard-only path for primary action, focus return after modal close, accessible names on icon buttons.

**Offline/PWA**: offline navigation to cached shell, mutation attempted offline shows error, update prompt.

**Privacy**: public responses never include guest PII (key-set snapshot), logs in handler tests contain no tokens or emails (assert on captured console).

## Risks and mitigations

| Risk                                                     | Mitigation                                                                                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ci` on every PR makes PRs slow                         | 4-way sharding, affected-only fast lane first, `--only-changed`; budget alarms in `check:budgets`-style script                                            |
| Handler codemod across 347 functions breaks prod runtime | Spike in Phase 1 on 3 functions deployed to dev; codemod is mechanical and reviewed by diff stats; deploy to dev first; no prod deploy without `kamewave` |
| Manifests become busywork                                | Starter manifests are generated; Testing tables are generated from them; only section-to-spec mapping is hand-written                                     |
| Baselines never shrink                                   | Coverage report shows per-module `todo` counts; Phase 4 to 6 exit criteria require zero for the phase's pages                                             |
| Mocked E2E passes while real stack fails                 | Contract tests (C7) + nightly `@live` on the top journeys + pgTAP                                                                                         |
| Flaky tests erode trust                                  | Quarantine requires issue + expiry; `check:flaky-quarantine`; retry report                                                                                |
| Restructure loses git history                            | `git mv` only, one commit per area, no content edits in move commits                                                                                      |
| happy-dom differences from real browsers                 | `dom` project only for logic-bearing components; anything layout-dependent stays in Playwright                                                            |

## Out of scope

- Line coverage targets on page/layout `.tsx`.
- Screenshot regression of app screens.
- Live PayMongo, Google OAuth, Meta OAuth, Resend inbound, Telegram live in any automated lane (manual guides stay, mocked halves automated).
- Production-targeted E2E of any kind.
- Editing shipped migrations to make tests pass.

## Verification of this plan

The plan is done when all of these hold on `develop`:

| Check                                                  | Expected                                                  |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `bun run check:test-coverage`                          | pass, `coverage-baseline.json` empty                      |
| `bun run check:edge-test-coverage`                     | pass, exemptions only for documented untestable functions |
| `bun run check:unit-test-quality`                      | pass, baseline empty, scaffold scripts deleted            |
| `bun run test` (node + dom)                            | pass, T0/T1/T2 thresholds met                             |
| `bun run test:edge`, `test:handlers`, `test:contracts` | pass                                                      |
| `bun run test:db`                                      | pass in nightly and migration-replay                      |
| `bun run test:e2e:smoke`, `test:e2e:ci`                | pass on PR CI, no untagged spec, no expired `@flaky`      |
| Nightly `@live` + `@webkit`                            | green 7 nights in a row                                   |
| Every route guide `## Testing` table                   | generated, matches manifest                               |
| `docs/guides/testing/coverage-report.md`               | every page row complete                                   |

## Docs to update (per phase, same change)

`docs/guides/testing/README.md`, `docs/guides/testing/application-coverage-model.md`, `docs/guides/testing/*-playwright.md`, every `docs/guides/routes/**` Testing table (generated), `docs/PROJECT.md` (scripts + layout), `docs/architecture/overview.md` (testing section), `docs/architecture/plans-feature-matrix.md` (tests table paths), `.cursor/rules/testing.mdc`, `.cursor/skills/testing/SKILL.md`, `.claude/skills/testing/SKILL.md`, new `test-architecture` skill, `CLAUDE.md` + `documentation-maintenance.mdc` done-checklist, `.opencode` plugin, `29-sdlc-testing.md`, `docs/archive/operations/migration-runbook.md` (pgTAP step).

## Open decisions

1. **Handler testability approach** (Phase 1 spike): wrapper test-mode flag vs `import.meta.main` export. Recommendation: wrapper flag, because it is a one-file change in `serveEdge.ts` plus a mechanical `export` in each `index.ts`, and it does not depend on edge-runtime `import.meta.main` semantics.
2. **`@ci` on every PR vs `develop` only**: recommendation every PR (sharded). The deleted `cd-dev` shows that a lane not on the PR path silently disappears.
3. **Zod on edge responses** (shared with the architecture modernization plan): contract tests work with TypeScript `satisfies` checks first, Zod later; no blocker either way.
