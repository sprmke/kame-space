---
title: 'Plans & Billing — operator guide'
status: active
tags: [guides, routes, org]
updated: 2026-11-18
---

# Plans & Billing — operator guide

Routes:

- `/org/:orgSlug/plans` — org shell (PayMongo checkout runs here; org sidebar only)
- `/org/:orgSlug/property/:propertySlug/plans` — legacy redirect → org `/plans`

> **Status:** Documented. Lifecycle hardening shipped per [`plans-billing-lifecycle-hardening.md`](../../../workflow/in-progress/plans-billing-lifecycle-hardening.md).

## Progress overview

| Section                    | E2E save | Validation | Docs | Notes                                                                                  |
| -------------------------- | -------- | ---------- | ---- | -------------------------------------------------------------------------------------- |
| Plan review + checkout     | Yes      | Server     | Done | Server quote, one open checkout, price check, paid with account credit when it covers  |
| Downgrade (paid to lower)  | Yes      | Server     | Done | **Scheduled for the period end**, undo with **Keep {plan}**, nothing turns off early   |
| Cancel (paid to Free)      | Yes      | Server     | Done | **Cancel at period end**, **Resume plan** until then, optional reason                  |
| Renewal, grace, suspension | Yes      | Server     | Done | Hourly idempotent cron, reminders once each, Free-level suspension, auto-end after 30d |
| Billing details + receipts | Yes      | Server     | Done | Numbered receipt PDF per payment, TIN and billing email, payment history with paging   |

---

## Overview

**Billing is org-level only** (one `org_subscriptions` row covers enrolled properties). Hosts open **Plans & Billing** from the **org sidebar** only. Legacy property `/plans` URLs redirect to org `/plans`. Org `/plans` is the billing hub: **Billing** is the first tab, then Plans / Compare / FAQs. Choosing a tier opens `PlanReviewDialog` in place; **Continue to payment** redirects to PayMongo Hosted Checkout (same tab) and PayMongo returns to **`?tab=billing&checkout=success|cancelled`**.

**The model, in one paragraph.** An org pays for one plan, priced per billable property (volume-discounted). Upgrades start right away with a fresh period and credit for unused time. Moving to a lower plan, or canceling, **waits for the end of the period the host already paid for** and can be undone before then. Renewal is a payment link a few days before the period ends. If it is not paid the org is **past due** (every paid feature stays on), then **suspended** (paid features pause, the dashboard keeps working like Free), then the plan **ends** after the suspension window. Every PayMongo payment ends up applied to the plan or kept as **account credit**, never dropped.

**Billable properties** are every org property **except archived ones**. A property added on a paid plan in good standing is covered right away and its prorated share of the added cost is added to the next payment. While a payment is overdue it stays on Free until the host pays.

**Access:** any org member with **`org.plans:view`** can view plans, history and receipts. Checkout, scheduling, cancel and billing details require the org **owner** (or platform admin), see `verifyOrgOwner`.

**Page title:** `${Org Name} - Plans & Billing`. Subtitle: `PLANS_PAGE_SUBTITLE` in `planPresentation.ts` (shown on `lg+` only).

---

## Behavior

- **Layout:** pinned subscription summary card above the tab strip (**Billing** / Plans / Compare / FAQs). Section titles live **inside** each tab's card (**Payment history**, **Choose your plan**, **Compare features**, **Frequently asked questions**). The Billing tab shows **Payment history**, then the **Billing details** card.
- **Summary card states** (`describeBillingState` in `billingState.ts`):

  | State                     | Line under the plan name               | Strip and actions                                                                     |
  | ------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
  | Free                      | -                                      | -                                                                                     |
  | Active                    | `Renews {date} · ₱{next} next payment` | -                                                                                     |
  | Active, renewal link open | `Renews {date}`                        | Your renewal payment is ready. **Pay renewal**                                        |
  | Downgrade scheduled       | `Changes to {plan} on {date}`          | You keep {current} until {date}. **Keep {current}**                                   |
  | Cancel scheduled          | `Ends {date}`                          | Moves to Free on {date}. **Resume plan**                                              |
  | Trial (reward)            | `Trial ends {date}`                    | Keep {plan} after your trial. **Keep {plan}**                                         |
  | Past due                  | `Payment due since {date}`             | Pay by {grace end} to keep paid features. **Pay now**, **Cancel plan**                |
  | Suspended                 | `Paid features paused since {date}`    | Pay to turn them back on. Ends on {auto-cancel date}. **Pay now**, **Switch to Free** |

  Members see the same lines with no actions and "Only the organization owner can change billing." An **account credit** chip shows when the balance is above zero; "₱X for new properties is added to your next payment" shows when a true-up is owed.

