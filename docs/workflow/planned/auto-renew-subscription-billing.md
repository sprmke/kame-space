---
stage: planned
title: 'Automatic monthly subscription billing (PayMongo Subscriptions API)'
status: planned
tags:
  [
    planning,
    planned-modules,
    billing,
    paymongo,
    plans,
    subscriptions,
    super-admin,
    testing,
    production-readiness,
  ]
updated: 2026-11-09
---

# Automatic monthly subscription billing

Hosts subscribe once, PayMongo charges them every month, and they can cancel anytime. This replaces "we email you a payment link every month" as the default. Manual pay-by-link stays as a fallback for hosts who can't use a card or Maya.

Related plans:

- [`payments-paymongo-hardening.md`](./payments-paymongo-hardening.md): shared money-safety fixes. **Its Phase 1 is a prerequisite** (webhook durability, idempotency, rails, amount checks). Its decision D1 ("keep manual renewal") is **superseded by this plan**. Its dunning work (Phase 2.3) now only applies to the manual fallback.
- [`ai-credits-topup-purchase.md`](./ai-credits-topup-purchase.md): one-time AI credit purchases. Separate from the subscription; see "AI credits and the subscription" below.

## TL;DR

1. **PayMongo supports real recurring billing** through its Subscriptions API: Plans, Customers, Subscriptions, and Invoices. PayMongo creates each month's invoice, charges the saved payment method, and retries failed charges once a day up to 3 times.
2. **Supported methods are Visa/Mastercard cards and Maya only.** QR Ph and GCash can't auto-renew. Subscriptions also need **separate activation** by PayMongo support, per method. Nothing ships until both are active on the live account.
3. **Our pricing changes per org** (per-property rate, volume discounts), but a PayMongo Plan has one fixed amount. We keep a cached catalog of PayMongo Plans, one per `(tier, amount)`, and move a subscription to a new Plan when its price changes. PayMongo applies plan changes at the **next** cycle, which matches standard SaaS behaviour.
4. **Mid-cycle upgrades** take effect at once. The prorated difference goes onto the next invoice as an invoice line item, which PayMongo allows on draft invoices. **Downgrades and cancellations** take effect at the end of the paid month.
5. **Copy everywhere says it plainly:** "₱X per month. Renews automatically on the Nth. Cancel anytime." It appears at checkout, in the receipt, on Billing, and in the Terms.
6. **Super-admin** gets full control: subscription status, invoices, retry, update method link, cancel, comp months, switch an org to manual billing, the PayMongo plan catalog, and kill switches.
7. **AI credits stay a one-time purchase.** Hosts can buy anytime, as often as they like, with any active one-time method (QR Ph, card, Maya). They are never added to the subscription.

## What PayMongo gives us (verified 2026-11-09)

