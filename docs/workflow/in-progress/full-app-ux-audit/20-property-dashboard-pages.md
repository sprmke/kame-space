---
title: 'Audit 20: property dashboard pages'
status: active
tags: [audit, dashboard, property]
updated: 2026-11-23
---

# 20: Property dashboard pages

Page-by-page pass over the property workspace: dashboard, bookings, booking detail, finance, pricing,
maintenance, analytics, reviews, marketing, inbox, templates, public pages and editor, team, settings,
notifications, help, announcements. Desktop 1440 and mobile 390. Where a defect was already proven in
phase 1/2 it is referenced instead of re-litigated; the phase 3 additions are marked **new**.

Screenshots: `/tmp/audit/property-dash-screens/` and the shared gallery.

---

## Dashboard

**Works:** period presets and prev/next rewrite the range and all KPIs; attention rows deep-link with
the correct status/date filter (unlike the org variant); calendar pills, cash flow, breakdown and
transactions all render real data; Recent Bookings and Maintenance rows open the right records.

### P1 (carried). "Total Bookings" shows nights

`12 / 30` under a card titled Total Bookings, with the trend taken from booking count. See 02-H1.

### P2 (carried). Attention badge prints a percentage as a count

"Low occupancy next 30 days 40" reads as 40 items. See 02-H2.

### P2 (new). The mini calendar has no booked/selected legend

Pills are readable, but a host cannot tell a checked-in stay from a pending request by colour alone
(the booking list has a legend, the calendar does not).

### P2 (new). The mini calendar promises an interaction it does not support

The card says "Tap a date to open booking details", but free dates are disabled and clicking a booked
day cell does nothing; only the name pill navigates. The copy is inherited from the full calendar view.

### P3

- Cash-flow and breakdown cards are fine here, which makes the parking dashboard's empty copies more
  obviously a wiring bug than a design choice.
- "View Property" opens the public listing in a new tab; the icon is not labelled as external.

---

## Bookings

**Works:** stage cards, status/date/search/filters/sort/pagination, table/card/kanban/calendar views,
row click to detail, New booking wizard (validation + policy checkbox), Import wizard (upload, parse,
mapping step).

### P1 (new). Import falls back to 100% manual column mapping

Without a Gemini key the wizard reports "Matching ran in basic mode", matches **0 of 8** obvious
headers ("Guest Name", "Email", "Check In") and marks every column "AI mapping unavailable - map
manually". The deterministic header resolver only knows one alias and is case/space sensitive. It also
calls `import-ai-map-columns` twice. See 12-S18.

### P2 (carried). Stage counts do not match the visible list

Action Required 5 / Pending Docs 0 / Confirmed Stays 1 / History 0 while the default list shows six
Pending Review rows. See 02-H7.

### P2 (new). Switching to Calendar or Kanban silently changes the table's scope

Entering Calendar or Kanban patches `showCompletedBookings=true&limit=100&page=1` into the URL and
nothing removes them when you switch back to Table. The table then shows completed bookings and 100
rows per page (measured 23 → 37 rows) with no visible control to turn completed rows off again, so the
list no longer matches the stage card you had selected.

### P2 (new). The status filter's checkboxes have no accessible name

Each option is a `<button role="checkbox">` inside an unassociated `<label>`, so `getByRole('checkbox')`
matches nothing and a screen reader announces eleven unnamed checkboxes.

### P2 (new). No bulk actions

There is no row selection, no bulk status change, no bulk export. With 60 seeded bookings a host who
needs to cancel or resend for several rows must open each one.

### P3

- Kanban columns cap at 100 rows and drag-drop opens the same confirm modal as the detail page.
- The table's "Added" column is absent (documented), so "newest submission" is only sortable.

---

## Booking detail

**Works:** stepper, nested sub-steps, single next action, confirm modal that lists side effects,
past-date email checkboxes, tabs, door code, share links, activity tab, review gate.

### P1 (carried). A failed side effect still commits the status

The phase 1 repro (PDF failure returns 400 while the status moves) is still present; see 03-B1. The
new pass adds that the retry state is worse than reported: the booking opens with no ack checkbox and
no visible "retry PDF" action.

### P1 (carried). Opening the page writes a false trip-link audit event

