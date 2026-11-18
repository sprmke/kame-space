---
title: 'Audit 10: billing, plans and payments'
status: active
tags: [audit, billing, payments, money]
updated: 2026-11-19
---

# 10: Billing, plans and payments

Deep pass on every money surface: public pricing, in-app Plans & Billing, checkout, plan changes,
renewals, dunning, payouts, refunds and the finance figures that report on all of it. Local DB is the
source of truth. Example amounts come from the test org state at the time of the run; the **mechanics**
are what matter and each was checked in code.

Screenshots: `/tmp/audit/billing-screens/` (37 files).

---

## P0

### B1. Archived properties are billed but excluded from the quote the host approves

The review dialog and the server compute the property count differently:

- **UI** (`OrgPlansPage`): `properties.length - archivedPropertyCount`, archived excluded.
- **Checkout** (`_shared/orgSubscriptionCheckout.ts:83-89`): selects **every** property for the org,
  no `inactive_reason` filter.
- **Admin/downgrade path** (`planEntitlements.ts#listOrganizationPropertyIds`): excludes archived.

Reproduced with 2 billable + 1 archived property: the dialog said "Billing covers all **2**
properties … due today **₱1,378**"; the server wrote a **₱2,400** charge for 3 rows. The proration
credit matched on both sides, so the whole gap is the archived row.

Impact: **₱1,022/month (74%) over the approved amount** for that org, scaling with each archived
listing. The host approves one number and is charged another, which is a billing-disclosure and
consumer-protection problem, not just a bug.

Fix: use `listOrganizationPropertyIds()` in checkout and assert `amount === quote` server-side.

### B2. Past-due and suspended orgs can upgrade and the overdue balance disappears

`fulfillOrgSubscriptionPayment` treats `past_due` and `suspended` as an existing subscription
(`subscriptionOrchestrator.ts:217`), then on payment:

- sets `status = 'active'`,
- clears `grace_period_ends_at`,
- starts a **new period from now**,
- charges only the new plan amount.

There is no overdue line item and no carry-forward. Downgrades are blocked while past due; upgrades
are not. So an org can buy its way back to active and the previous period is written off.

Impact: one overdue period lost per dunning case (₱399 Starter to ₱1,799 Business in the seed
pricing).

### B3. Archiving a plan silently downgrades every subscriber to Free

`/admin/pricing/plans` → Edit → Active toggle is the only archive control. With a live subscriber:

- host Plans page flips to "Free plan … Next renewal Dec 1, 2026" (still showing paid dates),
- entitlements fall back to Free because `pricing_plans.is_active` is false,
- `platform-billing-cron` skips inactive plans (`if (!is_active) continue`), so no renewal, no
  dunning, no notice.

Impact: instant feature loss for every subscriber on that plan with no email and no migration path.

---

## P1

### B4. Prices are per property but presented as a flat monthly price

`/for-hosts/pricing` shows Business as **₱1,439 /month**. That is the per-property rate after the 20%
discount; the page never says "per property", and the public DTO does not include the property count
or the volume ramp so it cannot show a total. A 3-property org is charged **₱3,690/month** (2.56× the
card). The FAQ that explains the multiplication only exists on the in-app Plans page.

Impact on a 3-property Business host: ₱2,251/month (₱27,012/year) above what the page implies.

### B5. Current-plan banner and the same plan card disagree, and renewals use a stale snapshot

On one screen: banner "Business ₱1,799/month" while the Business card (marked Current) shows
"₱1,799 struck, 20% off, ₱1,439/month". The banner reads `price_php_snapshot` (what this org pays);
the card reads list × discount (what a new org would pay). `create-org-subscription-checkout` renews
from the snapshot, so an existing host pays ₱360/month (₱4,320/year) more than a new host on the same
plan. `plan_price_migrations` exists but has **zero rows and zero code references**, so no price
change ever reaches existing subscribers.

### B6. A pending checkout blocks every other plan change and stale links are reused

`org_payment_transactions_one_pending_per_org_idx` allows one pending row per org. Selecting a
different plan while one exists returns a raw duplicate-key error as **502**. Selecting the same plan
"reuses" the existing `checkout_url` without asking PayMongo whether it is still valid (when the
provider state is `unknown`, the code treats it as reusable). `pending_checkout_ttl_hours` (24) is
never read, `expires_at` is never set, and there is no sweeper.

Impact: blocked upgrades, or a host sent back to an expired/foreign checkout URL.

### B7. Checkout is fully down without PayMongo keys and leaves money-shaped failed rows

With no `PAYMONGO_SECRET_KEY`, every checkout returns 503. The host sees only "This is temporarily
unavailable." Each retry inserts a `failed` `org_payment_transactions` row with an amount, no
provider reference, no `purpose`, no `line_items` and no `expires_at`; those rows appear in Payment
history as "Business plan · Failed". Admin Payment settings has no provider health indicator, so the
operator cannot see that checkout is disabled.

### B8. Payments cannot be traced to what they covered

The paid row in the seed has `amount 1799`, `status paid`, `provider_reference cs_local_seed_subscription`,
`payment_method_type card`, **no `receipt_number`**, **empty `line_items`**, and period fields that do
not match the subscription (payment row Oct 18 → Nov 18 vs subscription period ending Dec 17).
`fulfillOrgSubscriptionPayment` never writes `purpose`, `period_start`, `period_end`, `period_paid_php`
or a receipt number, and `org_billing_ledger` has zero rows and zero code references.

