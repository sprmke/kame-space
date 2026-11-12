---
title: 'Testing index'
status: active
tags: [guides, testing]
updated: 2026-11-08
---

# Testing index

Sitewide pyramid for Kame Space. Plan: [`docs/workflow/done/sitewide-automated-testing.md`](../../workflow/done/sitewide-automated-testing.md).

## Gates: what runs when

Same tests, different questions. The PR gate proves the change; the deploy gate proves the
artifact about to ship. Duplicating the full browser suite in both was costing 31 minutes per
backend deploy for no extra signal.

| Gate                                             | Trigger                                           | Content                                                                                                                                        | Measured     |
| ------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `bun run test:fast`                              | you / an agent, before commit                     | filenames + lane tags + type-check + lint + unit (node + dom)                                                                                  | ~2.5 min     |
| `bun run ci:quality`                             | before a risky push, or when you want full parity | everything below, including the full `@ci` suite                                                                                               | ~40 min      |
| **PR CI** (`ci.yml`)                             | every PR                                          | static guards · lint · types · unit + coverage floor · edge unit + handlers · build + budgets · `@smoke` on 3 viewports · `@ci` sharded 4 ways | ~10 min wall |
| **Deploy gate** (`ci-deploy-gate.sh`, `cd-prod`) | every backend deploy                              | static guards · lint · types · unit + coverage floor · dom · edge unit + handlers · build + budgets · **`@critical` journeys (desktop)**       | ~9 min       |
| `@live`                                          | manual / nightly                                  | real local Supabase stack                                                                                                                      | never a gate |

### Criticality, not just lanes

A lane tag says _when_ a spec runs. `@critical` says _it must also run before a deploy_:

- every money path: guest intake, booking transitions, cancellation, parking request/payment;
- tenancy and auth: redirects, guest↔host separation;
- access: RBAC read-only, plan gates, feature-availability kill switches;
- public route health.

`@critical` is a modifier, not a lane. A spec keeps exactly one lane tag and may add
`@critical`; `check:e2e-lane-tags` enforces both. When you add a money or tenancy journey,
tag it `@critical` too.

### Why the deploy gate skips the full suite

`develop` is protected: the required `quality` check already ran `@smoke` on three viewports
and `@ci` in four shards before the merge. Re-running them in the deploy job added 12.2 min
(smoke) and 18.9 min (`@ci`) to a 39.3 min gate. The deploy gate keeps every fast,
high-signal check plus the `@critical` journeys, and drops the duplicated browser breadth.

Need full parity before a deploy anyway? Run `bun run ci:quality` locally.

## Pyramid

| Layer                           | Command                            | CI                   |
| ------------------------------- | ---------------------------------- | -------------------- |
| UI unit (Vitest)                | `bun run test`                     | every PR             |
| Edge unit (Deno `_shared`)      | `bun run test:edge`                | every PR             |
| Edge handlers                   | `bun run test:edge:handlers`       | every PR             |
| Auth parity seed (doc 21, opt.) | `bun run test:auth-parity-seed`    | local / manual       |
| Playwright smoke                | `bun run test:e2e:smoke`           | PR + develop         |
| Playwright phone + tablet smoke | `bun run test:e2e:smoke`           | every PR             |
| Playwright CI suite             | `bun run test:e2e:ci`              | develop              |
| Post-deploy                     | `./scripts/deploy/ci-smoke.sh dev` | after develop deploy |
| Full local parity               | `bun run ci:quality`               | before push          |

Local database fixtures: [`local-seed-data.md`](./local-seed-data.md) — one org, one property, one parking, every module populated.

## Comprehensive lib coverage

Every `ui/src/**/lib/*.ts` and `ui/src/utils/**/*.ts` module has a colocated Vitest file, or an explicit `test: N/A` marker when it is React-runtime-only, browser-only (canvas, service worker, fonts) or pure data (see [`docs/workflow/done/comprehensive-unit-test-coverage.md`](../../workflow/done/comprehensive-unit-test-coverage.md)).

The inventory reads the marker from a file's leading comment block, so "N/A" is a durable decision recorded next to the code, not a gap:

```ts
/**
 * test: N/A — React context plus accessor hooks; the behaviour lives in the provider.
 */
```

Current state (2026-11-08): **1,707** lib files, **0** missing, **863** Vitest files (`857` pass, `6` skipped for types-only and Polotno browser modules).

**Pages, sections, and UI elements** are not duplicated as Vitest cases. See [`application-coverage-model.md`](./application-coverage-model.md) for how public + dashboard routes map to **Playwright** (`@smoke` / `@ci`) plus colocated **lib** unit tests. Line coverage for logic only: `bun run test:coverage:lib`.

