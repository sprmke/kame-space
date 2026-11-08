---
stage: planned
title: 'Payments and PayMongo hardening (subscriptions, webhooks, rails, super-admin billing control)'
status: planned
tags:
  [
    planning,
    planned-modules,
    billing,
    paymongo,
    plans,
    payments,
    super-admin,
    testing,
    production-readiness,
  ]
updated: 2026-11-09
---

# Payments and PayMongo hardening

Full review of every payment path before mt-prod launch: org subscription billing, the PayMongo webhook, parking guest payments, payment rails, dunning, and super-admin control. It lists what is broken today, how we fix it, what super-admin needs to control it, and the test for every scenario.

Sibling plans:

- [`ai-credits-topup-purchase.md`](./ai-credits-topup-purchase.md): buying more AI credits. **Depends on Phase 1 of this plan** (see its 2026-11-09 review addendum).
- [`../in-progress/parking-module-hardening.md`](../in-progress/parking-module-hardening.md): parking-specific money bugs (P0-2 stale links, M-1/M-2 refunds, M-3 Checkout Sessions). This plan does **not** duplicate those. It only fixes the shared webhook and rails code parking also runs through.

## TL;DR

1. **Subscriptions are not auto-charged today.** (Auto-renew is now planned in [`auto-renew-subscription-billing.md`](./auto-renew-subscription-billing.md).) There is no saved card and no PayMongo recurring billing. `platform-billing-cron` (daily 06:00 UTC) creates a fresh Hosted Checkout Session N days before `current_period_end` and emails the link. The host pays by hand every month. If they don't, the sub goes `past_due` (grace), then `suspended`. This is a normal model for QR Ph markets. We keep it and harden it (Decision D1).
2. **"Expired card" can't happen today** because no card is stored and the `card` rail is not offered. The real failure modes for a pay-by-link model are: link never paid, link expired, payment failed inside the checkout, payment made on a stale or superseded link, double payment, and missed webhooks. All of these are in the scenario matrix below.
3. **Two P0 bugs can lose or ignore money that PayMongo already collected:**
   - The webhook writes its dedupe row **before** processing. If processing throws, it answers 500, PayMongo retries, and the retry is answered `duplicate: true`. **The event is lost.**
   - A `payment.failed` event marks the org transaction `failed`. QR Ph checkouts let the payer retry inside the same session, and when that retry succeeds, `payment.paid` is ignored because the row is no longer `pending`. **The host paid but stays on the old plan.** The `org-plan` page-load recovery only rescues this by luck.
4. **Payment rails are not aligned with the PayMongo account.** The DB default and both code fallbacks offer `paymaya`, `dob`, or `gcash`. The account only has **QR Ph** active (GCash, Maya, and bank apps all scan QR Ph). If a rail isn't activated, checkout creation can fail or show a method that can't complete. Fix: one server-side source of truth for supported rails, `qrph` only by default, and super-admin can only turn on rails marked activated.
5. Super-admin today can extend a period, run the cron, revoke a reward, and edit rails, lead days, and grace days. It **cannot**: reconcile a payment, record an offline payment, cancel a pending link, resend a renewal link, mark a refund, see failed fulfilments or webhook failures, or pause checkout. Phase 3 adds a billing control center.
6. No automated tests cover the subscription orchestrator, checkout, reconcile, proration, or the webhook dispatch. Phase 5 adds pure-logic Deno tests, local-Supabase integration tests with a PayMongo fake, and mocked Playwright specs for every host billing state.

## Current architecture (verified 2026-11-09)

