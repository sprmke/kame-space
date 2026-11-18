---
title: 'Audit 19: dashboard page inventory and gates'
status: active
tags: [audit, dashboard, tiers, rbac, inventory]
updated: 2026-11-18
---

# 19: Dashboard page inventory and gates

Phase 3 is scoped to the dashboard: every page for org, property and parking, across listing types,
plan tiers and access levels. Page-level functional detail lives in:

- [20: property dashboard pages](./20-property-dashboard-pages.md)
- [21: org dashboard pages](./21-org-dashboard-pages.md)
- [22: parking dashboard pages](./22-parking-dashboard-pages.md)

This file holds the cross-cutting results: the tier gate matrix, the access matrix, and dashboard
findings that apply to every page.

Method: a separate 2-tenant lab (org `tier-lab-stays`, one property, one parking) cycled through
Free, Starter, Pro and Business while direct API probes and UI captures ran; the canonical org stayed
on Business for role tests. 36 dashboard routes per tier.

---

## Tier gate matrix (measured)

Reads versus actions. `200` = allowed, `429*` = plan gate with `upgradeHook: true`.

| Dashboard surface / endpoint                                               | Free     | Starter  | Pro | Business | UI on Free                              |
| -------------------------------------------------------------------------- | -------- | -------- | --- | -------- | --------------------------------------- |
| Org dashboard                                                              | 200      | 200      | 200 | 200      | full                                    |
| Org analytics (`analytics-org-summary`)                                    | 200      | 200      | 200 | 200      | full, Export CSV has a PRO badge        |
| Org bookings (`list-bookings` org scope)                                   | 200      | 200      | 200 | 200      | full                                    |
| Org team (`org-team-*`)                                                    | 200      | 200      | 200 | 200      | invite gated by seat count              |
| Org settings / help / announcements                                        | 200      | 200      | 200 | 200      | full                                    |
| Property dashboard                                                         | 200      | 200      | 200 | 200      | full                                    |
| Property bookings (`list-bookings`)                                        | 200      | 200      | 200 | 200      | full, Import has a STARTER badge        |
| Property finance (`finance-summary`, `-line-items`, `-bookings`)           | 200      | 200      | 200 | 200      | full, Export has a STARTER badge        |
| Property analytics (`analytics-summary`)                                   | 200      | 200      | 200 | 200      | full, Export PDF has a PRO badge        |
| Property maintenance (`maintenance-items`)                                 | 200      | 200      | 200 | 200      | full, Export has a STARTER badge        |
| Property templates (read)                                                  | 200      | 200      | 200 | 200      | full editor                             |
| Property pricing (read)                                                    | 200      | 200      | 200 | 200      | full                                    |
| Property team (list)                                                       | 200      | 200      | 200 | 200      | full, Invite has a STARTER badge        |
| Property inbox (`social-inbox-threads`, `meta-inbox-status`)               | 200      | 200      | 200 | 200      | full                                    |
| Marketing themes                                                           | **429*** | **429*** | 200 | 200      | themes page opens, studio actions gated |
| Calendar sync (read)                                                       | 200      | 200      | 200 | 200      | dialog opens                            |
| Calendar sync (PATCH)                                                      | **429*** | **429*** | 200 | 200      | save gated with upgrade prompt          |
| Smart pricing (read)                                                       | 200      | 200      | 200 | 200      | sheet opens                             |
| Parking dashboard / bookings / finance / pricing / team / inbox / settings | 200      | 200      | 200 | 200      | full at every tier                      |

**Reading:** the paid modules are _page-visible on every tier_; enforcement sits on the action (export,
import, invite, publish, sync save). Two consequences:

1. **Sold capabilities are visible but not exportable.** "Analytics insights" and "Finance reporting"
   are sold as paid capabilities, yet a Free host sees the full KPI and chart data and only the export
   button is locked. If the intent is paid-only _data_, the page and the read endpoints need the gate.
2. **Write gates work correctly** where they exist: `calendar-sync-settings` PATCH returns
   `429 {"error":"This feature requires a paid plan (calendarSync)","upgradeHook":true,"feature":"calendarSync"}`,
   and `marketing-themes` gates on Free/Starter. The pattern is right; the coverage is inconsistent.

[screenshots/87](./screenshots/87-free-tier-analytics-visible.png)

Also verified: no dashboard API returned a 500 on any tier; every gated response carried
`upgradeHook: true`; the tier switch itself (DB) was reflected by the app within one fresh context.

### UI gate badge inventory

| Page                 | Control                              | Badge shown on Free |
| -------------------- | ------------------------------------ | ------------------- |
| Property bookings    | Import                               | STARTER             |
| Property finance     | Export report                        | STARTER             |
| Property maintenance | Export report                        | STARTER             |
| Property analytics   | Export PDF                           | PRO                 |
| Org analytics        | Export CSV                           | PRO                 |
| Property team        | Invite Member                        | STARTER             |
| Marketing            | Studio / Generate / Publish surfaces | PRO / BUSINESS      |
| Templates            | Add Template (custom)                | STARTER             |
| Public Pages         | Autosave / Showcase select           | PRO                 |

---

## Access matrix (Business plan)

