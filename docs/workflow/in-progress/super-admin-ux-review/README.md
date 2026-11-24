---
title: 'Super admin UI/UX review — every width'
status: active
tags: [ux, ui, super-admin, admin, review, qa, e2e, mobile, responsive, accessibility]
updated: 2026-11-24
---

# Super admin UI/UX review — every width

Deep pass over the entire `/admin` console, run against branch `fix/settings-blockers` on the
local seed (`kame-homes`, Business plan, signed in as the seeded owner who is also a platform
super admin) with real data, not mocked fixtures.

| Surface       | Routes                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell         | sidebar groups, command palette, phone bottom bar, 404                                                                                      |
| Platform      | Overview, System health, Marketing trends, Operations reports, AI (5 tabs), Rate limits, Audit log, Platform settings, Feature availability |
| Organizations | Organizations, org hub (8 anchored sections), Hosts, Host detail, Developments, Properties                                                  |
| Billing       | Pricing plans, Subscriptions, Payment settings, Parking payouts                                                                             |
| Operations    | Approvals, Support tickets, FAQs, Playbook                                                                                                  |
| Content       | Announcements                                                                                                                               |

Opened at **1440, 820 and 390** wide (plus 768 and 375 through the committed E2E projects), light
theme, named destinations and the 404, using the page walker in this folder.

Reviewed with `impeccable` (critique + audit), `frontend-design`, `design-taste-frontend`,
`ui-ux-pro-max`, `mobile-responsive`, `accessibility`, `human-copy`, `minimal-ui-copy`,
`skeleton-loaders` and `plans-and-permissions`, against `DESIGN.md` and the route guides.

## Why this exists

The console is the operator surface for the whole platform: organizations, hosts, listings,
billing, approvals, support, content, AI spend, rate limits, audit trail and configuration. It
grew fast and has never had a full experience pass. This is that pass, plus the tests that keep
the journeys honest.

## Method and evidence

| What                                                           | Where                                                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Page walker (28 destinations + 404, 3 widths, real local data) | [`review.mjs`](./review.mjs)                                                                             |
| Reference screenshots                                          | [`screenshots/`](./screenshots)                                                                          |
| Slow-motion journeys                                           | [`recordings/`](./recordings)                                                                            |
| Before / after pairs (same fixtures)                           | [`fixes/compare/index.html`](./fixes/compare/index.html)                                                 |
| Snapshot fixtures used for both runs                           | [`fixes/fixtures/`](./fixes/fixtures)                                                                    |
| Automated per-page diagnostics                                 | [`fixes/after/diagnostics.json`](./fixes/after/diagnostics.json)                                         |
| Committed E2E journeys                                         | `ui/e2e/features/admin/superAdminModuleTour.spec.ts` (`@ci`), `superAdminMobileShell.spec.ts` (`@smoke`) |
| Shared mocks for the above                                     | `ui/e2e/features/admin/shared/superAdminConsoleHarness.ts`                                               |

The walker signs in as the seeded owner (a super admin) against the local Supabase stack, so every
page renders real counts, real empty states and real error states. It measures horizontal overflow,
unnamed interactive controls, clipped text, sub-40px targets, console errors and failed requests on
every page.

What the automation proves today:

- **0 horizontal overflow** at 375/390/768/820/1440 across all 28 destinations and the 404.
- **0 unnamed interactive controls** anywhere.
- **0 console errors and 0 failed requests** on the walk with clean data.
- All **55** edge endpoints the console calls sit behind `serveSuperAdmin`, `requireSuperAdmin` or
  `verifySuperAdmin`. The client allow-list (`VITE_SUPER_ADMIN_EMAILS`) is not the boundary.

## Verdict by area

