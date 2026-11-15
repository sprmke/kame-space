---
title: 'Full-app QA audit: factor catalog'
status: planned
stage: planned
kind: reference
tags: [qa, audit, checklist]
updated: 2026-11-13
---

# Factor catalog

Every page gets a verdict on every lens: `pass`, `fail` (finding IDs), `blocked` (why), or `N/A — <why>`. A lens with no verdict means the page is not audited. Lenses F01 to F05 are also applied per element in Stages 3 and 4 of [`method.md`](./method.md); the rest are page-level.

The 16 production-readiness module criteria map onto these lenses (noted as `PR#n`), so one audit fills both.

## A. Function

### F01 Functional correctness (PR#1)

- Every inventory element does what the guide and the user would expect, on happy and main unhappy paths.
- Computed values are right: totals, nights, fees, discounts, taxes, balances, percentages, counts, badges. Recompute at least three by hand per page that shows money.
- Sorting, filtering, search, pagination and date ranges return the right rows, including at boundaries and when combined.
- Nothing is a stub: no button that does nothing, no "coming soon" that is not labeled, no placeholder data.

### F02 End-to-end chain (the pass rule)

- Each write is traced through request, server, data, side effects and connected surfaces (Stage 4).
- Each read that depends on another page's write shows fresh data after that write without a hard refresh where the product promises it, and after refresh always.
- Undo, edit, delete and cancel unwind every side effect.

### F03 Navigation and links

- Every link, button navigation, breadcrumb, back control, tab and deep link lands on the right route with the right scope (org, property, parking slugs preserved; never a bare legacy path such as `/bookings`).
- Browser back and forward, reload and "open in new tab" work on every state that has a URL.
- External links open correctly and safely (`rel`, target), and `mailto:`, `tel:`, map and social links are well formed.
- Redirects land where the guide says and keep the query string when they should.
- Not-found, no-access and wrong-tenant states are distinct and never leak whether a resource exists.

### F04 Forms and validation (PR#5)

- Client validation matches server validation; the server rejects everything the client would, and anything a hand-built request can send.
- Errors are next to the field, plain, and tell the user what to do. The first invalid field is focused and scrolled into view.
- Required, optional, defaults, placeholders, input types, `autocomplete`, `inputmode` and mobile keyboards are right.
- Multi-step forms keep state across steps, back, reload and (where promised) across devices.
- Uploads: type and size limits, progress, cancel, retry, replace, remove, preview, EXIF orientation, optimization, and server-side sniffing.

### F05 States and resilience (PR#8)

