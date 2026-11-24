---
title: 'Bookings & Booking Detail UX/UI review'
status: active
tags: [ux, ui, bookings, workflow, plans, rbac, review, qa, e2e, property]
updated: 2026-11-24
---

# Bookings & Booking Detail — UX/UI review

Deep review of the property bookings module: the list with its four views, and the booking detail
page with its workflow rail. Plan tiers and team permissions were exercised as first-class states,
not as an afterthought.

| Surface         | Route                                           | What it holds                                                            |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| List — table    | `/org/:orgSlug/property/:propertySlug/bookings` | Stage cards, toolbar, 7-column table, pagination                         |
| List — card     | `…/bookings?view=card`                          | Same data as a grid, different stage labels                              |
| List — kanban   | `…/bookings?view=kanban`                        | Status columns, drag to transition, quick workflow modal                 |
| List — calendar | `…/bookings?view=calendar`                      | Month grid, day details rail, busy-month celebration                     |
| Detail — view   | `…/bookings/:bookingId`                         | Header, section tabs, detail panels, Progress rail                       |
| Detail — edit   | Edit booking                                    | Stay / Guests / Parking / Pets tabs, sticky save                         |
| Plan variants   | Free / Starter / Business                       | Manual vs automated sends, Import gate, AI validations, custom templates |
| Team variants   | owner, Operations, Read only                    | Create, import, per-tab edit, workflow transitions, review writing       |

Every surface was opened at phone (390), tablet (768), laptop (1024), desktop (1440) and in dark
mode, with a 12-booking fixture covering all canonical statuses plus the non-canonical ones in the
wild (`PENDING_PAYMENT`, `IMPORTED` via `external_source`).

Reviewed with the `impeccable` (context + critique), `mobile-responsive`, `frontend-design`,
`ui-ux-pro-max`, `design-md`, `accessibility`, `human-copy`, `skeleton-loaders`,
`plans-and-permissions`, `audit-logging` and `booking-workflow` skills, plus both route guides and
the `list-bookings` / `get-booking` contracts.

**This is a review, not a fix pass.** Nothing under `ui/src/features/dashboard/bookings/**` was
changed. The deliverable is this document, an 18-test `@ci` suite, a capture spec (25 stills) and a
5-scenario slow-motion tour. Two defects are pinned with `test.fail()` so the suite stays green and
flips red the moment they are fixed.

> Scope note: the request header named **Bookings & Booking Detail** while the body referred to the
> property **Finance** page. This pass covers Bookings. Finance already has two audits:
> `docs/workflow/in-progress/finance-ux-review/` and `…/money-modules-ux-audit/` (both still on
> their own branches, so not linked from `develop` yet).

## Verdict

The bones are good, and better than most of the dashboard. List state lives entirely in the URL
(`q`, `status`, `from`, `to`, `sort`, `page`, `limit`, `view`, `stage`), so every view is shareable
and back/forward work. The stage cards are a real triage model, not decoration: four buckets, inline
status hints, one click to filter, one click to clear. The detail page has a genuine domain model
behind it (stage deck, nested document groups, plan-aware manual/auto sends) and the transition
confirm dialog ("This will: saves your changes, creates the GAF request document") is the best
confirmation pattern in the app. Permissions degrade the way they should at the list level: a
read-only teammate loses Import, New booking, Edit booking and every workflow CTA.

What holds it back is a **middle-width hole**, a **phone/tablet action row that clips its own label**,
and an **accessibility contract that was never wired to the table**.

- **768–1239px is the broken band.** At 768 the detail page starts its two-column layout (`md:`)
  with a fixed 320px Progress rail, leaving ~350px for the booking. The guest name wraps to two
  lines, the status chip truncates to "Pending Docume…", the dates wrap, the last section tab reads
  "Activ…", and the primary CTA reads "Mark GAF as comp…". At 1024 the container query stacks the
  columns instead, but it leaves the rail in DOM order, so **Progress sits 1,234px below the fold**,
  under Guest view, Stay details, cancellation, roster, reputation, the review card and Other info.
  The phone solves exactly this with `order-2`; the container-query stack does not.
- **The primary workflow CTA cannot render its own label on a phone.** `grid-cols-2` with
  `whitespace-nowrap` means "Mark GAF as complete" is cut to "Mark GAF as comple" at 390px, and
  "Mark GAF as comp…" at 768. The route guide promises an equal-width pair; equal widths are not
  equal content.
