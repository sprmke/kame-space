---
title: 'Parking Pricing — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-09-03
---

# Parking Pricing — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug/pricing`

> **Status:** Documented — weekday/weekend base rates + calendar overrides (no fees); payout preview + guest-rate cap enforcement, live super-admin config since Phase 4; direct booking link since Phase 8; explicit guest-rate vs host-payout breakdown since 2026-11-09.

## Progress overview

| Section                       | E2E save | Validation | Docs | Notes                                                                                  |
| ----------------------------- | -------- | ---------- | ---- | -------------------------------------------------------------------------------------- |
| Base rates                    | ✅       | ✅         | Done | `parking_settings.weekday_nightly_rate` / weekend                                      |
| Calendar custom dates         | ✅       | ✅         | Done | `parking_pricing_date_overrides`                                                       |
| Date blocks                   | ✅       | ✅         | Done | `parking_blocked_dates`; broadcast + calendar UI                                       |
| Fees                          | —        | —          | N/A  | Not applicable for parking                                                             |
| Booked nights                 | ✅       | —          | Done | `bookedDateKeys` from claimed parking bookings                                         |
| Team access                   | —        | —          | Done | Parking team `pricing:view` / `pricing:edit`                                           |
| Payout preview (Phase 3/4)    | —        | —          | Done | Guest rate + platform fee + net payout under each rate field — display only, live commission % |
| Guest-rate cap (Phase 3/4)    | ✅       | ✅         | Done | Rejected client- and server-side, not silently clamped; cap is live super-admin config |
| Direct booking link (Phase 8) | —        | —          | Done | Copyable link at a reduced fee, with a per-night comparison using the current rate |

---

## Overview

Parking **Pricing** mirrors the property pricing calendar but only stores **weekday** and **Fri–Sun weekend** nightly rates. There are **no fee defaults** (no down payment, security deposit, pet fee, etc.).

**Two prices, never one.** The host edits the **host rate** (what their payout is calculated from). Guests are charged the platform **guest rate**, set by a super admin at `/admin/parking/payouts`. The page shows both, plus the platform fee and the host's net per night, so the split is visible before saving. A host rate above the guest rate is a guaranteed-loss match, so it is rejected rather than clamped.

**Permissions:** parking team `pricing:view` to open the page; `pricing:edit` to edit rates and calendar overrides. A parking member with `pricing:edit` can edit without holding an org-level parking permission.

**Defaults (seed):** weekday ₱300, weekend ₱350 (local seed) / ₱400 (migration default). Platform guest rate defaults to ₱400 weekday and ₱400 weekend.

**Guest rate cap (Phase 3/4):** a host rate can't be saved above the platform's guest rate,
which a super-admin now sets live (`/admin/parking/payouts` — see
`docs/guides/routes/admin/parking-payouts.md`), separately for weekday and weekend. A host
priced at or above the guest rate is a guaranteed-loss match, so it's rejected outright, client-
and server-side, never silently clamped down to the cap.

---

## Host-facing knowledge

Parking **Pricing** sets how much guests pay per night for this slot. Guests pay the platform guest rate. You set a weekday rate and a higher Fri–Sun weekend rate, then optionally override specific future dates on the calendar. Your rate is what your payout is calculated from, after the platform fee. There are no stay-style fees like deposits or pet fees, just nightly parking rates. Changes can apply to all future dates or only the month you’re viewing.

**Common host questions**

- Q: How do weekend rates work?
  A: Friday through Sunday nights use the weekend nightly rate automatically. Monday–Thursday use the weekday rate unless you set a custom price on the calendar for those dates.
- Q: Can I charge a special rate for holidays?
  A: Yes. Click or drag those dates on the calendar and set a custom nightly amount. Custom dates show with a pen icon in the legend.
- Q: Will booked or blocked nights block the calendar?
  A: **Booked** nights (claimed reservations) and **Blocked** nights (owner-managed closures) show on the calendar and are excluded from broadcast candidate matching. Block future dates via the pricing modal **Block** action; unblock the same way.
- Q: What do "Guests pay", "Platform fee" and "You receive" mean?
  A: Guests pay the platform guest rate, a fixed nightly price set by Kame Space. The platform fee is our cut of your rate. "You receive" is your payout per night after that fee. The fee is a fixed percentage and is not negotiable per listing.
- Q: How is the platform fee calculated?
  A: It is a percentage of your nightly rate, not of the guest price. For example, at 10% on a ₱300 rate, the fee is ₱30 and you receive ₱270 per night. The guest still pays the platform guest rate.
- Q: Why can't I save a rate above a certain amount?
  A: That's the platform's current guest rate. A host rate above it would mean the platform pays out more than the guest is charged, so it's blocked from saving rather than silently reduced. The exact cap can change if the platform adjusts its guest rate.
- Q: What's the direct booking link for?
  A: A link you can share yourself (text, chat, wherever) that takes a guest straight to your listing's booking form instead of the general marketplace search. Bookings through it use a lower platform fee since you sourced the guest yourself. The card shows the exact per-night difference using your current rate.