| Area                                          | Verdict          | Notes                                                                                    |
| --------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| Navigation and shell                          | Good             | Grouped sidebar, palette, one phone bottom bar, 404 stays in shell                       |
| Overview                                      | Good, thin spots | KPI plus attention panel is strong; error state is weaker than the rest                  |
| Organizations and org hub                     | Needs work       | Strong hub design, but eager loading, duplicate headings, crash risk on partial payloads |
| Hosts / Properties / Developments             | Good             | Tables are fine; phone property rows are photo-heavy                                     |
| Billing and catalog                           | Needs work       | Sparse summary grids on tablet, internal plan codes, ambiguous discount wording          |
| Approvals / Support                           | Good, thin spots | Clear queues; terminology drift, 10px labels                                             |
| Content (FAQ, playbook, announcements)        | Needs work       | FAQ rows are text walls; announcement SCHEDULE column is always empty                    |
| AI console                                    | Needs work       | Five tabs on one page, a toggle wall in Controls with no effective-state summary         |
| Health / Trends / Ops reports                 | Mixed            | Health is strong; trends and reports leak machine strings                                |
| Audit log                                     | Needs work       | Raw action keys and ISO timestamps in titles                                             |
| Rate limits / Settings / Feature availability | Needs work       | Copy volume and disabled-button contrast                                                 |

## Findings

Severity: **P0** breaks or blocks an operator, **P1** costs time every session or is a systemic
consistency break, **P2** polish, **P3** nice to have.

### P0

#### P0-1 One partial payload crashes the whole organization hub

Evidence: while building the E2E harness, three section payloads missing an array each threw and
replaced the entire org page with the router error boundary ("Something went wrong"):

- `buildBillingTimeline` reading `input.events` (`ui/src/features/dashboard/super-admin/lib/superAdminBillingTimeline.ts:46`)
- `AiCreditWalletCard` reading `.ledger.length` (`components/AiCreditWalletCard.tsx`)
- `SuperAdminGenerationOverridesCard` reading `.properties.length` (`components/SuperAdminGenerationOverridesCard.tsx`)

Impact: one 500, one schema change, or one partially deployed function destroys the operator's
entire organization context instead of the one section that failed. A page that fires 16 requests
gives that failure many chances.

Fix: default every list to `[]` at the adapter boundary, and wrap each hub section in its own error
boundary with a section-level Retry. A section's data shape must not be load-bearing for the route.

#### P0-2 Audit log, ops reports and trends speak in machine strings

`desktop--audit.png`: every row carries `pricing_plan_updated · sprmke… · organization`. One row
also reads `Generated operations report for 2026-11-15T16:00:00+00:00 to …`; that particular string
came from a seeded audit row (the generator formats dates correctly), but the table renders whatever
summary it is given verbatim.
`desktop--marketing-trends.png`: `classify failed: marketing_trends_classify: model output failed
schema validation`. `phone--feature-availability.png`: help text listing `meta-inbox-oauth-*`,
`meta-inbox-resubscribe`, `meta-inbox-disconnect`.

Impact: the audit surface exists to be defensible in a review or incident. Raw table names,
function names and ISO ranges make it unreadable and unactionable.

Fix: human labels for actions and target types, absolute timestamps in Asia/Manila, a one-line
summary plus expandable technical detail. Same for trend failures and feature availability copy.

### P1

#### P1-1 Summary grids waste a third of the tablet screen

Eleven grids use `grid-cols-2 … lg:grid-cols-4`, so 768–1023px shows two oversized cards per row.
`tablet--approvals.png` (820px) spends the top 400px on four cards while the queue sits below the
fold. Health and parking payouts already use `sm:grid-cols-4`.

Fix: standardize on `grid-cols-2 sm:grid-cols-4` and reduce card height at tablet.

#### P1-2 On phones the summary cards push the first row off screen

`phone--support.png`, `phone--hosts.png`, `phone--properties.png`: four ~110px cards fill the first
viewport. Opening Support tickets shows counts, not tickets.

Fix: under `sm`, collapse to one compact strip (or a collapsible block) and keep the card grid from
`sm` up.

#### P1-3 Search fires a request per keystroke in every super-admin toolbar

