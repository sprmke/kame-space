---
title: 'QA — Property Maintenance'
status: active
updated: 2026-11-24
---

# 06 — Maintenance

Route: `/org/:orgSlug/property/:propertySlug/maintenance`

> **Scope of this pass:** full module walkthrough on the real local stack (seeded `kame-homes` / `kame-home` dataset) at 320, 375, 390, 768, 1024, 1280, 1440 and 1920 px, in light and dark theme. Interactions were driven with Playwright and inspected with axe (WCAG 2.1 AA), then recorded as slow-motion walkthroughs.

## Verdict

**Audited 2026-11-24, fixed in the same branch, re-verified 2026-11-24.**

The first pass found a structurally strong module whose core loop broke for the default kind of reminder. The follow-up pass fixed every P1 and P2 finding in this document, plus the P3 copy and polish items, and added `@ci` coverage for each behaviour it changed. Two P3 layout items and the Phase 4 product opportunities remain open on purpose (listed at the end).

**Heuristic score after the fixes: 4.4 / 5** (was 2.9)

| Dimension        | Before | After | Why now                                                                                                     |
| ---------------- | ------ | ----- | ----------------------------------------------------------------------------------------------------------- |
| Clarity          | 3.0    | 4.5   | Overdue / Pending / Done are explicit on every row; unfinished work older than the period stays in view     |
| Hierarchy        | 3.5    | 4.5   | Overdue replaces the tooling-first Telegram KPI; default sort is Due soonest                                |
| Consistency      | 2.5    | 4.5   | Table, cards, calendar and PDF share one status helper; preview dates use the list's long format            |
| Feedback         | 3.0    | 4.5   | Quick complete with Undo, live result count, filter echo in the PDF, real empty/error states                |
| Error prevention | 2.5    | 4.5   | Mark done is always available, delete scope resets, PATCH validates like POST                               |
| Accessibility    | 2.0    | 4.5   | Labelled fields, named progressbar, AA error text, no nested interactive cards; axe dialog is clean         |
| Mobile           | 2.5    | 4.5   | Stacked fields, a real scrollport, series close/stacked/collapsed, clean at 320 / 375 / 390                 |
| Performance      | 4.0    | 4.0   | Fine at normal volume; the schedule count is shown and capped. The duplicate post-mutation refetch remains. |

### What shipped