| Piece                      | Location                                                                                                                               | What it does                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| PayMongo REST client       | `supabase/functions/_shared/paymongoClient.ts`                                                                                         | v2 Checkout Sessions (subscriptions), v1 Payment Links (parking), status polling, rail mapping. No timeout, no idempotency key. |
| Webhook                    | `supabase/functions/paymongo-webhook/index.ts`                                                                                         | HMAC verify, dedupe insert into `processed_paymongo_events`, dispatch by `metadata.kind`.                                       |
| Signature                  | `_shared/paymongoWebhookVerify.ts`                                                                                                     | `t=,te=,li=` header, 300 s tolerance. Falls back to the other mode's signature.                                                 |
| Subscription state machine | `_shared/subscriptionOrchestrator.ts`                                                                                                  | Fulfil, failed, dunning cron (`runPlatformBillingCycle`), admin extend.                                                         |
| Checkout creation          | `_shared/orgSubscriptionCheckout.ts`                                                                                                   | Price, proration, pending reuse keyed by `(org, plan)`, session create.                                                         |
| Reconcile                  | `_shared/orgPaymentReconcile.ts`                                                                                                       | Polls PayMongo for pending rows; reopens `failed`/`expired` rows PayMongo says are paid.                                        |
| Host GET                   | `supabase/functions/org-plan/index.ts`                                                                                                 | Returns plans and billing; **also reconciles and fulfils on every load**.                                                       |
| Downgrade                  | `apply-org-plan-downgrade` → `_shared/planEntitlements.ts#applyOrgPlanDowngrade`                                                       | Applies **immediately**, expires all pending org transactions.                                                                  |
| Cron                       | migration `20261024140000_platform_billing_cron.sql`                                                                                   | `platform-billing-daily`, `0 6 * * *` UTC.                                                                                      |
| Rails settings             | `platform_payment_settings` (DB default `["qrph","paymaya","dob"]`), `platform-payment-settings` fn, `/admin/pricing/payment-settings` | Super-admin picks from QR Ph / Maya / Direct online banking.                                                                    |
| Super-admin billing        | `org-subscriptions-admin`                                                                                                              | `extend_period`, `run_billing_cron`, `revoke_reward`, assign plan.                                                              |
| Parking                    | `_shared/parkingPaymentOrchestrator.ts`, `create-parking-payment-checkout`, `parking-payments`, `parking-payouts`                      | Payment Links (never expire on PayMongo), manual payouts and refunds.                                                           |
| Unused                     | `org_subscriptions.cancel_at_period_end` column, `ui/.../plans/lib/planStubPayToast.ts` (no importers)                                 | Dead code / unused schema.                                                                                                      |

**Not run during this review:** live DB checks of `platform_payment_settings`, transaction status counts, and `processed_paymongo_events` (Supabase MCP not authorized here). Phase 0 lists them as operator checks.

## Findings

Severity: **P0** = money collected but not honoured, or a payment path broken. **P1** = wrong charge, wrong state, or bad UX on a normal path. **P2** = hardening and hygiene.

