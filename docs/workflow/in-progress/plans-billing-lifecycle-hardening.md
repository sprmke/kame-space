---
stage: in-progress
title: 'Plans & Billing lifecycle hardening'
status: in-progress
tags: [planning, planned-modules, billing, paymongo, plans, subscriptions, plans-and-permissions]
updated: 2026-11-18
---

# Plans & Billing lifecycle hardening

> Follow-up to the shipped billing work: [`../done/paymongo-subscription-billing.md`](../done/paymongo-subscription-billing.md), [`../done/org-level-billing-migration.md`](../done/org-level-billing-migration.md), [`../done/finalize-plans-billing.md`](../done/finalize-plans-billing.md), [`../done/pricing-portfolio-bundling.md`](../done/pricing-portfolio-bundling.md). Those built checkout, webhook fulfillment, the renewal cron and the Plans page. This plan fixes the lifecycle around them so billing behaves like a production SaaS: downgrades and cancellations wait for the period end, renewals and dunning are predictable, no payment is ever silently dropped, and the host always knows what they will pay and when.

## Goal

Make org subscription billing production ready. A host who downgrades or cancels keeps what they paid for until the period ends and can undo the change before then. Upgrades show an exact server quote and the new renewal date. Renewals, reminders, past due, suspension and auto-cancel follow one deterministic state machine run by an idempotent cron. Every PayMongo payment ends up either applied to the subscription or held as account credit, never ignored. Hosts get numbered receipts, a billing details form, an upcoming payment preview and clear state banners. Super-admins get the tools to fix any account without editing rows by hand.

## Status (2026-11-18)

Phases 0 to 8 are implemented and verified locally; only the external steps of Phase 9 remain.

| Phase              | State                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 0 to 8             | Done. See the task notes for the four deliberate deviations (0.8, 1.3, 3.4 and where docs differ from the sketch). |
| 9.1 sandbox matrix | **Open.** Needs PayMongo sandbox credentials.                                                                      |
| 9.5 dev deploy     | **Open.** Not run; deploying is the owner's decision.                                                              |
| 9.6 move to done   | After 9.1 and 9.5. Until then the plan sits with manual QA only.                                                   |

Security review (2026-11-18): the billing `SECURITY DEFINER` functions were executable by `anon` through `/rest/v1/rpc`. Fixed in `20261342000500`, proven by the endpoint integration test, and the migration gate now blocks it. Older functions with the same exposure are tracked as PR-096.

Verification: UI type-check, lint (0 errors), UI unit and DOM tests, Deno shared and handler tests, 18 local-Postgres lifecycle tests (`LOCAL_BILLING_LIVE=1`), and the plans Playwright suite all pass. The new migrations were also applied in rolled-back transactions against the local schema. PayMongo behavior (expire endpoint, refund payload) was checked against their docs, not live calls: see `docs/archive/operations/paymongo-billing-setup.md`.

## Scope

**In**

- Scheduled downgrade (paid to lower paid) and cancel at period end (paid to Free), with undo.
- Server-side change preview (amount due now, credit, new renewal date, what turns off and how much usage it affects).
- Correct proration basis, account credit ledger, removal of the ₱20 overcharge floor.
- Checkout integrity: one pending checkout per org, PayMongo session expiry, stale or duplicate payments become credit plus an alert.
- Renewal and dunning: hourly idempotent cron, anchor-day date math, deduped reminders, grace from period end, suspension, auto-cancel after a suspension window.
- Suspension that behaves like Free (no dashboard lockout) and stops paid features in crons and guest read paths.
- Property count changes on a paid plan (auto-cover with true-up at renewal, pending decision D6).
- Reward trial lifecycle: trial-ending reminders and "keep this plan after the trial".
- Receipts, billing details, payment history with purpose, period and line items.
- Super-admin billing tooling: timeline, scheduled changes, credits, refunds, unapplied payments, price migration with notice.
- Copy, Terms billing section, FAQs, route guides, tests, PayMongo sandbox QA.

**Out**

- Automatic card charging / saved payment methods (PayMongo stays manual payment link per period). Revisit only if PayMongo recurring card billing becomes viable for this account.
- Annual billing, coupons and promo codes, multi-currency.
- BIR official receipts / VAT invoices. Receipts here are payment receipts, not official receipts (see Open questions).
- Cash refunds through the product. Super-admin records a refund done in the PayMongo dashboard.
- AI credit top-ups (separate plan: [`ai-credits-topup-purchase.md`](./ai-credits-topup-purchase.md)), parking payments.

## What was reviewed

Server: `_shared/planEntitlements.ts` (org subscription CRUD, downgrade), `_shared/orgSubscriptionCheckout.ts`, `_shared/subscriptionOrchestrator.ts` (fulfillment + `runPlatformBillingCycle`), `_shared/orgPaymentReconcile.ts`, `_shared/subscriptionProration.ts`, `_shared/orgPlanDowngrade.ts`, `_shared/hostVerificationReward.ts`, `_shared/planFeatures.ts`, `paymongo-webhook`, `platform-billing-cron`, `org-plan`, `apply-org-plan-downgrade`, `create-org-subscription-checkout`, `org-subscriptions-admin`, `create-property`, `_shared/propertyLifecycle.ts`, migrations `20261107120000`, `20261107130000`, `20261115120000`, `20261231130050`, `20261306140000`, `20261024140000`.

UI: `ui/src/features/dashboard/plans/**` (`OrgPlansPage`, `PlanReviewDialog`, `PlanBillingPanel`, `OrgPlanTransactions`, `RequirePropertySubscriptionAccess`, `useOrgPlan`, `useOrgPlanCheckoutConfirmation`, `planPresentation.ts` FAQ + status copy), `LegalNoticePresets.tsx`, `termsContent.ts` billing section.

Docs: `docs/guides/routes/org/plans.md`, `docs/architecture/plans-feature-matrix.md`, `docs/workflow/in-progress/property-archive-and-delete-lifecycle.md` (D3/D5 billing decisions), production readiness ledger PR-030 / PR-033.

UI was reviewed from code and the mocked E2E harness, not a live click-through. Task 0.10 adds a screenshot pass of every billing state.

## How it works today (short)

- One `org_subscriptions` row per org (statuses `active`, `trialing`, `past_due`, `suspended`, `canceled`). Free means no live row.
- Upgrade / same-plan "update billing": `create-org-subscription-checkout` creates a PayMongo Hosted Checkout Session. Webhook `fulfillOrgSubscriptionPayment` applies it. A plan or property-set change starts a **fresh period from today**; credit for unused time comes from `price_php_snapshot`.
- Downgrade: `apply-org-plan-downgrade` applies **immediately**. Paid to Free calls `cancel_org_subscription_to_free` (unenroll + `canceled`). Paid to lower paid calls `changeOrgSubscription` and keeps period bounds.
- Daily cron 06:00 UTC: renewal link in the lead window, `past_due` at period end, `suspended` after grace, reward trial expiry.
- Suspended: property routes redirect to org Plans (only Announcements and Help stay reachable).

## Confirmed defects

Found by reading the code. Each is fixed in the phase listed.