Impact: a **₱1,799 month granted but unbilled** in this dataset, and in general no auditable link
between money in, the period it bought, and a receipt. Chargebacks and tax questions cannot be
answered from the database.

### B9. There is no cancel-at-period-end

`cancel_at_period_end`, `scheduled_plan_id`, `scheduled_change_at`, `cancel_requested_at` and
`canceled_at` exist, plus `cancel_scheduled` / `change_scheduled` event types, but no UI or edge
function writes them. The only way to stop paying is **Downgrade to Free**, which applies immediately
and forfeits unused time (the dialog admits it). On the seed period that is up to ~₱1,740 of prepaid
service lost, and there is no "cancel at renewal" option.

### B10. Downgrades reprice the snapshot with no credit, and the next upgrade over-credits

`changeOrgSubscription` updates `plan_id` and `price_php_snapshot` but keeps the period and writes no
ledger row and no credit. In the observed run a host who paid ₱1,799 saw the next renewal reprice to
₱2,196 on a _downgrade_, and the next upgrade credited ₱1,061 (from the new snapshot) instead of ₱870
(money actually paid): a ₱191 over-credit.

### B11. Three different "net" figures for one property and month

| Surface                          | Net     |
| -------------------------------- | ------- |
| Finance page "Net Profit"        | ₱49,890 |
| `finance-summary` API `grandNet` | ₱7,390  |
| Analytics `netProfit`            | ₱42,500 |

The UI's number is `stays.bookingRate + otherFees + operating.net` (42,000 + 500 + 7,390), so
**₱42,500 of unpaid pipeline is counted as income** while the same page shows "Pending payments
₱32,000". The API's own `grandNet` excludes it. Pick one definition and label it.

### B12. Parking payout ledger reports ₱0 platform net despite a ₱280 commission

`platform_net_total` and `payment_fee_amount` are 0 on all paid rows, while guest charges (₱2,800) and
host payouts (₱2,520) differ by ₱280. One direct-link row applied 10% instead of the configured 5%.
The disbursement record therefore says the platform earned nothing.

---

## P2

| #   | Finding                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B13 | **Admin plan assignment creates free-forever paid plans.** An active subscription with `source='purchase'`, ₱0 snapshot, no payment transaction and often no period still counts as a live Starter/Business sub and inflates plan mix/MRR.                        |
| B14 | **Refunds are unverifiable and absent from Finance.** A "sent" refund has `sent_at = null`, no proof and no provider reference, and the ₱3,500 refund is not an expense, so net is overstated by that amount.                                                     |
| B15 | **Dunning has no ladder.** One renewal link, one grace period, then suspend. No retry schedule, no attempt counter, no dunning UI despite the "Payment settings" page implying control.                                                                           |
| B16 | **Admin cannot see ARPU anywhere**, and "MRR" is the snapshot rather than collected revenue, so the overview cannot answer "what did we actually collect".                                                                                                        |
| B17 | **Plan list totals disagree with the DB** ("Total plans 6, host tiers 5, active 5" while the DB has 7 plans including an inactive Business Plus). Commission is silently omitted, inactive is counted.                                                            |
| B18 | **Payment history labels a seed payment as "Card"** although the enabled rails are QR Ph/Maya/DOB; method type comes from the seed, not the provider.                                                                                                             |
| B19 | **Failed checkout rows accumulate on every retry** and are not deduped (no idempotency key), so history fills with identical failed attempts.                                                                                                                     |
| B20 | **Public pricing carousel opens on the paid card** (Plans 2-4 of 5), hiding the Free tier on mobile (see 07-M6).                                                                                                                                                  |
| B21 | **No invoice/receipt document** is stored or downloadable; the receipt email is the only artifact.                                                                                                                                                                |
| B22 | **Parking per-night calculator is disconnected from stored bookings**: the page computes ₱102.48 platform net while the ledger stores ₱0.                                                                                                                         |
| B23 | **Finance income includes an expense**: the seeded "Water bill" (Association Dues) and "Slot signage" rows are stored with `kind='income'`, inflating income by ₱6,800 across the property and parking finance pages. Seed bug, but the UI gives no sanity check. |

---

## What works

- Proration math on the checkout quote is correct (`currentPrice / totalDays × remainingDays`, capped
  at the target; minimum ₱20).
- Volume ramp and tiers compute correctly at 1, 3, 10, 12, 20 and 21 properties.
- Downgrade-to-Free unenrolls properties and reconciles team seats.
- PayMongo webhooks are signature-verified and deduped.
- The payment settings page exposes rails, lead days and grace period.
- Plan catalog, host cards and the compare matrix come from one shared presentation module, so the
  in-app pages agree with each other (the public page is where the per-property gap appears).

## Coverage

Public pricing (3 viewports), in-app Plans (4 tabs), upgrade/downgrade/cancel/checkout flows, renewals
and dunning code paths, admin plans/subscriptions/payment settings/orgs/overview, property and parking
finance, payout ledger, refunds, and the full price reconciliation table from the source data.

Not exercised: a real PayMongo checkout (no keys), real dunning emails (no Resend key), and the
managed/sales-assisted flow.
