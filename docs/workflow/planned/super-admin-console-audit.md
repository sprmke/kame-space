---
stage: planned
title: 'Super Admin console — audit findings and UX backlog'
status: planned
tags: [planning, planned-modules, super-admin, admin, audit, ux, accessibility, mobile]
updated: 2026-11-21
---

# Super Admin console: audit findings and UX backlog

Full pass over every `/admin` route on the **local stack only**. No production data was read or
written. The result is a ranked register of defects, accessibility failures, mobile layout
problems, and product/UX improvements. Nothing here is implemented yet.

Related plans: [`super-admin-console-followups.md`](./super-admin-console-followups.md) (net-new
modules), [`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md)
(cost control). This document is about **what already ships and is wrong or weak**.

## How the audit was run

| Item          | Detail                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment   | Local only. UI `http://127.0.0.1:5179`, Supabase `127.0.0.1:54321`, Docker stack already running (nothing stopped or reset)                                                                                                |
| Identity      | Local super admin `sprmke.dev@gmail.com` (email is on local `SUPER_ADMIN_EMAILS`). A local password was set on that seeded auth user so Playwright could mint a session. No other local record was modified                |
| Coverage      | 33 real routes + 4 legacy/404 checks, each at 1440x900 and 390x844 (70 page loads), plus 18 interaction and dialog checks, dark mode on 6 pages, forced 500 on every edge call, and a 4s edge delay for skeleton behaviour |
| Tooling       | Playwright (Chromium), `axe-core` WCAG 2.1 A/AA on every page and on the main dialogs, console and network capture, layout measurements in the DOM                                                                         |
| Data volume   | Thin local seed: 1 org, 1 property, 1 parking, 1 development, 5 tickets, 3 announcements, 7 plans. Rich-state list behaviour (long pagination, many plans) is inferred from code, not photographed                         |
| Not exercised | PayMongo checkout, Resend sends, Meta OAuth, Google OAuth, OTP email delivery, production-only Vault secrets                                                                                                               |

Nothing in the sweep produced an uncaught console error except the React duplicate-key warning on
System health.

## Severity

| Level  | Meaning                                                      |
| ------ | ------------------------------------------------------------ |
| **P0** | Blocks work or shows wrong money/state to an operator        |
| **P1** | Broken or misleading in normal use                           |
| **P2** | Noticeable friction, a11y failure, or inconsistent behaviour |
| **P3** | Polish, copy, density, dead code                             |

---

## 1. P1 defects

### D-01. Approval dates render "Invalid Date" (and raw ISO in the dialog)

**Where:** `/admin/approvals` (table and card grid), `/admin/orgs/:slug` approvals cards, the
approval review dialog.
**Evidence:** the queue returns timestamps in `2026-11-16T19:21:40+00` form. `new Date(...)` returns
Invalid Date for that offset (no minutes), so `formatSubmittedDate`
(`components/super-admin-approvals/SuperAdminApprovalsTable.tsx:65`) prints **Invalid Date**. The
dialog helper (`SuperAdminApprovalDialogLayout.tsx:25`) has a NaN guard but returns the **raw ISO
string** instead, so the dialog shows `Submitted 2026-11-16T19:21:40+00`. The org hub cards show the
same failure and truncate it to "Invalid …".
**Fix:** one shared super-admin date formatter that (a) normalises `+00` to `+00:00` or `Z`, (b)
validates with `Number.isNaN`, (c) falls back to an em dash. Delete the two divergent local helpers.
Worth also normalising these JSONB timestamps server-side on write.

### D-02. A failed capability query is reported as "Access restricted", and it blocks the whole shell

**Where:** `RequireSuperAdmin.tsx`, used by `SuperAdminShell`.
**Evidence:** forcing a 500 on `list-organizations` renders **Access restricted** with only a
**Sign out** button, even though the user is a valid super admin and the call simply failed.
Separately, delaying that one call by 4s shows a full-screen brand splash for every route: no
sidebar, no page frame, no skeleton, because the guard resolves before any chrome paints.
**Impact:** a transient network error looks like a permissions problem and pushes the operator to
sign out. Flaky edge cold starts make the console feel like it is not loading.
**Fix:** distinguish `error` from `denied`; on error show a retry surface. Render the admin shell
plus the route skeleton while `isSuperAdmin` resolves (keep the page guard, drop the full-screen
blocking dependency), or cache the capability for the session.

### D-03. Six list tables destroy their table semantics with `role="link"` on `<tr>`

**Where:** approvals, support tickets, announcements, developments, properties, hosts
(`role="link"` on the row, 6 occurrences, all under
`ui/src/features/dashboard/super-admin/components/**`).
**Impact:** assistive tech stops seeing a table: rows are announced as links, cells are orphaned.
Axe does not flag it, so it will not show up in CI.
**Fix:** keep `role="row"` and put a real link or button in the first or last cell (visually the
whole row can still be clickable). This is the pattern `AdminDataTable` should own.

### D-04. Developments and Properties filter selects have no accessible name (axe critical)

**Where:** `SuperAdminPlatformPropertiesToolbar.tsx` (3 triggers) and
`SuperAdminDevelopmentsToolbar.tsx` (2 triggers). Support, approvals, announcements and pricing
already pass `aria-label`; these two do not.
**Evidence:** `button-name` critical on both pages, desktop and mobile.
**Fix:** add `aria-label="Filter by status"`, `"Filter by type"`, `"Filter by development"` to match
the other toolbars.

### D-05. System health produces duplicate React keys and duplicate rows

**Where:** `/admin/health/configuration` and `/admin/health/jobs`.
**Evidence:** console error `Encountered two children with the same key … env.edge.MARKETING_TRENDS_CRON_SECRET`
and `db.vault.parity.MARKETING_TRENDS_CRON_SECRET`.
**Root cause:** `SCHEDULED_JOBS` contains two jobs that share one `secretEnv`
(`marketing-trends-cron` and `marketing-trends-weekly-cron`), and both `envRegistry.ts` and
`systemHealth/snapshotChecks.ts` map jobs one-to-one into checks keyed by env var. The same secret is
rendered twice and keyed twice.
**Fix:** dedupe the derived checks by key (merge the feature labels), or key by job id and group the
shared secret.

### D-06. An unknown `/admin/*` URL leaves the console

**Where:** routing. `/admin/does-not-exist` renders the **public marketing 404** (public header,
public footer, "Become a host"), not an admin-scoped 404.
**Impact:** the operator loses the console navigation and lands in a guest surface while signed in
as super admin.
**Fix:** add a `*` child route inside `/admin` that renders an admin empty state with a link back to
Overview.

## 2. P2 defects and inconsistencies

### D-07. Detail pages for missing records are bare text

`/admin/orgs/<bad>`, `/admin/developments/<bad>`, `/admin/hosts/<bad>` and
`/admin/ops-reports/<bad>` render one unstyled line ("Organization not found.", "Invalid report
id") with no heading, no back link, and no use of `SuperAdminEmptyState`, which already exists.
Fix: shared not-found state with an icon, the requested id, and a back link.

### D-08. Organizations table rows look clickable but mostly are not

`SuperAdminOrgsPage.tsx` sets `className="cursor-pointer"` on `<TableRow>` but attaches no handler.
Only the org name link and the chevron are interactive. The mobile cards are fully linked, so the
desktop and phone behaviours disagree.
Fix: make the row a link (with `role="row"` preserved, per D-03) or drop `cursor-pointer`.

### D-09. "Cost by feature" renders empty axes for zero values

`/admin/ai?tab=usage`: the horizontal bar chart draws axes, a category label, and no bars when every
`featureBreakdown.costUsd` is 0. Measured: 0 bar rectangles in the DOM. The sibling "Spend over time"
chart and the Spend KPI both show about $1.07 for the same range, and Overview says **"No AI usage in
this range"** for the same data.
This is two problems: the chart needs a zero/empty state instead of an empty plot, and the usage
aggregations disagree (`dailySeries` non-zero, per-feature `costUsd` zero, `orgsUsingAi` 0). Confirm
whether feature attribution is missing from the seeded/event rows before changing the chart.

### D-10. Operations report detail has an empty "Sources" section

`/admin/ops-reports/:id` renders the heading **Sources** with nothing under it, then Agent prompt and
Full Markdown. Either drop the heading when the list is empty or show a "No sources recorded" line.

### D-11. Org activity tabs point `aria-controls` at a panel that never renders (axe critical)

`SuperAdminOrgActivitySection.tsx` uses `Tabs`/`TabsList`/`TabsTrigger` but renders the panel
conditionally outside `TabsContent`. Radix emits `aria-controls="radix-…-content-platform"` for a
node that does not exist. Fix: render both `TabsContent` panels (they are cheap) or drop the
`Tabs` primitives and use a segmented control.

### D-12. Operations reports routes are declared twice

`ui/src/features/dashboard/super-admin/routes/index.tsx` defines `ops-reports` and
`ops-reports/:reportId` twice in the same `<Route>` tree. React Router tolerates it, but it is dead
copy and will drift. Remove the duplicate block.

### D-13. Raw ISO timestamps leak into human summaries

The audit log summary reads "Generated operations report for 2026-11-15T16:00:00+00:00 to
2026-11-22T16:00:00+00:00". Marketing trends run headers print `2026-11-20` raw. Super-admin copy
should show local (Asia/Manila) dates, or relative time, never machine timestamps.

### D-14. System health jobs show contradictory state

Every job row says **pg_cron not available** while its status dot reads OK/Unknown and the summary
says "Live checks 12d ago". The page never says "this environment has no pg_cron", so the operator
cannot tell whether the jobs are healthy or not running.

### D-15. AI plan and profile labels collide, and raw codes leak

`/admin/ai?tab=limits` shows Plan **Pro** next to Profile **business_plus**, and
`/admin/ai?tab=profiles` shows "Pro / growth", "Business / pro", "Business Plus / business_plus",
"Commission / commission". "Plan" and "AI profile" are different concepts with near-identical
names, and the profile badge prints the database code. Use the human profile name in the badge and
add a short column description (or a legend) so Plan and Profile are not confused.

### D-16. Rate limits exposes internal input syntax

`/admin/rate-limits` "Manual block" placeholder is `u:… or ip:…`. The operator has to know the
prefix grammar. Replace with a labelled "User or IP address" field plus validation, or a segmented
User/IP control.

### D-17. Column header "OPEN" labels a bare icon

Properties, developments, hosts, announcements and support all end with a column headed **OPEN**
(or **REVIEW**) wrapping only a chevron/arrow. Use an empty header with an `aria-label` on the link,
or label the column "View".

### D-18. Status badge casing is inconsistent

Properties and developments render `ACTIVE` (uppercase pill with a dot); support, approvals,
hosts and announcements render `Active`. Pick one token.

### D-19. Ops report detail duplicates the copy action

Header has **Copy agent prompt**, then the Agent prompt section repeats a **Copy** button. Keep one.

### D-20. Dead export and stale comment

`SUPER_ADMIN_PLATFORM_DESTINATIONS` in `lib/superAdminPlatformNav.ts` has no consumer, and the file
comment still describes an "Overview quick-links grid" that no longer exists. Remove both, or wire
the grid back.

## 3. UX and information architecture

### U-01. The command palette cannot navigate the console

`Cmd/Ctrl+K` opens a palette that searches orgs, properties, parkings and tickets only. Typing
"audit", "pricing", "health" returns **No matches**. There are 32 destinations, 7 of them hidden
below the sidebar fold, and no way to jump by name. Add a static destination group (from
`SUPER_ADMIN_NAV_GROUPS`), then entity results, plus a footer with keyboard hints.

### U-02. Seven of sixteen sidebar destinations start below the fold

Measured at 1440x900: nav `scrollHeight` 1163 vs `clientHeight` 679. Hidden until scroll:
Marketing trends, Operations reports, AI, Rate limits, Audit log, Platform settings, Feature
availability. macOS hides the scrollbar, so the Platform group looks absent.
Options: collapse the four groups (accordion, remember state), reduce row height, or move rarely
used platform tools behind a "More" affordance. The phone "More" sheet already does this well.

### U-03. The consumer cookie banner runs on the super admin console

`CookieConsentBanner` is mounted globally in `App.tsx`. On `/admin` it overlays the sidebar footer
and the bottom of every page (70px desktop, 136px on a phone) until a choice is saved, and on
Platform settings it covers the floating "View activity" button.
Options: hide it inside `/admin` and `/bookings` (analytics consent can be collected on guest and
marketing surfaces), or move it to a small one-line strip that does not overlay content.

### U-04. Filter and tab rows scroll horizontally with no affordance (8 of 11 list pages)

All these rows use `overflow-x-auto` with the scrollbar hidden
(`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`). Measured at 390px:

| Page                       | Controls clipped past the viewport                      |
| -------------------------- | ------------------------------------------------------- |
| Support tickets            | category (448), status (608)                            |
| Approvals                  | type (448), status (608)                                |
| Announcements              | severity (448), status (608)                            |
| Properties                 | status (432), type (592), development (776)             |
| Developments               | status (432), type (592)                                |
| Pricing plans              | status (432)                                            |
| Subscriptions              | plan (448)                                              |
| AI (Limits)                | search + 3 filters (different layout, not clipped)      |
| AI sub-nav, Health sub-nav | last tab(s) off-screen (AI Controls, Health Jobs/Usage) |

The rows are swipeable, so filters are reachable, but they are cut mid-word and there is no fade,
dot indicator, or scrollbar, which reads as a broken layout. Per the mobile-native rules these
should wrap or collapse into a filter sheet (`AdminListRefineSheet`).

### U-05. AI Wallets is a blank page with a slug lookup

The whole tab is "Org ID or slug" + Load. There is no list of wallets, no balance overview, no
ledger, and no way to find an org without already knowing its slug. Make it a table of orgs with
balance, month spend and last adjustment, with search, and open the top-up/adjust sheet from the row.

### U-06. Audit log is read-only in the weakest sense

It offers a free-text search and a page size. There are no filters for action, category, actor,
target type, or date range, and rows cannot be expanded, so the recorded metadata (before/after,
reason, target id) is unreachable. Summaries are sometimes mismatched with their action (see the
local rows: "Approved host verification" with `org_subscription_changed` / `property`, "Updated
platform support settings" with `feature_availability_updated` / `pricing_plan`).
Minimum: action/category and date filters, an expandable row with the metadata JSON, and a target
deep link (org, host, property) where one exists.

### U-07. Raw cron triggers are primary buttons

`/admin/pricing/subscriptions` puts **Run Superhost cron** and **Run billing cron** next to the page
title, with no description of what they do, no confirmation, no dry run, and no result feedback.
They look like ordinary actions. Move them under a "Billing tools" card with an explanation, last
run time and outcome, and confirm before running.

### U-08. Host detail is too thin to be useful for support

`/admin/hosts/:hostId` shows three counts and a card per org. There is no plan, verification status,
join date, last activity, or contact action, and the host's email is the only identifier. This is the
page a support operator opens first.

### U-09. Org hub cards truncate identifiers and misuse the red pill

The approvals cards render `Mona…`, `Azur…` and "Property + Parking · Invalid …" with no tooltip.
The AI limits section marks every override with a **red** pill, which reads as an error; overrides
are normal configuration.

### U-10. Approvals KPI row mixes status counts and type counts

"In review 1", "Org verifications 1", "Listing verifications 2", "Reviews 0" are two different
axes. Read as a set, they look inconsistent with "Showing 1 of 1". Add a one-line explanation or
split them into status tiles and type tabs.

### U-11. Ops reports list is sparse and hides delivery state

Every badge is rendered even at zero (`CRITICAL 0`, `HIGH 0`, `MEDIUM 0`), cards waste vertical
space, there are no filters or pagination, and `email_sent_at`/recipients (already stored) are not
shown. Add a "Sent to …" line, collapse zero badges, and filter by status.

### U-12. Pricing plan dialog hides most of its form

The body is 1273px tall inside a 670px dialog with a hidden scrollbar, and the screenshot cuts off
the "Team members" field exactly at the footer. Make the dialog taller/wider with two columns, show a
scroll affordance, and add field hints (discount 0 to 100, list price vs host price).

### U-13. "Add announcement" mixes create with navigation

The split button opens Platform announcement (create) and Development announcement (which just
navigates to Developments). A creation affordance that navigates elsewhere is surprising. Keep the
create action single-purpose and put the development shortcut on the Developments page.

### U-14. Rate-limit configuration lives in two places

`/admin/rate-limits` shows "Enforcement is OFF" and a "Change in Platform settings" button, while the
actual numbers live on `/admin/platform-settings`. Either move the whole rate-limit block here or
inline the enforcement toggle with a clear note.

### U-15. FAQ and Playbook lists lack search and filters, and synced rows still show Edit

31 FAQs and 17 articles in one long page, grouped but not searchable or filterable. The plan slug is
shown as secondary text, which is developer noise. Synced FAQ rows keep an enabled pencil even
though every field inside is read-only.

### U-16. Error states leak server text and offer no recovery

Forcing 500s: Overview and System health print the raw server string (`boom`); support, audit and AI
print "Could not load …" with no retry. Add a retry button to `SuperAdminPage` error states and
never render the raw API message.

### U-17. Default page size 31 reads like a bug

Every list defaults to 31 rows per page. It is intentional and documented, but the selector showing
"31" next to a chevron looks like a truncated number. 25 (or 20/50/100) is the conventional set.

### U-18. Approval review with no documents gives no guidance

The dialog shows two large "Not provided" placeholders while Approve is enabled. State why the
documents are missing and whether approval is allowed without them.

## 4. Accessibility

| ID   | Finding                                                                                                                                                                 | Where                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| A-01 | Brand teal used as text is 2.97:1 on white (`#24a88e`). Fails 4.5:1 for normal text. Affects links (`Azure North Residences`), badge text, "Check now"/"View all" links | health usage/integrations, properties, marketing trends, support |
| A-02 | Recharts donut sector and health status icons are `role="img"` without a title (`svg-img-alt`, serious)                                                                 | overview, health                                                 |
| A-03 | `role="link"` on table rows (see D-03)                                                                                                                                  | 6 list pages                                                     |
| A-04 | Invalid `aria-controls` from Tabs without panels (see D-11)                                                                                                             | org activity                                                     |
| A-05 | Unnamed filter selects (see D-04)                                                                                                                                       | developments, properties                                         |
| A-06 | Ops-report status badges `bg-emerald-600`/`bg-orange-600` with white text fail contrast                                                                                 | ops reports                                                      |
| A-07 | Marketing trends status pills (`bg-success/10 text-success`) fail contrast                                                                                              | marketing trends                                                 |
| A-08 | "SYNCED" badge is 10px uppercase with no explanation and low contrast                                                                                                   | FAQs                                                             |

Good news: every toggle sampled has an `aria-label` ("Allow Inbox suggestions", "Enable platform AI",
"Filter…"), the pricing dialog is clean under axe, dialogs are Radix (focus trap, Escape), and most
icon buttons carry labels.

## 5. Mobile (390px)

| ID   | Finding                                                                                       |
| ---- | --------------------------------------------------------------------------------------------- |
| M-01 | Horizontal filter and tab rows, hidden scrollbars (U-04)                                      |
| M-02 | AI Limits mobile card drops the Month calls and Credits values that the desktop table shows   |
| M-03 | The org hub section nav (9 sections) disappears entirely; no jump control on phone            |
| M-04 | Development detail collapses its section nav into an unlabeled bordered box with no chevron   |
| M-05 | Overview KPI cards lose their icons on phone while the desktop shows them (consistency check) |
| M-06 | Cookie banner is 136px tall over the content and sits above the tab bar                       |

Everything else holds up: no horizontal page overflow on any route, tables become cards, the bottom
tab bar and the "More" sheet expose all 16 destinations, tap targets are generally 44px, and every
route has a matching skeleton definition.

## 6. Product and data gaps

- **X-01 Health console has no environment context.** Local shows "27 errors" in Database and 37
  issues, almost all "Vault secret missing", which is expected locally and fatal in production. The
  page never says which environment it is looking at. Add an env badge and explain the local-only
  cases.
- **X-02 AI usage aggregation disagrees with itself** (see D-09). Confirm before trusting the AI
  spend KPIs.
- **X-03 Support "Organization" column is ambiguous.** One local ticket shows "Explore guest" in the
  organization column, which reads like a person, not an org. Check the join used by
  `list-support-tickets-admin`.
- **X-04 Timestamp format drift.** Some endpoints return `+00`, others `+00:00`. Normalise at the
  boundary (server serialiser) instead of hardening each client formatter.
- **X-05 Missing route guide for `/admin/rate-limits`.** The routes README marks it "No dedicated
  guide"; it is now a real page with a manual block form.
- **X-06 `success` / `warning` / `primary` badge recipes** are reused across pages with failing
  contrast. Fix the shared badge tokens rather than each page.

## 7. What already works well

Worth protecting while fixing the above:

- Every mutation funnels through `serveSuperAdmin` with `requireSuperAdminStepUp` (platform
  settings, payment settings, parking payouts, pricing plans, subscriptions, feature availability,
  AI limits, credit wallet) and writes `superAdminAudit`.
- The shared console scaffold (page header, stat cards, list/card toggle, table + mobile card pair,
  URL-persisted pagination) is consistent, and every route has a dedicated skeleton definition.
- Dialogs are `ResponsiveModal` based (sheet on phone), announcements and FAQ deletes confirm, and
  the unsaved-changes guard fires correctly on Platform settings.
- Dark mode is complete and legible on the pages sampled.
- Empty states exist for the main lists, and most destructive actions are behind AlertDialog.

## 8. Suggested sequence

**Wave 1, correctness (small diffs, high trust)**
D-01 dates, D-02 guard error/loading split, D-05 duplicate health keys, D-06 admin 404, D-12 duplicate
routes, D-10 empty Sources, D-19 duplicate copy.

**Wave 2, accessibility**
D-03 table rows, D-04 select labels, D-11 tabs, A-01 badge/link contrast tokens, A-02 chart titles,
then re-run axe across all 33 routes.

**Wave 3, mobile**
U-04 filter sheets, M-02 data parity, M-03/M-04 section nav, cookie banner (U-03).

**Wave 4, operator workflows**
U-01 command palette destinations, U-02 sidebar grouping, U-05 AI wallets, U-06 audit log filters
and detail, U-07 cron tools, U-08 host detail, U-11 ops reports.

**Wave 5, polish**
Remaining P3 items, then route-guide updates for anything whose behaviour changed.

## 9. Definition of done for this audit

- Every P1 row closed or explicitly deferred with a reason.
- axe (wcag2a/2aa/21a/21aa) clean on all `/admin` routes at 1440 and 390, or documented exceptions.
- No horizontal scroll on any phone route.
- No console errors or React key warnings on the 33-route sweep.
- Route guides and `docs/guides/routes/README.md` updated for changed behaviour, plus a
  `docs/guides/routes/admin/rate-limits.md` guide.

## 10. Reproducing the sweep

The exploration harness was a throwaway Playwright script (not committed). To re-run:

1. `./dev.sh` (or `bun run ui` in a worktree), then confirm `http://127.0.0.1:5179` and
   `127.0.0.1:54321` respond.
2. Mint a session for a local super admin: set a password on the seeded user via the local GoTrue
   admin API, then `POST /auth/v1/token?grant_type=password`.
3. Seed `localStorage['sb-127-auth-token']` with the full session JSON (not just the access token)
   before navigation.
4. Visit the 33 routes in `routes/index.tsx`, capture console errors, failed responses, axe
   violations, and `documentElement.scrollWidth` at both viewports.
5. Repeat with `/functions/v1/**` intercepted to 500 (error states) and delayed 4s (skeletons).