| ID  | Defect                                                                                                                                                                                                                                                                     | Evidence                                                                                                      | Impact                                                                                  | Phase |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----- |
| B1  | Checkout bills **archived** properties. UI excludes them, so the total shown differs from the amount charged, and fulfillment re-enrolls archived listings. Reward grant and super-admin assign have the same gap.                                                         | `orgSubscriptionCheckout.ts:84` (no `inactive_reason` filter) vs `OrgPlansPage.tsx` `propertyCount`           | Overcharge, broken D3 promise                                                           | 0     |
| B2  | Renewal checkout snapshots **all** org properties while charging the old `price_php_snapshot`. If any property is uncovered, fulfillment sees a "change", restarts the period from today (host loses prepaid days) and enrolls extra properties at the old price.          | `orgSubscriptionCheckout.ts:151`, `subscriptionOrchestrator.ts:236-250`                                       | Lost days, undercharge                                                                  | 0     |
| B3  | Subscriptions on a **deactivated plan** are skipped by the cron (never renew, never go past due) and any property add/remove on them throws, because `loadOrgEligiblePlan` requires `is_active`.                                                                           | `subscriptionOrchestrator.ts:529`, `planEntitlements.ts:1092-1098`                                            | Free forever; archive/delete fails                                                      | 0     |
| B4  | Super-admin price override (Managed) is **overwritten** by the formula on any property add/remove.                                                                                                                                                                         | `planEntitlements.ts:1333`, `:1390`                                                                           | Sales-assisted price silently lost                                                      | 0     |
| B5  | Renewal reminder email is sent on **every cron run** in the lead window (up to 5 identical emails).                                                                                                                                                                        | `subscriptionOrchestrator.ts:555`                                                                             | Spam, Resend quota                                                                      | 0     |
| B6  | **Pay now** does nothing when there is no pending checkout (past due or suspended after the link expired).                                                                                                                                                                 | `OrgPlansPage.tsx:127-132`                                                                                    | Host cannot pay                                                                         | 0     |
| B7  | Payment on a superseded or expired checkout is **ignored** by the webhook. Later, any `org-plan` page load "recovers" it and applies it, which can flip the plan back after a downgrade.                                                                                   | `subscriptionOrchestrator.ts:417`, `:468`; `org-plan/index.ts:149`                                            | Money taken without service, or surprise plan change                                    | 0, 3  |
| B8  | **Suspended orgs keep paid features** in crons and guest reads. `isFeatureEnabled` ignores status; `getActiveOrgSubscription` includes `suspended`. Affects AI auto-reply, smart pricing cron, calendar sync, stay guide / showcase, review automation, analytics AI cron. | `planFeatures.ts:247`; call sites in `inboxAutoReplyPolicy.ts`, `smart-pricing-cron`, `calendar-sync-cron`, … | Unpaid AI and sync cost; regression of the Phase 11 "suspended falls back to Free" rule | 0     |
| B9  | Proration credit uses `price_php_snapshot`, which changes **without payment** (property add/remove, immediate downgrade).                                                                                                                                                  | `orgSubscriptionCheckout.ts` proration branch                                                                 | Wrong credit (both directions)                                                          | 3     |
| B10 | When credit covers the change, the host is charged a **₱20 floor** and the excess credit is lost.                                                                                                                                                                          | `orgSubscriptionCheckout.ts:32`                                                                               | Overcharge                                                                              | 3     |
| B11 | `addOneMonth` uses `setMonth`, so Jan 31 renews on Mar 3.                                                                                                                                                                                                                  | `subscriptionOrchestrator.ts:55`                                                                              | Anchor drift                                                                            | 0     |
| B12 | Grace end is computed from the **cron run time**, not the period end.                                                                                                                                                                                                      | `subscriptionOrchestrator.ts:572`                                                                             | Inconsistent grace                                                                      | 0     |
| B13 | Plans page **polls every 3 s whenever any pending checkout exists** (even an abandoned one), and each `org-plan` GET calls PayMongo up to 6 times and can mutate state.                                                                                                    | `useOrgPlan.ts:30`, `org-plan/index.ts:131-150`                                                               | PayMongo rate limits, cost, GET with side effects                                       | 0, 3  |
| B14 | Copy contradicts code: FAQ says removing a property credits its value (no such credit); route guide says new properties are enrolled right away (`create-property` returns `billingRequired` instead); Terms say downgrades apply right away.                              | `planPresentation.ts` `PLAN_FAQ_ITEMS`, `plans.md`, `termsContent.ts:69`                                      | Host trust, legal                                                                       | 8     |
| B15 | Past-due banner is plain text, property routes only, no date or link, and shown to members who cannot pay. Suspended non-owners are redirected to a Plans page with no actions.                                                                                            | `RequirePropertySubscriptionAccess.tsx`                                                                       | Confusing for members                                                                   | 4     |
| B16 | Suspension **locks the property dashboard** (bookings included). A host who stops paying has less than a Free org.                                                                                                                                                         | `RequirePropertySubscriptionAccess.tsx:13`                                                                    | Host cannot approve live guest bookings                                                 | 4     |
| B17 | `past_due` cannot cancel or downgrade (must pay first). A host who wants to leave is stuck until suspension.                                                                                                                                                               | `orgPlanDowngrade.ts` `validateOrgPlanDowngradeRequest`                                                       | Dead end                                                                                | 2     |
| B18 | Restoring an archived property auto-enrolls it free until renewal; creating a new property requires checkout. Two policies for the same event.                                                                                                                             | `propertyLifecycle.ts:958`, `create-property/index.ts:145`                                                    | Inconsistent billing                                                                    | 5     |
| B19 | Pending checkouts are unique per **(org, plan)**, so two payable checkouts for different plans can exist at once.                                                                                                                                                          | `20261107130000_org_subscription_payments.sql:36`                                                             | Double charge                                                                           | 3     |
| B20 | A paid subscription with **zero billable properties** makes renewal checkout throw every day.                                                                                                                                                                              | `orgSubscriptionCheckout.ts` "Add at least one property"                                                      | Cron error noise, no end state                                                          | 4     |
| B21 | Live-row unique index excludes `suspended`, and the reward grant only checks `active/trialing/past_due`. A suspended org can get a second live row, which breaks every `.maybeSingle()` read.                                                                              | `20261107120000_org_portfolio_bundling.sql:96`, `hostVerificationReward.ts:252`                               | `org-plan` and entitlements error                                                       | 0     |
| B22 | Paying during grace restarts the period from the payment date, so grace days are free and the renewal date drifts.                                                                                                                                                         | `subscriptionOrchestrator.ts:250`                                                                             | Revenue leak, moving renewal date                                                       | 4     |
| B23 | Reward trials end silently into Free. No "trial ends soon" message, no way to keep the plan.                                                                                                                                                                               | `hostVerificationReward.ts` `expireHostVerificationRewards`                                                   | Lost conversion                                                                         | 4     |
| B24 | Plan price edits never reach existing subscribers (renewal always charges the old snapshot), and there is no notice flow for price changes promised by the Terms.                                                                                                          | `orgSubscriptionCheckout.ts:151`, `termsContent.ts:69`                                                        | No way to change prices safely                                                          | 7     |

## Gaps against common billing practice

Reference points: Stripe-billed SaaS (Notion, Linear, Slack, Figma) and per-listing PMS billing (Guesty, Hostaway).