| Script                                                         | Purpose                                                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `node scripts/dev/lib-unit-test-inventory.mjs`                 | List lib files still missing `*.test.ts` and no `test: N/A` marker                             |
| `node scripts/dev/check-guide-spec-refs.mjs`                   | Fails when a route guide names a spec that does not exist; prints specs unclaimed by any guide |
| `bash scripts/dev/check-migration-version-collisions.sh`       | Fails when a branch reuses a migration version from its base branch                            |
| `node scripts/dev/scaffold-missing-lib-unit-tests.mjs --write` | Scaffold colocated tests (regenerate only when adding new lib files)                           |
| `node scripts/dev/enrich-lib-unit-tests.mjs --write`           | Replace export-only scaffolds with per-export `describe` blocks (safe export smoke)            |
| `node scripts/dev/enrich-lib-unit-tests.mjs --repair-unsafe`   | Re-run after bad heuristic upgrades (`--write` with `--repair-unsafe`)                         |
| `node scripts/dev/lib-behavioral-coverage-audit.mjs`           | Branching libs whose tests are still export-only (incremental depth backlog)                   |
| `node scripts/dev/fix-test-import-extensions.mjs`              | Strip erroneous `.ts` suffix from `@/` imports in Vitest files                                 |
| `node scripts/dev/deepen-lib-unit-tests.mjs --write`           | Append safe permission-gate behavioral cases on export-only files                              |
| `bun run test:coverage:lib`                                    | V8 coverage for `**/lib/**` + `utils/**` (not React pages)                                     |

`ui/vitest.setup.ts` sets test Supabase env vars so modules that import `@/lib/supabase/client` load in Node.

Latest `test:coverage:lib` baseline (2026-09-23): ~**49%** lines on lib/utils, ~**72%** branches; ~**480** branching libs still export-only per `lib-behavioral-coverage-audit.mjs`.

**UI pages and flows:** Vitest covers deterministic **lib** logic (validators, formatters, workflow mirrors, gates). Rendered journeys, navigation, and touch targets stay in **Playwright** (`bun run test:e2e:smoke` / `test:e2e:ci`).

## Layout

```
ui/src/<feature>/lib/*.test.ts
supabase/functions/_shared/*_test.ts
supabase/functions/tests/*.test.ts
ui/e2e/shared/
ui/e2e/features/<domain>/
docs/guides/testing/
```

`ui/e2e/shared/ids.ts` owns the stable E2E ids **and** `SUPABASE_AUTH_STORAGE_KEY`. Import it, never retype the key: it is derived from the Supabase project ref, so a literal breaks the moment the project moves, and the failure shows up as a signed-out page somewhere else. `bun run check:e2e-auth-key` fails on any `sb-<ref>-auth-token` literal outside that file.

### Handler tests (`supabase/functions/tests/handlers/`)

`EDGE_HANDLER_TEST=1` makes `serveEdge` mount the composed handler instead of starting a server, so a test drives the real wrapper: auth tier, validation order, envelope, headers. Stub Supabase at `fetch`, the only boundary the handler crosses.

Every entrypoint is now testable. Fifteen used to import `serve()` directly and could not be imported by a test at all, because importing booted a server: the two crons plus `superhost-assessment-cron`, `submit-form`, `submit-form-completion`, `submit-sd-form`, `ical-export`, `meta-inbox-oauth-callback` and the nine `upload-*` functions. They now call `serveHandler('<fn-name>', handler)`, which keeps production on the same `serve(handler)` path and only adds the test mount. Do not wrap them in `servePublic` / `serveAdmin`: each one owns its CORS, auth and rate-limit decisions inline, and a wrapper would change behaviour.

Two traps, both cost real debugging time:

- **Install one `fetch` stub before importing the handler.** The Supabase client captures `fetch` when it is created, so reassigning `globalThis.fetch` per test is invisible to it and the first stub silently answers every test. Keep one stub with mutable state and reset the state per test.
- **A missing row is `406` + `PGRST116`, not a `200` with `null`.** `.single()` maps that error to `null`, while a `200` with `null` or `[]` yields a row-like value, so a missing booking comes back as the wrong status. `DatabaseService.getBookingById` reads `guest_submissions`.

Run them with `bun run test:edge:handlers`. `check:edge-test-coverage` is shrink-only: adding a handler test fails until its `scripts/dev/edge-handler-baseline.json` entry is deleted.

### Personas and `mockTenant`