15 search inputs, none debounced, while `useDebouncedValue` exists and is used in Inbox and
Marketing. Each keystroke rewrites the URL (`replace: true`, so no history spam) and triggers a new
edge call.

Fix: debounce 250–300ms, keep the input locally controlled, and add a clear (×) control.

#### P1-4 The rows-per-page select is orphaned everywhere

`phone--support.png`, `phone--orgs.png`, `desktop--audit.png`: a bare `25` select floats on its own
row on phone and alone at the far right on desktop, unlabeled. Developments and Properties group it
next to the view toggle, which reads fine.

Fix: one toolbar primitive. Put it beside the view toggle or inside the pagination row, and label
it.

#### P1-5 Disabled destructive buttons look broken

`desktop--rate-limits.png`: the disabled `Block` button is translucent pink on white with white
text (~1.9:1). `button.tsx` gives `default` a proper muted disabled state; `destructive`,
`secondary` and `outline` only get `opacity-50`.

Fix: apply `disabled:bg-muted disabled:text-muted-foreground` to every fill-bearing variant.

#### P1-6 Error text fails AA contrast

`--destructive` (`0 84% 60%`) on white is **3.78:1**; error lines are 13–14px and need 4.5:1.

Fix: add a `--destructive-strong` text token near `0 72% 45%` (≥ 4.5:1), use it for text, keep the
lighter red for fills and borders.

#### P1-7 Bottom tab items lose their button role

`components/mobile/BottomTabBar.tsx` renders `<button role="listitem">` and `<a role="listitem">`.
Screen readers announce "list item", not button or link, and Playwright cannot find them by role
(the mobile spec has to select `[aria-label="More"]`).

Fix: use a real `nav > ul > li > a/button` structure, or drop the overridden roles and rely on
native semantics. Add the More tab to the a11y sweep once fixed.

#### P1-8 Copy volume in settings screens

`tablet--platform-settings.png`: every toggle carries one or two lines of explanation and the
authenticated rate limiting card has a four-line paragraph. `phone--feature-availability.png` has
the same plus edge function names.

Fix: short label, detail behind the sanctioned `InfoHint`, delete the inline paragraphs.

#### P1-9 FAQ rows are text walls

`desktop--faqs.png`: each of 25 rows shows the full answer (three to four lines) and three actions
(publish toggle, preview, delete).

Fix: clamp answers with expand-on-click, move destructive actions into a row overflow menu, and
keep the category filter visible.

#### P1-10 Terminology drift across approvals

The same state is "Awaiting review" (card), "In review" (filter, `lib/superAdminApprovalsFilters.ts:27`)
and `pending` (API).

Fix: one host-facing phrase in all three surfaces.

#### P1-11 The organization hub loads all eight sections on mount

Measured: `/admin/orgs/kame-homes` fires **16** edge requests (properties, parkings, org detail,
subscriptions, plans, approvals, AI wallet, AI limits, generation overrides, support, audit, plus a
second `list-organizations-admin`), summing to ~9.6s of request time locally. Only Overview is
visible on first paint.

Fix: fetch the active section only and prefetch on nav hover/focus. The layout already separates
sections, so this is a data-loading change.

### P2