- **Plans tab:** `PlanTierRail` in a `FloatingPanel`. Each card shows the **per-property monthly rate**. The current tier is highlighted. A scheduled target shows a **Starts {date}** badge and a disabled **Scheduled** button; the Free card shows it when a cancel is scheduled. Lower paid tiers read **Switch at renewal**, Free reads **Cancel plan**, higher tiers **Upgrade**. **Managed** opens **Help & Support → New ticket** (sales-assisted).
- **What choosing a tier means** (`resolvePlanChange`, mirrors the server): higher or first purchase = pay; lower paid = schedule for the period end; Free = cancel at the period end; overdue plans can pay or upgrade but not schedule a downgrade, and leave with **Cancel plan** (ends now, nothing paid is given up); suspended can reactivate on any paid plan or leave for Free; a reward trial can pay for a plan but not cancel (it ends on its own).
- **Review dialog (`PlanReviewDialog`):** the amounts come from `preview-org-plan-change`, the same quote the checkout charges. **Upgrade / renewal / reactivation** show the quote lines (plan total, "Unused time on your current plan", added-property amounts, account credit), **Due today**, the new period end and the next renewal amount. **Scheduled downgrade** shows "Takes effect {date}. You keep {current} until then", "Turns off on {date}" (features lost) and **What this affects** (team seats over the new limit, calendar feeds, scheduled posts, Smart Pricing, AI credit allowance, search visibility). A price that moved by more than ₱10 between review and confirm returns 409 and the dialog shows the new amount to confirm again. A change fully covered by account credit reads **Apply with credit** and needs no checkout.
- **Cancel dialog (`PlanCancelDialog`):** impact list, optional reason (single choice), **Cancel on {date}**. For an overdue plan it reads **End plan now**.
- **Volume discounts**: each paid tier carries its own **`volume_discount_tiers`**, **`volume_ramp_floor_php`**, and **`volume_ramp_at_count`** (super-admin editable on **`/admin/pricing/plans`** → Edit). **1 to `volume_ramp_at_count` properties:** when the promo rate is above the ramp floor, the per-property rate **ramps linearly** from the full promo rate down to the floor. **Above the ramp count:** `volume_discount_tiers` breakpoints apply to the extended total. Stacks on top of the flat promotional `discount_percent`.
- **Grandfathered prices:** a subscription keeps the pricing it bought (`org_subscriptions.pricing_snapshot`). Editing a plan's price only affects new purchases. A super-admin **Move subscribers to the current price** action (Edit plan) schedules the move at least 30 days out and emails every affected owner the old and new monthly total; renewals on or after that date use the new price.
- **Upgrade (paid):** `create-org-subscription-checkout` builds the quote, stores the intent it was created for, and creates one PayMongo **Hosted Checkout Session** with `success_url` / `cancel_url` back to `/org/:orgSlug/plans?tab=billing&checkout=success|cancelled`. An org has **one open checkout**: starting another closes the old one at PayMongo. Open checkouts expire after 24 h (super-admin setting). Fulfillment is **webhook-driven** (`paymongo-webhook`); the Billing tab **polls** `org-plan` every 3 s only while this browser has its own checkout in flight, shows **Confirming payment…**, then **`PlanUpgradeSuccessModal`** for a real upgrade or a quiet "Payment received" for a renewal. **Resume payment** reopens the open session.
- **Payments are never ignored.** A payment on a closed checkout, a period that was already renewed, a plan that changed or a subscription that ended is **kept as account credit** (the owner is emailed, Sentry gets a warning, the row says why). A payment that was collected but failed to apply stays `paid` with `applied = false` and the cron retries it; super-admin sees it under **Held payments**.
- **Proration:** an upgrade is credited for the unused share of what was actually **paid** for the current period (`period_paid_php`, not the price snapshot), never more than paid. Credit larger than the new price, and a charge below PayMongo's ₱20 minimum, leave the excess on the account instead of losing it. Account credit is applied automatically to the next payment and is never paid out as cash.
- **Scheduled downgrade / cancel:** `org-subscription-change` records the intent (`scheduled_plan_id` or `cancel_at_period_end`), closes any open checkout, and emails the owner. The renewal link issued before the period end is for the **new** plan's price. If the host pays early, the period extends from the old end and the current plan stays until then; the cron switches the plan on the old period end. Undo clears the intent and reissues a link for the current plan. Intents are mutually exclusive and an upgrade clears them. A scheduled target plan that is later retired from the catalog is still applied.
- **Renewal, past due, suspension:** hourly `platform-billing-cron`. A renewal link and email go out `renewal_link_lead_days` before the period end (default 5), plus "due tomorrow". Unpaid at the period end = **past due**, grace counted **from the period end** (default 5 days). Paying during grace keeps the renewal date (the new period starts at the old end). After grace the subscription is **suspended**: every read path (crons, guest pages, AI, sync) treats it as Free, the sidebar says **Suspended**, a banner shows on every admin page, and the dashboard stays usable. Paying starts a fresh period from the payment date. After `suspension_cancel_days` (default 30) the plan ends and the org stays on Free. If account credit covers a renewal, it renews with no checkout. A renewal with **no billable properties** ends the plan instead of failing. Every reminder is sent once per period.
- **Reward trials** (`source = reward`): reminders at 3 days and 1 day, **Keep {plan}** pays for the same plan starting when the trial ends, any other plan starts now. An unconverted trial ends on its date.
- **Properties:** adding or restoring a property on an active or trialing plan covers it at once and adds the prorated share to the next payment (`billing.property_covered` activity). Archiving or deleting drops it from the next renewal with no credit. While past due or suspended, new properties stay on Free until paid. A super-admin price override (Managed) is never recomputed by property changes.
- **Receipts and billing details:** each paid row has a receipt number (`KS-R-2026-000123`) and a PDF (`get-org-payment-receipt`). The owner edits legal name, address, optional TIN and a billing email (same billing emails as the owner) in **Billing details**, guarded by the unsaved-changes prompt. A payment receipt, not a BIR official receipt.
- **Payment history:** purpose (New plan, Renewal, Plan change, Reactivation), the period covered, status, receipt download. Unpaid and canceled checkouts are hidden behind **Show unpaid checkouts**; **Show more** pages by cursor.
- **Access:** any org member can view plans; **checkout, scheduling, cancel and billing details require the org owner** (or platform admin). Tier actions are hidden for members.
- **Compare tab:** `PlanFeatureMatrix` in the same `FloatingPanel` as the other tabs, feature-by-feature across every tier, grouped by product module in property sidebar order. Same component on **`/for-hosts/pricing`**. Clicking a tier opens the same review dialog. On phone the matrix densifies to `text-xs`.
- **Loading:** `PlansPageSkeleton` mirrors the Billing default (summary card, four-tab strip, payment history rows).
- **`past_due` and `suspended` banner:** `BillingStatusBanner` on every admin page (org, property, parking), hidden on Plans & Billing. Owners get **Pay now**; members are told to ask the owner. **Nothing is locked out**: Help & Support, Announcements and every Free feature stay reachable. Guest booking flows are unaffected.
- **Upgrade CTA:** feature gates open the inline **`SubscriptionUpgradeModal`** (the same review dialog). When opened over another dialog (e.g. Marketing **Generate calendar**), it stacks with its own frosted `modal-scrim` (`z-[110]` / content `z-[111]`). **Continue to payment** creates the checkout then goes to PayMongo. Optional `?feature=<PlanFeatureKey>` still opens review when landing on org Plans directly. `?tab=billing|plans|compare|faqs` selects a tab.
- **Pooled quantity limits:** `teamManagement.maxMembers` and the marketing publish cap are shared across every property enrolled in the same org subscription (`entitlementPoolPropertyIds` in `_shared/planEntitlements.ts`).
- **Navigation:** **Plans & Billing** appears only on the org sidebar. The admin sidebar (and mobile **More** sheet) shows the current plan as a full-width card above AI mode: tier icon well, `{Plan} plan`, and a muted caption: `Current plan`, `Trial ends {date}`, `Ends {date}`, `Changes {date}`, or the red `Past due` / `Suspended`. Tapping opens a large plan sheet listing every included feature, with **Compare plans** and **Upgrade plan** (Free) or **Manage plan** (paid).
- **In-app notices and push:** renewal ready, due tomorrow, past due, grace ending, suspended, reactivated, trial ending, plan ended, price change and "payment kept as credit" also appear in the notification list and web push (`billing_notice`, opens Billing).

