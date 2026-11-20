---
stage: planned
title: 'Production readiness refinement: verify, rank and make agent-ready'
status: planned
tags: [planning, production-readiness, triage, risk, agents]
updated: 2026-11-20
kind: plan
---

# Production readiness refinement

Goal: turn `docs/workflow/in-progress/production-readiness/` (about 200 files, 19.7k lines) from an audit log into a ranked, verified work queue that an AI agent can pick up one item at a time, knowing the priority, the risk, the UI it touches and the edge cases to cover.

This plan changes **docs only**. No code, no hosted writes, no `kamewave` needed.

## What the audit found

The folder was last fully refreshed on 2026-11-06 (baseline SHA `96eb9334`, 2026-11-01). About **685 commits** have landed since, including plans/billing hardening (#513), two-way calendar sync (#493), host parking pricing (#533), booking chat, mobile search and bootstrap perf. Evidence of drift:

| Problem                               | Evidence                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry points disagree                 | `README.md` says baseline `96eb9334` and tag counts "17 ✅ · 36 🟡"; `STATUS.md` is dated 2026-11-02 with different gate verdicts; `LEDGER.md` says "Baseline SHA: not set"                                                                                                                                                                                       |
| Closed items still listed as blockers | `TO-FIX.md` Blockers still shows PR-130 as 🔴 (closed 2026-11-01), PR-131 and the "Still open: #153" table (#153 merged 2026-11-03)                                                                                                                                                                                                                               |
| Frontmatter not trustworthy           | 106 of 135 files `readiness: unverified`; 95 have `last_verified: none`; 117 share `updated: 2026-11-06` (a bulk touch, not a review)                                                                                                                                                                                                                             |
| Module cards are mostly empty         | 57 cards, 40 say "None yet", 14 have any checked criterion. All 16 criteria are identical boilerplate, so a card does not say what is risky in that module                                                                                                                                                                                                        |
| Stale GitHub issues                   | 12 `production-readiness` issues (#160 to #183) all opened 2026-10-19, none updated                                                                                                                                                                                                                                                                               |
| Facts that need re-checking           | CSP is still `Report-Only` in `vercel.json` despite #176 "make CSP enforceable"; 9 marketing specs still `test.fixme` (PR-133); `zod` 3.x still pinned (PR-141); two lockfiles still tracked (PR-142); `quill` no longer in `ui/package.json` (PR-141 partly resolved)                                                                                            |
| New surface has no card               | Multi-channel calendar sync, plan/billing lifecycle, parking guest fee and booking chat shipped after the cards were written. Parking money, sync and billing now overlap with `planned/` and `in-progress/` docs (`parking-module-hardening`, `plans-billing-lifecycle-hardening`, `supabase-capacity-and-operational-readiness`, `production-error-escalation`) |
| No machine-readable priority          | Ledger has `Sev` (blocker/high/medium/low) but nothing for UI impact, security class, money, data risk, or how an agent should proceed                                                                                                                                                                                                                            |

Verified as still accurate: GitHub Actions are pinned to SHAs (PR-127), PR-001/002/003/030 remain operator-blocked in `STATUS.md`.

## Phase 0: freeze a new baseline

1. Record today's `develop` and `main` SHAs, `CD Dev` and `CI` state, hosted migration count (501 local files, 375 functions) as the **new baseline** in `STATUS.md` frontmatter and the ledger header.
2. Make `STATUS.md` the single dashboard. `README.md` keeps only the map and tag legend and links to `STATUS.md` for numbers. Remove duplicated counts and the gate table from `README.md`.
3. Fix `TO-FIX.md` and `ALL-GOOD.md` to be **generated views of the ledger**, not hand-edited copies. Add a small script (extend `scripts/dev/readiness-open-items.mjs`) that regenerates them and the tag counts from `LEDGER.md`, so the numbers cannot drift again.

Verification: `README`, `STATUS`, `LEDGER` and generated lists show the same SHA and the same tag counts.

## Phase 1: re-verify every ledger row (145 rows)

Triage each row into exactly one outcome, using code and git first, hosted probes only when read-only:

| Outcome                        | Action                                                |
| ------------------------------ | ----------------------------------------------------- |
| Already fixed                  | Flip to ✅, link the PR or commit, move to `ALL-GOOD` |
| Still open                     | Keep, fill the new fields below                       |
| Superseded                     | Point to the newer plan doc, mark ⏸️ or close         |
| Cannot verify without operator | Keep ⛔ with the exact missing input                  |

Order of checking (highest cost of being wrong first): Gate C money, Gate B security, Gate F operations, Gate D AI, Gate E comms, Gate A, Gate G. Spot checks use `grep`, `git log -S`, `bun run check:*` and read-only `get-health` style probes. Hosted writes stay behind `kamewave`.

Also reconcile the 12 GitHub issues (#160 to #183) against the ledger: close, update or relink each.

## Phase 2: the ranking model

Add these columns to every ledger row. Priority is computed, not guessed.

**Severity score (0 to 3 each, summed, plus a launch-gate weight)**

| Factor                   | 0                 | 3                                                     |
| ------------------------ | ----------------- | ----------------------------------------------------- |
| Security exposure        | none              | cross-tenant, auth bypass, PII or secret leak         |
| Money / data integrity   | none              | false-paid, double charge, lost or corrupted bookings |
| Blast radius             | one admin         | every guest or every tenant                           |
| Likelihood at launch     | edge case         | hits on day one                                       |
| Reversibility (inverted) | trivial to revert | data or external side effect cannot be undone         |

**Priority bands**

| Band              | Rule                                      | Meaning                        |
| ----------------- | ----------------------------------------- | ------------------------------ |
| P0 launch blocker | security or money 3, or Gate A to C fails | Fix before any go decision     |
| P1 pre-launch     | score 8+ or Gate B/D/F required           | Fix before go, may be parallel |
| P2 first week     | score 4 to 7                              | Scheduled right after launch   |
| P3 backlog        | score under 4                             | Tracked, not scheduled         |

Overrides: an item that needs an operator or decision keeps its band but gets `blocked_by` so agents never start it.

**New fields per row**

| Field                 | Values                                                          | Why agents need it                                         |
| --------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| `band`                | P0 to P3                                                        | Order of work                                              |
| `risk_class`          | security / money / data / availability / ux / perf / compliance | Picks the review checklist                                 |
| `ui_impact`           | none / copy / layout / flow / new-ui                            | Triggers `mobile-responsive`, `route-guides`, `human-copy` |
| `routes_affected`     | route paths or `-`                                              | Tells the agent which `docs/guides/routes/*.md` to update  |
| `user_visible_change` | yes / no                                                        | Triggers `support-content`                                 |
| `touches`             | edge fn, migration, RLS, cron, env, third party                 | Triggers migration, deploy and secret rules                |
| `needs_unlock`        | none / kamewave / localstop / operator                          | Hard stop rules                                            |
| `blocked_by`          | row id, operator input or decision                              | Prevents wasted sessions                                   |
| `verify`              | exact command or probe that proves done                         | Done is checkable                                          |
| `edge_cases`          | 3 to 6 bullets                                                  | What the agent must not break                              |
| `agent_size`          | S (one session) / M (split) / L (needs a plan first)            | One task = one session                                     |

Security items additionally carry the OWASP/ASVS/LLM reference from `security/` so `owasp-top10-2025.md`, `api-top10-2023.md`, `asvs-l2.md` and `llm-top10-2025.md` link back to row ids.

## Phase 3: refine each folder

| Folder                                                                             | Refinement                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root (`README`, `STATUS`, `LEDGER`, `TO-FIX`, `ALL-GOOD`, `HANDOFF`, launch audit) | Phase 0 and 2. `HANDOFF.md` is a 2026-10-20 snapshot: mark it historical and keep only the "resume" guidance. Launch audit plan gets a "what actually happened" pointer instead of future-tense phases                                                                                                                                                                                                                                             |
| `checklist/` (00 to 38)                                                            | One status line per file: done / partial / open, with the ledger rows it owns. Delete stale "TODO" boxes that are shipped. Re-baseline numeric budgets (bundle 4.2 MiB vs 4.9 MiB, Lighthouse, pg_stat) in `00-baseline-and-budgets.md`. `baselines/*.json` stay as dated evidence, flagged historical                                                                                                                                             |
| `audits/` (11)                                                                     | Each audit gets a header block: scope, date, which ledger rows came from it, what is superseded. Merge duplicated findings (cost-abuse, hardening and remediation overlap) by pointing at the ledger instead of restating                                                                                                                                                                                                                          |
| `modules/` (57 cards)                                                              | Replace the identical 16-box boilerplate with a **risk card**: top 3 risks, UI surfaces and routes, roles and plans involved, money or PII flag, edge cases, linked ledger rows, last verified SHA. Keep the 16 criteria as a collapsed checklist. Add cards for multi-channel calendar sync, plans/billing lifecycle, parking guest fee and booking chat. Update `ROUTE-COVERAGE` and `EDGE-COVERAGE` against current `routes/` and 375 functions |
| `security/`                                                                        | Convert each OWASP/ASVS row to `pass / fail / open / N/A` with a ledger id and evidence link. Fill the BOPLA, SSRF and pentest gaps as explicit rows rather than prose                                                                                                                                                                                                                                                                             |
| `environments/`                                                                    | Re-run `readiness-env-matrix --check`; note that hosted `fwor…` is production and that `kamespace.com` and `dev.kamehomes.space` share it                                                                                                                                                                                                                                                                                                          |
| `operator/`                                                                        | One table: input needed, who, which row it unblocks, by when. This is the list the owner acts on                                                                                                                                                                                                                                                                                                                                                   |
| `qa/`                                                                              | `MODULE-DISPOSITION` and `QA-BATCH` get a dated reconciliation against the cards                                                                                                                                                                                                                                                                                                                                                                   |
| `evidence/`                                                                        | No rewriting. Add an index with date, SHA and which rows each file supports. Mark files older than the new baseline as historical                                                                                                                                                                                                                                                                                                                  |

## Phase 4: agent work cards

For every P0 and P1 row that is not blocked, add a short **work card** (`work/PR-xxx.md`, or a section in the row) that an agent can run without re-deriving context:

```
Goal          one sentence outcome
Band / risk   P1 · security
Read first    exact docs and rules to load (booking-workflow.mdc, admin-auth.mdc ...)
Change scope  files or areas to touch, and what must NOT change
UI affected   routes, breakpoints 375/768/1024, copy, empty/error states
Edge cases    list, each with how to test it
Gates         ci:quality subsets, check:* scripts, E2E spec to add or extend
Docs          route guide, support-content, plans/RBAC, activity-log or N/A
Unlock        none | kamewave | operator input
Done when     verify command passes + evidence file
```

Rules baked into the card template: no hosted writes without `kamewave`, no editing shipped migrations, side effects only through `workflowOrchestrator`, RLS is not the access layer so server checks must be tested, and every UI change names its mobile behavior.

## Phase 5: execution order (proposed)

Waves group items by dependency, not just band. Items inside a wave can run as separate sessions.

| Wave                   | Contents                                                                                                                                                                                                        | Why first                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 0                      | Phase 0 to 3 of this plan                                                                                                                                                                                       | Without a trusted queue nothing else is safe to automate |
| 1 Money and tenancy    | Gate C: parking refund path (PR-031), double-booking constraint decision (PR-032), PayMongo sandbox run (PR-030), idempotency and webhook dedupe (#163), plans/billing re-verify                                | Highest cost of error and hardest to reverse             |
| 2 Security             | CSP enforce decision (PR-012), prod captcha (PR-001/002), BOPLA and SSRF probes, team invite parity (#162), prompt-injection suite (#161), guest-chat bucket (PR-120), `zod` 4 and lockfile policy (PR-141/142) | Security class items with agent-testable proof           |
| 3 Operations           | `DEV_DB_URL` secrets (PR-025), alerts and on-call (PR-027, plan `production-error-escalation`), cron heartbeat, retention and data export (PR-145, RA 10173)                                                    | Needed to survive an incident                            |
| 4 Performance and UX   | #183 caching decision and re-test, LCP and CLS items, bundle budget decision (PR-134), 9 `test.fixme` marketing specs (PR-133)                                                                                  | Visible UI changes are batched so mobile QA runs once    |
| 5 Operator and cutover | DMARC, Meta live, Maps key referrers, Vercel production branch, final go/no-go                                                                                                                                  | Needs the owner, not an agent                            |

Decisions only the owner can make are listed once, at the top of `TO-FIX.md`, each with a recommended option so sessions can start right after.

## Phase 6: close-out

1. Regenerate `TO-FIX.md`, `ALL-GOOD.md` and the gate scoreboard from the ledger.
2. Run `bun run check:filenames`, `format:check`, and the existing readiness scripts (`readiness-env-matrix --check`, `readiness-open-items`).
3. Update `docs/workflow/README.md` and this folder's `README.md` index. Doc-only, so `activity-log: N/A`, `Plans/RBAC: N/A`, no route guide or support-content change.

## Done when

- One baseline SHA appears identically in `README`, `STATUS` and `LEDGER`.
- Every ledger row has band, risk class, UI impact, unlock and a `verify` line, or is closed with a link.
- Every P0 and P1 unblocked row has a work card.
- No row in `TO-FIX.md` is closed in the ledger, and counts are generated.
- Module cards list top risks, not only boilerplate checkboxes.

## Not in scope

Fixing any item, running hosted probes that write, touching production, or deciding the open product questions (CSP, refunds, payout scale, caching). This plan only prepares the queue.

## Effort and sessions

Roughly one session per phase; Phase 1 splits into one session per gate (7) because verification needs real code reading. Run on `/effort medium` except the Gate B and C triage, which warrants high effort. No subagent swarms by default; an `Explore` agent per gate is acceptable if Phase 1 runs long.
