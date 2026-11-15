---
title: 'Page audit: <route>'
status: active
stage: qa
kind: reference
tags: [qa, full-app, <area>]
updated: <YYYY-MM-DD>
---

<!-- Copy to docs/workflow/qa/full-app/pages/<guide-path>.md. Fill every cell. Use "N/A — <why>", never leave blank. -->

# Page audit: `<route>`

| Field                    | Value                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| Ledger ID                | `<AREA-nn>`                                                                 |
| Route(s)                 |                                                                             |
| Archetype                | R / S / P / G / DR / DW / WF / SA / X                                       |
| Guide                    | `docs/guides/routes/…`                                                      |
| Module file              | `modules/…`                                                                 |
| Audit SHA                | (baseline? yes / no, commits since baseline touching this page: …)          |
| Environment(s)           | L / B / V / P                                                               |
| Auditor, date            |                                                                             |
| Seed and plan state used |                                                                             |
| Page source files        | (route element, page, sections, hooks, lib; used later for the drift check) |

## 1. Expected behavior (Stage 1)

| #   | Statement | Source (guide § / faq / plan / rule / test) |
| --- | --------- | ------------------------------------------- |
| X1  |           |                                             |

References read: guide ☐ · faqs ☐ · manual guide ☐ · plans (`for-testing`, `in-progress`, `done`) ☐ · readiness card ☐ · earlier QA ☐ · architecture and rules ☐ · vault backlinks ☐ · existing tests ☐ · Sentry and logs ☐

`for-testing` checklists absorbed: (plan → result)

## 2. State matrix (Stage 2a)

| State | Persona | Tier | Viewports captured | Snapshot / screenshot path |
| ----- | ------- | ---- | ------------------ | -------------------------- |
|       |         |      | 375 · 768 · 1440   |                            |

## 3. Element inventory (Stage 2c)

Completeness: interactive nodes in snapshots **n** / mapped **n** · handlers and network calls in source **n** / mapped **n**

| ID           | Element (where) | Trigger | Expected (source) | Chain: fn → tables → side effects | Connected surfaces (C#, routes) | Gates (plan / leaf / availability) | Existing test | Guide § | Exercise (Stage 3) | Trace (Stage 4) | Verdict | Finding |
| ------------ | --------------- | ------- | ----------------- | --------------------------------- | ------------------------------- | ---------------------------------- | ------------- | ------- | ------------------ | --------------- | ------- | ------- |
| `<PAGE>.E01` |                 |         |                   |                                   |                                 |                                    |               |         |                    |                 |         |         |

Reconciliation findings (source-only, render-only, guide-only, page-only, orphan functions):

## 4. Edge functions and hidden surfaces touched

| Function / cron / webhook / template / bucket | Auth tier | Leaf | Plan gate | Validation | Writes | Side effects | `activity_log` event | Denied as (persona → status) |
| --------------------------------------------- | --------- | ---- | --------- | ---------- | ------ | ------------ | -------------------- | ---------------------------- |
|                                               |           |      |           |            |        |              |                      |                              |

## 5. Page-level states (Stage 3)

| State                          | Verdict | Notes |
| ------------------------------ | ------- | ----- |
| Loading skeleton               |         |       |
| Empty                          |         |       |
| Error + retry                  |         |       |
| Offline                        |         |       |
| Session expired                |         |       |
| Not found / bad ID             |         |       |
| Wrong tenant                   |         |       |
| Slow network                   |         |       |
| Maintenance / availability off |         |       |

## 6. Access matrix

| Persona | Nav item | Direct URL | Reads | Writes (UI) | Writes (server replay) | Verdict |
| ------- | -------- | ---------- | ----- | ----------- | ---------------------- | ------- |
|         |          |            |       |             |                        |         |

| Tier | Gated elements | UI behavior | Server behavior | Verdict |
| ---- | -------------- | ----------- | --------------- | ------- |
|      |                |             |                 |         |

## 7. Lens verdicts (Stage 5)

| Lens                     | Verdict | Findings / notes |
| ------------------------ | ------- | ---------------- |
| F01 Function             |         |                  |
| F02 Chain                |         |                  |
| F03 Navigation           |         |                  |
| F04 Forms                |         |                  |
| F05 States               |         |                  |
| F06 Roles                |         |                  |
| F07 Plan gates           |         |                  |
| F08 Tenancy              |         |                  |
| F09 Auth                 |         |                  |
| F10 Mobile               |         |                  |
| F11 Visual               |         |                  |
| F12 UX                   |         |                  |
| F13 Copy                 |         |                  |
| F14 Accessibility        |         |                  |
| F15 Performance          |         |                  |
| F16 Data integrity       |         |                  |
| F17 Security             |         |                  |
| F18 Audit, observability |         |                  |
| F19 Code                 |         |                  |
| F20 Tests                |         |                  |
| F21 Docs                 |         |                  |
| F22 Integrations         |         |                  |
| F23 SEO                  |         |                  |
| F24 PWA                  |         |                  |

## 8. Three hats

### User

Per persona: top jobs, taps and time to finish, hesitations, missing, unnecessary, trust concerns.

**Keep / change / remove / redesign:**

### Tester

Assumptions attacked and what happened.

### Developer

Code, architecture, duplication, test quality (which three behaviors were broken by hand, and did a test fail?).

## 9. Findings

Detail blocks for each finding filed in `findings.md` (ID, severity, steps, expected vs actual, evidence, suspected cause, proposed fix, confidence).

## 10. Observations (not findings)

## 11. Backfill done in this change

| Kind                 | File | What |
| -------------------- | ---- | ---- |
| Guide                |      |      |
| FAQ / Host knowledge |      |      |
| Test                 |      |      |
| Manifest             |      |      |
| Seed                 |      |      |

Gates run: (command → `pass` / `fail` / `not run`)

## 12. Production writes (only if P was used)

| What changed | Restored? |
| ------------ | --------- |
|              |           |

## 13. Totals for the ledger

Elements: total · pass · fail · blocked · N/A — Lenses: pass · fail · blocked · N/A — Findings: P0 · P1 · P2 · P3 — Blocked by: …
