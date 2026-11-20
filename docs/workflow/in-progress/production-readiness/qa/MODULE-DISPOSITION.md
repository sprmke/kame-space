---
title: 'Module status disposition'
status: active
tags: [workflow, in-progress, modules, status]
updated: 2026-11-21
stage: in-progress
kind: reference
origin_stage: in-progress
readiness: unverified
launch_gate: A
launch_blocker: tbd
last_verified: '9b3f3719f 2026-11-21'
---

# Module status disposition

One page answering **what is done, what is in progress, what is waiting on QA, and what is
still planned**. Verified against `develop` at `9b3f3719f` on 2026-11-21.

Stage counts at that commit: **129 done · 41 for testing · 28 in progress · 19 planned · 5 intake · 8 won't do**.
Full narrative per stage: [`../../README.md`](../../README.md). Branch audit record:
[`../../archive/operations/branch-cleanup-audit.md`](../../archive/operations/branch-cleanup-audit.md).

---

## Done — shipped and closed

The full list is [`../../done/README.md`](../../done/README.md) (129 plans). Recent closures worth
knowing when reading the open board:

| Module                                          | Closed because                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Booking workflow, guest form, calendar, SD form | Core loop shipped; remaining guest-form recovery work is a separate planned doc |
| Org / property / parking multi-tenancy          | Shipped; parking hardening continues separately                                 |
| Plans, billing and PayMongo lifecycle           | `plans-billing-lifecycle-hardening` closed 2026-11-18 (#513, #519)              |
| Super admin console                             | Phases 0–7 closed; follow-ups are in `planned/super-admin-console-followups.md` |
| SEO and AI search visibility                    | Shipped 2026-11-12, crawler audit clean                                         |
| Observability (Sentry + PostHog split)          | Closed 2026-11-04                                                               |
| Modern web guidance adoption                    | Closed 2026-11-19                                                               |
| Feature availability controls (the plan)        | Closed; only its manual QA companion remains in `for-testing/`                  |

---

## For testing now — implementation complete, QA only

Batch order: [`QA-BATCH.md`](./QA-BATCH.md). A module leaves this stage only when its checklist
passes; a failure moves it back to `in-progress/`.

| Module                                          | Remaining verification                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Superhost program                               | QA batch #1                                                                    |
| Onboarding verification simplify                | QA batch #2                                                                    |
| Host verification tiers                         | QA batch #3 (search boost deferred)                                            |
| CAPTCHA and anti-spam                           | QA batch #4 (needs Turnstile keys)                                             |
| PWA install / offline / push                    | QA batch #5 (needs deploy config)                                              |
| Org granular team permissions                   | QA batch #6                                                                    |
| Super Admin step-up OTP                         | QA batch #7                                                                    |
| Org Activity and Audit Log                      | QA batch #8 + production migration deploy                                      |
| Cost / abuse / security                         | Operator P0 + V-1–V-5                                                          |
| Production readiness remediation                | Operator P0 + V-1–V-5                                                          |
| Host-set parking pricing                        | Public card rate + fee, direct-link comparison, refund snapshot math           |
| Property templates and defaults overhaul        | Verification matrix in the plan                                                |
| Multi-channel calendar sync (live verification) | Real Agoda and Booking.com feeds, hosted rollout, 7-day soak                   |
| Support content and FAQ sync                    | `check:support-content`, live FAQ sync, Help Center click-through              |
| Smart Pricing (Pro+)                            | Pro-account walkthrough, below-Pro gate, downgrade, staging cron               |
| Host analytics                                  | Signed-in UI walkthrough (Deno tests still absent in this environment)         |
| Parking ↔ property parity                       | Contact host thread, guest Stays, archive/restore, blocks, email toggles, KPIs |
| Org portfolio analytics                         | Signed-in org walkthrough                                                      |
| Property settings copy                          | Multi-property dry run, copy, history row                                      |
| Mobile-native redesign                          | Signed-in device walkthrough                                                   |
| Public pages native density                     | Real iPhone/Android safe-area check                                            |
| Two-way reviews                                 | Submit both sides, visibility, moderation                                      |
| Verification scope split                        | 10-item manual QA checklist                                                    |
| Help and Support Center                         | Live click-through at org/property/parking and `/admin/support`                |
| Chat templates                                  | Live thread on web, Meta flattening, assistant rewrite                         |
| Booking detail activity log                     | QA batch #8                                                                    |
| Activity modal UI polish                        | Manage modal on each scope with a large log                                    |
| Listing contract renewal modal                  | 6-item manual checklist                                                        |
| Host tour film                                  | Watch-through pass                                                             |
| Marketing AI video / image quality              | Paid live render once Veo billing is enabled                                   |
| Marketing Studio polish set                     | Plan-specific QA (collage, library, sessions, planner, trends)                 |
| AI companion response quality                   | Live screenshot walkthrough                                                    |
| Legal and privacy coverage                      | 375 / 768 / 1280 pass; lawyer review open                                      |

---

## In progress — real code remains

| Module                                           | Verdict                                                  | Remaining work                                                                                             | Next action                         |
| ------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Multi-channel calendar sync                      | Released dark 2026-11-19 (#493 via #524)                 | Phase 0 needs real Agoda + Booking.com listings; Phase 1b relay/echo waits on the conflict plan            | Host supplies the two listings      |
| Guest Inbox Meta sync                            | Phase 1 of 8 shipped (data loss and token leak closed)   | Durable outbox, server-owned import and reconcile, realtime, messaging parity, observability, cleanup      | Phases 2–8                          |
| Parking module hardening                         | Money path, claim race, RBAC and type gate shipped       | Lifecycle edges, host/guest UX coverage, Deno and Playwright suites                                        | Continue after Inbox                |
| App speed overhaul                               | Phase 0 shipped (boot marks, `Server-Timing`)            | Phases 1–10 need a hosted run, a Supabase token or a deploy                                                | Hosted measurement session          |
| Full-app test architecture                       | Phase 0 shipped (`@ci` lane, lane-tag guards, Manila TZ) | Phases 1–9                                                                                                 | Continue                            |
| Dashboard contextual help                        | P0–P1 shipped                                            | P2–P10: Smart Pricing, channel sync, notifications, templates, support, marketing, inbox, settings sweep   | Continue by module                  |
| Cancellation policy                              | Phases 1–7 shipped                                       | Bookings-list filter, finance refund outflows, analytics split, Playwright cancel specs                    | Follow-ups, not blockers            |
| Host onboarding setup guide                      | Reward reminder and unlock emails unimplemented          | Those two emails                                                                                           | Continue                            |
| Property archive and delete lifecycle            | P0 hotfix shipped                                        | Reason column, lifecycle service, automation matrix, host UI, guest closed screen, billing, parking parity | P1–P7                               |
| Mobile app chrome header and tab bar             | Phase 1 and public back control shipped                  | Admin tab set, large-title header, cleanup                                                                 | Coordinate with the v3 PR           |
| Notifications page restructure                   | Hub shell with Activity/Telegram tabs shipped            | Three-tab frame with `push`, bounded pager, unread filter, Telegram overview                               | Ship then QA                        |
| Settings cleanup and clarity                     | Phases 1–5 shipped                                       | Phase 6 schema contract drop                                                                               | One release soak, then `kamewave`   |
| Telegram delivery and history                    | Code, tests and docs complete                            | Migration `20261320000000` not applied                                                                     | `kamewave` deploy                   |
| Google services production hardening             | Billing and Maps spend controls done                     | Gemini paid tier, Fonts, System Health probe, legacy project retirement                                    | Continue                            |
| Supabase capacity and operational readiness      | First slice shipped                                      | Compute upgrade, alerts, large-tenant seed, load tests, public cache, aggregates                           | Continue                            |
| Live identity verification                       | Build phases started                                     | Guided capture, QR handoff, PhilSys QR / MRZ, liveness verdict                                             | Continue                            |
| Local seed dataset                               | Seeding and route walk shipped                           | Manual host QA                                                                                             | QA                                  |
| Marketing themes                                 | Theme library, switcher, engine shipped                  | AI theme creation, Storage thumbnails                                                                      | Continue                            |
| Marketing AI poster studio                       | Generate tab mode shipped locally                        | Blind eval, brand kit, photo enhance, server render                                                        | Continue                            |
| Marketing video editor multitrack                | Partially shipped                                        | T1.10, T1.11, T1.13, T2.7                                                                                  | Continue                            |
| Marketing Studio mobile and dashboard responsive | Shell verified                                           | Touch range select, phases 4–6                                                                             | Continue                            |
| Weekly ops report                                | List, detail, generate, email, Monday cron shipped       | Collector, hosted load matrix, public cache, PostHog and Vercel adapters                                   | Continue                            |
| Super admin system health                        | Daily cron, diff email, Meta token warning, costs mount  | Remaining health probes                                                                                    | Continue                            |
| Guest trip hub                                   | Trip page and entry points shipped                       | Manual QA, host copy-link follow-up                                                                        | QA                                  |
| Activity log follow-ups                          | RBAC leaves and cron rows shipped                        | Export leaves, notice emitters, ticket handlers, partitioning                                              | None block the feature              |
| Agentic AI assistants                            | Phases 0–5 largely shipped                               | Voice tool parity, multi-card replies, guard coverage, one provider error                                  | Continue                            |
| AI Studio sample assets                          | Blocked on a paid Gemini/Veo key                         | Nothing until billing is enabled                                                                           | Operator                            |
| Booking chat deep link                           | Code complete; docs PR #531 open                         | Merge the plan move, then close                                                                            | Merge #531                          |
| Production readiness umbrella                    | 4 green remediation PRs open (#544, #553, #555, #556)    | Operator gates and these merges                                                                            | Merge, then re-baseline `STATUS.md` |

---

## Planned — approved, not started

[`../../planned/README.md`](../../planned/README.md) (19 plans), including calendar-conflict
resolution, guest form saved progress, guest trust and safety, dashboard mobile v2,
production error escalation, multi-residence config decoupling, service cost monitoring,
AI credits top-up and the performance remediation audit.

**Exception:** `multi-residence-config-decoupling` also exists as draft PR
[#354](https://github.com/sprmke/kame-space/pull/354), explicitly **DO NOT MERGE** until the
owner clears it.

---

## Open PR queue (verified 2026-11-21)

### Ready to merge (green, mergeable)

| PR                                                    | Title                                                            | Notes                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| [#556](https://github.com/sprmke/kame-space/pull/556) | Purge guest documents on property and org deletion               | Closes PR-016; all checks green                                       |
| [#555](https://github.com/sprmke/kame-space/pull/555) | Close the sign-out cache leak and expand injection tests         | Closes PR-015 and PR-013; green                                       |
| [#553](https://github.com/sprmke/kame-space/pull/553) | Money, webhook, alerting and privacy readiness items             | Closes PR-032 and related; green                                      |
| [#544](https://github.com/sprmke/kame-space/pull/544) | Enforce CSP and harden captcha and AI spend                      | Closes PR-012, PR-001/002, PR-006; green                              |
| [#557](https://github.com/sprmke/kame-space/pull/557) | Kame mascot poses across guest empties and host CTAs             | Green except two e2e shards still running                             |
| [#531](https://github.com/sprmke/kame-space/pull/531) | Close the booking chat deep link plan                            | Docs-only; behind `develop`, safe to merge                            |
| [#529](https://github.com/sprmke/kame-space/pull/529) | Record the calendar sync cron and live DB checks                 | Docs-only; behind `develop`, safe to merge                            |
| [#535](https://github.com/sprmke/kame-space/pull/535) | Cover host-set parking rate cards and the direct link comparison | Tests-only; conflict resolved 2026-11-21 (`534f6f2e1`), now mergeable |

### Conflicting — needs a deliberate conflict pass

| PR                                                    | Conflicts                                                                                                                                   | Scope                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [#554](https://github.com/sprmke/kame-space/pull/554) | 10 files: 2 route guides, 2 workflow READMEs, `AdminLayout.tsx`, `adminBottomNav.ts` + test, finance/maintenance/pricing stat cards         | Large mobile v3 shell; UI must be re-verified at 375/768/1024 |
| [#488](https://github.com/sprmke/kame-space/pull/488) | 14 files: docs (`feature-availability`, help-support, settings, workflow QA), `textarea.tsx`, auth components, `marketingPosterDirector.ts` | Large Marketing AI Studio overhaul; needs a real review pass  |

### Parked or intentionally blocked

| PR                                                    | State                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| [#495](https://github.com/sprmke/kame-space/pull/495) | Draft landing redesign, based on #488; design not approved                      |
| [#354](https://github.com/sprmke/kame-space/pull/354) | Draft multi-residence foundation, **DO NOT MERGE**                              |
| [#353](https://github.com/sprmke/kame-space/pull/353) | Draft talking-mascot prototype, no app routes                                   |
| #503–#512                                             | 10 Dependabot bumps into `main`; decide bump by bump, not with the feature work |

---

## Branch hygiene (2026-11-21 pass)

Deleted, local and remote (fully merged or fully applied, no worktree):

`release/2026-11-19-host-parking-pricing`, `release/2026-11-19-multi-channel-calendar-sync`,
`release/2026-11-19-ui-improvements`, `sprmke/flyingfish`, `sprmke/audit-modules-worktrees-prs`,
`docs/calendar-sync-release-record`, `chore/parking-pricing-test-followups`,
`fix/preview-existing-worktrees` (remote), `sprmke/analyze-editable-public-pages` (remote).
Tip SHAs are recorded in the branch audit.

Kept on purpose:

| Branch                                                                | Why                                    |
| --------------------------------------------------------------------- | -------------------------------------- |
| `feat/multi-channel-calendar-sync`                                    | Tip carries the docs in open PR #529   |
| `feat/host-set-parking-pricing`                                       | Tip carries the tests in open PR #535  |
| `test/host-set-parking-pricing-coverage`                              | PR #535 is conflicting, not merged     |
| `docs/calendar-sync-live-verification-db-checks`                      | PR #529 is open                        |
| `sprmke/desktop-screens-mobile-redesign`                              | PR #554 is open and conflicting        |
| `feat/marketing-ai-studio-overhaul`                                   | PR #488 is open and conflicting        |
| `feat/multi-residence-config-decoupling`                              | PR #354 is a draft marked DO NOT MERGE |
| `codex/mascot-talking-preview`                                        | PR #353 is a draft prototype           |
| `backup/`, `recover/` snapshots                                       | Safety snapshots, not work branches    |
| `release/2026-11-19-prod-ship`, `sprmke/refine-payment-plans-billing` | Worktrees hold uncommitted edits       |

Worktrees on merged branches still exist (`arowana`, `bass`, `coelacanth`, `cutlassfish`,
`dulse`, `sculpin`, `anemone`). Removing a worktree closes an Orca workspace, so it is left
to the owner's call.

---

## Decisions needed from the owner

1. Merge the seven ready PRs above (all green) or hold any of them.
2. Approve a conflict pass on #535 (tests only) and #554 (mobile v3, needs UI re-verification).
3. Decide #488 (Marketing AI Studio overhaul): revive, split, or close.
4. Confirm which merged-branch worktrees can be retired.
5. Dependabot: bump strategy for the 10 PRs into `main`.

Back to [in-progress index](../../README.md).