Sources: [Subscriptions guide](https://docs.paymongo.com/docs/payment-acceptance-subscriptions), [Account capabilities](https://docs.paymongo.com/docs/account-settings-account-capabilities), [Webhook events](https://docs.paymongo.com/docs/developer-tools-webhooks-events), [Subscription resource](https://docs.paymongo.com/reference/subscription-resource), [Plan resource](https://docs.paymongo.com/reference/plan-resource), [Invoice resource](https://docs.paymongo.com/reference/invoice-resource), [Invoice line items](https://docs.paymongo.com/reference/create-an-invoice-line-item), [Go-live checklist](https://docs.paymongo.com/docs/developer-tools-go-live-checklist), [Card vaulting](https://docs.paymongo.com/docs/payment-acceptance-card-vaulting).

| Fact             | Detail                                                                                                                                                                                      | Impact on us                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Methods          | Cards (Visa/Mastercard) and Maya                                                                                                                                                            | QR Ph users need the manual fallback               |
| Activation       | Separate from payment-method activation, per method, by support only                                                                                                                        | Phase 0 blocker                                    |
| Objects          | `POST /v1/subscriptions/plans`, `POST /v1/customers`, `POST /v1/subscriptions`                                                                                                              | New client functions                               |
| Plan             | Fixed `amount` (centavos), `interval` weekly/monthly/yearly, `interval_count` 1 to 10, optional `cycle_count`, `metadata`                                                                   | Plan per price point                               |
| First payment    | Subscription creation makes the first invoice and a Payment Intent at once. Host must pay within **24 h** or status becomes `incomplete_cancelled`                                          | First-payment flow + timeout handling              |
| Vaulting         | The first payment stores the method for future cycles                                                                                                                                       | No card data on our servers                        |
| Statuses         | `incomplete`, `incomplete_cancelled`, `active`, `past_due`, `unpaid`, `cancelled`                                                                                                           | Map to ours                                        |
| Invoice          | `draft` 1 day before billing (amount adjustable), `open` 12 h later (charge attempted), `paid`, `void`                                                                                      | Line items for proration                           |
| Retries          | Failed invoice → `past_due`, retried once a day up to 3 times → `unpaid`                                                                                                                    | PayMongo runs dunning                              |
| Cancel           | `POST /v1/subscriptions/{id}/cancel` with `cancellation_reason` (`too_expensive`, `missing_features`, `switched_service`, `unused`, `other`). **Immediate**; open invoices stay collectible | We schedule the call ourselves                     |
| Plan change      | `PUT /v1/subscriptions/{id}/plan`. Applies at the **next** cycle                                                                                                                            | Matches downgrade-at-period-end                    |
| Method change    | `PUT /v1/subscriptions/{id}/payment_method`, re-authentication, optional `redirect_url`                                                                                                     | "Update payment method" flow                       |
| Pay open invoice | `POST /v1/subscriptions/invoices/{id}/pay`                                                                                                                                                  | "Retry now" after a method update                  |
| Line items       | `POST /v1/subscriptions/invoices/{id}/line_items`, positive or negative amount                                                                                                              | Proration and credits                              |
| Test cycle       | `POST /v1/subscriptions/{id}/test_cycle` (test keys)                                                                                                                                        | Automated renewal tests                            |
| Events           | `subscription.activated`, `.past_due`, `.unpaid`, `.updated`, `subscription.invoice.created`, `.finalized`, `.paid`, `.payment_failed`, `.updated`                                          | New webhook branch                                 |
| Errors           | `setup_intent.last_setup_error` (example: "Expired card.")                                                                                                                                  | Shown to host                                      |
| Idempotency      | `Idempotency-Key` required on create/modify POSTs                                                                                                                                           | Deterministic keys                                 |
| Customer         | Email and phone must be unique per PayMongo customer                                                                                                                                        | One customer per owner user, not per org           |
| On-demand        | `type: on_demand` plans, Maya only, we trigger each charge                                                                                                                                  | Not used for plans. Possible future AI auto-refill |

**Unknowns to confirm in Phase 0 (test mode):** whether Hosted Checkout can pay a subscription's first Payment Intent (otherwise we build a card form that posts straight to PayMongo with the public key), the exact payload of each `subscription.*` event (whether our `metadata` is echoed), whether a draft invoice is voided when the subscription is cancelled inside the draft window, whether card expiry month/year is readable on the saved method, and PayMongo fees for subscription charges.

## Decisions

| ID  | Decision                            | Recommendation                                                                                                                                                                                                                                                 |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Default billing mode for paid plans | **Auto-renew** (card or Maya). Manual pay-by-link stays available, labelled "Pay each month yourself (QR Ph)".                                                                                                                                                 |
| A2  | Source of truth for access          | Our `org_subscriptions` row. PayMongo events update it. Feature gates never call PayMongo.                                                                                                                                                                     |
| A3  | Upgrade mid-cycle                   | New tier applies at once. Prorated difference is added as a line item on the next draft invoice. If the difference is over a super-admin threshold (default ₱1,000), charge it now with a one-time checkout instead.                                           |
| A4  | Downgrade                           | At the end of the paid month (`PUT …/plan` applies next cycle). Host can undo until then.                                                                                                                                                                      |
| A5  | Cancel                              | "Cancel anytime": access lasts until the paid month ends. We call PayMongo cancel **2 days before** the next billing date (before the draft invoice exists), so the host can undo until then. Cancelling inside those 2 days calls PayMongo at once.           |
| A6  | Failed renewal                      | Follow PayMongo's retries (3 daily). `past_due` keeps features, shows a banner, and emails an "Update payment method" link. `unpaid` → `suspended`. After `suspended_auto_free_days` (default 30) → Free + PayMongo cancel.                                    |
| A7  | Property count changes              | Price for the new count applies from the next cycle (plan swap). Added properties are covered at once; the prorated amount for the rest of the month goes on the next invoice (A3 rules). Removing a property lowers the price from the next cycle, no refund. |
| A8  | Refunds                             | No automatic refunds. Super-admin refunds in the PayMongo dashboard and records it here. Terms say: monthly fees are non-refundable except billing errors. Owner to confirm.                                                                                   |
| A9  | Pre-charge notice                   | Email 3 days before each renewal with amount and date (on by default, super-admin toggle). Receipt after every charge.                                                                                                                                         |
| A10 | Existing manual subscribers         | Not forced. At their next renewal the Billing tab offers "Turn on auto-renew". Paying through auto-renew becomes that period's payment.                                                                                                                        |
| A11 | Annual billing                      | Out of scope now. The schema keeps `interval` so yearly can follow.                                                                                                                                                                                            |
| A12 | Payment card UI                     | Prefer Hosted Checkout if Phase 0 shows it can complete the first invoice. Otherwise a card form that posts to PayMongo with `VITE_PAYMONGO_PUBLIC_KEY` and never sends card data to our servers.                                                              |

## Lifecycle

```
                     host clicks Subscribe
                              │
           create customer (once per owner) + plan (cached) + subscription
                              │
                    status: incomplete (24 h to pay)
              ┌───────────────┴───────────────┐
        first payment ok                not paid in 24 h
              │                               │
   subscription.activated            incomplete_cancelled
   ours: active, period set          ours: back to previous state, "Try again"
              │
   each month: invoice.created (draft, T-1) → finalized (open) → paid
              │                                        │
       invoice.paid: extend period             invoice.payment_failed
                                                       │
                                        past_due (PayMongo retries 3x daily)
                                      ┌────────────────┴───────────┐
                              method updated / retry ok        still failing
                                      │                            │
                                   active                 unpaid → ours: suspended
                                                                    │
                                                   30 days → Free + PayMongo cancel
```

Status map:

| PayMongo                          | Ours (`org_subscriptions.status`)                             | Features               | Host sees                                                                          |
| --------------------------------- | ------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| `incomplete`                      | unchanged (previous plan or Free) + `pending_activation` flag | Previous plan          | "Finish your payment to start <plan>"                                              |
| `incomplete_cancelled`            | unchanged, flag cleared                                       | Previous plan          | "Payment wasn't completed. Nothing was charged."                                   |
| `active`                          | `active`                                                      | Plan                   | Next charge date and amount                                                        |
| `past_due`                        | `past_due`                                                    | Plan                   | "We couldn't charge your card. We'll try again on <date>." + Update payment method |
| `unpaid`                          | `suspended`                                                   | Free limits, data kept | "Paid features are paused." + Update payment method and pay                        |
| `cancelled` (by us at period end) | `canceled` → Free                                             | Free                   | "Your plan ended on <date>." + Resubscribe                                         |

## Data model (new migration, additive)

- `paymongo_customers (user_id PK part, livemode, paymongo_customer_id, email_snapshot, created_at)`: one PayMongo customer per owner user per mode.
- `paymongo_plan_catalog (id, pricing_plan_id, amount_centavos, interval, interval_count, livemode, paymongo_plan_id UNIQUE, created_at)`: unique on `(pricing_plan_id, amount_centavos, interval, interval_count, livemode)`. Plans are never edited, only added.
- `org_subscriptions` new columns: `billing_mode TEXT CHECK IN ('auto','manual') DEFAULT 'manual'`, `provider_subscription_id`, `provider_customer_id`, `provider_status`, `provider_plan_id`, `next_billing_at`, `cancel_at_period_end` (exists, now used), `cancel_requested_at`, `cancellation_reason`, `scheduled_plan_id`, `scheduled_amount_centavos`, `payment_method_brand`, `payment_method_last4`, `payment_method_type` (`card`/`paymaya`), `last_payment_error`, `pending_activation_until`.
- `org_subscription_invoices (id, org_subscription_id, provider_invoice_id UNIQUE, status, amount_centavos, due_date, paid_at, payment_intent_id, attempt_count, last_error, line_items JSONB, raw JSONB)`: mirror of PayMongo invoices, also the receipt source.
- `org_subscription_adjustments (id, org_subscription_id, amount_centavos, reason, kind ('proration','credit','comp'), status ('pending','applied','void'), provider_invoice_id, applied_at, created_by)`: proration and credits waiting for the next draft invoice.
- `org_payment_transactions` keeps manual-mode payments and one-time A3 charges. Add `purpose` (from the hardening plan).
- `platform_payment_settings` new: `auto_renew_enabled` (kill switch), `auto_renew_methods` (`card`, `paymaya`), `upgrade_charge_now_threshold_php` (1000), `pre_charge_notice_days` (3), `cancel_lead_days` (2), `suspended_auto_free_days` (30), `manual_billing_enabled`.
- RLS enabled, service-role access only, like the other billing tables.

## Server work

**Shared modules**

- [ ] `_shared/paymongoSubscriptionsClient.ts`: create/retrieve customer, create/retrieve plan, create/retrieve/cancel subscription, change plan, change method, list/retrieve invoice, pay open invoice, add line item, test cycle. Uses the hardened client (timeout, typed errors, `Idempotency-Key` derived from our row id + operation).
- [ ] `_shared/paymongoPlanCatalog.ts#ensurePaymongoPlan(pricingPlanId, amountCentavos, interval)`: select or create under a unique constraint (race-safe: on `23505`, re-read).
- [ ] `_shared/autoRenewOrchestrator.ts`: all state changes for auto mode. Every webhook and cron path goes through it. Never inline in handlers.
- [ ] `_shared/subscriptionPricing.ts` (pure): amount for `(plan, property count)`, proration for upgrades and property adds, next-cycle amount. Reuses `planPricing.ts` and `subscriptionProration.ts`.

**Edge functions** (`serveAuthenticated` + `verifyOrgOwner` unless noted)

| Function                                              | Does                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `start-org-auto-renew`                                | Validates plan and eligibility, ensures customer + plan, creates the subscription, returns the first-payment step (redirect URL or client key). Blocks if a live auto subscription exists.                                                                                                             |
| `update-org-payment-method`                           | Starts method change with `redirect_url` back to Billing. After success, pays the open invoice if `past_due`/`unpaid`.                                                                                                                                                                                 |
| `change-org-subscription`                             | Upgrade (immediate + adjustment or one-time charge), downgrade (schedule), property-count change.                                                                                                                                                                                                      |
| `cancel-org-subscription` / `resume-org-subscription` | Set or clear `cancel_at_period_end` + reason. Inside the cancel lead window, call PayMongo at once.                                                                                                                                                                                                    |
| `switch-org-billing-mode`                             | Auto → manual at period end (cancel PayMongo before draft), manual → auto at next renewal or now.                                                                                                                                                                                                      |
| `org-plan` (GET, existing)                            | Adds billing mode, method summary, next charge, invoices, scheduled changes. Read-only (hardening 2.4).                                                                                                                                                                                                |
| `paymongo-webhook` (existing)                         | New dispatch: `subscription.*` and `subscription.invoice.*` → `autoRenewOrchestrator`, resolved by `provider_subscription_id`/`provider_invoice_id`, never by payload amounts alone.                                                                                                                   |
| `platform-billing-cron` (existing)                    | Auto mode jobs: cancel PayMongo for `cancel_at_period_end` subs at T-2, apply scheduled downgrades through `PUT …/plan` before T-1, add pending adjustments to draft invoices, pre-charge notices, reconcile subs whose last event is older than 36 h, `incomplete` timeout cleanup, suspended → Free. |

**Webhook handling per event**

| Event                                  | Action                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `subscription.activated`               | Our sub `active`, set plan, period from invoice, save method summary, receipt email, activity log `billing.subscription_started`.             |
| `subscription.invoice.created` (draft) | Upsert invoice row. Apply pending `org_subscription_adjustments` as line items (idempotent per adjustment id).                                |
| `subscription.invoice.finalized`       | Upsert invoice `open`.                                                                                                                        |
| `subscription.invoice.paid`            | Verify amount/currency/livemode against the invoice row. Extend the period to `next_billing_schedule`. Clear `past_due`. Receipt email.       |
| `subscription.invoice.payment_failed`  | Increment attempts, save `last_payment_error`. First failure: email "Update your payment method". Last retry: "Paid features pause tomorrow". |
| `subscription.past_due`                | Ours `past_due`, banner, in-app notification.                                                                                                 |
| `subscription.unpaid`                  | Ours `suspended`, reconcile team seats (existing helper), email.                                                                              |
| `subscription.updated`                 | Sync plan, method, status, next billing date.                                                                                                 |
| unknown / unmatched                    | `ignored`, logged in the event table (hardening 1.1).                                                                                         |

Order safety: events can arrive out of order. Each handler re-fetches the subscription from PayMongo when the event conflicts with stored state, and only moves state forward (state rank plus `provider_updated_at`).

## Host UX and copy

All copy through `human-copy`. No em dashes. Phone: bottom sheets for dialogs, 44 px targets (`mobile-responsive`). Forms get `useUnsavedChangesGuard`/`useGuardedClose` where they have editable fields.

**Plan cards and `/for-hosts/pricing`**

- Price line: "₱X / month". Under it: "Billed monthly. Cancel anytime."
- Per-property: "₱X per property / month" plus the org total for the current count.

**Review and subscribe dialog** (`PlanReviewDialog.tsx`)

- Summary: plan, properties, monthly total, "Due today" amount, "Then ₱X on the Nth of each month".
- Method picker: Card or Maya (auto-renew), and "Pay each month yourself (QR Ph)" (manual), only when `manual_billing_enabled`.
- Consent line above the button: "You authorize Kame Space to charge ₱X to your payment method every month until you cancel. You can cancel anytime in Plans & Billing."
- Button: "Subscribe for ₱X/month" (auto) or "Pay ₱X for one month" (manual).
- Upgrade: "₱Y today for the rest of this month, then ₱X monthly from <date>." (or "added to your next bill" under A3).
- Downgrade: "Your plan changes to <plan> on <date>. You keep <current plan> until then."

**Billing tab** (`PlanBillingPanel.tsx`)

| State                     | Main line                                                             | Action                                        |
| ------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| Auto, active              | "Renews on <date> for ₱X" + "Visa •••• 4242"                          | Update payment method, Change plan, Cancel    |
| Auto, cancel scheduled    | "Ends on <date>. You won't be charged again."                         | Keep my plan                                  |
| Auto, downgrade scheduled | "Changes to <plan> on <date>"                                         | Keep current plan                             |
| Incomplete                | "Finish your payment to start <plan>. This link expires <time>."      | Finish payment                                |
| Incomplete cancelled      | "Payment wasn't completed. Nothing was charged."                      | Try again                                     |
| Past due                  | "We couldn't charge your card (<reason>). We'll try again on <date>." | Update payment method, Pay now                |
| Suspended                 | "Paid features are paused. Your data is safe."                        | Update payment method and pay, Switch to Free |
| Manual                    | existing states from the hardening plan + "Turn on auto-renew"        | Turn on auto-renew                            |
| Kill switch off           | "New subscriptions are paused. Your current plan keeps working."      | none                                          |

- Invoice history: date, amount, status pill with text, method, receipt PDF.
- Non-owners see status only: "Only the org owner can change billing."

**Cancel flow** (bottom sheet on phone)

1. "Cancel your plan?" with what they lose and the end date.
2. Reason picker mapped to PayMongo reasons, plus optional comment.
3. Offer once: switch to a lower plan instead (no discount offers unless super-admin enables them later).
4. Confirm: "Your plan ends on <date>. You won't be charged again." Email confirmation.

**Emails** (`_shared/subscriptionBillingEmail.ts`, templates under `_shared/email-templates/`, `static_files` in `config.toml`)

| Email                               | When                                             |
| ----------------------------------- | ------------------------------------------------ |
| Subscription started + receipt      | `subscription.activated`                         |
| Upcoming charge                     | `pre_charge_notice_days` before renewal (toggle) |
| Receipt                             | each `invoice.paid`                              |
| Payment failed, update method       | first `invoice.payment_failed`                   |
| Last try tomorrow                   | after the second failure                         |
| Paid features paused                | `unpaid`                                         |
| Moved to Free                       | after `suspended_auto_free_days`                 |
| Cancellation confirmed / plan ended | cancel request / period end                      |
| Plan change scheduled / applied     | downgrade schedule / apply                       |
| Payment method updated              | method change success                            |

Each email sends once per invoice or event (dedupe table from hardening 2.3).

**Legal**

- [ ] Terms page (`TermsPage.tsx`, `docs/guides/routes/legal.md`): auto-renewal, how to cancel, when access ends, refund policy (A8), price changes need 30 days notice.
- [ ] Price change for existing subscribers: super-admin price edits apply to **new** subscriptions only. Moving existing subscribers needs an explicit "notify and migrate" action (30-day email notice, then plan swap).

## Super-admin control

All writes: `serveSuperAdmin` + `requireSuperAdminStepUp` + `logSuperAdminAction` + org `activity_log`. Lives in `/admin/billing` from the hardening plan.

| Area               | Controls                                                                                                                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Org billing detail | Mode, PayMongo ids (links to the PayMongo dashboard), status (ours and PayMongo), method summary, next charge, invoices, adjustments, events timeline                                                                                                                                        |
| Actions            | Sync from PayMongo, retry open invoice, send update-method link, cancel now / at period end, undo cancel, apply or clear scheduled change, add credit or charge to next invoice (line item), comp N months (negative line item), switch to manual, record refund, force suspend / reactivate |
| Queues             | Past due, unpaid, incomplete > 24 h, failed webhooks, state mismatch (ours vs PayMongo), adjustments not applied                                                                                                                                                                             |
| Settings           | `auto_renew_enabled`, methods, upgrade threshold, notice days, cancel lead days, suspended-to-Free days, manual billing on/off                                                                                                                                                               |
| Plan catalog       | List of PayMongo plans per tier and price, live vs test; "Migrate subscribers to new price" with notice                                                                                                                                                                                      |
| Reporting          | MRR (auto vs manual), churn and cancellation reasons, failed-payment recovery rate, upcoming renewals                                                                                                                                                                                        |

## AI credits and the subscription

Detail stays in [`ai-credits-topup-purchase.md`](./ai-credits-topup-purchase.md). Changes from this plan:

- **One-time only, unlimited.** Buy anytime, as many times as wanted. No monthly cap by default; super-admin can set an optional per-org cap and a velocity guard (fraud).
- **Methods:** any active one-time rail through Hosted Checkout: QR Ph, plus card and Maya when active. Not tied to the subscription method.
- **Never on the subscription invoice.** Credits are paid and delivered at once, so a failed renewal never takes back bought credits.
- **Cancel or downgrade keeps credits.** They work again when the plan includes AI.
- **Best-practice rules:** fixed packs with bonus credits (price per credit falls with size), price shown in PHP with credits count, credits never expire, monthly allowance spent first then bought credits, balance shown wherever AI is used, receipt per purchase, low-balance notice at 80% and 100% of the allowance, one pending checkout at a time (concurrency, not a limit).
- **Later:** saved card for one-click top-up (needs PayMongo card vaulting, which is a separate select-account activation), and auto top-up when balance is low (possible with a Maya on-demand subscription; cards would need off-session charging that PayMongo only offers through Subscriptions).

## Edge cases

| #   | Case                                                    | Handling                                                                                                                                 |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| E01 | Host closes the tab during first payment                | `incomplete` until 24 h; Billing shows "Finish payment"; cron cleans up after `incomplete_cancelled`                                     |
| E02 | Host clicks Subscribe twice                             | Idempotency key per org + plan + attempt; second call returns the same pending subscription                                              |
| E03 | Activation webhook missed                               | Return page calls sync; cron reconciles subs with stale events                                                                           |
| E04 | 3DS fails or is abandoned                               | Payment Intent returns to `awaiting_payment_method`; host can retry within 24 h                                                          |
| E05 | Expired or declined card at renewal                     | `payment_failed` → update-method email with the PayMongo error; 3 retries; then suspended                                                |
| E06 | Insufficient Maya balance                               | Same as E05                                                                                                                              |
| E07 | Method updated during past_due                          | Pay open invoice at once; on success `active`                                                                                            |
| E08 | Upgrade then cancel in the same month                   | Pending adjustment stays on the final invoice if one is generated; otherwise void it and record as written off (super-admin report)      |
| E09 | Upgrade above threshold                                 | One-time checkout now; features apply after payment                                                                                      |
| E10 | Property added mid-cycle                                | Covered now; proration adjustment; next cycle at new plan price                                                                          |
| E11 | Property removed mid-cycle                              | Next cycle at lower price; no refund                                                                                                     |
| E12 | Downgrade then upgrade before period end                | Scheduled downgrade cleared                                                                                                              |
| E13 | Cancel then resume before T-2                           | Flag cleared, nothing sent to PayMongo                                                                                                   |
| E14 | Cancel inside T-2                                       | PayMongo cancel now; access to period end; any draft invoice voided if PayMongo allows, else refund flag for super-admin                 |
| E15 | Resubscribe after the plan ended                        | New PayMongo subscription; first invoice charges at once                                                                                 |
| E16 | Owner transfers the org                                 | Subscription stays on the old owner's method; new owner sees "Update payment method to keep your plan"; old owner gets an email          |
| E17 | Owner owns several orgs                                 | One PayMongo customer, one subscription per org                                                                                          |
| E18 | Owner email changes                                     | Update the PayMongo customer email; on uniqueness clash, keep the old customer and log                                                   |
| E19 | Org deleted with a live subscription                    | Deletion first cancels PayMongo; deletion blocked if the cancel call fails                                                               |
| E20 | Super-admin edits plan price                            | New subscriptions only; migration is an explicit action with notice                                                                      |
| E21 | Plan deactivated                                        | Existing subscribers keep it; new signups blocked                                                                                        |
| E22 | Out-of-order events (`paid` before `finalized`)         | Forward-only state rules + re-fetch                                                                                                      |
| E23 | Duplicate events                                        | Event table dedupe + guarded updates                                                                                                     |
| E24 | Event for an unknown subscription (another environment) | `ignored`; livemode check                                                                                                                |
| E25 | PayMongo down when host subscribes                      | 503 with "Try again in a few minutes"; nothing created on our side                                                                       |
| E26 | Subscriptions not activated on the account              | `auto_renew_enabled` stays off; UI shows manual only                                                                                     |
| E27 | Manual subscriber turns on auto-renew mid-period        | Auto subscription starts at the next renewal date (cron creates it at T-1 day, or host pays now and the period extends from the old end) |
| E28 | Reward trial (host verification) ends                   | Offer auto-renew; without it, Free                                                                                                       |
| E29 | Refund issued in PayMongo                               | `payment.refund.updated` recorded; super-admin decides on access                                                                         |
| E30 | Chargeback / dispute                                    | Recorded; super-admin can suspend                                                                                                        |
| E31 | Price under PayMongo minimum (₱20 plan amount)          | Validator blocks plans below the minimum                                                                                                 |
| E32 | Timezone                                                | Billing dates shown in Asia/Manila; PayMongo `due_date` is a date, stored as-is                                                          |

## Test plan

Uses the hardening plan's harness: pure Deno units, PayMongo fake (extended with subscription, plan, customer, invoice resources and event builders), local-Supabase integration tests (`test:edge:billing`), mocked Playwright, plus a test-mode run using `test_cycle`.

| #   | Scenario                                                                                           | Layer                  |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| T01 | Pricing: amount for each tier × property counts incl. volume tiers                                 | U                      |
| T02 | Proration for upgrade on day 1, 15, last day; property add                                         | U                      |
| T03 | Plan catalog: same price reuses plan; race creates one                                             | U + I                  |
| T04 | Subscribe: customer reused per owner; subscription created with idempotency key                    | I                      |
| T05 | `subscription.activated` → active, period, method summary, one receipt                             | I                      |
| T06 | No payment in 24 h → `incomplete_cancelled` → previous state, "Try again"                          | I + E                  |
| T07 | Double Subscribe click → one subscription                                                          | I                      |
| T08 | `invoice.created` draft applies pending adjustments once, even if delivered twice                  | I                      |
| T09 | `invoice.paid` extends period to `next_billing_schedule`                                           | I                      |
| T10 | `invoice.paid` amount mismatch → flagged, no extension                                             | I                      |
| T11 | `payment_failed` ×1, ×2, ×3 → emails once each, `past_due` then `unpaid` → suspended               | I                      |
| T12 | Method update during past_due → open invoice paid → active                                         | I                      |
| T13 | Upgrade below threshold → features now, adjustment pending                                         | I                      |
| T14 | Upgrade above threshold → one-time checkout, features after payment                                | I                      |
| T15 | Downgrade → scheduled, plan PUT before draft, applies next cycle                                   | I                      |
| T16 | Downgrade then upgrade → schedule cleared                                                          | I                      |
| T17 | Cancel → flag; cron at T-2 calls PayMongo cancel once                                              | I                      |
| T18 | Cancel then resume before T-2 → no PayMongo call                                                   | I                      |
| T19 | Cancel inside T-2 → immediate PayMongo cancel                                                      | I                      |
| T20 | Period end after cancel → Free, plan-ended email                                                   | I                      |
| T21 | Suspended 30 days → Free + PayMongo cancel                                                         | I                      |
| T22 | Out-of-order and duplicate events                                                                  | I                      |
| T23 | Event for unknown subscription / wrong livemode                                                    | I                      |
| T24 | Owner transfer → update-method prompt                                                              | I + E                  |
| T25 | Org delete cancels PayMongo first                                                                  | I                      |
| T26 | Kill switch off → subscribe blocked, existing subs keep working                                    | I + E                  |
| T27 | Manual → auto at renewal; auto → manual at period end                                              | I                      |
| T28 | Non-owner cannot subscribe, cancel, or change method                                               | I                      |
| T29 | Super-admin actions: sync, retry, comp month, cancel, switch mode, record refund (audit rows each) | I + E                  |
| T30 | Host UI: every Billing state at 375 / 1280 with correct copy and actions                           | E                      |
| T31 | Review dialog shows due today, monthly price, renewal date, consent line                           | E                      |
| T32 | Cancel sheet: reason, end date, confirmation                                                       | E                      |
| T33 | Test mode: real card + Maya subscribe, `test_cycle` renewal, failed test card renewal              | Manual (PayMongo test) |

Gates per phase: `type-check`, `lint`, `check:filenames`, `build`, `test`, `test:edge`, `test:edge:handlers`, `test:edge:billing`, the Playwright specs, `ci:quality`, `get_advisors` after migrations, `security-auditor` on the new functions and webhook branch.

## Phases

| Phase | Scope                                                                                                                                                                                                                                           | Exit                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 0     | **Business and spike.** Request card + Maya subscription activation from PayMongo (test and live). Spike in test mode: first-payment flow, event payloads, cancel inside draft window, method details. Confirm fees, refund policy, Terms copy. | Activation confirmed; unknowns answered in this doc |
| 1     | Prerequisite: hardening Phase 1 (webhook durability, idempotency, rails, amount checks)                                                                                                                                                         | Shipped                                             |
| 2     | Schema, `paymongoSubscriptionsClient`, plan catalog, pricing module, unit tests                                                                                                                                                                 | T01 to T03 pass                                     |
| 3     | Subscribe + activation + renewal + failure handling (`start-org-auto-renew`, webhook branch, `update-org-payment-method`)                                                                                                                       | T04 to T12 pass                                     |
| 4     | Changes and cancel (upgrade, downgrade, property count, cancel/resume, mode switch, cron jobs)                                                                                                                                                  | T13 to T21, T27 pass                                |
| 5     | Host UI + emails + Terms                                                                                                                                                                                                                        | T30 to T32 pass; copy reviewed                      |
| 6     | Super-admin controls + reporting                                                                                                                                                                                                                | T29 pass                                            |
| 7     | Rollout: test mode end to end (T33), dev, then mt-prod with `auto_renew_enabled` off; turn on for internal orgs, then all                                                                                                                       | Live charge and renewal observed on an internal org |

## Docs to update in the same changes

- `docs/architecture/integrations.md`, `edge-functions.md`, `data-model.md`, `overview.md`, `docs/PROJECT.md` (new env `VITE_PAYMONGO_PUBLIC_KEY` if A12 needs it, new functions and tables).
- Route guides: `org/plans.md`, `for-hosts.md`, `legal.md`, `admin/billing.md`, `admin/payment-settings.md`, `admin/org-subscriptions.md`.
- `docs/architecture/plans-feature-matrix.md` (billing mode, cancel timing).
- `docs/archive/operations/paymongo-billing-setup.md` (subscription activation, webhook events to subscribe, test cycle runbook).
- Support content and FAQs: how auto-renew works, how to cancel, what happens when a card fails, how to switch to QR Ph, receipts. Run `check:support-content` and `check:ai-knowledge-coverage`.
- Activity log catalog (server + client): `billing.subscription_started`, `billing.renewal_paid`, `billing.renewal_failed`, `billing.payment_method_updated`, `billing.cancel_scheduled`, `billing.cancel_undone`, `billing.plan_change_scheduled`, `billing.subscription_ended`, `billing.mode_switched`.
- Plans/RBAC: billing stays owner-only; `org.plans:view` sees status.

## Out of scope

- Annual billing (A11), coupons and discounts, trials beyond the existing host verification reward, multi-currency, automated refunds, PayMongo Platforms split payouts for parking.

Back to [planned index](./README.md).