| ID   | Sev | Finding                                                                                                                                                                                                                              | Where                                                                                              |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| F-01 | P0  | Dedupe row inserted before processing. A thrown handler returns 500, PayMongo's retry hits `23505` and gets `duplicate: true`. The event is never processed. Affects subscriptions **and** parking.                                  | `paymongo-webhook/index.ts:70-82`                                                                  |
| F-02 | P0  | `payment.failed` marks the org txn `failed`. A later `payment.paid` on the same session hits `status !== 'pending'` and returns `handled: false`. Paid but not fulfilled.                                                            | `subscriptionOrchestrator.ts:417-436`, `:468`                                                      |
| F-03 | P0  | Rails offered don't match the account. DB default `qrph,paymaya,dob`; settings fallback `qrph,paymaya,dob`; client fallback `qrph,paymaya,gcash`; super-admin UI offers Maya and DOB. Only QR Ph is active.                          | `platformPaymentSettings.ts:37`, `paymongoClient.ts:129`, `SuperAdminPaymentSettingsPage.tsx:24`   |
| F-04 | P1  | Webhook never checks that paid amount, currency, and `livemode` match the transaction.                                                                                                                                               | `subscriptionOrchestrator.ts` paid branch, parking paid branch                                     |
| F-05 | P1  | Pending reuse is keyed by `(org, plan)` only. If the property count or price changed, the old link (old amount, old `property_ids`) is handed back.                                                                                  | `orgSubscriptionCheckout.ts:183-225`                                                               |
| F-06 | P1  | Pending links for **different** plans can coexist (unique index is per org+plan). Paying a stale one later re-applies an old plan or property set. Renewal links are also not superseded when the host upgrades.                     | `orgSubscriptionCheckout.ts`, unique index `org_payment_transactions_one_pending_per_org_plan_idx` |
| F-07 | P1  | Renewal uses `price_php_snapshot` but `property_ids` = all current properties. With a property added, fulfilment sees a "change", resets the period to `now` (host loses prepaid days), and charges the old amount (undercharge).    | `orgSubscriptionCheckout.ts:151`, `subscriptionOrchestrator.ts` `isChange`                         |
| F-08 | P1  | Proration credit is computed at link creation, not at payment. A change link paid days later carries a stale credit; fulfilment starts a fresh period from the payment date.                                                         | `orgSubscriptionCheckout.ts:163`                                                                   |
| F-09 | P1  | Double payment (two open links both paid, or pay after already renewed) silently stacks or resets periods. No overpayment record, no admin flag.                                                                                     | `fulfillOrgSubscriptionPayment`                                                                    |
| F-10 | P1  | Renewal reminder email sent on **every** daily cron run inside the lead window (about 5 emails with lead = 5). No send log.                                                                                                          | `subscriptionOrchestrator.ts:546`                                                                  |
| F-11 | P1  | Dunning sends one past-due email only. No reminder during grace, no "suspends tomorrow" warning. `graceRetries` counter is never incremented.                                                                                        | `subscriptionOrchestrator.ts:594-610`                                                              |
| F-12 | P1  | `suspended` is terminal: no auto-move to Free after N days, no "your data is safe" follow-up. Suspended orgs keep a "live" row forever.                                                                                              | cron                                                                                               |
| F-13 | P1  | `addOneMonth` uses `setMonth(+1)`. Jan 31 becomes Mar 3 (overflow); periods drift.                                                                                                                                                   | `subscriptionOrchestrator.ts:55`                                                                   |
| F-14 | P1  | Downgrade is immediate. Paid to Free cancels now and drops paid time; paid to lower tier drops the higher tier now. Standard is "change at period end". `cancel_at_period_end` exists but is unused.                                 | `planEntitlements.ts:1628`                                                                         |
| F-15 | P1  | `org-plan` GET (any org member) calls PayMongo and runs fulfilment on every page load. Slow, rate-limit exposed, and side effects on a GET.                                                                                          | `org-plan/index.ts:142-149`                                                                        |
| F-16 | P1  | `recoverExpiredOrgPaymentIfPaidOnPaymongo` reopens up to 5 old `failed`/`expired` rows and fulfils them. If an org paid two stale links, it can re-apply an older plan on page load.                                                 | `orgPaymentReconcile.ts`                                                                           |
| F-17 | P1  | `payment.failed` emails the owner on every failed attempt, even when they retry and succeed a minute later.                                                                                                                          | `subscriptionOrchestrator.ts:436`                                                                  |
| F-18 | P1  | Parking Payment Links never expire on PayMongo. Released claims only expire our row; the guest can still pay. Tracked as P0-2/M-3 in `parking-module-hardening.md`; this plan adds the shared `archivePaymongoPaymentLink()` helper. | `parkingPaymentOrchestrator.ts:245`                                                                |
| F-19 | P2  | Signature check accepts the test signature in live mode when `li` is missing (`fallbackSig`).                                                                                                                                        | `paymongoWebhookVerify.ts:67`                                                                      |
| F-20 | P2  | No `AbortController` timeout on PayMongo `fetch`. A hung PayMongo call holds the edge worker until platform timeout.                                                                                                                 | `paymongoClient.ts:97,196,230`                                                                     |
| F-21 | P2  | `trialing` subs (host verification reward) aren't in the dunning query. Expiry runs in `expireHostVerificationRewards`. Confirm a reward that ends converts cleanly to Free or to a renewal link.                                    | cron query `.in('status', ['active','past_due'])`                                                  |
| F-22 | P2  | Super-admin `extend_period` and `run_billing_cron` don't write `logSuperAdminAction` (only `org_subscription_events`). No org activity-log row either.                                                                               | `org-subscriptions-admin/index.ts:382-408`                                                         |
| F-23 | P2  | Webhook outcomes aren't stored. `processed_paymongo_events` has no `status`, `error`, or `handled_action`, so super-admin can't see failures or replay.                                                                              | migration `20261024120000`                                                                         |
| F-24 | P2  | `planStubPayToast.ts` is dead code with "coming soon" copy.                                                                                                                                                                          | `ui/src/features/dashboard/plans/lib/planStubPayToast.ts`                                          |
| F-25 | P2  | No receipt or invoice the host can download. Receipt email only. Business hosts usually need an official receipt (BIR context).                                                                                                      | host Billing tab                                                                                   |
| F-26 | P2  | Parking payouts: confirm `mark_disbursed` is blocked when `failure_reason` is set ("needs manual review"). Only `status = 'paid'` is checked.                                                                                        | `parking-payouts/index.ts:124`                                                                     |

## Decisions (Phase 0)

| ID  | Decision                            | Recommendation                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Billing model                       | **Superseded 2026-11-09 by [`auto-renew-subscription-billing.md`](./auto-renew-subscription-billing.md):** auto-renew with card or Maya through the PayMongo Subscriptions API is the default. Manual pay-by-link (QR Ph) stays as the fallback, and everything in this plan about renewal links and dunning applies to that fallback only. |
| D2  | Rails at launch                     | **`qrph` only.** UI copy: "Pay with QR Ph. Scan with GCash, Maya, or your bank app." Maya, GCash, card, and DOB stay off until activated on the account.                                                                                                                                                                                    |
| D3  | Downgrade timing                    | **At period end** for paid to Free and paid to lower paid. Upgrades stay immediate with proration.                                                                                                                                                                                                                                          |
| D4  | Dunning cadence                     | Reminders at T-5, T-1, T0 (due), grace day 1, grace last day. Grace 5 days. Then `suspended`.                                                                                                                                                                                                                                               |
| D5  | Suspended end state                 | Auto-move to Free after **30 days** suspended (configurable). Data is kept.                                                                                                                                                                                                                                                                 |
| D6  | Overpayment                         | Never auto-refund. Record as `overpaid`, extend one period if it was the same plan, otherwise flag for super-admin (refund in PayMongo dashboard, then "Mark refunded").                                                                                                                                                                    |
| D7  | Renewal with changed property count | Renewal charges the **current** property count at the current snapshot rate. The period extends from the old end date. A property change is a separate prorated "change" checkout.                                                                                                                                                          |
| D8  | Receipts                            | Downloadable PDF receipt per paid transaction (reuse `pdfService`). Official receipt numbering is an accounting decision for the owner.                                                                                                                                                                                                     |

