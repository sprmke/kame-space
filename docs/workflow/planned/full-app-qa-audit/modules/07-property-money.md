---
title: 'QA packet 07: finance, pricing, plans, vouchers'
status: planned
stage: planned
kind: reference
tags: [qa, audit, finance, pricing, plans, vouchers]
updated: 2026-11-13
---

# 07 Money: finance, pricing, plans, vouchers

**Rows:** PROP-04, PROP-05, PROP-06, and the property-side view of ORG-06 · **Personas:** `owner`, `org-admin`, `operations` (must be denied finance), `viewer`, `custom` · **Tiers:** all, because most gates live here · **Environments:** L. P test tenant: view, plus reversible pricing rule edits restored afterward.

Everything on these pages is a number someone will act on. Recompute by hand; do not trust that a plausible number is right.

## References

Guides: `org/property/finance.md`, `pricing.md`, `calendar.md`, `org/plans.md`, `account/vouchers.md`, `for-hosts.md`. Architecture: `plans-feature-matrix.md`, `smart-pricing.md`. Manual guides: `plans-playwright.md`, `voucher-reveal-playwright.md`, `cost-abuse-verification.md`. Skills: `plans-and-permissions`, `integrations`. Specs: `ui/e2e/features/plans` (8), `vouchers` (7), finance has the one adopted coverage manifest (`ui/e2e/pages/org/…`). Scripts: `check:plan-catalog`, `qa-probe-plan-gates.mjs`, `seed:plan`. Earlier QA: `04-finance`, `05-pricing`, `13-plans`, `16-plans-and-rbac`. `for-testing`: `smart-pricing-ai`. Planned: `ai-credits-topup-purchase`.

## Probe beyond the generic lenses

**Finance (PROP-04)**

- Unified ledger: every source of a line (booking payments, down payment, balance, SD held and refunded, parking, vouchers, manual income and expense, refunds, payouts). For a seeded month, rebuild the totals from the DB and compare with every summary figure.
- Transaction CRUD on `finance_line_items`: create, edit, delete, categories, attachments and receipts, AI receipt reading if present, entry activity history, concurrent edit.
- Filters, date ranges across month and year boundaries in Manila time, grouping, search.
- Export report (plan gate on reporting exports): file opens, totals equal the screen, encoding, large ranges.
- Negative amounts, zero, very large, decimals and rounding, a refund larger than the payment, editing a line that a booking generated.
- Finance at org level and parking level as deltas (C22); Telegram finance cron digest content.

**Pricing (PROP-05)**

- Pricing grid: single cell, range select, drag, weekend and weekday, month navigation, bulk edit, clear override, undo; unsaved-changes guard.
- Rates and fees sidebar: base rate, extra guest, cleaning, pet, parking, deposit, minimum stay, discounts. Each one traced into the guest quote (C08).
- Precedence: override vs rule vs base vs smart pricing. Build a small table of cases and verify the guest form, listing and search show the same nightly price for each.
- Channel sync (Airbnb iCal, plan gate `calendarSync`): import URL validation, sync now, `calendar-sync-cron`, export feed URL, blocked dates appear on the public calendar (C09), a feed that is down, a feed with overlapping events.
- Smart pricing (AI): enable, suggestion review, apply, bounds, `smart-pricing-cron`, AI credit use, behavior when the provider is down, what a downgraded plan keeps.
- Edge cases section of the guide, one by one.
- Redirects `calendar` and `pricing/calendar`.

**Vouchers (PROP-06)**

- Wherever hosts configure them (Reviews and vouchers settings section): types, values, expiry, reveal style, limits.
- Issue on the SD form reveal, guest wallet, apply on a new form, booking detail pricing, finance line, release on cancel, double redemption attempt from two tabs (C27).

**Plans and gates (with ORG-06)**

- Build the gate matrix from `PlanFeatureKey`: every key × every tier → allowed or blocked, and list each page element that the key controls. This is coverage inventory K10.
- For each key verify on one page: the UI affordance below tier, no request fired, the server refuses a direct call with the upgrade envelope, and the feature works at the minimum tier.
- Limits rather than booleans: properties, seats, AI credits, storage quota, Meta publishes. Test at limit minus one, at limit, and over.
- Downgrade and lapse: what becomes read-only, what is hidden, what keeps running (crons, auto-replies, smart pricing). Compare with the guide.
- Public pricing page, in-app Plans page, `planPresentation.ts` and the super-admin catalog all show the same thing (C17).

## Hidden surfaces

`finance-*`, `pricing-*`, `smart-*`, `calendar-*`, `ical-*`, plan and subscription functions, `paymongo-webhook`, `platform-billing-cron`, `smart-pricing-cron`, `calendar-sync-cron`, `telegram-finance-cron`, `sd-refund-cron`, entitlement resolver shared between client and server.

## Connections and journeys

Source of C08, C09, C16, C22, C27. J06, J09, J10, J19, J20.

## Known risks

- Client and server entitlement logic are mirrors; drift means a UI-only gate.
- PayMongo live checkout is likely `blocked` locally; then subscription state changes are driven by a simulated signed webhook, and the live pass is listed for the owner.
- AI limits are super-admin only by decision; hosts get a toggle. Any host-editable limit is a defect.
