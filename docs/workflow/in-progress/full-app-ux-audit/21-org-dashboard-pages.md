---
title: 'Audit 21: org dashboard pages'
status: active
tags: [audit, dashboard, org]
updated: 2026-11-19
---

# 21: Org dashboard pages

Page-by-page functional pass over the organization dashboard: dashboard, bookings, booking detail,
reviews, analytics, properties, parkings, team, plans, announcements, settings, help and support.
Desktop 1440 and mobile 390. Every control exercised; filters, sorts, drawers, dialogs and empty
states checked.

Screenshots: `/tmp/audit/org-dash-screens/` (175 files).

Environment note: the canonical org slug was renamed to `kame-space` mid-run by another session and
the edge runtime briefly died. Both are called out where they affected a reading; neither is a
product finding.

---

## Dashboard

**Works:** period presets (week/month/year/custom) rewrite the URL and all KPIs; prev/next step a
month and clamp; chart toggle swaps revenue/bookings; Recent Bookings deep-link to the correct scoped
detail; Listings Performance tabs filter; Add listing opens the shared dialog.

### P2. Two of four Pending Actions drill-downs apply no filter

"Unpaid guest balance" and "Low occupancy next 30 days" both link to
`/bookings?from=…&to=…` with no status or balance/occupancy filter, so the destination is the plain
November list. Only "Pending review" adds `status=` and only "Check-ins today" narrows the dates.

### P2. Dashboard revenue disagrees with Analytics

Dashboard `Total Revenue ₱44,740` vs Analytics `Revenue ₱46,550` for the same range; the CSV matches
Analytics, and Properties (₱42,000) + Parkings (₱4,550) = ₱46,550. The dashboard card is the outlier.

### P3

- Three booking totals on one screen (KPI 13, donut 10, DB 15). The donut silently excludes
  `CANCELLED`, `NO_HOST_AVAILABLE`, `PENDING_HOST_ACCEPTANCE`, `PENDING_PAYMENT`.
- `/org/:orgSlug` (no `/dashboard`) renders an empty main; only the sidebar draws.
- Donut arcs have no hover/tooltip; values only in the legend.
- Mobile "Add listing" is 36x36 and KPI `?` buttons are 24x24.

---

## Bookings

**Works:** stage cards filter and rewrite the URL; all 11 statuses listed (including legacy nested
ones); more-filters popper; search by name, email and nonsense (empty state); 5 sort options; table,
card and calendar views; rows open the correct property or parking detail; New booking wizard gates
Continue on required fields.

### P1. The org list is silently locked to the current month