## Operator checks (Phase 0, before code)

- [ ] PayMongo dashboard (live and test): list activated payment methods. Write the result into `docs/archive/operations/paymongo-billing-setup.md`.
- [ ] Webhook subscriptions include `checkout_session.payment.paid`, `payment.paid`, `payment.failed`, `link.payment.paid`, plus any refund events we'll handle. One webhook per environment, secret in `PAYMONGO_WEBHOOK_SECRET`.
- [ ] Confirm Checkout Session expiry behaviour in test mode (how long a `cs_` stays payable, which status it reports when expired).
- [ ] Confirm whether a failed QR Ph attempt keeps the session open for another try (drives F-02 test fixtures).
- [ ] mt-prod (`fwor…`): `select enabled_payment_methods from platform_payment_settings` and counts of `org_payment_transactions` by status, `failure_reason like 'Fulfillment error%'`.
- [ ] Confirm `PUBLIC_GUEST_APP_ORIGIN` is set per environment (return URLs).

## Phase 1 — Money safety (P0, ships first)

**1.1 Durable webhook processing (F-01, F-23)**

- [ ] Migration: add `status TEXT CHECK (status IN ('processing','processed','failed','ignored'))`, `attempts INT`, `handled_action TEXT`, `last_error TEXT`, `processed_at`, `livemode BOOLEAN`, `kind TEXT`, `provider_reference TEXT`, `payload JSONB` to `processed_paymongo_events`.
- [ ] Webhook: insert `status='processing'`. On `23505`, read the row. `processed`/`ignored` → 200 duplicate. `failed` or stale `processing` (older than 2 min) → claim it (guarded update, `attempts+1`) and reprocess. Fresh `processing` → 409 so PayMongo retries later.
- [ ] On success set `processed` + `handled_action`. On throw set `failed` + `last_error`, return 500.
- [ ] Every fulfilment path stays idempotent through guarded `UPDATE … WHERE status IN (…)`, so a reprocess never double-applies.

**1.2 Failed then paid (F-02, F-17)**

- [ ] `payment.failed` for an org txn records `last_failed_at` + `failure_reason`, keeps `status='pending'` while the session is still `open` on PayMongo, and only flips to `failed` when the session is `expired`.
- [ ] Paid handler accepts `pending` **and** `failed`/`expired` when PayMongo confirms paid, using the same guarded claim. Superseded rows go to the overpayment path (1.5).
- [ ] Payment-failed email: send once per txn and only after the session expires unpaid (or after 30 min with no success). Not on every attempt.

**1.3 One source of truth for rails (F-03)**

- [ ] New `_shared/paymentRails.ts`: `SUPPORTED_RAILS` catalog (id, label, PayMongo type, `activated` flag from env `PAYMONGO_ACTIVATED_METHODS`, default `qrph`).
- [ ] `getPlatformPaymentSettings()` intersects DB rails with activated rails. Empty result → `['qrph']`. Delete both hard-coded fallbacks.
- [ ] Migration: set the DB default to `["qrph"]` and update the singleton row to the intersection.
- [ ] `platform-payment-settings` PUT rejects unknown or non-activated rails with a clear 400.
- [ ] Super-admin page: list every rail; non-activated ones show disabled with "Not active on the PayMongo account".
- [ ] Parking Payment Links can't restrict methods. Document that the PayMongo account settings are the only control there. M-3 (Checkout Sessions) closes it.
- [ ] Health: add a `/admin/health` check that warns when DB rails include a non-activated one.

**1.4 Verify what was paid (F-04, F-19)**

- [ ] Paid branch compares PayMongo `amount` (centavos) and `currency` with the txn, and event `livemode` with env. A mismatch records `paid` with `failure_reason='amount_mismatch'` and does **not** change the plan. It surfaces in the super-admin queue.
- [ ] Signature: in live mode require `li`; in test mode require `te`. Drop the cross-mode fallback. Update `paymongoWebhookVerify_test.ts`.

**1.5 Supersede stale checkouts (F-05, F-06, F-09, F-16)**

