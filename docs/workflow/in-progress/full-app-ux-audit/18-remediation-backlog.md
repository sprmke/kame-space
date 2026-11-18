---
title: 'Audit 18: remediation backlog'
status: active
tags: [audit, backlog, remediation]
updated: 2026-11-19
---

# 18: Remediation backlog

Every P0 and P1 from both phases, sequenced by risk and dependency. Effort is a rough t-shirt size for
one engineer including a test, not a commitment. "Gate" means a test that should exist so the class of
bug cannot return.

> **Since this list was written:** the public surface got its own pass. 181 newer issues, ranked and
> grouped with a UI-impact flag for each, live in [29-issue-register.md](./29-issue-register.md) (details in
> [29b](./29-issue-details.md)). Treat 18 as the functional/security backlog and 29 as the current
> product-wide list; where they overlap, the ids cross-reference.

## Stop-the-line (P0)

| #   | Fix                                                                                                                                                  | Report   | Effort | Gate                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------ |
| 0   | Pin the guest-form mobile action bar (remove the persistent transform / portal the bar)                                                              | 17-V1    | S      | Playwright: primary CTA bounding box inside the viewport at 390 and 320        |
| 1   | Booking transition must not commit the status when a required side effect fails, and must always write `booking.status_changed`                      | 03-B1    | M      | Edge test: orchestrator failure leaves status unchanged + activity row present |
| 2   | Close the `guest_submissions` RLS write path (per-leaf check, or revoke authenticated writes and move the two direct UI reads behind edge functions) | 15-S1    | M      | Role fixture test: viewer REST PATCH/DELETE → 403                              |
| 3   | Stop leaking internal error strings to guests; add `publicMessage` to the error envelope                                                             | 01-G1    | S      | Unit test on the form error mapper                                             |
| 4   | Fix listing authorization `context.user.id` (submit/approve/reject return 500 after commit)                                                          | 11-L1    | S      | Handler test per action: 200 + state change                                    |
| 5   | Remove the load-time unit-type capacity sync; clamp defaults to the residence caps; fix the seed to pass its own validator                           | 12-S1    | M      | E2E: edit description on a 2br Azure North property → saves                    |
| 6   | Make checkout exclude archived properties (use `listOrganizationPropertyIds`) and assert `amount === quote` server-side                              | 10-B1    | S      | Unit test with 2 billable + 1 archived                                         |
| 7   | Block self role changes (`property-team-members`) and self `allListings` (`org-team-members`) unless caller is owner                                 | 09-R1/R2 | S      | Escalation test per role fixture                                               |
| 8   | Resolve the parking shell from `parking-access` so parking-only members can enter                                                                    | 09-R3    | S      | E2E: parking STAFF loads parking dashboard                                     |
| 9   | Enforce `GUEST_BOOKING_ACCESS_ENFORCE` by default and narrow `get-form` output without a token                                                       | 15-S2    | S      | Handler test: anon without token → no PII                                      |
| 10  | Fix the public slug redirect to an absolute app-origin URL (or resolve in the SPA route)                                                             | 11-L2    | S      | E2E: rename → old link lands on new page                                       |
| 11  | Enforce the signups switch server-side and reflect it in the login UI                                                                                | 12-S2    | M      | Auth hook test: signup blocked when off                                        |
| 12  | Seed the two PDF templates into Storage (or make `db:reset` do it) and document the required edge secrets                                            | 08-D1/D2 | S      | `seed:verify` asserts bucket objects + env presence                            |
| 13  | Make `identity_hash_pepper` / `guest_booking_access_secret` fail fast at startup with a clear message                                                | 08-D1    | S      | Serve smoke test                                                               |

## Next (P1, high impact)