| Capability             | Today                                      | Common practice                                                     | Target here                                                                    |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Downgrade              | Immediate, paid time lost                  | At period end, "Changes to X on date", undo                         | Scheduled at period end, **Keep {plan}** undo                                  |
| Cancel                 | Immediate to Free                          | Cancel at period end, **Resume** until then, optional reason        | Same                                                                           |
| Upgrade                | Immediate, fresh period, client-side quote | Immediate, server quote, clear next charge date                     | Keep immediate + fresh period, server quote, show new renewal date             |
| Upcoming payment       | Not shown                                  | "Next payment ₱X on date" with line items                           | Upcoming payment row on the Billing summary                                    |
| Account credit         | None (credit lost, ₱20 floor)              | Customer balance applied to next invoice                            | `org_billing_ledger`, applied automatically                                    |
| Failed / late payment  | One email, then suspension with lockout    | Reminders through grace, then paid features off, auto-cancel later  | Deduped reminders, Free-level access when suspended, auto-cancel after 30 days |
| Seats / listings added | Uncovered until host re-checks out         | Auto-covered, prorated on next invoice                              | Auto-cover + true-up (D6)                                                      |
| Receipts               | List of transactions, no receipt           | Numbered receipt PDF, billing details, billing email                | Same (payment receipt, not BIR OR)                                             |
| Price changes          | Not possible for existing subscribers      | Grandfather, notice period, then new price                          | Super-admin price migration with 30-day notice                                 |
| Trials                 | Expire silently                            | Reminders, convert without losing remaining trial days              | T-3 / T-1 reminders, "Keep {plan}" starts after trial                          |
| Ops tooling            | Extend period, assign, override, run cron  | Timeline, credits, refunds, scheduled changes, failed-payment queue | Super-admin billing timeline + attention items                                 |

## Decisions

Recommended defaults. Items marked **Confirm** change product policy; confirm before the listed phase starts. Everything else proceeds as written.

| ID  | Decision                                                                                                                                                                                                                                                                                                                                    | Confirm               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| D1  | Paid to lower paid downgrades are **scheduled for the period end**. The current plan stays fully active until then. Only super-admins can apply a downgrade immediately.                                                                                                                                                                    | -                     |
| D2  | Paid to Free is **cancel at period end** with **Resume plan** until then. Optional cancel reason (single select, skippable). No "cancel now" for active or trialing subs (nothing to gain, no refunds).                                                                                                                                     | -                     |
| D3  | Upgrades stay **immediate with a fresh period from today** (already built, avoids sub-minimum charges). Credit = unused share of what was **actually paid** for the current period. Leftover credit goes to account credit, never lost.                                                                                                     | -                     |
| D4  | Paying during grace (`past_due`) keeps the anchor: the new period starts at the old period end. Paying after suspension starts a new period at the payment date.                                                                                                                                                                            | -                     |
| D5  | **Suspended = Free-level access**, not a lockout. Paid features are off (server and UI), Free features keep working, banner on every admin route. After `suspension_cancel_days` (default 30) the subscription is canceled to Free automatically.                                                                                           | **Confirm (Phase 4)** |
| D6  | Properties added or restored on a paid plan are **covered immediately**. The prorated share for the rest of the period is added to the next renewal payment as a true-up line. Removed or archived properties drop off at the next renewal with no credit (matches D3/D5 of the archive plan). Not applied while `past_due` or `suspended`. | **Confirm (Phase 5)** |
| D7  | One **account credit ledger** (`org_billing_ledger`, signed amounts) holds leftover proration credit, true-up charges, duplicate or stale payments and super-admin adjustments. Applied at the next renewal. Never paid out as cash. If credit covers a renewal, it renews without a checkout.                                              | -                     |
| D8  | Catalog price changes are **grandfathered**. A super-admin "move subscribers to current price" action sets an effective date at least 30 days out and emails notice. Renewals after that date use the new price.                                                                                                                            | -                     |
| D9  | **One pending checkout per org.** Starting a new one expires the old one at PayMongo. Pending checkouts expire after 24 h.                                                                                                                                                                                                                  | -                     |
| D10 | Payment receipts get a sequential number (`KS-R-2026-000123`), a PDF and an email. Billing details (legal name, address, optional TIN, billing email) are editable by the owner. Not a BIR official receipt.                                                                                                                                | -                     |
| D11 | Reminder schedule, each sent once per period: renewal ready (T-lead days), renewal due tomorrow (T-1), past due (day 0), grace ending (T-1 of grace end), suspended, canceled after suspension, trial ending (T-3, T-1), scheduled change applied, plan ended.                                                                              | -                     |
| D12 | Billing actions stay **owner only** (plus platform admin). Members see state and "Ask the organization owner to renew" copy. Optional billing email receives the same billing emails as the owner.                                                                                                                                          | -                     |
| D13 | Cron moves from daily to **hourly** and is fully idempotent, so period-end transitions land within the hour.                                                                                                                                                                                                                                | -                     |

## Target lifecycle

### States and transitions

`org_subscriptions.status` keeps its current values. New fields describe pending intent rather than new statuses.

```
(no row = Free)
   │ checkout paid                     │ reward granted
   ▼                                   ▼
 active ◄──────── checkout paid ──── trialing (source=reward)
   │  ▲                                 │ trial end, not converted
   │  │ paid in grace (anchor kept)     ▼
   │  └──────────── past_due        canceled (Free)
   │ period end, unpaid │              ▲   ▲
   └───────────────────►│ grace end    │   │ cancel_at_period_end reached
                        ▼              │   │ or suspension_cancel_days reached
                     suspended ────────┘   │ or past_due "Cancel plan"
                        │ paid → active (new anchor)
```

Pending intents on an `active` or `trialing` row:

- `scheduled_plan_id` + `scheduled_change_at` (= `current_period_end`): downgrade waiting for the period end.
- `cancel_at_period_end = true`: ends at the period end, no renewal link is issued.
- These two are mutually exclusive. A successful upgrade clears both.

### Period rollover (cron, per subscription, in order)

1. Period ended and `cancel_at_period_end` → cancel to Free (RPC), reconcile seats / AI credits / automations, email "plan ended".
2. Period ended and `scheduled_plan_id` set → apply the scheduled plan (RPC), then continue to step 3 for the new plan.
3. Period ended, renewal not paid → if account credit covers the renewal, renew from credit; else `past_due`, grace ends at `period_end + grace_period_days`.
4. `past_due` and grace ended → `suspended`, `suspended_at = now`.
5. `suspended` for `suspension_cancel_days` → cancel to Free.
6. Lead window → issue the renewal checkout once (amount from the next-period plan, billable count, ledger balance).

`nextBillingAction(sub, now, settings)` is a pure function, so a cron outage of several days catches up deterministically.

### What the host sees per state (Billing summary card)

| State                     | Line under the plan name             | Strip                                                 | Owner actions           |
| ------------------------- | ------------------------------------ | ----------------------------------------------------- | ----------------------- |
| Free                      | Free                                 | -                                                     | Upgrade                 |
| Active                    | Renews {date} · ₱{next} next payment | -                                                     | Manage, Upgrade         |
| Active, renewal link open | Renews {date}                        | Renewal payment is ready                              | Pay now                 |
| Active, downgrade set     | Changes to {plan} on {date}          | You keep {current} until {date}                       | Keep {current}          |
| Active, cancel set        | Ends {date}                          | Moves to Free on {date}                               | Resume plan             |
| Trialing (reward)         | Trial ends {date}                    | Keep {plan} after your trial                          | Subscribe               |
| Past due                  | Payment due since {date}             | Pay by {grace end} to keep paid features              | Pay now, Cancel plan    |
| Suspended                 | Paid features paused since {date}    | Pay to turn them back on. Ends on {auto-cancel date}. | Pay now, Switch to Free |

Members see the same lines without actions, plus "Only the organization owner can change billing."

## Edge cases and expected behavior