- [ ] New checkout for an org (any plan or purpose) expires **all** other pending org txns first. Partial unique index becomes one pending per org.
- [ ] Reuse an open session only if `plan_id`, `amount`, and the sorted `property_ids` all match. Otherwise expire it and create a new one.
- [ ] On expire, also try to expire the session on PayMongo (Checkout Session expire endpoint, if available; verify in Phase 0). Payment Links: `archivePaymongoPaymentLink()`.
- [ ] Payment arriving on a superseded or expired txn: mark `paid` + `failure_reason='superseded_checkout'`, apply nothing, notify super-admin. If it equals a same-plan renewal and no newer payment exists, extend one period (D6).
- [ ] Remove the 5-row `recoverExpiredOrgPaymentIfPaidOnPaymongo` auto-apply. Replace it with the super-admin queue plus a single-row reconcile of the newest txn.

**1.6 Client hygiene (F-20, F-13)**

- [ ] `paymongoClient.ts`: 10 s `AbortController` timeout, one retry on 5xx/network for GETs only, `Idempotency-Key` header on creates if PayMongo supports it (verify), typed `PaymongoError` with HTTP status.
- [ ] `addOneMonthClamped()` in a pure module: Jan 31 → Feb 28/29, keeps the original anchor day for later months. Use it everywhere periods are set.

## Phase 2 — Subscription lifecycle correctness

**2.1 Renewal and changes (F-07, F-08)**

- [ ] Renewal amount = current property count × current snapshot rate (D7). Fulfilment of `purpose='renewal'` always extends from `max(now, current_period_end)` and never counts as a "change".
- [ ] Persist `purpose` on `org_payment_transactions` (column) instead of inferring it in fulfilment.
- [ ] Change checkouts expire after 24 h on our side. At fulfilment, recompute proration with `now`; if the recomputed amount is higher than what was paid, still apply (we honour the quote) but log the delta. Show "Quote valid for 24 hours" in the review dialog.
- [ ] Properties added mid-cycle: decide and document whether they are covered until renewal for free (current behaviour, verify) or need a change checkout. Recommendation: covered until renewal, charged at renewal.

**2.2 Downgrade at period end (F-14, D3)**

- [ ] Add `scheduled_plan_id`, `scheduled_change_at` (or reuse `cancel_at_period_end` for to-Free). `apply-org-plan-downgrade` schedules instead of applying.
- [ ] Cron applies scheduled changes at `current_period_end`, before creating the next renewal link. The renewal link then uses the new plan price.
- [ ] Host can undo a scheduled downgrade until it applies. Upgrading clears it.
- [ ] Emails: "Your plan changes to X on <date>" at schedule time and on apply.
- [ ] Keep the existing guards: no self-serve downgrade while `past_due`; suspended can go to Free immediately.

**2.3 Dunning (F-10, F-11, F-12, F-21, D4, D5)**

> Applies to **manual** billing mode only. Auto-renew subscriptions use PayMongo's retries; see the auto-renew plan.

- [ ] New `org_billing_notices (org_subscription_id, notice_type, period_end, sent_at)` with a unique key, so each reminder sends once per period.
- [ ] Reminder schedule from D4. Each email carries the current checkout link (created or reused by 1.5 rules).
- [ ] Day before suspension: "Access pauses tomorrow" email + in-app notification.
- [ ] `suspended` for `suspended_auto_free_days` (setting, default 30) → move to Free via the existing `cancel_org_subscription_to_free` RPC, email "You're on Free now. Your data is kept."
- [ ] Reward trials: verify `expireHostVerificationRewards` ends at Free with an email, or offers a paid link if the host chose a plan. Add a test.
- [ ] Cron run summary row (`platform_billing_runs`: counters, errors, duration) for the super-admin console and the cron heartbeat.

**2.4 Take side effects off GET (F-15)**

- [ ] `org-plan` GET only reads. Reconcile moves to: (a) the return-from-checkout poll (`?checkout=success`), via a new owner-only `POST reconcile-org-payment`, rate-limited; (b) the cron (pending older than 10 min); (c) super-admin "Reconcile now".

## Phase 3 — Super-admin billing control center

Route: `/admin/billing` (new nav group under Platform), all writes `serveSuperAdmin` + `requireSuperAdminStepUp` + `logSuperAdminAction` + an org `activity_log` event.

**3.1 Needs-attention queue**

- [ ] Tabs: Paid not applied (`failure_reason` set on `paid`), Amount mismatch, Superseded payments, Past due, Suspended, Webhook failures, Stuck pending (> 24 h).
- [ ] Each row: org, plan, amount, provider ref (links to PayMongo dashboard), age, last error, actions.

**3.2 Per-org billing actions** (extend `org-subscriptions-admin`)

| Action                                       | Purpose                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `reconcile_transaction`                      | Poll PayMongo for one txn and apply with the normal guarded path.                                                     |
| `apply_paid_transaction`                     | Apply a paid-but-flagged txn after review (choose: extend same plan, apply plan, or no-op).                           |
| `record_offline_payment`                     | Bank transfer or cash: amount, reference, note. Creates a `paid` txn with `provider='manual'` and extends the period. |
| `cancel_pending_checkout`                    | Expire our row and the PayMongo session/link.                                                                         |
| `resend_billing_link`                        | Create or reuse a link and resend the current-stage email.                                                            |
| `mark_refunded`                              | After refunding in the PayMongo dashboard: amount, reference, reason; optional "revert period".                       |
| `set_status`                                 | Reactivate from suspended, suspend now, cancel to Free, with reason.                                                  |
| `schedule_change` / `clear_scheduled_change` | Manage D3 scheduled changes.                                                                                          |
| `extend_period` (exists)                     | Add `logSuperAdminAction` + activity log (F-22). Guard: new end must be after now.                                    |
| `run_billing_cron` (exists)                  | Add audit log; add dry-run mode returning what would happen.                                                          |

**3.3 Webhook event log**

- [ ] List `processed_paymongo_events` with filters (status, kind, type, date), payload viewer with PII masked, and **Replay** (re-runs dispatch through the same guarded path).

**3.4 Platform settings** (extend `platform_payment_settings`)

- [ ] Rails (Phase 1.3), lead days, grace days, reminder days (D4), `suspended_auto_free_days` (D5), change-quote validity hours.
- [ ] Kill switches: `checkout_paused` (host sees "Payments are paused for maintenance. Try again later."), `ai_topup_enabled` (consumed by the AI top-up plan).
- [ ] Show the PayMongo mode (test/live) and webhook health (last event received, last failure) on the page.

**3.5 Reporting**

- [ ] Revenue summary: collected this month, MRR (sum of live snapshots), past-due amount, refunds. CSV export of transactions.

## Phase 4 — Host billing UX

All on `/org/:orgSlug/plans` Billing tab. Mobile: bottom sheets on phone, 44 px targets (`mobile-responsive`). Copy through `human-copy`.

| State                                           | Banner / UI                                     | Primary action                                     |
| ----------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| Active, renewal > lead days                     | Next payment date and amount                    | none                                               |
| Renewal due (≤ lead days)                       | "Renewal of ₱X due <date>"                      | Pay now                                            |
| Checkout open (pending)                         | "Payment started" + created time                | Resume payment / Start over                        |
| Returned `?checkout=success`, not yet confirmed | Confirming spinner, poll up to 2 min            | then success or "Still checking. We'll email you." |
| Returned `?checkout=cancelled`                  | "Payment cancelled. Nothing was charged."       | Pay now                                            |
| Attempt failed, session open                    | "That payment didn't go through."               | Try again                                          |
| Past due (grace)                                | "Payment overdue. Access pauses on <date>."     | Pay now                                            |
| Suspended                                       | "Paid features are paused. Your data is safe."  | Pay to restore / Switch to Free                    |
| Scheduled downgrade                             | "Changes to X on <date>"                        | Keep current plan                                  |
| Checkout paused (kill switch)                   | "Payments are paused. Try again later."         | none                                               |
| Paid, flagged for review                        | "We received your payment and are checking it." | Contact support                                    |

- [ ] Payment method line: "QR Ph (GCash, Maya, bank apps)" from the server rails list, never hard-coded.
- [ ] Transaction history: status pills with text (not colour only), method, receipt download (D8).
- [ ] Non-owners see status but not pay buttons ("Ask the org owner to pay").
- [ ] Every billing card with editable fields uses `useUnsavedChangesGuard` (none expected; confirm).
- [ ] Delete `planStubPayToast.ts` (F-24).

## Phase 5 — Test plan

### Harness

- [ ] **Pure modules first.** Extract decision logic so it runs without DB: `decideOrgWebhookAction(txn, providerState, event)`, `computeRenewalAmount`, `computeNextPeriod` (`addOneMonthClamped`), `selectReusablePending`, `dunningNoticesDue(sub, now, settings)`, `validateRails`. Deno unit tests in `_shared/*_test.ts` (`bun run test:edge`).
- [ ] **PayMongo fake** `supabase/functions/tests/fixtures/paymongoFake.ts`: stubs `fetch` for checkout create, session GET (open/paid/expired/404/500/timeout), link GET/archive. Plus `signedWebhook(payload, secret, mode)` builder.
- [ ] **Local integration** `supabase/functions/tests/billing*.integration_test.ts` against local Supabase (`_localSupabaseEnv.ts`), seeded org + plans, fake PayMongo. Run as a dedicated script `test:edge:billing` and add to `ci:quality` once stable.
- [ ] **Playwright mocked** `ui/e2e/features/plans/org/orgPlanBillingStates.spec.ts` (one test per Phase 4 state at 375 and 1280) and `ui/e2e/features/admin/superAdminBilling.spec.ts`.

