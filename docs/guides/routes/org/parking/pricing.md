---
title: 'Parking Pricing — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-11-19
---

# Parking Pricing — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug/pricing`

> **Status:** Documented — weekday/weekend base rates + calendar overrides; **hosts set their own rate (minimum ₱100, no maximum)**; guests pay that rate plus a service fee; payout preview shows the rate guests see, the platform fee and the payout; direct booking link since Phase 8.

## Progress overview

| Section                       | E2E save | Validation | Docs | Notes                                                                                               |
| ----------------------------- | -------- | ---------- | ---- | --------------------------------------------------------------------------------------------------- |
| Base rates                    | ✅       | ✅         | Done | `parking_settings.weekday_nightly_rate` / weekend                                                   |
| Calendar custom dates         | ✅       | ✅         | Done | `parking_pricing_date_overrides`                                                                    |
| Date blocks                   | ✅       | ✅         | Done | `parking_blocked_dates`; broadcast + calendar UI                                                    |
| Fees                          | —        | —          | N/A  | Not applicable for parking                                                                          |
| Booked nights                 | ✅       | —          | Done | `bookedDateKeys` from claimed parking bookings                                                      |
| Team access                   | —        | —          | Done | Parking team `pricing:view` / `pricing:edit`                                                        |
| Payout preview                | —        | —          | Done | Rate guests see + platform fee + net payout under each rate field — display only, live commission % |
| Minimum rate (₱100)           | ✅       | ✅         | Done | Rejected client- and server-side; no maximum; a cleared field can't be saved                        |
| Direct booking link (Phase 8) | —        | —          | Done | Copyable link at a reduced fee, with a per-night comparison using the current rate                  |

---

## Overview

Parking **Pricing** mirrors the property pricing calendar but only stores **weekday** and **Fri–Sun weekend** nightly rates. There are **no fee defaults** (no down payment, security deposit, pet fee, etc.).

**One price, set by the host.** The host edits the nightly rate and guests see that same rate on cards and the detail page. At checkout the guest pays the rate plus a small **service fee** (a percentage of the stay plus a flat amount per booking, set by a super admin at `/admin/parking/payouts`). The service fee never comes out of the host's payout. The platform fee is a percentage of the host rate and is taken from the payout. The page shows the rate guests see, the platform fee and the host's net per night before saving.

**Permissions:** parking team `pricing:view` to open the page; `pricing:edit` to edit rates and calendar overrides. A parking member with `pricing:edit` can edit without holding an org-level parking permission.

**Defaults (seed):** weekday ₱300, weekend ₱350 (local seed) / ₱400 (migration default).

**Minimum rate:** every base rate and every calendar override must be at least **₱100**. There is no maximum. The field steps by ₱50 as a hint, but any amount from ₱100 up is accepted. A cleared field stays empty while you type, shows an inline error and can't be saved. A rate already stored below ₱100 is left as is: the form flags it and **Save** stays off until it is raised, and bookings already in flight keep charging the stored rate.

---

## Host-facing knowledge

Parking **Pricing** sets the nightly price guests see for this slot. Guests pay your rate plus a small service fee at checkout. You set a weekday rate and a higher Fri–Sun weekend rate, then optionally override specific future dates on the calendar. Your payout is your rate minus the platform fee. The guest service fee is on top and is not taken from you. There are no stay-style fees like deposits or pet fees, just nightly parking rates. Changes can apply to all future dates or only the month you’re viewing.

**Common host questions**

- Q: How do weekend rates work?
  A: Friday through Sunday nights use the weekend nightly rate automatically. Monday–Thursday use the weekday rate unless you set a custom price on the calendar for those dates.
- Q: Can I charge a special rate for holidays?
  A: Yes. Click or drag those dates on the calendar and set a custom nightly amount. Custom dates show with a pen icon in the legend.
- Q: Will booked or blocked nights block the calendar?
  A: **Booked** nights (claimed reservations) and **Blocked** nights (owner-managed closures) show on the calendar and are excluded from broadcast candidate matching. Block future dates via the pricing modal **Block** action; unblock the same way.