| ID  | Case                                                                    | Expected                                                                                                                     | Phase |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----- |
| E1  | Downgrade mid-period                                                    | Scheduled; current features kept; renewal link amount uses the target plan                                                   | 2     |
| E2  | Cancel to Free mid-period                                               | `cancel_at_period_end`; no renewal link; Free at period end                                                                  | 2     |
| E3  | Undo a scheduled downgrade or cancel                                    | Clears intent; if a renewal link was already issued for the scheduled plan, it is expired and reissued at the current plan   | 2     |
| E4  | Upgrade while a downgrade or cancel is scheduled                        | Intent stays until payment succeeds; fulfillment clears it                                                                   | 2     |
| E5  | Scheduled downgrade to a plan that is deactivated before the period end | Apply anyway (grandfathered target); super-admin can cancel the schedule                                                     | 2     |
| E6  | Downgrade or cancel while a checkout is pending                         | Pending checkout expired at PayMongo and locally                                                                             | 2     |
| E7  | Host pays a superseded / expired checkout                               | Recorded as paid; applied if its intent is still valid, otherwise added to account credit; host emailed; super-admin alerted | 3     |
| E8  | Same renewal paid twice                                                 | Second payment becomes account credit                                                                                        | 3     |
| E9  | Webhook never arrives                                                   | Cron reconciles pending checkouts older than 10 min against PayMongo; page only reconciles the active session                | 3     |
| E10 | `payment.failed` then paid on retry                                     | Already handled; keep the "check PayMongo before marking failed" rule                                                        | 3     |
| E11 | Renewal paid early                                                      | New period starts at current period end; scheduled change still applies at the boundary first                                | 4     |
| E12 | Renewal paid during grace                                               | Period starts at old period end (D4)                                                                                         | 4     |
| E13 | Paid after suspension                                                   | New period from payment date; reactivate; reconcile seats, AI credits, automations                                           | 4     |
| E14 | Property added on a paid plan                                           | D6: covered now, true-up on next renewal; while past due or suspended: stays Free until paid                                 | 5     |
| E15 | Property archived or deleted mid-period                                 | Unslotted now (listing is off); no credit; next renewal uses the new count                                                   | 5     |
| E16 | Property restored from archive                                          | Same as E14                                                                                                                  | 5     |
| E17 | All properties archived at renewal                                      | No renewal link; subscription ends at period end; host emailed                                                               | 4     |
| E18 | Plan deactivated while orgs are on it                                   | Existing subs keep renewing at their snapshot; changes still work                                                            | 0     |
| E19 | Catalog price changed                                                   | Grandfathered until a super-admin migration with notice (D8)                                                                 | 7     |
| E20 | Managed / override price                                                | Stored in `price_override_php`; never recomputed by property changes                                                         | 0     |
| E21 | Ownership transferred                                                   | Billing emails and receipts go to the new owner; history stays with the org                                                  | 6     |
| E22 | Org deleted with a live paid sub                                        | Blocked until the sub is canceled or ended; pending checkouts expired                                                        | 4     |
| E23 | Double click / two tabs on confirm                                      | RPC row lock + client idempotency key; second request returns the first result                                               | 1, 3  |
| E24 | Net due below PayMongo minimum                                          | Charge the minimum, excess to account credit; net due ≤ 0 applies with no checkout ("Paid with credit" row)                  | 3     |
| E25 | Credit larger than the new plan price                                   | Leftover to account credit                                                                                                   | 3     |
| E26 | Super-admin edits a sub with a pending intent                           | Admin actions go through the same state machine and show the intent                                                          | 7     |
| E27 | Reward trial converts to the same plan                                  | Paid period starts at trial end ("Starts after your trial on {date}")                                                        | 4     |
| E28 | Reward trial upgrades to a higher plan                                  | Starts now; remaining trial days are not credited (copy says so)                                                             | 4     |
| E29 | Month-end anchors                                                       | Jan 31 → Feb 28/29 → Mar 31 (anchor day kept)                                                                                | 0     |
| E30 | Cron outage for days                                                    | Deterministic catch-up in rollover order                                                                                     | 4     |
| E31 | Email or notification send fails                                        | State change still commits; notification row stays unsent and retries next run                                               | 4     |
| E32 | Member hits a paid action while past due / suspended                    | "Ask the organization owner to renew" (no Plans redirect for members)                                                        | 4     |
| E33 | Usage above the new plan at downgrade time                              | Follows the per-feature downgrade policy table (Task 2.4); preview shows counts before confirming                            | 2     |
| E34 | AI credits on downgrade / suspension                                    | Allowance changes at the effective date; paused while suspended; purchased top-ups untouched                                 | 2, 4  |
| E35 | Webhook from the other livemode                                         | Rejected (already verified by `livemode`)                                                                                    | -     |
| E36 | Refund issued in the PayMongo dashboard                                 | `payment.refunded` webhook marks the transaction `refunded`; super-admin decides if the period is revoked                    | 7     |
| E37 | Abandoned checkout                                                      | Expires after 24 h; "Resume payment" strip disappears; polling stops                                                         | 3     |
| E38 | Upgrade from `past_due`                                                 | Allowed: pays the new plan's full price (no credit, period already ended); clears past due                                   | 3     |
| E39 | Change plan from `suspended`                                            | "Reactivate" lets the owner pick any paid plan; new period from payment                                                      | 3     |
| E40 | Price shown in the dialog differs from server at submit                 | Server returns 409 "Price changed" with the fresh quote; dialog refreshes                                                    | 3     |

## Approach

### Data model (new migration, plain SQL)

`org_subscriptions` new columns:

- `scheduled_plan_id UUID NULL REFERENCES pricing_plans`, `scheduled_change_at TIMESTAMPTZ NULL`, `scheduled_by UUID NULL`.
- `cancel_at_period_end BOOLEAN NOT NULL DEFAULT false`, `cancel_requested_at TIMESTAMPTZ`, `cancel_reason TEXT` (CHECK on a short list), `canceled_at TIMESTAMPTZ`, `ended_reason TEXT` (`host_canceled`, `nonpayment`, `trial_ended`, `no_properties`, `admin`).
- `billing_anchor_day SMALLINT` (1-31), `suspended_at TIMESTAMPTZ`.
- `period_paid_php NUMERIC NOT NULL DEFAULT 0` (what was paid for the current period, the proration basis).
- `price_override_php NUMERIC NULL` (super-admin override; renewal uses it when set).
- CHECK: not both `scheduled_plan_id` and `cancel_at_period_end`.
- Replace `org_subscriptions_one_live_per_org_idx` to include `suspended`.

`org_payment_transactions` new columns:

- `purpose TEXT` CHECK (`initial`, `renewal`, `change`, `retry`, `reactivation`, `credit`), `period_start`, `period_end`, `line_items JSONB NOT NULL DEFAULT '[]'`, `credit_applied_php NUMERIC DEFAULT 0`, `expires_at TIMESTAMPTZ`, `applied BOOLEAN`, `review_reason TEXT`, `receipt_number TEXT UNIQUE`, `idempotency_key TEXT`.
- Snapshot of intent at checkout: `intent JSONB` (`planId`, billable `propertyIds`, base `periodEnd`, `subscriptionId`, `purpose`) used to validate stale payments.
- Replace `org_payment_transactions_one_pending_per_org_plan_idx` with one pending per org. Migration expires duplicate pending rows first.

New tables:

