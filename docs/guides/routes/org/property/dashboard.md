---
title: 'Property Dashboard — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-11-23
---

# Property Dashboard — operator guide

Route: `/org/:orgSlug/property/:propertySlug`

> **Status:** Documented

## Progress overview

| Section               | E2E save | Validation | Docs       | Notes                                                   |
| --------------------- | -------- | ---------- | ---------- | ------------------------------------------------------- |
| Date range filter     | —        | —          | Documented | Week / Month / Year / Custom, `?from`/`?to`             |
| Stat cards            | —        | —          | Documented | Same `StatCard` / `DashboardTrendStatCard` chrome       |
| Board (ops-first)     | —        | —          | Documented | Attention/calendar, Messages/Rates, cash flow, tx/maint |
| Loading skeleton      | —        | —          | Documented | Mirrors KPI + board                                     |
| Needs attention card  | —        | —          | Documented | Blockers; swaps to Recent bookings when clear           |
| Messages / Rates      | —        | —          | Documented | Inbox unread + next-7-nights rates                      |
| Maintenance reminders | —        | —          | Documented | Board cell; pending/done + next reminders               |
| View Property         | —        | —          | Documented | Opens the public listing in a new tab                   |
| Mobile shell          | —        | —          | Documented | Sticky collapsing brand hero + overlap (`max-lg`)       |

---

## Overview

Single-property home page: date-range filter, **View Property**, period KPI cards, then an **ops-first board** — scoped to one property (period widgets use `?from`/`?to`).

Layout order:

1. **KPI row** — revenue, nights booked, occupancy, ADR (same `StatCard` / `DashboardTrendStatCard` chrome)
2. **Ops-first board** (`lg:grid-cols-2`):
   - Needs attention (or Recent bookings when clear) | Calendar
   - Messages (when `inbox:view`) | Rates open nights (when `pricing:view`)
   - Cash flow (full width when `finance:view`; Breakdown lives on Finance only)
   - Transactions | Maintenance

### Mobile layout (`max-lg`)

- **Brand hero** — teal band with tenant/property switcher (light-on-primary) and page title. Subtitle is `lg+` only. On scroll the hero **sticks**; title compresses/fades and the arc flattens while switcher + **View Property** stay visible (`useMobileHeroCollapseProgress`). In-app alerts are **not** in the hero — use the Quick Access FAB (bottom-right).
- **Bottom tabs** — Dashboard, Bookings, Inbox, More. Quick Access is a floating FAB above the tab bar (and bottom-right on desktop): click expands it into a vertical pill for **Theme** (single icon toggle), Notifications, AI assistant when enabled, Messages, and Help & Support. Finance and other pages live under More. The desktop sidebar no longer hosts the Light/Dark segmented control; the same segmented toggle lives in the Profile modal (Theme above App). More sheet and the expanded desktop sidebar share the same labelled module groups (**Operations**, **Guests**, **Growth** with Analytics + Marketing + Public Pages, **Manage**). More sheet nav labels use the dense admin scale (`text-[13px]`, `size-4` icons) so they match list/toolbar chrome rather than oversized body type. The sheet footer also holds the **Advanced / AI** mode switch (pages with their own phone header hide the top bar switch).
- **Overlap toolbar** — first floating white card pulled up over the hero lower edge: date range. **View Property** is the hero trailing action (icon-only).
- **Canvas** — denser KPI cards, then board cards with **Needs attention before Calendar** (`max-lg:order-*`). Chart/calendar headers use a compact icon + centered title (`AdminSurfaceCardHeader`; descriptions `lg+` only). Section/card gaps stay comfortable (`gap-2.5`–`3.5`, `p-3`+), not cramped.
- **Desktop (`lg+`)** — standard `AdminPageHeader` with inline date filter and **View Property**; board is `lg:grid-cols-2` with cash flow spanning both columns.