- Q: What do "Guests see", "Platform fee" and "You receive" mean?
  A: "Guests see" is the nightly rate you set. The platform fee is our cut of your rate. "You receive" is your payout per night after that fee. Guests also pay a separate service fee at checkout, and it does not reduce your payout.
- Q: How is the platform fee calculated?
  A: It is a percentage of your nightly rate. For example, at 10% on a ₱300 rate, the fee is ₱30 and you receive ₱270 per night. The guest's service fee is added on top of your rate and is not part of this.
- Q: Is there a maximum rate?
  A: No. You can price your slot at any amount from ₱100 up. Higher rates can rank lower in matching because requests go to the cheapest eligible slots first, but they are never excluded.
- Q: Why can't I save a rate under ₱100?
  A: ₱100 per night is the minimum so the booking covers payment processing costs. Enter ₱100 or more.
- Q: What's the direct booking link for?
  A: A link you can share yourself (text, chat, wherever) that takes a guest straight to your listing's booking form instead of the general marketplace search. Bookings through it use a lower platform fee since you sourced the guest yourself. The card shows the exact per-night difference using your current rate.
- Q: When do I get paid?
  A: Payouts are handled manually by the Kame Space team after the guest's payment is confirmed. They are not sent automatically through the app yet.

---

## Sections

### Summary cards

Three KPI chips: weekday base rate, weekend premium %, count of custom calendar dates.

A **How payouts work** hint sits next to the page title (3 steps + tip).

### Calendar

- Month grid titled **Rates & availability** (_Manage pricing and availability_ on desktop); legend under the grid on **`lg+` only** (hidden on phone/tablet).
- Legend: **Available**, **Custom** (pen icon), **Booked**, **Blocked**, **Selected**.
- Click or drag future available dates → **Set nightly rate** modal (**Reset** / **Apply**; close via X). When every selected night is blocked, modal offers **Unblock** only.
- **Mobile (`max-lg`):** no pointer drag — the grid uses a **two-tap** range model (tap start → thick primary border on the cell, no tip banner → tap end commits; tap a booked/locked cell clears the armed start). Selected/armed/today use border-only highlight below `sm` (no ring). Shorter day cells below `sm`; title **Pricing**, month **MMM yyyy**, denser stay pills (~20px). All seven day columns stay on screen at 375px; the card tightens its padding and week gaps instead of scrolling sideways, and the direct-link URL truncates inside its column. Shared `PricingCalendarGrid`, so this matches property Pricing exactly.
- **Block** / **Unblock** in the modal persist via **`parking-pricing`** PATCH (`blockRange` / `unblockDateKeys`).

### Base rates (right column)

| Field               | DB column              | Default | Rule               |
| ------------------- | ---------------------- | ------- | ------------------ |
| Weekday (per night) | `weekday_nightly_rate` | ₱300    | ≥ ₱100, no maximum |
| Fri–Sun (per night) | `weekend_nightly_rate` | ₱400    | ≥ ₱100, no maximum |

Commission % and the guest service fee are read live from the `parking-pricing` GET response
(`commissionPct`/`guestFeePct`/`guestFeeFixed`, sourced from the super-admin
`/admin/parking/payouts` config), not hardcoded. Each field shows a three-line breakdown
underneath using those live values, plus one line under the fields about the guest service fee:

```
Guests see          ₱300 / night
Platform fee (10%)  -₱30
You receive         ₱270 / night
```

A rate under ₱100 or an empty field shows an inline error and disables **Save**. Saving is also
refused from the leave dialog and the Setup Guide step. The card header carries a **Base rates**
hint.

**Save** at the bottom of the card when values change.

### Direct booking link (Phase 8)

Below the rates card: **Direct booking link** — a one-line explanation that sharing the link
lowers the platform fee, a per-night comparison using the current weekday rate (for example
"Weekday: you receive ₱285 instead of ₱270 per night"), the monospace URL preview, and **Copy
link** for `/parkings/:slug/form?dl=<token>` — the exact same booking form guests reach from
search, carrying an opaque per-listing token instead. The token is generated automatically the
first time this page loads for the listing (nothing to configure) and never changes. A guest
following the link still signs in as usual — the link only changes which platform fee applies,
not whether sign-in is required. A short note under the button says so.

