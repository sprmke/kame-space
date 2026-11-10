---
title: 'Marketing Trends — daily ranked Philippine trending topics'
status: active
tags: [architecture, marketing, ai, cron]
updated: 2026-11-10
---

# Marketing Trends — daily ranked Philippine trending topics

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split. Plan of record:
[`../workflow/in-progress/marketing-trending-topics.md`](../workflow/in-progress/marketing-trending-topics.md).

## What it is

A ranked list of what people in the Philippines are talking about **today, this week and this
month**, rebuilt once a day by a scheduled job, checked for safety, and shown inside Marketing
Content Studio. Every topic arrives with three ready-made angles, so one tap fills the AI Studio
create form (or copies a caption) instead of leaving the host on a blank page.

The split is the same as Smart Pricing: **the code ranks, the AI writes.** Deterministic
normalization, merging and scoring decide the order; one ungrounded model call a day adds the
category, the safety verdict, how well the topic fits a stay, the summary, the angles and the
caption idea.

## Why it exists

Hosts struggle to write posts that land. A post tied to something the country is already
watching gets reach for free. Marketing Content Studio knew the property but nothing about the
world outside it.

## Sources

Five free, keyless sources at launch. Each is one adapter file with the same
`{ ok, items, ms, error }` contract, so adding a source later is one file plus one line in the
registry.

| Source                           | Endpoint                                               | Weight | Cadence                   | Covers                                                                    |
| -------------------------------- | ------------------------------------------------------ | ------ | ------------------------- | ------------------------------------------------------------------------- |
| Google Trends "Trending now" RSS | `trends.google.com/trending/rss?geo=PH`                | 1.0    | daily                     | What Filipinos search today; catches TikTok and X virality one step later |
| Wikimedia top per country (PH)   | `wikimedia.org/api/rest_v1/…/top-per-country/PH/…`     | 0.8    | daily                     | Celebrities, TV, sports, film (about a day behind)                        |
| Wikimedia top, Tagalog Wikipedia | `…/top/tl.wikipedia/…`                                 | 0.5    | daily                     | Local celebrities and shows the English list misses                       |
| Apple Music PH most played       | `rss.marketingtools.apple.com/api/v2/ph/…`             | 0.5    | daily                     | OPM and music trends, the closest free signal to a TikTok sound           |
| Netflix Top 10 (PH rows)         | `netflix.com/tudum/top10/data/all-weeks-countries.tsv` | 0.6    | weekly (Wed 04:00 Manila) | What people binge this week                                               |

**Not used, and why.** X, TikTok, Facebook and Instagram have no free trends API; the
third-party routes are paid scrapers built on unofficial access. Reddit's Data API needs OAuth
and commercial approval. Google News RSS is mostly hard news and its feed terms are personal or
non-commercial. Bluesky and Mastodon trend endpoints are global, not Philippine. GDELT
rate-limits at one request per five seconds and is news-heavy. Full evaluation, including the
Python and self-hosted tools that were rejected, is in the plan's §3.6.

**Grounding is deliberately not used** for the shared list. The Gemini API terms allow grounded
results to be shown only to the person who sent the prompt, and this list is cached and shown to
every host. A per-host "Research this topic" button with grounding is a possible follow-up after
a terms review.

## Flow

```
pg_cron 05:30 Manila
  └─ marketing-trends-cron
       1 fetch      Promise.allSettled over the daily adapters, 8 s timeout each
       2 normalize  fold diacritics, strip wiki disambiguators, stoplists, merge
       3 pre-filter deterministic unsafe-keyword denylist (news sources only)
       4 classify   one generateStructured call: merge, category, safety,
                    stayFit, summary, 3 angles, caption idea
       5 rank       source rank x weight, cross-source bonus, momentum, stay fit
       6 publish    one Postgres RPC: today rows plus the week and month windows
pg_cron Wed 04:00 Manila
  └─ marketing-trends-weekly-cron
       streams the 33 MB Netflix TSV, keeps the newest Philippine week
hosts ── GET marketing-trends?window=today ──▶ the latest published list
```

**Publish is one RPC, not a JS transaction.** `publish_marketing_trend_run(...)` takes a
transaction-scoped advisory lock, marks an older published run of the same date `skipped`,
inserts the day's rows, computes the week and month windows from the previous 30 published runs
and marks the run published. A transaction-scoped lock cannot be held across separate Supabase
JS calls, so this must be SQL.

**No AI review, no new list.** If the classify call fails, or fewer than five topics survive the
safety pass, the run is marked `failed` and hosts keep seeing the last published list.

## Scoring

`_shared/marketingTrends/score.ts`, pure and unit-tested.

- **Per source:** `weight / sqrt(rank)`, plus `log10(traffic)/10` for a Google traffic bucket.
- **Cross-source bonus:** `1.3^(distinctSources - 1)`. This is the main de-noise signal, and it
  counts distinct sources, so one source cannot contribute twice.
- **Momentum:** `new` ×1.15 when the key was not there yesterday, `rising` ×1.1 when it moved up,
  `steady` ×1.0 otherwise.
- **Stay fit:** 0 excluded, 1 ×0.6, 2 ×1.0, 3 ×1.3. A topic with no honest connection to a stay
  never ships.
- **Windows:** this week and this month are decayed sums (`0.85^age` / `0.93^age`) over the last
  7 / 30 published runs, computed inside the publish RPC so a host read is one indexed query.