- **Every booking row is a `role="button"` `<tr>` wrapping real buttons.** axe returns one
  **critical** and three **serious** violations on a populated table: `aria-sort` on a `<button>`,
  `aria-label` on bare `<span>` flags, `label-content-name-mismatch` on all twelve rows (the visible
  guest name is not in the accessible name, so voice control cannot open a row by name), and
  `nested-interactive` (the chat and open buttons live inside the row button).

None of these are data-integrity or outage problems, and the booking state machine itself was not
touched. All of them are fixable in the UI layer.

## Evidence

| Item        | Value                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| App         | `http://127.0.0.1:4195` (Vite dev, worktree `lungfish`) + mocked edge envelopes                                                           |
| Fixtures    | `ui/e2e/features/bookings/shared/bookingsWorkspaceHarness.ts` — 12 bookings, 3 plan tiers, 3 permission sets                              |
| Viewports   | 390×844, 768×1024, 1024×768, 1440×960, dark at 1440 (measured at 900 / 1023 / 1025 / 1100 / 1180 / 1280 too)                              |
| Screenshots | 25, in [`screenshots/`](./screenshots)                                                                                                    |
| Recordings  | 5 slow-motion flows, in [`recordings/`](./recordings)                                                                                     |
| Console     | No page errors on a stable run. Unmocked guest-portal endpoints (`get-session-context`, `guest-profile`, `org-settings`) return 401 noise |
| Layout      | `scrollWidth == clientWidth` at 390 / 768 / 1024 / 1440 on list, kanban, calendar and detail                                              |
| Table a11y  | 1 critical + 3 serious axe violations on a populated table (empty-table sweep never saw them, see P2-11)                                  |
| Detail a11y | 1 serious contrast + 1 serious label-in-name                                                                                              |

## What works (verified end to end)

