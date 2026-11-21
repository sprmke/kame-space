---
title: 'Edge cases: subscriptions and billing'
status: active
tags: [workflow, in-progress, production-readiness, edge-cases, billing, plans]
updated: 2026-11-21
stage: in-progress
kind: plan
readiness: untracked
launch_gate: C
launch_blocker: tbd
last_verified: none
---

# Subscriptions and billing (`BIL`)

**Owned elsewhere:** the billing lifecycle itself (subscribe, renew, past due, grace, suspend, refund recorded, stale failed events) is built and sandbox-verified (ledger PR-033, PR-097). Webhook replay is PR-036. Default plan code is PR-034.

The gaps here are **side effects of plan state on guests who already booked.** A host's billing problem should never become a guest's problem.

## How it works today

- Org-level subscription, per enrolled property. Past due, then grace, then `suspended` (`orgBillingLifecycle.ts`).
- When a property is not entitled to `automatedBookingFlow`, these guest emails are forced off (`PLAN_GATED_AUTOMATION_TOGGLE_KEYS`): GAF request, booking acknowledgement, pet request, **ready for check-in**, **SD refund at checkout**.
- `calendar-sync-cron` skips feeds whose property is not entitled to `calendarSync`. `ical-export` has no entitlement check.
- `assertPropertyAcceptsNewBookings` looks at the property lifecycle only, not billing, so a suspended org's listings keep taking bookings.

## Gaps

| ID     | Scenario                                                                                            | Today                                                                                                                     | Target                                                                                                                                                                                                        | Sev | Tag |
| ------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| BIL-01 | Host downgrades or is suspended; guests already confirmed stop getting check-in and SD emails       | **Confirmed.** Plan-gated toggles are forced off for every booking, including ones made while the plan was active         | Bookings created while entitled keep their automated guest emails until check-out (entitlement snapshot on the booking, or grandfather by `booked_at`). Host sees "Emails still sent for N existing bookings" | P0  | 🆕  |
| BIL-02 | Suspended or downgraded org stops importing Airbnb / Agoda calendars, but direct bookings stay open | **Confirmed.** `calendar-sync-cron` skips non-entitled feeds; `assertPropertyAcceptsNewBookings` does not look at billing | When sync stops for billing, either keep import running (import-only is cheap and protects guests) or close the direct booking form for that property. Recommend: keep import, gate only export and settings  | P0  | 🧭  |
| BIL-03 | Suspended org: guest web chat / inbox AI auto-replies stop mid-conversation                         | Not verified                                                                                                              | Guest-facing chat keeps working (human replies at minimum); AI auto-reply stopping posts a hand-off message so the guest is not left waiting                                                                  | P1  | 🟡  |
| BIL-04 | Host suspended with stays inside the next 7 days                                                    | No guest-facing effect, no super-admin alert                                                                              | Super-admin list "Suspended orgs with upcoming stays" so support can reach the host before guests are affected                                                                                                | P1  | 🆕  |
| BIL-05 | Card / e-wallet chargeback on a subscription payment                                                | **Confirmed.** No dispute handling in `paymongo-webhook` / `subscriptionOrchestrator.ts`                                  | Handle the dispute event if PayMongo sends it to the account (mark txn `disputed`, notify super-admin, do not auto-suspend); otherwise document the manual runbook                                            | P2  | 🟡  |
| BIL-06 | Host pays twice for the same period (two tabs, retry after a slow redirect)                         | Stale failed events handled; double success not verified                                                                  | Second paid checkout for an already-paid period becomes account credit (`adminAdjustOrgCredit` path) and the host is told                                                                                     | P1  | 🟡  |
| BIL-07 | Host cancels mid-period and asks for a refund                                                       | Cancel takes effect at period end; no refund                                                                              | Terms and the Plans page say it plainly; super-admin can issue a credit or refund with a reason (exists as credit, verify refund)                                                                             | P2  | 🟡  |
| BIL-08 | Org owner leaves; nobody can pay                                                                    | One owner per org, no transfer (see ACC-02)                                                                               | Billing contact can be any org admin; past-due emails go to all org admins, not only the owner                                                                                                                | P1  | 🆕  |
| BIL-09 | Plan downgrade turns off a feature a guest is mid-way through (e.g. pet request, parking request)   | Not verified                                                                                                              | In-flight requests finish under the old rules; only new bookings lose the feature                                                                                                                             | P2  | 🟡  |

## Decisions needed (Phase 0)

1. BIL-02: keep import-only calendar sync running on every plan (recommended) or block direct bookings when sync is off.
2. BIL-01: grandfather by booking date, or keep guest-critical emails (ready for check-in, SD refund) free on every plan.

## Tests to add

- Deno: `propertyAutomationEnabled('emailReadyForCheckin')` returns true for a booking created while entitled after the org is suspended.
- Deno: `calendar-sync-cron` still imports for a suspended org (if decision 1 goes that way).