```ts
import { installTenant, mockTenant } from '../shared/tenant';

const tenant = mockTenant({ persona: 'superAdmin', level: 'platform' });
await installTenant(page, tenant); // seeds the session
await mockEdgeFunctions(page, [...tenant.mocks, ...pageMocks], { strict: true });
```

- `ui/e2e/shared/personas.ts` derives every permission list from the real catalogs (`SEEDED_TEMPLATE_PERMISSIONS`, `PARKING_ROLE_PERMISSIONS`, `ORG_ROLE_PERMISSIONS`) and tiers from `planTierGolden`. A renamed leaf flows into the personas that hold it; nothing is retyped.
- Org `Operations` and `Read Only` are seeded **server-side** templates with no client catalog. Use `orgCustom(leaves)` with the leaves the test needs instead of inventing a list that may disagree with the server.
- `tenant.mocks` covers only what every signed-in page reads on boot: session, `list-organizations`, `get-public-platform-status`, `get-feature-availability`. Page data endpoints stay in the spec, so strict mode fails loudly rather than rendering from an invented payload.
- Merge `tenant.mocks` into the spec's own `mockEdgeFunctions` call. Registering them separately would put two handlers on the same URL pattern and let one shadow the other.

### Typed edge mocks and strict specs

An inline `mockEdgeFunctions(page, [{ name, body }])` drifts silently: nothing ties the body to the edge function, and an endpoint the spec forgot to mock quietly reaches the network.

- Typed mocks live in `ui/e2e/shared/edgeMocks/<fn>.ts` (for example `mockPlatformStatus()`), so the field names stay next to the function they mirror.
- `mockEdgeFunctions(page, mocks, { strict: true })` **fails the test** on any `functions/v1` call no mock covers, naming the function. Turn it on for a spec whose endpoint set is fully known; leave it off where a shared harness still relies on pass-through.
- Mocks match the function name **exactly** (the path segment after `/functions/v1/`), so `finance-summary` no longer matches `finance-summary-v2`.

To adopt strict mode in a spec, run it once with the default (non-strict) and read the mock list it needs, or check the page's functions in `supabase/functions/`. Every `get-public-platform-status` call needs `mockPlatformStatus()`.

### Page coverage manifests

A page is **adopted** by adding `ui/e2e/pages/<guide path>/<page>.coverage.ts` with `definePageCoverage`. The manifest mirrors the route guide: every behavioural `##` section is either claimed by a spec or marked `na` with a reason.

```ts
export default definePageCoverage({
  guide: 'docs/guides/routes/org/property/finance.md',
  routes: ['/org/:orgSlug/property/:propertySlug/finance'],
  archetype: 'DW',
  levels: ['property'],
  sections: {
    'Summary cards & charts':
      'ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts#<test title>',
  },
  na: {},
  gates: ['financeReporting'],
  permissions: ['finance:view', 'finance:edit'],
  edgeFunctions: ['finance-summary', 'finance-line-items', 'finance-export'],
  activity: ['finance.line_item.created'],
  unit: ['ui/src/features/dashboard/finance/lib/financeSummaryStats.test.ts'],
});
```

| Rule                   | Fails when                                                   |
| ---------------------- | ------------------------------------------------------------ |
| Section has a decision | a guide `##` heading is neither claimed, `na`, nor baselined |
| Claim is real          | the spec path, or the unit suite, does not exist             |
| Claim is current       | the heading no longer exists in the guide                    |
| Baseline shrinks       | an entry is now claimed or gone (re-run with `--write`)      |
| One owner per guide    | two manifests claim the same guide                           |

Boilerplate headings (`Overview`, `Host-facing knowledge`, `API reference`, `Implementation map`, `Testing`, `Related docs`, `Progress overview`) are ignored.

The `definePageCoverage` helper lives in `ui/e2e/shared/pageCoverage/`, not `coverage/`: `.gitignore` has `**/coverage` for coverage reports, so that directory name is silently untracked.

`bun run check:test-coverage` reports progress as `N/107 guides adopted · sections claimed · na · baselined`. Unadopted guides are counted, not failed, so adoption is one page at a time. Gaps inside an adopted guide go into `ui/e2e/coverage-baseline.json`, which is shrink-only:

```bash
bun scripts/dev/check-test-coverage.ts            # check
bun scripts/dev/check-test-coverage.ts --write    # rewrite the baseline after claiming a section
bun scripts/dev/check-test-coverage.ts --report   # regenerate coverage-report.md
```

`docs/guides/testing/coverage-report.md` is generated: adopted pages with their gate counts and open gaps, then the guides that have no manifest yet. It still runs the check after writing, so a broken manifest cannot produce a report that reads as green.

## Playwright tags

Vitest runs two projects:

| Project                        | Environment                 | Files               | Covers                                                                                        |
| ------------------------------ | --------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `node` (default)               | Node, no DOM                | `src/**/*.test.ts`  | Pure helpers, validators, client/server mirrors, gates, money math                            |
| `dom` (`vitest.dom.config.ts`) | happy-dom + Testing Library | `src/**/*.test.tsx` | Hooks with state and small components with behaviour (dismiss, dirty tracking, media queries) |

The extension decides the project, so a test file can never be matched by neither. Layout,
Tailwind classes and shadcn primitives stay in Playwright, which can see a real browser.

`bun run test` runs both projects. `bun run test:dom` runs only the DOM one.

The smoke command runs every `@smoke` journey on desktop, 375×812 phone, and
768×1024 tablet projects. Primary public, guest-form, booking, and super-admin
routes assert that the document does not overflow horizontally and that visible
interactive controls have an accessible name.

### Lanes

| Specs | Lane                                                           |
| ----- | -------------------------------------------------------------- |
| 23    | `@smoke`, every PR on 3 viewports                              |
| 68    | `@ci`, every PR, sharded 4 ways (62 executable, 6 quarantined) |
| 1     | `@pwa`, production build                                       |
| 2     | `@live`, manual / nightly                                      |
| 2     | `@demo`, headed only                                           |

E2E and Deno move to `Asia/Manila` alongside Vitest, so a date-boundary test cannot pass on
one machine and fail on another.

Every spec carries **exactly one** lane tag. `bun run check:e2e-lane-tags` fails on a missing or
duplicate tag, a committed `.only`, or a new `waitForTimeout` call (baselined, shrink-only).

| Tag      | Meaning                                      |
| -------- | -------------------------------------------- |
| `@smoke` | Fast PR gate, desktop + phone + tablet       |
| `@ci`    | Page and journey suite, every PR, sharded 4× |
| `@pwa`   | Production build, service worker             |
| `@live`  | Local Supabase (`PLAYWRIGHT_LOCAL_LIVE=1`)   |
| `@demo`  | Headed/video; never CI                       |

## Local runs: do not reuse a stale dev server

`playwright.config.ts` reuses an already-running server on `127.0.0.1:4173` outside CI. If
another checkout (or another session) already owns that port, your run silently tests
**that** build instead of your branch. The symptom is a test that fails locally, passes in
CI, or changes result between runs with no diff.

Set a free port per checkout:

```bash
PLAYWRIGHT_PORT=4199 PLAYWRIGHT_PWA_PORT=4200 bun run test:e2e:ci
```

Or stop the other server. The same applies to `bun run ci:quality`, which starts the smoke
and `@ci` suites one after another on the same port.

## Domain guides

| Doc                                                                      | Domain                              |
| ------------------------------------------------------------------------ | ----------------------------------- |
| [`booking-workflow-playwright.md`](./booking-workflow-playwright.md)     | Guest form + host booking workflow  |
| [`parking-playwright.md`](./parking-playwright.md)                       | Parking marketplace                 |
| [`property-team-rbac-playwright.md`](./property-team-rbac-playwright.md) | Property team nav RBAC              |
| [`org-hub-playwright.md`](./org-hub-playwright.md)                       | Org dashboard, properties, team     |
| [`dashboard-modules-playwright.md`](./dashboard-modules-playwright.md)   | Property module shells              |
| [`guest-account-playwright.md`](./guest-account-playwright.md)           | Profile, stays, favorites, vouchers |
| [`plans-playwright.md`](./plans-playwright.md)                           | Checkout + downgrade                |
| [`voucher-reveal-playwright.md`](./voucher-reveal-playwright.md)         | Voucher reveal + wallet             |
| [`auth-playwright.md`](./auth-playwright.md)                             | Auth pages + redirects (no OAuth)   |
| [`onboarding-playwright.md`](./onboarding-playwright.md)                 | Host onboarding wizard (mocked)     |
| [`admin-playwright.md`](./admin-playwright.md)                           | Super-admin shell + approvals queue |
| [`public-marketing-playwright.md`](./public-marketing-playwright.md)     | Landing, search, listings, legal    |
| [`super-admin-manual.md`](./super-admin-manual.md)                       | Super admin OTP + payouts           |
| [`cost-abuse-verification.md`](./cost-abuse-verification.md)             | Cost/abuse/security dev verify      |
| [`local-google-setup.md`](./local-google-setup.md)                       | Local Maps key + OAuth client       |

Manual-only (existing):