### Save dialog (base rate changes)

| Option                    | Behavior                                                                       |
| ------------------------- | ------------------------------------------------------------------------------ |
| **All future dates**      | Updates `weekday_nightly_rate` / `weekend_nightly_rate` in `parking_settings`. |
| **{Month} only**          | Writes date overrides for each future day in the visible month at form rates.  |
| **Override custom rates** | Clears existing custom overrides before applying scope.                        |

---

## API

| Method | Edge function     | Query          | Body (PATCH)                                                                                                                   |
| ------ | ----------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `parking-pricing` | `?parking_id=` | — (also returns `commissionPct`/`directCommissionPct`/`guestFeePct`/`guestFeeFixed`, `directBookingToken`/`directBookingSlug`) |
| PATCH  | `parking-pricing` | `?parking_id=` | `weekdayNightlyRate`, `weekendNightlyRate`, `dateOverrides`, `blockRange`, `unblockDateKeys`                                   |

Auth: signed-in user + parking team permission. `verify_jwt = false`; handler uses `resolveScopedParkingTeamAccess` (`pricing:view` / `pricing:edit`).

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Layer                                                                     | Path                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                                                                      | `ui/src/features/dashboard/parking/pages/ParkingPricingPage.tsx`                                                                                                                                                                                                                                               |
| Loading skeleton (`PricingPageBodySkeleton`)                              | `ui/src/components/skeletons/PricingSkeleton.tsx` — 3 stat cards, the live month's week rows (day + price cells, outside days blank), rates card with payout helper lines + direct-link card (stacked on phone)                                                                                                |
| Rates form card (payout preview, ₱100 minimum)                            | `ui/src/features/dashboard/parking/components/ParkingPricingRatesFormCard.tsx`                                                                                                                                                                                                                                 |
| Direct link card (Phase 8)                                                | `ui/src/features/dashboard/parking/components/ParkingDirectLinkCard.tsx`                                                                                                                                                                                                                                       |
| Hooks                                                                     | `ui/src/features/dashboard/parking/hooks/useParkingPricing.ts`                                                                                                                                                                                                                                                 |
| API client                                                                | `ui/src/features/dashboard/parking/lib/parkingPricingApi.ts`                                                                                                                                                                                                                                                   |
| Client-side fallback-only commission / guest fee defaults (pre-load only) | `ui/src/features/dashboard/parking/lib/parkingPricingDefaults.ts`                                                                                                                                                                                                                                              |
| Edge                                                                      | `supabase/functions/parking-pricing/index.ts`                                                                                                                                                                                                                                                                  |
| Shared                                                                    | `supabase/functions/_shared/parkingPricing.ts` (incl. the ₱100 minimum), `parkingGuestFee.ts` (guest fee + no-loss check), `parkingPlatformSettings.ts` (live config resolver), `parkingBlockedDates.ts`, `parkingDirectLink.ts` (Phase 8 token)                                                               |
| Migration                                                                 | `supabase/migrations/20260918140000_parking_pricing.sql`, `20261104120000_parking_blocked_dates_automation.sql`, `20261129120000_parking_platform_settings.sql`, `20261202120000_parking_direct_booking_link.sql`, `20261344000000_parking_guest_fee.sql`, `20261344000100_parking_search_price_host_rate.sql` |
| Calendar UI (shared)                                                      | `ui/src/features/dashboard/pricing/components/PricingCalendarGrid.tsx`                                                                                                                                                                                                                                         |

---

## Testing

| Layer | Path / spec                                                                                                                                            | Manual        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Unit  | `parkingGuestFee_test.ts`, `parkingSettlement_test.ts`, `parkingPayout.test.ts`, `parkingRateRules.test.ts`                                            | —             |
| E2E   | `parkingPricingEdit.spec.ts` (₱100 minimum, clearable field, no maximum); [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                                                                                                      | —             |