| Area               | Verified                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| URL state          | Every filter, sort, page, view and stage round-trips; back/forward restore the exact list                                                                                |
| Stage cards        | Four buckets, correct counts (5 / 4 / 1 / 2 against the fixture), click to filter, click to clear                                                                        |
| Default visibility | Completed and cancelled stay out of the default list; History shows exactly those two                                                                                    |
| Search             | Guest name, email, phone, plate and pet name all match; clears back to the full page                                                                                     |
| Status filter      | Grouped Pending Documents with GAF / Parking / Pet children; panel scrolls to reach Imported                                                                             |
| Views              | Table, card, kanban and calendar all render the same 12 rows; phone forces card and hides kanban                                                                         |
| Calendar           | Month grid, multi-night bars, "+2" overflow, day details rail, month nav patches the URL range                                                                           |
| Detail header      | Guest, status, source, dates, pax and nights; Edit booking gated on any detail edit leaf                                                                                 |
| Detail tabs        | Stay / Guests / Parking / Pets / Pricing / Files / Activity, data-driven (Parking and Pets only when required)                                                           |
| Workflow rail      | Stage deck, nested doc groups, single primary CTA, Return + Proceed pair, Cancel booking                                                                                 |
| Review gate        | Proceed stays hidden until the acknowledgement is ticked (verified, PENDING_REVIEW)                                                                                      |
| Plan degradation   | Free shows MANUAL SEND, "Not sent", "Send from Automation Triggers", no auto-send claims                                                                                 |
| Team degradation   | Read only loses Edit, Proceed, Cancel, review Write; keeps read-only detail and tabs                                                                                     |
| Server scoping     | `get-booking` 404s a booking requested through another property, parking or org; `list-bookings` narrows org scope to assigned listings (both edge functions, code-read) |
| Empty / error      | Both are real states with distinct copy; the error card names the reason instead of a blank table                                                                        |
| List chrome        | Every visible control has an accessible name (verified with the repo's unnamed-control sweep)                                                                            |

## Findings

### P1 — fix before the next release

#### P1-1. The primary workflow CTA clips its own label on phone and tablet

At 390px the rail renders `Return to Review` + `Mark GAF as complete` in a `grid-cols-2` row with
`whitespace-nowrap`. The right cell is ~150px, the label needs ~180px, so the button paints
"Mark GAF as comple" and the text runs past the pill. At 768 it reads "Mark GAF as comp…".
`BookingDetailPage` is unaffected structurally (the button box fits the viewport, which is why a
naive overflow assertion passes), so only the label is lost.

Evidence: `screenshots/51-phone-detail-workflow.png`, `screenshots/32-tablet-detail.png`.
Regression pin: `bookingsWorkspace.spec.ts` → _primary workflow CTA label is not clipped_ (`test.fail()`).

Fix direction: stack the pair below `sm` (or below the container width the label needs), and let the
primary label wrap instead of `nowrap`. Keep equal-width pairs only where the labels actually fit.

#### P1-2. 768–1023: two columns start too early and squeeze the booking

`md:flex-row` + a fixed 320px rail at 768 leaves ~350px for the whole left column. Consequences in
`screenshots/32-tablet-detail.png`:

- "Maria Santos" wraps to two lines, status chip truncates to "Pending Docume…", "DIRECT" drops to
  its own line, the date range wraps mid-date.
- The section tabs end at "Activ" with no scroll affordance or fade.
- The workflow CTA clips (P1-1).

The container query that fixes this only runs at `min-width: 1024px`, so the band 768–1023 inherits
the desktop two-column rule with a tablet viewport.

Fix direction: start the two-column layout at `lg` (or gate it on the same container query the
detail page already uses at `lg+`), and make the section tabs show an edge fade or a scroll hint.

#### P1-3. 1024–1239: Progress falls ~1,200px below the fold

At 1024 / 1100 / 1180 the page is narrower than the container query's 56rem, so the layout stacks.
Because the stack keeps DOM order, `[data-booking-detail-workflow]` lands at `y = 1234` — below
Guest view, Stay details, Cancellation, Roster, Guest reputation, Review guest and Other info. A
host on a 13" laptop has to scroll past the entire booking to reach the only actions on the page.

This is documented intent in `index.css` ("a 1024px screen with the sidebar open"), and the phone
already solves it with `order-2`. The stacking branch simply does not get the same treatment.

Evidence: `screenshots/21-laptop-detail.png` (rail absent from the viewport), measured at 1024/1100/1180.
Regression pin: `bookingsWorkspace.spec.ts` → _detail puts Progress above the fold_ runs at 390 only.

Fix direction: in the container-query `max-width: 55.99rem` branch, set `order` so the workflow
panel precedes the details column, matching `<md`.

#### P1-4. A read-only teammate can edit the door code

`GuestAccessCodeField` renders an editable input plus an enabled **Save** for any viewer. The server
rejects the write (403), so nothing is corrupted, but the UI offers a capability the role does not
have, and the error arrives only after typing a lock code. This is the same defect recorded as B4 in
[`../full-app-ux-audit/03-booking-workflow.md`](../full-app-ux-audit/03-booking-workflow.md) and it is
still open.

Evidence: `screenshots/61-read-only-detail.png`.
Regression pin: `bookingsWorkspace.spec.ts` → _door code field is read-only for a viewer_ (`test.fail()`).

Fix direction: gate the field on `bookings.detail.stay:edit` (read-only: show the saved override as
text), or disable input + Save with a one-line reason.

#### P1-5. A read-only teammate gets interactive workflow controls

On `PENDING_REVIEW` a viewer still sees the **Manual / AI check** segmented control and the
"I manually reviewed…" checkbox. Ticking it does nothing because Proceed and Cancel are correctly
hidden, so the control exists only to imply a capability that is absent. Same root cause as P1-4:
the rails gate the actions, not the gate itself.

Fix direction: hide the review question entirely when `bookings.detail.workflow:edit` is missing, and
replace it with one line ("View only") so the empty rail has a reason.

#### P1-6. The booking table's row-as-button pattern fails four axe rules

On a populated table (`screenshots/01-desktop-list-table.png`), axe reports:

| Rule                          | Impact   | What it hits                                                               |
| ----------------------------- | -------- | -------------------------------------------------------------------------- |
| `aria-allowed-attr`           | critical | `aria-sort="none"` on the "Sort by stay dates" **button**                  |
| `aria-prohibited-attr`        | serious  | `aria-label` on bare `<span>` flag icons (Needs parking, Has pets)         |
| `label-content-name-mismatch` | serious  | All 12 rows: `aria-label="Open booking for X"` omits the visible cell text |
| `nested-interactive`          | serious  | Rows contain the chat and open buttons, focusable inside a `role="button"` |

`BookingTable` puts `role="button"` / `tabIndex` on `<tr>` (`BookingTable.tsx:153`). That replaces
the row semantics a screen reader needs, and it cannot legally contain the two focusable controls
each row has. Voice control cannot open a booking by guest name.

Fix direction: keep `<tr>` as a row, make the guest cell a real `<Link>`, move the chat/open actions
out of the click target, and put `aria-sort` on the `<th>` instead of the button.

### P2 — confusing or costly

- **P2-1. "No flags" is printed on every card.** `BookingCardGrid:213` and `BookingKanban:194`
  render a muted literal for the absent case. Six of twelve cards read "No flags", which is the
  definition of noise (`ui-minimal-copy`). Render nothing.
- **P2-2. "DIRECT" is on almost every booking.** `BookingDetailHeader:43` falls back to `'Direct'`
  when `booking_source` is empty, so the chip that should mean "OTA vs direct" is a constant. It
  also sits at the same weight as the status chip, which is the one thing that must stand out.
- **P2-3. "AUTO" is unexplained.** The GAF Approval card shows an `AUTO` pill (automations allowed on
  this plan). Nothing on the page defines it, and it is adjacent to status-coloured chips.
- **P2-4. Card view renames the stage cards.** Table says _Action Required / Pending Docs /
  Confirmed Stays / History_; card view says _Needs action / Pending / Active / Completed_. Same
  counts, different vocabulary, one click apart.
- **P2-5. The sort control has no purpose name, and sorting has two entry points.** The toolbar
  trigger's accessible name is its current value ("Priority") because `AdminSortMenu` puts
  `ariaLabel` only on the listbox. Meanwhile the Stay column header is a second sort control
  ("Sort by stay dates"). Two sorters, one of them unnamed.
- **P2-6. The status popover has 11 options and clips mid-row.** The panel ends on a half-visible
  row with no fade or shadow, so it reads as broken rather than scrollable (it does scroll).
  `screenshots/02-desktop-status-filter.png` vs `02b-desktop-status-filter-bottom.png`.
- **P2-7. "Still open: Balance receipt, Check-in documents"** reads like an internal to-do but lists
  what the guest still owes. Unchanged from audit B8; each item should link to the action.
- **P2-8. "SENT DOCS 2 of 2" next to "PENDING DOCS 0 of 1"** — two denominators in one card, no
  explanation of which one unblocks the stage. Unchanged from audit B12.
- **P2-9. Three heading rows before the phone detail content.** Tenant hero ("Solea Mactan"),
  page title ("Booking"), then "Back to Bookings" — ~150px of chrome before the guest card. The H1
  is also generic; the guest name is already in the card below.
- **P2-10. The quick-access FAB sits on top of workflow content.** On phone and tablet it overlaps
  the Cancel booking / document rows (`screenshots/51-phone-detail-workflow.png`,
  `32-tablet-detail.png`). Floating by design, but it covers a "View" link on the exact screen where
  the rail is the content.
- **P2-11. The a11y sweep audits an empty bookings table.** `axeSweep.spec.ts` covers
  `teamRbacPaths.bookings`, but that harness's `list-bookings` returns rows only when a template
  fixture is seeded, so the route renders the empty state and none of the rules P1-6 fails on ever
  run. The gate reads green while the populated page has a critical violation.
- **P2-12. The detail payload ships more than the page shows.** `get-booking?format=row` returns
  `select('*')`, so every `bookings:view` caller receives the guest's bank account
  (`sd_refund_account_number`, `sd_refund_account_name`), the door code
  (`guest_essentials_override`), and the bearer tokens that unlock guest pages
  (`stay_guide_token`, `document_share_token`, `guest_form_token`). The surface hides them behind
  permission leaves, but the JSON is on the wire regardless, and RLS is bypassed by the service-role
  read. A read-only teammate, a narrowed role, a logging sink or a browser extension all see them.
  Fix direction: return a field allow-list per leaf, and strip tokens and account data when the
  caller lacks `bookings.detail.pricing:edit` / `stay:edit`.

### P3 — polish and consistency

- **P3-1.** "Back to Bookings" is 12px text with a 14px icon, well under the 44px target used
  everywhere else in the phone chrome.
- **P3-2.** Phone stage cards hide the status hints (Review / Check-out / SD Refund), so "Action
  Required 5" loses the only clue about what those five are.
- **P3-3.** The date-range control stretches into an odd wide pill for a read-only teammate, because
  Import and New booking are gone and nothing else fills the header row.
- **P3-4.** In the card view, guest emails truncate mid-domain at four-up ("julia.mercado@example…").
- **P3-5.** The list error path silently falls back to PostgREST for property scope. A 500 from
  `list-bookings` is masked by an unfiltered, unpaginated read; the user only sees an error if that
  read also fails. Worth an explicit "limited data" state or dropping the fallback now that the edge
  function is the contract.
- **P3-6.** `AdminMetricCard` is a deprecated re-export of `StatCard` that `BookingsSummaryCards`
  still imports; `BookingsListPage` carries eight `useEffect`s for URL/state sync (three of them for
  the date range alone). Neither blocks anything; both make the next change harder.

### Doc drift found while reviewing

- `docs/guides/routes/org/property/bookings.md` documents the stage labels as _Action Required /
  Pending Docs / Confirmed Stays / History_. Card view shows a different set (P2-4). Unify or
  document the variant.
- `docs/guides/routes/org/property/bookings-detail.md` §Permissions lists which leaf gates each
  Progress field but never mentions the door code, which is why P1-4 slipped: the guide implies the
  rail is permission-complete.
- The detail guide describes the CTA pair as "equal 50% width when both show" without a width or
  label-length caveat; that promise is what P1-1 breaks.

## Cross-viewport matrix

| Surface                    | 390        | 768       | 1024           | 1440      | Notes                           |
| -------------------------- | ---------- | --------- | -------------- | --------- | ------------------------------- |
| List — table               | —          | —         | yes            | yes       | Table is desktop-only by design |
| List — card                | yes        | yes       | yes            | yes       | Forced on phone                 |
| List — kanban              | —          | yes       | yes            | yes       | Hidden below `md`               |
| List — calendar            | yes        | yes       | yes            | yes       | 1 month on phone, 2 from `md`   |
| Detail — header            | ok         | **wraps** | ok             | ok        | P1-2 at 768                     |
| Detail — section tabs      | scrolls    | **clips** | ok             | ok        | P1-2 at 768                     |
| Detail — Progress position | above fold | side rail | **below fold** | side rail | P1-3 at 1024–1239               |
| Detail — primary CTA       | **clips**  | **clips** | ok             | ok        | P1-1                            |

## Recommended remediation order

1. **P1-1 + P1-2** (one change): stack the action pair below `sm`, start two-column at `lg`, add a
   tab scroll cue. Fixes phone + tablet in one pass.
2. **P1-3**: `order` swap in the container-query stack branch. ~5 lines of CSS.
3. **P1-6**: table semantics. Touches `BookingTable` + the two flag spans; the biggest a11y win in
   the module.
4. **P1-4 + P1-5**: gate the door code and the review question on `bookings.detail.workflow:edit` /
   `stay:edit`.
5. **P2-11**: give the axe sweep a populated bookings fixture so the next regression is caught.
6. **P2-1 … P2-3**: delete "No flags", demote or remove the "DIRECT" fallback, define "AUTO" in
   place or drop it.

## Test coverage added

| File                                                          | Purpose                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/e2e/features/bookings/shared/bookingsWorkspaceHarness.ts` | 12-booking fixture across every status (plus `PENDING_PAYMENT`, imported-via-`external_source`), an emulated `list-bookings` that really filters/sorts/paginates, plan tiers (Free/Starter/Business) and three permission sets, plus a detail row for every id                                                                                                                                       |
| `ui/e2e/features/bookings/bookingsWorkspace.spec.ts`          | `@ci` — 16 active tests + 2 `test.fail()` pins: stage counts and filtering, search, status filter, completed/cancelled visibility, row → detail, kanban + calendar, unnamed-control sweep, error state, detail header + every panel, workflow rail fit, review gate, door-code pin, read-only gating, axe (serious/critical), phone card view, touch targets, Progress above the fold, CTA label pin |
| `ui/e2e/features/bookings/bookingsWorkspaceAudit.spec.ts`     | `@demo` — 25 stills at 390 / 768 / 1024 / 1440 + dark, all four list views, popovers, refine and date sheets, plan/permission variants                                                                                                                                                                                                                                                               |
| `ui/e2e/features/bookings/bookingsTour.slowmo.spec.ts`        | `@demo` — 5 headed slow-motion scenarios (list, detail tabs, workflow proceed, plan + permissions, phone)                                                                                                                                                                                                                                                                                            |

Commands:

```bash
bun run test:e2e:bookings                # headless mocked module suite (@ci)
bun run test:e2e:bookings:screens        # regenerate the 25 stills
bun run test:e2e:bookings:tour           # headed slow-motion walkthrough
bun run test:e2e:bookings:tour:video     # same, plus 1280×800 .webm under test-results/bookings-tour
```

The `@ci` suite is green (16 passed, 2 expected failures) in ~2 minutes against a local Vite server.
The two `test.fail()` tests are deliberate: they document P1-1 and P1-4 and will fail loudly when
those defects are fixed, which is the signal to delete the annotation.

### Recorded walkthroughs

| File                                                                                                  | Flow                                                                        |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`01-desktop-list-stages-filters-views.webm`](./recordings/01-desktop-list-stages-filters-views.webm) | Stage cards, search, status and more-filters popovers, sort, all four views |
| [`02-desktop-detail-tabs.webm`](./recordings/02-desktop-detail-tabs.webm)                             | Header, every section tab, header overflow menu                             |
| [`03-desktop-workflow-proceed.webm`](./recordings/03-desktop-workflow-proceed.webm)                   | PENDING_REVIEW → acknowledgement → Proceed → confirm → PENDING_DOCUMENTS    |
| [`04-desktop-plan-and-permissions.webm`](./recordings/04-desktop-plan-and-permissions.webm)           | Free plan manual sends, Automation Triggers, read-only teammate             |
| [`05-phone-list-sheets-detail.webm`](./recordings/05-phone-list-sheets-detail.webm)                   | Phone stage cards, Refine sheet, date sheet, detail with Progress first     |

## Not covered in this pass

- The **edit form** (`BookingEditForm`, Stay/Guests/Parking/Pets) beyond opening and closing it — its
  validation and revert-to-Pending-Review behaviour belong with
  [`../full-app-ux-audit/03-booking-workflow.md`](../full-app-ux-audit/03-booking-workflow.md) (B6).
- **Kanban drag-and-drop** cross-column transitions; covered by the parking/bookings specs already in
  `ui/e2e/features/bookings/`.
- The **CSV import wizard** beyond the plan badge on the trigger.
- **Notifications / Templates** routes that live in the same feature folder.
- Org-scope bookings (`/org/:orgSlug/bookings`), which shares the page but adds a property column,
  listing filter and no kanban.
- Real Supabase data: every run is mocked, so nothing here validates RLS or edge-function behaviour.

## Related

- Route guides: [`bookings.md`](../../../guides/routes/org/property/bookings.md) ·
  [`bookings-detail.md`](../../../guides/routes/org/property/bookings-detail.md)
- Workflow invariants: `.cursor/rules/booking-workflow.mdc`
- Earlier audit: [`../full-app-ux-audit/03-booking-workflow.md`](../full-app-ux-audit/03-booking-workflow.md)
- Plan + permission matrix: `docs/architecture/plans-feature-matrix.md`
- Sibling reviews with the same method (each still on its own branch):
  `docs/workflow/in-progress/reviews-ux-review/`, `…/finance-ux-review/`, `…/settings-ux-review/`

## Screenshot index

| File                                   | Surface                                          |
| -------------------------------------- | ------------------------------------------------ |
| `01-desktop-list-table.png`            | List, table, default filters                     |
| `02-desktop-status-filter.png`         | Status popover, top                              |
| `02b-desktop-status-filter-bottom.png` | Status popover, scrolled to Imported             |
| `03-desktop-more-filters.png`          | More filters popover                             |
| `04-desktop-kanban.png`                | Kanban board                                     |
| `05-desktop-calendar.png`              | Calendar month + day details                     |
| `06-desktop-card.png`                  | Card view (different stage labels)               |
| `07-desktop-table-dark.png`            | Table, dark mode                                 |
| `10-desktop-detail-overview.png`       | Detail, Stay tab                                 |
| `16-desktop-detail-dark.png`           | Detail, dark mode                                |
| `20-laptop-list.png`                   | List at 1024                                     |
| `21-laptop-detail.png`                 | Detail at 1024, Progress below the fold (P1-3)   |
| `30-tablet-list.png`                   | List at 768                                      |
| `31-tablet-refine-sheet.png`           | Refine sheet at 768                              |
| `32-tablet-detail.png`                 | Detail at 768, header + tabs + CTA clip (P1-1/2) |
| `40-phone-list.png`                    | Phone list, card view                            |
| `41-phone-list-scrolled.png`           | Phone list scrolled                              |
| `42-phone-refine-sheet.png`            | Phone Refine sheet                               |
| `43-phone-date-sheet.png`              | Phone date sheet                                 |
| `50-phone-detail.png`                  | Phone detail top                                 |
| `51-phone-detail-workflow.png`         | Phone Progress rail, CTA clipped (P1-1)          |
| `52-phone-detail-lower.png`            | Phone detail lower                               |
| `60-read-only-list.png`                | Read-only list (no Import / New)                 |
| `61-read-only-detail.png`              | Read-only detail (door code editable, P1-4)      |
| `62-free-plan-detail.png`              | Free plan, manual send                           |
