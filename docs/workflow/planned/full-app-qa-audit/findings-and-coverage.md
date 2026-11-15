---
title: 'Full-app QA audit: findings, coverage report, backfill, sign-off'
status: planned
stage: planned
kind: reference
tags: [qa, audit, findings, coverage]
updated: 2026-11-13
---

# Findings and coverage

## Where things are written

```
docs/workflow/qa/full-app/
  README.md                 # index, legend, how to re-run, link to the plan
  baseline/                 # Phase 0 automated gate output and production signal summary
  pages/<guide-path>.md     # one page record per ledger row (mirrors docs/guides/routes/)
  journeys/J<nn>-<slug>.md  # one record per journey
  cross-cutting/<topic>.md  # one record per cross-cutting audit
  findings.md               # the single findings register (all pages)
  coverage-report.md        # generated summary (below)
ui/e2e/artifacts/full-app-qa/   # gitignored evidence: screenshots, traces, request logs
```

The plan folder holds method and ledger only. Results never go into the plan folder.

## Finding format

One row per finding in `findings.md`, plus a detail block in the page record.

| Field                                 | Content                                                                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID                                    | `QA-<AREA>-<nnn>`. Areas: `PUB`, `GST` (guest flows), `ACC` (guest account), `AUTH`, `ORG`, `PROP`, `PARK`, `ADM`, `XC` (cross-cutting), `JRN`                        |
| Page, element                         | Route and inventory element ID (`<PAGE>.E<nn>`), or journey step                                                                                                      |
| Type                                  | `defect` · `gap` (missing behavior) · `ux` · `visual` · `copy` · `a11y` · `perf` · `security` · `data` · `code` · `test-gap` · `doc-gap` · `improvement` · `redesign` |
| Lens                                  | Factor ID from [`factors.md`](./factors.md)                                                                                                                           |
| Severity                              | P0 to P3 (below)                                                                                                                                                      |
| Persona, tier, viewport, browser, env | Exactly what reproduces it                                                                                                                                            |
| Steps                                 | Numbered, starting from a known state                                                                                                                                 |
| Expected vs actual                    | One line each, with the source of "expected" (guide, rule, common sense)                                                                                              |
| Evidence                              | Artifact path, request and response status, DB query result, console text                                                                                             |
| Suspected cause                       | File and line when the Developer hat found it; otherwise blank                                                                                                        |
| Proposed fix                          | Smallest fix; for `redesign`, the direction and why                                                                                                                   |
| Confidence                            | `confirmed` (reproduced twice) · `likely` (once) · `suspected` (from code reading only)                                                                               |
| Status                                | `open` → `triaged` → `in-fix` → `fixed` → `verified-fixed` · or `waived` (owner, reason) · `duplicate-of` · `cannot-reproduce`                                        |

Severity:

| Level  | Meaning                                                                                                                                               | Examples                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **P0** | Blocks a core job, loses or exposes data, or takes or loses money. Report to the owner the moment it is confirmed; do not wait for the page to finish | Form cannot submit; cross-tenant read; wrong amount charged; transition sends the wrong guest an email |
| **P1** | Feature broken or wrong on a main path with a workaround; missing server gate; broken link on a primary action; chain break on a connected surface    | Read-only member can save via the API; counter never updates; email placeholder unresolved             |
| **P2** | Friction, confusing or inconsistent behavior, edge-case defect, mobile layout break, missing state                                                    | No empty state; modal not a bottom sheet on phone; double submit creates two rows on a rare path       |
| **P3** | Polish                                                                                                                                                | Spacing, wording, alignment, minor inconsistency                                                       |

Rules:

- A finding without reproduction steps and evidence is a note, not a finding. Put notes in the page record's Observations.
- One root cause seen on many pages is one **systemic** finding listing all pages, not one per page.
- Opinions belong in `ux`, `improvement` or `redesign` and are labeled as opinion. They are wanted; they are not defects.
- Never include tokens, OTPs, real guest PII, or payment details in a finding.