| ID    | Finding                                                                                                                      | Evidence                                        | Fix                                                                |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| P2-1  | `1 properties · 1 parkings` on phone org cards; table says `1 prop · 1 parking`; the subscriptions card pluralizes correctly | `phone--orgs.png`, `SuperAdminOrgsPage.tsx:219` | One pluralize helper per row                                       |
| P2-2  | Stat cards show `-` while the summary loads, which reads as "none"                                                           | `phone--orgs.png`                               | Per-card skeleton until resolved                                   |
| P2-3  | Subtitles clip mid-word (`…approvals, an…`, `…Local environment: Vault…`)                                                    | `phone--orgs.png`, `phone--health.png`          | Shorten, or hide under `sm`                                        |
| P2-4  | AI tab row wraps 4 + 1 ("Controls" alone)                                                                                    | `phone--ai-usage.png`                           | Scrollable pill row or select under `sm`                           |
| P2-5  | Audit filters stack four controls on phone, one an unlabeled "Actor email" box                                               | `phone--audit.png`                              | One labeled Filters sheet                                          |
| P2-6  | Property rows are photo-first, ~420px before any text                                                                        | `phone--properties.png`                         | 72px thumbnail, title, price, chevron                              |
| P2-7  | Row action is an external-link arrow (`↗`) but opens an in-app dialog                                                        | Hosts, Support, Announcements, Developments     | Chevron for in-app, arrow only for real links                      |
| P2-8  | Relative time only ("4d ago"), no exact timestamp                                                                            | `desktop--audit.png`                            | Absolute time plus tooltip                                         |
| P2-9  | AI Controls shows "Enabled: off" with "Enforce quotas: on" and no explanation                                                | `desktop--ai-controls.png`                      | Effective-state sentence, or disable quota controls when AI is off |
| P2-10 | 15 switches in two columns jump reading order; numeric fields blank with no "inherit" hint                                   | `desktop--ai-controls.png`                      | Group by domain, one column, inherit placeholders                  |
| P2-11 | Announcement SCHEDULE column always empty; severity text repeated                                                            | `desktop--announcements.png`                    | Hide empty columns; show schedule only when scheduled              |
| P2-12 | Org hub repeats "Subscription" as section band and card title                                                                | `tablet--org-hub.png`                           | Card title only                                                    |
| P2-13 | Overview error is a bare red sentence with no Retry                                                                          | `SuperAdminOverviewPage.tsx:56`                 | Use the `SuperAdminPage` error box                                 |
| P2-14 | Plan cards show name plus internal code (`Business / pro`) and `₱399 · 20% off` without basis                                | `tablet--pricing-plans.png`                     | One display name, code in a tooltip, label the price basis         |
| P2-15 | 13 uses of `text-[10px]` and 25 of `text-[11px]` in approvals cards and tables                                               | `components/super-admin-approvals/**`           | Nothing below 12px per DESIGN.md                                   |
| P2-16 | Numeric columns stretch and center, leaving ~400px between header and value                                                  | `desktop--hosts.png`                            | Constrained, right-aligned numeric columns                         |
| P2-17 | Toggle state is color only                                                                                                   | Platform settings, Feature availability         | On/Off text or label change                                        |

### P3

- Sidebar group headers are 24px tall: fine for mouse, thin on a tablet.
- `/login` renders the marketing 404 instead of redirecting to `/for-hosts/login`.
- The shell calls `guest-profile` on every admin page; super admins never need it.
- `get-public-platform-status` and `get-feature-availability` gate first paint; one instance took
  2.2s. Cache them or resolve in parallel with the capability check.

## Performance snapshot

Local stack, warm, desktop, 3s settle:

| Route                             | Edge calls | Summed time |
| --------------------------------- | ---------- | ----------- |
| `/admin`                          | 6          | 3.3s        |
| `/admin/orgs/kame-homes`          | 16         | 9.6s        |
| `/admin/audit`                    | 4          | 5.7s        |
| `/admin/pricing/payment-settings` | 3          | 4.3s        |
| `/admin/ai?tab=usage`             | 3          | 2.4s        |
| `/admin/properties`               | 3          | 3.9s        |

Two calls per page are shell gates. The org hub is the outlier and the only screen whose cost scales
with sections rather than visible rows.

## What is already good (do not regress)

- Grouped sidebar, one phone bottom bar, a command palette, and a 404 that stays in the shell.
- Skeletons that match the final layout, and empty states that name the active filter.
- The organization hub concept: one page, anchored sections, no route sprawl.
- Rate limits explains where enforcement actually lives and links to it.
- Every console endpoint is guarded server-side; the client allow-list is not load-bearing.
- Zero horizontal overflow and zero unnamed controls at every width tested.