`/org/:orgSlug/bookings` always carries `from=…&to=…` for the current month and the org-scope render
**does not show the date control at all** (`BookingsListPage.tsx` renders it only when `scope !==
'org'`). A booking outside November is unreachable without hand-editing the URL, and nothing on the
page says a range is applied. This is the most likely support ticket on the page ("my booking
disappeared").

### P2

- **No Import at org scope.** `canImport` is computed but the button renders only in the non-org
  branch; a Business org cannot import from the org list.
- **"History 2" returns 3 rows** because `stage=history` includes `NO_HOST_AVAILABLE` while the card
  does not count it.
- **No row-level actions.** The last column is VIEW; there is no per-row menu (cancel, message,
  quick status), unlike the property list.

### P3

- Empty state says "Adjust your filters or clear the search" but has no Clear button.
- The sort control reads like a column header ("Priority" / "Check-in ↑").
- Stage cards permanently pin the month; clearing a stage leaves the range.
- New booking shows the dev-only Developer controls panel in non-production builds.

---

## Booking detail

**Works:** tabs swap real content; More actions (reschedule, AI summary, add parking/pets, find
parking, open trip, copy trip link); workflow dialog with per-step instructions; Open trip in a new
tab; door-code Save disabled until changed; mobile collapse/expand.

### P2

- "Back to Bookings" points at the legacy `/bookings` route, losing scope and filters.
- No breadcrumb from the org list into a property-scoped detail.

### P3

- Mobile hides Edit booking, tabs and Guest view behind "Details" and there is no More menu at 390px.
- AI check is unavailable locally ("temporarily unavailable"), an environment limitation.

---

## Reviews

**Works:** rating-breakdown dialog; tabs From guests / To write / About guests / By property; filters,
search, sort, pagination; per-row Respond and overflow menu (open booking, use in marketing, report);
1000-character response limit.

### P2

- **Saving an empty response silently deletes it.** Open Respond, leave it blank, Save → toast
  "Response removed" and the dialog closes, with no confirmation, even when no response existed.
- **No review-automation control** anywhere, although "Review automation" is sold on Pro+.

### P3

- "Responded 0%" has no denominator.
- The fourth mobile tab ("By property") clips at the right edge with no scroll hint.
- AI draft fails locally with no fallback advice.

---

## Analytics

**Works:** date stepper; Export CSV (valid file with a sane header); per-listing links; search empty
state; needs-attention count.

### P3

- Occupancy precision differs from the dashboard (`41.67%` vs `42%`).
- The Filters menu contains only "All types" (rendered twice).
- "Needs attention 0 of 2 listings" vs the dashboard's "2 urgent": two health models.
- A `Table / Grid / List` segmented control exists in the DOM at 0x0 (hidden) beside the real view
  menu.

---

## Properties and Parkings

**Works:** KPIs, status/filter/search/pagination, image carousel, card actions (open dashboard,
settings, guest calendar, copy link), Add property/parking dialogs with required-field gating.

### P1. Parking stats are hard-coded to zero

The org Parkings list shows `Reservations 0 / Revenue ₱0 / Occupancy 0%` and the summary cards show
`₱0 / ₱0 / 0%` for a slot with 7 November bookings and ₱4,550. `_shared/listParkings.ts` returns
`stats: emptyParkingStats()` for every row. See 05-O1 for the code reference.

### P2

- **No lifecycle actions on the org lists.** The overflow menu is open/settings/calendar/copy link;
  pause, archive and delete live only inside Settings → Listing status.
- "Copy history" is not filtered by the search (it still lists a property when the result list says
  none).

### P3

- Property KPIs carry no period label, unlike Dashboard/Analytics.
- Carousel arrows 32x32 and dots 6x6 on phone.
- Naming drift: "Copy guest link" (property) vs "Copy public link" (parking); Add parking prefills
  Tower/Level while Add property leaves Tower empty.

---

## Team

**Works:** Members / Invitations / Permissions tabs; role filter; per-member Manage menu; invite
dialog with listing scope and seat gating; invitations list with resend and expiry; standard and
custom roles with a permission matrix; seat-limit banner.

### P2

- **Pending invitations cannot be revoked.** The only action is Resend.
- **Inactive members without a plan limit show no status.** "Demo Manager" is inactive but only dimmed
  (no badge, no reason), while plan-limited rows get a "Plan limit" chip.

### P3

- Role counts include inactive seats ("Operations 5").
- Mobile tabs are icon-only with no labels.

---

## Plans and Billing

**Works:** tabbed Billing/Plans/Compare/FAQs; current-plan header; carousel; honest downgrade dialog
("Unused time is not refunded", REMOVES list); Compare matrix; FAQs accordion; Contact sales opens the
ticket composer.

### P2

- **Mobile "Upgrade" is not an upgrade.** At 390 the header action labelled "Upgrade" opens the
  support ticket composer with no plan preselected.

  [screenshots/88](./screenshots/88-mobile-plans-upgrade-ticket.png)

- **No payment-method management.** Billing shows a card payment but there is no update card, billing
  email or invoice download; "Manage subscription" only switches to the Plans tab.

### P3

- "Contact sales" (desktop) vs "Upgrade" (mobile) for the same action.
- The carousel opens on "Plans 2-4 of 5", hiding Free until you scroll.

---

## Announcements

**Works:** grouped platform/property lists, unread markers, per-group Read all, detail pages.

### P2

- **The detail page is a dead end**: no back link, no mark read/unread, no next/prev.
- **"Read all" is a 12px tall target** (48.7 x 12) and success is silent.

---

## Settings

**Works:** save + persistence + revert; unsaved-changes guard; brand colour presets/custom/reset;
socials; AI toggle (verified twice); Activity dialog with filters and CSV; typed-slug delete
confirmation.

### P2

- **Contradictory assistant state**: "The dashboard assistant is currently off platform-wide."
  directly above an enabled "Enable dashboard assistant" switch.

### P3

- The slug field looks editable but is fixed, with no read-only styling.
- Character counters (`43/60`, `47/500`) are shown but not enforced client-side.
- Superhost "1 of 4 goals met" gives no link to the goals or how to fix "Needs work".

---

## Help and Support

**Works:** FAQ search (valid, empty), accordions, tickets list/detail, New ticket dialog with
required gating and attachments, compose deep link.

### P2

- **"Ask AI" is a dead tile.** Clicking it changes nothing when the platform assistant is off; no
  disabled state or explanation.
- **Guides is empty** ("No guides yet") while the repo ships per-route guides.
- **The Guides tile points at FAQs** (`/help-support`), so clicking the active tab bounces.

### P3

- `/tickets` immediately selects the first ticket and rewrites to `/tickets/:id`.
- Closing the compose dialog leaves `?compose=1`, so refresh reopens it.

---

## Cross-page (org)

1. Org bookings are date-scoped invisibly (P1).
2. Revenue has no single source of truth (P2).
3. Parking stats are zeros by construction (P1).
4. Dead controls when a platform feature is off (Ask AI, assistant) rather than disabled-with-reason.
5. Destructive empty-save on review responses, while Delete organization needs a typed slug.
6. Scoped roles are redirected to the property dashboard with no explanation.
7. Small hit targets recur (Read all, KPI hints, carousel controls, Back to presets).
8. Naming drift ("Copy guest link" vs "Copy public link", "Contact sales" vs "Upgrade").
9. Legacy `/bookings` links still ship from the detail page.
10. Empty states rarely offer the fix (no Clear/Reset button).

## Coverage

| Page                  | Desktop | Mobile | Notes                                                  |
| --------------------- | ------- | ------ | ------------------------------------------------------ |
| Dashboard             | yes     | yes    | presets, custom range, drill-downs, chart toggle       |
| Bookings              | yes     | yes    | 4 stages, all filters, 5 sorts, 3 views, wizard walked |
| Booking detail        | yes     | yes    | tabs, actions, workflow dialog, door code              |
| Reviews               | yes     | yes    | 3 tabs, respond, filters, empty states                 |
| Analytics             | yes     | yes    | CSV downloaded and inspected                           |
| Properties / Parkings | yes     | yes    | carousels, actions, add dialogs                        |
| Team                  | yes     | yes    | tabs, invite, manage, permissions                      |
| Plans                 | yes     | yes    | 4 tabs, downgrade dialogs                              |
| Announcements         | yes     | yes    | list + detail                                          |
| Settings              | yes     | yes    | save, guard, AI toggle, activity, delete dialog        |
| Help & Support        | yes     | yes    | 4 routes, FAQ search, ticket compose                   |

Not exercised: real checkout, invitation send/revoke, pagination beyond one page, custom role
creation, review-automation entry point (none found).
