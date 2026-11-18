---
title: 'Audit 06: cross-cutting'
status: active
tags: [audit, responsive, accessibility, performance]
updated: 2026-11-19
---

# 06: Cross-cutting findings

Patterns that appear on more than one screen, with the route where each was first observed.

---

## Layout and chrome

### X1. The cookie banner is a fixed bar that covers real content

The consent bar sits on top of the bottom-left corner of every page until a choice is made. On
`/org/kame-homes/dashboard` and `/org/…/property/kame-home` it hides the sidebar account block; on
Finance, Tables and Bookings it hides the last table row and pagination.
[screenshots/01-property-dashboard-desktop.png](./screenshots/01-property-dashboard-desktop.png)
Fix: reserve space (`padding-bottom` on the shell) or make it a bottom sheet that does not overlay
persistent chrome, and never let it cover the account menu.

### X2. Long single-scroll admin pages have no mobile section navigation

Property Settings and Notifications both drop their section rail below `lg` and become one long
document. Everything below "Building Forms" is effectively unfindable on a phone.
[screenshots/25-settings-mobile-long-page.png](./screenshots/25-settings-mobile-long-page.png)
Fix: a sticky section chip row (or the existing `AdminListRefineSheet` pattern) that scroll-spies.

### X3. Sidebar overflow at 900px

At 1440x900 the property/org sidebar list is taller than the viewport; the last item is clipped by
the sticky "Verification" card and the footer block overlaps the cookie bar. Either make the nav
scroll independently (it partly does) with visible fade, or move Verification into the footer area.

### X4. Icon-only header actions lack labels

Mobile Bookings header shows an upload glyph and a calendar glyph; the parking/guest headers show a
theme toggle and an avatar with no text. They need `aria-label` and, on desktop, a tooltip. The
inbox composer lightning/sparkle buttons are the same problem.

---

## Responsive

- No horizontal scrolling was found on any of the 272 crawled page/viewport combinations.
- Tap targets under 36px were detected on several pages (16 on `/`, 14 on org Properties, 32 on
  `/admin/support/faqs`, 20 on a development detail). The design system requires 44px hit pads; most
  offenders are dense pills and icon buttons using the 32px visual without the invisible pad.
- Tables correctly switch to cards below `lg` on Bookings, Finance, Maintenance and Admin lists. Some
  admin lists (FAQ editor) keep a table-like density at 390 and become hard to use.
- Modal patterns are correct: forms and pickers open as bottom sheets on phone, dialogs on desktop.
- Charts shrink but their legends disappear entirely at 390 (Finance, Analytics), so the mobile chart
  is often just a colored shape.

---

## Accessibility

Verified with axe-core (WCAG 2.0/2.1 A + AA rules) against 12 representative routes at 1440 and 390.

| Finding | Route                         | Detail                                                                                                                                            |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1      | `/admin/feature-availability` | `#fa-off-only` is a `role="switch"` with `aria-checked` but **no accessible name** (the only unnamed switch of 15).                               |
| A2      | Property inbox                | Composer lightning and sparkle buttons have no accessible name.                                                                                   |
| A3      | Property bookings (mobile)    | Header icon buttons have no accessible name.                                                                                                      |
| A4      | Property + org dashboards     | Recharts `<path role="img">` sectors have no alternative text (5 nodes), and the donut has no legend, so the data is unusable to a screen reader. |
| A5      | `/properties/:slug`           | `<div aria-label="4 of 5 stars">` has no role, so the label is **prohibited and ignored** (4 nodes). Use `role="img"`.                            |
| A6      | `/properties/:slug` (390)     | One button has no discernible text (axe `button-name`, critical).                                                                                 |
| A7      | `/properties/:slug`           | Date strip placeholder "Add date" uses `text-muted-foreground/50`, below AA contrast.                                                             |
| A8      | Property dashboard            | A `role="list"` container has non-`listitem` children (5 nodes, critical `aria-required-children`).                                               |
| A9      | Property bookings             | `aria-sort` is placed on a `<button>` (only valid on a columnheader), and two flag chips put `aria-label` on a bare `<span>` (prohibited).        |
| A10     | All admin shells              | The notification count badge (`bg-destructive text-destructive-foreground`) fails AA contrast on every page where it appears.                     |
| A11     | `/admin/ai` (390)             | The horizontally scrollable tab strip is not keyboard focusable (`scrollable-region-focusable`).                                                  |

Also observed but not axe-flagged:

- The booking detail "I manually reviewed…" checkbox has a long paragraph label and a small visual
  target relative to the amber box around it.
- Focus rings are consistent on form controls but not on table rows or card links.

Verified as **fine**: every settings textarea has a `<label for>`; dialogs have titles; the Radix focus
guards flagged by a naive heuristic are correct; marketing images carry alt text; calendar days expose
full names; favourite toggles expose `aria-pressed`; the guest form and guest account pages pass axe
with zero violations.