Momentum needs a position and the position needs a score, so `rankTodayTopics` runs in two
passes: rank without momentum, read momentum off that position against yesterday, then apply the
multiplier and sort once more. The stored score is what the RPC re-sorts by.

## Safety

Two layers, both required.

1. **Deterministic denylist** (`safetyDenylist.ts`) on news-derived sources only. Whole-word
   matching, English plus Filipino terms: deaths, crime, disaster, weather emergencies,
   politics, gambling, data breaches, economic distress. Music and Netflix titles skip it on
   purpose: the OPM song "Ako ang bagyo" is not about a storm.
2. **The AI pass** judges the topic, not the words, and blocks anything with no honest angle.
   When in doubt it blocks. The validator then re-runs the deterministic list over the model's
   own title, summary and caption, so a blocked word cannot arrive through the model instead.

**Brand rules.** A host may mention a trend, never imply a partnership, use a real person's face
or a show, network or team logo. `brandGuard.ts` enforces this twice: the prompt block asks for
it, and the deterministic check drops poster variants and captions that say "official",
"sponsored", "in partnership with", or name a person. Celebrity, TV and music topics also get
"no recognizable real people, no logos" in the image and clip prompts.

## Data model

Five tables plus one column. RLS is on with no policies, so only the service role (the edge
functions) reads or writes.

| Table                           | Role                                                                    |
| ------------------------------- | ----------------------------------------------------------------------- |
| `marketing_trend_runs`          | One row per attempt: date, status, trigger, per-source stats, AI cost   |
| `marketing_trend_topics`        | The published lists. One row per topic per window                       |
| `marketing_trend_overrides`     | Super-admin moderation. `hide` / `pin`, expiring in 14 days             |
| `marketing_trend_manual_topics` | Topics added by hand, active for 14 days                                |
| `marketing_trend_source_cache`  | Slow sources (Netflix today). The daily run reads this, not the network |

`marketing_ai_sessions.trend_topic_key` records which topic a creation came from, for "made from
a trend" reporting.

Details: [`data-model.md`](./data-model.md).

## Host read path

`marketing-trends` (`GET ?property_id=&window=`).

- `resolveScopedPropertyAccess(req, 'marketing:view')`. Viewing is not plan-gated: Trends drives
  use of a module the host already pays for.
- `marketing.trends` feature-availability leaf is the super-admin kill switch. When it is off the
  endpoint answers `{ disabled: true }` and the rail hides itself rather than showing an error.
- A hide applies at read time, so it reaches hosts in under a minute (per-isolate memo, 60 s TTL).
- No usable list (none yet, or older than 72 h): `fallback: 'evergreen'` and the client shows the
  bundled seasonal ideas. The read rules live in `_shared/marketingTrends/response.ts` and are
  unit-tested without a database.

## Adding a source

1. Add an adapter in `_shared/marketingTrends/sources/` returning `TrendSourceResult`. Use
   `runSource` and `fetchText`/`fetchJson` from `sources/http.ts` so timeouts and the
   User-Agent are consistent.
2. Add the id to `TrendSourceId` and `SOURCE_LABELS`.
3. Add it to `DAILY_TREND_SOURCES` (or make it a cached weekly source) with its weight.
4. Save a real fixture under `supabase/functions/tests/fixtures/marketing-trends/` and add a
   parser test. Parsers are strict about shape and lenient about content: a missing required
   field drops that item, never the source.
5. If it is news-like, add it to `NEWS_DERIVED_SOURCES` so the denylist applies.

## Failure behaviour

| Failure                                      | Behaviour                                                  | Host sees                              |
| -------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| One source down or slow                      | `source_stats` records it; the run continues with the rest | Normal list                            |
| All sources down                             | Run `failed`, Sentry event                                 | Last good list, labelled with its date |
| Model and Groq both fail, or < 5 safe topics | Run `failed`, nothing partial published                    | Last good list                         |
| Cron did not fire                            | `/admin/health` warns past 36 h, errors past 72 h          | Last good list, then seasonal ideas    |
| Duplicate cron fire                          | Advisory lock plus the same-date check                     | One list, never two                    |
| Netflix job failed or the TSV changed        | Cache keeps the last good week; ignored past 14 days       | Normal list, one source fewer          |
| Apple or Wikimedia moves its endpoint        | Non-JSON or non-XML body counts as a source failure        | Normal list                            |

## Operations

- Run history, source health, hide, pin, add a topic and **Run now** live on
  `/admin/marketing-trends` (super admin).
- The cron is registered by `public.sync_marketing_trends_cron_job()` and
  `…_weekly_cron_job()`; both tolerate a project without `pg_cron` or Vault.
- Vault secret: `marketing_trends_cron_secret`, sent as `X-Marketing-Trends-Cron-Secret` and
  read from `MARKETING_TRENDS_CRON_SECRET`.
- The AI call is platform cost with no organisation, so it is not charged to a host. Token
  counts and the estimated cost land on the run row and the admin page.

## Related

- Route guide: [`docs/guides/routes/org/property/marketing.md`](../guides/routes/org/property/marketing.md)
- Admin guide: [`docs/guides/routes/admin/marketing-trends.md`](../guides/routes/admin/marketing-trends.md)
- Feature availability: [`feature-availability.md`](./feature-availability.md)
- AI platform: [`ai-platform.md`](./ai-platform.md)
- Scheduled jobs: [`docs/archive/operations/scheduled-jobs-and-testing.md`](../archive/operations/scheduled-jobs-and-testing.md)