## Remediation status

Implemented on `fix/super-admin-ux-audit` (branched from `origin/main`, `c1cc929d6`). Every item
below was re-checked against main first; none had been fixed by the 40 commits that landed since
the audit.

| ID    | Status          | What changed                                                                                                                                                                                                                                           |
| ----- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0-1  | Fixed           | `SuperAdminOrgHubSection` gives each hub section its own error boundary and a scoped retry; `buildBillingTimeline`, `AiCreditWalletCard` and `SuperAdminGenerationOverridesCard` treat a missing array as empty. Unit test covers the partial payload. |
| P0-2  | Fixed           | Audit rows use human action and target labels with absolute time; marketing trend failures show an operator sentence with the raw error behind "Technical detail"; feature availability copy no longer names edge functions.                           |
| P1-1  | Fixed           | 11 summary grids use `grid-cols-2 sm:grid-cols-4`; metric cards get `density="responsive"` (compact on phones, full from `sm`).                                                                                                                        |
| P1-2  | Fixed           | Same change: the four summary cards now cost roughly half the phone height.                                                                                                                                                                            |
| P1-3  | Fixed           | New `AdminSearchInput` (300ms debounce, clear control). Adopted by all 8 list toolbars plus Orgs, Audit, FAQs and Playbook.                                                                                                                            |
| P1-4  | Partially fixed | The per-page select always shows a "Rows" label. It still sits on its own row on a few phone toolbars.                                                                                                                                                 |
| P1-5  | Fixed           | `destructive`, `secondary`, `success` and `warning` buttons get the muted disabled fill; outline variants keep readable text.                                                                                                                          |
| P1-6  | Fixed           | New `--destructive-strong` token (5.06:1 on white) used for all super-admin error copy and for `outline-destructive` / `soft-destructive`.                                                                                                             |
| P1-7  | Fixed           | Bottom tab items keep their native button/link role; `listitem` moved to a `contents` wrapper.                                                                                                                                                         |
| P1-8  | Fixed           | Platform settings copy trimmed; feature availability descriptions rewritten for operators on both the UI and server catalogs.                                                                                                                          |
| P1-9  | Partially fixed | FAQ answers clamp to one line. Inline row actions are unchanged.                                                                                                                                                                                       |
| P1-10 | Fixed           | The queue state is "Awaiting review" in the card, filter and org hub.                                                                                                                                                                                  |
| P1-11 | Fixed           | Hub sections mount only when within 600px of the viewport (`useNearViewport`). E2E asserts the Activity queries do not fire until scrolled.                                                                                                            |
| P2-1  | Fixed           | `pluralize()` used for org and host rows.                                                                                                                                                                                                              |
| P2-2  | Fixed           | `StatCard` `valueLoading` renders a skeleton instead of a bare dash.                                                                                                                                                                                   |
| P2-3  | Fixed           | Page subtitles clamp to three lines; the Organizations subtitle is one sentence.                                                                                                                                                                       |
| P2-4  | Fixed           | Secondary nav scrolls horizontally under `sm` instead of wrapping 4 + 1.                                                                                                                                                                               |
| P2-5  | Not fixed       | Audit filters still stack on phones. A refine sheet is the right next step.                                                                                                                                                                            |
| P2-6  | Fixed           | New compact `SuperAdminPlatformPropertyRow` (thumbnail, name, status, chevron).                                                                                                                                                                        |
| P2-7  | Fixed           | `AdminTableRowAffordance` accepts `icon="chevron"`; super-admin tables use it for in-app detail.                                                                                                                                                       |
| P2-8  | Fixed           | Relative time keeps a tooltip with the absolute Asia/Manila timestamp; Details also shows it.                                                                                                                                                          |
| P2-9  | Fixed           | Platform AI shows "On and enforcing quotas", "On. Quotas are logged" or "Off. Hosts cannot use any AI feature."                                                                                                                                        |
| P2-10 | Partially fixed | Switch list is one column; numeric fields hint Inherit/Default. Domain grouping is still open.                                                                                                                                                         |
| P2-11 | Fixed           | Announcements show "Always on" instead of an empty schedule.                                                                                                                                                                                           |
| P2-12 | Fixed           | Hub card is "Plan and billing", not a second "Subscription".                                                                                                                                                                                           |
| P2-13 | Fixed           | Overview error uses the standard card with Retry.                                                                                                                                                                                                      |
| P2-14 | Partially fixed | Internal plan code is monospace with a tooltip; discounted price explains list price on hover. A visible price basis still needs a product decision.                                                                                                   |
| P2-15 | Fixed           | No `text-[10px]` left in the module.                                                                                                                                                                                                                   |
| P2-16 | Fixed           | Host table columns are width-constrained and right-aligned.                                                                                                                                                                                            |
| P2-17 | Not fixed       | Switches keep their labels; colour-only state is unchanged.                                                                                                                                                                                            |
| P3    | Mostly fixed    | `/login` redirects to the host sign-in, super admins no longer fetch the guest profile, sidebar group headers are taller. Shell gate caching is unchanged.                                                                                             |