## Known gaps (flagged, not silently dropped)

- **Managed's price is sales-assisted, not formula-driven.** A super-admin sets it through `org-subscriptions-admin` (stored as `price_override_php`, never recomputed by property changes).
- **No automatic card charging.** PayMongo has no recurring engine for this account, so every period is a payment link.
- **An organization with a live paid plan cannot be deleted.** `delete-organization` answers 409 until the plan has ended (cancel at the period end, then delete after it). Reward trials and admin grants do not block.
- **Walking the lifecycle locally:** `bun run billing:time-travel -- --org <slug> --days 31 --run` moves the org's billing dates forward and runs the cron (local Supabase only).
- **Receipts are payment receipts**, not BIR official receipts or VAT invoices. Confirm with the accountant whether that is needed.
- **PayMongo live checkout** still needs platform payment secrets and the live webhook endpoint. See `docs/archive/operations/paymongo-billing-setup.md`.

---

## Tier ladder (host-facing)

Internal plan codes stay stable in the database; hosts see these names. **Monthly (PHP) is the per-property rate**, not a flat plan price — the total charged is this rate × **every property in the org**, then the volume discount curve.

| Display name | Internal code | Per-property monthly (PHP) | Highlights                                                                                                                                                                                                                          |
| ------------ | ------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Free**     | `free`        | ₱0                         | Dashboard, manual bookings, guest form, manual documents, **standard template management**, finance, maintenance, notifications                                                                                                     |
| **Starter**  | `starter`     | ₱499 → **₱399**            | 20% off list · pricing management, public listing, automated booking emails, verified badge, 3 pooled team seats, **custom team roles**, **advanced template management**                                                           |
| **Pro**      | `growth`      | ₱999 → **₱799**            | 20% off list · 5 pooled seats, **Marketing Content Studio**, top-30 search, AI validation, **Public pages editor**, **Property showcase & stay guide access**, **Airbnb calendar sync**, **Smart AI Pricing**, 1k pooled AI credits |
| **Business** | `pro`         | ₱1,799 → **₱1,439**        | 20% off list · 10 pooled seats, **Publish in Meta platforms**, top-15 search, full AI toolkit, 10k pooled AI credits, absorbs what the retired Business Plus tier covered via its own volume curve                                  |
| **Managed**  | `managed`     | ₱4,999 → **₱3,999**        | 20% off list · Business capabilities + 30k pooled AI credits/mo, full-service ops, sales-assisted pricing                                                                                                                           |

