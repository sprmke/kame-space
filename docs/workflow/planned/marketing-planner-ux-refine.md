---
title: 'Marketing Planner UX refine'
status: in-progress
tags: [workflow, planned, marketing, planner, ux]
updated: 2026-11-21
stage: in-progress
kind: plan
---

# Marketing Planner UX refine

> **For agentic workers:** implement task-by-task. Checkboxes track progress.

**Goal:** Make the Marketing Planner usable for non-technical hosts: drop the 5th Plan tab, open planning from a top-right button into one calm modal, and cut cognitive load so the path is Set up → Build → Do today's post.

**Architecture:** Keep the existing `marketing-planner` edge API, hooks, and item lifecycle. Change only studio IA and planner chrome: `MARKETING_STUDIO_TABS` returns to four creative tabs; `?plan=1` opens a `ResponsiveModal` host for `PlannerHome`; progressive disclosure collapses secondary actions into overflow menus and a short setup stepper.

**Tech Stack:** Vite React SPA, `ResponsiveModal` / `SegmentedControl` / `MarketingOverflowMenu`, TanStack Query, Playwright `@ci`, Vitest.

**Spec:** Critique below (Impeccable Operate mode) + host feedback (no 5th tab; modal; less overwhelm).

## Global Constraints

- Stick to the four creative tabs: AI Studio, Posts, Videos, Calendar.
- Mobile: bottom sheet via `ResponsiveModal`; no centered phone dialogs; overflow via sheets.
- Copy: short, plain, no em dashes, no tutor fluff (`human-copy` / `ui-minimal-copy`).
- Plans/RBAC unchanged: `marketingPlanner`, `aiMarketingPlanner`, `marketing.plan:edit`.
- activity-log: N/A for this UI-only IA change (mutations already emit).
- sentry / analytics: reuse existing planner events; no new fault surface.

## Critique (Impeccable Operate)

⚠️ DEGRADED: single-context (critique run inline so implementation can start in the same session; detector + live browser deferred to verification screenshots).

| Heuristic                   | Score | Note                                                                   |
| --------------------------- | ----- | ---------------------------------------------------------------------- |
| Visibility of system status | 2     | Status pills exist, but primary next step is unclear                   |
| Match real world            | 2     | "Prepare week", "AI plan", "Plan setup" compete as peer buttons        |
| User control                | 3     | Skip / reschedule / share exist                                        |
| Consistency                 | 2     | 5th tab breaks the established 4-tab studio; cards nest Cards          |
| Error prevention            | 2     | Setup banner + Build with no guidance when empty                       |
| Recognition vs recall       | 2     | Range + four header actions + per-card actions overload working memory |
| Flexibility                 | 3     | Power paths exist (AI rewrite, formats)                                |
| Aesthetic / minimalist      | 1     | Toolbar and card chrome feel unfinished vs Design / AI Studio          |
| Help users recover          | 2     | Errors show, but empty state is thin                                   |
| Help / docs                 | 2     | Host knowledge exists; in-UI teaching is weak                          |

**Cognitive load:** >4 visible decisions on first paint (range ×5, Build, Prepare, Setup, AI plan, plus card CTAs). Target ≤2 on first paint: primary Build/Create, everything else behind overflow or after setup.

**Priority issues**

1. Plan as a tab steals focus from creative work and forces a fifth mode.
2. First-run path is unclear (banner + Build + Setup as peers).
3. Item cards expose Skip / Create / I posted it at once.
4. Item sheet dumps every field (title, hook, caption, format, time, photos, AI tones) before the host decides to post.
5. Visual density and nested cards miss the admin craft floor.

**Strengths to keep:** rules + claims truth model; setup wizard already stepped; Share it yourself; editor handoff; Pro showcase gate.

## Review Focus