### Scenario matrix

Layer: **U** unit, **I** integration (local DB + fake), **E** Playwright mocked.

| #   | Scenario                                                                 | Expected                                                           | Layer                                    |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------- |
| S01 | First purchase, `checkout_session.payment.paid`                          | Sub active, period = now → +1 month, txn paid, receipt email once  | I                                        |
| S02 | Same payment delivers `payment.paid` and `checkout_session.payment.paid` | Applied once                                                       | I                                        |
| S03 | Same event id delivered twice                                            | Second returns duplicate, no change                                | I                                        |
| S04 | Handler throws (DB error), PayMongo retries                              | Retry reprocesses and applies once (F-01)                          | I                                        |
| S05 | Two retries arrive at once                                               | One claims, other gets 409, applied once                           | I                                        |
| S06 | `payment.failed` then `payment.paid` on same session                     | Applied; failure email not sent (F-02)                             | I                                        |
| S07 | `payment.failed`, session later expires unpaid                           | Txn failed, one failure email                                      | I                                        |
| S08 | Webhook missed, host returns `?checkout=success`                         | Reconcile POST applies once                                        | I + E                                    |
| S09 | Webhook missed, host never returns                                       | Cron reconcile applies after 10 min                                | I                                        |
| S10 | PayMongo GET 500 / timeout during reconcile                              | Txn stays pending, no wrong expiry                                 | U + I                                    |
| S11 | Session expired unpaid                                                   | Txn expired, next click makes a new session                        | I                                        |
| S12 | Paid amount ≠ txn amount                                                 | Flagged `amount_mismatch`, plan unchanged, in admin queue          | I                                        |
| S13 | Test-mode event on live env                                              | Rejected by signature mode check                                   | U                                        |
| S14 | Bad signature / missing header / old timestamp                           | 401 / 400, rate-limited, no DB write                               | U + I                                    |
| S15 | Unknown event type                                                       | 200 `ignored`, logged                                              | I                                        |
| S16 | Unknown `metadata.kind` or missing txn                                   | 200 `ignored`, logged                                              | I                                        |
| S17 | Open link reused when plan, amount, properties match                     | Same URL returned                                                  | I                                        |
| S18 | Property added after link created                                        | Old link expired, new amount                                       | I                                        |
| S19 | Pending link for plan A, host starts plan B                              | A expired (ours and PayMongo), B created                           | I                                        |
| S20 | Host pays stale A after B applied                                        | `superseded_checkout`, no plan change, admin queue                 | I                                        |
| S21 | Two links both paid, same plan renewal                                   | First extends, second flagged overpaid per D6                      | I                                        |
| S22 | Early renewal (period ends in 3 days)                                    | Period extends from old end                                        | U + I                                    |
| S23 | Renewal paid during grace                                                | Period from now, status active, grace cleared                      | I                                        |
| S24 | Renewal paid while suspended                                             | Reactivated, seats reconciled                                      | I                                        |
| S25 | Renewal with a property added mid-cycle                                  | Charged new count, period from old end (F-07)                      | U + I                                    |
| S26 | Upgrade mid-cycle, paid same day                                         | Prorated amount, fresh period                                      | U + I                                    |
| S27 | Upgrade quote paid after 24 h                                            | Rejected expired or recomputed per 2.1                             | I                                        |
| S28 | Downgrade credit exceeds new price                                       | Floor ₱20 rule or scheduled at period end (D3)                     | U                                        |
| S29 | Schedule downgrade to Free, period ends                                  | Free applied at end, no renewal link                               | I                                        |
| S30 | Schedule downgrade, then upgrade                                         | Schedule cleared                                                   | I                                        |
| S31 | Downgrade while past_due                                                 | Blocked with message                                               | U (exists in `orgPlanDowngrade.test.ts`) |
| S32 | Dunning: T-5, T-1, T0, grace day 1, grace last day                       | Each notice sent exactly once across repeated cron runs            | U + I                                    |
| S33 | Grace ends unpaid                                                        | Suspended, seats reconciled, email once                            | I                                        |
| S34 | Suspended 30 days                                                        | Moved to Free, data kept, email                                    | I                                        |
| S35 | Cron runs twice the same day                                             | No duplicate emails, links, or status flips                        | I                                        |
| S36 | Cron: one org throws                                                     | Others still processed, error counted in run row                   | I                                        |
| S37 | Period anchor Jan 31                                                     | Feb 28/29, then Mar 31                                             | U                                        |
| S38 | Rails: DB has `paymaya`, account activates `qrph`                        | Checkout uses `qrph` only                                          | U                                        |
| S39 | Super-admin saves a non-activated rail                                   | 400                                                                | I                                        |
| S40 | `checkout_paused` on                                                     | Host checkout 503 with message, UI banner                          | I + E                                    |
| S41 | `PAYMONGO_SECRET_KEY` missing                                            | 503 "not configured", txn not left pending                         | I                                        |
| S42 | `PUBLIC_GUEST_APP_ORIGIN` missing                                        | 503, clear message                                                 | U                                        |
| S43 | Org has 0 properties                                                     | Checkout blocked                                                   | I (exists in code, add test)             |
| S44 | Non-owner calls checkout / downgrade / reconcile                         | 403                                                                | I                                        |
| S45 | Org deleted with pending txn, webhook arrives                            | 200 ignored                                                        | I                                        |
| S46 | Reward trial ends                                                        | Free (or link) per 2.3, email                                      | I                                        |
| S47 | Super-admin: record offline payment                                      | Txn paid `provider=manual`, period extended, audit + activity rows | I + E                                    |
| S48 | Super-admin: mark refunded with revert                                   | Period reverted, audit rows                                        | I                                        |
| S49 | Super-admin: replay a failed webhook                                     | Applied once                                                       | I                                        |
| S50 | Super-admin: cancel pending                                              | Ours expired, PayMongo session expired                             | I                                        |
| S51 | Parking: webhook after claim released                                    | Manual review, booking not confirmed (shared path with F-01)       | I                                        |
| S52 | Parking: link archived on release                                        | `archivePaymongoPaymentLink` called                                | I                                        |
| S53 | Parking: disburse a needs-review payment                                 | Blocked (F-26)                                                     | I                                        |
| S54 | Host UI: every Phase 4 state renders at 375 / 1280 with the right action | E                                                                  |
| S55 | Host UI: confirming poll times out                                       | "Still checking" copy, no Pay again button                         | E                                        |
| S56 | Host UI: non-owner sees no pay actions                                   | E                                                                  |

