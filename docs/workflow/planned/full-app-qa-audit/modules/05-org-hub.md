---
title: 'QA packet 05: org hub'
status: planned
stage: planned
kind: reference
tags: [qa, audit, org, dashboard]
updated: 2026-11-13
---

# 05 Org hub

**Rows:** ORG-01 to ORG-16 · **Personas:** `owner`, `org-admin`, org-level read-only and operations templates, `custom`, property-only member (must not see org pages they lack), `parking` member, `stranger` · **Tiers:** Free, Starter, Pro, Business · **Environments:** L; P on the test tenant for read pages and reversible settings.

Audit after the property wave: most org pages are rollups, and a rollup can only be judged when the per-property numbers are understood.

## References

Guides under `docs/guides/routes/org/` (not `property/` or `parking/`). Architecture: `plans-feature-matrix.md`, `ai-dashboard-assistant.md`, `contextual-help.md`, `feature-availability.md`. Manual guides: `org-hub-playwright.md`, `plans-playwright.md`, `property-team-rbac-playwright.md`, `ai-dashboard-assistant-manual.md`. Skills: `multi-tenancy`, `plans-and-permissions`, `admin-dashboard`. Specs: `ui/e2e/features/org` (5), `dashboard` (8), `plans` (8), `team` (3), `assistant` (7), `analytics` (1). `for-testing` plans: `org-portfolio-analytics-redesign`, `org-granular-team-permissions`, `org-activity-audit-log`, `property-settings-copy-to-properties`, `ai-companion-response-quality-and-generative-ui`, `help-support-center`, `host-analytics-module`.

## Probe beyond the generic lenses

- **Rollup truth (ORG-01, 02, 08, 10):** for every stat card, chart and table, compute the expected value from the property-level pages and the DB for the selected date range. Check range presets, custom range, Manila day boundaries, an org with one property, with many, with an archived property, with parking only. A member who can see only some properties must see rollups for only those.
- **Dashboard (ORG-01):** stat cards, board layout at `lg+`, revenue chart, booking status, recent bookings, pending actions (each links to the exact item), listings performance.
- **Properties (ORG-03):** card and list views, filters, stats period, the actions menu (every action), add property with plan property limits, copy settings to other properties (dry run and apply, which sections copy, C10), lifecycle actions (pause, archive, delete) and their effect everywhere (C12).
- **Parkings (ORG-04):** list, add, claim flows, link to developments.
- **Team (ORG-05):** tabs, invite dialog, new and edit role dialog with the full leaf tree, manage member dialog, member activity history, seat limits by tier, custom roles gate, owner transfer if present (C15).
- **Plans (ORG-06):** tier ladder equals the public pricing page and the feature matrix; checkout (PayMongo sandbox or mocked), upgrade, downgrade with the guide's "Known gaps" re-checked, cancel, lapse and grace, invoices, enrollment of properties (C16).
- **Settings (ORG-07):** each card and save path, the unified AI card (hosts get a toggle only; limits are super-admin only), payment details behind OTP, verification documents, unsaved-changes guard per card (C34).
- **Activity (ORG-09):** every event type from every module appears with correct actor, scope and wording; filters; pagination; retention cron; a member sees only what their scope allows.
- **Announcements (ORG-11), Help and support (ORG-12):** list, detail, unread state, docs search, ticket workspace (create, reply, attach, close), redirect behavior from help-support (C20, C33).
- **AI mode (ORG-14):** mode toggle and persistence, rail (rename, pin, archive, delete, search), composer, briefing cards, page canvas (resize, split, chat only), `open_page` handoffs, feedback, phone and tablet layouts. Every action the assistant can take must pass the same leaf and plan checks as the UI (J29). Plan gate `aiDashboardAssistant`; credit metering and exhaustion.
- **Shell (ORG-16):** sidebar items by role and tier, scope switcher across org, property and parking, intent prefetch does not warm the wrong chunk, mobile tab bar and More sheet, notification bell, account menu, banners (verification, suspended, plan lapse, offline, update available), contextual help hints, keyboard shortcuts.

## Hidden surfaces

`dashboard-*`, `analytics-*`, `org-*`, `list-*` and plan functions, `platform-billing-cron`, `analytics-ai-review-cron`, `activity-log-retention-cron`, `superhost-assessment-cron`, PayMongo checkout and webhook for subscriptions, the assistant tool catalog and its permission-leaf parity tests.

## Connections and journeys

Reader of C01, C02, C04, C07, C22; source of C12, C15, C16, C34. J06, J07, J13, J24, J25 (as consumer), J26, J29.

## Known risks

- Org-level RBAC has the thinnest test coverage of the three levels.
- Intent prefetch once warmed the wrong chunk across scopes; verify per scope.
- Plans guide has a "Known gaps (flagged)" section; each gap is a finding candidate to confirm or close.
