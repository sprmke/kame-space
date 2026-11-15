---
title: 'Full-app QA audit: per-page method'
status: planned
stage: planned
kind: reference
tags: [qa, audit, method]
updated: 2026-11-13
---

# Per-page method

One ledger row (one route, or one tightly coupled route pair such as list + detail) goes through eight stages in order. Do not skip a stage; write `N/A — <why>` instead. The page record is a copy of [`page-audit-template.md`](./page-audit-template.md) saved to `docs/workflow/qa/full-app/pages/<guide-path>.md`, mirroring `docs/guides/routes/`.

## Stage 0: Claim

- [ ] In [`ledger.md`](./ledger.md), set the row to `in-audit`, add the date and the model or person.
- [ ] Record the current SHA in the page record. If it is not the baseline SHA, note which commits since baseline touch this page's files.
- [ ] Read the module file for this page's area and the journeys it lists.

## Stage 1: Reference (what the page is supposed to do)

Collect every existing description of the page **before** opening it, so the audit can catch disagreement. Do not treat any of these as truth.

- [ ] Route guide in `docs/guides/routes/` (every `##` section, the Progress overview, the Testing table, Host-facing knowledge).
- [ ] `docs/guides/support/faqs.md` entries that mention the page.
- [ ] Manual testing guide in `docs/guides/testing/` if one exists.
- [ ] Plan files in `docs/workflow/{for-testing,in-progress,done}` that built or changed the page. A `for-testing` plan's checklist becomes part of this audit.
- [ ] Production-readiness module card and any `TO-FIX.md` / `LEDGER.md` rows for the module.
- [ ] Earlier QA in `docs/workflow/qa/property-dashboard/` for the same page (historical; re-check each item).
- [ ] Architecture docs for the domain (`docs/architecture/*.md`), `.cursor/rules/*.mdc` for the surface (`booking-workflow`, `admin-auth`, `plans-and-permissions`, `audit-logging`, `mobile-native-ui`, `unsaved-changes`, `pwa`).
- [ ] The docs vault graph: open the guide in Obsidian (`docs/.obsidian`) or grep for `[[` wikilinks and backlinks to the guide, to find related pages that the guide does not mention.
- [ ] Existing tests: `rg -l "<route segment>|<PageComponent>" ui/e2e ui/src --glob '*.{spec,test}.{ts,tsx}'`, the page's `.coverage.ts` manifest if present, colocated `lib/*.test.ts`, Deno tests for each edge function found in Stage 2.
- [ ] Production signal: Sentry issues whose URL or transaction matches the route, edge function error logs for the functions found in Stage 2.

Output: the **Expected behavior** list in the page record, each line tagged with its source (`guide`, `faq`, `plan`, `rule`, `test`).

## Stage 2: Discover (what is actually there)

Build the element inventory from the running page and from the source, independently.

### 2a. From the running page

For each state in the **state matrix** (below), capture an accessibility snapshot and a screenshot at 375, 768 and 1440.

State matrix for a page, cut down by what applies:

| Dimension    | Values                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Persona      | every persona in [`environments-and-personas.md`](./environments-and-personas.md) that can reach or should be denied the page    |
| Plan tier    | the page's minimum tier, one below it, and Business                                                                              |
| Data         | seeded, empty (new tenant), heavy (many rows), broken (missing optional relation)                                                |
| View         | each tab, sub-tab, accordion, filter preset, sort, pagination page                                                               |
| Overlay      | each modal, sheet, drawer, popover, menu, command palette entry, toast, confirm dialog                                           |
| Entity state | each status of the main entity (booking statuses, property lifecycle, ticket states, plan states)                                |
| System       | loading (throttled), server error (blocked request), offline, session expired, maintenance mode, feature-availability switch off |

From the snapshots list every: button, link, form field, select, checkbox, radio, switch, tab, menu item, row action, drag handle, upload zone, keyboard shortcut, swipe or long-press target, and every piece of dynamic content (counts, badges, statuses, money, dates, charts).

### 2b. From the source

