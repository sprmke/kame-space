---
title: 'Full app UX/UI and functional audit'
status: active
tags: [audit, ux, ui, qa, security, billing]
updated: 2026-11-18
---

# Full app UX/UI and functional audit

Two exploration passes across the running app (local Supabase + Vite). **No product code was
changed.** Local test data, env files and configuration were adjusted only to unblock testing
(documented in [`08-local-dev-and-seed.md`](./08-local-dev-and-seed.md)).

**Phase 1** (breadth): 136 route variants x 2 viewports, every module, both roles, plan tiers,
dark mode, axe-core. **Phase 2** (depth): roles and escalation, billing and payments, listing
lifecycle, settings effectiveness, public pages/SEO, codebase architecture, security, performance,
caching, AI cost, and a 320-2560px responsive matrix.

- App: `http://localhost:5173`, local Supabase `127.0.0.1:54321`, 169 tables, canonical seed
- Accounts: org owner + platform super admin, scoped org admin, property operations, view-only
  viewer, parking staff, parking full, bookings-only custom role, demo guest, brand-new host
- Plans: Business, Free, Starter, Pro, suspended and past-due states
- Viewports: 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920, 2560 plus zoom
- Evidence: 272 automated page loads, 300+ targeted screenshots, axe-core on 12 routes, direct API
  probes, and DB inspection for every money/permission claim

## Module reports

| #   | Report                                                                  | Scope                                                                                                                  |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 01  | [Guest experience](./01-guest-experience.md)                            | Calendar, GAF form, trip, stay guide, showcase, SD form, parking request                                               |
| 02  | [Host dashboard](./02-host-dashboard.md)                                | Org + property dashboards, finance, pricing, maintenance, analytics, templates, public pages, inbox, settings, reviews |
| 03  | [Booking workflow](./03-booking-workflow.md)                            | List, detail, transitions, side effects, activity log                                                                  |
| 04  | [Platform admin](./04-platform-admin.md)                                | `/admin/*`, AI console, health, control coverage                                                                       |
| 05  | [Org + parking host](./05-org-and-parking.md)                           | Org-level modules and the parking vertical                                                                             |
| 06  | [Cross-cutting](./06-cross-cutting.md)                                  | Responsive, accessibility, loading, copy, consistency                                                                  |
| 07  | [Marketing site + guest account](./07-marketing-and-account.md)         | Public marketing pages and `/account/*`                                                                                |
| 08  | [Local dev + seed fidelity](./08-local-dev-and-seed.md)                 | What a fresh clone cannot do out of the box                                                                            |
| 09  | [Roles and permissions](./09-roles-and-permissions.md)                  | Six role shapes, route matrix, escalation tests, plan enforcement                                                      |
| 10  | [Billing and payments](./10-billing-and-payments.md)                    | Pricing, checkout, plan changes, renewals, payouts, refunds, reconciliation                                            |
| 11  | [Listing lifecycle](./11-listings-lifecycle.md)                         | Create, verify, publish, pause, archive, restore, delete                                                               |
| 12  | [Settings and configuration](./12-settings-and-configuration.md)        | Every settings card, platform config, validation                                                                       |
| 13  | [Public pages and SEO](./13-public-pages-and-seo.md)                    | Gallery, editor, publish states, meta, sitemap, soft 404s                                                              |
| 14  | [Codebase architecture](./14-codebase-architecture.md)                  | Scale, schema drift, god files, edge-function sprawl, bundle, types                                                    |
| 15  | [Security review](./15-security-review.md)                              | RLS write bypass, PII exposure, buckets, webhooks, config gaps                                                         |
| 16  | [Performance, caching and cost](./16-performance-caching-and-cost.md)   | Bundle, API volume, payloads, caching, AI unit economics, third parties                                                |
| 17  | [Responsive and interaction](./17-responsive-design-matrix.md)          | 320-2560px, zoom, touch targets, sheets vs dialogs                                                                     |
| 18  | [Remediation backlog](./18-remediation-backlog.md)                      | Every P0/P1 sequenced by risk, with effort and the test that should gate each fix                                      |
| 19  | [Dashboard page inventory](./19-dashboard-page-inventory.md)            | Tier gate matrix, access matrix, cross-cutting dashboard findings                                                      |
| 20  | [Property dashboard pages](./20-property-dashboard-pages.md)            | Every property page, control, filter and save flow                                                                     |
| 21  | [Org dashboard pages](./21-org-dashboard-pages.md)                      | Every org page, control, filter and save flow                                                                          |
| 22  | [Parking dashboard pages](./22-parking-dashboard-pages.md)              | Every parking page, control, filter and save flow                                                                      |
| 23  | [Design system critique](./23-design-system-critique.md)                | Measured type scale, contrast, radius, icons, motion, a11y, copy; 21 systemic changes                                  |
| 24  | [Public and guest design critique](./24-public-guest-design.md)         | Marketing, guest booking, account: page-by-page redesign list                                                          |
| 25  | [Host dashboard design critique](./25-host-dashboard-design.md)         | Org and property dashboards: hierarchy, density, mobile, copy                                                          |
| 26  | [Parking and super admin design critique](./26-parking-admin-design.md) | Parking workspace and the platform panel                                                                               |
| 27  | [Design remediation backlog](./27-design-remediation-backlog.md)        | Every design change, sequenced by impact, with the mobile removals called out                                          |

Screenshots: [`screenshots/`](./screenshots), plus `/tmp/audit/*-screens/` for module captures.

---

## Severity model

| Level  | Meaning                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------- |
| **P0** | Blocks a core task, corrupts data, leaks internals, or loses money. Fix before the next deploy. |
| **P1** | Wrong or misleading information, a dead end in a real flow, or a permission/entitlement gap.    |
| **P2** | Real UX debt: confusing labels, missing states, duplicated or unreadable data.                  |
| **P3** | Polish: spacing, copy, minor consistency.                                                       |

---

## Phase 4 findings (design and UX critique)

