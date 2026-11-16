---
title: 'In-progress module disposition'
status: active
tags: [workflow, in-progress]
updated: 2026-11-17
stage: in-progress
kind: reference
origin_stage: in-progress
readiness: unverified
launch_gate: A
launch_blocker: tbd
last_verified: none
---

# In-progress module disposition

Snapshot of every open module: what is **testing-only**, what is **real code**, and what
**closes** vs **stays open**. Updated when workflow stage changes. Full narrative and phase
ledgers stay in [`../../README.md`](../../README.md); this page is the short answer.

---

## For testing now (implementation complete)

Numbered batch: [`QA-BATCH.md`](./QA-BATCH.md) (batches #1–#8). Other `for-testing/` docs carry
their own § FOR TESTING sections.

| Module                           | Stage       | Close after                       |
| -------------------------------- | ----------- | --------------------------------- |
| Superhost program                | for-testing | QA batch #1                       |
| Onboarding verification simplify | for-testing | QA batch #2                       |
| Host verification tiers          | for-testing | QA batch #3                       |
| CAPTCHA & anti-spam              | for-testing | QA batch #4 (+ Turnstile keys)    |
| PWA install / offline / push     | for-testing | QA batch #5 (+ deploy config)     |
| Org granular team permissions    | for-testing | QA batch #6                       |
| Super Admin step-up OTP          | for-testing | QA batch #7                       |
| Org Activity & Audit Log         | for-testing | QA batch #8                       |
| Cost / abuse / security          | for-testing | Operator P0 + V-1–V-5             |
| Production readiness remediation | for-testing | Operator P0 + V-1–V-5             |

Also in `for-testing/` with their own checklists: `smart-pricing-ai`, `host-onboarding-setup-guide`,
`property-settings-copy-to-properties`, `host-analytics-module`, `parking-property-parity`,
`mobile-native-redesign`, `pwa-v2-native-app-experience`, `public-native-density`,
`two-way-reviews`, `verification-scope-split`, `org-portfolio-analytics-redesign`,
`feature-availability-controls`, `help-support-center`, `chat-templates`,
`booking-detail-activity-log`, `activity-modal-ui-polish`, `support-content-and-faq-sync`,
`listing-contract-renewal-modal`, `host-tour-film-redesign`, the Marketing Studio polish set,
and `ai-companion-response-quality-and-generative-ui`.

---

## In progress — disposition

| Module                          | Verdict                                                                  | Remaining work                                                                                              | Next action                                                    |
| ------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Multi-channel calendar sync** | PR [#493](https://github.com/sprmke/kame-space/pull/493) green, rebased    | Phase 0 spike needs real Agoda + Booking.com listings; Phases 2–5 (Agoda, Booking.com, optional Vrbo, GA)    | Review and merge, then host supplies the two listings           |
| **Guest Inbox Meta sync**       | Phase 1 of 8 shipped (data loss and token leak closed)                   | Durable outbox, server-owned import and reconcile, realtime, messaging parity, observability, cleanup       | Continue phases 2–8                                            |
| **Parking hardening**           | Money-path, claim race, RBAC and type gate shipped                        | Lifecycle edges, host/guest UX coverage, Deno and Playwright suites                                          | Continue after the inbox work                                  |
| **Property archive / delete**   | P0 hotfix shipped                                                        | Reason column, one lifecycle service, automations matrix, host UI, guest closed screen, billing, parity      | P1–P7                                                          |
| **Cancellation policy**         | Phases shipped, orchestrator and emails live                             | List filter chip, finance refund outflows, guest/host analytics split, cancel E2E specs                     | Follow-ups, not blockers                                       |
| **Settings cleanup**            | Phases 1–5 shipped                                                       | Phase 6 schema contract (drops columns)                                                                     | Wait one release soak, then `kamewave`                         |
| **Notifications restructure**   | In build                                                                | Tabs, bounded feed, help guidance, lazy Telegram queries                                                     | Ship the page, then QA                                         |
| **Telegram delivery history**   | Code complete                                                            | Migration not deployed                                                                                      | `kamewave` deploy                                              |
| **Mobile search**               | Shipped in the 2026-11-16 release                                         | On-device QA (real map tiles, iOS PWA back swipe)                                                           | Device pass                                                    |
| **Dashboard contextual help**   | P0 and P1 shipped                                                        | P2–P10: Smart Pricing, channel sync, notifications, templates, support, marketing, inbox, settings sweep      | Continue by module                                             |
| **Activity log follow-ups**     | RBAC leaves and four cron rows shipped                                   | Export leaves, notice emitters, ticket handlers, partitioning                                               | None block the feature                                         |
| **App speed overhaul**          | Phase 0 and 1 shipped, causes measured                                   | Every later phase needs a hosted run, a Supabase token, or a deploy                                         | Hosted measurement session                                     |

**Super admin console** — Phases 0–7 **done** ([`../../../done/super-admin-console-overhaul.md`](../../../done/super-admin-console-overhaul.md)).
Remaining 6 modules are in [`../../../planned/super-admin-console-followups.md`](../../../planned/super-admin-console-followups.md).

---

## Planned (related, not in-progress)

| Doc                                                                                                                             | Notes                                                    |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`../../../wont-do/parking-e2e-phase6-ranking-trust-safety.md`](../../../wont-do/parking-e2e-phase6-ranking-trust-safety.md)      | Needs real paid parking history before it can be reopened |
| [`../../../in-progress/production-readiness/audits/parking-e2e-production-readiness.md`](../audits/parking-e2e-production-readiness.md) | Parking production checklist                              |
| [`../../../in-progress/marketing-studio-mobile-and-dashboard-responsive.md`](../../marketing-studio-mobile-and-dashboard-responsive.md) | Marketing mobile and dashboard responsive polish          |
| [`../../../planned/calendar-sync-conflict-resolution.md`](../../../planned/calendar-sync-conflict-resolution.md)                 | Hard prerequisite for calendar relay beyond Phase 1b      |

---

## Suggested session order (if clearing the board)

1. **Run QA batch** — `QA-BATCH.md` #1–#8, then `/workflow-done` each pass. Fastest wins.
2. **Merge and review #493** — foundation is green; the remaining module work starts with Phase 0.
3. **Mobile search device QA** — closes the last release item.
4. **Guest Inbox phases 2–8** — the largest open code track.

Back to [in-progress index](../../README.md)