Remaining, in priority order: P2-5 (audit filter sheet), P2-10 grouping, P1-4 placement on phone,
P1-9 row actions, P2-14 price basis, P2-17, and the shell request caching from P3.

## Before and after

57 pairs (19 affected pages at 390, 820 and 1440) render the same snapshot fixtures
(`fixes/fixtures/`, captured from the local seed), so the only difference between the two halves is
the code. The before half was captured from `origin/main` (`c1cc929d6`); the after half from this
branch. Open [`fixes/compare/index.html`](./fixes/compare/index.html) to review every pair in one
page.

## Suggested next batches

| Batch             | Contents                         | Why                                        |
| ----------------- | -------------------------------- | ------------------------------------------ |
| 1. Audit filters  | P2-5                             | The last phone filter stack in the console |
| 2. AI controls    | P2-10 grouping                   | Needs a domain split decision              |
| 3. Toolbar polish | P1-4 placement, P1-9 row actions | Small, contained                           |
| 4. Shell          | P3 caching                       | Measure before/after on the hub and audit  |

## Recordings

Seven slow-motion journeys (`PLAYWRIGHT_SLOW_MO=350`, `PLAYWRIGHT_RECORD_VIDEO=1`):

| File                             | Journey                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| `01-destination-tour.webm`       | Walks Organizations, Support, Audit, Rate limits, Platform settings headers |
| `02-orgs-to-hub.webm`            | Organizations table, opens the org hub, reads live counts                   |
| `03-ticket-status.webm`          | Opens a support ticket and moves it to In progress                          |
| `04-rate-limit-block.webm`       | Block button disabled until a valid identity, then block                    |
| `05-platform-settings-save.webm` | Edits the maintenance message and saves                                     |
| `06-phone-support.webm`          | Phone support list, summary and cards                                       |
| `07-phone-more-sheet.webm`       | Phone More sheet to Platform settings                                       |

## Regenerating the evidence

```bash
# all pages, all widths (local Supabase must be running and seeded)
node docs/workflow/in-progress/super-admin-ux-review/review.mjs
# one width, a few pages
PAGES=overview,orgs VIEWPORTS=phone node docs/workflow/in-progress/super-admin-ux-review/review.mjs
# replay the captured fixtures instead of the live stack (used for before/after)
MOCK=1 OUT=fixes/after node docs/workflow/in-progress/super-admin-ux-review/review.mjs
# side-by-side pairs + index.html
node docs/workflow/in-progress/super-admin-ux-review/compare.mjs
# slow-motion recordings
PLAYWRIGHT_RECORD_VIDEO=1 PLAYWRIGHT_SLOW_MO=350 \
  bunx playwright test ui/e2e/features/admin/superAdminModuleTour.spec.ts --project=chromium-ci
```