**Deep links:** KPI “Nights booked”, Needs attention / Recent bookings “View”, Rates cells, Finance chart “View”, Maintenance “View”, and Transactions “View” / “Add” must target **`propertySectionPath`** (`/org/:orgSlug/property/:propertySlug/…`), never bare `/bookings`, `/finance`, `/maintenance`, or `/analytics`.

---

## Date range

Uses **`BookingDateRangeFilter`** in the page header, backed by `useDateNavigation` + `useSyncDateRangeWithQuery`:

| Preset | Behavior                                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Week   | Sun–Sat, navigable with arrows                                                                                                                        |
| Month  | Current calendar month (default when the URL has no range)                                                                                            |
| Year   | Current calendar year                                                                                                                                 |
| Custom | Calendar popover — primary range selection, centered month grid; Apply in the footer (no overlapping date readout); **Back to presets** in the header |

URL params: **`?from=YYYY-MM-DD&to=YYYY-MM-DD`** — written back on any range change (`replace: true`, no history spam). If the URL has neither param on load, the page seeds the default period (`defaultDashboardPeriod()`, current month) into the URL.

---

## View Property

Header / hero action — opens the public listing (`/properties/:propertySlug`) in a new tab. On **`max-lg`**, an icon-only control beside the tenant switcher; on **`lg+`**, a labelled **View Property** button.

Calendar, form, messages, and stay guide live on **[[public-pages|Public Pages]]**, not in this header.

**Date range:** presets (“View by”) and custom calendar also use a bottom sheet on `max-lg`; desktop keeps anchored popovers.

---

## Needs attention

`DashboardAttentionCard` is a peer **surface card** on the ops rail (not a top strip). Sources (unchanged):

1. **Server attention items** — `dashboard-stats` `attention[]` (pending review, awaiting documents, check-ins/outs today, SD refunds, unpaid guest balance, low occupancy next 30 days; same rules as the org dashboard). **Low occupancy** opens property **Analytics** with the dashboard’s `from` / `to` (`resolvePropertyDashboardHref` maps `/analytics?…`). Other rows map the same way onto bookings, finance, and so on.
2. **Rejected external review** (client-only) — shown when `app_settings.external_reviews` includes any row with `moderationStatus = rejected` (`usePropertyRejectedExternalReviewsAttentionItem`); label **Review rejected** (or **Reviews rejected** + count); links to **Settings** → Socials → External reviews. Clears when the host deletes the review or edits and resubmits (back to pending).

Unified **divided list** (up to 5 rows): severity dot (rose / amber / sky), label, optional count on the right; setup-style rows without a count show a chevron. Header subtitle **Bookings & reviews** (matches Calendar / Maintenance / Transactions card headers). **View** links to period-scoped bookings; when any item is critical, an **urgent** summary chip appears under the header. **View all (+N more)** when more than five items.

When the list is **empty** (no server alerts and no rejected-review chips), the same board cell switches to **Recent bookings** — period check-ins from `dashboard-stats.recentBookings` (guest, stay dates, amount, status), linking into booking detail. Empty period: dashed **No bookings**. This keeps the Calendar | ops peer heights from looking hollow next to a tall calendar.

Parking dashboard still uses the legacy `DashboardAttentionStrip` chip row.

---

## Maintenance reminders

`DashboardMaintenanceRemindersCard` (right ops card on `lg+`; stacks under attention on mobile) loads period-scoped data:

| Piece          | Source                                                              |
| -------------- | ------------------------------------------------------------------- |
| Pending / done | `GET maintenance-summary` via `useMaintenanceSummary`               |
| Next reminders | Pending items from `GET maintenance-items` (up to 5, soonest first) |
| View           | Links to `/maintenance?from=&to=` (same dashboard period)           |

Empty state when there are no pending reminders in the period. Card still shows **0 pending / N done** when everything is completed.

---

## Rates (open nights)

