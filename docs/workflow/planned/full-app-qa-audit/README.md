---
title: 'Full-app QA audit: every page, every element, every connected flow'
status: planned
stage: planned
kind: plan
tags: [planning, qa, testing, audit, production-readiness, coverage, playwright, docs]
updated: 2026-11-13
readiness: unverified
launch_gate: A
launch_blocker: true
last_verified: none
---

# Full-app QA audit

## Goal

Walk every route in Kame Space as a real person in every role, inventory every element, action, event and background process on it, and prove each one works **end to end across every surface it touches** before it is marked passed. The output is a ranked list of defects and improvements, a coverage report that shows exactly what was checked and what was not, and route guides and automated tests brought up to date with what the audit proved.

"100% coverage" in this plan means **100% of an enumerated inventory has a verdict with evidence**. It does not mean zero findings, and it does not mean line coverage.

## Why a separate plan

Three efforts already exist. This one fills the gap between them and feeds all three.

| Existing work                                                                      | What it does                                                                          | What it does not do                                                             | How this audit relates                                                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [`full-app-test-architecture.md`](../../in-progress/full-app-test-architecture.md) | Builds the automated test structure (page manifests, personas, typed mocks, CI gates) | Does not look at the product as a user, and only 1 of 107 guides has a manifest | Each audited page hands its element inventory to that plan as the page's `definePageCoverage` manifest input          |
| [`production-readiness/`](../../in-progress/production-readiness/README.md)        | 61 module cards with 16 criteria, launch gates A to G, operator list                  | Cards are mostly unchecked; evidence was sampled, not exhaustive                | Each page audit is the evidence for the matching module card. Launch blockers found here get a row in its `LEDGER.md` |
| [`for-testing/`](../../for-testing/README.md)                                      | 32 shipped plans waiting for manual verification                                      | No one has run the checklists                                                   | Each checklist is executed inside the page audit that owns the surface, then the plan moves to `done/`                |
| [`qa/property-dashboard/`](../../qa/property-dashboard/README.md)                  | Deep QA of property pages, Aug 2026                                                   | Historical, property level only, pre-dates many modules                         | Format and severity legend reused; findings re-checked, not trusted                                                   |

## Scope

**In:** every router path in `ui/src/**/routes` (public, guest, guest account, auth, onboarding, org, property, parking, super-admin, redirects, legacy aliases, not-found), every modal, sheet, drawer, tab and wizard step reachable from them, and everything behind them that a user cannot see: edge functions, crons, webhooks, emails, PDFs, calendar and sheet sync, push, realtime, storage, activity log, AI calls.

**Out:**

- Rebuilding the test architecture (owned by the plan above; this audit only adds tests for behavior it verifies).
- New features. A missing feature is recorded as an improvement, not built here.
- Production deploys or migrations. Those still need `kamewave`.
- Dev-only routes (`POSTER_SHEET_PATH`, `explore-preview`, `for-hosts/v2`, `for-hosts/v3`, `/v2`): audited only for "must not be reachable or indexed in production".

## Files in this plan

| File                                                             | Read it when                                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`method.md`](./method.md)                                       | Before auditing any page. The 8-stage protocol and the pass rule                                |
| [`factors.md`](./factors.md)                                     | During the audit. The 24 lenses every page is judged on, with pass criteria                     |
| [`environments-and-personas.md`](./environments-and-personas.md) | Before touching a browser. Where to test, who to be, production safety rules                    |
| [`flow-graph.md`](./flow-graph.md)                               | When an element's effect leaves the page. The 30 cross-module journeys and the connection map   |
| [`findings-and-coverage.md`](./findings-and-coverage.md)         | When recording. Finding format, severity, coverage math, docs and test backfill rules, sign-off |
| [`ledger.md`](./ledger.md)                                       | To claim a page or read progress. One row per route                                             |
| [`page-audit-template.md`](./page-audit-template.md)             | Copy it to start a page record                                                                  |
| [`modules/`](./modules/)                                         | The work packet for each area: routes, risks, journeys, hidden surfaces                         |