## Fix policy during the audit

Audit sessions **record**; they do not change product behavior. Exceptions, all in the same change as the page record:

| Allowed in an audit session                                                                                                                            | Not allowed                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Route guide, FAQ and architecture doc corrections                                                                                                      | Any change to `ui/src/**` or `supabase/functions/**` behavior                 |
| New tests for behavior that passed                                                                                                                     | Tests asserting behavior that is currently wrong (they would lock in the bug) |
| Coverage manifests, seed data additions, QA scripts                                                                                                    | Migrations                                                                    |
| A failing-test reproduction attached to a P0 or P1 finding, marked with the repo's quarantine mechanism and the finding ID, when the owner asks for it | Silent fixes with no finding                                                  |

P0 exception: stop, report, and fix in its own branch with the normal gates if the owner says so. Then resume the audit.

Reason: mixing fixes into audits changes the thing being measured, makes later pages incomparable, and buries fixes in documentation diffs.

## Backfill rules (docs and tests)

**Docs.** The guide must describe the page as audited, including behavior the audit found broken (describe intended behavior, and reference the finding in the record, not in the guide). Add a section for every inventory group the guide lacked. Keep the Host-facing knowledge true. After any user-visible statement changes, run `bun run check:support-content` and `bun run check:ai-knowledge-coverage`.

**Tests.** Add the cheapest test that would fail if the verified behavior broke:

| Verified behavior                                                   | Test                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Pure rule (validation, math, date, gate decision, formatter)        | Vitest `lib/*.test.ts`, behavioral, table-driven                                                             |
| Stateful hook or component (wizard step state, guard, gate wrapper) | `*.test.tsx` under the `dom` project. Note: plain `bun run test` ignores `.test.tsx`; run `bun run test:dom` |
| Server rule, permission, plan gate, validation, activity event      | Deno `_shared/*_test.ts` or a handler test via the `EDGE_HANDLER_TEST` seam                                  |
| Page section behavior, role and tier rendering, states              | Playwright spec for the page with typed `edgeMocks` in strict mode and a lane tag                            |
| Cross-page chain                                                    | Playwright journey spec, mocked; `@live` local variant for the spine journeys                                |
| Third-party live path                                               | Row in the matching `*-manual.md` guide                                                                      |

Do not chase volume. A test is worth adding when breaking the behavior by hand makes it fail. Do not add export-only or snapshot-of-everything tests; `check:unit-test-quality` exists to stop them.

**Manifest.** Each audited page ends with a `definePageCoverage` manifest listing its sections with a decision each (`spec`, `unit`, `manual`, `na` with reason), so `check:test-coverage` holds the line after the audit.

## Coverage model

Coverage is counted on inventories, each with a denominator that comes from the code or the docs, not from memory.

| #   | Inventory                 | Denominator source                                                                 | Covered when                                                                      |
| --- | ------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| K1  | Routes                    | `route-inventory` output                                                           | Ledger row is `signed-off` or `waived`                                            |
| K2  | Elements per page         | Page record inventory, with the Stage 2c completeness counts                       | Every row has a verdict                                                           |
| K3  | Lenses per page           | 24 lenses × applicability table                                                    | Every applicable lens has a verdict                                               |
| K4  | Personas per page         | Persona table × who can reach or must be denied                                    | Each exercised or `N/A`                                                           |
| K5  | Connections               | C01 to C36 plus those added during audits                                          | Each reader checked from each source                                              |
| K6  | Journeys                  | J01 to J30                                                                         | Each run on Free and Business, happy and unhappy                                  |
| K7  | Edge functions            | `ls supabase/functions` (366 directories today)                                    | Claimed by a page, journey or cross-cutting record, or filed as an orphan finding |
| K8  | Crons and webhooks        | Function list + `jobsRegistry.ts`                                                  | Triggered manually on L and effect verified                                       |
| K9  | Emails and PDFs           | `_shared/email-templates/**`, per-property templates, PDF templates in both copies | Rendered with real data and checked                                               |
| K10 | Plan feature keys         | `PlanFeatureKey`                                                                   | Allowed and blocked observed on a page, and server-enforced                       |
| K11 | Permission leaves         | Property, org and parking catalogs                                                 | Granted and denied observed, and server-enforced                                  |
| K12 | Feature-availability keys | Super-admin catalog                                                                | On and off observed on each surface                                               |
| K13 | Guide sections            | `##` headings in `docs/guides/routes/**`                                           | Each confirmed true, corrected, or removed                                        |
| K14 | `for-testing/` plans      | 32 files                                                                           | Checklist run inside a page audit; plan moved or findings filed                   |
| K15 | Storage buckets           | Migrations and `docs/architecture/storage.md`                                      | Access policy probed as anon, stranger and owner                                  |

Verdict vocabulary everywhere: `pass` · `fail` · `blocked` · `N/A — <why>` · `not run`. Never report a gate that was not run.

**Honest math.** The report always shows four numbers per inventory: total, verdicts recorded, `pass`, and `blocked`. "100% covered" means verdicts recorded equals total. It is reported separately from "100% passing". `blocked` rows are listed by what would unblock them, because they are the real remaining risk.

## Coverage report

`coverage-report.md` is regenerated at the end of each wave from the ledger and the page records. Sections:

1. **Headline**: baseline SHA, date, rows by status, findings by severity and status, P0 and P1 still open.
2. **Inventory table**: K1 to K15 with total, verdicts, pass, fail, blocked, N/A, not run.
3. **Page matrix**: one row per route, one column per lens, cell = verdict letter. This is the at-a-glance proof of what was reviewed.
4. **Persona and tier matrix**: page × persona, page × tier.
5. **Connection matrix**: C-row × reader, cell = verdict.
6. **Blocked list**: grouped by unblocker (operator credential, real device, owner decision, test-tenant design).
7. **Systemic findings**: root causes seen on three or more pages.
8. **Test and doc deltas**: tests added per layer, guides corrected, manifests adopted (n of 107), `for-testing` plans closed.
9. **Not covered and why**: anything waived, with the owner decision.

## Status values in the ledger

`todo` → `in-audit` → `audited` → `in-fix` → `re-verify` → `signed-off`, or `waived`.

## Definition of done

**A page is `audited` when:**

- [ ] The inventory completeness counts match (snapshot nodes mapped, source handlers mapped).
- [ ] Every element row has a verdict from Stages 3 and 4.
- [ ] Every applicable lens has a verdict.
- [ ] Every persona that can reach or must be denied the page was exercised.
- [ ] 375, 768 and 1440 were checked; WebKit where required.
- [ ] Three hats written.
- [ ] Findings filed; P0 reported immediately.
- [ ] Guide corrected; tests and manifest added for verified behavior; gates run.
- [ ] Ledger row filled.

**A page is `signed-off` when:**

- [ ] No open P0 or P1 on it. P2 and P3 are fixed or triaged with a decision.
- [ ] Every fixed finding was re-verified by its original steps.
- [ ] The drift check against the audit SHA is clean or the changed rows were re-run.
- [ ] Remaining `blocked` rows have an owner and are on the blocked list.

**The plan is done when:**

- [ ] K1 to K15 show verdicts recorded = total.
- [ ] Every ledger row is `signed-off` or `waived` by the owner.
- [ ] The orphan sweep is complete.
- [ ] The production pass ran after the final deploy.
- [ ] The coverage report is published and linked from production-readiness.

## Parallel work rules

- Claim a ledger row before starting; one claimant per row.
- Never edit another session's page record. Add a cross-reference in your own.
- `findings.md` and `ledger.md` are append-mostly; keep edits to your own rows to avoid merge conflicts.
- Use a worktree per parallel session, and a separate local Supabase is not available per worktree, so destructive audits (anything that needs `db:reset` or a plan switch) run one at a time. Note the plan tier and seed state you leave behind.