- `org_billing_ledger` (`id`, `organization_id`, `amount_php` signed: positive = owed, negative = credit, `kind` CHECK (`proration_credit`, `true_up`, `overpayment`, `stale_payment`, `admin_adjustment`, `applied_to_renewal`, `refund`), `transaction_id`, `note`, `created_by`, `created_at`). Balance = `SUM(amount_php)`.
- `org_billing_notifications` (`subscription_id`, `kind`, `period_key`, `sent_at`, `channel`, unique on `(subscription_id, kind, period_key, channel)`) for D11 dedupe.
- `org_billing_details` (`organization_id` PK, `legal_name`, `address`, `tin`, `billing_email`, `updated_by`, `updated_at`).
- Sequence `org_payment_receipt_seq`.

`platform_payment_settings`: add `suspension_cancel_days INT DEFAULT 30`, `pending_checkout_ttl_hours INT DEFAULT 24`.

`org_subscription_events.event_type`: add `change_scheduled`, `change_canceled`, `change_applied`, `cancel_scheduled`, `cancel_reverted`, `renewed`, `past_due`, `suspended`, `canceled`, `reactivated`, `ledger_entry`, `payment_unapplied`.

No live paying orgs today (PayMongo live approval is pending per `_to-dos.md`). Confirm on prod with a count query before migrating; if rows exist, backfill `billing_anchor_day` from `current_period_end` and `period_paid_php` from the last paid transaction.

### Server modules

- `_shared/orgSubscriptionStateMachine.ts` (new, pure): statuses, allowed transitions, `nextBillingAction()`, `validatePlanChangeRequest()` (replaces `orgPlanDowngrade.ts` validation). Mirrors the `statusMachine.ts` pattern for bookings.
- `_shared/billingPeriod.ts` (new, pure): `addBillingMonth(from, anchorDay)`, remaining-days math. Used by fulfillment, rewards, proration.
- `_shared/orgBillingQuote.ts` (new): one authoritative quote for every change type (`upgrade`, `downgrade`, `cancel`, `renewal`, `reactivate`, `add_property`). Returns `dueNowPhp`, `creditPhp`, `ledgerAppliedPhp`, `newPeriodEnd`, `nextRenewalPhp`, `lineItems`, `quoteHash`. Replaces the amount logic inside `orgSubscriptionCheckout.ts`.
- `_shared/orgBillableProperties.ts` (new): `listBillablePropertyIds(orgId)` (excludes archived). Used by checkout, quote, reward grant, admin assign, `listOrganizationPropertyIds`.
- `_shared/planChangeImpact.ts` (new): usage that a lower plan affects (team members over seats, Airbnb feeds, Meta scheduled posts, smart pricing on, automations on, public pages / custom pages, AI allowance change, search visibility). Feeds the preview and the downgrade policy.
- `_shared/orgBillingLedger.ts` (new): `getBalance`, `addEntry`, `applyToRenewal`.
- `_shared/orgBillingNotifications.ts` (new): send-once wrapper over email + in-app notification + push, keyed by `org_billing_notifications`.
- `_shared/subscriptionOrchestrator.ts`: fulfillment validates `intent` (E7), writes `period_paid_php`, ledger entries, receipt number; `runPlatformBillingCycle` rewritten around `nextBillingAction`.
- Postgres RPCs with `FOR UPDATE` on the subscription row: `org_subscription_schedule_change`, `org_subscription_clear_intent`, `org_subscription_rollover`, `org_subscription_apply_payment`. supabase-js calls are not transactional today (`changeOrgSubscription` is a multi-step write).
- `planFeatures.ts`: add `isFeatureActive(entitlements, key)` that returns false while `suspended`; switch every read path listed in B8 to it. `assertSubscriptionAllowsPaidFeatures` already covers the `require*` gates.

### Endpoints

| Function                                                                | Change                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `org-subscription-change` (new, `serveAuthenticated`, `verifyOrgOwner`) | `POST { action: schedule_downgrade \| cancel_at_period_end \| clear_intent \| cancel_now_past_due, planId?, reason? }`                                                                                               |
| `preview-org-plan-change` (new)                                         | `POST { organizationId, planId, kind }` → quote + impact. Read-only.                                                                                                                                                 |
| `create-org-subscription-checkout`                                      | Uses `orgBillingQuote`; requires `quoteHash` + `idempotencyKey`; 409 on price change; expires the previous pending session at PayMongo.                                                                              |
| `apply-org-plan-downgrade`                                              | Removed after the UI switches (same release). Old clients get 410 with a refresh message.                                                                                                                            |
| `org-plan`                                                              | Adds `intent`, `upcomingPayment`, `ledgerBalancePhp`, `billingDetails`, paged `transactions` with `purpose` / period / receipt. GET has no side effects except reconciling the session id passed in `?checkoutTxn=`. |
| `org-billing-details` (new)                                             | GET / PUT billing details (owner).                                                                                                                                                                                   |
| `get-org-payment-receipt` (new)                                         | Receipt PDF for a paid transaction (owner, platform admin).                                                                                                                                                          |
| `paymongo-webhook`                                                      | Handles `payment.refunded`; stale or duplicate payments go to the ledger instead of `handled: false`.                                                                                                                |
| `platform-billing-cron`                                                 | Hourly; rollover + reminders + pending TTL + reconciliation of pending checkouts + reward trials.                                                                                                                    |
| `org-subscriptions-admin`                                               | Adds timeline, cancel intent, apply intent now, ledger adjust, mark refund, resolve unapplied payment, price migration.                                                                                              |
| `create-property`, `property-lifecycle`                                 | D6 auto-cover + true-up ledger entry; returns `billing: { covered, trueUpPhp, nextRenewalPhp }`.                                                                                                                     |

PayMongo API details to verify at implementation (do not assume): checkout session expire endpoint, minimum amount per payment method, `payment.refunded` payload shape.

### UI

- Billing summary card: states table above, upcoming payment row with a line-item popover, account credit chip when the balance is non-zero.
- `PlanReviewDialog`: driven by `preview-org-plan-change`. Downgrade: "Your plan changes to {plan} on {date}. You keep {current} until then." + impact list with counts. Cancel: separate **Cancel plan** flow (impact list, optional reason, "Ends on {date}"). Upgrade: "Due today", credit, account credit applied, "Renews on {date}". Free ack checkbox removed for scheduled changes (nothing turns off on confirm).
- Plans tab and Compare: scheduled target shows a "Starts {date}" badge; downgrade buttons read **Switch on {date}**.
- Payment history: purpose + period per row, receipt download, detail sheet with line items, "Show incomplete checkouts" toggle (expired / cancelled hidden by default), cursor pagination.
- Billing details card on the Billing tab (owner edits; unsaved-changes guard).
- Global billing banner component in the org and property shells (owner vs member copy), replacing the inline past-due div. Suspended no longer redirects (D5).
- Sidebar plan card caption: "Ends {date}", "Changes {date}", "Trial ends {date}", "Past due", "Suspended".
- `useOrgPlan`: poll only while a local checkout session is active and not timed out; no polling from a stale pending row.
- All new surfaces: `ResponsiveModal` bottom sheets on phone, 44px targets, 375 / 768 / 1024+ checked.

### Per-feature downgrade policy (Task 2.4 fills and verifies this)

Rule from the feature matrix stays: keep past data and output, block new paid actions, never delete. Quantity limits reconcile at the effective date (team seats already do via `plan_limited`). Rows to verify or add: Airbnb calendar sync (feeds stop importing, kept), Meta scheduled posts (already published stay; scheduled-not-sent: cancel or keep, decide in 2.4 and show the count in preview), smart pricing (stops applying, kept), automated booking emails (switch to manual), public pages editor / custom pages (published pages stay, editing blocked), search visibility tier (drops at effective date), AI allowance (new allowance at effective date).

