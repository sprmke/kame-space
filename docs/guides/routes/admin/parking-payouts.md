---
title: 'Super Admin parking payouts — operator guide'
status: active
tags: [guides, routes, admin, parking]
updated: 2026-11-19
---

# Super Admin parking payouts — operator guide

Route: `/admin/parking/payouts`

> **Status:** Documented · hosts set their own parking rate; the platform adds a **guest service fee** on top and a no-loss guard blocks configs that lose money · rebuilt on the shared console scaffold — commission/fee config is a
> `SuperAdminSettingsCard`; the disbursement ledger is a `Card`-wrapped table at ≥`lg` with a
> stacked card list below it (no more 5-column overflow on mobile). Actions and the
> `parking-payouts` GET/PATCH contract are unchanged.

## Progress overview

| Section           | E2E save | Validation | Docs | Notes                                                                              |
| ----------------- | -------- | ---------- | ---- | ---------------------------------------------------------------------------------- |
| Platform settings | Done     | Server     | Done | Commission % + guest fee + processor fee + support phone, singleton; no-loss guard |
| Payout ledger     | Done     | Server     | Done | Manual disbursement + clawback audit trail                                         |

---

## Overview

Two things on one page, per Phase 4 of the parking marketplace build:

1. **Commission, guest fee & processor fee config** (`platform_parking_settings` singleton).
   Hosts set their own nightly rate (minimum ₱100, no maximum). The guest pays the host rate
   **plus a guest service fee** (`guest_fee_pct` of the stay + `guest_fee_fixed` per booking,
   default 5% + ₱15). The host is paid their rate minus commission (default 10%). Includes a
   second, independently configurable commission rate (default 5%) for bookings made through a
   host's Phase 8 direct-booking link, plus an **estimated processor fee** (`payment_fee_pct` +
   `payment_fee_fixed`, default 3.125% + ₱15). The platform keeps
   `guest fee + commission - processor fee` per booking.
2. **Payout ledger** — paid, refund-review, refunded and needs-review parking rows, with manual
   **mark disbursed**, **record clawback** and **record refund** actions. Filters: Paid,
   Refund review, Needs review, Refunded, All. Each row shows the host payout **and** the platform
   net (guest charge minus host payout minus processor fee). `record_refund` is a bookkeeping
   action only (issue the money in the PayMongo dashboard); it moves the row to `refunded`. A host
   cancel after payment already moved it to `refund_review`, which blocks `mark_disbursed` until
   the refund is recorded. There is no automated payout yet — PayMongo Platforms split-payout
   requires a business application Kame Space hasn't made; this is the day-one manual path until
   that ships.

**Access:** `RequireSuperAdmin`.