| Finding                                    | Status   | Change                                                                                                            |
| ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| M-01 mark done gated behind Telegram       | Fixed    | Mark-as-done moved out of the Telegram block; row/card/day quick-complete with Undo                               |
| M-02 blank status / Telegram-gated status  | Fixed    | Status always shown from `completed_at` + date: Overdue / Pending / Done; Telegram is a bell + filter             |
| M-03 date clear snapped back to this month | Fixed    | Explicit All dates (`?preset=all`), date-picker state cleared, persists across filters/sort/view                  |
| M-04 overdue rows aged out                 | Fixed    | API merges unfinished rows older than `from` (cap 200); summary counts Overdue separately                         |
| M-05 newest-first default hid overdue      | Fixed    | Default sort is Due soonest (oldest first, label tie-break)                                                       |
| M-06 no quick completion                   | Fixed    | Quick complete on table rows, cards, calendar days; bulk complete left for Phase 4                                |
| M-07 actions off-screen at 1024            | Fixed    | Notes hidden below `xl`, series icon removed from row actions, toolbar wraps instead of crushing search           |
| M-08 phone preview clipped                 | Fixed    | Sheets get a definite mobile height so the inner body scrolls; verified at 320 / 375 / 390                        |
| M-09 category/date truncated on phone      | Fixed    | Fields stack below `sm`                                                                                           |
| M-10 tablet KPI density                    | Fixed    | Four KPIs from `sm` with short titles                                                                             |
| M-12 calendar empty day panel              | Deferred | Shared calendar keeps the 1/3 panel; changing its default selection is a cross-module design decision             |
| M-13 tablet toolbar rows                   | Deferred | Still date + search + view on tablet; view stays a separate row by the mobile spec                                |
| M-14 pristine “Label is required”          | Fixed    | Dialog opens without autofocusing a field; heading focus no longer blurs it                                       |
| M-15 three-step wizard                     | Fixed    | Two steps: Details (repeat + Telegram) → Preview                                                                  |
| M-16 silent bulk recurrence                | Fixed    | Repeat shows “Creates N reminders” and the 500 cap before saving                                                  |
| M-17 series sheet phone                    | Fixed    | Visible close, stacked summary cards, Extend series behind a disclosure, occurrences first                        |
| M-18 delete scope persisted                | Fixed    | Scope resets to This occurrence on every new delete                                                               |
| M-19 “Opened from list”                    | Fixed    | “Selected”                                                                                                        |
| M-20 date formats                          | Fixed    | Preview and PDF use the list's `Nov 30, 2026` format; the picker keeps native `MM/DD/YYYY`                        |
| M-21 empty-period copy                     | Fixed    | “No reminders in this period” + View all dates; filtered and true-empty variants are distinct                     |
| M-22 empty CTA ignored permissions         | Fixed    | Add CTA is gated by `maintenance.reminders:add`                                                                   |
| M-23 calendar/series bypassed RBAC         | Fixed    | `canEdit` / `canDelete` threaded through calendar and series actions                                              |
| M-24 no error state                        | Fixed    | Inline “Could not load reminders / totals” with Try again                                                         |
| M-25 deep-link view rewrite                | Deferred | Phone still normalizes `?view=table` to cards, by design                                                          |
| M-26 unlabelled fields                     | Fixed    | Label / Notes / Date / Repeat / days / message all have accessible names; axe label rule clean                    |
| M-27 unnamed progressbar                   | Fixed    | `SegmentedStepProgress` accepts an accessible name; maintenance passes “Reminder steps”                           |
| M-28 error contrast                        | Fixed    | Error copy uses red-700 / red-400 (AA at 12 px)                                                                   |
| M-29 nested interactive cards              | Fixed    | Card is an article; the title is a real button; actions are siblings                                              |
| M-30 InfoHint target                       | Verified | The 24 px visual already carries a 44 px invisible hit pad (no change needed)                                     |
| M-31 no result announcement                | Fixed    | `role="status" aria-live="polite"` announces “N reminders shown”                                                  |
| M-32–M-37 copy                             | Fixed    | Subtitle removed, Telegram named, “3 days before · Daily at noon”, Add reminder naming, All statuses, Overdue KPI |
| M-38 PATCH validation                      | Fixed    | Shared `validateMaintenanceItemFields` on POST and PATCH (date, label 200, category 80, notes 2000)               |
| M-39 StatCard accents in light mode        | Fixed    | `.text-stat-value` no longer bakes in `text-foreground`                                                           |
| M-40 PDF ignored filters                   | Fixed    | Export applies the on-screen status/category/Telegram filter + sort and prints them in the header                 |
| M-41 duplicate post-mutation refetch       | Deferred | Invalidation already refetches; the extra active refetch is harmless but can be removed later                     |
| M-42 silent series cap                     | Fixed    | The form warns at the 500-occurrence cap                                                                          |
| M-43 truncation without tooltip            | Fixed    | Row/card labels have `title`                                                                                      |
| M-44 harness summary shape                 | Fixed    | Real `total / telegramEnabled / completed / pending / overdue / byCategory`                                       |
| M-45 shell-only E2E coverage               | Fixed    | 16 `@ci` tests + 4 tour scenarios + unit/edge tests + screenshot generator (below)                                |

**Intentionally not shipped (Phase 4):** bulk complete, completed-by / completed-at metadata in the row, CSV export, vendor/teammate assignment, auto-create turnover reminder, AI schedule suggestions. These are product additions, not defects.

---

## Before / after

Before images are the original audit captures against the seeded local stack. After images are generated deterministically by `maintenanceShots.slowmo.spec.ts` (fixtures in the shared E2E harness), so they can be regenerated at any time.