`business_plus` is retired (`is_active = false`) — folded into Pro's volume-discount curve rather than kept as a separate "many properties" tier.

---

## API

| Method   | Edge function                      | Auth                                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ---------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET      | `org-plan`                         | Org member (`verifyOrgAccess`); history and billing details only with `org.plans:view` | `?orgId=` or `?orgSlug=`, optional `cursor`, `includeIncomplete=1`. Plans, properties, subscription (`active` / `trialing` / `past_due` / `suspended`) with pending intent, `upcomingPayment`, `accountCreditPhp`, `amountOwedPhp`, `billingDetails`, paged `transactions` (purpose, period, receipt), open checkout. Reconciles the open checkout at most once per 15 s |
| POST     | `preview-org-plan-change`          | Org owner                                                                              | `{ organizationId, kind: 'pay' \| 'schedule' \| 'cancel', planId? }` → server quote (lines, due today, new period, next renewal) or the effective date and impact list. Read-only                                                                                                                                                                                        |
| POST     | `create-org-subscription-checkout` | Org owner (`verifyOrgOwner`)                                                           | `{ organizationId, planId?, expectedChargePhp?, idempotencyKey?, resume? }` → `{ checkoutUrl \| null, transactionId, paidWithCredit, purpose, chargePhp }`. 409 `price_changed` with `freshChargePhp`; `checkoutUrl: null` when account credit covered it                                                                                                                |
| POST     | `org-subscription-change`          | Org owner                                                                              | `{ organizationId, action: 'schedule_downgrade' \| 'cancel_at_period_end' \| 'clear_intent' \| 'cancel_now', planId?, reason? }`. `cancel_now` only for overdue plans                                                                                                                                                                                                    |
| GET, PUT | `org-billing-details`              | `org.plans:view` read, owner write                                                     | Legal name, address, TIN (validated), billing email                                                                                                                                                                                                                                                                                                                      |
| GET      | `get-org-payment-receipt`          | `org.plans:view`                                                                       | `?orgId=&transactionId=` → receipt PDF for a paid row                                                                                                                                                                                                                                                                                                                    |
| -        | `paymongo-webhook`                 | -                                                                                      | `payment.paid` (and link / checkout variants), `payment.failed`, `payment.refunded`. Dispatches org transactions via `metadata.kind === 'org_subscription'`; a payment on a closed checkout goes through the same validated apply path                                                                                                                                   |
| -        | `platform-billing-cron`            | Cron secret                                                                            | Hourly: payment sweep and retry, renewal links and reminders, scheduled plan changes, past due, suspension, auto-end, reward trials                                                                                                                                                                                                                                      |

---

## Implementation map

| Layer                  | Path                                                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                   | `ui/src/features/dashboard/plans/pages/OrgPlansPage.tsx`                                                                                                                                                                      |
| Billing tab            | `components/PlanBillingPanel.tsx` (summary card), `OrgPlanTransactions.tsx`, `OrgBillingDetailsCard.tsx`, `PlanCheckoutConfirmationBanner.tsx`; banner on every admin page: `BillingStatusBanner.tsx`                         |
| Dialogs                | `PlanReviewDialog.tsx` (pay / scheduled downgrade), `PlanCancelDialog.tsx`                                                                                                                                                    |
| Presentation logic     | `lib/billingState.ts` (states, banner, sidebar caption, what a plan choice means), `lib/planPresentation.ts` (tiers, FAQ copy), `lib/orgPlanTransactionFormat.ts`, `lib/billingDetailsForm.ts`                                |
| Hooks and API          | `hooks/useOrgPlan.ts`, `hooks/useOrgPaymentHistory.ts`, `hooks/useOrgPlanCheckoutConfirmation.ts`, `lib/orgPlanApi.ts`                                                                                                        |
| State machine (server) | `_shared/orgSubscriptionStateMachine.ts` (what is allowed, what the cron does next), `_shared/orgPaymentIntent.ts` (is a late payment still valid), `_shared/billingPeriod.ts` (anchor-day months, unused credit)             |
| Quote and checkout     | `_shared/orgBillingQuote.ts` (money math), `_shared/orgBillingContext.ts` (loads state, builds the quote), `_shared/orgSubscriptionCheckout.ts`, `_shared/orgBillableProperties.ts`                                           |
| Payments               | `_shared/orgPaymentFulfillment.ts` (claim, validate, apply, credit), `_shared/orgPaymentReconcile.ts` (missed webhooks, expiry), `_shared/orgBillingLedger.ts` (account credit), `_shared/orgReceiptPdf.ts`                   |
| Lifecycle              | `_shared/orgBillingLifecycle.ts` (schedule, undo, past due, suspend, end), `_shared/subscriptionOrchestrator.ts` (webhook dispatch, hourly cycle), `_shared/planChangeImpact.ts`, `_shared/orgPriceMigration.ts`              |
| Notices                | `_shared/orgBillingMessages.ts` (copy), `_shared/orgBillingNotify.ts` (email + in-app + push), `_shared/orgBillingNotifications.ts` (send once)                                                                               |
| Entitlements           | `_shared/planEntitlements.ts`: a **suspended** subscription resolves to Free features everywhere (`resolveSubscriptionFeatures`)                                                                                              |
| Tables                 | `pricing_plans`, `org_subscriptions`, `org_subscription_properties`, `org_subscription_events`, `org_payment_transactions`, `org_billing_ledger`, `org_billing_notifications`, `org_billing_details`, `plan_price_migrations` |
| E2E                    | `ui/e2e/features/plans/org/*` (mocked), run with `bun run test:e2e:plans`                                                                                                                                                     |

Full design and rationale: [`plans-billing-lifecycle-hardening.md`](../../../workflow/in-progress/plans-billing-lifecycle-hardening.md), earlier model in [`org-level-billing-migration.md`](../../../workflow/done/org-level-billing-migration.md).

---

## Testing