**Step-up OTP:** saving commission/rate config and every mark-disbursed / record-clawback / record-refund action need a fresh email verification code (~15-min sudo window) — see [`overview.md`](overview.md#step-up-verification-all-admin-pages) / `.cursor/rules/admin-auth.mdc` §8.

**Browser tab title:** `Kame Space - Parking payouts`

---

## Behavior

### Commission & guest fee

- **Commission (%)** — taken from the host's gross rate; saved as `commission_pct` (0–1).
- **Direct-link commission (%)** — the reduced rate applied instead of Commission (%) when a
  booking came through a host's Phase 8 direct-booking link; saved as `direct_commission_pct`
  (0–1). Independent of the standard rate — changing one does not move the other.
- **Guest fee (%)** and **Guest fee fixed (₱)** — added on top of the host rate at checkout and
  kept by the platform. The percentage applies to the whole stay and the fixed amount is charged
  **once per booking** (not per night), because the processor's fixed fee is per transaction.
  There is no guest rate any more and no price cap: hosts can price above any amount.
- **Processor fee (%)** and **Processor fee fixed (₱)** — an editable estimate of what the
  payment provider keeps from the guest charge (default 3.125% + ₱15, matching a typical
  PayMongo local-card rate). Used only to estimate platform net margin, never to compute the
  host payout. Adjust it if PayMongo's schedule or the negotiated rate changes.
- **Booking example** — a live preview under the fields. Enter a host rate and it shows the host
  rate, guest fee, guest pays, commission, host receives, processor fee and platform net, plus a
  small table of platform net at ₱100 / ₱300 / ₱1,000 for the standard and direct-link channels.
  Nothing here is saved; it only previews the current form values.
- **No-loss guard** — a config is rejected (HTTP 400, "These settings lose money…") unless the
  platform net is ≥ ₱0 on both channels at the ₱100 minimum rate and the per-peso margin
  (`commission + guest fee - processor % × (1 + guest fee %)`) is not negative, so no rate from
  ₱100 up can lose money. The preview shows a red warning before you save. Defaults give +₱11.25
  (standard) and +₱6.25 (direct link) on a ₱100 night.
- **Save** — PUT `platform-parking-settings`. Changes apply only to bookings **created after**
  saving — an already-paid or in-flight `parking_payment_transactions` row keeps the values that
  were resolved and snapshotted onto it at checkout-creation time, never recomputed
  retroactively. That includes `payment_fee_amount` and `platform_net_total`, so a later fee
  change never rewrites historical margin.
- Commission % and the guest fee are also what a host sees in the pricing preview and the guest
  sees on the booking card (piggybacked onto the `parking-pricing` GET and the public parking
  detail response, since neither can call this super-admin-gated endpoint directly).
- **Support escalation phone (Phase 5)** — a platform-wide contact number surfaced on the guest
  parking status page (`/parkings/requests/:bookingId`) at all times, for a guest who can't reach
  an unresponsive host on-site. Optional; blank hides the line on the guest page.

### Payout ledger

- Lists paid transactions (most recent first): guest, stay dates/nights, listing, org, host
  gross/commission/net payout, guest charge, estimated processor fee, platform net, disbursement
  status. A row's commission line shows "Direct link" when that booking came through a Phase 8
  direct-booking link (reduced commission applied).
- **Totals strip** above the table sums guest charges, host payouts, processor fees and platform
  net for the rows in the current filter. Refunded rows stay in the sums of whatever filter is
  active; read the filter before treating a total as revenue.
- **Mark disbursed** — records `disbursed_at`/`disbursed_by` and an optional reference (e.g. a
  bank transfer or GCash reference number). Confirms the payout was made manually outside the
  platform — this button does not move money.
- **Record clawback** — records an amount + reason (e.g. a chargeback after disbursement).
  Audit trail only; no automated collection happens.
- A transaction can be marked disbursed once and have any number of clawbacks recorded against
  it afterward (both actions require the transaction to be `paid`).

---

## API

| Method | Edge function               | Notes                                                                                                                                                                                  |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `platform-parking-settings` | Returns the singleton settings row                                                                                                                                                     |
| PUT    | `platform-parking-settings` | Partial update of `commissionPct`/`directCommissionPct`/`guestFeePct`/`guestFeeFixed`/`paymentFeePct`/`paymentFeeFixed`/`supportEscalationPhone`; 400 if the merged config loses money |
| GET    | `parking-payouts`           | Lists `status = 'paid'` transactions, most recent first. Each row includes `paymentFeeAmount` and `platformNetTotal`.                                                                  |
| PATCH  | `parking-payouts`           | `{action: 'mark_disbursed', transactionId, reference?}` or `{action: 'record_clawback', transactionId, amount, reason}`                                                                |

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Layer                                                     | Path                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Page                                                      | `ui/src/features/dashboard/super-admin/pages/SuperAdminParkingPayoutsPage.tsx`                                                   |
| Hooks                                                     | `ui/src/features/dashboard/super-admin/hooks/usePlatformParkingSettings.ts`                                                      |
| Edge                                                      | `supabase/functions/platform-parking-settings/index.ts`, `supabase/functions/parking-payouts/index.ts`                           |
| Resolver (server-side reads)                              | `supabase/functions/_shared/parkingPlatformSettings.ts`                                                                          |
| Payment amount math (per-night proration)                 | `supabase/functions/_shared/parkingPaymentOrchestrator.ts`                                                                       |
| Settlement math (commission, processor fee, platform net) | `supabase/functions/_shared/parkingSettlement.ts` (+ UI display mirror `ui/src/features/dashboard/parking/lib/parkingPayout.ts`) |
| Guest fee + no-loss check                                 | `supabase/functions/_shared/parkingGuestFee.ts` (+ UI mirror in `parkingPayout.ts`)                                              |
| Match-engine ranking (cheapest first, no price cap)       | `supabase/functions/_shared/parkingBroadcastRanking.ts`                                                                          |
| Host-facing commission/guest fee                          | `supabase/functions/_shared/parkingPricing.ts`, `ui/src/features/dashboard/parking/components/ParkingPricingRatesFormCard.tsx`   |
| Direct-link channel resolution (Phase 8)                  | `supabase/functions/_shared/parkingDirectLink.ts`                                                                                |

---

## Host-facing knowledge

Hosts do not see this page. What affects them: the commission percentage (visible as the
"Platform fee" / "You receive" breakdown under each rate field). The guest fee is paid by the
guest on top of the host's rate and does not reduce their payout. Payout disbursement itself
currently happens manually outside the platform - a host who has been paid for a completed
parking booking should see this reflected by their usual payment channel (bank transfer, GCash,
etc.), not an in-app payout notification.

**Common host questions**

- Q: When do I get paid for a parking booking?
  A: Payouts are currently handled manually by the platform team after the guest's payment is
  confirmed - you'll be paid through your agreed channel, not automatically through the app.
- Q: Is there a maximum rate I can set?
  A: No. Hosts set their own rate from ₱100 per night up. Guests pay that rate plus a service fee.

---

---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

## Pending / follow-ups

- [ ] Real PayMongo Platforms split-payout (requires a business application to PayMongo — not
      code work)
- [ ] Host KYC onboarding for automated payout
- [ ] Volume eligibility threshold for automated payout
- [ ] Reconcile the processor-fee estimate against the actual PayMongo fee per payout (current
      value is a configurable estimate, not a per-transaction reconciliation)