| Before                                                                                    | After                                                                               |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ![Before: desktop list](./maintenance/desktop-list.jpg)                                   | ![After: desktop list](./maintenance/after/01-desktop-1440.jpg)                     |
| ![Before: 1024 actions off-screen](./maintenance/laptop-1024-actions-cut.jpg)             | ![After: 1024 actions visible](./maintenance/after/06-laptop-1024.jpg)              |
| ![Before: tablet density](./maintenance/tablet-768-density.jpg)                           | ![After: tablet 4-up KPIs](./maintenance/after/07-tablet-768.jpg)                   |
| ![Before: 320 FAB overlap](./maintenance/phone-320-fab-overlap.jpg)                       | ![After: 320 list](./maintenance/after/16-phone-320.jpg)                            |
| ![Before: phone form truncation](./maintenance/phone-create-category-truncated.jpg)       | ![After: stacked form + Telegram](./maintenance/after/13-phone-create-telegram.jpg) |
| ![Before: preview clipped](./maintenance/phone-preview-clipped.jpg)                       | ![After: preview scrolls](./maintenance/after/14-phone-preview.jpg)                 |
| ![Before: series sheet](./maintenance/phone-series-modal.jpg)                             | ![After: series sheet](./maintenance/after/12-phone-series.jpg)                     |
| ![Before: calendar](./maintenance/desktop-calendar.jpg)                                   | ![After: calendar](./maintenance/after/03-desktop-calendar.jpg)                     |
| ![Before: date clear snaps back](./maintenance/date-clear-snaps-back.jpg)                 | ![After: All dates](./maintenance/after/15-desktop-all-dates.jpg)                   |
| ![Before: thin middle step](./maintenance/create-step2-thin.jpg)                          | ![After: merged details step](./maintenance/after/04-desktop-create-details.jpg)    |
| ![Before: completed filter blank status](./maintenance/completed-filter-blank-status.jpg) | ![After: explicit statuses](./maintenance/after/01-desktop-1440.jpg)                |

The 320 list and calendar after captures are in the additional set below. The 320 FAB overlap (M-11) and the calendar's empty default panel (M-12) are deferred; the calendar capture selects a day so the populated panel is visible.

Additional after states: [completed filter](./maintenance/after/21-desktop-completed-filter.jpg), [filters](./maintenance/after/02-desktop-filters.jpg), [tablet](./maintenance/after/07-tablet-768.jpg), [390 list](./maintenance/after/08-phone-390.jpg), [no matches](./maintenance/after/09-phone-no-match.jpg), [refine sheet](./maintenance/after/10-phone-refine.jpg), [card actions](./maintenance/after/11-phone-card-actions.jpg), [desktop preview](./maintenance/after/05-desktop-create-preview.jpg), [empty period](./maintenance/after/18-desktop-empty-period.jpg), [empty all dates](./maintenance/after/19-desktop-empty-all-dates.jpg), [dark theme](./maintenance/after/20-desktop-dark.jpg).

---

## Looks good

- Finance-like layout is consistent with the rest of the property dashboard; KPI → toolbar → list scan order is obvious.
- Table `lg+` / card `max-lg` / calendar split is the right model, and phone filters open in a refine sheet rather than stacked rows.
- The two-step wizard enforces required fields before advancing, and the preview step removes doubt before saving.
- Recurring series are first-class: series modal, extend earlier/later, edit scope (this / future / all), delete scope.
- Export is correctly gated twice: `maintenanceReporting` plan + `maintenance.export:view`, with an upgrade path.
- Server authorization is solid: `resolveScopedPropertyAccess` on every verb and `assertAssetRowInScope` before any id/series mutation. Table RLS has no policies, so browser clients cannot reach it directly.
- Create / update / delete emit `activity_log` rows with property, actor and scope metadata.
- Dark theme, 320 px width, and every tested viewport have **no page-level horizontal overflow**.

---

## Findings

Severity: **P0** data loss or security · **P1** core flow broken · **P2** confusing or fragile · **P3** polish / opportunity.

### A. Core flow

