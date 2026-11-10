---
stage: in-progress
title: 'Parking module hardening: end-to-end audit, fixes, and test coverage'
status: in-progress
tags: [workflow, planned, parking, payments, rbac, e2e, production-readiness]
updated: 2026-11-08
kind: plan
supersedes:
  - parking-e2e-later-phases.md
  - parking-e2e-phase6-ranking-trust-safety.md
  - ai-assistant-parking-broadcast-chat.md
---

# Parking module hardening

## Goal

Make the parking vertical (host dashboard under `/org/:orgSlug/parking/:parkingSlug/*`, org parkings hub, super-admin payouts, and every public `/parkings/*` and `/developments/:slug/parking*` page) correct, consistent, and regression-protected end to end. This plan comes from a code audit on 2026-11-07. The audit found **confirmed money-path bugs**, a **double-booking race**, a **parking-team RBAC break**, and almost no automated coverage past the Phase 0/1 broadcast flow. Fix the defects first, then close the UX gaps, then lock it all down with Deno handler tests and Playwright specs so parking does not regress again.

## Implementation status (2026-11-07)

Landed in the first slice:

- **P0-1** payment fulfillment TDZ fixed; `parkingId`/`guestEmail` resolved before analytics; `guest_charge_total` typed; every money-path PostHog call goes through `captureParkingEvent()`.
- **P0-2** stale pending transactions expired on release/cancel; reuse requires the same `parking_id`; `23505` on a double Pay tap returns the winner's link; dead/slot-mismatched webhooks go to manual review and never confirm.
- **P0-3** `claim_parking_booking_slot(...)` RPC (advisory lock + occupancy + blocks + turnover + TTL), 409 `slot_unavailable`, 410 `offer_expired`; availability pre-check; conflict declines recorded with `response_reason`.
- **P0-4** every `*parking*/index.ts` and `_shared/parking*.ts` is now in `check-edge-types.sh` via globs; the parking graph type-checks clean.
- **R-1/R-2/R-4** parking settings/pricing/uploads/Telegram use `resolveScopedParkingTeamAccess`; all eight admin routes use `parkingRoute()`; host-on-behalf submit requires `bookings:edit`; `created_by_host_user_id` added; dead legacy nav map removed.
- **R-3** delete/archive reject parking members and unassigned scoped org admins.
- **M-1/M-2** host cancel requires a reason, emails the guest, notifies a linked property host, moves the row to `refund_review`, and `parking-payouts` gained `record_refund` + status filters.
- **M-3** payment-window release asks PayMongo first; stale pending checkouts are reconciled.
- **M-4/M-5** guest cancel is one guarded write; claims reject a lapsed offer; the host UI disables Accept at 0 and shows **Offer expired**.
- **M-6** `complete-parking-bookings` sweep + `parking-complete-daily` cron.
- **M-7** server-side past-date, 60-night cap, field lengths and plate format.
- **M-8/M-9** delete pre-checks history (409 `has_bookings`); archive declines pending offers.
- **M-10** status endpoint redacts endorsement HTML/note and host contact unless the signed-in caller owns the booking; returns `viewerOwnsBooking`.
- **G-1** guest price resolver + index refresh migration; cards/detail now use the platform guest rate.
- **C-2/C-3/C-5/C-6** unused mock parking data, unmounted pay-parking routes, the legacy parking nav map and client legacy permission ids removed.
- Tests: `parkingDateOverlap_test.ts`, `parkingHardeningGates.test.ts` (18 assertions), all existing parking Deno tests, UI Vitest (5308) and `tsc` pass.

Second slice (2026-11-08):

- **H-1/H-7** `parking-payments` host-readable ledger + payment card on booking detail and Marketplace payouts on parking Finance.
- **H-2** `resend-parking-endorsement` host action, with the original first-send-wins guard.
- **H-8** host New booking auto-claims the pinned slot; **Paid outside Kame Space** records a ₱0 offline ledger row and confirms without PayMongo.
- **H-10** matching explainer on Pricing.
- **G-2** guest Trips list now includes parking requests and links to the status page.
- **G-4** returning from PayMongo shows a confirming state and does not offer Pay now again.
- **G-5** client form caps, plate format, past-date and 60-night rules now mirror the server.
- **C-1/C-4** removed `create-parking-booking`, `submit-pay-parking` and `parking-broadcast-email`, plus config, parity and docs entries.
- **C-7/C-8/C-9** removed the parking components barrel and brand alias, merged the duplicate `formatParkingLocation`, moved the property workflow spec to `bookings/`.
- **C-10** legacy `ParkingRequestForm` remains for historical unlinked rows; the booking detail panel already renders the linked marketplace match instead when available.
- Tests: +2 Deno suites, +4 Playwright specs; parking suite 25 passed, 12 skipped (side-by-side/live), mobile smoke 3 passed, moved property spec 8 passed. The three migrations applied cleanly to the local Supabase stack. Build is blocked only by an unrelated `VoiceSessionPanel` shell chunk from concurrent voice work, not by parking.

Follow-up slice (2026-11-09):

- **H-11** controller extracted from `ParkingSettingsCard.tsx` into `parking/hooks/useParkingSettingsController.ts`; the component dropped from 1,087 to 599 lines. Section-level components remain a later refactor.
- **H-9** org-wide and scoped booking lists include pre-claim broadcast requests (`20261324000000_list_bookings_preclaim.sql` plus the PostgREST fallback).
- **M-11** host in-app notices for guest cancel, payment-window expiry, and endorsement send failure. New types: `parking_request_cancelled`, `parking_payment_expired`, `parking_endorsement_failed`.
- **E-11/E-12** org parkings hub and super-admin payouts specs added.
- **Manual QA** width sweep at 375 / 768 / 1280 for Bookings, booking detail, Pricing, Finance and Settings.

Still open: section-level component split inside `ParkingSettingsCard`, the full human manual QA walk (the automated sweep covers overflow only), C-4 soak confirmation, and the production-readiness/support follow-through.

## How this audit was done