Skill: **`full-app-qa`** (`.agent/skills/full-app-qa/SKILL.md`) loads the protocol in any model. Findings and page records are written to **`docs/workflow/qa/full-app/`**, not into this folder.

## Approach

### 1. Inventory first, then judge

A page cannot be "fully tested" until someone has written down everything on it. Every page audit starts by building an **element inventory** from three independent sources and reconciling them:

1. **The running page**: Playwright accessibility snapshot of every state (each persona, tier, tab, modal, empty, error), listing every button, link, input, menu item, toggle and drag target.
2. **The source**: the route element's component tree, read for `onClick`, `onSubmit`, mutations, queries, `navigate`, `Link`, realtime subscriptions, effects and feature gates.
3. **The docs and tests**: the route guide sections, Host-facing knowledge Q&A, `faqs.md`, existing specs and unit tests.

Anything in one source and missing from another is itself a finding (dead code, hidden control, undocumented behavior, untested behavior).

### 2. The pass rule

An element is `pass` only when the whole chain holds, not when the click works:

```
control state and feedback
  → request (correct function, payload, auth header)
    → server (auth tier, permission leaf, plan gate, validation)
      → data (rows written, constraints, storage)
        → side effects (email, calendar, sheet, push, Telegram, PDF, activity log, realtime)
          → every connected surface shows it (other pages, other roles, public pages, guest portal, super-admin)
            → it survives reload, back/forward, a second device, and the wrong role cannot do it
```

Any link in the chain that cannot be checked is `blocked` with the reason, never `pass`. Full definition in [`method.md`](./method.md).

### 3. Three hats per page

Every page is reviewed three times with different intent, and the record keeps them separate:

| Hat                                                                   | Question                                                                                                              | Output                                       |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **User** (host, guest, staff, owner, super-admin, first-time visitor) | Can I finish my job? What confuses or annoys me? What would I expect that is missing?                                 | UX findings, redesign proposals, copy issues |
| **Tester**                                                            | What breaks it? Empty, huge, wrong, slow, offline, double-click, wrong role, wrong tenant, wrong time zone            | Defects with reproduction                    |
| **Developer**                                                         | Is the implementation sound? Duplicated logic, missing guard, N+1, unbounded list, missing test, drift from the guide | Code, architecture, test and doc findings    |

### 4. Where to test

Local full stack with the canonical seed is the primary environment because it allows every write, every role and every plan tier. Production is used for what local cannot prove (deployed build, real latency, real caches, real third parties) and is limited to public pages read-only plus the single test tenant. Details and the production safety contract are in [`environments-and-personas.md`](./environments-and-personas.md).

### 5. Reverse coverage for what nobody can see

Walking pages forward misses anything no page reaches. After the page audits, an **orphan sweep** checks every inventory from the other direction: each of the 366 edge function directories, 23 cron and webhook functions, every email template, PDF template, storage bucket, DB trigger, plan feature key and permission leaf must be claimed by at least one page audit or cross-cutting audit, or be explicitly retired.

### 6. One page, one session, any model

Each ledger row is a self-contained work packet sized for one session. The skill, the method and the module file give a fresh model everything it needs without this conversation. Sessions do not fix product code while auditing (see fix policy in [`findings-and-coverage.md`](./findings-and-coverage.md)); that keeps the audit comparable across pages and the diff reviewable.

## Phases

Phases are ordered. Waves inside Phase 2 can run in parallel in separate sessions or worktrees because each claims different ledger rows.

### Phase 0: Setup and baseline (1 to 2 sessions)