| ID   | Sev | Finding                                                                                                                                                                                                                                                                                                  | Evidence                                                                                                                   | Recommended fix                                                                                                                                                                            |
| ---- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M-01 | P1  | **A reminder cannot be marked done unless Telegram reminders are enabled.** "Mark as done" is rendered inside the `telegramReminderEnabled ?` block. Because the list has no quick-complete action either, the primary upkeep loop (do the task, tick it off) is impossible for Telegram-off reminders.  | ![Phone create preview](./maintenance/phone-preview-clipped.jpg); probe: `markDoneVisible: 0` when off, `1` after enabling | Move "Mark as done" out of the Telegram block (the API already accepts `marked_complete` without Telegram). Add a row/card quick action "Mark done" with an undo toast.                    |
| M-02 | P1  | **Status is blank for most rows.** The Status column exists only when at least one row has Telegram enabled, and a badge is drawn only for Telegram rows. Completed non-Telegram reminders show `-`; the Completed filter returns rows that look statusless. Calendar and PDF disagree (green / "Done"). | ![Completed filter](./maintenance/completed-filter-blank-status.jpg)                                                       | Derive status from `completed_at` only (`Done` / `Pending` / `Overdue`). Show Telegram as its own small column or filter chip, not as the gate for status. Keep the column always present. |
| M-03 | P1  | **Clearing the date filter immediately snaps back to this month.** `handleClearDate` writes null params, then the mount effect re-applies `this_month` whenever `from` is absent. "All dates" is unreachable.                                                                                            | ![After clear](./maintenance/date-clear-snaps-back.jpg)                                                                    | Initialise the default once (`ref`/`preset=all`), and add an explicit **All time** state so clearing persists and is shareable.                                                            |
| M-04 | P2  | **Overdue reminders from earlier periods disappear.** The list is bounded by `scheduled_on` in [from, to], so an October task never appears in November, and the "Pending" KPI excludes it. Maintenance is exactly the domain where unfinished work must not age out.                                    | `maintenanceService.listMaintenanceItems` (`gte scheduled_on from`); KPI row                                               | Include all incomplete rows older than `from` (or add an "Overdue" scope that ignores the period), surface an Overdue KPI with red tone, and keep them pinned above the period rows.       |
| M-05 | P2  | **Default sort hides the work that matters.** "Newest scheduled" puts next month's tasks above today's and ignores overdue.                                                                                                                                                                              | ![Desktop list](./maintenance/desktop-list.jpg)                                                                            | Default to oldest scheduled / overdue first, or add an explicit "Due soonest" default. Keep "Newest" as an option.                                                                         |
| M-06 | P2  | **There is no quick way to complete anything.** Every completion requires opening the wizard, and for Telegram-off tasks it is impossible (M-01). No bulk action for a week's cleaning list.                                                                                                             | Code: `MaintenanceRemindersTab` actions are only edit/delete/series                                                        | Add a Done action on row/card and a bulk "Mark selected done" mode behind the toolbar.                                                                                                     |

### B. Layout and responsive

| ID   | Sev | Finding                                                                                                                                                                                                                         | Evidence                                                           | Recommended fix                                                                                                                                |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| M-07 | P1  | **Row actions are off-screen at 1024–1279 px.** At 1024 the table viewport is 678 px against 828 px of content; the Actions column starts at x=1026. Edit/delete are only reachable by horizontal scrolling with no affordance. | ![1024 laptop](./maintenance/laptop-1024-actions-cut.jpg)          | Hide Notes below `xl`, tighten Label/Category widths, or pin Actions to the right and move row actions into an overflow menu.                  |
| M-08 | P1  | **Phone preview step clips its content.** At 390×844 the preview card is cut at the footer: the Telegram row is sliced and Notes is unreachable; the body reports `scrollHeight === clientHeight`, so it cannot scroll.         | ![Phone preview](./maintenance/phone-preview-clipped.jpg)          | Let the split sheet body own a real height (`min-h-0 flex-1`) and verify at 320/375/390; or reduce the preview to a compact summary that fits. |
| M-09 | P2  | **Category and Date share a two-column grid on phone**, truncating the category trigger to "Select or ty".                                                                                                                      | ![Phone step 1](./maintenance/phone-create-category-truncated.jpg) | Stack the pair below `sm`; full-width category, date on the row below.                                                                         |
| M-10 | P2  | **Tablet KPI cards are oversized and uneven.** At 768 the 2×2 grid gives ~135 px-tall cards with large empty areas; at 1024 "Telegram enabled" wraps to two lines and pushes its value below its neighbours.                    | ![Tablet 768](./maintenance/tablet-768-density.jpg)                | Use a compact 4-up row from `md`, or shorten the tablet card height; reserve one title line or shorten the label.                              |
| M-11 | P3  | **The floating Quick Access button can cover a card's ⋯ menu** (seen at 320 px and while scrolling).                                                                                                                            | ![320 FAB](./maintenance/phone-320-fab-overlap.jpg)                | Add a bottom-right content inset on list pages, or hide the FAB while scrolling a list.                                                        |
| M-12 | P3  | **Calendar wastes a third of the canvas on an empty day panel**, while day cells truncate labels to ~10 characters even at 1440.                                                                                                | ![Calendar](./maintenance/desktop-calendar.jpg)                    | Collapse the day panel until a day is selected, widen the grid, and use "+N more" with a tooltip for dense days.                               |
| M-13 | P3  | **Tablet toolbar is three stacked full-width rows** (date, search, view) plus the KPI block; the first card starts below the fold at 768.                                                                                       | ![Tablet 768](./maintenance/tablet-768-density.jpg)                | Move the view toggle into the refine sheet on tablet, or place search and view on one row.                                                     |