- Read the canonical spec (`.cursor/rules/parking-workflow.mdc`), every open parking plan, the production readiness audit, and the parity plan.
- Read the core server paths: submit, claim/decline, expire cron, payment orchestrator, cancellation, transition, public status, scope/auth helpers, delete/archive, FK behavior.
- Read the host pages (routes, booking detail, bookings list, pricing, settings, finance, sidebar nav) and the guest status hook/view.
- Ran `deno check` on every parking edge function. Output is saved in the session scratchpad and summarized in [Evidence](#evidence).
- Ran `bun run test:e2e:parking`: **23 passed, 3 failed, 4 skipped** (details in [Evidence](#evidence)).

Confidence labels used below: **Confirmed** (reproduced by a tool or proven by reading the code path end to end), **Likely** (clear from code, not yet reproduced), **Verify** (suspicious, needs a check before fixing).

### Second verification pass (2026-11-07, before implementation)

A second read of the code confirmed the four P0s and found five corrections. Apply these while implementing so nobody fixes the wrong thing:

| #   | Original claim                                                  | Correction                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | P0-2: "add a partial unique index: one pending txn per booking" | **Already exists** — `parking_payment_transactions_one_pending_per_booking_idx` in `20261128120100_parking_payment.sql`. Keep it; the real gap is that `createParkingPaymentTransaction` does not handle a `23505` unique violation and can return a 500 on two concurrent Pay taps. Re-read the winner instead.                                                                                                         |
| 2   | P0-2: "switch parking from Payment Links to Checkout Sessions"  | Keep Payment Links for the hotfix. Payment Links are v1 `link_…` rows with no expiry API; Checkout Sessions are v2 and exist in `paymongoClient.ts`, but switching also changes the webhook shape and the return flow. Ship the invalidation + webhook guard first (P0-2), then decide on Checkout Sessions in M-3 with a test.                                                                                          |
| 3   | R-1: `parking-pricing` "GET / PUT"                              | It is **GET / PATCH**. Match the handler, not the plan.                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | G-1: cards use the host rate                                    | The root cause is the search index, not only the card mapper: `pls_refresh_parking()` writes `parking_settings.weekday_nightly_rate` into `public_listing_search.price`, while checkout charges `platform_parking_settings.guest_rate_weekday/weekend`. `loadParkingSearchSummaries()` then trusts that index value. Fix both the projection and the index refresh, or the list flips back after the next settings save. |
| 5   | M-10: status endpoint returns guest name/plate                  | It does not return those fields directly. It returns `endorsement_email_snapshot` (rendered HTML containing name, plate, unit) plus host contact. The PII is real; keep the fix, but redact the snapshot and contact, not non-existent columns.                                                                                                                                                                          |

**Additional connection points found in the second pass** (add them to the RBAC/test matrix or note N/A):

- AI assistant tools `propose_claim_parking_booking` / `propose_decline_parking_booking` in `_shared/dashboardAssistantTools.ts` — they call the same primitives and must surface `slot_unavailable` / `offer_expired` the same way the HTTP handlers do.
- `list-linkable-property-bookings`, `get-linked-parking-booking`, `resolve-owner-default-parking`, `ownerDefaultParking*.ts` — property↔parking bridge; claim/payment changes can change their behaviour.
- Inbox parking scope (`inbox_parking_scope` migration, `ParkingInboxPage`), Telegram parking settings, announcements/activity/help-support parking routes (already guarded by `parkingRoute`), and the super-admin payouts page.
- `parking-reminder-daily` cron and `sync_parking_reminder_cron_job()` — where the auto-complete sweep should live if we reuse the existing job instead of adding one.
- `docs/guides/routes/org/parking/*`, `docs/guides/routes/org/parkings.md`, `docs/guides/routes/parkings.md`, `docs/guides/routes/bookings/parking.md`, `docs/guides/routes/admin/parking-payouts.md`.

### Non-negotiable invariants (do not regress)

1. First Accept wins. The guarded `guest_submissions.status = 'PENDING_HOST_ACCEPTANCE'` write is the only authority; a broadcast-row pre-check is UX only.
2. Never add a second write path for a terminal or batch-advancing parking transition. `advanceOrTerminateParkingBatch` is the single brain.
3. `PENDING_HOST_ACCEPTANCE` and `PENDING_PAYMENT` never resolve through `transition-parking-booking`.
4. Never confirm a booking from a webhook unless the transaction row says `pending`/`paid` and matches the booking's current `parking_id`.
5. Money-path analytics (PostHog) can never abort fulfillment. Wrap every capture in the payment path.
6. Parking access is `verifyParkingTeamAccess(parkingId, permission)` for every host endpoint, including settings, pricing, uploads, Telegram, refunds and endorsement resend. `resolveScopedParkingAccess` is only a compatibility shell and must delegate to the team check.
7. Guest-visible price is the amount checkout charges. One resolver, used by cards, detail, form summary, checkout and status.

---

## Scope

**In**

- Parking edge functions and `_shared/parking*.ts`, plus the parking branches of `paymongo-webhook`, `dashboard-stats`, `list-bookings`, `telegram-parking-settings`, and the AI assistant claim/decline tools.
- Host parking dashboard: Dashboard, Bookings (list, detail, New booking), Finance, Pricing, Notifications, Settings, Inbox, Team, Activity, Announcements, Help.
- Org parkings hub (`/org/:orgSlug/parkings`: create, archive, delete) and org-level booking lists that include parking.
- Property to parking connection: Find parking / Use your parking, linked-stay panel, auto-complete gate, reminder cron, complimentary owner parking.
- Public: `/parkings`, `/parkings/in/:location`, `/parkings/:slug`, `/parkings/:slug/form` (including `?dl=` and `?linkStay=`), `/parkings/requests/:bookingId`, development parking pages, legacy pay-parking redirects.
- Super-admin `/admin/parking/payouts`.
- Tests: Deno handler tests, Playwright mocked specs, mobile/tablet smoke.

**Out**

- PayMongo Platforms split payout and host KYC. These are business/compliance work, still tracked in [`parking-e2e-production-readiness.md`](../in-progress/production-readiness/audits/parking-e2e-production-readiness.md).
- Phase 6 behavioral ranking (closed by this plan, see [Existing plans](#decisions-on-the-existing-parking-plans)).
- Realtime for the guest status page (4s polling meets the spec; do not half-build Realtime).

---

## Decisions on the existing parking plans

There are **three** open parking plans under `planned/`, not two. Recommendation for each:

| Plan                                                                                         | Recommendation                                       | Why                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`parking-e2e-later-phases.md`](./parking-e2e-later-phases.md)                               | **Close: move to `done/`**                           | It is a phase map, not an implementation plan. Phases 0 to 5, 7 and 8 are done. Phase 6 is handled below. Its edge-case catalog is absorbed into this plan's tasks and test matrix.                                                                                                                                                                                                                                                  |
| [`parking-e2e-phase6-ranking-trust-safety.md`](./parking-e2e-phase6-ranking-trust-safety.md) | **Close: move to `wont-do/`** with a re-open trigger | Ranking on response speed and incident history needs live data. Parking has never processed a real payment, so there is no data. The non-refundable banner part already shipped (#140). Re-open when there are at least 100 completed paid parking bookings across 10 or more hosts. The one cheap, useful piece (a host-facing "how matching works" explainer of the current price-first ranking) moves into this plan as **H-10**. |
| [`ai-assistant-parking-broadcast-chat.md`](./ai-assistant-parking-broadcast-chat.md)         | **Close: move to `wont-do/`**                        | There is no host-initiated "broadcast" action to mirror. Fan-out only happens on guest submit and batch advance, which are system paths. The assistant already covers claim/decline for a single stay. Building a host-triggered fan-out would add a new blast radius for no user need.                                                                                                                                              |

Related docs this plan updates when it ships:

- [`parking-property-parity.md`](../for-testing/parking-property-parity.md): its manual QA is folded into [QA matrix](#manual-qa-matrix). Move it to `done/` when that matrix passes.
- [`parking-e2e-production-readiness.md`](../in-progress/production-readiness/audits/parking-e2e-production-readiness.md): update the test-coverage section and checklist as each phase lands. It stays open for the PayMongo business blockers.

---

## Phase 0: Hotfixes (ship first, small PR)

### P0-1 · Payment fulfillment throws on every real payment · **Confirmed**

`fulfillParkingPayment` in [`parkingPaymentOrchestrator.ts`](../../../supabase/functions/_shared/parkingPaymentOrchestrator.ts) reads `parkingId` in the `parking_payment_completed` PostHog call (line ~514) before `const parkingId` is declared (line ~524). That is a temporal-dead-zone `ReferenceError` at runtime. `deno check` reports it as TS2448/TS2454. It was introduced by `8aebf8fb0` (analytics coverage).

What happens on a real payment today: the booking flips to `PENDING_REVIEW` and the transaction is marked `paid`, then the throw lands in the outer `catch`. That `catch` **re-marks the transaction `failed`**, skips the confirmation email, the PMO endorsement email, and the linked property auto-complete, and returns an error to PayMongo. PayMongo retries, and the retry takes the "booking no longer PENDING_PAYMENT, needs manual review" branch. Net effect: every paid guest gets no confirmation and no endorsement, and every payment lands in manual review.

- [ ] Move `const parkingId` (and `guestEmail`) above the PostHog call, and use `txn.parking_id` as the fallback.
- [ ] Fix `txn.guest_charge_total` typing: add the column to `ParkingPaymentTransactionRow`, or select it explicitly.
- [ ] Make analytics impossible to break fulfillment: wrap `capturePostHogEvent` calls in the money path so a telemetry failure can never reach the outer `catch`.
- [ ] Deno test: `fulfillParkingPayment` happy path sends both emails once and leaves the txn `paid` (see T-2).

### P0-2 · Stale checkout reused across a re-claim; old links stay payable · **Confirmed**

`createParkingPaymentTransaction` reuses any `pending` transaction for the **booking**, without checking `parking_id` or amount. Neither `releaseParkingClaim` (payment-window timeout) nor `cancelParkingBooking` invalidates pending transactions. Payment Links also have no expiry.

Failure scenario: Host A accepts. Guest opens Pay (txn1 for A at A's price). The window lapses, the claim is released, and the search resumes. Host B accepts. Guest taps Pay and **gets txn1's link**: A's amount, ledger row pointing at parking A. The guest pays, the booking confirms on parking B, and the payout ledger credits host A. Separately, a guest can pay txn1's link after the request was cancelled or released, which collects money with no booking behind it.

- [ ] In `releaseParkingClaim` and both cancel branches, mark every `pending` `parking_payment_transactions` row for the booking `expired`, with a `failure_reason`.
- [ ] In `createParkingPaymentTransaction`, reuse only when `status = 'pending' AND parking_id = booking.parking_id` and the link is still open. Otherwise mark the stale row `expired` and create a new one.
- [ ] Keep the existing partial unique index (already shipped in `20261128120100_parking_payment.sql`). Handle its `23505` on insert by re-reading the winning pending row and returning that link — never surface a 500 on a double Pay tap.
- [ ] Webhook: a payment for an `expired`/`cancelled` txn, or a txn whose `parking_id` no longer matches the booking's `parking_id`, goes to the existing manual-review branch. It must never confirm a booking.
- [ ] Switch to PayMongo **Checkout Sessions** only after the invalidation + webhook guard ships, and only with a local test proving the return URL and webhook metadata still resolve. Track as M-3, not a hotfix.

### P0-3 · Double booking: claim never re-checks slot occupancy · **Confirmed**

Pre-claim requests have `parking_id = null`, so `findParkingBroadcastCandidates` does not count them as occupying. Two guests who request overlapping dates are both broadcast to the same slot. `claimParkingBooking` only guards **this booking's** status. It does not re-check overlap, blocked dates, turnover buffer, or that the parking is still `ACTIVE`. So the host can accept both, and the slot is double-booked.

- [ ] Before the guarded UPDATE in `claimParkingBooking`, re-run the availability check for this `parkingId` and these dates: occupancy, turnover buffer, blocked nights, `status = 'ACTIVE'`. Reuse the logic in `findParkingBroadcastCandidates` by extracting `assertParkingSlotAvailable(parkingId, checkIn, checkOut, { excludeBookingId })` into `parkingBroadcast.ts`.
- [ ] Close the check-then-write race in the database: add a Postgres exclusion constraint (or a `SECURITY DEFINER` claim RPC that takes `pg_advisory_xact_lock(hashtext(parking_id))`) so two concurrent claims on overlapping dates cannot both commit. Postgres is the only real guard. App-level checks alone still race.
- [ ] On conflict, return `409 slot_unavailable`, mark this host's broadcast row `declined` with reason `conflict`, and run `advanceOrTerminateParkingBatch` if the batch is exhausted.
- [ ] Host UI: map `slot_unavailable` to "This slot is already booked for these dates".
- [ ] The same guard covers the auto-accept and same-org owner auto-claim paths in `submit-parking-booking-request`, since they call the same primitive.

### P0-4 · CI does not type-check parking edge functions · **Confirmed**

`scripts/dev/check-edge-types.sh` checks a hand-picked list that has no parking files, which is how P0-1 shipped. Today 11 parking handlers report type errors. Most are `GenericStringError` noise from concatenated `select()` strings, but one was a real crash.

- [ ] Fix the parking type errors (listed in [Evidence](#evidence)). For the `GenericStringError` ones, use a single string literal in `select()` so the Supabase types resolve. Confirmed: the only real runtime error in the shared parking graph is the `parkingId` TDZ; the rest are typing.
- [ ] Add every `supabase/functions/*park*/index.ts`, `paymongo-webhook/index.ts`, `list-linkable-property-bookings/index.ts`, `get-linked-parking-booking/index.ts`, and `_shared/parking*.ts` to `check-edge-types.sh`.
- [ ] Add a CI guard that fails when a new `supabase/functions/*parking*/index.ts` is not in the type-check list (a one-line `comm -23` check), so parking cannot drift out again.

---

## Phase 1: Access control consistency (RBAC)

### R-1 · Parking team members are locked out of Pricing, Settings, Notifications · **Confirmed**

Parking has its own team RBAC (`parking_members`, `verifyParkingTeamAccess`, `PARKING_SECTION_VIEW_PERMISSION`). But these endpoints authorize through **org** RBAC (`resolveScopedParkingAccess` → `verifyOrgAccess` with `org.parkings:view|manage`), and `verifyOrgAccess` never looks at `parking_members`:

| Endpoint                                                | Current gate                   | Should be                                                |
| ------------------------------------------------------- | ------------------------------ | -------------------------------------------------------- |
| `parking-settings` GET / PATCH                          | `org.parkings:view` / `manage` | `settings:view` / `settings:edit`                        |
| `parking-pricing` GET / PUT                             | `org.parkings:view` / `manage` | `pricing:view` / `pricing:edit`                          |
| `update-parking`                                        | `org.parkings:manage`          | `settings:edit` (status change stays org-level, see R-3) |
| `upload-parking-media`, `upload-parking-settings-asset` | `org.parkings:manage`          | `settings:edit`                                          |
| `telegram-parking-settings` (`telegramAssetScope.ts`)   | `org.parkings:view` / `manage` | `notifications:view` / `notifications:edit`              |

Result today: a parking member granted `pricing:edit` sees **Pricing** in the sidebar, then the page 403s on load. The Direct link card is broken for them too, since it reads its token from `parking-pricing` GET.

- [ ] Add `resolveScopedParkingTeamAccess(req, permission: ParkingTeamPermissionId)` in `parkingScope.ts`, wrapping `verifyParkingTeamAccess`. It already handles owner, platform admin, org admins (all-listings and assigned) and parking members.
- [ ] Switch the endpoints in the table to it.
- [ ] Client: replace `hasOrgPermission(…, 'org:parkings:manage')` in `ParkingPricingPage.tsx` and `SetupGuidePricingEmbed.tsx` with `hasParkingPermission(useParkingPermissions(), 'pricing:edit')`. Do the same for the Settings and Notifications edit states.
- [ ] Remove `LEGACY_PARKING_NAV_VIEW_PERMISSION` from `adminSidebarNav.ts`. Every parking nav label already has a parking permission mapping, so it is dead.

### R-2 · Seven parking routes have no route guard · **Confirmed**

In [`parking/routes/index.tsx`](../../../ui/src/features/dashboard/parking/routes/index.tsx), only `inbox` goes through `parkingRoute()`. Dashboard, Bookings, Booking detail, Finance, Pricing, Notifications and Settings are mounted bare. Property routes wrap every section in `propertyRoute()`.

- [ ] Wrap each one in `parkingRoute('<section>', …)`, keeping the skeletons.
- [ ] Make write actions permission-aware: Accept / Decline / Mark ready / Complete / Cancel / New booking need `bookings:edit`. Finance add/edit needs `finance:edit`. Hide them, or show them disabled with a short reason, for view-only members.
- [ ] E2E (T-6): a view-only member gets the restricted state on Settings and sees no Accept button.

### R-3 · Scoped org admins may reach unassigned parkings · **Verify**

`resolveScopedParkingAccess` checks the org permission but not listing assignment (`all_listings = false`). An org admin scoped to parking A may be able to read and update parking B's settings, pricing and Telegram. R-1 removes most of this by moving to `verifyParkingTeamAccess`, which does check assignment. Still needed:

- [ ] Write a Deno test for a scoped org admin against an unassigned parking, for each endpoint in R-1 and for `delete-parking` / archive.
- [ ] Keep `delete-parking` and archive/restore on the org gate (`org.parkings:manage`), but also require assignment.

### R-4 · Any signed-in user can bypass parking anti-spam by using a different email · **Confirmed**

`submit-parking-booking-request` skips `assertParkingSubmitAllowed` whenever `guestEmail` differs from the caller's email. That exception exists for the host "New booking" modal, but it is not tied to being a host. Any guest can type someone else's email to skip the 3-concurrent and cancellation-cooldown limits, and send "awaiting payment" emails to an arbitrary address.

- [ ] Treat a submit as host-on-behalf only when the request is pinned (`parkingId`) **and** the caller passes `verifyParkingTeamAccess(req, parkingId, 'bookings:edit')`.
- [ ] Otherwise require `guestEmail` to match the caller's email (case-insensitive), or return 403.
- [ ] Record `created_by_host_user_id` for host-on-behalf rows, so audit does not have to infer it from an email mismatch.

### R-5 · AI assistant parking tools bypass the new guards · **Confirmed**

`propose_claim_parking_booking` / `propose_decline_parking_booking` call the same shared primitives, but the tool layer currently maps every failure to a generic message. After P0-3 and M-5 they will start returning `slot_unavailable` / `offer_expired`. Without mapping, the assistant will tell the host "something went wrong" and retry-loop.

- [ ] Map `slot_unavailable`, `offer_expired`, `already_claimed` to short tool-result messages, same copy as the host UI.
- [ ] Do not let the assistant retry a claim on a conflict; it must offer the next request instead.

### R-6 · Parking-adjacent reads and scopes to include in the matrix · **Verify**

- [ ] `list-bookings` parking/org branches, `dashboard-stats` parking/org branches, `get-parking-broadcast-status`, `parking-access`, `parking-team-*`, `telegram-parking-settings`, `inbox` parking conversations.
- [ ] `get-linked-parking-booking` (property-scoped) and `resolve-owner-default-parking` (guest/property bridge).
- [ ] For each, write the expected role matrix in T-5 and add one Deno assertion per branch.

---

## Phase 2: Booking lifecycle and money correctness

### M-1 · Host cancel of a paid booking has no consequences · **Confirmed**

`transition-parking-booking` allows `PENDING_REVIEW` / `READY_FOR_CHECKIN` → `CANCELLED` with no side effects. The guest is not told, the transaction stays `paid`, and the payout ledger still shows the host as owed. The detail page's Cancel button has no confirm step and no reason.

- [ ] Require a cancellation reason (enum + optional note) for host cancel after payment.
- [ ] On host cancel of a paid booking: email the guest, set the txn to `refund_review` (new status or a flag) so it appears in a "Needs refund" filter on `/admin/parking/payouts`, and block `mark_disbursed` on it.
- [ ] If the booking is linked to a property stay, notify the property host. Leave the property gate as-is, since it is already complete. Record that in the activity log.
- [ ] Emit `parking.cancelled_by_host` with the reason via `logParkingStatusChange`.
- [ ] Host UI: confirm sheet (bottom sheet on phone) that states the guest will be notified and the refund will be reviewed.

### M-2 · No admin refund / override path · **Confirmed (deferred by design, now required)**

The readiness audit already says this must exist before real money flows.

- [ ] `parking-payouts` PATCH: `{ action: 'record_refund', transactionId, amount, reference, reason }`. Manual record only (refund issued in the PayMongo dashboard), mirroring `record_clawback`.
- [ ] Payouts page: Refund action, "Needs refund" and "Needs manual review" filters (from `failure_reason`), and a CSV export.

### M-3 · Payment window can release a booking while the guest is mid-payment · **Likely**

`runExpireParkingPayments` releases at `parking_payment_expires_at` without asking PayMongo. A guest who completes payment in the last seconds can be released and re-broadcast, and their webhook then lands in manual review.

- [ ] Before releasing, check the pending txn's PayMongo state. If paid, fulfill. If processing, extend by a short grace (for example 10 min, once). Reuse the `getPaymongoProviderPaymentState` pattern from `orgPaymentReconcile.ts`.
- [ ] Add a parking reconcile sweep (same cron tick) for `pending` txns older than 15 min whose provider state is `paid`, to cover missed webhooks.
- [ ] Use Checkout Sessions with an `expires_at` that matches the window (finishes P0-2's last bullet).

### M-4 · Guest cancel is two writes; host and cron can see a half state · **Likely**

`cancelParkingBooking` in `PENDING_PAYMENT` first releases to `PENDING_HOST_ACCEPTANCE` and then updates to `CANCELLED`. In between, the expire cron can advance the batch and notify the next hosts about a request the guest is cancelling.

- [ ] Do a single guarded UPDATE `PENDING_PAYMENT → CANCELLED` that clears the claim fields, then expire broadcast rows and pending txns. Keep `releaseParkingClaim` for the timeout path only. Update the rule's `releaseParkingClaim` note to match.
- [ ] Notify the host whose claim was dropped (Telegram + in-app), so their detail page does not keep saying "Awaiting guest payment".

### M-5 · Claims accepted after the broadcast TTL · **Likely**

`claimParkingBooking` checks `response = 'pending'` and booking status, but not `parking_broadcast_expires_at`. With a 5-minute cron, a host can accept up to about 5 minutes after the guest's countdown shows 0.

- [ ] Add `.gt('parking_broadcast_expires_at', now)` to the claim guard. Return `410 offer_expired`.
- [ ] Host UI: when the countdown hits 0, disable Accept and show "Offer expired".

### M-6 · Bookings never auto-complete · **Likely**

Nothing moves `READY_FOR_CHECKIN` to `COMPLETED` after checkout. Hosts must click Complete on every booking. If they don't, stats, finance and payout eligibility drift.

- [ ] Daily cron (reuse `send-parking-reminders` scheduling or add `complete-parking-bookings`): `READY_FOR_CHECKIN` with checkout date before today (Asia/Manila) → `COMPLETED`, logged as `actorType: 'cron'`.
- [ ] Decide whether `PENDING_REVIEW` past checkout should also complete, or be flagged for the host. Recommendation: flag it in the dashboard attention list, do not auto-complete.

### M-7 · Server-side input validation gaps on submit · **Confirmed**

`submit-parking-booking-request` does not reject a check-in in the past (Asia/Manila), has no maximum stay length, and has no length caps on free-text fields. The client blocks past dates, but the server does not.

- [ ] Reject `checkInDate` before today (Manila) with `400 check_in_in_past`.
- [ ] Cap stay length (recommend 60 nights) and free-text lengths (name 120, unit 60, plate 15, brand/model 80, color 40, notes 1000).
- [ ] Validate the plate format loosely (alphanumeric, space, dash).

### M-8 · Delete with history fails with a generic 500; delete cascades finance · **Confirmed**

`guest_submissions.parking_id` is `ON DELETE RESTRICT`, and `parking_pinned_id` has no `ON DELETE` (defaults to `NO ACTION`). Deleting a parking that has ever had a booking fails as `500 Failed to delete parking`. Deleting one with no bookings silently cascades `finance_line_items`.

- [ ] `delete-parking`: pre-check bookings (`parking_id` or `parking_pinned_id`) and pending broadcasts. Return `409 has_bookings` with "Archive this parking instead".
- [ ] UI: only offer Delete when the listing has no bookings. Otherwise show Archive. Confirm copy mentions that finance entries are removed.

### M-9 · Archive does not warn about live and upcoming bookings · **Likely**

Archiving (`INACTIVE`) drops the listing from public search and from new broadcasts, which is correct. It leaves pending offers claimable and upcoming paid bookings in place, with no warning.

- [ ] Archive confirm shows counts of pending offers and upcoming confirmed bookings.
- [ ] On archive, decline this parking's pending broadcast rows (run the batch-advance as needed). Keep confirmed bookings.
- [ ] `claimParkingBooking` rejects non-`ACTIVE` parkings (covered by P0-3's availability check).

### M-10 · Public status endpoint returns PII to anyone holding the UUID · **Likely**

`get-parking-booking-status` is anonymous and returns `endorsement_email_snapshot` (guest name, plate, unit) and, after endorsement, the host's email and phone. The UUID is a bearer token that travels through emails, screenshots and referrers. Submitting already requires guest sign-in.

- [ ] Keep the anonymous projection to status, dates, timers, listing card and support phone.
- [ ] Return the endorsement snapshot, host contact and endorsement note only when the caller is signed in and passes `assertParkingGuestOwnership`.
- [ ] Status page: show a "Sign in to see your access details" row when signed out.

### M-11 · Notification gaps around state changes · **Likely**

| Event                                | Guest                                  | Host                           |
| ------------------------------------ | -------------------------------------- | ------------------------------ |
| Guest cancels while searching        | nothing                                | broadcast rows expire silently |
| Guest cancels while awaiting payment | nothing                                | claim drops silently (M-4)     |
| Payment window lapses                | nothing ("we're finding another slot") | claim drops silently           |
| Host cancels after payment           | nothing (M-1)                          | n/a                            |
| Endorsement send fails               | resend CTA only                        | nothing                        |

- [ ] Add the missing sends behind existing `automation_toggles` keys (add new keys where needed, defaulting to on). Telegram + in-app for hosts, email for guests.
- [ ] Endorsement failure: in-app alert to the host with the fix ("Add the PMO email for <development>").

---

## Phase 3: Host dashboard UX

Invoke `mobile-responsive`, `human-copy` and `unsaved-changes-guard` on each of these.

- [ ] **H-1 Booking detail completeness** (`ParkingBookingDetailPage.tsx`). Today it shows email, phone, plate and vehicle. Add: unit / tower (`tower_and_unit_number`), guest notes (`guest_special_requests`), vehicle type, booking channel (Direct link badge), linked property stay (with a link if the viewer has access), and a payment card (guest paid, your rate, platform fee, your payout, payout status) once paid. That needs a narrow host-safe read: extend `get-parking-broadcast-status`, or add `get-parking-booking-payment` gated on `finance:view`.
- [ ] **H-2 Endorsement status for the host.** Show sent / failed / pending with the failure reason, and a "Resend endorsement" host action (new endpoint gated on `bookings:edit`, using the same `endorsement_sent_at` guard).
- [ ] **H-3 Confirm destructive actions.** Decline and Cancel get a confirm (bottom sheet on phone, dialog on desktop). Cancel after payment uses the M-1 sheet.
- [ ] **H-4 Clear status actions.** Rename "Mark ready" to "Approve for check-in", with one helper line saying the PMO endorsement was sent. Keep "Complete". Show the stepper for every non-terminal status, not only the first three.
- [ ] **H-5 Mobile action bar.** On phone, move Accept / Decline / next-status to a sticky bottom action bar (per `mobile-native-ui.mdc`), not an inline row above the content.
- [ ] **H-6 Offer expiry handling** (from M-5): disable Accept at 0, show "Offer expired", refetch.
- [ ] **H-7 Host earnings on Finance.** Today `ParkingFinancePage` shows manual finance line items only. Marketplace payments are visible to super-admins only. Add a read-only "Marketplace payouts" section: paid bookings with gross, fee, net, and disbursed or pending. Gate it on `finance:view`, with a new parking-scoped read on `parking_payment_transactions`. Check that `dashboard-stats` parking finance numbers include marketplace net (**Verify**: the parking dashboard reuses the property stats shape).
- [ ] **H-8 New booking semantics.** Host "New booking" reuses the guest broadcast flow: it pins to this parking, then the host must Accept their own request, then the guest must pay online. Make that explicit in the modal (one line), and auto-claim when the submitting host has `bookings:edit` on the pinned parking, so they do not have to accept their own booking. See open question 1 for offline payment.
- [ ] **H-9 Org-wide requests in org lists.** **Verify** that org-scoped booking lists and stats include pre-claim requests broadcast to any of the viewer's parkings (`list-bookings` org branch unions only `parking_id` rows today).
- [ ] **H-10 "How matching works" explainer** (from Phase 6). Short help on Pricing: requests go to up to 3 eligible slots at a time, cheapest first, earliest-listed breaks ties. The guest rate cap excludes slots priced above it. The first Accept wins. Plain language, no weights.
- [ ] **H-11 Split `ParkingSettingsCard.tsx` (1,087 lines).** Move `useParkingSettingsController` into `parking/hooks/` (today `org/hooks/useParkingSettingsController.ts` re-exports it from a component file). Split the sections into their own components. Behavior unchanged, covered by T-5.

---

## Phase 4: Guest and public UX

- [ ] **G-1 Price shown versus price charged · Confirmed.** Checkout charges the **platform** guest rate per night (`platformSettings.guestRateWeekday/Weekend`). Public cards show `public_listing_search.price`, which `pls_refresh_parking()` fills from `parking_settings.weekday_nightly_rate` (host rate); the detail page uses `pricing.weekdayNightlyRate` (also host rate). If the host rate is below the cap, guests see one price and pay another. Fix in two layers: (a) add one resolver (`resolveGuestNightlyRate` / `parkingGuestRate.ts`) used by cards, detail, form summary, checkout and status; (b) change `pls_refresh_parking()` to write the platform weekday guest rate into `price` (and add a trigger/refresh when `platform_parking_settings` changes), so the cached index cannot drift back. Show "from ₱X / night" plus a weekend note when rates differ. Add a pre-pay total breakdown on the status page.
- [ ] **G-2 "My parking" in the guest portal.** `listGuestTrips` excludes parking rows (`.is('parking_id', null)` plus `property_id` required), so a guest who loses the status link can only find it through email. Add parking requests and bookings to the portal (Stays hub), linking to `/parkings/requests/:id`.
- [ ] **G-3 Status page states.** Check every status has one clear headline, one primary action, and a sensible secondary: searching (cancel), awaiting payment (pay, cancel, timer), paid / awaiting approval, approved, completed, cancelled (search again), no host (search again with the same dates prefilled, or nearby slots). After payment, poll at a slower interval until `endorsementSentAt` is set, so the access details appear without a reload.
- [ ] **G-4 Returning from PayMongo.** On return, show a "Confirming your payment" state while the status is still `PENDING_PAYMENT` and a txn exists. Never show "Pay now" again during that state.
- [ ] **G-5 Form validation parity** with M-7 (same caps and past-date rule), with errors inline on the right step.
- [ ] **G-6 Direct link (`?dl=`) clarity.** A guest on a direct link sees the same price (the guest rate does not change). Confirm the badge or copy does not suggest a discount. The host card explains that the lower fee is theirs.
- [ ] **G-7 Development parking pages.** Confirm `ParkingSlotsGrid`, filters and toolbar use live data only (see C-2), and that empty, loading and error states exist at 375px.
- [ ] **G-8 Responsive pass** at 375 / 768 / 1024+ on every public parking route: no horizontal scroll, sticky CTA on mobile detail and form, date picker usable on touch, chat sheet full-height on phone.

---

## Phase 5: Cleanup and removal

Each item: confirm there are no callers (`rg`), delete, update docs.

| ID   | Remove                                                                                                                                               | Evidence                                                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| C-1  | `supabase/functions/create-parking-booking/` and `DatabaseService.createParkingBooking`                                                              | No UI, test or script caller. It inserts `PENDING_REVIEW` directly, skipping overlap, payment and broadcast. Unsafe to leave deployable. |
| C-2  | `ui/src/features/guest/marketing/developments/data/mockParkingSlots.ts`                                                                              | Not imported anywhere.                                                                                                                   |
| C-3  | `payParkingRoutes` in `ui/src/features/guest/pay-parking/routes/index.tsx`                                                                           | Exported, never mounted. The real routes live in `guest/property/routes`.                                                                |
| C-4  | `submit-pay-parking/` and `parking-broadcast-email/` 410 stubs, their `config.toml` blocks, and their entries in `audit-edge-functions.mjs`          | Retired in Phase 7. The soak is long over.                                                                                               |
| C-5  | `LEGACY_PARKING_NAV_VIEW_PERMISSION`                                                                                                                 | Dead (R-1).                                                                                                                              |
| C-6  | Legacy `org:parkings:*` ids in client code                                                                                                           | Use `org.parkings:*` directly. Keep the expansion map for stored legacy data.                                                            |
| C-7  | `ui/src/features/guest/marketing/parkings/components/index.ts` barrel, and the 1-line `ParkingPublicBrandShell.tsx` re-export if it is only an alias | The repo rule is no barrel re-exports.                                                                                                   |
| C-8  | Duplicate helpers: `formatParkingLocation.ts` (org/lib and marketing/parkings/lib) and `parkingSlotDisplay.ts` (org/lib and developments/lib)        | Merge each pair into one shared module.                                                                                                  |
| C-9  | Move `ui/e2e/features/parking/property/propertyBookingFreeManualWorkflow.spec.ts` to `ui/e2e/features/bookings/`                                     | It tests the property workflow, not parking.                                                                                             |
| C-10 | **Verify, then decide:** `ParkingRequestForm.tsx` and the legacy owner/rate fields in `ParkingPanel.tsx`                                             | Kept for historical unlinked rows. Query dev/prod for rows still needing them. If none are non-terminal, make them read-only display.    |

---

## Phase 6: Tests

### Server (Deno), new `supabase/functions/tests/parking*.test.ts`

Run against local Supabase where the logic depends on SQL guards. Mock PayMongo and Resend.

- [ ] **T-1 Lifecycle:** submit → claim → pay (simulated webhook) → approve → complete. Assert statuses, broadcast rows, emails (once each), activity log rows.
- [ ] **T-2 Payment:** fulfill is idempotent on a duplicate webhook. A payment for an expired txn lands in manual review. Re-claim by another host creates a new txn (P0-2). Release expires pending txns. Complimentary owner parking creates a ₱0 row.
- [ ] **T-3 Races:** two concurrent claims on one booking (one 409). Two overlapping bookings on one slot (the second claim gets `slot_unavailable`, P0-3). Claim after TTL (M-5). Decline-last plus cron expire on the same batch advances once.
- [ ] **T-4 Batching:** a pinned request terminates after its batch. An org-wide request advances to batch 2, then `NO_HOST_AVAILABLE`. The price cap excludes a slot. Multi-slot host dedupe. Turnover buffer. Blocked dates.
- [ ] **T-5 RBAC matrix:** owner, org admin (all listings), org admin (assigned / unassigned), parking member (each permission), outsider. Run against settings, pricing, telegram, update, uploads, claim, decline, transition, list-bookings, dashboard-stats, team endpoints.
- [ ] **T-6 Anti-spam:** concurrent cap, cancellation cooldown, email-mismatch rule (R-4).
- [ ] **T-7 Validation:** past check-in, stay too long, oversized fields, bad vehicle type.
- [ ] **T-8 Delete/archive:** delete with bookings returns 409. Archive declines pending offers.

### UI (Playwright, mocked via `interceptEdge`)

First, fix the existing failures:

- [ ] `parkingHostNewBooking.spec.ts`: the modal title is now "New booking", not "New Parking Booking".
- [ ] `guestFormParkingCta.spec.ts`: expect `/parkings?linkStay=<id>`. The current link is the intended behavior.
- [ ] Moved property spec (C-9): fix the Automation Triggers `aria-expanded` expectation, or the regression, after checking which one is right.
- [ ] Tag the core specs `@ci` so they run on every PR. Today only `parkingGuestRequest` (`@smoke @ci`) and `parkingGuestHostOutcomes` (`@ci`) do.

New specs (each also runs on `mobile-chromium-smoke` at 375px where noted):

- [ ] **E-1 Host pricing:** edit weekday/weekend rates, cap warning, date override, block and unblock dates, unsaved-changes guard, direct link copy. (375px)
- [ ] **E-2 Host settings:** each section saves, completion issues sync, archive / restore, delete blocked when bookings exist (M-8). (375px)
- [ ] **E-3 Host booking detail:** every status renders the right actions. Offer-expired state. Decline and cancel confirms. Payment card. Endorsement resend. (375px)
- [ ] **E-4 Host bookings list:** filters, stage tabs, search, pagination, calendar view, pending-offer countdown in table and cards.
- [ ] **E-5 Finance and dashboard:** marketplace payouts section (H-7), stat cards, empty states.
- [ ] **E-6 Permissions:** a view-only parking member sees no write actions and gets the restricted state on guarded routes (R-2). A pricing-only member can open and edit Pricing (R-1).
- [ ] **E-7 Guest browse:** list, location page, filters, map toggle, detail page price equals form price equals checkout price (G-1). (375px)
- [ ] **E-8 Guest status:** each state from G-3, the payment-return state (G-4), signed-out redacted view (M-10). (375px)
- [ ] **E-9 Direct link:** `?dl=` form submit carries the token. The guest sees the standard price.
- [ ] **E-10 Property connection:** Use your parking (own default), Search other parkings, complimentary owner parking confirms with no payment step, linked panel after payment.
- [ ] **E-11 Org parkings hub:** create, card and table views, filters, archive, delete-blocked state.
- [ ] **E-12 Super-admin payouts:** mark disbursed, record clawback, record refund, needs-review filter.
- [ ] Update `ui/e2e/features/parking/shared/parkingFlowHarness.ts` mocks for every new field and endpoint (payment card, endorsement status, error codes `slot_unavailable`, `offer_expired`, `has_bookings`).

### Live local

- [ ] Extend `parkingGuestHostLocal.spec.ts` (`PLAYWRIGHT_LOCAL_LIVE=1`) with a full paid flow, using a simulated signed webhook against local Supabase. Document how to run it in `docs/guides/testing/parking-playwright.md`.

---

## Phase 7: Docs and close-out

- [ ] `.cursor/rules/parking-workflow.mdc`: claim availability guard, txn invalidation on release/cancel, single-write guest cancel, TTL guard on claim, auto-complete cron, host-cancel side effects, PII split on the status endpoint, RBAC helper, Checkout Sessions.
- [ ] `docs/architecture/overview.md` + `docs/PROJECT.md`: removed endpoints (C-1, C-4), new endpoints (host payment read, host endorsement resend, refund action), new cron.
- [ ] `docs/architecture/edge-functions.md`, `.cursor/rules/admin-auth.mdc` (parking RBAC helper).
- [ ] Migration runbook entry for the exclusion constraint / claim RPC, the unique pending-txn index, and any new txn status.
- [ ] Route guides (`route-guides` skill): every file under `docs/guides/routes/org/parking/`, plus `parkings.md`, `bookings/parking.md`, `org/parkings.md`, `admin/parking-payouts.md`.
- [ ] `support-content`: Host-facing knowledge Q&A and `docs/guides/support/faqs.md` for cancel-after-payment, matching explainer, payouts visibility, delete versus archive. Run `check:support-content` and `check:ai-knowledge-coverage`.
- [ ] `audit-logging`: new events (`parking.cancelled_by_host`, `parking.auto_completed`, `parking.refund_recorded`, `parking.claim_conflict`).
- [ ] `plans-and-permissions`: Plans N/A (no new paid gate). RBAC: R-1 / R-2 / H-7 permissions as listed.
- [ ] `docs/guides/testing/parking-playwright.md`: rewrite for the new suite. It predates Phases 2 to 8.
- [ ] Production readiness audit: update the coverage section and checklist.
- [ ] Workflow moves: the three plans per [Decisions](#decisions-on-the-existing-parking-plans), `parking-property-parity.md` → `done/` after the QA matrix passes, and this plan → `in-progress/` at start and `done/` at the end. Keep the `_to-plan.md` / `_to-prompt.md` scratchpads in sync (`workflow-intake-scratchpads`).

---

## Locked implementation design

Use these exact shapes so the phases do not invent competing patterns.

### Slot availability (P0-3)

- Add `assertParkingSlotAvailable(parkingId, checkIn, checkOut, { excludeBookingId? })` to `_shared/parkingBroadcast.ts`, extracted from `findParkingBroadcastCandidates` (occupancy statuses, turnover buffer, blocked nights, `status = 'ACTIVE'`).
- Add one new migration, `20261203120000_parking_claim_guard.sql`, with `public.claim_parking_booking_slot(p_booking_id uuid, p_parking_id uuid, p_endorsement_note text, p_payment_expires_at timestamptz)`:
  - `SECURITY DEFINER`, `SET search_path = public`.
  - `pg_advisory_xact_lock(hashtext(p_parking_id::text))` first.
  - Lock the `parkings` row; reject not `ACTIVE`.
  - Lock the booking row; require `PENDING_HOST_ACCEPTANCE`, a pending broadcast row for this parking, and `parking_broadcast_expires_at > now()` (M-5).
  - Reject an overlapping occupying booking using `to_date(check_in_date,'MM-DD-YYYY')` ranges, excluding this booking.
  - Reject blocked nights and the 30-minute same-day turnover rule.
  - Perform the single guarded update to `PENDING_PAYMENT` and stamp the broadcast rows `claimed`/`expired`.
  - Return the updated `guest_submissions` row. Raise `slot_unavailable`, `offer_expired`, `already_claimed`, `parking_not_found` with distinct messages.
  - `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO service_role`.
- `claimParkingBooking` becomes a thin wrapper: compute TTL in TS, call the RPC, map errors to `ParkingBroadcastActionError`, then send the guest email. The JS-level `assertParkingSlotAvailable` call stays as a fast, friendly pre-check only.

### Payment invalidation (P0-2)

- Add `expirePendingParkingTransactions(bookingId, reason)` to `parkingPaymentOrchestrator.ts`; call it at the end of `releaseParkingClaim` and in both cancel branches.
- In `fulfillParkingPayment`, read the booking before writing. If `txn.status IN ('expired','cancelled')` **or** `txn.parking_id <> booking.parking_id`, mark the txn `paid` with a manual-review `failure_reason` and return. Never change booking status.
- `ParkingPaymentTransactionRow` gains `guest_charge_total`, `paid_at`, `payment_method_type`, `failure_reason`, `parking_id`.

### Host cancel + refunds (M-1, M-2)

- Migration adds to `parking_payment_transactions`: `refund_review_at`, `refunded_at`, `refund_amount`, `refund_reference`, `refund_reason`, `refunded_by`, and widens the status CHECK with `'refund_review'` (keep `'refunded'`).
- Host cancel of a paid booking: `refund_review` status, guest email, property-host notification when linked, `parking.cancelled_by_host` activity, and `mark_disbursed` blocks any txn in `refund_review`.
- `parking-payouts` PATCH adds `record_refund` (manual record only) and GET adds `?status=paid|refund_review|needs_review`.
- `parking_booking_broadcasts` gains `response_reason TEXT` so a conflict decline can be recorded without overloading `response`.

### Auto-complete (M-6)

- New `complete-parking-bookings` endpoint + `_shared/parkingCompletionCron.ts` + cron migration modelled on `20261201120200_parking_reminder_cron.sql` (`parking-complete-daily`, 06:30 Asia/Manila equivalent in UTC).
- `READY_FOR_CHECKIN` + `parking_check_out_date < manilaToday` → `COMPLETED`, `actorType: 'cron'`. Do not auto-complete `PENDING_REVIEW`; surface it in the dashboard attention list.

### Pricing display (G-1)

- New shared `resolveParkingGuestNightlyRate()` returns the platform weekday/weekend rate. Server cards and detail use it; the client form summary uses the same numbers returned by the listing DTO (`guestRateWeekday`/`guestRateWeekend`), not the host rate fields.
- Update `pls_refresh_parking()` in a new migration (do not edit the shipped index migration) to read `platform_parking_settings`, and add a refresh trigger on that singleton.

## Acceptance gates

PR 1 is done only when all of these pass locally:

- [ ] `deno check` on every parking function and `_shared/parking*.ts` is clean.
- [ ] `bun run test:e2e:parking` has zero failures (fix the two stale specs and the moved property spec).
- [ ] A simulated paid webhook on local Supabase leaves the txn `paid`, the booking `PENDING_REVIEW`, and sends exactly one confirmation and one endorsement email.
- [ ] Two overlapping claims on one slot: second gets `409 slot_unavailable`, first remains `PENDING_PAYMENT`.
- [ ] Release/cancel marks pending txns `expired`; a late webhook for that txn cannot confirm a booking.
- [ ] `bun run ci:quality` passes for every PR.
- [ ] No production deploy. Local/staging only.

## Manual QA matrix

Run on local or dev only, never prod. Every row at 375 / 768 / 1280.

| Flow                                                                                | Roles                        | Pass when                                              |
| ----------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| Org-wide request → batch 1 decline → batch 2 accept → pay → approve → auto-complete | guest, owner, parking member | statuses, emails, Telegram, activity, stats all agree  |
| Pinned request → payment window lapse → re-accept → pay                             | guest, owner                 | new checkout, correct ledger parking (P0-2)            |
| Two guests, same slot, same dates                                                   | 2 guests, owner              | the second accept is blocked (P0-3)                    |
| Host cancel after payment                                                           | owner, super-admin           | guest emailed, refund review visible, disburse blocked |
| Property stay → Use your parking (complimentary)                                    | property host, guest         | no payment step, property gate cleared                 |
| Direct link booking                                                                 | guest, owner                 | channel and fee correct, guest price unchanged         |
| View-only parking member walkthrough                                                | parking member               | no write controls, no 403 screens                      |
| Archive with live offers / delete with history                                      | owner                        | warnings shown, delete blocked                         |

---

## Suggested PR order

1. **PR 1 Hotfix:** P0-1, P0-2 (first three bullets), P0-3, P0-4, T-2, T-3, fix the 3 failing specs.
2. **PR 2 RBAC:** R-1 to R-4, T-5, T-6, E-6.
3. **PR 3 Lifecycle and money:** M-1 to M-11, T-1, T-4, T-7, T-8.
4. **PR 4 Host UX:** H-1 to H-11, E-1 to E-5, E-11, E-12.
5. **PR 5 Guest UX:** G-1 to G-8, E-7 to E-10.
6. **PR 6 Cleanup and docs:** C-1 to C-10, Phase 7, QA matrix, workflow moves.

PR 1 should go out on its own, quickly. P0-1 breaks every real payment.

---

## Open questions and defaults taken

These are implemented with the recommended default unless the product owner overrides them. Each default is reversible behind a small UI/flag.

1. **Host-created bookings already paid offline (cash or bank transfer).** Default: add a "Paid outside Kame Space" option for hosts with `bookings:edit`. It records a ₱0 `provider: 'offline'` ledger row, no platform fee, and reuses the complimentary fulfillment path (confirmation + endorsement + property gate, no PayMongo). Do not send the guest a pay link. Keep online-only as the visible default.
2. **Refund policy when the host cancels after payment.** Default: full refund to the guest, recorded manually in `parking-payouts` (`record_refund`), host payout blocked until recorded. The existing "non-refundable" copy applies to guest-initiated cancellation, not host cancellation. If product disagrees, change the copy and the action label, not the ledger.
3. **Guest-facing price (G-1).** Default: guests always see and pay the **platform** guest rate. Cards, detail, form summary, status and checkout all use it. Host rate is a payout input only. Weekend nights are called out when the rate differs.

---

## Evidence

**`deno check` per parking function (2026-11-07)**

| Function                                                                                                                                              | Errors  | Real runtime risk                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `paymongo-webhook`, `claim-`, `decline-`, `cancel-`, `create-parking-payment-checkout`, `expire-parking-broadcasts`, `submit-parking-booking-request` | 3 to 11 | **Yes**: TS2448 `parkingId` used before declaration in `fulfillParkingPayment` (shared import) |
| `get-linked-parking-booking`, `cancel-`, `claim-`, `decline-`, `submit-`                                                                              | several | No: `GenericStringError` from concatenated `select()` strings                                  |
| `parking-pricing`                                                                                                                                     | 2       | Low: `{}                                                                                       | null`assigned to`number | undefined` |
| `telegram-parking-settings`                                                                                                                           | 3       | Low: `text` possibly null in draft preview                                                     |
| `upload-parking-media`                                                                                                                                | 1       | No: `Uint8Array` / `BlobPart` typing                                                           |
| other 24 parking functions                                                                                                                            | 0       | n/a                                                                                            |

**`bun run test:e2e:parking` (2026-11-07):** 23 passed, 3 failed, 4 skipped.

- `parkingHostNewBooking`: waits for "New Parking Booking". The modal title is "New booking". The test is stale.
- `guestFormParkingCta`: expects `/parkings`. It got `/parkings?linkStay=property-booking-success-001`. The test is stale.
- `propertyBookingFreeManualWorkflow` "Proceed skips…": Automation Triggers was not expanded. This is a property workflow spec; check whether it is a regression.
- 4 skipped: side-by-side specs (need the side-by-side project) and the live local spec (needs `PLAYWRIGHT_LOCAL_LIVE=1`).