Start at the route element in the feature's `routes/` file and read down the tree: page → sections → components → hooks → `lib`.

Record for the page:

- Every `onClick`, `onSubmit`, `onChange` with side effects, `onDrop`, key handler.
- Every `useQuery` / `useMutation` / direct `supabase.functions.invoke` / `fetch` / storage call, with the edge function name.
- Every `navigate`, `Link`, `href`, `window.open`, `location.assign` and its target.
- Every realtime subscription, interval, `useEffect` that writes, `localStorage` / `sessionStorage` / IndexedDB key, URL search param.
- Every gate: plan feature key, permission leaf, feature-availability key, verification tier, super-admin check, `import.meta.env.DEV`.
- Every unsaved-changes guard and where it is missing on a manual-save form.

Then for each edge function found, read `supabase/functions/<fn>/index.ts` and record: serve wrapper and auth tier, permission leaf, plan gate, validation, tables written, side effects (email, calendar, sheet, push, Telegram, PDF, storage, AI call), `activity_log` event, rate limit.

### 2c. Reconcile

Merge 2a and 2b into the **element inventory** table. Each row gets an ID `<PAGE>.E<nn>` and these columns:

| Column             | Meaning                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Element            | Role and accessible name, where it appears (section, modal)                                                  |
| Trigger            | Click, submit, change, drag, timer, realtime event, URL                                                      |
| Expected           | What should happen, with the source tag from Stage 1, or `undocumented`                                      |
| Chain              | Edge function(s) → tables → side effects                                                                     |
| Connected surfaces | Other routes, roles, emails, public pages that must reflect it (IDs from [`flow-graph.md`](./flow-graph.md)) |
| Gates              | Plan key, permission leaf, availability key                                                                  |
| Tests              | Spec or unit test that covers it, or `none`                                                                  |
| Docs               | Guide section that describes it, or `none`                                                                   |

Reconciliation findings, each recorded:

- In the source but never rendered in any state → dead code or an unreachable state.
- Rendered but with no handler, or a handler that does nothing → dead control.
- In the guide but not on the page → stale guide or removed feature.
- On the page but not in the guide → doc gap.
- Edge function with no caller on any page → candidate orphan (kept for Phase 5).

**Inventory completeness check before moving on:** every interactive node in every snapshot maps to a row, and every handler and network call found in the source maps to a row. Write the two counts in the record.

## Stage 3: Exercise (does each element work on this page)

For each inventory row, as the persona who should be able to use it:

- [ ] Happy path with realistic data.
- [ ] Boundary and invalid input for every field: empty, whitespace, max length, emoji and non-Latin text, leading zeros, negative and zero money, huge numbers, past and far-future dates, checkout before checkin, same-day, invalid email and phone formats, pasted formatted text, files of wrong type, 0 bytes, oversized, HEIC, duplicate.
- [ ] Interaction abuse: double-click, rapid repeat, submit with Enter, submit while a previous submit is pending, navigate away mid-request, open the same record in two tabs and save both.
- [ ] Feedback: disabled and loading state on the control, success and error message, focus after the action, scroll position, the list updates without a manual refresh.
- [ ] State persistence: reload, back, forward, deep link to the same state, new tab.
- [ ] Watch the console and the network panel the whole time: no errors, no warnings that indicate bugs, no 4xx or 5xx that the UI swallows, no request fired when a gate should block it, no duplicate or runaway requests.

Then the page-level checks from the System row of the state matrix: loading skeleton, empty state, error state with retry, offline, expired session, not-found for a bad ID, wrong tenant slug.

## Stage 4: Trace (does the whole chain hold)

For every inventory row whose Chain or Connected surfaces column is not empty, follow it to the end. This is the stage that decides `pass`.

