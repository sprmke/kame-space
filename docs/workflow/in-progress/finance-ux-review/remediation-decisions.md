---
title: 'Finance remediation decisions'
status: implemented
tags: [ux, ui, finance, decisions]
updated: 2026-11-23
---

# Finance remediation decisions

What to change, in what order, and what to leave alone. Source evidence is in
[`README.md`](./README.md) and [`screenshots/`](./screenshots).

**Status: implemented on `review/finance-fixes`, awaiting visual review.** Every item below is in
the branch; the before/after captures are in [`before-after/`](./before-after).

## At a glance

| Bucket   | Items | Effort     | Why                                                                     |
| -------- | ----- | ---------- | ----------------------------------------------------------------------- |
| Fix now  | 4     | ~2.5 days  | The numbers or a documented flow are wrong                              |
| Fix next | 4     | ~1.25 days | Common friction on phone and keyboard, cheap and contained              |
| Defer    | 7     | —          | Real, but not worth this pass; reasons recorded so nothing is forgotten |

## Fix now

| #   | Report     | Change                                                                                  | Effort   | Risk                     | Your call |
| --- | ---------- | --------------------------------------------------------------------------------------- | -------- | ------------------------ | --------- |
| A   | P1-1, P2-7 | Split collected vs pipeline; stop showing pending stays as received cash; fix the hints | ~1 day   | Needs a product decision | ☐         |
| B   | P1-2       | Keep the reporting query separate from the ledger query                                 | ~0.5 day | Low                      | ☐         |
| C   | P1-3       | Load the series window with asset scope; stop treating an unresolved end as dirty       | ~0.5 day | Low                      | ☐         |
| D   | P1-4       | Stop the 1280 truncation and the wrapped card title                                     | ~0.5 day | Low                      | ☐         |

Screens: [A](./screenshots/01-desktop-1440-default.png),
[B](./screenshots/39-empty-search-state.png),
[C](./screenshots/32-recurring-edit-scope.png),
[D](./screenshots/53-1280-kpi-truncation.png).

### A. Money truth

The API returns zero completed stays, ₱42,500 pipeline and `grandNet` ₱7,390. The page shows Net
Profit ₱49,890 and a Pending Payments hint that says pending amounts are excluded. They are not.

Plan: show **Collected** and **Pipeline (estimated)** as separate values (or keep Net Profit
collected-only and add an estimate chip), tone pending stay rows by status, and rewrite all four card
hints to match the maths. This is the only item that needs a decision before code.

### B. Reporting vs ledger scope

`q`, type, status and category filters are passed into `finance-summary` and the chart query. Typing
in the ledger search therefore changes the period totals. Plan: two query objects, one for the
reporting period and one for the ledger. If filters should drive everything, relabel the field and
badge the cards as filtered instead.

### C. Recurring edit scope

`fetchRecurringSeriesItems(id)` is called without scope, the edge function returns 400, and the UI
treats the series end as changed. Result: "This occurrence only" disappears and Save rewrites the
schedule. Plan: pass the scope, treat an unresolved series end as unknown rather than dirty, and add
a regression test for the three-scope path.

### D. 1280 layout

At 1280 the values render as `₱49,890....` and "Pending Payments" wraps. Plan: drop decimals in the
card value at `lg`, keep titles on one line, equalise card heights.

## Fix next

| #   | Report      | Change                                                            | Effort    | Your call |
| --- | ----------- | ----------------------------------------------------------------- | --------- | --------- |
| E   | P2-1, P3-12 | Move the row-open action off the whole row; keep table semantics  | ~0.5 day  | ☐         |
| F   | P2-2        | Stack Category and Date on phone                                  | ~0.25 day | ☐         |
| G   | P2-3, P2-4  | Bottom clearance for the quick-access button; one clear on search | ~0.25 day | ☐         |
| H   | P2-5, P2-6  | Visible reminder default; warn when Telegram is not connected     | ~0.25 day | ☐         |

### Copy and micro-polish (folded into E-H)

| Now                                     | Change to                           |
| --------------------------------------- | ----------------------------------- |
| "Add Transaction"                       | "Add transaction"                   |
| "Booking 5eed1000…"                     | Drop the raw id line                |
| "Choose stays view"                     | "Choose ledger view"                |
| "Amount ↓ / ↑"                          | "Highest / lowest amount"           |
| "25 transactions deleted"               | "Recurring series deleted"          |
| "Apply from this date…" (delete dialog) | "Delete this and later occurrences" |
| Empty states per view                   | One shared string                   |

Also in the same pass: round chart axis intervals, right-align the Amount header, one date format on
the screen, amount field starts empty with a placeholder.

## Defer or skip for now

| Item                                | Reason                                   |
| ----------------------------------- | ---------------------------------------- |
| Calendar pills and count badges     | Least-used view; revisit with usage data |
| Amount default and date format      | Cross-app convention, not finance-only   |
| Chart accessibility (no data table) | Dashboard-wide chart work                |
| Duplicate breakpoint DOM            | Architectural, no visible defect         |
| Dark chart fill and gridlines       | Cosmetic, fold into a theme pass         |
| Sidebar promo and alert dot         | Outside finance                          |
| Mobile category truncation          | Mostly solved by the wizard fix          |

## Decisions taken

1. **Net Profit** now counts cash collected only, with a separate pipeline estimate under it.
2. **Filters and search** scope the ledger only; the summary cards and charts stay period-wide.

## What shipped

| Item | Behaviour now                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A    | Income and Net Profit count collected money; the pipeline estimate sits under Net Profit; pending rows are amber; the four hints match the maths.                        |
| B    | A separate reporting query feeds the cards and charts; search, filters, sort and view only touch the ledger.                                                             |
| C    | The series window loads with asset scope; all three edit scopes are offered and an unknown series end no longer marks the schedule dirty.                                |
| D    | Values fit at 1280 and all four card titles stay on one line.                                                                                                            |
| E    | Table rows keep table semantics; `Enter` on a row action runs that action. Cards only open when the card itself has focus.                                               |
| F    | Category and Date stack on phone, and the amount field opens empty with a placeholder.                                                                                   |
| G    | The phone page reserves space for the quick-access button, and search has one clear control.                                                                             |
| H    | Reminders open on "Daily at 12:00 PM" and warn when Finance Telegram is not connected.                                                                                   |
| Copy | Sentence case for "Add transaction", ledger view label, sort labels, delete-dialog verbs, toast copy, shared empty state, round axis ticks, right-aligned amount header. |

Tests: `financeModule.spec.ts` now has 17 cases, including regression coverage for the summary
scope, recurring scopes, the Delete/Enter path, one clear control and the Telegram warning.