### C. Wizard and series

| ID   | Sev | Finding                                                                                                                                                                                                     | Evidence                                                   | Recommended fix                                                                                                                              |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| M-14 | P2  | **"Label is required" appears before the user touches anything.** The dialog focuses the first field, then the step heading steals focus, triggering `onTouched` validation on a pristine form.             | axe `errorOnOpen: "Label is required"`; step 1 screenshots | Focus the heading without blurring the input, or validate on submit + change only for untouched fields.                                      |
| M-15 | P2  | **Step 2 ("Reminders") contains two controls** while step 1 holds four. The extra step adds taps without adding clarity, especially on phone.                                                               | ![Step 2](./maintenance/create-step2-thin.jpg)             | Collapse to Details (incl. Repeat) → Preview, or keep 3 steps only when Telegram is enabled.                                                 |
| M-16 | P2  | **Recurring reminders are created silently in bulk.** A monthly reminder defaults to a two-year end date and creates 25 rows; daily creates 90. The user only learns the count from a toast after the fact. | Probe: `25 recurring reminders created`; series modal      | Show "Creates 25 reminders" next to Repeat/end date and in the preview; warn above ~12; consider generating occurrences lazily.              |
| M-17 | P2  | **The series sheet on phone has no visible close**, truncates the date range ("Nov 24, 2026 → Nov …"), and buries the occurrence list under two large extend cards.                                         | ![Phone series](./maintenance/phone-series-modal.jpg)      | Add a close button to the sheet header, stack the three summary cards, collapse "Extend series" behind a disclosure, list occurrences first. |
| M-18 | P2  | **Delete scope persists between dialogs.** `RecurringDeleteDialog` keeps its local `scope` state; after choosing "All occurrences" once, the next recurring delete opens on "All".                          | Code: no reset effect on `item` change                     | Reset to `this` when the item changes; make the destructive scope explicit every time.                                                       |
| M-19 | P3  | **"OPENED FROM LIST" badge** is internal jargon on the first series occurrence.                                                                                                                             | Series modal screenshot                                    | Rename to "Selected" or drop it.                                                                                                             |
| M-20 | P3  | **Form dates read `MM/DD/YYYY`**, the list and PDF read `Nov 30, 2026`, and the preview repeats the numeric format. PH readers can misread 11/12.                                                           | Step 1 and preview screenshots                             | Keep the native picker but show the chosen date in the same long format beside it; document the format.                                      |

### D. Empty, error and permission states

| ID   | Sev | Finding                                                                                                                                                                                                                  | Evidence                                                    | Recommended fix                                                                                           |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| M-21 | P2  | **The empty state says "No reminders yet" for an empty period**, while the KPI area says "No data for this period". With other months populated, "yet" is wrong and "Add reminder" hides the real action (change dates). | Code + summary card                                         | Say "No reminders in this period", with "View all dates" and Add as secondary actions.                    |
| M-22 | P2  | **The empty-state Add button ignores permissions.** It renders for read-only members; clicking does nothing because the page gates modal mounting.                                                                       | Code: `MaintenanceRemindersTab` empty CTA → `openCreate`    | Pass `canAdd` into the tab; hide the CTA and show a viewer note instead.                                  |
| M-23 | P2  | **Calendar and series actions are not permission-gated.** Calendar delete opens the dialog for read-only members; series modal edit/delete are always offered. Server rejects, but the UI lies.                          | Code: calendar `onDelete={setDeleting}`; series modal props | Thread `canEdit` / `canDelete` through the calendar and series modal, as the table/card views already do. |
| M-24 | P2  | **No error state.** If either request fails, the page falls through to "No reminders yet" / "No data for this period"; the calendar's `error` prop is never passed.                                                      | Code: `useMaintenanceItems` error ignored                   | Render an inline "Could not load reminders" surface with Retry for both summary and list.                 |
| M-25 | P3  | **Mobile deep links are rewritten** (`?view=table` → `card`), so a link shared from desktop opens a different view on phone.                                                                                             | `useAdminMobileCardViewGuard`                               | Acceptable, but note it in the guide or preserve the preference per device.                               |