1. **Request**: correct function, payload shape, auth header. Record it with `edge-trace`.
2. **Server**: response status and body. Then repeat the call as each persona that must be denied (missing leaf, lower tier, other org, anon, guest) and confirm the **server** refuses, not only the UI.
3. **Data**: query the local DB for the rows the action should have written. Check values, timestamps (Manila), foreign keys, no orphan rows, no duplicate on retry.
4. **Side effects**: confirm each one happened once and with the right content.
   - Email: workflow email goes through Resend even on local (`emailService.ts` needs `RESEND_API_KEY`), so check the sent message in the Resend log for the local key, addressed to an owner-controlled `EMAIL_TO`. Auth email (OTP, magic link) lands in the local Supabase mail catcher. Verify recipient, subject, placeholders resolved, links work, no leftover `{{…}}`. Without a local Resend key the email step is `blocked`.
   - PDF: open it, check fields against the booking.
   - Calendar, sheet: the event or row exists with the right title, color and dates, when the integration can run; otherwise `blocked`.
   - Push, Telegram: delivery record or `blocked`.
   - Storage: object exists in the right bucket and path, access policy correct.
   - `activity_log`: one event with the right actor, scope and summary; visible on the Activity page.
   - Realtime: a second browser session sees the change without reload where the page promises that.
5. **Connected surfaces**: open each one and verify it reflects the change. Typical fan-out for a property-level write: the same module at org level, the property dashboard counters, the booking detail, the guest-facing page (trip, stay guide, listing), the guest account, the public listing and search index, the super-admin view, analytics rollups, the AI assistant's answers about it.
6. **Reverse and repeat**: undo, edit, delete, cancel. The chain must also hold backward (calendar event removed, counters decremented, email not resent).

Verdict per row: `pass`, `fail` (finding ID), `blocked` (reason and who can unblock), `N/A` (reason). A row is `pass` only if steps 1 to 6 all passed or were `N/A`.

## Stage 5: Critique (three hats)

Go through every lens in [`factors.md`](./factors.md) for the page as a whole and write a verdict per lens. Then write the three reviews.

**User hat.** For each persona that uses the page, state their top three jobs on it and attempt each cold, at 375 first. Record: time and taps to finish, where you hesitated, what you expected that was not there, what was there that you did not need, anything you would not trust with money or a guest's data. Compare with how Airbnb or a leading PMS handles the same job when the page is a core flow (skill `competitive-ux-research`). End with a blunt keep / change / remove / redesign list.

**Tester hat.** List the riskiest assumptions the page makes and try to break each. Record every reproduction.

**Developer hat.** Read the page's code for: logic duplicated between client and server that can drift, side effects outside `workflowOrchestrator`, missing server gate behind a UI gate, unbounded queries, missing pagination, N+1 edge calls, query keys that do not invalidate, stale closures, components over 400 lines, dead exports, missing error boundaries, hand-rolled leave dialogs, direct table writes that bypass an edge check (RLS is not the access-control layer here).

## Stage 6: Record

- [ ] Fill the page record completely. No empty cells; use `N/A — <why>`.
- [ ] File each finding in the format from [`findings-and-coverage.md`](./findings-and-coverage.md) with severity, reproduction and evidence path.
- [ ] Save evidence under `ui/e2e/artifacts/full-app-qa/<page>/` (gitignored): screenshots, traces, request logs. Reference paths in the record; do not commit binaries. Never save tokens, OTPs, real guest PII or payment details.

## Stage 7: Backfill docs and tests

Same session, same change as the page record. Rules and limits in [`findings-and-coverage.md`](./findings-and-coverage.md) § Backfill.

- [ ] Route guide: correct wrong statements, add sections for undocumented behavior, refresh the `## Testing` table. Skill `route-guides`.
- [ ] FAQ and Host-facing knowledge when user-visible statements changed. Skill `support-content`, then run both checks.
- [ ] Tests for behavior that **passed** and had no test: pure logic → Vitest `lib/*.test.ts`; stateful component or hook → `*.test.tsx` (`test:dom`); server rule → Deno `_shared/*_test.ts` or a handler test; page behavior → Playwright spec in the page folder with the correct lane tag. Skill `testing`.
- [ ] Coverage manifest: create or extend `<page>.coverage.ts` (`definePageCoverage`) from the inventory so `check:test-coverage` enforces it from now on.
- [ ] Run the gates for what changed: `bun run test`, the specific spec, `check:guide-spec-refs`, `check:test-coverage`, `check:e2e-lane-tags`.

## Stage 8: Close

- [ ] Fill the row in `ledger.md`: counts (elements, pass, fail, blocked, N/A), lens verdict summary, findings by severity, record link, status `audited`.
- [ ] If the module card exists in production-readiness, tick the criteria this audit proved and link the record.
- [ ] Report in the repo reporting format (Investigation type).

A row moves from `audited` to `signed-off` only in Phase 6 or 7, after its `fail` rows are fixed and re-verified or waived by the owner.

## Drift rule

Verdicts are tied to a SHA. Before sign-off, run `git diff --stat <audit SHA>..HEAD -- <page files>` for each page (the record lists the files). If anything changed, re-run Stages 2c to 4 for the affected inventory rows only.

## Tooling

To build in Phase 0 under `scripts/qa/` (plain Node or Bun scripts, no new dependencies beyond Playwright which is already installed). Existing tools to reuse rather than rewrite: `scripts/dev/verify-local-seed-ui.mjs` (route walker at 375 and 1280), `scripts/dev/qa-walk-hosted-dev.mjs` (walker with console, overflow and tab-bar checks), `scripts/dev/qa-probe-plan-gates.mjs`, `scripts/dev/qa-probe-rbac-nav.mjs`, `scripts/dev/audit-auth-matrix.mjs`, `scripts/dev/audit-edge-functions.mjs`, `scripts/seo/crawl-audit.ts`, `scripts/dev/seed-plan.sh`.

| Script              | Does                                                                                                                                                                                                                                                | Used in           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `route-inventory`   | Parses the route files into a flat list (path, element, guard, redirect target) and diffs it against `ledger.md` and `docs/guides/routes/`. `--check` exits non-zero on a route with no ledger row or no guide                                      | Phase 0, CI later |
| `element-inventory` | Signs in as a persona, opens a route at a viewport, optionally runs a small state script (open tab, open modal), and dumps every interactive node (role, name, disabled, href) plus console errors, failed requests and horizontal overflow to JSON | Stage 2a          |
| `edge-trace`        | Records every `/functions/v1/*`, `/rest/v1/*`, `/storage/v1/*` and `/auth/v1/*` call during a session with method, function name, status and timing (bodies redacted), grouped by the action label you pass                                         | Stage 2b, Stage 4 |
| `edge-callers`      | Greps the UI for every edge function name and prints function → calling files → routes, and lists functions with no UI caller (crons, webhooks, orphans)                                                                                            | Stage 2b, Phase 5 |

Interactive exploration uses the Playwright MCP or Playwright CLI (skills `playwright-cli`, `webapp-testing`); committed regression goes into specs, never MCP sessions.

## Skills to invoke by stage

| Stage          | Skills                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| All            | `full-app-qa`, `karpathy-guidelines`, `agent-reporting`                                                                                                                                                                                                                                                                                                      |
| 1              | `docs-first`, the domain skill for the page (`booking-workflow`, `bookings-table`, `admin-dashboard`, `multi-tenancy`, `social-inbox`, `meta-messaging`, `emails`, `notifications`, `forms`, `public-ui`, `supabase-auth`, `integrations`, `seo`)                                                                                                            |
| 3, 4           | `verify`, `playwright-cli`, `investigate-first` when a failure has an unknown cause                                                                                                                                                                                                                                                                          |
| 5              | `mobile-responsive`, `accessibility`, `impeccable` (critique and audit modes), `web-design-guidelines`, `competitive-ux-research`, `human-copy`, `minimal-ui-copy`, `performance`, `skeleton-loaders`, `plans-and-permissions`, `audit-logging`, `unsaved-changes-guard`, `security-audit` or the `security-auditor` agent for auth, PII and upload surfaces |
| 7              | `route-guides`, `documentation-maintenance`, `support-content`, `testing`                                                                                                                                                                                                                                                                                    |
| Property pages | `property-dashboard-qa` (its plan × permission matrix and deep-interaction list are a subset of this method)                                                                                                                                                                                                                                                 |
