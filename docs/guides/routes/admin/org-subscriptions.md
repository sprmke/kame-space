---
title: 'Super Admin org subscriptions — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-11-18
---

# Super Admin org subscriptions — operator guide

Route: `/admin/pricing/subscriptions`

> **Status:** Documented

## Progress overview

| Section           | E2E save | Validation | Docs | Notes                                                                                               |
| ----------------- | -------- | ---------- | ---- | --------------------------------------------------------------------------------------------------- |
| Org subscriptions | Done     | Server     | Done | Assign/change, price override, billing cron, extend period, billing timeline, credit, held payments |

---

## Overview

**Billing is org-level only** — this page lists **organizations** (not properties) with their current org-wide subscription, since one subscription now covers however many properties an org has enrolled. Super-admin can manually assign or change a subscription (optionally overriding the computed price — this is how a sales-assisted Managed quote gets entered), run the billing dunning cron, or extend a subscription period for support cases.

**Access:** `RequireSuperAdmin`.

**Step-up OTP:** assign/change, price override, extend period, and run-billing-cron each need a fresh email verification code (~15-min sudo window) — see [`overview.md`](overview.md#step-up-verification-all-admin-pages) / `.cursor/rules/admin-auth.mdc` §8.

**Browser tab title:** `Kame Space - Org subscriptions`

---

## Behavior

- **Summary cards:** total organizations, organizations with a live subscription (`active`/`trialing`/`past_due`/`suspended`), active subscription count, and total properties platform-wide — all four via lightweight `count`-only PostgREST queries (`head: true`), not derived from the filtered/paginated list.
- **Run billing cron** — PATCH **`org-subscriptions-admin`** **`{ action: "run_billing_cron" }`** → the same idempotent pass the hosted hourly **`platform-billing-cron`** runs: scheduled plan changes and cancels at the period end, renewal links and notices (each sent once), past due, suspension, auto-cancel after the suspension window, checkout expiry and missed-webhook reconciliation. Safe to click twice.
- **Run Superhost cron** — POST **`superhost-assessment-cron`** with super-admin JWT and body **`{ "force": true }`** (batch re-assess all orgs on any day), or cron secret header when **`SUPERHOST_ASSESSMENT_CRON_SECRET`** is set (assessment days only). Same scheduled job as hosted **`sync_superhost_assessment_cron_job()`** (migration **`20261231130200_superhost_assessment_cron.sql`**).
- **Reassess Superhost** (table, lg+) — POST **`reassess-org-superhost`** **`{ orgId }`** for one org (force re-run; useful for support / manual QA).
- **Toolbar:** search (org name/slug), plan filter, table/grid view toggle (grid forced on mobile), per-page select (31/50/100). Search and plan-filter are applied **server-side** before pagination — the plan filter switches the `organizations → org_subscriptions → pricing_plans` select to `!inner` joins scoped to live statuses, so only orgs whose current subscription matches the chosen plan are returned.
- **Pagination:** standard admin-list `page`/`limit` pattern — real database-level pagination via `.select('*', { count: 'exact' })` + `.range()`. Default 31, capped 100.
- **Table/grid row:** organization, property count, current plan + status + snapshot price. Row detail (`?organizationId=`) shows recent subscription events + payment transactions.
- **Org billing panel** (org hub, **Subscription** section). One support view per org: billing state (status, period end, account credit, scheduled change), **Plan controls**, **Held payments** and one **History** timeline that merges subscription events, payments and credit entries, newest first. All actions go through the same rules as the host's own buttons (`orgSubscriptionStateMachine`) and write an activity-log entry:
  - **Remove scheduled change** (`clear_intent`) and **Apply now** (`apply_intent_now`, confirms: paid time left is not refunded).
  - **Cancel at period end** (`cancel_at_period_end`, hidden while a change is already scheduled) and **End plan now** (`cancel_now`, confirms).
  - **Adjust account credit** (`adjust_credit`): amount in pesos (positive adds credit, negative removes it) plus a required note.
  - **Held payments**: money PayMongo collected that was not applied (stale, duplicate or after-expiry). **Apply** runs it through the normal path; **Keep as credit** records it as account credit. Disabled for a payment the server already classed as stale.
  - **Recent payments** lists the last five applied payments with their receipt number. **Mark refunded** (`record_refund`, confirms) records a refund that was already done in the PayMongo dashboard; the `payment.refunded` webhook does the same automatically, so this is the fallback when the webhook was missed. It does not end or shorten the plan. Cash refunds are never issued from the product.
- **Assign / change:** one plan selector + **Apply** per row. Calls POST with `{ organizationId, planId }` — enrolls every property the org owns by default (there's no per-property picker here; that granularity is the host-facing `/org/:orgSlug/plans` page's job — pass `propertyIds` explicitly only if a narrower enrollment is needed via direct API use). An optional **override price** field bypasses the rate × count × volume-discount formula entirely — this is the mechanism for entering a manually-quoted Managed price.
- Large orgs (hundreds of properties) are safe: `createOrgSubscription` / `changeOrgSubscription` (and related pool counts) chunk PostgREST `.in()` filters via `_shared/postgrestInChunks.ts` so validation never hits **"URI too long"** when enrolling every property at once.
- Creating a fresh subscription vs. changing an existing one is handled transparently server-side (`createOrgSubscription` vs. `changeOrgSubscription`) — the admin UI doesn't need to know which case applies.

New properties do **not** auto-receive a paid plan on creation — an org with no subscription simply resolves every property to Free until one is assigned here or purchased via the org's own Plans page.

---

## API

| Method | Edge function             | Notes                                                                                                                                                                                                                                                                                                                      |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `org-subscriptions-admin` | Paginated org list/filter (`search`, `planCode`, `page`, `limit` — default 31, capped 100), platform-wide aggregate (`summary=true` → `{ summary }`), or detail (`organizationId` → subscription incl. pending intent, recent events, transactions, account-credit ledger and balance)                                     |
| POST   | `org-subscriptions-admin` | Manual assign/change **`{ organizationId, planId, propertyIds?, overridePricePhp? }`**                                                                                                                                                                                                                                     |
| PATCH  | `org-subscriptions-admin` | **`run_billing_cron`**, **`extend_period`** **`{ organizationId, periodEnd, status?, note? }`** (moves a scheduled change with the period), **`clear_intent`**, **`cancel_at_period_end`**, **`apply_intent_now`**, **`cancel_now`**, **`adjust_credit`**, **`record_refund`**, **`resolve_payment`**, **`revoke_reward`** |

---

## Implementation map

| Layer      | Path                                                                                                                                                                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page       | `ui/src/features/dashboard/super-admin/pages/SuperAdminOrgSubscriptionsPage.tsx`, `SuperAdminOrgSubscriptionSection.tsx` (org hub), `components/super-admin-orgs/SuperAdminOrgBillingPanel.tsx`, `lib/superAdminBillingTimeline.ts`                                                                   |
| Components | `super-admin/components/super-admin-pricing/SuperAdminOrgSubscriptionsTable.tsx`, `SuperAdminOrgSubscriptionCard.tsx`, `SuperAdminOrgSubscriptionsSummaryCards.tsx`, `SuperAdminOrgSubscriptionsToolbar.tsx`                                                                                          |
| Hooks      | `usePricingPlans.ts`, `usePlatformPaymentSettings.ts` (`useRunPlatformBillingCron`), `useOrgBillingAdmin.ts` (detail + actions)                                                                                                                                                                       |
| Edge       | `supabase/functions/org-subscriptions-admin/index.ts`                                                                                                                                                                                                                                                 |
| Shared     | `supabase/functions/_shared/planEntitlements.ts` (`createOrgSubscription`, `changeOrgSubscription`, `getActiveOrgSubscription`), `postgrestInChunks.ts` (URI-safe `.in()` chunking for large property lists), `subscriptionOrchestrator.ts` (`runPlatformBillingCycle`, `adminExtendOrgSubscription`) |

---

## Host-facing knowledge

Hosts manage paid plans on the org's own **Plans & Billing** page (`/org/:orgSlug/plans`, PayMongo checkout). Contact support for manual plan changes, custom Managed pricing, or billing extensions. A **suspended** org keeps its dashboard but works like Free: paid features are paused until the owner pays, and the plan ends on its own after the suspension window. Guest booking pages keep working. The super-admin overview attention panel counts **Payments held for review** and **Orgs with paid features paused for over a week**; billing cron failures show up under system health.
---

## Testing

| Layer  | Path / spec                                                                                                                                                                                           | Manual                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change; `superAdminBillingTimeline.test.ts` (merge + ordering); `SuperAdminOrgBillingPanel.test.tsx` (actions, confirms, held payments, credit form) | —                                                           |
| Server | `supabase/functions/tests/handlers/org-subscriptions-admin.test.ts`; `orgBillingLifecycle.integration_test.ts` (local DB, `LOCAL_BILLING_LIVE=1`)                                                     | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only                                                                                                                                                   | —                                                           |
| Manual | —                                                                                                                                                                                                     | [`super-admin-manual.md`](../testing/super-admin-manual.md) |