See 03-B3.

### P2 (new). The tab set changes with status, with no explanation

PENDING_REVIEW shows Stay / Guests / Parking / Files / Activity but no Pricing; PENDING_DOCUMENTS
shows Pricing but no Parking; CANCELLED shows both. A host cannot learn one stable page shape, and the
missing tab looks like a permission problem.

### P2 (new). Files tab is text-only

Documents render as buttons ("Downpayment receipt", "Valid ID") with an external-link icon: no
thumbnail, file name, size, upload date or AI verdict inline. The verdict columns exist on the row but
are only visible in the activity log / AI review.

### P2 (new). No "message guest" from the detail

The only communication paths are the workflow emails and "Open trip". A host answering a question must
go to Inbox and search.

### P2 (new). Intermittent context crash on cold loads (not reproduced in 8 retries)

Two parallel passes saw a full "Something went wrong" boundary on Public Pages and once on
Notifications with `useOrgContext must be used within RequireOrgContext` from
`PropertySettingsIssuesSync → useSavedPropertySettingsCompletion`. Eight cold loads in this pass did
not reproduce it, so it is most likely a dev-HMR/provider-mount race, but the component calls the
non-optional context hook from a shared settings-completion path. Use an optional hook or mount it
inside the provider.

### P2 (new). "Mark GAF as complete" clips at 1440

The two-button action row does not wrap; the label renders as "compLete" at 1440 because the right
button overflows its container.

### P2 (new). A negative amount silently disables the primary CTA

New booking / transaction: a valid label and category plus amount `-500` leaves Next disabled with no
inline error or explanation.

### P3

- "Back to Bookings" is a plain link without the list's stage/filter state.
- The activity tab shows events but no field-level diff.

---

## Finance

**Works:** KPIs, range, Export report chooser → valid PDF (~180 KB), Add Transaction 4-step wizard
(expense/income, repeat, Telegram, preview) which persists and can be deleted, filters, search, sort,
pagination, table/card/calendar, refunds section, marketplace/stays ledger.

### P1 (carried). Net profit includes unpaid pipeline

UI Net Profit ₱49,890 vs API `grandNet` ₱7,390 vs Analytics ₱42,500; ₱42,500 of unpaid bookings is
counted as income next to "Pending payments ₱32,000". See 10-B11.

### P2 (carried). An expense is booked as income

Seeded "Water bill" (Association Dues) and parking "Slot signage" are stored `kind='income'`, inflating
income by ₱6,800. See 10-B23.

### P2 (new). The export chooser is unexplained

"Export report" opens Full report / Overview summary / Stays ledger / Transactions with no size or
content hint, then produces a PDF with the active range in the filename. Fine once learned, opaque
first time.

### P3

- Recurrence is a 4th step for a one-off expense; "Does not repeat" is printed twice (label and
  selected option).
- Dates are `MM/DD/YYYY` while the rest of the dashboard uses "Nov 18, 2026".

---

## Pricing and availability

**Works:** calendar with rate pills and booking pills, base rates and fees rail with save, date
overrides, blocked dates, Smart Pricing sheet (strength, price limits, update mode, preview), Channel
sync entry, direct booking link.

### P2 (new). Smart Pricing can be opened but not previewed

The sheet exposes strength/limits/update mode and a Preview button, but with no AI key the preview
returns "AI features are temporarily unavailable" and nothing explains that Smart Pricing needs the
platform AI switch. The control looks available on a Business plan.

### P2 (new). No upper bound on nightly rates

Entering `46004500` as the weekday rate is accepted and saved ("Pricing saved", KPI ₱46,004,500). There
is no max, no confirmation and no formatting check, so a slipped keystroke creates a nonsense rate that
propagates to the calendar and guest form. Restored during the audit.

### P3

- Money inputs are unformatted (`4500`) while read-only values are `₱4,500.00`.
- The rail ends well above the fold, leaving a large empty column at 1200px height.
- Calendar cells show price and booking, but not both for a booked night with an override.

---

## Maintenance

**Works:** KPIs, Add reminder 3-step wizard (details, repeat, preview) which saves, mark done,
filters, search, sort, pagination, Export report (valid PDF), Telegram toggle.