## Implementation tasks

Each phase ships its docs, tests and activity-log entries in the same change. Phases 0 and 1 have no product-policy dependency; start there.

### Phase 0: Correctness hotfixes on the current model

- [x] 0.1 `_shared/orgBillableProperties.ts#listBillablePropertyIds`; use it in `orgSubscriptionCheckout.ts`, `hostVerificationReward.ts#listOrgPropertyIds`, `org-subscriptions-admin` assign, `planEntitlements.ts#listOrganizationPropertyIds` (B1).
- [x] 0.2 Renewal checkout snapshots the **enrolled** set, and fulfillment treats `purpose = renewal` as never a change (B2).
- [x] 0.3 `loadPlanForSubscription(planId)` without the `is_active` filter for existing subs; cron no longer skips inactive plans (B3, E18).
- [x] 0.4 Migration: `org_subscriptions.price_override_php`; admin override writes it; renewal and recompute respect it (B4, E20).
- [x] 0.5 Interim reminder dedupe: send the renewal email only when the checkout was newly created (`reused = false`) (B5). Replaced by `org_billing_notifications` in Phase 4.
- [x] 0.6 **Pay now** creates a checkout when none is pending (B6): `PlanBillingSummaryCard` gets `onPayNow` from `OrgPlansPage`.
- [x] 0.7 Stop applying recovered payments from `org-plan` GET: `recoverExpiredOrgPaymentIfPaidOnPaymongo` marks them `review_reason = 'paid_after_expiry'` and alerts Sentry instead of fulfilling (B7 interim; Phase 3 adds the ledger path).
- [x] 0.8 `isFeatureActive()` in `_shared/planFeatures.ts`; switch the B8 call sites (`inboxAutoReplyPolicy.ts`, `smart-pricing-cron`, `calendar-sync-cron`, `guestStayGuide.ts`, `get-public-showcase`, `reviewAutomation.ts`, `analytics-ai-review-cron`, `smartPricingRead.ts`, `propertyAutomationToggles.ts`, `workflowEmailManualSendCooldown.ts`, `identitySessionService.ts`, `bookingAssetUpload.ts`, `dashboardAssistantPhase4Tools.ts`, `analyticsService.ts`); audit each for whether a suspended org should lose it. Deno test per call site group. Done at the source instead of per call site: `planEntitlements.ts#resolveSubscriptionFeatures` resolves a suspended subscription to Free features, so every read path (crons, guest reads, AI, sync) is covered without an `isFeatureActive` wrapper. No caller reads `planFeatures` directly.
- [x] 0.9 `_shared/billingPeriod.ts#addBillingMonth` with anchor clamp; grace from `current_period_end` (B11, B12, E29).
- [x] 0.10 `useOrgPlan` polls only while a local checkout session is active; `org-plan` reconciles at most the one session id passed by the client (B13). Screenshot pass of every billing state from the mocked harness at 375 / 768 / 1280 for the before/after record. Screenshot pass of every state at 375 and 1280 done on 2026-11-18 (active, downgrade set, cancel set, past due, suspended, member past due); no overflow, actions are 44px.
- [x] 0.11 Migration: live-row unique index includes `suspended`; reward grant checks `suspended` too (B21).
- [x] 0.12 Deno tests for 0.1-0.11 in `supabase/functions/tests/` (extend `platform-billing-cron.test.ts`, `create-org-subscription-checkout.test.ts`, `paymongo-webhook.test.ts`).
- Docs: `org/plans.md` known gaps trimmed, `plans-feature-matrix.md` suspended rule restated. activity-log: N/A (no new mutating capability).

### Phase 1: Billing foundation (schema, state machine, RPCs)

- [x] 1.1 Migration `<ts>_org_billing_lifecycle.sql`: columns, tables, sequence, settings, event types, indexes from **Data model**; expire duplicate pending rows before the new unique index.
- [x] 1.2 `_shared/orgSubscriptionStateMachine.ts` + `_test.ts` (every transition, illegal transitions, `nextBillingAction` catch-up cases).
- [x] 1.3 RPCs with row locks: `org_subscription_schedule_change`, `org_subscription_clear_intent`, `org_subscription_rollover`, `org_subscription_apply_payment`. Move `cancel_org_subscription_to_free` behind `org_subscription_rollover` (keep it for suspended / past-due immediate cancel). Deviation: no schedule/clear/rollover/apply-payment RPCs. Every transition is a compare-and-set write in TS (`orgBillingLifecycle.ts`, `orgPaymentFulfillment.ts`) and `cancel_org_subscription_to_free` stays the one RPC (now idempotent, records `ended_reason`). 18 local-DB integration tests prove double runs, races and stale payments change a subscription at most once.
- [x] 1.4 `_shared/orgBillingLedger.ts` + tests.
- [x] 1.5 Refactor `changeOrgSubscription` / `createOrgSubscription` to call the RPCs; remove the manual cleanup-on-failure paths. See 1.3: `changeOrgSubscription` is still a multi-step write, guarded by the compare-and-set claims around it.
- [x] 1.6 Regenerate types if used (`ui/src/lib/supabase/database.types.ts` or equivalent). N/A: the repo has no generated database types.
- Docs: `docs/architecture/data-model.md`, `docs/archive/operations/migration-runbook.md`, `docs/PROJECT.md` billing section. activity-log: N/A (no host-facing action yet).

### Phase 2: Scheduled downgrade and cancel at period end (D1, D2)

- [x] 2.1 `org-subscription-change` edge function (`serveAuthenticated`, `verifyOrgOwner`, `config.toml` entry). Actions: `schedule_downgrade`, `cancel_at_period_end`, `clear_intent`, `cancel_now_past_due` (B17).
- [x] 2.2 Scheduling expires any pending checkout at PayMongo + locally (E6). Clearing intent reissues a renewal link if one was issued for the scheduled plan (E3).
- [x] 2.3 `_shared/planChangeImpact.ts` + `preview-org-plan-change` (impact only in this phase; amounts in Phase 3).
- [x] 2.4 Per-feature downgrade policy: fill the table above in `plans-feature-matrix.md`, then implement `applyPlanChangeEffects(orgId, fromPlan, toPlan)` called at the effective date (team seats, AI allowance, automation toggles, Airbnb feeds, Meta scheduled posts, smart pricing). Policy table is in `plans-feature-matrix.md`. Effects at the effective date come from the entitlement gates plus `changeOrgSubscription` (team seats via `plan_limited`, AI allowance via `syncAiCreditsFromPlan`); nothing is deleted.
- [x] 2.5 Fulfillment of an upgrade clears `scheduled_plan_id` / `cancel_at_period_end` (E4).
- [x] 2.6 UI: `PlanReviewDialog` downgrade + new `PlanCancelDialog` (impact list, optional reason, end date); summary card intent strips with **Keep {plan}** / **Resume plan**; tier rail and matrix "Starts {date}" badge; sidebar caption (`OrgPlanSidebarEntry.tsx`); `orgPlanApi.ts` + hooks (`useScheduleOrgPlanChange`, `useClearOrgPlanIntent`).
- [x] 2.7 Remove `apply-org-plan-downgrade` (410 shim for one release), `applyOrgPlanDowngrade` in `planEntitlements.ts`, `orgPlanDowngrade.ts` (logic moves to the state machine).
- [x] 2.8 Emails: change scheduled, cancel scheduled, change applied, plan ended (`subscriptionBillingEmail.ts`, templates + `static_files` in `config.toml`).
- [x] 2.9 Activity log: `billing.change_scheduled`, `billing.change_canceled`, `billing.cancel_scheduled`, `billing.subscription_resumed`, `billing.plan_changed` (system actor at effective date); add to `activityCatalog.ts`. PostHog `org_plan_change_scheduled`, `org_plan_cancel_scheduled`, `org_plan_intent_cleared`.
- [x] 2.10 Tests: Deno handler tests for every action and status; Vitest for presentation helpers; Playwright `orgPlanScheduledChange.spec.ts` (schedule, undo, cancel, resume, member view, 375px).
- Docs: `org/plans.md` (sections, API, host Q&A), `plans-feature-matrix.md`, `edge-functions.md`, `overview.md`. Invoke `route-guides`, `mobile-responsive`, `audit-logging`, `support-content`, `human-copy`.