| #   | Fix                                                                                                                                              | Report         | Effort |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------ |
| 14  | Billing: one price source (per-property label + computed total), and a price-migration path for snapshots                                        | 10-B4/B5       | M      |
| 15  | Billing: carry or collect the overdue balance on upgrade; block plan changes while past due                                                      | 10-B2          | M      |
| 16  | Billing: prevent archiving a plan with live subscribers; notify and migrate                                                                      | 10-B3          | S      |
| 17  | Billing: write `purpose`, period bounds, `receipt_number`, `period_paid_php`; use the ledger for credits/refunds                                 | 10-B8          | M      |
| 18  | Billing: add cancel-at-period-end and explicit proration (or state "no proration" in the dialog)                                                 | 10-B9/B10      | M      |
| 19  | Billing: expire pending checkouts (TTL + sweeper) and stop reusing unverified links; map the unique-constraint error to a friendly state         | 10-B6          | S      |
| 20  | Billing: fix payout processor fee / platform net columns and the direct-link 5% rate                                                             | 05 / 10-B12    | S      |
| 21  | Enforce plan features on `finance-*`, `analytics-summary`, `maintenance-items`, `social-inbox-threads`                                           | 09-R5          | S      |
| 22  | Parking member permission presets (role fallback when `permissions` is empty)                                                                    | 09-R6          | S      |
| 23  | Stop treating `ADMIN_ALLOWED_EMAILS` as tenant membership; add a platform-staff audit trail                                                      | 09-R4          | M      |
| 24  | Expose `feature_overrides` per org and add global switches for booking intake, email and checkout                                                | 04             | M      |
| 25  | Trim `list-bookings` / inbox list DTOs to rendered columns                                                                                       | 16             | M      |
| 26  | Add a cached `workspace-bootstrap` endpoint and remove duplicate query keys (`dashboard-assistant-settings`, `list-bookings`)                    | 16             | M      |
| 27  | Lazy-load Sentry and PostHog out of the initial bundle                                                                                           | 16             | S      |
| 28  | Verify `VITE_SUPABASE_IMAGE_TRANSFORMS=true` in production (egress)                                                                              | 16             | S      |
| 29  | Make payment receipts private and serve signed URLs                                                                                              | 15-S3          | S      |
| 30  | Add the three missing `config.toml` function entries (notification-preferences, telegram-delivery-settings, telegram-message-log) and a CI check | 15-S4          | S      |
| 31  | Hash invitation tokens                                                                                                                           | 15-S5          | S      |
| 32  | Add idempotency to checkout creation and submit-form                                                                                             | 15-S9          | S      |
| 33  | Delete, or add migrations for, the 7 orphan tables; add a schema-drift CI check                                                                  | 14-C2          | M      |
| 34  | Generate and use `database.types.ts`                                                                                                             | 14-C1          | M      |
| 35  | Add a publish/unpublish control for public pages                                                                                                 | 13-P1          | S      |
| 36  | Remove the duplicate Guest experience section and the dead client validator; wire field-level validation                                         | 12-S5/S6       | S      |
| 37  | Add mobile section navigation to org/property/parking settings                                                                                   | 06-X2          | M      |
| 38  | Fix the AI video unit economics and bill timed-out provider jobs                                                                                 | 16             | M      |
| 39  | Make the notification count badge pass AA contrast; fix `aria-label` on role-less elements; name the unnamed switch and tab strips               | 06-A / 04      | S      |
| 40  | Add an empty state to the feature-availability "Off only" filter                                                                                 | 04-A20         | S      |
| 46  | Give the mobile More sheet nav the flexible height (151px scroll hole at 320)                                                                    | 17-V2          | S      |
| 47  | Collapse the admin org sub-nav below `xl` and step the KPI grid 4 → 2 (MRR truncation at 1024)                                                   | 17-V3          | S      |
| 48  | Add an affordance or column drop for the bookings table at 1024                                                                                  | 17-V4          | S      |
| 49  | Fix the 320px home showcase overflow and the above-the-fold booking rows                                                                         | 17-V5/V6       | S      |
| 50  | Raise touch targets to 44px (calendar cells, 24px icon buttons)                                                                                  | 17-V7          | M      |
| 51  | Wire the parking dashboard cards to real data (cash flow, breakdown, transactions, calendar)                                                     | 22-P1-2        | M      |
| 52  | Build parking attention hrefs from the parking scope; filter parking notifications to parking events                                             | 22-P1-1/6      | S      |
| 53  | Add a confirmation + undo to parking approve/complete                                                                                            | 22-P1-3        | S      |
| 54  | Handle a live offer without a broadcast row ("no longer available") and stop showing a countdown                                                 | 22-P1-4        | S      |
| 55  | Fix parking-scoped Meta conversation resolution in `social-inbox-threads`                                                                        | 22-P1-5        | M      |
| 56  | Fix the Analytics PDF exporter for the stored review payload shape                                                                               | 19-D3-1        | S      |
| 57  | Show a human "email unavailable" path for OTP-gated saves instead of the raw error                                                               | 19-D3-10       | S      |
| 58  | Give the Setup Guide a visible dismiss and remember it; do not block deep links                                                                  | 19-D3-2        | S      |
| 59  | Render the org bookings date control (or a range chip) at org scope                                                                              | 21             | S      |
| 60  | Fix the review "empty save deletes" behaviour with validation + confirm                                                                          | 21             | S      |
| 61  | Reject zero rates and add a Booked state to the parking pricing calendar                                                                         | 22-P2-11/13    | S      |
| 62  | Fix parking settings: Maps fallback, per-field validation instead of a global Save disable, editable identity                                    | 22-P2-17/18/19 | M      |
| 63  | Decide and enforce paid-data visibility on Free (page/read gates or documented action-only gating)                                               | 19             | M      |
| 64  | Make "Ask AI" and Guides functional (or disabled with reason), and fix the Guides link                                                           | 21             | S      |
| 65  | Show a retry/error state when the edge runtime is unreachable instead of a silent Loading hang                                                   | 22-P2-23       | S      |
| 66  | Clear `showCompletedBookings`/`limit` when leaving calendar or kanban                                                                            | 20             | S      |
| 67  | Gate the maintenance status pill on completion, not telegram_reminder_enabled                                                                    | 20             | S      |
| 68  | Add rate bounds + formatting to pricing (reject absurd/zero values)                                                                              | 20             | S      |
| 69  | Implement `?module=` on Notifications or remove the documented deep links                                                                        | 20             | S      |
| 70  | Add a Cancel/keep-editing path to the template OTP modal                                                                                         | 19-D3-10       | S      |