### Gates per phase

- `bun run type-check`, `lint`, `check:filenames`, `build`, `test`, `test:edge`, `test:edge:handlers`, new `test:edge:billing`, Playwright specs above, `bun run ci:quality`.
- `mcp__supabase__get_advisors` after each migration.
- Manual run in PayMongo test mode through an ngrok tunnel: S01, S06, S08, S11 with real QR Ph test flows.
- `security-auditor` on the webhook, reconcile POST, and super-admin billing actions.

## Phase 6 — Docs, support, release

- [ ] `docs/architecture/integrations.md`, `edge-functions.md`, `data-model.md`, `overview.md`, `docs/PROJECT.md` (new functions, columns, env `PAYMONGO_ACTIVATED_METHODS`).
- [ ] Route guides: `org/plans.md`, `admin/org-subscriptions.md`, `admin/payment-settings.md`, new `admin/billing.md`, `admin/health.md`.
- [ ] `docs/archive/operations/paymongo-billing-setup.md`: activated rails, webhook events, replay runbook. `incident-response.md`: "payment not applied" runbook.
- [ ] Support content: FAQ on how renewal works (no auto-charge), what happens when late, how to get a receipt, downgrade timing. Run `check:support-content` and `check:ai-knowledge-coverage`.
- [ ] Activity log catalog: `billing.payment_received`, `billing.payment_failed`, `billing.renewal_due`, `billing.past_due`, `billing.suspended`, `billing.moved_to_free`, `billing.downgrade_scheduled`, `billing.offline_payment_recorded`, `billing.refund_recorded` (server + client mirror).
- [ ] Plans/RBAC: billing actions stay owner-only. Super-admin actions on `/admin/*`.
- [ ] Update `production-readiness/modules/plans-billing.md` and `modules/webhooks.md`.

## Rollout order

1. Phase 0 operator checks.
2. Phase 1 (one PR, migrations additive) → dev → test mode run of S01 to S16 → mt-prod (needs `kamewave`).
3. Phase 2 and Phase 3 in parallel PRs. Phase 3.1 queue first so ops can see Phase 1 flags.
4. Phase 4 UI.
5. AI credits top-up (sibling plan) after Phase 1 and 3.4 kill switch land.

## Out of scope

- Automatic card or Maya recurring charges: planned in [`auto-renew-subscription-billing.md`](./auto-renew-subscription-billing.md).
- Automated refunds through the PayMongo API (manual refund + record stays).
- Multi-currency.
- PayMongo Platforms split payouts for parking (tracked in parking readiness).

Back to [planned index](./README.md).