`DashboardRatesPulseCard` (when `pricing:view`) lists the next open Asia/Manila nights from `property-pricing` (skips booked/blocked over a 60-day horizon, up to 6 nights), grouped as **This week** / **Next week** / **Later**. Tap a date or rate to open **Set nightly rate** (`PricingDateModal`) and save overrides via `property-pricing` without leaving the dashboard. Multi-select with the checkboxes, then **Set rate**. **Default** and optional **Smart** chips fill the input only (never auto-apply). Header **Pricing** still opens the full calendar. Sync conflict chip (if any) sits above the list. Edit requires `pricing.rates:edit`.

## Stat cards

`DashboardStatCards`, four cards for the selected period (`kpis` from `dashboard-stats`) using the shared `StatCard` / `DashboardTrendStatCard` styling:

| Card                     | Source                | Notes                                                                                                |
| ------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------- |
| **Total Revenue**        | `kpis.netProfit`      | Operating host net for check-ins in range; colored red when negative                                 |
| **Nights booked**        | `kpis.nightsBooked`   | Shown as **nights booked / period days** (e.g. `18 / 30`), links to `/bookings` scoped to the period |
| **Occupancy Rate**       | `kpis.occupancyRate`  | Percent, with point-change vs the previous equal-length period                                       |
| **Average Nightly Rate** | `kpis.avgNightlyRate` | PHP average rate across occupied nights in range                                                     |

All four show a trend indicator vs. the previous equal-length period, powered by `DashboardTrendStatCard`. KPI icon wells are muted. Colored icon wells remain on the Finance and Bookings pages only.

---

## Marketing today

`PlannerTodayCard` sits under the stat cards. It shows up to three Marketing Planner items for
today with their time and status, plus **Open plan** into
`/org/:orgSlug/property/:propertySlug/marketing?plan=1&range=today`.

- Renders nothing when the property has no `marketingPlanner` plan feature or no items today, so it
  never becomes dashboard clutter.
- A failed plan load also renders nothing; the dashboard never shows a planner error.
- Source: `marketing-planner?range=today`, the same query the Plan modal uses.

---

## Board section (ops + signals + money)

`DashboardFinanceCalendarSection` renders once a period is resolved as an equal **`lg:grid-cols-2`** board (`items-stretch`). Growth attention (`low-occupancy`, calendar sync) is split onto Pricing via `splitDashboardAttentionItems`.

| Cell            | Component                                                                               |
| --------------- | --------------------------------------------------------------------------------------- |
| Needs attention | `DashboardAttentionCard` (ops rows only; Recent bookings when clear)                    |
| Calendar        | `BookingCalendarView` (`variant="mini"`) + Name/Price toggle (single-month only)        |
| Messages        | `DashboardMessagesPulseCard` when `inbox:view`                                          |
| Pricing         | `DashboardPricingPulseCard` (sync conflicts + growth attention)                         |
| Cash flow       | `FinanceTransactionsChart` (`embedded`, `showBreakdown={false}`; **View** → `/finance`) |
| Maintenance     | `DashboardMaintenanceRemindersCard` (**View** → `/maintenance`)                         |
| Transactions    | `DashboardTransactionsDueCard` (**View** → `/finance`)                                  |

Empty states use a dashed panel (icon + title + short description). Maintenance empty state includes **Add Reminder** → `/maintenance`; Transactions empty state includes **Add Transaction** → `/finance` (same period query) — both use `outline-primary`.

List cards (Needs attention, Maintenance, Transactions) show at most **5** rows. When more exist, a bottom **View all (+N more)** link opens the matching module with the same period (`/bookings`, `/maintenance`, `/finance`). Header **View** links remain for one-tap navigation when the list is short. Transaction rows are two lines: label + amount, then category / due / status on one meta row.

Mini calendar: **fixed short day cells** (not square — keeps the card from towering over an empty Needs attention list) with the same occupancy overlay as bookings month view — status-colored stay bars sit inside the week (inset from the cell edges with a small bottom gap and lane spacing), spanning multi-night stays as one continuous band with status-tone borders. Bars pick the richest guest label that fits without ellipsis: **full name → first name → two-letter initials → single letter**. Price mode scales by viewport (`max-lg`), not by mini layout: **₱7,000 → ₱7k → 7k → hide** on the tightest phone cells. Dashboard mini on desktop keeps **₱7k** (with status dot) on short spans. Tap a day below `lg` to open a **day sheet** listing every stay that night with full status badges, then open a booking. **`lg+`** also uses the day rail for the same list. Days that exceed visible lanes show a **+N** chip; hover highlights every segment of that stay and shows a pricing-style tip. **Year** and custom ranges spanning more than one calendar month switch to the yearly dot grid (no stay pills); the Name/Price header toggle is hidden in those views because labels do not render. On single-month week/month/custom ranges, Name/Price toggle: **Price** shows the full stay total (`booking_rate`), not the per-night split. Each week fragment of a multi-week stay repeats the label when labels are shown. Compact mode omits the per-day count badge.

Initial page load uses `DashboardSkeleton` (`AdminSkeletons.tsx`) inside the same page header (title, subtitle, date control) as the loaded dashboard, so the board does not drop when the header appears. The board uses the same gaps as the live layout (`gap-2.5` / `lg:grid-cols-2`), compact calendar day placeholders at the same short fixed height, and header actions that match each card (Name/Price toggle, attention badge, View links, breakdown segment). Per-card refresh skeletons inside Maintenance / Transactions / Attention use the same row heights. Cash-flow / breakdown and Maintenance / Transactions cards are omitted from the skeleton when the member lacks `finance:view` / `maintenance:view`, matching the loaded board.

Cash flow / breakdown / transactions / calendar data still come from `finance-line-items`, `finance-bookings`, and `list-bookings` for the selected period. Tapping a stay bar opens that booking; tapping a day opens the day sheet (all stays that night).

---

## Host-facing knowledge

This is the home page for a single property. It starts with period performance, then the calendar beside what needs attention, cash charts, and maintenance/transactions for the dates you picked.

**Common host questions**

- Q: What is the Maintenance card?
  A: A short list of property reminders due in the selected period, with how many are still pending. Open **View** to manage all reminders.
- Q: What does "Nights booked" mean?
  A: It shows how many nights you had booked out of the days in the selected period (for example, 18 out of 30 nights), not a simple count of bookings.
- Q: What is the Rates card?
  A: Upcoming open nights with the current price (and a Smart hint when available). Tap a night to set the rate here, or open **Pricing** for the full calendar.
- Q: Can guests see this page?
  A: No, this is only visible to you and your team. Use **View Property** for the listing, or **Public Pages** for the calendar, form, messages, and stay guide.
- Q: Does changing the date range affect my actual bookings?
  A: No, changing the date range here only changes which period the numbers, maintenance list, and calendar reflect. It doesn't modify anything.
- Q: What does the calendar Price toggle show?
  A: The full booking amount for that stay (all nights added together), not the nightly rate. On phone the bars stay status-colored without names; tap the day to see who is staying.
- Q: Why don’t I see guest names on the phone calendar?
  A: Narrow cells would only show a few letters. Colored bars show booking status; tap the day for the full list with names and status badges.
- Q: A contract-expired reminder appeared. If I close it, will it come back?
  A: Yes after you refresh the page. Closing it only hides it while you keep using the dashboard.
- Q: Where do I open notifications or the AI assistant?
  A: Tap the Quick Access button at the bottom right. It slides up into a short toolbar for theme, notifications, the AI assistant (when available), messages, and Help & Support.

---

## API

| Action                      | Endpoint                                                              |
| --------------------------- | --------------------------------------------------------------------- |
| Dashboard KPIs + attention  | `GET dashboard-stats?property_id=&from=&to=`                          |
| Maintenance summary         | `GET maintenance-summary?property_id=&from=&to=`                      |
| Maintenance items           | `GET maintenance-items?property_id=&from=&to=`                        |
| Finance line items (period) | `finance-line-items` (via `useFinanceLineItems`)                      |
| Finance bookings (period)   | `finance-bookings` (via `useFinanceBookings`)                         |
| Mini calendar bookings      | `GET list-bookings?property_id=&from=&to=&showCompletedBookings=true` |

---

## Implementation map

| Concern               | Path                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------- |
| Page                  | `ui/src/features/dashboard/property/pages/DashboardPage.tsx`                          |
| View Property button  | `ui/src/features/dashboard/property/components/ViewPropertyButton.tsx`                |
| Guest page paths      | `ui/src/features/dashboard/property/lib/propertyGuestPublicPages.ts`                  |
| Needs attention card  | `ui/src/features/dashboard/property/components/DashboardAttentionCard.tsx`            |
| Messages pulse        | `ui/src/features/dashboard/property/components/DashboardMessagesPulseCard.tsx`        |
| Rates pulse           | `ui/src/features/dashboard/property/components/DashboardRatesPulseCard.tsx`           |
| Maintenance card      | `ui/src/features/dashboard/property/components/DashboardMaintenanceRemindersCard.tsx` |
| Stat cards            | `ui/src/features/dashboard/property/components/DashboardStatCards.tsx`                |
| Trend card primitive  | `ui/src/features/dashboard/property/components/DashboardTrendStatCard.tsx`            |
| Finance + calendar    | `ui/src/features/dashboard/property/components/DashboardFinanceCalendarSection.tsx`   |
| Transactions due card | `ui/src/features/dashboard/property/components/DashboardTransactionsDueCard.tsx`      |
| Stats hook            | `ui/src/features/dashboard/property/hooks/useDashboardStats.ts`                       |
| Period resolution     | `ui/src/features/dashboard/property/lib/dashboardPeriod.ts`                           |
| Rates helpers         | `ui/src/features/dashboard/property/lib/dashboardRatesPulse.ts`                       |
| Stats API             | `dashboard-stats` → `supabase/functions/_shared/dashboardService.ts`                  |
| Finance chart         | `ui/src/features/dashboard/finance/components/FinanceTransactionsChart.tsx`           |
| Mini calendar         | `ui/src/features/dashboard/bookings/components/BookingCalendarView.tsx`               |
| Calendar day sheet    | `ui/src/features/dashboard/bookings/components/calendar/CalendarDaySheet.tsx`         |
| Pill label modes      | `ui/src/features/dashboard/bookings/components/calendar/calendarPillLabel.ts`         |
| Mobile page shell     | `ui/src/components/mobile/MobileBrandHero.tsx` (`AdminMobilePage`)                    |

---

## Permissions

Route gate: property member with access (dashboard is the property home). Board widgets respect owning-module leaves:

| Widget / query                        | Required permission  |
| ------------------------------------- | -------------------- |
| Finance chart + Transactions due card | `finance:view`       |
| Maintenance reminders card            | `maintenance:view`   |
| Messages pulse card                   | `inbox:view`         |
| Rates pulse card                      | `pricing:view`       |
| Rates quick edit (modal save)         | `pricing.rates:edit` |

Without the leaf, the card is omitted and its finance/maintenance/inbox/pricing queries stay disabled. Calendar / attention / KPI strip are not gated by those leaves.

---

## Testing

| Layer | Path / spec                                                                               | Manual |
| ----- | ----------------------------------------------------------------------------------------- | ------ |
| Unit  | `dashboardRatesPulse.test.ts`                                                             | —      |
| E2E   | `dashboardModulesSmoke.spec.ts` (`@ci`): shell smoke + Rates / ops board on property home | —      |

---

## Related docs

- [Route index](../../README.md)
- [Organization dashboard](../dashboard.md)
- [`docs/PROJECT.md`](../../../../PROJECT.md)