- Loading uses skeletons that match the final layout (no layout shift, no spinner-only full pages where a skeleton rule applies).
- Empty states say what the page is for and offer the first action.
- Error states show a reason and a retry; a failed mutation leaves the form intact.
- Slow network (throttle to Slow 4G), offline, request timeout, expired session mid-action, edge 429 and 5xx all degrade without data loss or an infinite spinner.
- Double submit, concurrent edit from two tabs, and stale data after a background change are handled.
- Unsaved-changes guard on every manual-save form, card, editor and modal (`useUnsavedChangesGuard` / `useGuardedClose`), including browser back and tab close (PR#9).

## B. Access and tenancy

### F06 Roles and permissions (PR#2)

- For each persona: nav visibility, direct-URL access, read-only rendering, and each write control are correct per the permission catalogs.
- The **server** enforces each leaf. Prove it by replaying the request as a persona without the leaf.
- Owner-only and super-admin-only actions are refused for everyone else, including org admins with Full Access.
- Invited member lifecycle: pending, accepted, role changed while signed in, removed while signed in.

### F07 Plan gates and entitlements (PR#3)

- Each gated feature behaves per `docs/architecture/plans-feature-matrix.md` on Free, the minimum tier, and one below it: upgrade affordance, tier badge, no request fired below tier, correct Plans link.
- The server enforces the gate (upgrade envelope), not only the UI.
- Downgrade: existing data created on the higher tier is still readable and behaves as documented; limits (seats, properties, AI credits) are enforced at the boundary, not one past it.
- Feature-availability switches from `/admin/feature-availability` hide or disable the surface everywhere it appears.

### F08 Tenant isolation (PR#4)

- Swap `orgSlug`, `propertySlug`, `parkingSlug` and entity IDs for another tenant's as a valid host: no data, no write, no difference in response that reveals existence.
- Guest tokens: invalid, expired, reused, and another booking's token.
- Property-scoped data never appears on a sibling property; parking and property scopes do not bleed.
- Storage objects and signed URLs are not readable across tenants or by anon when they should not be.

### F09 Auth and session

- Signed-out visit to a protected route goes to the right login (host vs guest) and returns to the original URL after sign-in.
- Host and guest identities do not cross: a guest session cannot open the dashboard, a host session behaves correctly on guest-account pages.
- Step-up (OTP) prompts appear where required (payment settings, super-admin) and cannot be bypassed.
- Session expiry and sign-out from another tab are handled.

## C. Experience

### F10 Mobile and responsive (PR#7)

- 375, 768, 1024 and 1440: no horizontal scroll, no clipped or overlapping content, no text under fixed bars, safe-area insets respected.
- Phone follows the native rules: bottom sheets instead of centered modals, bottom tab bar, large touch targets (44px), sticky primary action, no hover-only affordances.
- Tables have a phone layout (cards or priority columns). Long names, long numbers and long translated strings wrap or truncate with a way to see the full value.
- Orientation change, on-screen keyboard covering inputs, pull-to-refresh and swipe-back do not break the page.
- Real-device behavior for the PWA shell is covered by `docs/guides/testing/pwa-device-qa.md` and recorded as `blocked` if no device run exists.

### F11 Visual quality and consistency

- Alignment, spacing, typography scale, color tokens, radius, shadows and icon sizes follow `DESIGN.md`; compare against sibling pages for the same pattern (headers, cards, tables, filters, modals per `docs/architecture/modal-chrome.md`).
- No green-on-green, low-contrast text, mixed icon sets, orphaned headings, double borders, uneven card heights or mismatched skeletons.
- Images: correct aspect, no stretch, lazy below the fold, a fallback when missing.
- Dark surfaces, brand areas and charts are legible.
- The page does not look templated or unfinished. Use `impeccable` critique mode and say plainly what looks cheap.

### F12 UX and task flow

- State the persona's top jobs and count the steps. Flag anything over three taps for a daily job.
- The primary action is obvious; destructive actions are separated and confirmed; nothing irreversible happens without a confirm and a clear consequence.
- Information hierarchy: the most important number or status is seen first; secondary detail is progressive.
- The page answers "what happened?" after every action and "what do I do next?" in every state.
- Cross-module continuity: after an action that continues elsewhere, the user is taken or pointed there.
- Record what is confusing, redundant, missing or would be better removed. Opinion is wanted here; label it as opinion.

### F13 Copy and content

- Short, plain, production-grade, no AI tells, no em dashes, no lorem, no developer terms, no internal IDs (skills `human-copy`, `minimal-ui-copy`).
- Terminology is consistent with `docs/GLOSSARY.md` and with the same concept on other pages.
- Dates, times (Asia/Manila), currency (PHP formatting), plurals, and numbers are formatted consistently.
- Page title (`usePageTitle`), favicon, meta description and social card are right (PR#10).
- Help: `InfoHint` and contextual help are present where a non-technical host would need them and say something true.

### F14 Accessibility (PR#11)

- Keyboard only: every control reachable, visible focus, logical order, no trap, Escape closes overlays, focus returns to the trigger.
- Semantics: one `h1`, ordered headings, landmarks, labels on every input, names on icon buttons, table headers, live regions for async results.
- Contrast AA, text resizes to 200%, respects reduced motion.
- Axe run with zero serious or critical violations; screen-reader spot check on the primary job.

## D. Engineering

### F15 Performance (PR#12)

- Cold load and warm navigation within `performance-budgets.json`; LCP, INP and CLS measured on the production build for public pages.
- No unbounded list, no fetch-all then filter in memory, pagination or virtualization on anything that grows.
- No request waterfalls that could be parallel, no duplicate requests, no refetch storms on focus, sensible `staleTime`.
- Route chunk does not pull a heavy dependency it does not use (pdf.js, Konva/Polotno, charts, Remotion).
- Images sized and compressed; fonts and third-party scripts do not block.

### F16 Data integrity

- Writes are atomic where they must be; a failed side effect does not leave a half-applied state without a visible warning.
- Idempotency on retries and webhooks; no duplicates from double submit.
- Date handling across the `MM-DD-YYYY` DB text format and `YYYY-MM-DD` UI format; Manila midnight vs UTC midnight boundaries; month ends; leap day.
- Money: integer vs decimal handling, rounding, currency, negative values, refunds exceeding payments.
- Overlap and double-booking protection, including concurrent submissions.
- Derived data (counters, rollups, search index, public cache) matches the source rows after every write path.

### F17 Security and privacy

- No secrets, tokens, service keys or PII in the bundle, console, URL, logs, analytics events or error reports.
- Inputs rendered as text, not HTML; rich text and templates are sanitized; no open redirect via `next` or `returnTo` params.
- Uploads are sniffed server-side; signed URLs are short-lived; private buckets are private.
- Rate limits and captcha on public write endpoints and auth.
- Guest PII (IDs, selfies, signatures, vehicle plates) is shown only to roles that need it, and retention and purge behave as documented.
- Use the `security-auditor` agent or `security-audit` skill for auth, PII and upload surfaces.

### F18 Audit trail and observability (PR#6, PR#13)

- Every mutating capability writes one `activity_log` event with the right actor, scope and readable summary, visible on the Activity page at each level, or is documented `activity-log: N/A`.
- Errors reach Sentry with useful context and no PII; expected errors (validation, 403) do not flood it.
- Analytics events fire once, with the documented names, and respect cookie consent.
- Crons, webhooks and background jobs that the page depends on are registered in `/admin/health` and their failures are visible.

### F19 Code and architecture

- Feature layout respected (`features/{guest|dashboard}/{module}/…`), no cross-feature barrels, named exports, naming conventions.
- Status transitions go through `workflowOrchestrator.transition()`; no inline email, calendar or sheet side effects in handlers.
- Edge functions use `serveAdmin` / `servePublic` / `serveCronPost`; auth check is the first line; email-sending functions have `static_files`.
- Client and server mirrors agree (`statusMachine.ts` vs `workflow.ts`, plan features, permission catalogs).
- No dead code, duplicated logic, TODOs that hide a bug, or `any` on money and auth paths.

### F20 Automated test coverage (PR#14)

- Each inventory element that carries risk has a test at the cheapest layer that can prove it.
- Existing tests for the page actually assert behavior (not export-only, not a smoke that would pass on a broken page). Try breaking the behavior locally and confirm a test fails for at least the top three elements.
- Mocks match real responses (compare the E2E mock body with the live local response).
- No orphan spec (untagged, skipped without an issue, quarantined past expiry).

### F21 Documentation (PR#15)

- The route guide matches reality section by section, including Progress overview, Testing table and Host-facing knowledge.
- `faqs.md` and the in-app Help Center say the same thing as the page.
- Architecture docs, rules and env var lists that mention the page are still true.

## E. Platform

### F22 Integrations and background work (PR#16)

- Every third party the page touches is verified live, or verified mocked and marked `blocked` for live with the operator need named: PayMongo, Meta, Telegram, Resend (outbound and inbound), Google (OAuth, Calendar, Sheets, Maps), Gemini and Groq, web push, IndexNow.
- Failure of the third party is handled: timeout, 4xx, revoked token, quota.
- Secrets, cron schedules and Vault entries the page needs exist in the production env matrix.

### F23 SEO and sharing (public pages only)

- Title, description, canonical, robots, Open Graph and Twitter tags, JSON-LD, sitemap entry, hreflang if any, per `docs/architecture/seo.md`.
- One `h1`, crawlable links, meaningful alt text, no content that exists only after interaction.
- Private, tokenized, dashboard and dev routes are `noindex` and absent from the sitemap. The test tenant never appears.
- Shared link preview renders correctly.

### F24 PWA and offline

- The route is in the PWA route registry with the right caching strategy; an update prompt does not lose form state.
- Offline shows the documented fallback; queued or blocked writes are honest about it.
- Install, splash, standalone chrome, deep links from push notifications land on the right page.
- Verified against a production build (`bun run build && cd ui && bun run preview`), since the service worker is off in dev.

## Lens applicability by page archetype

Archetypes are the ones defined in the test architecture plan. `●` required, `○` light check, blank N/A.

| Lens                     | R redirect | S static | P public data | G guest op | DR dash read | DW dash write | WF workflow | SA super-admin | X integration |
| ------------------------ | ---------- | -------- | ------------- | ---------- | ------------ | ------------- | ----------- | -------------- | ------------- |
| F01 Function             | ●          | ○        | ●             | ●          | ●            | ●             | ●           | ●              | ●             |
| F02 Chain                |            |          | ○             | ●          | ○            | ●             | ●           | ●              | ●             |
| F03 Navigation           | ●          | ●        | ●             | ●          | ●            | ●             | ●           | ●              | ●             |
| F04 Forms                |            |          | ○             | ●          | ○            | ●             | ●           | ●              | ●             |
| F05 States               |            | ○        | ●             | ●          | ●            | ●             | ●           | ●              | ●             |
| F06 Roles                |            |          |               | ○          | ●            | ●             | ●           | ●              | ●             |
| F07 Plan gates           |            |          | ○             | ○          | ●            | ●             | ●           |                | ●             |
| F08 Tenancy              |            |          | ○             | ●          | ●            | ●             | ●           | ●              | ●             |
| F09 Auth                 | ●          |          | ○             | ●          | ●            | ●             | ●           | ●              | ●             |
| F10 Mobile               |            | ●        | ●             | ●          | ●            | ●             | ●           | ○              | ●             |
| F11 Visual               |            | ●        | ●             | ●          | ●            | ●             | ●           | ○              | ●             |
| F12 UX                   |            | ○        | ●             | ●          | ●            | ●             | ●           | ○              | ●             |
| F13 Copy                 |            | ●        | ●             | ●          | ●            | ●             | ●           | ○              | ●             |
| F14 A11y                 |            | ●        | ●             | ●          | ●            | ●             | ●           | ○              | ○             |
| F15 Performance          |            | ○        | ●             | ●          | ●            | ●             | ●           | ○              | ○             |
| F16 Data integrity       |            |          | ○             | ●          | ●            | ●             | ●           | ●              | ●             |
| F17 Security             |            |          | ●             | ●          | ●            | ●             | ●           | ●              | ●             |
| F18 Audit, observability |            |          | ○             | ●          | ○            | ●             | ●           | ●              | ●             |
| F19 Code                 | ○          | ○        | ●             | ●          | ●            | ●             | ●           | ●              | ●             |
| F20 Tests                | ●          | ●        | ●             | ●          | ●            | ●             | ●           | ●              | ●             |
| F21 Docs                 | ○          | ●        | ●             | ●          | ●            | ●             | ●           | ●              | ●             |
| F22 Integrations         |            |          | ○             | ●          | ○            | ○             | ●           | ○              | ●             |
| F23 SEO                  |            | ●        | ●             | ○          |              |               |             |                |               |
| F24 PWA                  |            | ○        | ●             | ●          | ●            | ●             | ●           |                | ○             |