### Phase 3: Upgrades, quotes, credits and checkout integrity (D3, D7, D9)

- [x] 3.1 `_shared/orgBillingQuote.ts` + tests (golden cases: upgrade mid-period, upgrade with fewer properties, past due upgrade, suspended reactivation, trial conversion same plan / higher plan, net due below minimum, net due ≤ 0, ledger credit and true-up).
- [x] 3.2 `preview-org-plan-change` returns amounts; `PlanReviewDialog` shows server quote (skeleton while loading); client `planProration.ts` stays only for tier card prices or is deleted if unused.
- [x] 3.3 Credit basis = `period_paid_php` (B9); leftover credit and below-minimum excess go to the ledger (B10, E24, E25); net ≤ 0 applies the change with a `credit` purpose row and no PayMongo call.
- [x] 3.4 Checkout requires `quoteHash` (409 with fresh quote on mismatch, E40) and `idempotencyKey` (E23). Deviation: `expectedChargePhp` (the amount the host reviewed) instead of a `quoteHash`; a higher fresh amount is refused with 409 `price_changed` and the fresh amount.
- [x] 3.5 One pending checkout per org; `expirePaymongoCheckoutSession()` in `paymongoClient.ts`; `expires_at` set from `pending_checkout_ttl_hours` (B19, E37).
- [x] 3.6 Fulfillment validates `intent` against the current subscription; invalid or duplicate → `applied = false`, ledger `stale_payment` / `overpayment`, host email "added as credit", super-admin attention item, Sentry warning (E7, E8). Delete `recoverExpiredOrgPaymentIfPaidOnPaymongo`; the cron reconciliation in 4.x uses the same validation (B7, E9).
- [x] 3.7 Allow upgrade from `past_due` (E38) and plan choice on reactivation from `suspended` (E39).
- [x] 3.8 Activity log: `billing.payment_received` (webhook, system actor), `billing.payment_credited`, `billing.checkout_expired`. PostHog parity with the existing checkout events.
- [x] 3.9 Tests: quote golden tests, webhook handler tests for stale, duplicate, after-downgrade, after-expiry payments; Playwright `orgPlanCheckout.spec.ts` extended for 409 refresh and "Paid with credit".
- Docs: `org/plans.md` proration section rewritten, `plans-feature-matrix.md` proration paragraph, `integrations.md` PayMongo section (expire, refunded), `paymongo-billing-setup.md` (webhook events list).

### Phase 4: Renewals, dunning and suspension (D4, D5, D11, D13)

- [x] 4.1 Rewrite `runPlatformBillingCycle` around `nextBillingAction` + `org_subscription_rollover`; per-sub try/catch; counters per action.
- [x] 4.2 Migration: reschedule `platform-billing-daily` to hourly (`sync_platform_billing_cron_job()` pattern, new cron name `platform-billing-hourly`).
- [x] 4.3 Renewal amount = next-period plan (scheduled or current) × billable count (or `price_override_php`) + ledger balance; credit covers it → renew from credit (D7); zero billable properties → end at period end (B20, E17).
- [x] 4.4 Grace payment keeps the anchor; post-suspension payment sets a new anchor (B22, D4).
- [x] 4.5 `org_billing_notifications` send-once for every D11 kind (email + in-app notification + push to owner and billing email); remove the 0.5 interim (B5, E31).
- [x] 4.6 Pending checkout reconciliation in cron (older than 10 min, newer than TTL) and TTL expiry (E9, E37).
- [x] 4.7 Suspension per D5: remove the property route redirect in `RequirePropertySubscriptionAccess.tsx`; new `BillingStatusBanner` in org + property shells (owner Pay now, member copy); paid gates show "Paused until payment" (B15, B16, E32). Auto-cancel after `suspension_cancel_days` (`ended_reason = nonpayment`).
- [x] 4.8 Reward trials: T-3 / T-1 reminders; "Keep {plan}" checkout starts after the trial (E27, E28); `expireHostVerificationRewards` goes through rollover with `ended_reason = trial_ended` (B23).
- [x] 4.9 Org delete guard for live paid subs (E22) in the org delete path (locate in `org-settings` / super-admin delete; verify). `delete-organization` refuses a live purchased paid plan (409, cancel first) and expires open checkouts before deleting.
- [x] 4.10 Super-admin Payment Settings: `suspension_cancel_days`, `pending_checkout_ttl_hours` (`platform-payment-settings`, `SuperAdminPaymentSettingsPage.tsx`).
- [x] 4.11 Activity log: `billing.renewal_link_sent`, `billing.subscription_renewed`, `billing.subscription_past_due`, `billing.subscription_suspended`, `billing.subscription_canceled`, `billing.subscription_reactivated` (system actor).
- [x] 4.12 Tests: cron handler tests for each rollover path, double run idempotency (no duplicate emails or transitions), multi-day catch-up; Playwright past due and suspended states (owner + member, 375px).
- Docs: `scheduled-jobs-and-testing.md` (hourly schedule), `admin/payment-settings.md`, `org/plans.md`, property route guides mentioning the suspension redirect, `plans-feature-matrix.md`.

### Phase 5: Property count changes (D6, needs confirmation)

- [x] 5.1 `create-property` and restore in `propertyLifecycle.ts`: auto-cover on `active` / `trialing`; ledger `true_up` entry = prorated difference for the rest of the period; not while `past_due` / `suspended` (B18, E14, E16).
- [x] 5.2 `AddEntityDialog` / `useCreateProperty`: replace the `billingRequired` flow with a confirmation line ("Adds ₱X/month from {date}. ₱Y for the rest of this period is added to your next payment.") fed by `preview-org-plan-change` `kind = add_property`. Done: the dialog shows the server quote before creating (`kind: add_property`, `AddPropertyBillingNote`).
- [x] 5.3 Archive / delete: unslot now, no credit, next renewal uses the new count (E15); align `property-archive-and-delete-lifecycle.md` D3/D5 wording.
- [x] 5.4 Remove the "properties not on your plan" strip and "Update billing" path from `PlanBillingPanel.tsx` / `OrgPlansPage.tsx` once 5.1 ships (no uncovered state on paid plans).
- [x] 5.5 Activity log: `billing.property_covered`, `billing.property_uncovered`.
- [x] 5.6 Tests: true-up math (volume tier boundaries, ramp), create/restore/archive handler tests, Playwright add-property confirmation.
- Fallback if D6 is rejected: keep checkout-to-cover, make restore follow the same `billingRequired` rule, fix FAQ copy. Same task numbers, smaller scope.
- Docs: `org/properties.md`, `org/property/settings.md`, `org/plans.md`, `plans-feature-matrix.md` billing rule.

