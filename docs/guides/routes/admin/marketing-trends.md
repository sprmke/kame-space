---
title: 'Marketing trends — super admin guide'
status: active
tags: [guides, routes, admin, marketing]
updated: 2026-11-10
---

# Marketing trends — super admin guide

Route: `/admin/marketing-trends`

Super-admin only (`SUPER_ADMIN_EMAILS`). Not a host surface: this page never appears on
`/support`, `/account/help`, or the guest knowledge base.

## What this page does

Moderate the daily list of what people in the Philippines are talking about, and see whether the
pipeline is healthy. Three things live here:

1. **Runs** — the last 14 attempts with their status, trigger, topic and candidate counts, and a
   pill per source (`ok` with a count, or `failed`).
2. **Add a topic** — a topic the feeds missed (a TikTok sound, a local event). It goes through the
   same classify and safety pass as a feed topic. Active for 14 days.
3. **Today's list** — the published topics with **Hide** and **Pin**.

## Behaviour

| Action                         | Effect                                                                 | Reaches hosts                                      |
| ------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------- |
| **Hide**                       | Writes a `hide` override, expiring in 14 days                          | Under a minute (read-time filter plus a 60 s memo) |
| **Unhide**                     | Deletes the override                                                   | Under a minute                                     |
| **Pin**                        | Writes a `pin` override; the topic leads the list                      | Under a minute                                     |
| **Add a topic**                | Inserts into `marketing_trend_manual_topics`, active today for 14 days | Next run                                           |
| **Remove** (under Add a topic) | Deletes the manual topic                                               | Next run                                           |
| **Run now**                    | Runs the same pipeline the cron runs, as a manual trigger              | Immediately, when it publishes                     |

**One override per topic.** `marketing_trend_overrides` is keyed on `topic_key`, so a topic is
either hidden or pinned, not both. The page hides the Pin button while a topic is hidden.

**Run now is rate limited** to one manual run every ten minutes. A second press inside that window
returns 429 with the reason.

**Step-up verification.** Every action on this page changes what all hosts see, so each one needs
the same extra email code the other sensitive console actions need. Reading the run ledger does
not. The console prompts for the code the first time and replays it for the rest of the sudo
window.

**A failed run does not clear the list.** Hosts keep seeing the last published list. The run row
says `failed`, the failing sources are listed, and `ai_error` carries the reason.

## Source health

Each run stores `source_stats`, for example:

```json
{
  "google_trends": { "ok": true, "count": 10, "ms": 420, "error": null },
  "wikimedia_ph": { "ok": true, "count": 20, "ms": 310, "error": null },
  "apple_music": { "ok": true, "count": 25, "ms": 640, "error": null },
  "netflix": { "ok": false, "count": 0, "ms": 0, "error": "cached rows are stale", "stale": true }
}
```

`stale: true` on Netflix means the weekly download has not refreshed in more than 14 days, so the
daily run ignored it. That is not a run failure: the list publishes with one source fewer.

The same breakdown appears on `/admin/health` as one row per source under **Marketing trends
list**, so a broken feed is named there too.

## Plan and permission notes

- **Plans:** no new plan key. Viewing Trends is available on every plan that has Content Studio;
  generating from a trend uses the existing AI gates. `plans-feature-matrix.md` carries a
  "Trends (view)" row.
- **Team RBAC:** no new leaf. Reading needs `marketing:view`, generating needs the existing
  `marketing.generate:*` leaves.
- **Feature availability:** the `marketing.trends` leaf is the kill switch, per property, org or
  globally. Turning it off hides the rail and the sheet for hosts, and the read endpoint answers
  `{ disabled: true }`, so no host sees an error.
- **Audit:** every action here writes a `super_admin_audit_events` row (`marketing_trend_hidden`,
  `_pinned`, `_unhidden`, `_manual_added`, `_manual_removed`, `_run_triggered`). Trends are
  platform content with no organisation, so there is no org `activity_log` row to write.

## Implementation map

| Concern          | Path                                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| Page             | `ui/src/features/dashboard/super-admin/pages/SuperAdminMarketingTrendsPage.tsx` |
| Data + mutations | `ui/src/features/dashboard/super-admin/hooks/useMarketingTrendsAdmin.ts`        |
| Route            | `ui/src/features/dashboard/super-admin/routes/index.tsx` (`marketing-trends`)   |
| Nav entry        | `ui/src/features/dashboard/super-admin/lib/superAdminPlatformNav.ts` (Platform) |
| Edge function    | `supabase/functions/admin-marketing-trends/index.ts`                            |
| Pipeline         | `supabase/functions/_shared/marketingTrends/pipeline.ts`                        |
| Publish RPC      | `supabase/migrations/20261340000300_marketing_trends.sql`                       |

## Testing

| Layer                  | Where                                                                             |
| ---------------------- | --------------------------------------------------------------------------------- |
| Publish and read rules | `supabase/functions/_shared/marketingTrends/pipeline_test.ts`, `response_test.ts` |
| Parser fixtures        | `supabase/functions/_shared/marketingTrends/sources/sources_test.ts`              |
| Manual                 | Press **Run now** on a local stack; check the run row and the host rail           |

## Related

- Architecture: [`docs/architecture/marketing-trends.md`](../../../architecture/marketing-trends.md)
- Host surface: [`../../org/property/marketing.md`](../../org/property/marketing.md)
- Health: [`../health.md`](../health.md)