1. Stale `?tab=plan` deep links still open the planner after the tab is removed.
2. Opening Plan while an editor is focused does not break focus mode chrome.
3. Nested Confirm / item / setup flows do not trap focus inside the planner modal.
4. Free/Starter showcase still shows three items with actions disabled.
5. Mobile 375px: Plan button reachable; sheet scrolls; no second bottom bar.

---

### Task 1: Four-tab nav + `?plan=` URL

**Files:**

- Modify: `ui/src/features/dashboard/marketing/lib/theme/marketingStudioNav.ts`
- Modify: `ui/src/features/dashboard/marketing/lib/theme/marketingStudioNav.test.ts`
- Create: `ui/src/features/dashboard/marketing/lib/planner/plannerRoute.ts` (+ test)
- Modify: `MarketingThemeProvider.tsx` (migrate `tab=plan` → `plan=1`, default tab `generate`)

**Produces:** `MARKETING_STUDIO_TABS = ['generate','design','video','calendar']`; `isPlannerOpen` / `setPlannerOpen` / `migrateLegacyPlanTab`.

- [x] Unit: tabs no longer include `plan`; default without last-tab is `generate`; legacy `tab=plan` migrates.

### Task 2: Plan button + planner modal shell

**Files:**

- Create: `components/planner/PlannerModal.tsx`
- Create: `components/planner/PlannerOpenButton.tsx`
- Modify: `MarketingStudioPage.tsx`, `MarketingStudioModeTabs.tsx`
- Modify: deep links (`PlannerTodayCard`, `marketingPortfolio`, `MarketingResultsCard`)

**Produces:** Top-right **Plan** control (TierBadge when gated); large `ResponsiveModal` (`sheetLayout="split"`) hosting planner content; deep link `?plan=1&range=…`.

- [x] E2E: open Plan from button; four tabs only; legacy URL opens modal.

### Task 3: Distill PlannerHome

**Files:** Modify `PlannerHome.tsx` (+ skeleton if header shape changes)

**IA:**

1. Empty / not onboarded → one card: Set up (opens wizard).
2. Onboarded, no items → one primary **Build plan**.
3. Has items → range `SegmentedControl` + **Build plan** + overflow (Setup, Prepare week, AI upgrade).
4. Summary as one quiet line, not a heavy card stack.

- [x] Unit/E2E: Build plan visible; Prepare/Setup only via overflow (or empty-state CTA).

### Task 4: Distill PlanItemCard + item sheet

**Files:** `PlanItemCard.tsx`, `PlanItemSheet.tsx`

- Card: one primary CTA; Skip / I posted it in `MarketingOverflowMenu`.
- Sheet: preview + Open in editor first; "Edit copy" reveals fields; AI tone chips stay under edit.

- [x] E2E: Create opens sheet; Save disabled until dirty; Skip via overflow.

### Task 5: Docs + support

**Files:** `docs/guides/routes/org/property/marketing.md`, `docs/architecture/marketing-planner.md`, `docs/PROJECT.md`, dashboard deep-link notes, `docs/guides/support/faqs.md` if host Q changes, planned README row → move to in-progress when started.

### Task 6: Tests + screenshots

- Update `ui/e2e/features/marketing/planner.spec.ts`
- Vitest for nav + plannerRoute
- Capture 375 + 1024 screenshots of closed studio (4 tabs + Plan button) and open planner modal
- Gates: targeted unit + e2e planner; `type-check` / lint on touched paths

### Task 6 progress

- [x] Playwright `@ci` planner journeys (button/modal, legacy URL, range, item sheet, overflow, share, close)
- [x] Vitest: `plannerRoute`, `marketingStudioNav`, `planGateCoverage`
- [x] Screenshots: `docs/workflow/for-testing/screenshots/marketing-planner-{studio,modal}-{375,1024}.png`
- [x] Mobile sheet Close control in `PlannerModal` (bottom sheets hide default X)
- [x] `type-check` pass on touched UI

## Out of scope

- Engine / cron / AI brief schema changes
- Autopilot / Meta insights App Review
- Rebrand of Marketing Studio creative tabs