## Structural (plan, do not rush)

| #   | Work                                                                                                             | Report | Why                                      |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------- |
| 41  | Consolidate 368 edge functions into resource routers (target <100)                                               | 14-C3  | cold starts, deploy time, config surface |
| 42  | Split the god files (`dashboardAssistantTools` 5.6k, `GuestForm` 2.9k, `AdminLayout` 1.4k, `databaseService` 2k) | 14-C4  | reviewability, conflicts                 |
| 43  | One super-admin source of truth (table, not env)                                                                 | 14-C5  | revoked staff keep access today          |
| 44  | Trim the PWA precache budget or move content out of the shell (currently 96%)                                    | 14-C14 | next shell change fails the build        |
| 45  | Raise the coverage floor for money/permission directories                                                        | 14-C13 | tests do not cover the holes found here  |

## Suggested batches

1. **Security + data integrity (1-13).** One PR per numbered item where possible; the RLS and
   transition fixes need migrations and handler tests.
2. **Billing correction (14-20).** Needs a written pricing decision (promo grandfathering, proration,
   cancel-at-period-end) before code.
3. **Entitlements + admin control (21-24).**
4. **Performance (25-28).** Measure before/after with the existing scripts.
5. **Hygiene (29-40).**
6. **Structure (41-45).** Sequence after the correctness work so refactors do not collide.