- Q: When do I get paid?
  A: Payouts are handled manually by the Kame Space team after the guest's payment is confirmed. They are not sent automatically through the app yet.

---

## Sections

### Summary cards

Three KPI chips: weekday base rate, weekend premium %, count of custom calendar dates.

Above them, a static note states the live platform guest rate for weekday and weekend, that the host's rate sets their payout, and that listings priced above the guest rate are not matched. A **How payouts work** hint sits next to the page title (3 steps + tip).

### Calendar

- Month grid titled **Rates & availability** (_Manage pricing and availability_ on desktop); legend under the grid on **`lg+` only** (hidden on phone/tablet).
- Legend: **Available**, **Custom** (pen icon), **Booked**, **Blocked**, **Selected**.
- Click or drag future available dates → **Set nightly rate** modal (**Reset** / **Apply**; close via X). When every selected night is blocked, modal offers **Unblock** only.
- **Mobile (`max-lg`):** no pointer drag — the grid uses a **two-tap** range model (tap start → thick primary border on the cell, no tip banner → tap end commits; tap a booked/locked cell clears the armed start). Selected/armed/today use border-only highlight below `sm` (no outer ring). Shorter day cells below `sm`; title **Pricing**, month **MMM yyyy**, denser stay pills (~20px). Shared `PricingCalendarGrid`, so this matches property Pricing exactly.
- **Block** / **Unblock** in the modal persist via **`parking-pricing`** PATCH (`blockRange` / `unblockDateKeys`).

### Base rates (right column)

| Field               | DB column              | Default | Cap (default seed)       |
| ------------------- | ---------------------- | ------- | ------------------------ |
| Weekday (per night) | `weekday_nightly_rate` | ₱300    | Live — ₱400 default seed |
| Fri–Sun (per night) | `weekend_nightly_rate` | ₱400    | Live — ₱400 default seed |

Cap and commission % are read live from the `parking-pricing` GET response
(`guestRateCapWeekday`/`guestRateCapWeekend`/`guestRateWeekday`/`guestRateWeekend`/`commissionPct`,
sourced from the super-admin `/admin/parking/payouts` config) — not hardcoded. Each field shows a
three-line breakdown underneath using those live values:

```
Guests pay          ₱400 / night
Platform fee (10%)  -₱30
You receive         ₱270 / night
```

A rate above the cap shows an inline warning and disables **Save** until lowered. The card header
also carries a **Base rates** hint.

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

| Method | Edge function     | Query          | Body (PATCH)                                                                                 |
| ------ | ----------------- | -------------- | -------------------------------------------------------------------------------------------- |
| GET    | `parking-pricing` | `?parking_id=` | — (also returns `directCommissionPct`/`directBookingToken`/`directBookingSlug`, Phase 8)     |
| PATCH  | `parking-pricing` | `?parking_id=` | `weekdayNightlyRate`, `weekendNightlyRate`, `dateOverrides`, `blockRange`, `unblockDateKeys` |

Auth: signed-in user + parking team permission. `verify_jwt = false`; handler uses `resolveScopedParkingTeamAccess` (`pricing:view` / `pricing:edit`).

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Layer                                                               | Path                                                                                                                                                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                                                                | `ui/src/features/dashboard/parking/pages/ParkingPricingPage.tsx`                                                                                                                                                  |
| Loading skeleton (`PricingPageBodySkeleton`)                        | `ui/src/components/skeletons/PricingSkeleton.tsx` — 3 stat cards, the live month's week rows (day + price cells, outside days blank), rates card with payout helper lines + direct-link card (stacked on phone)   |
| Rates form card (payout preview, cap warning)                       | `ui/src/features/dashboard/parking/components/ParkingPricingRatesFormCard.tsx`                                                                                                                                    |
| Direct link card (Phase 8)                                          | `ui/src/features/dashboard/parking/components/ParkingDirectLinkCard.tsx`                                                                                                                                          |
| Hooks                                                               | `ui/src/features/dashboard/parking/hooks/useParkingPricing.ts`                                                                                                                                                    |
| API client                                                          | `ui/src/features/dashboard/parking/lib/parkingPricingApi.ts`                                                                                                                                                      |
| Client-side fallback-only cap / commission defaults (pre-load only) | `ui/src/features/dashboard/parking/lib/parkingPricingDefaults.ts`                                                                                                                                                 |
| Edge                                                                | `supabase/functions/parking-pricing/index.ts`                                                                                                                                                                     |
| Shared                                                              | `supabase/functions/_shared/parkingPricing.ts` (incl. server-side cap enforcement), `parkingPlatformSettings.ts` (live config resolver), `parkingBlockedDates.ts`, `parkingDirectLink.ts` (Phase 8 token)         |
| Migration                                                           | `supabase/migrations/20260918140000_parking_pricing.sql`, `20261104120000_parking_blocked_dates_automation.sql`, `20261129120000_parking_platform_settings.sql`, `20261202120000_parking_direct_booking_link.sql` |
| Calendar UI (shared)                                                | `ui/src/features/dashboard/pricing/components/PricingCalendarGrid.tsx`                                                                                                                                            |

---

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`                                               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |
