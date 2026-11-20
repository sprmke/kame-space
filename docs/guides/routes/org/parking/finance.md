---
title: 'Parking finance — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-08-17
---

# Parking finance — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug/finance`

> **Status:** Documented

## Overview

Same finance dashboard as property **`FinancePage`**, including the **brand hero** shell on phone/tablet (`AdminMobilePage` — one ··· menu for Add transaction + PDF export; date range in overlapping toolbar). Month/date filter, summary cards, cash-flow chart, ledger toolbar (table / card / calendar), **Add Transaction**, and **Export report**.

**One ledger.** Manual operating lines (`finance_line_items` with `parking_id`) and read-only **marketplace payouts** (`parking-payments`) share the same table / card / calendar. Payout rows use category **Marketplace**, show guest paid + fee in the subtitle, net in Amount, and status labels Disbursed / Awaiting payout / Refund review / Refunded (filterable as Completed / Pending / Canceled). Direct-link bookings are marked in the description. Hosts cannot edit or delete payout rows; disbursements and refunds are recorded by a super admin on `/admin/parking/payouts`.

There is no stays ledger for parking (no `guest_submissions` link). Summary cards and charts still reflect **operating** transactions only (marketplace payouts are list-only so they do not double-count KPI income).

---

## Host-facing knowledge

Parking **Finance** tracks money in and out for this slot: your own income and expense lines, plus marketplace booking payouts in the same list. It works like property finance: add income or expenses, filter by status or category, view table / cards / calendar, export reports, and set Telegram reminders for due dates. There is **no stays ledger** here because parking finance is separate from guest stay bookings.

**Common host questions**

- Q: Where are marketplace payouts?
  A: In the same transactions list as your manual lines. Look for category **Marketplace**, or filter status to Pending for awaiting payout and Completed for disbursed. The subtitle shows what the guest paid and the platform fee; Amount is your net.
- Q: Can I see guest stay payments on this page?
  A: No. Guest stay payments stay under each **property’s** finance module. This page is only for this parking slot.
- Q: How do I get reminded before a bill is due?
  A: Configure **Finance** notifications (Telegram) under this slot’s **Notifications** page, then add due dates when you create or edit expense lines.
- Q: Who can add or delete transactions?
  A: Team members with finance edit access for this parking slot. View-only roles can see summaries but not change lines.
- Q: How do I add an operating expense?
  A: Use **Add Transaction**, choose expense, then set the category, amount, date, and notes. Recurring lines can repeat on a schedule.
- Q: Can I export parking finance for my accountant?
  A: Yes. **Export report** offers an overview, the transactions list, or a full PDF report for the selected range. Stays are left out because parking finance has no guest-stay ledger.

---

## Permissions

Requires parking team **`finance:view`** (read) and **`finance:edit`** (create/update/delete transactions). Enforced server-side in `resolveFinanceAssetAccess` → `verifyParkingTeamAccess`.

---

## Add / edit transaction

- **Add Transaction** opens the shared `FinanceTransactionModals` / `OperatingLineItemForm` (income or expense, category, amount, date, notes, recurrence, Telegram reminder when finance Telegram is configured for this parking slot).
- Configure finance Telegram under **Notifications → Finance** (`/notifications?module=finance`).
- Edit/delete from table, card, or calendar row actions.
- Recurring series: same modal flows as property finance.

---

## Export

**Export report** menu: overview, transactions, and full report (PDF). Stays ledger export is hidden on parking finance.

CSV: `GET /functions/v1/finance-export?parking_id=…&type=…`

---

## API

| Method                | Edge function        | Scope          |
| --------------------- | -------------------- | -------------- |
| GET                   | `finance-summary`    | `?parking_id=` |
| GET/POST/PATCH/DELETE | `finance-line-items` | `?parking_id=` |
| GET                   | `finance-export`     | `?parking_id=` |

Property finance uses `property_id` instead; never send both.

---

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Concern           | Path                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Page              | `ui/src/features/dashboard/parking/pages/ParkingFinancePage.tsx`                                                                |
| Payout→ledger map | `ui/src/features/dashboard/parking/lib/parkingFinanceLedger.ts`                                                                 |
| Loading           | `FinancePageBodySkeleton` (`FinancePageSkeleton.tsx`) — same KPIs, Cash flow area + Breakdown donut, toolbar, responsive ledger |
| Shared UI         | `ui/src/features/dashboard/finance/components/*`                                                                                |
| Hooks             | `useFinanceSummary`, `useFinanceLineItems`, `useParkingPayments`                                                                |
| API client        | `ui/src/features/dashboard/finance/hooks/useFinanceApi.ts`, `assetEdgeFetch`                                                    |
| DB                | `finance_line_items.parking_id` — migration `20260919120000_finance_line_items_parking_id.sql`                                  |
| Server scope      | `supabase/functions/_shared/financeAssetScope.ts`                                                                               |
| Server CRUD       | `supabase/functions/finance-line-items/index.ts`                                                                                |

---

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingFinanceLedger.test.ts`, `parkingStatusMachine_test.ts`               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |
