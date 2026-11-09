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

**Shipped:** foundations, the rules engine and Plan tab, the setup wizard, the AI brief pass and
per-item rewrites, Share it yourself, the publish scheduler cron with claim holds, the planner cron
(weekly rules plans, expiry, reminders), tracked links with first-touch attribution, the insight
mapper, and a read-only assistant tool.
**Not shipped yet:** Prepare handoffs into the editors, carousel and Reels in the publish dialog,
insight snapshots (App Review), learned windows, autopilot.

## Layering

```
marketing-planner (edge, thin)          marketing-planner-cron        marketing-publish-scheduler-cron
  auth → leaf → plan gate → zod            verifyCronSecret              verifyCronSecret
        ↓                                       ↓                                ↓
_shared/marketingPlanner.ts (service: load inputs, run engine, persist)
   ├─ marketingSignalsData.ts  DB loads: analytics bundle, blocked nights, events,
   │                           reviews, pricing, publications, planner settings
   ├─ marketingSignals.ts      PURE  inputs → Opportunity[]
   ├─ marketingScheduler.ts    PURE  opportunities + settings + existing items → ItemDraft[]
   ├─ marketingClaims.ts       PURE  claims vs live availability/rate → ok | stale(reason)
   ├─ marketingPlaybook.ts     DATA  cadence, pillar mix, windows, opportunity catalog
   ├─ marketingCopyLibrary.ts  DATA  rules-mode copy per opportunity × language
   ├─ marketingPlanBriefAi.ts  AI    generateStructured(feature 'marketing_plan_brief')
   ├─ marketingPlanGuard.ts    PURE  AI copy grounding check
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

## AI briefs

`generate` with `mode: 'ai'` runs the rules skeleton first, then `maybeDraftPlanBriefs` rewrites the
words for those exact items. The model cannot add an item, a date, a time or a channel. Every
returned string goes through `marketingPlanGuard`, which rejects any number or month the item's
claims do not support. Rejected or unavailable AI leaves rules copy in place, and the plan records
`mode`, `credits_consumed` and the prompt id and version.

Pricing for `marketing_plan_brief` is still open (open items §2), so the router entry is marked
`PENDING-PRICING`.

The dashboard assistant exposes one read tool, `get_marketing_plan`, which returns this week's
items, their status and tracked visits. Write tools are Phase 6.

## Attribution

`useFirstTouchUtm` runs on the public property layout and stores the earliest campaign in
sessionStorage. The booking form sends it as an `attribution` field; `submit-form` sanitizes it
through `sanitizeAttribution` (allow-listed keys, length caps, relative landing path only) and
stores it on `guest_submissions.attribution`. No identifiers are involved.

## Crons

| Job                                | Schedule     | Does                                                                                     |
| ---------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `marketing-planner-cron`           | every 15 min | weekly rules plans for opted-in properties, expiry sweep, `marketing_item_due` reminders |
| `marketing-publish-scheduler-cron` | every minute | claim due publications, re-check claims, publish, retry or hold                          |

Both use `serveCronPost` and the self-healing Vault-secret pattern. Locally `cron.job` does not
exist, so the sync functions return `ok: false` and do nothing; hosted `pg_cron` schedules them.

The publish cron never publishes a post whose availability claim went false: it holds the
publication, marks the item `held`, notifies the host and writes `marketing.scheduled_publish_held`.
Retries climb `PUBLISH_BACKOFF_MINUTES` (5, 30, 180) and then fail loudly.

## Results without Meta scopes

Each item carries `tracked_url`, a relative path like
`/properties/<slug>?utm_source=…&utm_campaign=ks-<code>`. Plan reads count matching
`property_page_views` rows and attach `results.trackedVisits`, so Results works from day one. Meta
insight snapshots (`marketing_post_metrics`) land with Phase 5.4.

## Privacy

Signal snapshots and brief inputs carry aggregates only: no guest names, emails or phone numbers.
Review quotes are used only when `socialSeedAllowed` is true. `property_page_views` already avoids
PII; attribution adds a campaign code only.