A senior-designer pass over the whole product using the design skills in this repo plus the Vercel Web
Interface Guidelines: `ui-ux-pro-max` (priority order and anti-patterns), `design-taste-frontend` (anti-slop
quality bar), `mobile-responsive` (the repo's native gate), `accessibility`, `human-copy`,
`minimal-ui-copy`, and root `DESIGN.md` as the spec to audit against. Four parallel passes (public site and
guest flows, host dashboards, parking and super admin, plus a measured design-system audit), every finding
re-verified in the running app before it was kept.

Detail: [23 design system](./23-design-system-critique.md) · [24 public and guest](./24-public-guest-design.md)
· [25 host dashboards](./25-host-dashboard-design.md) · [26 parking and super admin](./26-parking-admin-design.md)
· [27 design backlog](./27-design-remediation-backlog.md) (65 items).

### The headline

The product is well styled and badly ranked. On the property dashboard there are **48 bordered surfaces,
38 of them above the fold, and zero section headings above the fold**. Type, colour and radius all drift a
little, but the dominant problem is that every card has the same weight, so the number or action that
matters never wins the eye.

### P0

**P4-1. The booking form is behind a sign-in sheet you cannot dismiss, while the home page says "No account
needed."** `/properties/kame-home/form` opens "Log in or sign up" over a blurred form: no close button, no
guest path, Escape does nothing. The home page's booking step says "No account needed."

**P4-2. The guest form pre-fills a different stranger on every load.** Signed in as the demo guest, two
consecutive loads produced "David H. Jones / davidhjones@example.com" and "Chris A. Miller /
chrisamiller@example.com". The form says it will email the GAF to that address, which cannot receive mail.

### P1

**P4-3. Two primary screens cannot be saved or completed on a phone.** Property Settings has no Save,
Discard or saved indicator at 390 (verified twice), on a page nine screens tall with no section nav.
Parking Settings is the same at 4,454px.

**P4-4. The map shows Google's error string to guests.** "Oops! Something went wrong. This page didn't load
Google Maps correctly. See the JavaScript console for technical details." on every listing.

**P4-5. The guest payment numbers do not add up.** Trip: stay ₱7,000 + deposit ₱2,000, paid ₱5,000, no
balance, no refund date. Parking pricing prints `400 − 30 = 270`.

**P4-6. The org bookings table loses its action column at 1440.** Table 1162px in a 1094px wrapper;
`ACTIONS` sits at x=1385-1475.

**P4-7. The Revenue Overview chart is missing below 1024px.** Two chart surfaces at 1440, one at 390.

**P4-8. Chart colours leave the brand.** Property Analytics paints in raw Tailwind sky/emerald/violet/pink;
the rest of the product is teal tokens.

**P4-9. Dark mode was never contrast-audited.** Teal text links measure 3.1:1 on dark cards; the required
marker is 3.4:1 in dark, 3.8:1 in light.

**P4-10. Long pages drop their section navigation on mobile.** Parking Settings 4,454px, admin org detail
6,428px, development detail 7,758px, FAQs 8,728px, all with the rail removed and nothing replacing it.

**P4-11. The mobile More sheet hides destinations.** Messages, Reviews, Notifications, Templates, Analytics,
Marketing, Public Pages, Team, Settings and Help sit below the sheet's visible area with no internal scroll
affordance; the visible sheet ends at the plan card.

**P4-12. Search results look broken.** "From ₱0 / night", "1 homes available", a 404'd card image whose alt
text bleeds across the card, and "Parking in Other".

**P4-13. The guest form's sticky bar covers the pill the guest must tap.** On steps 3 and 4 the Continue bar
sits over "Yes, reserve paid parking" and "Yes, I'm bringing a pet".

### P2 highlights

- 9px and 10px text in 310 places; nine type sizes in one viewport.
- Eyebrows implemented as `<h3>`, so screen readers hear "TELEGRAM, Telegram, AI SERVICES, AI services".
- Every dashboard page carries a subtitle that restates its title.
- Form errors are visible but not announced (`aria-invalid` 0, `aria-describedby` 0).
- No skip link on any page.
- Tables lose their action column at 1024 across bookings and admin.
- The super admin overview is 12 equal KPI cards, three of which are duplicated immediately below.
- Admin org detail is a 70-surface, 3,831-character page at 1440 and a 6,428px stack at 390.
- `Invalid Date` renders in the Approvals table.
- 13 near-identical calendar-conflict notifications with raw `itest-*` ids.
- Property Analytics donuts have no legend and no text alternative.
- Maintenance status shows "-" for 12 of 18 rows (badge gated on Telegram, not completion).
- Raw engineering strings in human UI: `GEMINI_API_KEYS`, `meta-inbox-oauth-*`, `u:<userId>`.

### What holds up

One type family, one teal palette with a tested fill/text split, real focus rings, motion that honours
`prefers-reduced-motion`, no horizontal overflow at 320 on any route measured, layout-matched skeletons,
actionable empty states, and copy with zero AI tells, zero apology language and no em dashes across 3,300
strings.

### Mobile removals recommended

The month grid on the property/parking dashboard, the `Card | Calendar` toggle on mobile bookings, the guest
form's theme toggle and avatar, the third label per form step, duplicate account tiles, `FLAGS` and
`Pending 0`, the duplicate rating in the listing sticky bar, the six unlabelled workflow dots, and the
decorative KPI icon wells. Full list in [27](./27-design-remediation-backlog.md#mobile-removals-explicit).

## Phase 3 findings (dashboard deep dive)

Scoped to dashboard pages: every org, property and parking page, every listing, five plan tiers and
six access shapes. Detail: [19](./19-dashboard-page-inventory.md), [20](./20-property-dashboard-pages.md),
[21](./21-org-dashboard-pages.md), [22](./22-parking-dashboard-pages.md).

### P0

**P3-1. Parking-only teammates cannot use the parking dashboard at all.** The seeded STAFF/VIEWER
parking members have no org membership, and the parking shell resolves through `list-parkings`, which
requires `org.parkings:view`, so every parking route shows "No organization access" (403). See
[22-P0-1](./22-parking-dashboard-pages.md).

### P1

**P3-2. The parking dashboard is hardcoded to empty.** Cash flow, breakdown, transactions and the
calendar are fed `[]` in `ParkingDashboardCalendarSection.tsx` while Finance holds ₱1,400 and 14
bookings. A paying host is told they have no money. [22-P1-2](./22-parking-dashboard-pages.md)

**P3-3. The org bookings list is silently month-scoped.** The org scope renders no date control, no
chip and no label, yet always applies the current month. Bookings outside it are unreachable without
editing the URL. [21](./21-org-dashboard-pages.md)

**P3-4. Parking attention chips and notifications leak property context.** "Pending review" opens
property bookings; the parking feed lists property check-ins, checkouts and refunds. [22-P1-1/6]

**P3-5. Parking approve and complete fire on one click** with no confirmation and no undo, while
cancel and decline do confirm. [22-P1-3]

**P3-6. A live "Finding host" offer cannot be opened** because the booking has no broadcast row; the
list still shows a countdown. [22-P1-4]

**P3-7. A parking Facebook thread is invisible** in the parking inbox (`social-inbox-threads` returns
empty for a conversation that exists). [22-P1-5]

**P3-8. Analytics "Export PDF" is broken** and shows a raw JS error ("Cannot read properties of
undefined (reading 'length')") because the exporter reads `strengths/improvements/avoid` while the
stored review uses `wins/risks/actions`. [19-D3-1](./19-dashboard-page-inventory.md)

**P3-9. OTP-gated saves are blocked when email is unavailable.** Saving a template opens "Verify
template changes", Send OTP returns "Email is not configured" verbatim, and the change cannot be saved.
The same step-up flow guards other sensitive saves. [19-D3-10](./19-dashboard-page-inventory.md)

**P3-10. A new listing's Setup Guide takes over every deep link.** Opening Finance, Bookings or
Analytics on a fresh listing shows the full-page Setup Guide with no visible close; Escape dismisses it
but nothing remembers that. [19-D3-2](./19-dashboard-page-inventory.md)

**P3-11. Paid data is visible on Free; only actions are gated.** Finance, Analytics, Maintenance,
Inbox and Calendar Sync read APIs all return 200 on Free/Starter; only export/import/sync writes carry
`upgradeHook`. If those capabilities are meant to be paid-only, the pages and reads need the gate.
[19 tier matrix](./19-dashboard-page-inventory.md)

**P3-12. Switching to Calendar or Kanban changes the Bookings table's scope permanently.**
Entering those views writes `showCompletedBookings=true&limit=100`, nothing removes it on return, and
the table then shows completed rows with no control to hide them. [20](./20-property-dashboard-pages.md)

**P3-13. The maintenance status badge is gated on Telegram, not completion.** 12 of 18 rows render "-"
including completed items, while the KPI says "Completed 4". [20](./20-property-dashboard-pages.md)

**P3-14. Nightly rates have no upper bound.** `46004500` is accepted and saved. [20](./20-property-dashboard-pages.md)

**P3-15. `?module=` deep links on Notifications do nothing.** All five values render identical content.
[20](./20-property-dashboard-pages.md)

**P3-16. The template Save modal has no Cancel.** When OTP email is unavailable the only other button
is "Discard changes", so the draft can only be lost. [19-D3-10]

**P3-17. Intermittent provider-context crash under HMR.** Public Pages (and once Notifications) hit the
global boundary with `useOrgContext must be used within RequireOrgContext`; not reproduced in eight cold
loads, but the shared settings-completion component uses the non-optional hook. [20](./20-property-dashboard-pages.md)

### P2 highlights

- Review respond with an empty box silently deletes the response ("Response removed"), no confirm.
- Parking pricing accepts and saves a ₱0 nightly rate; book nights have no "Booked" state; base-rate
  maths does not add up.
- Parking settings: Google Maps error panel blocks the map pin; Save is globally disabled when 0
  amenities are selected; slot identity fields are readonly yet marked required.
- Org parkings list still reports 0/₱0/0% for a slot with 7 bookings (server hardcodes zeros).
- Org dashboard revenue (₱44,740) disagrees with Analytics (₱46,550).
- "Ask AI" and Guides are dead ends in Help; Guides tile is mislinked.
- The mobile More sheet gives the module list a 151px window at 320.
- Dashboard exports behave three different ways (chooser + PDF, direct CSV, crash).

## Phase 2 findings (deep dive)

### P0

**D0. The guest form's mobile Continue bar is off-screen.**
On `/properties/:slug/form` the primary action renders **2,100px below the fold** at 390x844 (and
1,300px below at 320x568) because a `transform` left live by `.guest-inner-enter`'s
`animation-fill-mode: both` becomes the containing block for `position: fixed`. The money path has no
visible way to advance on a phone. It only looks correct under `prefers-reduced-motion`, which
disables the animation. See [17-V1](./17-responsive-design-matrix.md).
[screenshots/76](./screenshots/76-guest-form-mobile-bar-offscreen.png)

**D1. Property settings cannot be saved at all on the seeded listing.**
A load-time effect force-syncs capacity to the `2br` unit template (8 adults, 3 children, 1 bathroom),
which violates the Azure North cap (6 adults) on every save. Changing only the description returns
400 "Max adults must be between 1 and 6"; nothing persists, and the effect silently rewrites the
host's saved values. Reproduced directly. Where: `PropertyProfileSettingsSections.tsx:218`.
[screenshots/70](./screenshots/70-settings-save-blocked.png)

**D2. Any team member can read, rewrite or delete bookings through PostgREST.**
The `guest_submissions` RLS policies check membership only, never the permission leaves. A view-only
member PATCHed a booking's `status` to `CANCELLED` and back (204), bypassing the workflow, emails,
PDFs and audit log. The same policies grant DELETE. See [15-S1](./15-security-review.md).

**D3. Every listing authorization action returns 500 after committing.**
Submit, approve and reject all reference `context.user.id`, which does not exist on the listing
context. The state change and activation are already saved, then the handler throws, so hosts and
admins see an error on every successful verification action and a retry answers "not pending review".
See [11-L1](./11-listings-lifecycle.md).
[screenshots/74](./screenshots/74-approval-500-after-commit.png)

**D4. Archived properties are billed but excluded from the quote.**
Checkout selects every property in the org while the quote (and the downgrade path) excludes archived
rows. Reproduced: quote ₱1,378, charge ₱2,400 for the same click. See [10-B1](./10-billing-and-payments.md).
[screenshots/71](./screenshots/71-archived-overcharge-quote.png)

**D5. Property members can promote themselves to Full Access, and scoped org admins can lift their own listing scope.**
`property-team-members` accepts a self `roleId` change to the Full Access template (96 permissions);
`org-team-members` accepts a self `allListings: true`. Both verified as 200 + full permissions.
See [09-R1/R2](./09-roles-and-permissions.md).

**D6. Parking-only teammates cannot reach the parking dashboard.**
`parking-access` returns 200 with all 16 leaves, but the shell resolves through `list-parkings`, which
requires `org.parkings:view`. Every parking route renders "No organization access". See
[09-R3](./09-roles-and-permissions.md).
[screenshots/72](./screenshots/72-parking-rbac-lockout.png)

**D7. The platform "self-serve signups" switch is not enforced.**
With signups off, a new address still creates an account and reaches onboarding. The flag is stored,
displayed and read but never gates signup. See [12-S2](./12-settings-and-configuration.md).

**D8. Renaming a listing breaks every old link.**
The redirect returns a relative `Location`, so the SPA fetch follows it onto the API origin and lands
on the generic list. The UI explicitly promises "Old links keep working". See
[11-L2](./11-listings-lifecycle.md).
[screenshots/73](./screenshots/73-old-slug-broken.png)

**D9. Guest PII is readable by anyone with a booking UUID when access enforcement is off.**
`get-form/:bookingId` returned 48 fields including document URLs to an anonymous caller with only the
anon key. Enforcement is an opt-in env var. See [15-S2](./15-security-review.md).

### P1 highlights

**D10. Prices are per property but shown as a flat monthly price.** Business reads ₱1,439/month;
a 3-property org pays ₱3,690. The current-plan banner and the same plan's card also disagree
(₱1,799 vs ₱1,439), and renewals use the stale snapshot. [10-B4/B5](./10-billing-and-payments.md)

**D11. Past-due orgs can upgrade and the overdue balance disappears.** Fulfillment reactivates and
starts a new period without collecting or carrying the debt. [10-B2](./10-billing-and-payments.md)

**D12. Archiving a plan silently downgrades every subscriber to Free** with no notice and no renewal,
because the cron skips inactive plans. [10-B3](./10-billing-and-payments.md)

**D13. There is no cancel-at-period-end and no proration.** Stopping means an immediate downgrade that
forfeits prepaid time; a mid-cycle change reprices the snapshot with no credit. [10-B9/B10](./10-billing-and-payments.md)

**D14. Payments cannot be traced to what they covered.** No purpose, period, receipt number or
`period_paid_php`; `org_billing_ledger` has zero rows and zero code references. [10-B8](./10-billing-and-payments.md)

**D15. Plan entitlements are not enforced on finance, analytics, maintenance and inbox APIs.** A Free
host can call them directly and get 200. [09-R5](./09-roles-and-permissions.md)

**D16. `ADMIN_ALLOWED_EMAILS` is implicit membership on every tenant.** A test address read a tenant
it never joined, with 96 permissions and no cross-tenant audit row. [09-R4](./09-roles-and-permissions.md)

**D17. Tenant-level overrides exist but cannot be used.** `org_subscriptions.feature_overrides` is read
by entitlements and never written; only 17 global switches exist (payments, email, booking intake and
templates have none). [04 control coverage](./04-platform-admin.md)

**D18. Settings and public pages have no publish control** and no way to take a page offline, while
`config.published` is already in the data model. [13-P1](./13-public-pages-and-seo.md)

**D19. Signups aside, the canonical dataset hides core flows:** a new listing cannot start
verification from the UI (`accessKind === 'owner'` gate), the 2br preset blocks saves (D1), and the
seeded parking members have empty permission arrays. [11-L3, 09-R6](./11-listings-lifecycle.md)

**D20. Performance and cost:** 22 edge calls per property dashboard (with two duplicate keys),
`list-bookings` returns 179 columns (171 KiB for 31 rows), Sentry+PostHog are 90 KiB of the initial
bundle, and Business AI credits can consume 78% of plan revenue. [16](./16-performance-caching-and-cost.md)

**D21. Schema and architecture drift:** 7 tables exist with no migration, there are no generated DB
types, 368 edge functions (151 under 80 lines), and two sources of truth for super admin.
[14](./14-codebase-architecture.md)

**D22. A public payment-receipts bucket** exposes uploaded receipts by URL; invitation tokens are
stored in plaintext. [15-S3/S5](./15-security-review.md)

**D23. Booking import falls back to 100% manual column mapping.** Without a Gemini key the wizard matches 0 of 8 obvious headers and forces manual mapping for every column. [12-S18](./12-settings-and-configuration.md)

---

## Phase 1 findings (baseline)

### P0

1. **Booking transition commits the status even when a required side effect fails.**
   `PENDING_REVIEW → PENDING_DOCUMENTS` returned HTTP 400 ("GAF request PDF could not be generated")
   to the admin, yet `guest_submissions.status` was already `PENDING_DOCUMENTS`. The admin sees an
   error, the guest pipeline has moved, and no GAF PDF and no `booking.status_changed` activity row
   exist. Evidence: edge log 22:43:23 (status write, then `pdfService` failure, then 400). Where:
   `_shared/workflowOrchestrator.ts` around the `generatePDF` + `updateBooking` ordering.

2. **Guest submit leaks internal env var names.** With a missing `IDENTITY_HASH_PEPPER` the toast reads
   "Failed to process form data: IDENTITY_HASH_PEPPER is required".
   [screenshots/18](./screenshots/18-guest-form-submit-internal-error.png)

3. **A fresh local checkout cannot complete the two most important flows.** Two edge secrets are hard
   requirements with no fallback (the `.env.example` comment is wrong) and the `templates` Storage
   bucket is not seeded, so guest submit and every PDF transition fail. See
   [08](./08-local-dev-and-seed.md).

4. **The org Parkings list hardcodes every metric to zero.** `stats: emptyParkingStats()` in
   `_shared/listParkings.ts:44` for a slot with 7 bookings and ₱4,900 revenue.
   [screenshots/60](./screenshots/60-org-parkings-zero-stats.png)

5. **The org dashboard "Total Revenue" is net income** and no two surfaces agree (₱44,390 dashboard,
   ₱46,900 analytics, ₱1,890 parking dashboard, ₱1,400 parking finance).
   [screenshots/61](./screenshots/61-org-analytics-revenue.png)

6. **The Booking Status donut silently drops statuses** (`Total Bookings 13`, donut centre 10).

### P1

7. **Opening a booking detail page writes a fake "copied a guest trip link" audit event.** Merely
   loading `/bookings/:id` produced `booking.trip_link_issued` with summary
   "…copied a guest trip link for Yuri Ibarra". The activity log can no longer be trusted for that
   action. Where: `useBookingTripLink` auto-issues on mount.

8. **Downgrade then upgrade leaves team seats inconsistent, and can deactivate the owner's own
   membership.** After `seed:plan --plan=free` → `--plan=pro`, all property members stayed
   `status=inactive, plan_limited=true` (viewers saw "Access paused, contact your owner to upgrade
   the plan" while the org was on Business). Opening Team as owner reconciled most members but
   flipped **`seed-owner@example.com` (the org owner) to `inactive, plan_limited=true`**, and left
   `manager.demo@example.com` inactive with `plan_limited=false`, so it will never be auto-restored.
   Where: `planEntitlements.ts#reconcileTeamSeatsForOrganization` (owner not excluded from the
   property-member trim; org and property seats reconciled differently).

9. **The property dashboard "Total Bookings" card shows nights, not bookings.**
   `DashboardStatCards.tsx` renders `${nightsBooked} / ${periodDays}` under the title "Total
   Bookings", and the trend arrow uses the _bookings_ change. A host with 6 bookings reads
   "12 / 30".
   [screenshots/01-property-dashboard-desktop.png](./screenshots/01-property-dashboard-desktop.png)

10. **"Low occupancy next 30 days: 42" is a percentage rendered as a count.** The badge sits in the
    same list as "Pending review 5" and "Check-outs today 1", so `42` reads as 42 items. The API
    returns `count: occupancyPct`
    (`_shared/dashboardService.ts:1031`).
    [screenshots/02-org-dashboard-desktop.png](./screenshots/02-org-dashboard-desktop.png)

11. **Read-only teammates are shown actions they cannot perform.** A viewer with only `*:view`
    permissions sees an editable "Door code" input with **Save** and an interactive "I manually
    reviewed…" checkbox on booking detail. The server correctly returns 403 ("Access restricted"),
    so the guard is server-side only; the affordance is wrong.
    [screenshots/35-viewer-booking-readonly.png](./screenshots/35-viewer-booking-readonly.png)

12. **Super-admin approvals show the literal string "Invalid Date".** `/admin/approvals` and the
    Approvals section of `/admin/orgs/:slug` render `Invalid Date` in the SUBMITTED column while the
    dialog shows the raw value. Root cause is the seed writing `…T07:48:17+00` (which `new Date()`
    rejects) plus a formatter that prints "Invalid Date" instead of falling back; production writes
    `toISOString()`, but any imported or legacy value hits the same branch.
    [screenshots/04-admin-approvals-invalid-date.png](./screenshots/04-admin-approvals-invalid-date.png),
    [screenshots/05-admin-org-invalid-date.png](./screenshots/05-admin-org-invalid-date.png)

13. **Marketing "Your creations" render as blank gray boxes.** Seeded `marketing_media_assets` rows
    point at `marketing-media/seed/remote/asset-*`, which do not exist in Storage (bucket listing is
    empty, direct fetch returns 400). Cards show an empty placeholder with no label or fallback.
    [screenshots/14-marketing-studio-blank-creations.png](./screenshots/14-marketing-studio-blank-creations.png)

14. **Parking imagery is missing with no fallback.** The seeded parking photo URL
    (`images.unsplash.com/photo-1590674899484-…`) returns 404, so the parking detail page, the
    parking request form and the org Parkings list show an empty circle/blank hero.
    [screenshots/27-parking-form-broken-avatar.png](./screenshots/27-parking-form-broken-avatar.png)

15. **Free plan shows the full property Analytics dashboard.** On Free, Analytics renders every KPI
    and chart with a single "PRO" pill on Export PDF, while the plans matrix and route guide describe
    Analytics as a Pro feature with a teaser for lower tiers. Either the data should be masked or the
    badge should say what is actually gated.
    [screenshots/33-free-plan-analytics.png](./screenshots/33-free-plan-analytics.png)

16. **Super-admin org hub cards are crushed to 190px** (`/admin/orgs/:slug` Listings / Support /
    Approvals). Stat labels collide ("BookingsRevenue Occupancy"), revenue is clipped, ticket
    subjects reduce to "Cale…", "A…", "H…". Measured card width: 190px in a 1,060px column.
    [screenshots/41-org-hub-crushed-cards.png](./screenshots/41-org-hub-crushed-cards.png)

17. **AI usage numbers contradict each other across four admin surfaces.** Overview shows "AI spend
    $1.13" directly above "No AI usage in this range"; AI → Usage says "Orgs using AI 0 / Credits 0"
    and "Calls 0 · Errors 2 (100%)" while AI → Limits shows 96 calls and 1,300 credits for the same
    month. One aggregate is wrong; an operator cannot decide on credits from this.
    [screenshots/42-admin-ai-contradictions.png](./screenshots/42-admin-ai-contradictions.png)

18. **Parking payout ledger reports ₱0.00 processor fee and ₱0.00 platform net** while the same page
    configures 3.13% + ₱15 and shows a ₱280 commission gap between guest charges (₱2,800) and host
    payouts (₱2,520).
    [screenshots/44-admin-payouts-zero-fees.png](./screenshots/44-admin-payouts-zero-fees.png)

19. **Platform-wide settings cannot be saved when email is unavailable.** Save opens step-up OTP,
    "Send OTP" returns `400 Email is not configured`, and the dialog shows that raw string with no
    retry or alternate path. Every platform setting is frozen in that state.
    Where: `super-admin-verification` + `SuperAdminPlatformSettingsPage`.

20. **System health reports "OK" for a job that returned HTTP 502 and had 3 failed runs**, with every
    job 9 days stale and a grey "Unknown" dot in the same row.
    [screenshots/43-admin-health-jobs-ok.png](./screenshots/43-admin-health-jobs-ok.png)

21. **The parking dashboard and parking pricing calendar show no reservations** while the same slot
    has eight November reservations listed on the bookings page and counted in the KPIs. Cash flow and
    breakdown also render "no data" despite ₱1,890 of revenue.
    [screenshots/53-parking-dashboard-empty-calendar.png](./screenshots/53-parking-dashboard-empty-calendar.png)

22. **The plan price shown is not the price charged.** Marketing and in-app pricing say Business is
    ₱1,799 struck through, 20% off, ₱1,439/month; the billing history shows ₱1,799 paid, with no
    explanation of the difference.
    [screenshots/55-org-plans-billing.png](./screenshots/55-org-plans-billing.png)

23. **The AI assistant is invisible on the plan that sells it.** Business includes "AI dashboard
    assistant", the org setting is enabled, but the platform AI switch is off so no launcher or
    "AI mode" toggle renders and nothing explains why. Same for the greyed-out "AI" / "AI features"
    entries in org Settings.

24. **Reviews → "About guests" says there are no reviews while three exist.** `host_guest_reviews`
    holds 3 rows for the org, but the tab renders "No guest reviews written yet", so hosts cannot see
    or edit their own guest reviews.
    [screenshots/62-reviews-about-guests-empty.png](./screenshots/62-reviews-about-guests-empty.png)

25. **A paid host cannot manage their subscription.** "Manage subscription" only switches to the Plans
    tab; there is no billing portal, payment-method update, invoice download or cancellation anywhere
    in the plans feature.

26. **Parking notifications attribute the wrong guest and leak import IDs.** A row titled
    "Rafa Mercado" reads "June Vale requested 3 nights at Monaco 2604", and one row prints
    `itest-f4a390de`.
    [screenshots/65-parking-notifications-wrong-guest.png](./screenshots/65-parking-notifications-wrong-guest.png)

27. **The mobile "More" sheet gives navigation a 268px window**, so Properties and Parkings are hidden
    until the user scrolls past the plan card and account footer.
    [screenshots/64-mobile-more-sheet-cramped.png](./screenshots/64-mobile-more-sheet-cramped.png)

28. **The ticket composer discards drafts with no warning**, and its mobile sheet has no close control
    at all.

### P2 (highlights, full list per module)

29. Donut charts on Analytics and both dashboards have no legend or labels. "Where bookings come
    from" is a ring with no categories at all. Finance does show a legend, so the pattern exists.
    [screenshots/10-property-analytics-no-legends.png](./screenshots/10-property-analytics-no-legends.png)
30. Occupancy percentage is printed twice per listing row in the org dashboard "Listings
    Performance" card (inline meta and under the progress bar).
31. The fixed cookie banner covers the sidebar account menu at 1440x900 until dismissed.
32. Long admin pages (property Settings, Notifications) are entirely desktop-oriented: below `lg`
    the section rail disappears and the page becomes one very long scroll with no jump list.
    [screenshots/25-settings-mobile-long-page.png](./screenshots/25-settings-mobile-long-page.png)
33. The org sidebar nav clips the last item ("Settings") behind the Verification card at 900px
    height; the account block overlaps the cookie banner.
34. `get-public-platform-status` allows 30 requests/minute per IP and is called on every page load.
    Normal admin browsing plus one extra tab hits 429 and logs console errors. Same for
    `marketing-themes` (429 while switching modules).
35. The stay guide "no access" state is an unbranded gray card on white, unlike every other guest
    state.
    [screenshots/28-stay-guide-no-access.png](./screenshots/28-stay-guide-no-access.png)
36. The developer controls panel is rendered inside the guest payment step in any non-production
    build, so preview deployments expose "Save data / Send email / Generate New Data" to real testers.
37. **Seeded audit rows pair the wrong title with the action key**, so every super-admin demo shows
    "Replied to a support ticket" on a row recording a host verification approval. Seed bug, with no
    UI guard against a mismatched summary.
    [screenshots/40-admin-audit-wrong-labels.png](./screenshots/40-admin-audit-wrong-labels.png)
38. **Admin mobile filter strips clip at the right edge** on seven list pages, and the org hub section
    rail is hidden entirely at 390px (6,317px single scroll).
    [screenshots/45-admin-mobile-filter-clip.png](./screenshots/45-admin-mobile-filter-clip.png)

### P3 (highlights)

39. Finance mobile cash-flow chart: top axis tick renders `10k` while the rest render `₱8k`, `₱5k`.
40. Money inputs show `4500` while read-only values show `₱4,500.00` (no grouping in inputs).
41. Booking detail mobile stacks three levels of chrome ("Monaco 2604" switcher, "Booking" title,
    "Back to Bookings").
42. Guest calendar/form are a narrow centered card at 1440 with large empty margins and no price
    preview.
43. `get-sd-form` returns 404 for a booking in `PENDING_SD_REFUND` when opened without the emailed
    token, and the empty state offers only "Back to home".
44. Property dashboard "Bookings" count and org dashboard "Total Bookings" disagree by design
    (nights vs rows) but use the same words.

---

## What is genuinely good

- The booking workflow UI (stepper, nested sub-steps, confirm modal copy that lists exact side
  effects, past-date email checkboxes) is best-in-class for this kind of app.
- The trip page is a strong guest artifact: request state, next steps, host card, directions,
  parking hand-off, all on one screen.
- Unsaved-changes guards work on Templates and Property Settings (Save appears when dirty, guard
  offers Keep editing / Discard / Save & leave).
- Dark mode is consistent and readable across list, dashboard and forms (one dark-mode pass).
- Mobile bottom navigation and the card/list split are well executed; no horizontal scroll was found
  on any tested route at 390px.
- Role gating is enforced server-side even where the UI leaks affordances (viewer writes 403).
- Activity logging exists and is populated for guest submit, booking edits, trip links and
  transitions, which made this audit possible.

## Coverage

See each module report for the per-route table. Untested or partially tested:

- Onboarding step 3 (verification) and post-onboarding setup guide: stopped before creating real
  verification documents.
- Meta OAuth, Resend inbound, PayMongo checkout, Telegram delivery, Gemini calls: no real
  credentials locally; only their unconfigured states were reviewed.
- Native PWA install flow and Web Push: service worker is disabled under Vite dev by design.
- Email rendering: no provider, so only the send-attempt code paths were observed.

Aggregate numbers from this pass: 136 route variants, 272 page loads (1440x900 + 390x844), 0 empty
renders, 0 unhandled JS exceptions, 54 curated screenshots kept in
[`screenshots/`](./screenshots), axe-core run on 12 routes at both viewports.

## Screenshot gallery (reference)

Strongest surfaces and the clearest visual defects. Every image is a 1440x900 desktop capture unless
the filename says mobile.

| Image                                                                                                    | What it shows                                                                      |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [06-booking-detail-review.png](./screenshots/06-booking-detail-review.png)                               | Booking detail, Pending Review gate, step deck, guest view                         |
| [07-property-finance-desktop.png](./screenshots/07-property-finance-desktop.png)                         | Property finance: KPIs, cash flow, donut with legend (the pattern the others lack) |
| [08-property-pricing-desktop.png](./screenshots/08-property-pricing-desktop.png)                         | Pricing calendar with rate pills and the fees rail                                 |
| [09-property-maintenance-desktop.png](./screenshots/09-property-maintenance-desktop.png)                 | Maintenance list: mixed status pills and dashes                                    |
| [11-property-templates.png](./screenshots/11-property-templates.png)                                     | Templates editor before dirty state (no Save visible)                              |
| [13-inbox-thread.png](./screenshots/13-inbox-thread.png)                                                 | Inbox thread, composer, "7h 17m left" reply window                                 |
| [17-guest-form-desktop.png](./screenshots/17-guest-form-desktop.png)                                     | Guest form step 1 at 1440 (narrow card, empty margins)                             |
| [19-guest-trip-after-submit.png](./screenshots/19-guest-trip-after-submit.png)                           | Trip page immediately after a real submit                                          |
| [20-guest-home-mobile.png](./screenshots/20-guest-home-mobile.png)                                       | Marketing home at 390                                                              |
| [22-guest-form-mobile.png](./screenshots/22-guest-form-mobile.png)                                       | Guest form at 390 with "Guest 1/5" progress                                        |
| [23-bookings-mobile.png](./screenshots/23-bookings-mobile.png)                                           | Bookings list at 390: 2x2 stage cards, card view                                   |
| [24-booking-detail-mobile.png](./screenshots/24-booking-detail-mobile.png)                               | Booking detail at 390: stacked chrome                                              |
| [30-404.png](./screenshots/30-404.png)                                                                   | Branded 404                                                                        |
| [31-dark-mode-bookings.png](./screenshots/31-dark-mode-bookings.png)                                     | Dark theme on a dense table                                                        |
| [32-page-editor-showcase.png](./screenshots/32-page-editor-showcase.png)                                 | Page editor: templates, live preview, device toggle                                |
| [34-onboarding.png](./screenshots/34-onboarding.png)                                                     | New host onboarding, step 1 of 3                                                   |
| [46-admin-org-hub-mobile.png](./screenshots/46-admin-org-hub-mobile.png)                                 | Org hub at 390 with no section rail                                                |
| [47-admin-edit-pro-dialog.png](./screenshots/47-admin-edit-pro-dialog.png)                               | "Edit pro" dialog for the Business plan                                            |
| [49-parking-detail-blank-hero.png](./screenshots/49-parking-detail-blank-hero.png)                       | Public parking detail with the 404 hero                                            |
| [50-host-profile-seed-copy.png](./screenshots/50-host-profile-seed-copy.png)                             | Public host profile showing "Hosted by seed-owner"                                 |
| [51-guest-help-empty.png](./screenshots/51-guest-help-empty.png)                                         | Guest help empty state                                                             |
| [52-account-trips.png](./screenshots/52-account-trips.png)                                               | Account trips list                                                                 |
| [54-parking-bookings.png](./screenshots/54-parking-bookings.png)                                         | Parking bookings with marketplace statuses                                         |
| [56-org-settings.png](./screenshots/56-org-settings.png)                                                 | Org settings with disabled AI entries                                              |
| [57-notifications-panel.png](./screenshots/57-notifications-panel.png)                                   | Notification panel                                                                 |
| [66-team-counts.png](./screenshots/66-team-counts.png)                                                   | Team KPIs that do not reconcile                                                    |
| [67-org-plans-discount.png](./screenshots/67-org-plans-discount.png)                                     | Plans page with the unapplied 20% promo                                            |
| [68-org-bookings-no-kanban.png](./screenshots/68-org-bookings-no-kanban.png)                             | Org bookings view switcher without a board                                         |
| [75-checkout-503.png](./screenshots/75-checkout-503.png)                                                 | Checkout with no provider configured: generic toast, failed row                    |
| [77-more-sheet-320.png](./screenshots/77-more-sheet-320.png)                                             | More sheet at 320: 3 of 15 modules in a 151px window                               |
| [78-admin-org-1024.png](./screenshots/78-admin-org-1024.png)                                             | Admin org hub at 1024: MRR truncated                                               |
| [79-bookings-1024.png](./screenshots/79-bookings-1024.png)                                               | Bookings table at 1024 with hidden horizontal scroll                               |
| [80-home-320-overflow.png](./screenshots/80-home-320-overflow.png)                                       | Guest home at 320: showcase clipped                                                |
| [81-analytics-export-error.png](./screenshots/81-analytics-export-error.png)                             | Analytics Export PDF: raw JS error toast                                           |
| [82-parking-dashboard-empty-cards.png](./screenshots/82-parking-dashboard-empty-cards.png)               | Parking dashboard: hardcoded empty cards                                           |
| [83-parking-inbox-empty.png](./screenshots/83-parking-inbox-empty.png)                                   | Parking inbox: hidden Facebook thread                                              |
| [84-parking-settings-save-disabled.png](./screenshots/84-parking-settings-save-disabled.png)             | Parking settings: global Save disabled with 0 amenities                            |
| [85-setup-guide-overlay.png](./screenshots/85-setup-guide-overlay.png)                                   | Setup Guide blocking a dashboard deep link                                         |
| [86-template-save-otp-error.png](./screenshots/86-template-save-otp-error.png)                           | Template save: "Email is not configured"                                           |
| [87-free-tier-analytics-visible.png](./screenshots/87-free-tier-analytics-visible.png)                   | Free tier: full analytics visible, export gated                                    |
| [88-mobile-plans-upgrade-ticket.png](./screenshots/88-mobile-plans-upgrade-ticket.png)                   | Mobile Plans: "Upgrade" opens a support ticket                                     |
| [89-mobile-dashboard-calendar-pills.png](./screenshots/89-mobile-dashboard-calendar-pills.png)           | Mobile dashboard: calendar pills truncate to `• R…`                                |
| [90-mobile-bookings-stage-cards.png](./screenshots/90-mobile-bookings-stage-cards.png)                   | Mobile bookings: 300px of stage cards before the first row                         |
| [91-guest-form-redundant-labels.png](./screenshots/91-guest-form-redundant-labels.png)                   | Guest form: three labels for one step, host chrome in the header                   |
| [92-listing-host-truncated.png](./screenshots/92-listing-host-truncated.png)                             | Listing: `Hosted by Kame Spa…` truncates mid-word                                  |
| [93-admin-twelve-cards-usd.png](./screenshots/93-admin-twelve-cards-usd.png)                             | Admin overview: 12 equal KPI cards, USD mixed into PHP                             |
| [94-dark-mode-link-contrast.png](./screenshots/94-dark-mode-link-contrast.png)                           | Dark mode: teal "View" links at 3.1:1                                              |
| [95-parking-dashboard-desktop.png](./screenshots/95-parking-dashboard-desktop.png)                       | Parking dashboard: attention band (good) above two empty panels                    |
| [96-admin-overview-mobile-twelve-cards.png](./screenshots/96-admin-overview-mobile-twelve-cards.png)     | Admin overview at 390: six rows of KPI cards                                       |
| [97-admin-approvals-invalid-date.png](./screenshots/97-admin-approvals-invalid-date.png)                 | Approvals: `Invalid Date` and two status pairs in one cell                         |
| [98-admin-organizations-mobile-truncated.png](./screenshots/98-admin-organizations-mobile-truncated.png) | Organizations at 390: description cut to `approvals, an…`                          |
| [99-parking-settings-390-no-save.png](./screenshots/99-parking-settings-390-no-save.png)                 | Parking settings at 390: no Save, no section nav                                   |
| [100-bookings-1024-clipped-actions.png](./screenshots/100-bookings-1024-clipped-actions.png)             | Bookings at 1024: `ACTIONS` off-screen                                             |
| [101-guest-form-auth-wall.png](./screenshots/101-guest-form-auth-wall.png)                               | Guest form: non-dismissible sign-in sheet                                          |
| [102-listing-map-error.png](./screenshots/102-listing-map-error.png)                                     | Listing: Google Maps error text shown to guests                                    |
| [103-host-tour-mock.png](./screenshots/103-host-tour-mock.png)                                           | `/for-hosts` tour mock with blank panels                                           |
| [104-pricing-carousel-opens-on-business.png](./screenshots/104-pricing-carousel-opens-on-business.png)   | Pricing carousel opens on Business, no counter                                     |
| [105-account-profile-duplicate-nav.png](./screenshots/105-account-profile-duplicate-nav.png)             | Account: dual navigation, no h1, summary + form duplicating data                   |
| [106-mobile-more-sheet-truncated.png](./screenshots/106-mobile-more-sheet-truncated.png)                 | Mobile More sheet: 9 destinations below the visible sheet                          |
| [107-revenue-chart-missing-390.png](./screenshots/107-revenue-chart-missing-390.png)                     | Org dashboard at 390: Revenue Overview chart card is header-only                   |

## How to reproduce

Everything below was local only. Nothing was deployed.

```bash
# 1. Stack
bun install
./dev.sh                     # or: SKIP_NGROK=1 ./dev.sh

# 2. Seed + plan
bun run db:reset
bun run seed:plan -- --plan=pro
bun run seed:attach-admin

# 3. Sign in without OAuth (any seeded account, password `seed-password`)
curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: <local anon key>" -H "Content-Type: application/json" \
  -d '{"email":"seed-owner@example.com","password":"seed-password"}'
# then in the browser console:
# localStorage.setItem('sb-127-auth-token', JSON.stringify(<that response>))

# 4. Full crawl (screenshots + console + network + overflow)
node /tmp/audit/crawl.mjs        # routes in /tmp/audit/routes.json
node /tmp/audit/analyze.cjs      # summary of flagged routes

# 5. Accessibility
node /tmp/audit/axe.mjs          # writes /tmp/audit/axe.json
```

The audit scripts lived in `/tmp/audit` and are intentionally not committed. They are small enough to
recreate from the method described above if the team wants them in `scripts/`.