### E. Accessibility (axe WCAG 2.1 AA)

| ID   | Sev | Finding                                                                                                                                                                       | Evidence                  | Recommended fix                                                                                     |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| M-26 | P1  | **Label and Notes inputs have no accessible name.** `FormFieldBlock` supports `controlId`, but the maintenance form never passes it. axe: `label` critical (2 nodes).         | axe report                | Add ids and `controlId="maintenance-label"` etc. (or `aria-label`).                                 |
| M-27 | P2  | **The wizard progress bar has no name.** axe: `aria-progressbar-name` serious.                                                                                                | axe report                | `aria-label="Step 1 of 3: Details"` plus `aria-valuetext`.                                          |
| M-28 | P2  | **Error copy fails contrast at 12 px** (3.78:1 vs 4.5:1).                                                                                                                     | axe report                | Add a darker destructive text token for small error copy, or use 13–14 px/600.                      |
| M-29 | P2  | **Phone cards nest interactive controls.** The card is `role="button"` containing ⋯/edit/delete buttons; axe: `nested-interactive` + `label-content-name-mismatch` (4 nodes). | axe report                | Make the card an `<article>` with a title button that opens edit, and keep the actions as siblings. |
| M-30 | P3  | **Info hints are 24 px targets** at 1024–1440; below the 44 px rule on touch-capable laptops/tablets.                                                                         | measured controls         | Add an invisible 44 px hit pad (same pattern as `admin-overflow-trigger`).                          |
| M-31 | P3  | **Filter changes are not announced.** After applying a status/category filter, no live region communicates the new result count.                                              | manual screen-reader pass | Add a polite status line ("4 reminders shown").                                                     |

### F. Copy and interaction polish

| ID   | Sev | Finding                                                                                           | Recommended fix                                                                                      |
| ---- | --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| M-32 | P3  | "Set maintenance items and reminders." is instructional subtitle copy.                            | Remove it (the layout is self-explanatory).                                                          |
| M-33 | P3  | "Send reminders" never says Telegram; "Telegram" only appears later in the preview and KPI.       | "Telegram reminders" with the existing hint, or "Remind me on Telegram".                             |
| M-34 | P3  | Preview strings "3d before · Daily at 12:00 PM" read like log output.                             | "3 days before · Daily at noon".                                                                     |
| M-35 | P3  | Action naming flips: "Add reminder" (button) / "New reminder" (title) / "Reminder saved" (toast). | One verb set: "Add reminder" → "Reminder added".                                                     |
| M-36 | P3  | "All Status" (singular) beside "All Categories"; "Newest scheduled" is awkward.                   | "All statuses", "Date (newest first)".                                                               |
| M-37 | P3  | "Telegram enabled" as a headline KPI is tooling-first; hosts think "auto reminders".              | Rename to "Auto reminders", or replace the card with "Overdue" (M-04) and keep Telegram as a filter. |

### G. Code, data and security

| ID   | Sev | Finding                                                                                                                                                                                                                                                                                                                      | Evidence / file                                                           | Recommended fix                                                                                                                                 |
| ---- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| M-38 | P2  | **PATCH does not validate `scheduled_on`, label, category or notes length.** POST checks the date; PATCH only slices to 10 chars. Direct API calls can store non-dates or 10 kB labels, breaking sort, calendar and PDF.                                                                                                     | `supabase/functions/maintenance-items/index.ts` (PATCH)                   | Validate ISO date + max lengths (200 label, 80 category, 2000 notes) on both verbs, matching the client schema.                                 |
| M-39 | P2  | **KPI accent colours never render in light mode.** `text-stat-value` `@apply`s `text-foreground` and wins the cascade, so `text-emerald-600` / `text-amber-600` are computed as `rgb(3,7,17)`. Dark mode works via `.dark` specificity. Shared `StatCard`, so Finance and any other KPI using `valueClassName` are affected. | Computed style probe; `ui/src/index.css` `.text-stat-value`               | Remove the colour (`text-foreground`) from `.text-stat-value` (keep size/weight) or move the token to a lower layer; add a computed-style test. |
| M-40 | P2  | **PDF export ignores client-side filters** (status, category, Telegram) because it receives the page's unfiltered items; the header only records search. Exporting while filtered produces a report that contradicts the screen.                                                                                             | `MaintenanceExportMenu` → `exportPdf.ts`                                  | Pass the filtered + sorted rows to the export, and print active filters in the header meta.                                                     |
| M-41 | P3  | **Two queries for the same list** (page summary + tab items, plus a refetch after every mutation) cause duplicate fetches.                                                                                                                                                                                                   | `MaintenancePage` + `MaintenanceRemindersTab`; `refreshMaintenanceCaches` | Pass items down from the page; invalidate without the extra active refetch.                                                                     |
| M-42 | P3  | **Recurring series cap is silent.** Server caps generation at 500 occurrences; the user gets no "limit reached" feedback.                                                                                                                                                                                                    | `financeRecurrence.generateRecurrenceDates`                               | Return `truncated: true` and tell the user, or block with a clear message.                                                                      |
| M-43 | P3  | **Table/card action labels truncate without a tooltip** (label max 220 px).                                                                                                                                                                                                                                                  | `MaintenanceRemindersTab` table cell                                      | Add `title` or an expandable label.                                                                                                             |