### P2 (carried). Status column shows "-" for most rows

The KPI says Pending 14 while the table prints a dash for most items. See 02-H12.

### P2 (new). The status badge is gated on Telegram, not completion

`MaintenanceRemindersTab.tsx:390-397` shows the DONE/PENDING pill only when
`telegram_reminder_enabled` is true, so 12 of 18 rows render "-" including completed items while the KPI
says "Completed 4". Cross-checked against the DB.

### P3

- Row actions are hover-only, so on touch "Mark as done" is hard to find.
- Recurrence label and selected option both read "Does not repeat".

---

## Analytics

**Works:** Overview/Trends/Guests/AI review tabs, date range, KPIs with deltas, party-size bars,
guest origins, channel donut, listing visits, export entry.

### P1 (new). Export PDF is broken

Clicking Export PDF shows the toast **"Cannot read properties of undefined (reading 'length')"** and
downloads nothing. The exporter reads `strengths / improvements / avoid`; the stored AI review payload
uses `wins / risks / actions`. See 19-D3-1.

### P2 (carried). Charts without legends

"Where bookings come from" and "Listing visits" are rings with no labels; former "How you compare" is a
permanent empty panel. See 02-H8/H9.

### P3

- Guest age is always empty in the seed.
- Guest origins bars fill 100% for a 16.67% value.

---

## Reviews

**Works:** three tabs, filters, sort, search, pagination, per-row Respond with 1000-char limit and
persistence (verified: "Response saved", row written), auto-review entry, rating dialog.

### P2 (new). An empty Respond save deletes the response with no confirmation

Save with an empty textarea → toast "Response removed"; same message when no response existed. A host
can wipe a reply by accident. See 21.

### P2 (carried). "About guests" says there are no host reviews while three exist

See 02-O5.

---

## Marketing

**Works:** Themes gallery; New post opens the Generate tab with example templates and a prompt; theme
editor; Posts/Videos/Calendar tabs; AI Studio surfaces.

### P1 (carried). Saved creations render as blank boxes

Seeded media rows point at storage objects that do not exist. See 02-H6.

### P2 (new). AI generation is advertised but unavailable, with no reason

On a Business plan with the platform AI switch off, Generate returns "AI features are temporarily
unavailable" and the UI keeps the buttons enabled. See 02-H23.

### P3

- "Themes" is a dead end until a theme is chosen; no persistent nav to Posts/Videos/Calendar.

---

## Inbox

**Works:** thread list with channel filters, search, unread/pending/replied, thread view, composer
(send verified end to end: "AUDIT-MESSAGE" appeared and persisted), quick replies, automation dialog,
platform chips.

### P2 (carried). "Importing chats" never finishes

See 02-H16.

### P2 (new). The reply window is unexplained

"Facebook · 7h 17m left" has no label; hosts do not know it is the platform messaging window.

### P3

- Composer icon buttons (lightning, sparkle) have no accessible name.
- Two empty states at once when no thread is selected.

---

## Templates

**Works:** email and stay-guide groups, editor, preview, placeholders, reset, dirty pill, unsaved
guard, custom template gating, send-to-guest entry.

### P1 (new). Templates cannot be saved when email is unavailable, and the modal only offers Discard

Save opens **Verify template changes**. **Send OTP** returns **"Email is not configured"** verbatim,
and the modal's only other control is **Discard changes** (no Cancel, no keep-editing). A host whose
mail provider is down can therefore only lose the draft or leave the modal open. See 19-D3-10.
[screenshots/86](./screenshots/86-template-save-otp-error.png)

### P3

- Save only appears once dirty.
- The Reset button has no confirmation even though it discards content.

---

## Public pages and the page editor

**Works:** gallery with real previews (after the stay-guide secret was set), Copy link, Open page,
editor with template picker, live preview, device toggle, sections, style, autosave (~1 s).

### P1 (carried). No publish/unpublish control

`config.published` exists and the guest page honours it, but the editor offers no way to change it.
See 13-P1.

### P2 (new). Editor accessibility

36 `role="tab"` nodes without accessible names, a nested-button warning in the console, and no
landmarks for the three panes. See 13-P2.

---

## Team

