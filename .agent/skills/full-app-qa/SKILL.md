---
name: full-app-qa
description: >-
  Audit one page, journey or cross-cutting topic of Kame Space end to end for the
  full-app QA audit: inventory every element, trace each action through server,
  data, side effects and every connected page, critique as user, tester and
  developer, record findings, and backfill guides and tests. Use when the user
  asks to QA, audit, review, critique, verify or regression-test a page, route,
  module or flow, asks for a coverage report, or says "full-app QA", "page
  audit", "audit the next page", or names a ledger ID (PUB-, GST-, ACC-, AUTH-,
  ORG-, PROP-, PARK-, ADM-, XC-, RED-, J01 to J30).
---

# Full-app QA audit

You are auditing, not building. The job is to find out what is true about one slice of the product and write it down with evidence. Do not change product behavior in an audit session.

## Where the plan lives

`docs/workflow/planned/full-app-qa-audit/` (or `docs/workflow/in-progress/full-app-qa-audit/` once started). Read in this order, every session:

1. `README.md`: goal, phases, what is out of scope
2. `method.md`: the 8 stages. Follow them in order
3. `factors.md`: the 24 lenses and which apply to the page's archetype
4. `environments-and-personas.md`: where to test, who to be, the production safety contract
5. The module file in `modules/` for the row you are claiming
6. `flow-graph.md`: connections (C01…) and journeys (J01…) the row touches
7. `findings-and-coverage.md`: finding format, severity, fix policy, backfill rules, definition of done

Results go to `docs/workflow/qa/full-app/` (page records, journeys, cross-cutting, `findings.md`, `coverage-report.md`). Evidence goes to the gitignored `ui/e2e/artifacts/full-app-qa/`.

## One session, one row

1. Pick the row the user named, or the first `todo` row in the current wave of `ledger.md`. Set it to `in-audit` with the date.
2. Copy `page-audit-template.md` to `docs/workflow/qa/full-app/pages/<guide-path>.md`.
3. Run stages 1 to 8 of `method.md`. A stage you cannot do is written `N/A — <why>` or `blocked — <who can unblock>`. Never skipped silently.
4. Close the row in `ledger.md` with counts. Report in the repo reporting format (Investigation type).

If the page is too large for one session (booking detail, property settings, marketing studio, guest form), split by section into sub-records and say which sections remain. Do not rush the rest to finish.

## The pass rule

An element is `pass` only if the whole chain holds:

control feedback → request → server auth, leaf, plan gate, validation → rows written → side effects (email, PDF, calendar, sheet, push, Telegram, storage, `activity_log`, realtime) → **every connected surface shows it** (other pages, other roles, guest pages, public pages, super-admin) → survives reload → the wrong role and the wrong tenant are refused **by the server**.

Any link you could not check makes the element `blocked`, with the reason. A click that "seemed to work" is not evidence.

## Non-negotiables

- **Inventory before judgment.** Build the element list from the running page (every persona, tier, tab, modal, state) and from the source (handlers, queries, mutations, navigation, gates), then reconcile. Write both completeness counts.
- **Docs and tests are references, not truth.** Read the guide, FAQ, plans and specs first so you can catch disagreement. Then look at the product yourself.
- **Three hats, kept separate:** user (can I do my job, what annoys me), tester (what breaks it), developer (is it sound). Opinions are wanted; label them as opinion.
- **Phone first.** 375 before desktop. Then 768 and 1440. WebKit for guest and public pages.
- **Two actors for every chain.** Guest and host, host and super-admin, member and owner, in two browser contexts.
- **Server, not UI, proves access.** Replay the request as the persona who must be denied.
- **Recompute money and counts by hand.**
- **Status words only:** `pass` · `fail` · `blocked` · `N/A — <why>` · `not run`. Never report something you did not run.
- **P0 stops the session.** Report it to the user as soon as it is confirmed.

## Environment rules

- Default to local: `./dev.sh`, canonical seed, `seed-owner@example.com` and the demo team (`docs/guides/testing/local-seed-data.md`). Switch tiers with `bun run seed:plan -- --plan=<tier>` and restore afterward.
- Production (`fwor…`, `kamespace.com`) only for what local cannot prove, and only: anonymous read-only public browsing, and the probe account inside `kame-test-tenant`. Reversible writes inside the test tenant are listed in the record and restored.
- Never on production: deploys or migrations (need `kamewave`), writes to real tenants, public form submissions against real listings, messages to real people, super-admin actions, real payments, a second test org, an `ACTIVE` test listing.
- Never store tokens, OTPs, real guest PII or payment details in records, findings or screenshots.

## What you may change in an audit session

| Yes                                                                                | No                                              |
| ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| Page record, `findings.md`, `ledger.md`                                            | `ui/src/**` or `supabase/functions/**` behavior |
| Route guide, FAQ, architecture doc corrections (`route-guides`, `support-content`) | Migrations                                      |
| Tests for behavior that passed (`testing`)                                         | Tests that assert currently wrong behavior      |
| `definePageCoverage` manifest, seed additions, `scripts/qa/` helpers               | Silent fixes                                    |

Fixes happen in Phase 6 fix waves, one PR per module, with the normal repo gates, and are re-verified with the original reproduction steps.

## Skills to pull in

`karpathy-guidelines`, `agent-reporting` always. By stage: `docs-first` and the domain skill (`booking-workflow`, `bookings-table`, `admin-dashboard`, `multi-tenancy`, `social-inbox`, `meta-messaging`, `emails`, `notifications`, `forms`, `public-ui`, `supabase-auth`, `integrations`, `seo`) for reference; `verify`, `playwright-cli`, `investigate-first` for exercise and trace; `mobile-responsive`, `accessibility`, `impeccable`, `web-design-guidelines`, `competitive-ux-research`, `human-copy`, `performance`, `plans-and-permissions`, `audit-logging`, `unsaved-changes-guard`, `security-audit` for critique; `route-guides`, `documentation-maintenance`, `support-content`, `testing` for backfill. Property pages: `property-dashboard-qa` is a subset of this method.

Do not spawn subagent swarms unless the user asks; the repo default is one session, one task.

## Report shape (end of session)

```
Audited <ledger ID> <route> at <sha>: <n> elements, <p> pass, <f> fail, <b> blocked; <P0>/<P1>/<P2>/<P3> findings.

## Short answer
<is this page production ready, in one or two sentences>

## What is happening
<top findings, one line each, with IDs>

## Blocked
<what could not be checked and who can unblock it>

## Verification
<gates run for the backfill, with results; what was not run>

<one closing question or the next ledger row>
```