| Page                                             | Owner | Org admin (scoped) | Property ops | Viewer | Parking staff          | Parking full     |
| ------------------------------------------------ | ----- | ------------------ | ------------ | ------ | ---------------------- | ---------------- |
| Org dashboard / bookings / reviews / analytics   | yes   | scoped data        | no           | no     | no                     | no               |
| Org properties / parkings                        | yes   | scoped             | no           | no     | no                     | no               |
| Org team / plans / settings                      | yes   | partial            | no           | no     | no                     | no               |
| Property dashboard / bookings                    | yes   | scoped             | yes          | read   | no                     | no               |
| Property finance                                 | yes   | scoped             | no           | no     | no                     | no               |
| Property pricing                                 | yes   | scoped             | yes          | read   | no                     | no               |
| Property maintenance / templates / public pages  | yes   | scoped             | yes          | read   | no                     | no               |
| Property team / settings                         | yes   | yes                | no           | no     | no                     | no               |
| Property marketing / inbox                       | yes   | scoped             | no           | no     | no                     | no               |
| Parking dashboard / bookings / finance / pricing | yes   | scoped             | no           | no     | **broken** (see 09-R3) | **shell broken** |
| Parking team                                     | yes   | scoped             | no           | no     | no                     | broken           |

---

## Cross-cutting dashboard findings

### D3-1 (P1). Analytics "Export PDF" is broken and shows a raw JS error

Clicking **Export PDF** on the property Analytics page shows the toast
**"Cannot read properties of undefined (reading 'length')"** and downloads nothing. Reproduced on the
canonical Business org with seeded data.

Cause: the PDF exporter reads `review.payload.strengths / improvements / avoid`, but the stored AI
review payload uses `wins / risks / actions / summary`. Any property with an AI review fails the
export.

[screenshots/81-analytics-export-error.png](./screenshots/81-analytics-export-error.png)

### D3-2 (P1). A new listing's Setup Guide takes over every dashboard deep link

Opening `/finance`, `/bookings`, `/analytics` and the rest on a freshly created listing renders the
full-page **Setup Guide** ("Basics 1/7", Organization, Listings, Verification, Finish) over the
requested page. Escape dismisses it, but there is no visible close or "skip for now" control in the
overlay, so a new host cannot tell how to get to the page they clicked.

It is expected to appear for a new host; the problems are (a) no visible dismissal, (b) it does not
remember a dismissal, (c) it blocks direct links rather than appearing as a banner or a first-run card.

[screenshots/85](./screenshots/85-setup-guide-overlay.png)

### D3-3 (P2). Creating a parking without a name produces a bare slot label

`create-organization` (and create-parking) falls back to `slotLabel` when no name is given, so a new
parking is named **"901"**, slugged `901`, and every dashboard/public surface shows "901" instead of
"Monaco - Level 3 - Slot 901". `formatParkingDisplayName()` already exists and is not used here.

### D3-4 (P2). The workspace switcher uses codes for parking

The switcher and sidebar show **"ML2S27"** / **"A2 ML2S27"** for the parking (initials of "Monaco
Level 2 Slot 27") because the parking has no image. A host has to decode their own workspace.

### D3-5 (P2). Notification titles come from the linked booking, not the notification

A seeded notification with body "June Vale requested 3 nights" is linked to Rafa Mercado's booking, so
the panel renders **"Rafa Mercado / June Vale requested…"**. The server sets `title` ("New booking
request") but the panel prefers the booking's guest name. A mismatched link is therefore shown as a
wrong guest. Same issue on the parking inbox notifications.

### D3-6 (P2). Date range is intentionally per-page, but nothing says so

Bookings with a September range → click Finance → Finance opens on the current month (the storage key
is per surface by design). Hosts comparing two modules must re-pick the range each time. Either carry
the range across modules or show the active range clearly in the header on arrival.

### D3-7 (P2). Exports differ in format and feedback

Finance and Maintenance open a "Full report / Overview / Ledger" chooser and produce a ~180 KB PDF.
Org Analytics downloads a CSV immediately (255 bytes for 2 listings). Property Analytics fails (D3-1).
The same "Export" action behaves three different ways across dashboards.

### D3-8 (P3). Org analytics CSV leaks an internal enum

The Outlook column writes `building` (lowercase internal value) instead of a host label
("Demand building"). Same string appears in the UI as "Underbooked · 0%".

### D3-10 (P1). OTP-gated saves are unusable when email is unavailable, and show a raw error

Property Templates → edit → **Save** opens **Verify template changes** → **Send OTP**, which returns
**"Email is not configured"** verbatim and leaves the modal open with no alternate path. The draft
cannot be saved at all. The same step-up flow guards platform settings (04-A6) and other sensitive
saves, so one missing/broken email provider blocks every one of them.

Fix: surface a human message ("We can't email a code right now, so this change is blocked"), link to
the email health surface for an operator, and allow an owner-authenticated fallback (or a pre-issued
sudo window) so content editing is not hostage to one provider.

[screenshots/86](./screenshots/86-template-save-otp-error.png)

### D3-9 (P3). Page headings are consistent, but the internal route names are not

Every dashboard page's H1 matches its nav label (verified across 36 routes). The mismatch is internal:
nav "Messages" ↔ `/inbox`, nav "Pricing & availability" ↔ `/pricing`, nav "Plans & Billing" ↔
`/plans`. Documented, but every new page has to relearn it.

---

## What works

- Tier switching is reflected immediately; every gated write returns a machine-readable
  `upgradeHook` and the UI maps it to an upgrade prompt.
- Empty states exist on every dashboard page checked (bookings "No bookings found", finance "No cash
  flow", analytics per-chart empty copy, maintenance "No reminders yet", reviews "No published guest
  reviews yet", marketing "Nothing saved yet", notifications "No activity yet").
- Property dashboard drill-downs are correctly filtered (status + date), unlike the org variant.
- Sidebar collapse and theme persist across reloads.
- Notification "Mark all as read" clears the badge immediately.
- Finance and Maintenance PDF exports produce valid files with the active range in the filename.

## Coverage

36 dashboard routes x 5 plans (180 probes), 18 API endpoints x 5 plans, 10 role shapes, plus
page-level functional passes in reports 20-22.