**Works:** members/invitations/permissions tabs, role filter, invite dialog with listing scope and
seat capacity, custom roles and permission matrix.

### P2 (new). Same two issues as org team

Pending invitations cannot be revoked, and inactive members without a plan limit show no status. See 21.

---

## Settings

**Works:** section rail, save + persistence + unsaved guard, brand colour, photos, amenities, house
rules, cancellation, location, socials, search preview (with another field), guest form, reviews,
payment (OTP), building forms, email automations, integrations, activity, listing status, danger zone.

### P0 (carried). The seeded 2br property cannot save any setting

A load-time effect forces capacity to the 2br preset (8 adults), which violates the residence cap (6),
so every save returns 400 "Max adults must be between 1 and 6". See 12-S1.

### P2 (new). Duplicate "Guest experience" section

`PropertySettingsCard.tsx` renders the same `AdminSection id="guest-experience"` twice, one without
the org/property props. See 12-S5.

### P2 (new). Payment settings and templates share the OTP blocker

Any save that requires the owner OTP fails with "Email is not configured" while the provider is down.
See 19-D3-10.

---

## Notifications

**Works:** five modules (marketing, staff, operations, finance, maintenance), save/reset, Telegram
delivery state, push state.

### P2 (new). `?module=` deep links do nothing

`/notifications?module=marketing|staff|operations|finance|maintenance` renders byte-identical content
for all five values (measured), so the documented deep links and the sidebar/Telegram links do not land
on the module they name. Module settings live behind **Manage**.

### P2 (new). Independent save buttons on one long page

Five modules with five Save/Reset pairs; nothing indicates what was saved, and on mobile the page is a
single long scroll with no section nav.

### P3

- A dummy token save succeeds with no validation feedback; "Test" does nothing without a bot.

---

## Help, announcements

**Works:** FAQ search and accordions, tickets list/detail, New ticket dialog, announcement list/detail.

### P2 (new). Same dead ends as org

"Ask AI" does nothing when the assistant is off; Guides is empty and mislinked; announcement detail
has no back link. See 21.

---

## Cross-page (property)

1. Billing/reporting data shown to Free, actions gated (19 tier matrix).
2. OTP step-up blocks template and payment saves whenever email is unavailable (19-D3-10).
3. The Setup Guide takes over deep links on a fresh listing (19-D3-2).
4. Exports are inconsistent: Finance/Maintenance chooser + PDF, Analytics crash.
5. Empty states exist everywhere but rarely offer the fix (no Clear/Reset).
6. Money and date formats differ between pages (inputs vs read-only, `MM/DD/YYYY` vs "Nov 18, 2026").
7. Property vocabulary leaks into parking, and parking vocabulary into property, via shared components.

## Coverage

| Page                        | Desktop | Mobile | Notes                                        |
| --------------------------- | ------- | ------ | -------------------------------------------- |
| Dashboard                   | yes     | yes    | presets, drill-downs, charts                 |
| Bookings (+4 views)         | yes     | yes    | filters, sorts, wizard, import mapping       |
| Booking detail (5 statuses) | yes     | yes    | tabs, workflow, files                        |
| Finance                     | yes     | yes    | add/delete transaction, PDF export           |
| Pricing                     | yes     | yes    | Smart Pricing, channel sync entry, overrides |
| Maintenance                 | yes     | yes    | add reminder, mark done, PDF export          |
| Analytics                   | yes     | yes    | 4 tabs, export failure reproduced            |
| Reviews                     | yes     | yes    | respond persistence, tabs                    |
| Marketing                   | yes     | yes    | new post flow, library                       |
| Inbox                       | yes     | yes    | send verified end to end                     |
| Templates                   | yes     | yes    | save OTP failure reproduced                  |
| Public pages + editor       | yes     | yes    | autosave, publish gap                        |
| Team                        | yes     | yes    | invite, roles                                |
| Settings                    | yes     | yes    | every card, save failure reproduced          |
| Notifications               | yes     | yes    | 5 modules                                    |
| Help / announcements        | yes     | yes    | search, tickets, detail                      |

Not exercised: publishing to Meta (no credentials), Smart Pricing preview (no AI key), payment OTP
success (no email provider), full import commit (mapping is manual).