| Layer         | Path / spec                                                                                                                                                                                                                                                                         | Manual                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Unit (Deno)   | `_shared/billingPeriod_test.ts`, `orgBillingQuote_test.ts`, `orgSubscriptionStateMachine_test.ts`, `orgPaymentIntent_test.ts`, `planChangeImpact_test.ts`, `orgBillingMessages_test.ts`, `orgBillingDetails_test.ts`, `orgReceiptPdf_test.ts`, `planPricing_test.ts`                | -                        |
| Unit (Vitest) | `plans/lib/billingState.test.ts`, `billingDetailsForm.test.ts`, `orgPlanTransactionFormat.test.ts`, `planTierCardGains.test.ts`, `super-admin/lib/superAdminBillingTimeline.test.ts`                                                                                                | -                        |
| Live DB       | `supabase/functions/tests/orgBillingLifecycle.integration_test.ts` (`LOCAL_BILLING_LIVE=1`): checkout, payment, stale credit, scheduled downgrade and cancel, past due, suspension, auto-end, credit renewal, true-ups, overrides, grandfathered price                              | -                        |
| E2E           | `ui/e2e/features/plans/org/orgPlanCheckout.spec.ts`, `orgPlanScheduledChange.spec.ts`, `orgPlanBillingFlows.spec.ts` (price changed, paid with credit, billing details + unsaved guard), `orgPlanReviewDialog.spec.ts`, `orgPlansCardsCompare.spec.ts` (`@ci` via `test:e2e:plans`) | PayMongo live settlement |
| Handlers      | `supabase/functions/tests/handlers/{org-subscription-change,preview-org-plan-change,org-billing-details,get-org-payment-receipt}.test.ts`                                                                                                                                           | Real PayMongo webhook    |

---

## Host-facing knowledge

Plans & Billing is where the organization owner picks the tier and pays for it. Billing is per property but managed once for the whole organization, and the plan card in the sidebar shows what the current tier includes.

**Common host questions**

- Q: Is billing per property or per organization?
  A: Pricing is per property, but you pay once for the whole organization. Every listing in the org is included automatically, except archived ones.
- Q: What are the plan names I should expect to see?
  A: Free, Starter, Pro, Business, and Managed. Pro is the tier with Marketing Content Studio, Airbnb calendar sync, and Smart Pricing. Business adds Meta publishing and the full AI toolkit.
- Q: Where do I see what my current plan includes?
  A: Open **Plans & Billing** from the org sidebar, or tap the plan card above AI mode. The plan sheet lists every included feature, with **Compare plans**, **Upgrade plan** on Free, or **Manage plan** on paid tiers.
- Q: Will I pay less per property as I add listings?
  A: Yes. From 1 to 10 listings the rate steps down toward the tier's floor when its promo rate is higher, then volume discounts apply at 10+, 20+, 50+, and 100+.
- Q: What happens when I add a property on a paid plan?
  A: It joins your plan right away. The share of its cost for the rest of the period is added to your next payment. If a payment is overdue, the property stays on Free until you pay.
- Q: How do upgrades and downgrades take effect?
  A: An upgrade starts right away: you pay the difference for the rest of the period and get a new billing period from today. A downgrade or cancel waits for the end of the period you paid for. You keep every feature until then and can undo it from the Billing tab. Unused time is not paid back in cash.
- Q: What happens if I miss a payment?
  A: The organization becomes past due and keeps every paid feature during the grace period. After that, paid features pause and it works like Free until you pay. Guest pages and your data are not affected. If the payment is still missing after 30 more days, the plan ends.
- Q: Can I get a receipt?
  A: Yes. Every payment has a numbered receipt on the Billing tab. Add your legal name, address and TIN under Billing details to print them on it. It is a payment receipt, not a BIR official receipt.
- Q: What is account credit?
  A: Credit that stays on your account when an upgrade credits you more than the new plan costs, or when a payment arrives after your plan already changed. It comes off your next payment automatically and is not paid out as cash.
- Q: Why can't I delete my organization?
  A: While a paid plan is active you can't delete the organization, because you have already paid for the period. Cancel the plan from Plans & Billing, then delete the organization once the plan has ended. A free trial or a plan given by our team doesn't block deletion.
- Q: How do I get the Managed plan?
  A: Managed is sales-assisted. Choose **Contact sales** on the Managed card, or file a ticket from Help & Support, and our team will confirm onboarding and pricing.