- [ ] Move this folder to `docs/workflow/in-progress/` with `/workflow-start`; fix relative links.
- [ ] Pick the **baseline SHA** on `develop`; record it in `ledger.md`. All verdicts are against this SHA; a page touched by a later commit is re-opened (see drift rule).
- [ ] `./dev.sh`, `bun run db:reset`, `bun run seed:verify`, `bun run seed:attach-admin`, `bun run seed:integrations`. Record which integrations can run locally.
- [ ] Run the full automated baseline and save the output under `docs/workflow/qa/full-app/baseline/`: `bun run ci:quality`, `bun run test:e2e:ci`, `bun run test:dom`, `bun run test:edge:handlers`, `bun run seed:verify-ui`, every `check:*` script, `bun run audit:auth-matrix`, `bun run audit:edge-functions`, `bun run audit:deps`. Failures here are findings before any manual work starts.
- [ ] Pull production signal as leads, not verdicts: Sentry unresolved issues (30 days), Supabase security and performance advisors, edge function error logs, PostHog rage clicks and dead clicks if available, `/admin/health` state.
- [ ] Build the three helper scripts in `scripts/qa/` (specified in [`method.md`](./method.md) § Tooling): `route-inventory`, `element-inventory`, `edge-trace`. Wire `route-inventory --check` so a new route with no ledger row fails.
- [ ] Reconcile `ledger.md` against `route-inventory` output; add missing rows; mark redirects.
- [ ] Create `docs/workflow/qa/full-app/README.md` (index, severity legend, how to re-run) and update `docs/workflow/qa/README.md`.
- [ ] Confirm persona logins work (table in [`environments-and-personas.md`](./environments-and-personas.md)); add the missing seeded personas listed there.
- [ ] Dry-run the protocol on one small page (`/services`) and one write-heavy page (property `finance`, the only page that already has a coverage manifest). Adjust the template if a stage is unworkable, then freeze the method.

### Phase 1: Journey spine (4 to 6 sessions)

Run the 8 highest-risk journeys from [`flow-graph.md`](./flow-graph.md) (J01 to J08) end to end on local before any single-page audit. This gives a known-good or known-bad spine that page audits build on, and catches the blockers that would otherwise be rediscovered on ten pages.

### Phase 2: Page audits (the bulk; 132 route rows in the ledger)

Order is by blast radius. Each wave uses its module file.

| Wave | Module file                                                                              | Why this order                                                |
| ---- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 2.1  | [`modules/02-guest-booking-flows.md`](./modules/02-guest-booking-flows.md)               | Revenue entry point; a broken form is an outage               |
| 2.2  | [`modules/06-property-bookings-workflow.md`](./modules/06-property-bookings-workflow.md) | Status machine, emails, money                                 |
| 2.3  | [`modules/07-property-money.md`](./modules/07-property-money.md)                         | Finance, pricing, plans, vouchers                             |
| 2.4  | [`modules/01-public-marketing.md`](./modules/01-public-marketing.md)                     | First impression, SEO, search                                 |
| 2.5  | [`modules/04-auth-onboarding.md`](./modules/04-auth-onboarding.md)                       | Every host passes through it once                             |
| 2.6  | [`modules/08-property-comms.md`](./modules/08-property-comms.md)                         | Inbox, notifications, templates                               |
| 2.7  | [`modules/09-property-growth-and-config.md`](./modules/09-property-growth-and-config.md) | Marketing studio, public pages, settings, team, the rest      |
| 2.8  | [`modules/05-org-hub.md`](./modules/05-org-hub.md)                                       | Rollups depend on property pages being understood first       |
| 2.9  | [`modules/10-parking.md`](./modules/10-parking.md)                                       | Separate vertical, own RBAC, shared modules at a second level |
| 2.10 | [`modules/03-guest-account.md`](./modules/03-guest-account.md)                           | Authenticated guest portal                                    |
| 2.11 | [`modules/11-super-admin.md`](./modules/11-super-admin.md)                               | Internal, but its switches change every other page            |
| 2.12 | Redirects, legacy aliases, not-found                                                     | Table-driven, one session                                     |

### Phase 3: Remaining journeys (J09 to J30)

Run after the pages they cross are audited, so a failure can be pinned to a page quickly.

### Phase 4: Cross-cutting audits

One or more sessions each, from [`modules/12-cross-cutting.md`](./modules/12-cross-cutting.md): emails, PDFs, crons, webhooks, PWA and offline, SEO, accessibility, performance, security and tenancy, time zones and dates, AI surfaces, observability, data integrity, global chrome (headers, nav, tab bars, modals, toasts, cookie consent).