---

## Rate limiting

### X5. Public reads 429 under ordinary browsing

`get-public-platform-status` is limited to **30 requests/minute per IP** and is called on every page
load. A single admin session plus one extra tab hits it. Logs during this audit:
`HTTP 429 …/get-public-platform-status` on nearly every admin route once the crawl warmed up.

`marketing-themes` also returned 429 while switching between Marketing and other modules.

Consequences: console error noise, and for any host behind a shared office/carrier NAT a real chance
of the branding/maintenance check failing. Raising the per-IP budget, caching the response in
`sessionStorage` for the session, or falling back silently (no console error) would all help.

---

## Loading and empty states

- Skeleton loaders are used and mostly match the final layout (Bookings, Finance, dashboards, Admin).
- The route-level skeletons in `components/skeletons/` are applied; no generic spinners were seen on
  primary routes.
- Empty states are inconsistent: some are icon + one line (good), some are a centered sentence in a
  bordered box (Analytics "No age data"), some are a bare dash (Maintenance status, Reviews
  response), and one is an unbranded page (stay guide no-access).
- Several empty states have no next action ("No peer comparison yet", "No age data for this range
  yet").
- "Importing chats" never resolves (Inbox), which is a stuck loading state rather than an empty one.

---

## Consistency

| Area              | Inconsistency                                                 | Example                                                                                         |
| ----------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Currency          | Editable money is unformatted, read-only is formatted         | `4500` vs `₱4,500.00`                                                                           |
| Dates             | Three formats coexist                                         | `Nov 17 → Nov 18, 2026`, `Nov 17-18, 2026`, `11/17/2026` in inputs                              |
| Module naming     | Nav label vs page title vs route                              | Nav "Messages", page "Messages", route `/inbox`; nav "Pricing & availability", route `/pricing` |
| Plan naming       | Internal vs display                                           | "Business plan" in the sidebar, "Business" in admin, `pro` in code                              |
| Percentages       | Sometimes `40%`, sometimes `40`, sometimes `0 pts`            | Dashboards, attention badges, listing rows                                                      |
| Header actions    | Sometimes a labelled button, sometimes an icon, sometimes "…" | Bookings has both a labelled and an icon-only action                                            |
| Back navigation   | Some pages have "Back to …", others rely on the sidebar       | Booking detail has it, Finance does not                                                         |
| Property identity | Photo chip, name-only chip, or both                           | Property dashboard header vs guest shell                                                        |

---

## Copy

- No em dashes were found in shipped UI strings (good).
- Error copy leaks internals in the guest submit path (see G1).
- Several labels are sentence fragments used as buttons: "View features.", "Manage", "Select".
- "Sorry!" in the submit error toast reads informal next to the technical error above it.
- Empty-state copy is sometimes tutorial-style ("A guided checklist walks you through…") and
  sometimes terse ("No prior reviews."). Pick one voice per surface.

---

## Performance perception (local, indicative only)

- First paint of admin routes was 2.0-3.0s in dev with 2-4s for chart-heavy dashboards. Dev-mode
  timings are not representative, but two things stood out:
  - Chart-heavy routes (Analytics, Finance, both dashboards) refetch on mount plus on range change
    with no visible caching, so switching date presets re-renders everything.
  - Booking detail polls every ~15s and the whole page re-renders; on mobile this caused a visible
    content jump while a form was open.
- Recurring console noise: 2-24 `Failed to load resource: net::ERR_FAILED` per page, mostly external
  images/fonts. It makes real errors hard to spot during development.

---

## Unsaved-changes guard coverage (verified)

| Surface            | Guard works  | Notes                                                           |
| ------------------ | ------------ | --------------------------------------------------------------- |
| Property Templates | yes          | "Save your changes?" with Keep editing / Discard / Save & leave |
| Property Settings  | yes          | same dialog                                                     |
| Guest form         | n/a          | drafts persisted separately                                     |
| Booking edit       | not verified | would need a long edit session                                  |
| Org settings       | not verified | covered by the org subagent                                     |
| Marketing editor   | not verified | heavy canvas flow                                               |
| Admin dialogs      | n/a          | confirm dialogs have no draft                                   |

---

## Suggested systemic fixes (cheapest first)

1. A shared `formatMoney` for inputs and a shared `formatDate` for every surface.
2. A `<MetricBadge value unit>` primitive so a percentage can never render as a count.
3. A `ChartCard` wrapper that always renders a legend and an accessible data table fallback.
4. A persistent `AdminPageSaveBar` with a disabled Save and a dirty pill, instead of a conditional
   button.
5. A single `AccessDenied` / `LinkExpired` screen for every token-gated guest route.
6. A console-error budget in CI: fail a Playwright smoke run if a page logs an unexpected error.