| Doc                                                                            | Domain                 |
| ------------------------------------------------------------------------------ | ---------------------- |
| [`ai-dashboard-assistant-manual.md`](./ai-dashboard-assistant-manual.md)       | Live Gemini assistant  |
| [`contract-expiry-lifecycle-manual.md`](./contract-expiry-lifecycle-manual.md) | Contract expiry        |
| [`smart-search-intents-manual.md`](./smart-search-intents-manual.md)           | Search intents deep QA |
| [`stay-guide-manual.md`](./stay-guide-manual.md)                               | Stay guide showcase    |
| [`custom-pages-module-manual.md`](./custom-pages-module-manual.md)             | Public pages editor    |
| [`image-upload-optimization-manual.md`](./image-upload-optimization-manual.md) | Media OCR/perf         |
| [`property-showcase-manual.md`](./property-showcase-manual.md)                 | Showcase templates     |
| [`voice-receptionist-manual.md`](./voice-receptionist-manual.md)               | Gemini Live voice      |
| [`cancellation-policy-manual.md`](./cancellation-policy-manual.md)             | Cancellation + refunds |

## Coverage inventory

| Domain            | Unit                                        | E2E                                                                                     | Manual                   |
| ----------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| Booking workflow  | `statusMachine_test.ts`, `workflow.test.ts` | `ui/e2e/features/bookings/`, `guest-form/`                                              | workflow emails          |
| Parking           | `parkingStatusMachine_test.ts`              | `ui/e2e/features/parking/` (guest `@ci`, outcomes `@ci`)                                | PayMongo live            |
| Plans / billing   | `planPresentation.test.ts`, entitlements    | `ui/e2e/features/plans/org/*` (`@ci`)                                                   | PayMongo checkout        |
| Team RBAC         | catalog drift + permission expansion tests  | `ui/e2e/features/team/`                                                                 | auth parity seed (below) |
| Org hub           | org permissions helpers                     | `ui/e2e/features/org/` (dashboard, bookings, properties, team, settings)                | —                        |
| Guest account     | profile validation                          | `ui/e2e/features/account/` (favorites, profile, stays `@ci`)                            | OAuth, chat live         |
| Vouchers          | `voucherRevealWheel.test.ts`                | `ui/e2e/features/vouchers/`                                                             | —                        |
| Assistant         | `assistantToolCatalog.test.ts`              | `ui/e2e/features/assistant/`                                                            | live Gemini              |
| Auth              | validators                                  | `ui/e2e/features/auth/` (pages, redirect, legacy routes, accept-invite `@ci`)           | Google OAuth             |
| Public / search   | intent helpers                              | `ui/e2e/features/public/` (landing, list, for-hosts, search, legal, developments `@ci`) | smart-search manual      |
| Redirects         | —                                           | `legacyRouteRedirectSmoke.spec.ts`, `legacyRedirectSmoke.spec.ts`                       | —                        |
| Dashboard modules | finance/pricing/settings units              | `ui/e2e/features/dashboard/` (finance, team, public-pages, activity `@ci`)              | OTP payment              |
| Onboarding        | reserved-name validators                    | `ui/e2e/features/onboarding/` (`@ci`)                                                   | verification upload      |
| Super admin       | `superAdminVerification_test.ts`            | `ui/e2e/features/admin/` (overview + approvals queue `@ci`)                             | OTP, payouts             |
| Crons / webhooks  | lead-window, signature units                | —                                                                                       | scheduled jobs           |

Route guides: each **`docs/guides/routes/*.md`** includes a **Testing** section (unit path / E2E spec / manual).

### Auth parity seed (production-readiness doc 21)

Hosted no-seed smoke: `supabase/functions/tests/adversarialAuthLive.test.ts` (cd-dev deploy job).

Seeded role × endpoint table (local or hosted with real JWTs):

1. Copy `supabase/functions/tests/fixtures/auth-parity-seed.example.json` to `auth-parity-seed.local.json` (gitignored).
2. Fill query params and export JWT env vars named in each case.
3. Run `AUTH_PARITY_FIXTURE=supabase/functions/tests/fixtures/auth-parity-seed.local.json SUPABASE_URL=... SUPABASE_ANON_KEY=... bun run test:auth-parity-seed`

CI runs the harness with fixture unset (one passing skip marker test).

## Same change as code

When you ship behavior:

1. Add or update the matching unit or E2E test.
2. Update the route guide **Testing** row.
3. Run `bun run ci:quality` before push.

Agents: invoke skill **`testing`** and rule **`.cursor/rules/testing.mdc`**.

## Flake policy

- CI retries Playwright twice (`playwright.config.ts`).
- Quarantine with `@flaky` only with a tracked issue; never skip silently.
- `@live` and `@demo` never block PR or develop deploy.