### Phase 5: Orphan sweep

Reverse coverage as described above. Every unclaimed function, cron, template, bucket, gate key or leaf becomes either a late audit row or a "retire" finding.

### Phase 6: Triage and fix waves

- [ ] Deduplicate findings; roll repeated ones into a single systemic finding with the list of pages.
- [ ] Triage with the owner: fix now, fix before launch, after launch, won't fix. Record the decision on each finding.
- [ ] Fix in waves grouped by module, one PR per wave, normal repo gates (docs, route guides, audit logging, support content, tests).
- [ ] Re-verify every fixed finding with the original reproduction. Only the re-verifier flips it to `verified-fixed`.

### Phase 7: Production verification and sign-off

- [ ] After fixes deploy (owner runs the deploy), run the production pass: public pages read-only and the test tenant, per the safety contract.
- [ ] Generate the final coverage report (format in [`findings-and-coverage.md`](./findings-and-coverage.md)).
- [ ] Update production-readiness module cards and the go/no-go table with links to the evidence.
- [ ] Move `for-testing/` plans whose checklists passed to `done/`.
- [ ] `/workflow-done` for this plan only when every ledger row is `signed-off` or `waived` with an owner decision.

## Effort

132 route rows, 30 journeys, 15 cross-cutting audits (177 ledger rows). A simple static page is under an hour; a workflow page such as booking detail or property settings (30 guide sections) is several sessions. Expect 150 to 220 sessions in total before fix waves. That is the cost of the stated bar; the waves are ordered so the first 40 sessions cover the money and booking paths.

## Docs to update (as part of execution)

| Doc                                                                          | When                                                                                                                                            |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/guides/routes/**`                                                      | Every page audit: fix wrong statements, add missing sections, refresh the `## Testing` table (skill `route-guides`)                             |
| `docs/guides/support/faqs.md` + Host-facing knowledge Q&A                    | When a guide's user-facing behavior statement changes (skill `support-content`, then `check:support-content` and `check:ai-knowledge-coverage`) |
| `docs/guides/testing/*-manual.md`                                            | When a third-party path is verified by hand or found unrunnable                                                                                 |
| `docs/architecture/routing.md`                                               | Route list is dated 2026-08-27; refresh from `route-inventory` in Phase 0                                                                       |
| `docs/architecture/overview.md`, `docs/PROJECT.md`                           | When the audit finds the documented architecture or API list is wrong                                                                           |
| `.cursor/rules/booking-workflow.mdc`                                         | Only when the audit proves the canonical spec and the code disagree and the owner picks the code                                                |
| `production-readiness/modules/*.md`, `ROUTE-COVERAGE.md`, `EDGE-COVERAGE.md` | Phase 7, with evidence links                                                                                                                    |
| `docs/workflow/qa/README.md`                                                 | Phase 0, add the `full-app/` row                                                                                                                |
| `.cursor/rules/README.md`, `.claude/README.md`                               | Done in this change: `full-app-qa` skill row                                                                                                    |

Plans/RBAC: N/A for the plan itself. activity-log: N/A for the plan itself. Both are audit lenses (factors F06, F07, F12).

## Open questions

1. **Bookings on the production test tenant.** It cannot accept bookings by design (`properties_test_never_active`). The plan therefore proves booking and payment flows on local only and treats production as read-only for them. If a real production booking pass is wanted, that is a reviewed design change to `docs/architecture/test-tenant.md`, not something the audit does on its own.
2. **Third-party live paths** (PayMongo, Meta OAuth and webhooks, Telegram, Resend inbound, Google Calendar and Sheets, Maps, web push on real devices). Which have sandbox credentials available locally? Phase 0 `seed:integrations` answers this; every one that cannot run is `blocked` and listed for the owner, with the mocked half still audited.
3. **Parallelism.** The repo default is one session at a time with no agent swarms. Waves are written to allow parallel worktrees if the owner opts in; default is serial.