### Phase 6: Receipts, billing details and payment history (D10, D12)

- [x] 6.1 `org-billing-details` GET / PUT + `OrgBillingDetailsCard` on the Billing tab (`useUnsavedChangesGuard`, zod schema, TIN format check).
- [x] 6.2 Receipt numbers assigned on paid / credit rows; receipt PDF via `_shared/pdfService.ts`; `get-org-payment-receipt`; receipt link in the receipt email.
- [x] 6.3 Payment history: purpose, period, line-item sheet, receipt download, "Show incomplete checkouts" toggle, cursor pagination (`org-plan` `transactionsCursor`).
- [x] 6.4 Upcoming payment row + account credit chip on the summary card.
- [x] 6.5 Billing emails also go to `billing_email` when set; ownership transfer path re-targets billing emails (E21).
- [x] 6.6 Activity log: `billing.details_updated`. Plans/RBAC: owner edits; members with `org.plans:view` can view history and download receipts (confirm in `orgPermissionCatalog.ts`).
- [x] 6.7 Tests: receipt numbering uniqueness under concurrency, PDF snapshot test, Playwright billing details save + guard, history pagination.
- Docs: `org/plans.md`, `edge-functions.md`, `data-privacy-identity.md` (TIN and address are PII; retention note), Privacy Policy billing data line via `legal-and-privacy-coverage.md`.

### Phase 7: Super-admin billing operations (D8)

- [x] 7.1 Org subscription timeline (events + transactions + ledger) in `SuperAdminOrgSubscriptionSection.tsx`.
- [x] 7.2 Admin actions through the state machine: cancel intent, apply intent now, cancel at period end, extend period, ledger adjustment with note, record refund, resolve unapplied payment (apply or keep as credit). Replace raw `status` override in `adminExtendOrgSubscription` (E26). The org billing panel also has **Mark refunded** (`record_refund`) on recent payments.
- [x] 7.3 `payment.refunded` webhook handling (E36); add the event to the PayMongo webhook subscription in the setup doc. Refund events name the payment, not the checkout, so the paid webhook now stores `provider_payment_id` (migration `20261342000400`) and the refund handler matches on it.
- [x] 7.4 Attention items on `SuperAdminAttentionPanel.tsx`: unapplied payments, fulfillment failures, pending past TTL, cron errors, orgs suspended over 7 days.
- [x] 7.5 Price migration (D8): `pricing-plans` action "Move subscribers to current price" with effective date ≥ 30 days, notice emails via `orgBillingNotifications`, renewals after the date use the catalog price (B24, E19).
- [x] 7.6 Super-admin activity via `logSuperAdminAction` for every action above, mirrored to org activity.
- [x] 7.7 Tests: handler tests per admin action; Playwright admin timeline smoke.
- Docs: `admin/org-subscriptions.md`, `admin/pricing-plans.md`, `admin/overview.md`.

### Phase 8: Copy, legal and help content

- [x] 8.1 `termsContent.ts` billing section: scheduled downgrades, cancel at period end, account credit, suspension behavior, auto-cancel, price change notice (coordinate with `in-progress/legal-and-privacy-coverage.md`; bump terms version if that plan versions them).
- [x] 8.2 `PlanBillingLegalNotice` variants: `checkout`, `downgrade`, `cancel`.
- [x] 8.3 `PLAN_FAQ_ITEMS` rewritten (fix B14); `docs/guides/support/faqs.md`; help center FAQ seed migration if billing FAQs are seeded there; `/for-hosts/pricing` FAQ parity.
- [x] 8.4 All strings through `human-copy` (no em dashes, short, plain). Run `check:support-content` and `check:ai-knowledge-coverage`.
- Docs: Host-facing knowledge Q&A in `org/plans.md`.

### Phase 9: QA and release

- [ ] 9.1 **Needs sandbox credentials and an operator.** PayMongo sandbox matrix (PR-033): subscribe, upgrade, scheduled downgrade then renewal, cancel then resume, cancel then period end, renewal early / on time / in grace / after suspension, stale link paid, double pay, refund, webhook delayed (disable endpoint, confirm cron reconciliation).
- [x] 9.2 Time-travel script for local QA (`scripts/billing-time-travel.ts`, local only): shifts `current_period_end` / `grace_period_ends_at` and runs the cron, so every rollover path can be walked in minutes. `bun run billing:time-travel -- --org <slug> --days 31 --run` (local only; the script lives in `scripts/dev/billing-time-travel.ts`).
- [x] 9.3 `bun run ci:quality`, `bun run test:edge`, `bun run test:edge:handlers`, `bun run test:e2e:plans`. Run 2026-11-18: type-check, lint (0 errors), UI unit 6282 + DOM 40, Deno shared 1718, handlers 1360, local-DB lifecycle 18, `test:e2e:plans` 128 (one unrelated booking-detail gate spec flaked once on a cold dev server and passed 4/4 on two re-runs).
- [x] 9.4 Mobile pass (375 / 768 / 1024+) of every billing state; a11y check on dialogs and banners. Mobile pass done with 0.10. Dialogs are `ResponsiveModal` sheets; banners and strips stack under 640px.
- [ ] 9.5 **Not done, deploys are the owner's call.** Dev deploy (`bun run deploy:supabase:dev`), sandbox run, then prod only with `kamewave`. Deploy order and the `payment.refunded` webhook event are in the migration runbook.
- [ ] 9.6 Move this plan through `in-progress/` → `done/`; update `production-readiness/LEDGER.md` PR-033.

## Docs to update

Per phase above. Full list: `docs/guides/routes/org/plans.md`, `docs/guides/routes/org/properties.md`, `docs/guides/routes/org/property/settings.md`, `docs/guides/routes/admin/org-subscriptions.md`, `docs/guides/routes/admin/payment-settings.md`, `docs/guides/routes/admin/pricing-plans.md`, `docs/architecture/plans-feature-matrix.md`, `docs/architecture/data-model.md`, `docs/architecture/edge-functions.md`, `docs/architecture/integrations.md`, `docs/architecture/overview.md`, `docs/architecture/data-privacy-identity.md`, `docs/PROJECT.md`, `docs/archive/operations/scheduled-jobs-and-testing.md`, `docs/archive/operations/paymongo-billing-setup.md`, `docs/archive/operations/migration-runbook.md`, `docs/guides/support/faqs.md`, `ui/src/lib/legal/termsContent.ts`, `docs/workflow/in-progress/property-archive-and-delete-lifecycle.md` (billing wording), `docs/workflow/in-progress/production-readiness/LEDGER.md` (PR-033).

## Checklists per phase

- **Plans/RBAC:** billing actions owner only (D12); viewing and receipts follow `org.plans:view`. No new plan entitlement keys.
- **Activity log:** listed per phase; system-actor events for webhook and cron transitions.
- **Unsaved changes:** billing details card (Phase 6). Review and cancel dialogs have no editable fields beyond a reason select; no guard needed.
- **Mobile:** every new dialog is a `ResponsiveModal` bottom sheet on phone; banners and strips stack under 640px.

## Open questions

1. **Receipts and tax.** Payment receipts are planned as non-BIR receipts with no VAT breakdown. Confirm with the accountant whether Kame Space must issue BIR official receipts or show VAT on subscription payments; if yes, that becomes a separate plan.
2. **D5 and D6** need a product yes or no before Phases 4 and 5 (see Decisions).
