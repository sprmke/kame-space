---
title: 'Marketing Planner — architecture'
status: active
tags: [architecture, marketing, planner, ai, plans-and-permissions]
updated: 2026-11-09
---

# Marketing Planner — architecture

The planner turns data the app already holds into a dated, ranked list of marketing items, then
carries each item to a finished post. Full product plan and phase status:
[marketing-strategy-planner.md](../workflow/in-progress/marketing-strategy-planner.md).

**Shipped:** Phase 0 (foundations) and Phase 1 (rules engine, endpoint, Plan tab).
**Not shipped yet:** Prepare, publishing and scheduling, Share it yourself, AI briefs, insights,
autopilot.

## Layering

```
marketing-planner (edge, thin)          marketing-planner-cron (planned)
  auth → leaf → plan gate → zod            verifyCronSecret
        ↓
_shared/marketingPlanner.ts (service: load inputs, run engine, persist)
   ├─ marketingSignalsData.ts  DB loads: analytics bundle, blocked nights, events,
   │                           reviews, pricing, publications, planner settings
   ├─ marketingSignals.ts      PURE  inputs → Opportunity[]
   ├─ marketingScheduler.ts    PURE  opportunities + settings + existing items → ItemDraft[]
   ├─ marketingClaims.ts       PURE  claims vs live availability/rate → ok | stale(reason)
   ├─ marketingPlaybook.ts     DATA  cadence, pillar mix, windows, opportunity catalog
   ├─ marketingCopyLibrary.ts  DATA  rules-mode copy per opportunity × language
   └─ marketingTrackedLinks.ts PURE  campaign codes, attribution sanitizing
```

Every pure module is Deno-tested with fixtures and has no clock, database or network access, the
same contract as the Smart Pricing engine.

## Data model

| Table                        | Purpose                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ |
| `marketing_planner_settings` | One row per property: goals, cadence, channels, language, reminders      |
| `marketing_calendar_events`  | Platform holidays and seasons plus host local events                     |
| `marketing_plans`            | One row per generation run, with `signals_snapshot` aggregates only      |
| `marketing_plan_items`       | Dated items with `claims` and `brief`; one live item per opportunity key |
| `marketing_post_metrics`     | Insight snapshots per publication (24h / 72h / 7d / 28d)                 |

`marketing_publications` gains `plan_item_id`, `permalink`, `media_items`, retry columns and the
`scheduled` / `publishing` / `held` / `cancelled` statuses. `guest_submissions.attribution` holds
first-touch UTM values and a plan item code, with no identifiers.

Migration: `20261324000000_marketing_planner.sql`.

## Truth rules

Every item stores `claims`. `validateClaims(claims, live)` is the only place that decides whether an
item is still honest.

| When                       | Check                               | If false              |
| -------------------------- | ----------------------------------- | --------------------- |
| Generation                 | Claims built from the live calendar | Item is not created   |
| Calendar change (Phase 3)  | Claim re-check                      | Item moves to `stale` |
| Before a publish (Phase 3) | Claim re-check                      | Publish is `held`     |

The rule for copy: rates, dates, ratings and amenities come from claims and nothing else. Rules-mode
copy is placeholder-filled from claims; the AI (Phase 4) is constrained the same way and is guarded.

## Playbook versioning

`PLAYBOOK_VERSION` ships with the code. Each `marketing_plans` row records the version it used, so a
plan can always be explained after the defaults change.

## Access

- Read: `marketing:view`.
- Write: `marketing.plan:edit` (new leaf, backfilled from `marketing.content:add` / `:edit`).
- Plan gate: `marketingPlanner` (Pro+) for generating a plan; `aiMarketingPlanner` (Business+) is
  declared for the AI phase.
- Activity: `marketing.plan_generated`, `marketing.plan_item_skipped`,
  `marketing.plan_item_posted_manually`, `marketing.planner_settings_saved` (others reserved for the
  phases that emit them).

## Privacy

Signal snapshots and brief inputs carry aggregates only: no guest names, emails or phone numbers.
Review quotes are used only when `socialSeedAllowed` is true. `property_page_views` already avoids
PII; attribution adds a campaign code only.
