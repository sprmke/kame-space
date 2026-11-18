---
title: 'Plans Playwright'
status: active
tags: [guides, testing, playwright, plans]
updated: 2026-11-18
---

# Plans Playwright

Mocked org Plans & Billing flows: checkout, scheduled downgrade and cancel, price changes, account credit and billing details (PayMongo redirect stubbed, edge functions mocked).

## Specs

| Spec                                                       | Tags  | Covers                                                                                                                                                        |
| ---------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/e2e/features/plans/org/orgPlanCheckout.spec.ts`        | `@ci` | Upgrade review, PayMongo handoff, return URLs (success, cancelled), resume payment, confirming banner only for a checkout this browser started, watch timeout |
| `ui/e2e/features/plans/org/orgPlanScheduledChange.spec.ts` | `@ci` | Schedule a downgrade and keep the plan, cancel at the period end and resume, overdue plan cannot schedule but can end now, suspended and member views         |
| `ui/e2e/features/plans/org/orgPlanBillingFlows.spec.ts`    | `@ci` | `price_changed` 409 refresh, paid with account credit, billing details save and unsaved-changes guard, TIN validation, member read-only                       |
| `ui/e2e/features/plans/org/orgPlanReviewDialog.spec.ts`    | `@ci` | Per transition: what an upgrade unlocks, what a scheduled downgrade turns off, what a cancel turns off                                                        |
| `ui/e2e/features/plans/org/orgPlansCardsCompare.spec.ts`   | `@ci` | Tier cards, current marker, per-tier actions (`Upgrade`, `Switch at renewal`, `Cancel plan`), Compare table                                                   |

## Harness

- `shared/orgPlanHarnessShared.ts`: session, golden catalog, `planPreviewPayload` (shape of `preview-org-plan-change`)
- `shared/orgPlanCheckoutHarness.ts`: checkout mocks + PayMongo stub. Options: `priceChangesTo` (first checkout is refused with the fresh amount), `coveredByCredit`, `billingDetails`; state records `checkoutCalls` and `billingDetailsSaves`
- `shared/orgPlanDowngradeHarness.ts`: scheduled-change mocks (`org-subscription-change` records `changeCalls`); `openPlanChange` pages the tier carousel first so the sidebar never covers a card button
- `shared/planPageAssertions.ts`: card and Compare assertions, `bringTierCardIntoView`

Setup Guide auto-open is suppressed via dismissed `setupGuide` in org fixtures.

## Other layers

| Layer                      | Where                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure rules                 | `supabase/functions/_shared/orgSubscriptionStateMachine_test.ts`, `orgBillingQuote_test.ts`, `billingPeriod_test.ts`, `planEntitlements_test.ts` (add-property quote)                                                                             |
| Handlers                   | `supabase/functions/tests/handlers/{org-subscription-change,preview-org-plan-change,org-billing-details,get-org-payment-receipt,platform-billing-cron,paymongo-webhook}.test.ts`                                                                  |
| Real Postgres              | `supabase/functions/tests/orgBillingLifecycle.integration_test.ts` (`LOCAL_BILLING_LIVE=1`, PayMongo stubbed): purchase, stale payment, scheduled downgrade and cancel, past due to suspended to ended, credit renewal, property true-ups, refund |
| Components                 | `AddPropertyBillingNote.test.tsx`, `SuperAdminOrgBillingPanel.test.tsx` (`vitest.dom.config.ts`)                                                                                                                                                  |
| Walk the lifecycle locally | `bun run billing:time-travel -- --org <slug> --days 31 --run`                                                                                                                                                                                     |

## Run

```bash
bun run test:e2e:plans
bun x playwright test ui/e2e/features/plans --project=chromium-ci
```

## Manual gaps

Webhook _delivery_ from PayMongo to the deployed project (the sandbox webhooks are disabled; see `paymongo-billing-setup.md`).
