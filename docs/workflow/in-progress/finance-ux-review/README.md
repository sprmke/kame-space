---
title: 'Finance module UX/UI review'
status: active
tags: [ux, ui, finance, review, qa, e2e]
updated: 2026-11-23
---

# Finance module UX/UI review — property scope

Deep review of `/org/:orgSlug/property/:propertySlug/finance` (and the parking-scoped reuse): every
visible element, every state, every flow, at phone (390), tablet (768), laptop (1280), desktop (1440)
and dark mode. Reviewed with the `impeccable` (critique + audit), `mobile-responsive`,
`frontend-design`, `design-md`, `accessibility`, and `human-copy` skills.

**This is a review, not a fix.** No product code changed. The E2E coverage added is described in
[Test coverage added](#test-coverage-added). What to approve, in order, is in
[`remediation-decisions.md`](./remediation-decisions.md).

## Verdict

The module is **functionally complete and visually coherent**: one screen covers reporting,
transactions, recurring series, reminders and PDF export, and the same components hold up across
table, card and calendar views. It also carries **four money-trust and interaction defects** that a
host will hit on a normal working day, plus a set of polish issues in copy, density and mobile
chrome.

Do not treat the KPI numbers as statements of fact until P1-1 and P1-2 are resolved.

## Evidence

| Item          | Value                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| App           | `http://127.0.0.1:5186` (Vite, worktree sticky port) + local Supabase `:54321` |
| Account       | seeded owner (`seed-owner@example.com`) on the canonical local org/property    |
| Seed          | canonical local dataset, November 2026 period                                  |
| Viewports     | 390×844, 768×1024, 1280×720, 1440×960, 1440×1900, dark mode                    |
| Console       | 0 errors on the desktop and phone states captured                              |
| Screenshots   | 42, in [`screenshots/`](./screenshots)                                         |
| Network proof | `finance-summary` requests captured in the browser network log                 |
| API proof     | `finance-summary` JSON read with the admin session token                       |

## What works (verified end to end)

| Area                  | Verified                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Reporting shell       | Period presets, custom range, prev/next, comparison deltas                                                             |
| Summary cards         | Income, expenses, net, pending + metric hints                                                                          |
| Charts                | Cash flow area chart, breakdown donut, All/Income/Expenses filter, tooltips                                            |
| Unified ledger        | Stays and manual transactions in one list                                                                              |
| Views                 | Table (desktop), card (phone default + desktop option), calendar + day details                                         |
| Toolbar               | Status/type/category filters, search, sort, per-page, view menu                                                        |
| Transaction CRUD      | 4-step create, 3-step edit (repeat skipped for one-offs), delete confirm                                               |
| Recurring series      | Series modal, occurrence list, extend earlier/later, per-row edit/delete                                               |
| Reminders             | Days-before, cadence, schedule preview, template                                                                       |
| Export                | Full report / overview / stays / transactions → client-side PDF                                                        |
| Settings redirect     | `?tab=settings` → Notifications › Finance                                                                              |
| Unsaved-changes guard | Save & close / Discard / Keep editing on any dirty close                                                               |
| Dark mode             | Tokens applied on every surface; sampled text contrast ≥ 6:1                                                           |
| Loading               | Skeleton components exist for KPIs, charts, table, cards and calendar (not captured: local responses resolve too fast) |
| Mobile chrome         | Teal hero, floating period card, bottom sheets for actions and refine                                                  |

## Findings

### P1 — fix before the next money feature touches this page

#### P1-1. Net Profit counts uncollected pipeline, and the help copy says it does not

Evidence: [01](./screenshots/01-desktop-1440-default.png), [21](./screenshots/21-stay-finance-modal.png),
API response below.

`finance-summary` for Nov 2026 returns **0 completed stays**, `projectedNetPipeline: 42500`,
`outstandingGuestBalance: 32000`, `operating.net: 7390`, `grandNet: 7390`. The page renders:

| Card             | Shown       | Composition                       |
| ---------------- | ----------- | --------------------------------- |
| Total Income     | ₱51,750     | 9,250 operating + 42,500 pipeline |
| Total Expenses   | ₱1,860      |                                   |
| Net Profit       | **₱49,890** | income − expenses                 |
| Pending Payments | ₱32,000     | outstanding guest balance         |

`FINANCE_HELP_COPY.pendingPayments` says _"These are not counted in Net Profit yet."_ They are: the
same ₱42,500 pipeline sits in Net Profit. Meanwhile the API's own `grandNet` for the identical range
is ₱7,390, so two surfaces of the same product disagree by ₱42,500.

Impact: a host reads ₱49,890 profit on a period where nothing has actually completed. This is the
single most damaging issue in the module.

Fix direction: split the card into **Collected** and **Pipeline (estimated)** with the estimate
visibly labelled, or show Net Profit as collected-only and surface pipeline as its own chip
(`+₱42.5k expected`). Correct the help copy in the same change.

#### P1-2. Ledger filters and search silently rewrite the KPI cards and both charts

Evidence: [38](./screenshots/38-empty-search.png) → [39](./screenshots/39-empty-search-state.png),
network log `finance-summary?...&q=zzzz+no+match`.

Typing `zzzz no match` into **Search transactions** turned Net Profit from ₱49,890 to ₱7,390, Total
Income from ₱51,750 to ₱9,250, Pending Payments from ₱32,000 to ₱0, and emptied both charts. The
page passes the whole ledger query (including `q`, filters, sort, view) into `useFinanceSummary` and
`useFinanceBookings` for the chart.

Two problems compound:

1. A control labelled **Search transactions** changes stay income and period totals.
2. The summary is no longer the period truth once any ledger filter is active.

Fix direction: keep the reporting query (from/to/basis) separate from the ledger query (q, filters,
sort, page, view). If product genuinely wants "filter everything", rename the field and give the
cards a visible "filtered" state.

#### P1-3. Recurring edit loses "This occurrence only" because the series lookup 400s

Evidence: [32](./screenshots/32-recurring-edit-scope.png), network
`GET /finance-line-items?recurrence_series_id=… → 400`, [34](./screenshots/34-delete-confirm.png).

`FinanceTransactionModals` calls `fetchRecurringSeriesItems(editingItem.recurrence_series_id)` with
**no asset scope**, so the edge function rejects the request with 400. The catch sets
`editingSeriesUntil = null`, which makes `isRecurrenceScheduleDirty()` true immediately, which then:

- removes the **This occurrence only** option (only "This and future" / "All occurrences" render),
- shows "A repeat schedule change can't apply to one occurrence only" before the host edits anything,
- sends `recurrence_interval` + `recurrence_until` on save, rewriting the series schedule.

The delete dialog still offers all three scopes, so the two flows contradict each other. The route
guide and the host FAQ both promise per-occurrence edits.

Fix direction: pass the asset scope (the same pattern as `useRecurringSeries`), and do not treat an
unresolved series end as "dirty".

#### P1-4. KPI values truncate and card titles wrap at 1280px

Evidence: [53](./screenshots/53-1280-kpi-truncation.png) — reproduced on the seeded app at 1280×800.

At 1280 the four cards are ~218px wide. `₱11,100.00` and `₱15,500.00` render as `₱11,100....` and
`₱15,500....`, and "Pending Payments" wraps onto two lines, pushing that card's value out of line
with the other three. 1280 is the default Playwright desktop viewport and a very common laptop
width, so this is the common case, not an edge case.

Fix direction: let the value wrap/shrink (or drop the decimals in the card), and keep the title row
on one line with `truncate` or a smaller token at `lg`.

### P2 — confusing or costly, should be scheduled

| #     | Finding                                                                                                                                                                                          | Evidence                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| P2-1  | `Enter` on a row's **Delete** button opens the **Edit** modal. Rows are `tr role="button"` with a row-level `onKeyDown`; the key event from the nested button bubbles to the row.                | [51](./screenshots/51-keyboard-enter-on-delete.png)                                                                                   |
| P2-2  | On phone, the wizard keeps Category and Date side by side, so the category trigger reads "Select or ty".                                                                                         | [46](./screenshots/46-mobile-wizard-step1.png)                                                                                        |
| P2-3  | The floating quick-access button (unread badge) covers the last ledger card's ⋯ action on phone, and the breakdown card on tablet.                                                               | [41](./screenshots/41-mobile-390-mid.png), [42](./screenshots/42-mobile-390-bottom.png), [48](./screenshots/48-tablet-768-ledger.png) |
| P2-4  | The ledger search shows two clear buttons (native `type="search"` clear plus the custom X).                                                                                                      | [38](./screenshots/38-empty-search.png)                                                                                               |
| P2-5  | Reminders step: the default cadence ("Daily at 12:00 PM") is the fifth option, below the sticky footer on open, so no selected option is visible. A focused radio also reads like a checked one. | [14](./screenshots/14-wizard-step3-reminders.png), [15](./screenshots/15-wizard-step3-reminders-expanded.png)                         |
| P2-6  | Enabling reminders never checks whether the property has a Telegram group. Source (`OperatingLineItemForm`) copy is unconditional: "Posts to your Finance Telegram group."                       | [14](./screenshots/14-wizard-step3-reminders.png)                                                                                     |
| P2-7  | Pending stays render as green `+₱3,500.00` income; a cancelled stay renders `+₱0.00` in green. Status and direction contradict each other.                                                       | [01](./screenshots/01-desktop-1440-default.png), [40](./screenshots/40-mobile-390-top.png)                                            |
| P2-8  | Every stay row repeats a truncated raw id as its second line: "Booking 5eed1000…". It carries no meaning for a host and wastes a full line per row.                                              | [01](./screenshots/01-desktop-1440-default.png)                                                                                       |
| P2-9  | Chart axes: Y ticks are ₱0 / 3k / 5k / 8k / 10k (non-uniform), X ticks are Nov 1 / 4 / 7 / 10 / 13 / 16 / 19 / 23 / 30 (uneven spacing). A finance chart should use round intervals.             | [01](./screenshots/01-desktop-1440-default.png)                                                                                       |
| P2-10 | Export chooser gives four bare labels with no scope, size or period hint.                                                                                                                        | [20](./screenshots/20-export-menu.png)                                                                                                |
| P2-11 | Toasts leak internal counts: "25 recurring transactions created", "25 transactions deleted".                                                                                                     | [30](./screenshots/30-after-create-toast.png)                                                                                         |
| P2-12 | Calendar day pills carry no income/expense sign, only colour, and there is no legend. A day-level total is absent.                                                                               | [07b](./screenshots/07b-desktop-calendar-full.png)                                                                                    |

### P3 — polish and consistency

| #     | Finding                                                                                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3-1  | Amount field opens with `0` and an unreachable `0.00` placeholder. The label says "AMOUNT (₱)" but the field has no currency prefix.                                              |
| P3-2  | Dates are `11/23/2026` in the form, preview and series builder while the rest of the dashboard uses "Nov 23, 2026".                                                               |
| P3-3  | Button/modals mix cases: "Add Transaction" (page) vs "New transaction" (title) vs "Add transaction" (submit).                                                                     |
| P3-4  | Sort labels mix styles: "Newest first" / "Oldest first" next to "Amount ↓" / "Amount ↑".                                                                                          |
| P3-5  | View toggle is announced as **"Choose stays view"** in a ledger that also contains transactions (three call sites).                                                               |
| P3-6  | Delete dialog uses edit language: "Apply from this date forward…", "Apply to every past and future entry…".                                                                       |
| P3-7  | Recurring series marks the opened occurrence with an uppercase "OPENED FROM LIST" badge.                                                                                          |
| P3-8  | Empty-state copy differs per view: table "No transactions found" (with a `∅` glyph) vs card "No transactions in this period".                                                     |
| P3-9  | Table header `AMOUNT` is left-aligned above right-aligned figures.                                                                                                                |
| P3-10 | Calendar shows a count badge on every day that has entries, duplicating the pills already visible in the cell.                                                                    |
| P3-11 | Calendar day-detail panel is empty on desktop and takes ~330px permanently ("Select a day").                                                                                      |
| P3-12 | Table rows are `<tr role="button">`, so screen readers lose table semantics and `getByRole('row')` does not resolve.                                                              |
| P3-13 | Charts are mouse/tooltip only; there is no keyboard path or data table for the same numbers.                                                                                      |
| P3-14 | Mobile period bar spans the full width at 768 with the chevrons at the far edges, far from the label.                                                                             |
| P3-15 | Phone cards truncate the category ("Association D…") and the recurrence tag ("MONT…").                                                                                            |
| P3-16 | Sidebar "Settings" alert dot and the "Finish setup" promo compete with Finance content for attention on every visit.                                                              |
| P3-17 | Breakpoint variants stay mounted: two toolbars, two search inputs, and both phone and `sm+` card bodies exist in the DOM. It works, but doubles locator ambiguity and DOM weight. |
| P3-18 | Dark mode: the cash-flow area fill disappears against the card, and gridlines are barely visible.                                                                                 |
| P3-19 | En dash used as a range separator in `financePeriodRangeLabel` and the reminder preview, while other surfaces use "→" or "to".                                                    |
| P3-20 | Placeholder ellipsis style mixes "…" and "..." on the same screen.                                                                                                                |

## Not covered in this pass

- **Plan gating of Export report** (`financeReporting`, Starter+). The local org is Business, so the
  upgrade path was not exercised. The menu renders a `TierBadge` corner mark; the gated branch is
  covered only by the existing plan-gate suite.
- **Parking-scoped finance** (`/org/:orgSlug/parking/:parkingSlug/finance`). Same page and
  components; the stays ledger and stays export are hidden. Worth a second pass if parking is next.
- **Read-only / operations roles on the new flows.** The existing `financeLedger.spec.ts` already
  asserts the redirect for members without `finance:view`; the new suite runs as full access only.
- **Telegram delivery and the test-send action.** Needs a connected bot and chat id.
- **PDF pixel layout.** Only the existing download assertion was re-run, not the rendered pages.
- **Lighthouse / bundle cost** of the finance route. Out of scope for a UX pass.

## Cross-viewport matrix

| Element            | 390                            | 768                            | 1280                      | 1440                |
| ------------------ | ------------------------------ | ------------------------------ | ------------------------- | ------------------- |
| Shell              | Hero + floating period + tabs  | Same                           | Sidebar + compact header  | Same                |
| Summary cards      | 2×2, delta under value         | 2×2 (room for 4)               | 4×1, **value truncates**  | 4×1                 |
| Charts             | Full width, stacked            | Full width, tall               | 3/2 split                 | 3/2 split           |
| Period control     | Full-width floating card       | Full width, chevrons far apart | Compact                   | Compact             |
| Ledger             | Cards, actions behind ⋯        | Cards, 2-up                    | Table                     | Table               |
| Filters            | Search + refine sheet + view   | Same                           | Status + Filters + search | Same                |
| Transaction wizard | Bottom sheet, **2-col fields** | Bottom sheet                   | Centered dialog           | Centered dialog     |
| Floating FAB       | Covers last card's ⋯           | Covers the breakdown card      | Bottom right, clear       | Bottom right, clear |

## Copy inventory (suggested replacements)

| Current                                                    | Suggested                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| Add Transaction                                            | Add transaction (sentence case, matches the dialog)             |
| "Booking 5eed1000…"                                        | Drop it, or show `BK-5EED10` if an id is genuinely needed       |
| "Choose stays view"                                        | "Choose ledger view"                                            |
| "Amount ↓" / "Amount ↑"                                    | "Highest amount" / "Lowest amount"                              |
| "25 recurring transactions created"                        | "Recurring expense added · Monthly through Nov 2028"            |
| "25 transactions deleted"                                  | "Recurring series deleted"                                      |
| "Apply from this date forward in the series." (delete)     | "Delete this and every later occurrence."                       |
| "OPENED FROM LIST"                                         | "Opened" (or a meaningful highlight, no badge)                  |
| "These are not counted in Net Profit yet."                 | Only true after P1-1; otherwise describe the actual composition |
| "No transactions found" / "No transactions in this period" | One string for both empty states                                |

## Accessibility notes

- **Nested interactive rows (P2-1, P3-12).** A `tr role="button"` containing buttons is invalid around
  the money actions. Keyboard Enter on Delete opens Edit instead. Prefer a normal row plus a primary
  "open" cell action, or keep the row focusable but stop key events inside the action cell.
- **Focus vs checked (P2-5).** The radio focus ring and the checked ring are both teal; at a glance
  they are the same state.
- **Contrast (passes).** Sampled dark-mode text: delta pill 6.29:1, meta text 6.11:1, table header
  6.11:1, primary text 15.55:1. Light mode is higher.
- **Touch targets.** Ledger/table icon actions and the ⋯ trigger keep a 44px hit area. Calendar day
  cells measure ~110×90 on desktop; the phone calendar was not measured.
- **Charts.** No non-visual equivalent. Add an accessible summary (totals per axis group) or a
  visually hidden table.
- **Duplicate DOM (P3-17).** Hidden breakpoint copies are out of the accessibility tree, so this is a
  maintenance and testing cost more than a screen-reader problem.

## Test coverage added

| File                                                           | Purpose                                                                                                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/e2e/features/dashboard/finance/shared/financeHarness.ts`   | Deterministic finance fixtures (3 stays, 3 transactions, 1 series), stable deltas, mutation counters, and the demo pause/scroll helpers                           |
| `ui/e2e/features/dashboard/finance/financeModule.spec.ts`      | `@ci` — 13 tests: shell, deltas, filters, search + empty state, views + calendar day, stay breakdown, create, edit, delete, series, export, phone layout + sheets |
| `ui/e2e/features/dashboard/finance/financeTour.slowmo.spec.ts` | `@demo` — headed slow-motion tour, desktop + phone, one scenario per flow                                                                                         |

Commands:

```bash
bun run test:e2e:finance            # headless mocked suite
bun run test:e2e:finance:tour       # headed slow-motion walkthrough
bun run test:e2e:finance:tour:video # same, plus .webm under test-results/playwright
```

The tour records one video per scenario. Playwright writes them to
`test-results/playwright/<scenario>/video.webm`.

### Recorded walkthroughs

Six slow-motion recordings are committed under [`recordings/`](./recordings) so the flows can be
reviewed without re-running the tour.

| File                                                                          | Flow                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`01-overview-filters.webm`](./recordings/01-overview-filters.webm)           | Hero, KPIs, hint, full-page scroll, period presets, status filter, search |
| [`02-ledger-views-and-stay.webm`](./recordings/02-ledger-views-and-stay.webm) | Table → card → calendar → day details → stay breakdown                    |
| [`03-transaction-lifecycle.webm`](./recordings/03-transaction-lifecycle.webm) | Create (4 steps), edit (3 steps), delete confirm                          |
| [`04-recurring-series.webm`](./recordings/04-recurring-series.webm)           | Series modal, recurring edit scope, delete scope                          |
| [`05-export-menu.webm`](./recordings/05-export-menu.webm)                     | Export report menu                                                        |
| [`06-phone-layout.webm`](./recordings/06-phone-layout.webm)                   | Phone cards, refine sheet, item sheet, wizard, hero actions               |

## Recommended remediation order

1. **P1-1** money truth (pipeline vs collected) and the contradictory help copy.
2. **P1-2** separate reporting query from ledger query.
3. **P1-3** recurring series scope lookup + dirty-state guard (one-line scope fix unlocks the
   documented behavior).
4. **P1-4** 1280 card layout.
5. **P2-1** row keyboard handling, together with removing `role="button"` from `tr`.
6. **P2-2 / P2-3 / P2-5** phone wizard field stacking, FAB clearance, visible reminder default.
7. Copy pass (the table above), then P3 layout/chart polish.

## Screenshot index

| #      | State                                                |
| ------ | ---------------------------------------------------- |
| 01     | Desktop 1440 default                                 |
| 02–05  | Status filter, Filters popover, Sort menu, View menu |
| 06     | Card view (desktop)                                  |
| 07b–08 | Calendar full month, day details                     |
| 09, 12 | Wizard step 1, category combobox                     |
| 13–16  | Repeat step, reminders, reminders expanded, preview  |
| 19     | Unsaved-changes guard                                |
| 20     | Export menu                                          |
| 21     | Stay finance modal                                   |
| 22–23  | Full table, edit step 1                              |
| 25     | Edit preview + activity                              |
| 27     | Repeat options                                       |
| 30     | After create (recurring toast)                       |
| 32     | Recurring edit scope (missing "this occurrence")     |
| 33–34  | Series modal, delete scope                           |
| 36–37  | Period presets, custom range                         |
| 38–39  | Search with duplicate clear, filtered empty state    |
| 40–42  | Phone top / mid / bottom                             |
| 43–46  | Card actions sheet, refine sheet, hero menu, wizard  |
| 47–48  | Tablet 768                                           |
| 49     | Dark mode                                            |
| 50     | Status filter applied                                |
| 51     | Keyboard Enter on Delete opens Edit                  |