### H. Test infrastructure

| ID   | Sev | Finding                                                                                                                                                                | Status                                                                                                |
| ---- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| M-44 | P2  | The shared RBAC harness answered `maintenance-summary` with a legacy `totals` shape the page never reads, so the existing smoke test only proved the heading rendered. | **Fixed** — the mock now returns the real `total/completed/pending/telegramEnabled/byCategory` shape. |
| M-45 | P2  | E2E coverage was one "page loads" assertion. Filters, the wizard, CRUD, recurring scope, export, RBAC and the phone layout were untested.                              | **Fixed** — 10 `@ci` tests plus a 4-scenario `@demo` tour (below).                                    |

---

## Test coverage

| Layer    | Spec                                                                                                           | Lane    | Covers                                                                                                                                                                                                                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit     | `lib/maintenanceReminders.test.ts`, `maintenanceItemFormSteps`, `CanProceed`, `finance/lib/recurrence.test.ts` | —       | Overdue/Pending/Done split, status filters, Due-soonest sort, two-step gating, recurrence count + 500 cap                                                                                                                                                                                                                                                           |
| Edge     | `_shared/maintenanceValidation_test.ts`, `maintenanceSummary_test.ts`                                          | —       | POST/PATCH field validation (date, lengths) and Overdue vs Pending summary math                                                                                                                                                                                                                                                                                     |
| E2E      | `ui/e2e/features/dashboard/maintenanceWorkspace.spec.ts`                                                       | `@ci`   | 16 tests: totals + statuses, Completed filter, Overdue filter, Telegram-independent Overdue, 2-step create + POST body, quick complete + undo, edit + done, single delete scope, series delete scope reset, read-only RBAC (table + calendar), empty period → All dates persistence, date clear, error retry, phone cards, axe on the dialog, filtered PDF download |
| E2E tour | `ui/e2e/features/dashboard/maintenance/maintenanceTour.slowmo.spec.ts`                                         | `@demo` | 01 list/filters/views, 02 create + quick complete + delete, 03 export, 04 phone + tablet sheets                                                                                                                                                                                                                                                                     |
| Shots    | `ui/e2e/features/dashboard/maintenance/maintenanceShots.slowmo.spec.ts`                                        | `@demo` | Regenerates every after screenshot in this doc at 1440 / 1024 / 768 / 390 / 375 / 320, light + dark, plus empty states                                                                                                                                                                                                                                              |
| Harness  | `ui/e2e/features/dashboard/maintenance/shared/maintenanceHarness.ts`                                           | —       | Stateful `maintenance-items` mock (POST/PATCH/DELETE mutate, summary recomputes), relative-date fixtures, `demoPause`                                                                                                                                                                                                                                               |
| Harness  | `ui/e2e/features/team/shared/propertyTeamRbacHarness.ts`                                                       | —       | Real summary shape (incl. `overdue`), `teamRbacPaths.maintenance`                                                                                                                                                                                                                                                                                                   |

Run locally:

```bash
# @ci regression spec
node_modules/.bin/playwright test \
  ui/e2e/features/dashboard/maintenanceWorkspace.spec.ts --project=chromium-ci

# Slow-motion tour, with video
PLAYWRIGHT_SLOW_MO=500 PLAYWRIGHT_DEMO_PAUSE_MS=650 PLAYWRIGHT_RECORD_VIDEO=1 \
  node_modules/.bin/playwright test \
  ui/e2e/features/dashboard/maintenance/maintenanceTour.slowmo.spec.ts --project=chromium

# Regenerate the after screenshots in this doc
node_modules/.bin/playwright test \
  ui/e2e/features/dashboard/maintenance/maintenanceShots.slowmo.spec.ts --project=chromium
```

Recorded walkthroughs (local, not committed; `test-results/` is gitignored):

```text
test-results/maintenance-tour/videos/01-overview-filters-views.mp4
test-results/maintenance-tour/videos/02-create-edit-delete.mp4
test-results/maintenance-tour/videos/03-export-report.mp4
test-results/maintenance-tour/videos/04-phone-tablet-layouts.mp4
```

---

## Verification

Run in a clean worktree based on `origin/main` (the tree is identical to `origin/develop`):

- 16/16 `@ci` tests pass; 4/4 `@demo` tour scenarios pass; the screenshot generator passes at 21 captures.
- Unit: 8 files / 71 tests pass (`maintenanceReminders`, steps, can-proceed, recurrence count).
- Edge: `maintenanceValidation_test` + `maintenanceSummary_test` pass under Deno (`TZ=Asia/Manila`).
- `eslint` on every changed file: 0 errors (2 pre-existing `react-refresh` warnings on component files that also export helpers).
- `prettier --check`: clean.
- `bun run check:e2e-lane-tags`: clean (one lane tag per spec).
- `check-ui-filename-conventions.sh`: clean.
- axe (WCAG 2.1 AA, serious/critical) on the create dialog: 0 violations. The existing `/maintenance` axe sweep still covers the list shell.
- No page-level horizontal overflow at 320 / 375 / 390 / 768 / 1024 / 1440 / 1920.

**Note on the local edge runtime:** the Docker edge runtime in this workspace still serves the pre-change `maintenance-summary`, so the screenshot generator recomputes the summary from the real `maintenance-items` response. The server changes are covered by Deno tests and ship with the normal `cd-prod` deploy; they were not hot-reloaded here (local stack restart needs the owner's unlock).

---

## Remaining / deferred

| ID      | Why it is open                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-11    | The floating Quick Access button is shared shell chrome; moving/insetting it per page would diverge from every other dashboard route.                   |
| M-12    | The calendar's empty day panel is a shared `DateCalendarView` layout. Changing its default selection changes Bookings/Finance calendars too.            |
| M-13    | Tablet keeps date + search + view rows per the mobile toolbar spec; a stricter density pass is a cross-module decision.                                 |
| M-25    | Phone still normalizes a `?view=table` deep link to cards, intentionally.                                                                               |
| M-41    | The extra active refetch after a mutation is redundant but harmless; removing it is a separate query-cache cleanup.                                     |
| Phase 4 | Bulk complete, completed-by/at metadata, CSV export, vendor assignment, turnover reminder, AI schedule suggestions. These are new product capabilities. |

---

## Evidence

Before images are the original seeded captures; after images are regenerated by the screenshot spec.

- `desktop-list.jpg` — 1440 list, blank status on non-Telegram rows, newest-first order
- `laptop-1024-actions-cut.jpg` — Actions column outside the 1024 viewport
- `completed-filter-blank-status.jpg` — Completed filter returns rows whose Status reads `-`
- `date-clear-snaps-back.jpg` — after Clear, the range is still November 2026
- `tablet-768-density.jpg` — 2×2 oversized KPI cards and three-row toolbar
- `phone-create-category-truncated.jpg` — "Select or ty", immediate red error
- `phone-preview-clipped.jpg` — clipped preview card at 390×844
- `phone-series-modal.jpg` — no close control, truncated range, occurrences below the fold
- `phone-320-fab-overlap.jpg` — Quick Access button over card actions
- `desktop-calendar.jpg` — empty day panel, truncated chips
- `create-step2-thin.jpg` — two-control middle step
- `after/` — 21 after captures (list, filters, calendar, create, preview, laptop, tablet, phone, no-match, refine, card actions, series, Telegram form, All dates, 320, 375, empty period, empty All dates, dark)

## Related docs

- [Route guide](../../../guides/routes/org/property/maintenance.md)
- [`docs/PROJECT.md`](../../../PROJECT.md)
- [Property dashboard QA index](./01-dashboard.md)
