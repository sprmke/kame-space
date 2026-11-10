---
stage: planned
title: 'Marketing Trends: daily ranked Philippine trending topics that hosts turn into posts'
status: planned
tags: [workflow, planned, marketing, ai, cron, trends, plans-and-permissions, super-admin]
updated: 2026-11-10
kind: plan
---

# Marketing Trends: daily ranked Philippine trending topics that hosts turn into posts

> **Revised 2026-11-10:** added the open-source and self-hostable research (§3.6). Three new free sources were probed and adopted: Tagalog Wikipedia top pages, the Apple Music Philippines chart, and the Netflix Philippines weekly top 10 (via a weekly job). Added `compromise` (MIT) for entity extraction in the no-AI path. Recorded why Python libraries (`trendspyg`, `trend-pulse`), self-hosted aggregators (RSSHub, DailyHotApi, TrendRadar) and unofficial scrapers (TikTok-Api, twscrape, twikit) are reference-only, deferred or rejected.

## 1. Goal

Hosts struggle to make posts that people engage with. Posts tied to what the country is talking about right now get more reach, for example a "PBB watch-party staycation" post while _Pinoy Big Brother: Collab 3.0_ is trending. Today, Marketing Content Studio knows the property but nothing about the world outside it.

This plan adds **Trends**: a ranked list of what is trending in the Philippines **today, this week and this month**, rebuilt once a day by a scheduled job, checked for safety, and shown inside Marketing. Every topic comes with ready-made, property-safe angles. One tap opens AI Studio (or the Posts editor) already filled in, so the host gets a finished draft instead of a blank form.

**Hard requirements from the request:**

| Requirement            | How this plan meets it                                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free, no new cost      | 5 free, keyless sources at launch (Google Trends RSS, Wikimedia EN + Tagalog, Apple Music PH chart, Netflix PH top 10). No paid scrapers, no self-hosted servers. One **ungrounded** Gemini Flash-Lite call per day on platform billing, a fraction of a cent (§3.3, §3.6). |
| Updated daily          | `marketing-trends-cron` once a day at 05:30 Manila, through hosted `pg_cron` + `pg_net`.                                                                                                                                                                                    |
| Ranked, one final list | Deterministic cross-source score × AI "fits a stay" rating, deduped into one list per window (§4.3).                                                                                                                                                                        |
| Never a broken UI      | A 3-layer fallback: today's list, then the last good list (labeled with its date, up to 72 h old), then built-in evergreen Philippine ideas. Each source fails on its own without breaking the run (§4.5).                                                                  |
| No performance cost    | Hosts read one precomputed snapshot (≤ 75 rows, ~15 KB), cached at edge and client. The UI chunk is lazy-loaded and fetched only when Trends is opened or the chip rail scrolls into view (§4.7).                                                                           |
| Production ready       | Idempotent cron, per-source timeouts, run ledger, staleness alert on `/admin/health`, super-admin moderation (hide, pin, add), evals, unit + handler + mocked E2E tests.                                                                                                    |

## 2. Scope

**In**

- Daily ingestion from free sources, normalization, cross-source dedupe, scoring, AI classification (category, safety, stay fit, summary, angles, caption idea), publish, prune.
- Today / This week / This month lists computed at publish time.
- Host UI in Marketing: a **Trending today** chip rail at the top of AI Studio, plus a **Trends** sheet with the full ranked list and filters.
- Handoff to AI Studio (Post, Photo, Clip) and the Posts editor, with **server-side** trend context and brand-safety rules in the generation prompts.
- No-credit path: **Copy caption idea** works on every plan.
- Super-admin page `/admin/marketing-trends`: run history, source health, hide / pin / add a topic by hand, **Run now**.
- Staleness check on `/admin/health`, PostHog events, Sentry on cron failure.
- Docs, Help Center Q&A, FAQ, evals, tests.

**Out (this plan)**

- Direct TikTok, X, Facebook or Instagram trend feeds. None of them has a free official API (§3.2). Coverage comes from proxies plus manual super-admin topics.
- Google Search **grounding** in the shared daily list (terms forbid sharing or caching it, §3.4).
- Per-host trend notifications or a weekly trends digest (Phase 5 follow-up).
- Feeding trends into the Strategy Planner (a planner follow-up, §6 Phase 5).
- Regions below country level (Cebu, Davao). Google Trends RSS is country-only.

## 3. Research findings

### 3.1 Free sources, probed live on 2026-11-09 and 2026-11-10

| Source                                                                | Endpoint                                                                                             | Auth / cost                                                 | Probe result                                                                                                                | Covers                                                                                   | Use                                                                                                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Google Trends "Trending now" RSS**                                  | `https://trends.google.com/trending/rss?geo=PH`                                                      | none, free                                                  | `200`, ~20 KB, ~20 items with `ht:approx_traffic` (e.g. `500+`) and related news items                                      | What Filipinos search today. Picks up TikTok/X spillover (people google what goes viral) | **Primary**                                                                                            |
| **Wikimedia pageviews, top per country**                              | `https://wikimedia.org/api/rest_v1/metrics/pageviews/top-per-country/PH/all-access/{yyyy}/{mm}/{dd}` | none, free (descriptive `User-Agent` required)              | `200`; Nov 7 rank 6 = `Pinoy_Big_Brother:_Collab_3.0`, also `Alexandra_Eala`                                                | Celebrities, TV shows, sports, films. About 1 day behind                                 | **Primary**                                                                                            |
| **YouTube Data API v3** `videos.list?chart=mostPopular&regionCode=PH` | `https://www.googleapis.com/youtube/v3/videos`                                                       | free API key, 10,000 units/day; this call costs 1           | not probed (needs a key)                                                                                                    | Music videos, shows, creators                                                            | **Optional** (Phase 5), only when `YOUTUBE_DATA_API_KEY` is set                                        |
| **Wikimedia pageviews, Tagalog Wikipedia top**                        | `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/tl.wikipedia/all-access/{yyyy}/{mm}/{dd}`   | none, free (same `User-Agent` rule)                         | `200`; Nov 8: `Gehlee` #1, `Raheel_Bhyria` #4, `Pinoy_Big_Brother:_Collab_Edition_3.0` #5                                   | Local celebrities, PBB housemates and shows the English list misses                      | **Primary** (same parser as the per-country call; drop `Natatangi:*`, `Unang_Pahina`)                  |
| **Apple Music RSS feed generator**, PH most played                    | `https://rss.marketingtools.apple.com/api/v2/ph/music/most-played/25/songs.json`                     | none, free, official Apple feed                             | `200`, updated same day (`Na Para Bang` / Mariah Deborah, `XXL` / LANY…). Old host `rss.applemarketingtools.com` now `301`s | OPM and music trends (the closest free signal to TikTok sounds)                          | **Adopt** (weight 0.5); use the new host and follow redirects                                          |
| **Netflix Top 10 by country** (weekly TSV)                            | `https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv`                                   | none, free public download                                  | `200`, **33 MB, 38 s**; PH rows present (week of 2026-11-01: _Surviving Hurricane Otis_ #1 film)                            | What Filipinos binge this week (films, series, K-dramas)                                 | **Adopt via a weekly job** (§4.1), not the daily run: too big for the 55 s budget                      |
| **YouTube Data API v3** `videos.list?chart=mostPopular&regionCode=PH` | `https://www.googleapis.com/youtube/v3/videos`                                                       | free API key, 10,000 units/day; this call costs 1           | not probed (needs a key)                                                                                                    | Music videos, shows, creators                                                            | **Optional** (Phase 5), only when `YOUTUBE_DATA_API_KEY` is set                                        |
| GDELT DOC 2.0 API (`sourcecountry:philippines`)                       | `https://api.gdeltproject.org/api/v2/doc/doc`                                                        | none, open data; **1 request per 5 s**                      | `429` on 3 tries spaced over 20 s (shared IP); not verified                                                                 | Global news coverage                                                                     | **Excluded at launch**: news-heavy (mostly unsafe topics), strict rate limit; revisit in Phase 5       |
| Bluesky `app.bsky.unspecced.getTrendingTopics`                        | `https://public.api.bsky.app/xrpc/…`                                                                 | none, open protocol                                         | `200`, but all 10 topics were US (Democrats, Trump, California)                                                             | Global, US-leaning chatter                                                               | **Excluded**: no country filter, `unspecced` (unstable) endpoint                                       |
| Mastodon `/api/v1/trends/tags`                                        | `https://mastodon.social/api/v1/trends/tags`                                                         | none, open                                                  | `200`, global hashtags (`#OddReasonsToCelebrate`)                                                                           | Fediverse hashtags                                                                       | **Excluded**: tiny PH audience                                                                         |
| Google News RSS (PH)                                                  | `https://news.google.com/rss?hl=en-PH&gl=PH&ceid=PH:en`                                              | none                                                        | `200`, but mostly politics and crime                                                                                        | Hard news                                                                                | **Excluded**: feed terms are personal / non-commercial, and the content is mostly unsafe for marketing |
| Reddit `r/Philippines`                                                | `/hot.json`                                                                                          | Data API terms require OAuth; commercial use needs approval | `200` unauthenticated                                                                                                       | Online chatter                                                                           | **Excluded**: terms                                                                                    |
| Official **Google Trends API** (alpha, July 2025)                     | gated                                                                                                | application only, still alpha as of Oct 2026                | n/a                                                                                                                         | Search interest over time, by region                                                     | **Apply in Phase 0**; if accepted, use it for week / month momentum and Philippine regions             |

### 3.2 Social platforms (TikTok, X, Facebook, Instagram)

- **X:** the free API tier has no trends endpoint. Third-party "trends APIs" are paid scrapers (Apify, Zyla) or tiny free tiers (TrendsMCP, 100 requests/month) built on scraping. X also stopped showing tweet volumes on 2026-01-13. **Not used.**
- **TikTok:** Creative Center has no public API. The Research API is for academic researchers only. Scraping breaks the terms. **Not used.**
- **Facebook / Instagram:** Meta has no trends API. Instagram hashtag search needs a connected business account and is capped at 30 hashtags per 7 days. **Not used.**
- **Unofficial scraper libraries** (TikTok-Api, twscrape, twikit) exist but are rejected. See §3.6.
- **What we do instead:** Google Trends catches social virality one step later, when people search for it. Wikimedia (English and Tagalog) catches celebrity and show interest. Apple Music catches the songs that often ride TikTok trends. Netflix catches what people binge. Super-admins can **add a topic by hand** (source `editor`) for a TikTok sound or meme the feeds miss. The UI never claims "trending on TikTok". Each topic shows its actual sources.

### 3.3 Cost

| Item                                                    | Volume                                                                         | Cost                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Google Trends RSS, Wikimedia (EN + TL), Apple Music     | 1 to 3 requests/day each                                                       | $0                                                                            |
| Netflix TSV                                             | 1 download/week (33 MB, streamed)                                              | $0 (edge egress is inbound only)                                              |
| Open-source libraries (`fast-xml-parser`, `compromise`) | bundled into the edge function                                                 | $0 (MIT)                                                                      |
| Gemini classify (`gemini-3.1-flash-lite`, JSON)         | 1 call/day, ~60 candidates in, ~25 topics out (~10k input / ~6k output tokens) | < $0.01/day, `billing.mode: 'platform'`; Groq fallback already in the gateway |
| Host generation from a trend                            | existing AI Studio Generate                                                    | Unchanged: host credits, shown before Generate, as today                      |
| Host reads                                              | 1 indexed select, cached                                                       | Negligible                                                                    |

### 3.4 Why not Gemini "Grounding with Google Search" for the daily list

Grounding would let the model search the web itself, but:

1. The Gemini API terms say grounded results may be shown only to **the end user who sent the prompt**, with tight storage limits, and the **Search Suggestions** chip must be displayed with them. One cached list shown to every host breaks that.
2. Gemini 3 has no grounding on the free tier: 5,000 free searches/month on paid, then $14 per 1,000. Gemini 2.5 has a daily free allowance, but sources disagree on its size.
3. Structured output combined with the search tool is still preview, with reported JSON bugs.

**Decision:** the daily list uses public feeds and an **ungrounded** model call that only reads the feed text we pass in. A per-host **Research this topic** button using grounding (with Search Suggestions shown as required) is a possible Phase 5 add-on, after a terms review.

### 3.5 Brand safety and legal (Philippines)

- Trend feeds are mostly hard news on bad days: the live probe returned "data breach", "lotto result", "stagflation", and a holdup arrest. Marketing a stay off a tragedy, crime, disaster or political fight hurts the host's brand. Facebook can also reduce reach for posts that exploit sensitive events.
- Celebrity names and show titles are fine to **reference** as a topic ("Watching PBB tonight?"). Posts must **not** imply endorsement or partnership, use the person's photo or likeness, use show or network logos, or repeat gossip. This follows Civil Code Art. 26 (privacy and dignity), IP Code trademark rules, and Meta ad policies. Enforcement: prompt rules, a deterministic output check, and one line of guidance in the UI (§4.6).
- This is a product guardrail, not legal advice. Owner sign-off is listed in §10 (D6).

### 3.6 Open-source libraries and self-hostable tools

Our runtime is Deno edge functions and nothing else (no Python worker, no VM, no Docker host). A tool is only "free" if it runs inside that runtime or on infrastructure we already pay nothing for. Each candidate was judged on license, maintenance, Philippine coverage, whether it fits the runtime, and terms risk.

#### Adopt (runs inside the edge function)

| Library                                                | License | Use                                                                                                                                                 | Notes                                                                                             |
| ------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `fast-xml-parser` (npm, via `npm:` / `esm.sh`, pinned) | MIT     | Parse the Google Trends RSS (`ht:` namespace) safely                                                                                                | Replaces the "`jsr:@libs/xml` or …" choice in §4.5: one parser, pinned exact version              |
| `compromise` (npm, pinned)                             | MIT     | Deterministic entity extraction (people, places, orgs) from titles and related headlines: better dedupe keys, and a category guess when it's needed | English only. Filipino names still pass through as plain tokens. ~250 KB, fine for an edge bundle |
| In-house Jaccard + alias map                           | n/a     | Fuzzy merge (`pbb collab` ≈ `Pinoy Big Brother: Collab 3.0`)                                                                                        | No dependency needed. `fastest-levenshtein` (MIT) only if Jaccard proves too weak                 |

#### Reference only (use their source lists and parsing ideas)

| Project                                                                         | What it is                                                                                                     | Why not a dependency                                                                                                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **trendspyg** (Python, MIT, maintained, last release July 2026)                 | Successor to the archived `pytrends`; Google Trends via the same RSS plus a CSV export through headless Chrome | Python, and the CSV path needs Chrome, neither of which runs in Deno edge. Our RSS parser covers the same feed. Use its field mapping as a cross-check |
| **trend-pulse** (Python, MIT, 20 to 35+ keyless sources, CLI / MCP server)      | A ready-made catalog of free trend sources                                                                     | Python, and mostly global or tech sources (HN, GitHub, Product Hunt). **Use its source list in Phase 0 to find more PH-relevant feeds**                |
| **DailyHotApi** (Node, MIT; Docker / Vercel / npm), **TrendRadar**, **newsnow** | Self-hosted "hot list" aggregators with per-source adapters, caching and alerts                                | Built for Chinese platforms (Weibo, Douyin, Zhihu, Bilibili): no PH value. Their adapter-per-source plus cache design matches ours (§4.1)              |
| **pytrends**                                                                    | The old Google Trends library                                                                                  | **Archived April 2025**, broken by Google changes and 429s                                                                                             |

#### Deferred: free Python sidecar (Phase 5)

- A scheduled **GitHub Actions** workflow (cron, ~2 min/day, inside the free private-repo minutes) could run `trend-pulse` or `trendspyg` and `POST` candidates to a new `marketing-trends-ingest` edge function. That function would be authenticated with a dedicated secret and treat candidates as untrusted input (same validation as the feeds).
- Cost $0, but it adds a second runtime and a CI-hosted production dependency. Only build it if the 7-day dev review (P4.5) shows obvious gaps.

#### Rejected

| Tool                                                                         | Why                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RSSHub** (self-hosted, Docker + Redis)                                     | Needs a server we would have to host (not free), and its TikTok / X routes need logged-in cookies or headless Chrome, which brings terms and ban risk. No confirmed Google Trends or TikTok trending route |
| **TikTok-Api** (davidteather, Python)                                        | Unofficial. Needs Playwright, `msToken` and often proxies; "alive but high-maintenance"; breaks TikTok's terms; can't run in edge                                                                          |
| **twscrape**, **twikit**, `snscrape` (X)                                     | Need real X accounts (bans), break X's terms; `snscrape` is dead                                                                                                                                           |
| Paid wrappers (Apify actors, Zyla, TrendsMCP beyond 100 free requests/month) | Cost money or are scrapers underneath                                                                                                                                                                      |

## 4. Approach

### 4.1 Architecture (same split as Smart Pricing: code ranks, AI writes)

```
pg_cron 05:30 Manila
  └─ marketing-trends-cron (serveCronPost, cron secret)
       1 fetch sources   Promise.allSettled, 8 s timeout each, ≥1 must succeed
       2 normalize       strip wiki noise, diacritics, stoplists, dedupe by key
       3 pre-filter      deterministic unsafe-keyword denylist (EN + Filipino)
       4 score           source rank × weight + cross-source bonus + momentum
       5 classify (AI)   1 generateStructured call: merge duplicates, category,
                         safety, stayFit 0-3, summary, 3 angles, caption idea
       6 rank + windows  today / week / month, overrides (hide / pin / manual)
       7 publish         one transaction: topics rows + run status 'published'
       8 prune           runs older than 35 days
pg_cron Wed 04:00 Manila (Netflix publishes Tuesdays)
  └─ marketing-trends-weekly-cron
       stream the Netflix TSV line by line (no full download into memory),
       keep only country_iso2 = PH rows of the latest week (≤ 20 rows),
       upsert marketing_trend_source_cache; keep last week's rows on failure
hosts ──GET marketing-trends?property=…&window=today──▶ latest published run (or fallback)
```

Daily sources are fetched live in step 1. The weekly source is read from `marketing_trend_source_cache` (no network call in the daily run) and ignored when older than 14 days. Each source is one adapter file with the same `{ ok, items, ms, error }` contract, the same pattern DailyHotApi and TrendRadar use (§3.6), so adding a source later is one file plus a weight.

**Rule: no AI review, no new list.** If the classify step fails after the gateway's retry and Groq fallback, the run is marked `failed` and hosts keep seeing the last published list. Unreviewed topics are never shown.

### 4.2 Data model (new migration; RLS on, no policies, so service role only, like other edge-mediated tables)

**`marketing_trend_runs`**: one row per attempt.

| Column                                                                                         | Notes                                                         |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `id uuid pk`                                                                                   |                                                               |
| `run_date date not null`                                                                       | Manila date                                                   |
| `status text check in ('running','published','failed','skipped')`                              |                                                               |
| `trigger text check in ('cron','manual')`, `triggered_by uuid null`                            | manual = super-admin Run now                                  |
| `source_stats jsonb`                                                                           | `{ google_trends: { ok, count, ms, error }, wikimedia: {…} }` |
| `ai_provider text`, `ai_model text`, `ai_error text`, `candidate_count int`, `topic_count int` |                                                               |
| `started_at`, `finished_at timestamptz`                                                        |                                                               |

Partial unique index: one `published` run per `run_date`. A rerun of the same date publishes a new row and marks the older one `skipped` in the same transaction. Index `(status, run_date desc)`.

**`marketing_trend_topics`**: the published lists (window rows are precomputed so reads never aggregate).

| Column                                                                                                           | Notes                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id uuid pk`, `run_id uuid fk on delete cascade`, `run_date date`                                                |                                                                                                                                                                         |
| `window text check in ('today','week','month')`, `rank smallint`                                                 | unique `(run_id, window, rank)`                                                                                                                                         |
| `topic_key text`                                                                                                 | normalized key, e.g. `pinoy-big-brother-collab-3-0`. Stable across days for momentum and overrides                                                                      |
| `title text` (≤ 80), `summary text` (≤ 160)                                                                      | AI-written, plain words: "Fans are following the new PBB housemates this week."                                                                                         |
| `category text check in (…)`                                                                                     | `tv_film`, `music`, `celebrity`, `sports`, `food`, `travel`, `holiday_event`, `lifestyle`, `gaming`, `tech`, `other`                                                    |
| `stay_fit smallint` 0 to 3                                                                                       | how naturally the topic ties to a stay. 0 never published                                                                                                               |
| `score numeric`, `momentum text check in ('new','rising','steady')`, `days_trending smallint`, `first_seen date` |                                                                                                                                                                         |
| `sources jsonb`                                                                                                  | `[{ source: 'google_trends', rank: 3, traffic: '500+' }, { source: 'wikimedia', rank: 6, views: 5100 }]` (no third-party URLs stored except the Wikipedia article link) |
| `angles jsonb`                                                                                                   | 3 items: `{ title, hook, output: 'post'\|'image'\|'video', goal: PosterGoal, format, prompt }`                                                                          |
| `caption_idea text`, `hashtags text[]` (≤ 5)                                                                     | free copy path                                                                                                                                                          |
| `brand_guard text[]`                                                                                             | e.g. `['no_likeness','no_logo','no_endorsement']`, injected into generation                                                                                             |
| `pinned bool default false`, `manual bool default false`                                                         |                                                                                                                                                                         |

Index `(run_id, window, rank)`.

**`marketing_trend_overrides`**: super-admin moderation, applied at publish **and** at read (a hide takes effect immediately, no rerun needed).

`topic_key text pk`, `action text check in ('hide','pin')`, `note text`, `expires_at timestamptz` (default +14 days), `created_by uuid`, `created_at`.

**`marketing_trend_manual_topics`**: super-admin added topics (TikTok sounds, local events). `id`, `title`, `notes`, `category`, `active_from date`, `active_to date` (≤ 14 days), `created_by`. These go through the same classify step as feed topics, so they get angles and a safety check too.

**`marketing_trend_source_cache`**: slow sources fetched on their own schedule (Netflix now, the Phase 5 sidecar later). `source text`, `period_start date`, `items jsonb` (normalized `{ title, rank, category_hint }[]`), `fetched_at timestamptz`, `error text`; primary key `(source, period_start)`; pruned with the runs.

**Provenance on generations:** add nullable `trend_topic_key text` to the AI Studio session/creation row (`marketing_ai_sessions` or its metadata JSONB, whichever the current table uses; confirm in Phase 0). Used for "Made from a trend" analytics and future results reporting.

### 4.3 Scoring (pure, tested: `_shared/marketingTrends/score.ts`)

- **Per-source rank score:** `weight_source × 1/√rank`. Weights: Google Trends 1.0, Wikimedia per-country 0.8, Tagalog Wikipedia 0.5, Netflix PH 0.6, Apple Music PH 0.5, YouTube 0.6, editor 1.0. Weights are config in `score.ts`, tuned during the 7-day dev review (P4.5). Google traffic buckets (`100+` … `1M+`) add `log10(traffic)/10`.
- **Cross-source bonus:** ×1.3 for each extra source agreeing on the same key. This is the main de-noise signal.
- **Momentum:** `new` (first seen today) ×1.15, `rising` (rank improved vs yesterday) ×1.1, `steady` ×1.0. Topics absent from all sources for 3 days drop out of Today.
- **Final:** `score × stayFitMultiplier` (0 → excluded, 1 → 0.6, 2 → 1.0, 3 → 1.3). Pinned first, then by final score. **Today** keeps the top 25.
- **This week / This month:** sum each key's daily final scores over the last 7 / 30 published runs with decay `0.85^age` / `0.93^age`, top 25. Hidden until there are 3 / 7 published runs (bootstrapping). Until then the window chip is not shown.
- **Normalization:** lowercase, strip diacritics and punctuation, `_` to space, drop wiki disambiguators (`(TV series)`, `(singer)`). Wikimedia stoplist: `Main_Page`, `Special:*`, `Wikipedia:*`, `Portal:*`, `File:*`, `Help:*`, plus an evergreen list (`Philippines`, `Google`, `YouTube`, `Facebook`, `Manila`, `ChatGPT`, `Deaths_in_2026`…). After 30 days of history, auto-flag keys present in ≥ 25 of 30 days as evergreen.
- **Dedupe:** `compromise` entity extraction plus deterministic token-overlap merge first (Jaccard ≥ 0.6), then the AI merge pass ("pbb collab" + "Pinoy Big Brother: Collab 3.0" + a housemate's name → one topic, other names kept as `aliases`).

### 4.4 AI classify step (new prompt module, new feature key)

- Feature `marketing_trends_classify` in `aiModelRouter.ts`: `gemini-3.1-flash-lite`, Groq fallback on, `thinkingBudget` low, platform billing, 45 s timeout.
- Prompt module `_shared/ai/prompts/marketingTrends.ts` via `definePrompt`. Input: up to 60 candidates `{ key, title, sources, newsHeadlines (Google Trends related items, titles only) }` wrapped as **untrusted** (`ai/untrusted.ts`), since feed text could contain prompt injection.
- Output schema per topic: `{ key, mergeInto?, title, category, safety: 'safe'|'block', blockReason?, stayFit 0-3, summary, angles[3], captionIdea, hashtags[≤5], brandGuard[] }`.
- **Safety policy (block):** deaths, illness, accidents, disasters and weather emergencies, crime and court cases, politics, elections and government, religion disputes, gambling and lotto, scams and data breaches, minors as the subject, adult content, brand crises, gossip and scandals, anything mocking a person or group. When in doubt, block.
- **Angles** must tie the topic to a stay without inventing property facts: watch party, fan night in, game-night staycation, concert-weekend stay near the venue (only when the venue is named in the source), holiday getaway. The `goal` must be one of the existing `POST_GOALS` (`vibe`, `promo`, …), and `format` one of `POST_FORMATS`.
- Validate server-side: drop topics with unknown keys, clamp lengths, enforce enums, run the deterministic denylist again on the model's own text (§4.6), and require ≥ 5 safe topics to publish. Otherwise mark the run `failed` (fallback layer 2 applies).
- Eval suite `tests/evals/datasets/marketing_trends_classify.*`: ~40 labeled PH cases (PBB → safe `tv_film` stayFit 3; Alexandra Eala → safe `sports`; "lotto result today 9pm" → block; "data breach" → block; typhoon name → block; "stagflation" → block or stayFit 0; Christmas long weekend → safe `holiday_event` 3). Offline-runnable like `aiEvalsOffline.test.ts`.

### 4.5 Failure handling and fallbacks

| Failure                                            | Behavior                                                                                                                                                                                                   | Host sees                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| One source down, timeout or format change          | Parser returns `{ ok: false, error }`, logged in `source_stats`; run continues if ≥ 1 source returned ≥ 5 candidates                                                                                       | Normal list                                          |
| All sources down                                   | Run `failed`; Sentry event                                                                                                                                                                                 | Last good list, labeled "Updated Nov 8"              |
| Gemini and Groq both fail, or < 5 safe topics      | Run `failed`; no partial publish                                                                                                                                                                           | Last good list                                       |
| Cron didn't fire                                   | `/admin/health` warns when the latest published run is > 36 h old                                                                                                                                          | Last good list                                       |
| Last good list > 72 h old, or none yet             | Read endpoint returns `fallback: 'evergreen'`: code-defined PH ideas for the current month (Ber months, Christmas, long weekends from the holiday list, summer, payday weekends) with the same angle shape | "Seasonal ideas" heading instead of "Trending today" |
| Read endpoint error / offline                      | UI shows the evergreen list bundled in the client chunk plus a quiet retry; the chip rail hides itself                                                                                                     | Seasonal ideas, never a broken card                  |
| Duplicate cron fire                                | Advisory lock `pg_try_advisory_xact_lock(hashtext('marketing-trends'))` plus "already published today" check → `skipped`                                                                                   | n/a                                                  |
| Topic hidden by super-admin                        | Filtered at read via the overrides table (cached ≤ 5 min)                                                                                                                                                  | Gone within 5 minutes                                |
| Netflix weekly job fails or the TSV format changes | Cache keeps last week's rows; daily run ignores cache rows older than 14 days; `source_stats.netflix = { ok: false, stale: true }`                                                                         | Normal list (one source fewer)                       |
| Apple feed host moves again                        | Fetch follows redirects (max 3); a non-JSON body counts as a source failure                                                                                                                                | Normal list                                          |

Parsers are strict about shape and lenient about content. Unknown fields are ignored, and a missing required field drops that item, not the source. XML is parsed with pinned `fast-xml-parser` (§3.6), never regex. The Netflix TSV is parsed by a streaming line splitter with a header check (fails closed if the columns change).

### 4.6 Brand-safety enforcement in generation

- Hosts send only `trendTopicKey`. The server loads the topic from the latest published run and rejects keys that are hidden or more than 7 days old (`trend_unavailable`). Clients can never inject "trend context" text.
- `generate-marketing-template` (poster director), `generate-marketing-media` (image/clip prompt builders) and `generate-marketing-caption` accept the optional `trendTopicKey` and append a fixed **trend block**: the topic title, summary and angle, plus rules: no endorsement or partnership words, no real person's face or likeness, no show, network or team logos, no gossip, and property facts only from settings (existing rule).
- **Deterministic output check** (`_shared/marketingTrends/brandGuard.ts`) on headline and caption text: reject variants containing `official`, `sponsored`, `partner`, `endorsed by`, `in partnership with`, `meet <name>`, `with <name>` patterns for `celebrity` topics. Rejected variants are dropped (posters already drop failed variants) or the caption is regenerated once.
- Image and clip prompts for `celebrity` / `tv_film` / `music` topics add "no recognizable real people, no logos, no text of brand names", matching existing "no new people" rules.
- UI: one line in the Trends sheet footer, "Mention the trend, don't use their photos or logos." (run through `human-copy`).

### 4.7 Performance

| Surface       | Budget / technique                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read endpoint | 2 indexed queries (latest published run, then topics for `window`) + overrides set; per-isolate memo keyed by `run_id` (5 min); `Cache-Control: private, max-age=300`; payload ≤ 20 KB                                                |
| Client        | `useMarketingTrends(window)` TanStack Query, `staleTime` 30 min, `gcTime` 1 h, `enabled` only when the sheet is open or the chip rail is in view (`IntersectionObserver`); no refetch on focus                                        |
| Bundle        | `TrendsSheet` and the chip rail are `React.lazy` chunks; no new heavy deps; no third-party images (category icons from `lucide-react`, already bundled). Check the PWA precache budget (see memory: Polotno chunk vs precache budget) |
| Cron          | Runs off-peak; total budget 55 s (`TIME_BUDGET_MS`); one AI call; writes ≤ 75 rows/day. The weekly Netflix job streams 33 MB with a 120 s timeout, holding one line in memory at a time                                               |
| Storage       | ~75 rows/day × 35 days ≈ 2.6k rows; pruned daily                                                                                                                                                                                      |

### 4.8 Host UX

**Where:** inside **AI Studio** (the first tab today), not a new tab. Reasons: the Strategy Planner already claims the next first tab (`?tab=plan`), trends exist to feed generation, and a sheet keeps one obvious path. Deep link `…/marketing?tab=ai&trends=today` opens the sheet (back button closes it).

**1. Trending today rail** (top of the AI Studio create form, above "What's it about?")

```
Trending today                                         See all ›
[ 📺 PBB Collab 3.0  New ] [ 🎾 Alex Eala ] [ 🏀 PBA Governors' Cup ] [ 🎄 Christmas rush ] →
```

- Horizontal scroll, 5 to 8 chips, 44 px touch targets. Tap a chip to open the topic in the sheet. Hidden when the endpoint fails and no cache exists. In the evergreen fallback, the label reads "Seasonal ideas".

**2. Trends sheet** (bottom sheet with detents on phone, right side sheet ≥ 1024 px, `mobile-responsive` rules)

```
Trends in the Philippines                      Updated today 5:30 AM
[ Today ][ This week ][ This month ]
[All] [TV & film] [Music] [Sports] [Celebrity] [Holidays] [Food] …

1  PBB Collab 3.0                         New · 2 days
   Fans are following the new housemates this week.
   Google · Wikipedia                                       ›
2  Alexandra Eala                         Rising
   …
──────────────────────────────────────────────────────────
Mention the trend, don't use their photos or logos.
```

**3. Topic detail** (pushes inside the sheet)

- Title, summary, momentum, sources (Wikipedia link only).
- **3 angle cards**, e.g. "PBB watch-party staycation", format glyph (post / photo / clip), hook line.
  - Primary action **Make a post** (or **Make a clip** / **Make a photo** per angle) → AI Studio form prefilled: output, `goal`, `format`, text = angle prompt, a removable **Trend: PBB Collab 3.0** chip. Nothing is generated or charged until Generate, which matches the examples' behavior.
  - Secondary **Copy caption idea** (clipboard + toast). Free and works on every plan.
  - When AI generation isn't in the plan: **Make a post** opens the Posts editor with the closest preset and the hook as headline text, and the AI option shows the existing plan lock.
- Plain copy only (`human-copy`, no em dashes).

**States:** skeleton rows (`skeleton-loaders`), stale label, evergreen fallback, "Trends are off for this property" when the feature-availability leaf is off (rail and sheet hidden instead of showing an error), and an empty filter result ("No sports topics today").

## 5. Gating, permissions, audit

- **Plans:** viewing Trends and **Copy caption idea** on every plan that has Marketing Content Studio, because it drives use and upgrades. Generating from a trend follows the existing gates (`aiMarketingGeneration`, `aiMarketingImageGeneration`, `aiMarketingVideoGeneration`). No new plan key. Update `plans-feature-matrix.md` with a "Trends (view)" row.
- **Feature availability:** new leaf `marketing.trends` (parent module `marketing`) in `featureAvailabilityCatalog.ts`, default on. It is the super-admin kill switch per property / org / globally.
- **Team RBAC:** see = `marketing:view`; generate = existing `marketing.generate:add` (+ image/video leaves). No new permission.
- **Audit:** super-admin hide / pin / add / Run now → `superAdminAudit.ts` events. Host generation already records metering; add `trend_topic_key` to the existing generation activity / PostHog properties. Cron: `activity-log: N/A — platform data, no org state; the run ledger is marketing_trend_runs`. Host viewing: N/A (read only).
- **AI limits:** classify is platform-billed, so host limits don't apply. Hosts' generations go through `assertOrgAndPropertyAiQuota` as today. Super-admin AI limits page: list the new feature key with no host toggle (memory: AI limits are super-admin only).

## 6. Implementation tasks

### Phase 0: spikes and fixtures (≤ 1 day)

- [ ] **P0.1** Save 7 days of real fixtures (Google Trends RSS XML, Wikimedia JSON) under `supabase/functions/tests/fixtures/marketing-trends/`. Confirm Wikimedia lag (D-1 vs D-2) and Trends RSS item count and fields.
- [ ] **P0.2** Confirm where AI Studio sessions store metadata (`marketing_ai_sessions` columns) for `trend_topic_key`.
- [ ] **P0.3** Draft the classify prompt and run it on the fixtures by hand (local `generateStructured`). Write the 40-case eval dataset.
- [ ] **P0.4** Check that `gemini-3.1-flash-lite` JSON mode handles the schema size. If not, use two calls (classify, then angles for safe topics only).
- [ ] **P0.5** Apply for the official Google Trends API alpha (owner's Google account). Not blocking.
- [ ] **P0.6** Read the reuse terms for the Apple Music feed generator and the Netflix Top 10 data. We only use titles as ranking signals and show "Apple Music" / "Netflix" as a source label with no artwork. Drop either source if its terms forbid that.
- [ ] **P0.7** Go through `trend-pulse`'s source list and `trendspyg`'s RSS field mapping. Add any keyless, PH-relevant feed to §3.1 with a probe result (target: one more music or food / lifestyle source).
- [ ] **P0.8** Check Deno compatibility and pin exact versions of `fast-xml-parser` and `compromise`. Measure the cold-start cost of `compromise` in the cron function (drop it if it adds > 300 ms).
- [ ] **P0.9** Probe the Netflix TSV streaming parse inside a local edge function: time, peak memory, and whether a smaller per-country file exists.
- **Acceptance:** fixtures committed; eval baseline ≥ 95% on the block / safe label; source list final.

### Phase 1: backend pipeline

- [ ] **P1.1** Migration `supabase/migrations/<ts>_marketing_trends.sql`: 5 tables (incl. `marketing_trend_source_cache`), indexes, partial unique index, RLS enabled, comments.
- [ ] **P1.2** Source adapters in `_shared/marketingTrends/sources/` (+ `_test.ts` against fixtures): `googleTrendsRss.ts` (`fast-xml-parser`), `wikimediaTopPerCountry.ts`, `wikimediaTopTagalog.ts` (shared Wikimedia client), `appleMusicChart.ts`. Fetch with `AbortSignal.timeout(8000)` and a descriptive `User-Agent` (`KameSpaceTrends/1.0 (+https://<domain>/contact)`); return `{ ok, items, ms, error }`. A registry `sources/index.ts` lists adapters with weights and an `enabled` flag.
- [ ] **P1.2b** `netflixTop10.ts` (streaming TSV parser + header check) and `supabase/functions/marketing-trends-weekly-cron/index.ts` (`serveCronPost`, same cron secret) writing `marketing_trend_source_cache`; cron registration `0 20 * * 2` UTC = Wed 04:00 Manila.
- [ ] **P1.3** `_shared/marketingTrends/normalize.ts` (with `compromise` entity extraction), `stoplists.ts` (incl. Tagalog wiki namespaces `Natatangi:`, `Unang_Pahina`), `safetyDenylist.ts` (EN + Filipino terms: patay, namatay, nasawi, bagyo, lindol, sunog, aksidente, huli, kulong, lotto, …), `score.ts`, `windows.ts` (+ tests, including the PBB / lotto / data-breach fixtures).
- [ ] **P1.4** `aiModelRouter.ts`: `marketing_trends_classify`. `_shared/ai/prompts/marketingTrends.ts` + schema + validator `marketingTrendsClassify.ts` (+ tests, + eval wiring in `tests/evals/`).
- [ ] **P1.5** `_shared/marketingTrends/publish.ts`: transaction (advisory lock, insert topics for 3 windows, mark run published, skip older run of the same date), apply overrides and manual topics, prune > 35 days.
- [ ] **P1.6** `_shared/marketingTrends/evergreenIdeas.ts`: month → ideas, using the existing PH holiday data if the Strategy Planner's calendar ships first, else a small static list. Shared shape with topics. The client keeps a mirrored copy in `ui/.../marketing/lib/trends/evergreenIdeas.ts` (unit test asserts they match).
- [ ] **P1.7** `supabase/functions/marketing-trends-cron/index.ts` with `serveCronPost` + `verifyCronSecret` (`MARKETING_TRENDS_CRON_SECRET`, header `x-marketing-trends-cron-secret`), Sentry and PostHog `marketing_trends_run`. `config.toml` `verify_jwt = false`.
- [ ] **P1.8** Cron registration migration (pattern from `20261201120200_parking_reminder_cron.sql`): `30 21 * * *` UTC = 05:30 Manila.
- [ ] **P1.9** `/admin/health` check: latest published run age (> 36 h warn, > 72 h error) and last run's per-source status.
- [ ] **P1.10** Local seed: `scripts/dev/seed/<nn>-marketing-trends.sql` with one published run (today + week windows) so the UI works offline; extend `99-verify.sql`.
- **Acceptance:** `curl` the local cron twice → one published run, second is `skipped`; kill a source → run still publishes; force an AI failure → `failed`, previous list stays.

### Phase 2: super-admin moderation (ships before hosts see anything)

- [ ] **P2.1** `supabase/functions/admin-marketing-trends/index.ts` (`superAdminAuth` + step-up only for Run now if the console requires it): `GET` runs (last 14) + latest topics; `POST` hide / pin / unhide, add / remove manual topic, run now (calls the shared pipeline, rate-limited to 1 per 10 min).
- [ ] **P2.2** `superAdminAudit.ts` events: `marketing_trend_hidden`, `_pinned`, `_manual_added`, `_run_triggered`.
- [ ] **P2.3** UI `ui/src/features/admin/…/MarketingTrendsPage.tsx` at `/admin/marketing-trends` (nav under Platform): run ledger with source health pills, today's list with Hide / Pin, Add topic dialog (`useGuardedClose`), Run now.
- **Acceptance:** hiding a topic removes it from the host read endpoint within 5 minutes without a rerun.

### Phase 3: host read API and UI

- [ ] **P3.1** `supabase/functions/marketing-trends/index.ts` (`GET ?property=&window=`): `verifyPropertyAccess` with `marketing:view`, feature availability `marketing.trends`, `rateLimit.ts` per user; returns `{ runDate, publishedAt, stale, fallback: null | 'evergreen', windowsAvailable, topics }`; memo + cache headers.
- [ ] **P3.2** `ui/src/features/dashboard/marketing/lib/trends/` (`trendsApi.ts`, `trendTypes.ts`, `trendHandoff.ts` building an `AiCreateFormState` patch from an angle, `+ .test.ts`).
- [ ] **P3.3** `hooks/useMarketingTrends.ts` (lazy `enabled`, query keys under the marketing namespace).
- [ ] **P3.4** `components/trends/TrendingRail.tsx`, `TrendsSheet.tsx`, `TrendTopicDetail.tsx`, `TrendAngleCard.tsx`, all lazy-loaded; mount the rail in the AI Studio create form; `trends` search param in `marketingStudioRoute.ts`.
- [ ] **P3.5** AI Studio form: accept the trend handoff (extend `aiStudioHandoff.ts` with a `setPendingAiTrend` one-shot like the start photo), show the removable trend chip, pass `trendTopicKey` in `buildAiCreateRequest` (`aiStudioCreatePayload.ts` + test).
- [ ] **P3.6** Server: `trendTopicKey` support + trend block + `brandGuard.ts` in `marketingPosterDirector.ts`, the image/video prompt builders and `marketingCaptionAi.ts`; store `trend_topic_key` on the session (+ tests for guard and rejection of stale or hidden keys).
- [ ] **P3.7** Posts-editor fallback for plans without AI generation: open the closest preset with the hook text (`marketingPhotoHandoff`-style one-shot).
- [ ] **P3.8** PostHog: `trends_opened {window, source: rail|deeplink}`, `trend_topic_opened {topic_key, rank}`, `trend_angle_used {topic_key, output, action: make|copy}`; generation events gain `trend_topic_key`.
- [ ] **P3.9** Feature availability leaf `marketing.trends` in `featureAvailabilityCatalog.ts` (+ public entries if the catalog requires it).
- **Acceptance:** at 375 / 768 / 1024 px, rail → sheet → angle → AI Studio prefilled → Generate works; evergreen fallback renders with the endpoint forced to 500; no new request when Marketing loads on a tab other than AI Studio.

### Phase 4: tests, docs, rollout

- [ ] **P4.1** Deno: parser, normalize, score, windows, denylist, validator, publish (fallback rules), brand guard, handler tests for `marketing-trends` (403 without `marketing:view`, availability off → `{ disabled: true }`, stale, evergreen) and the cron (secret, idempotency).
- [ ] **P4.2** Playwright mocked E2E `ui/e2e/features/marketing/trends.spec.ts`: rail renders, sheet windows / filters, prefill handoff, stale label, evergreen on 500, hidden when availability is off, phone bottom sheet.
- [ ] **P4.3** Evals in `tests/evals/` for `marketing_trends_classify`; add to the offline eval run.
- [ ] **P4.4** Docs (§7) + Help Center Q&A + FAQ; `check:support-content`, `check:ai-knowledge-coverage`.
- [ ] **P4.5** Rollout on dev: run the cron for 7 days with hosts hidden (availability leaf off globally), review lists daily in `/admin/marketing-trends`, tune stoplists and weights, then turn on.
- [ ] **P4.6** `bun run ci:quality` green; deploy to dev with `bun run deploy:supabase:dev`. Production deploy needs `kamewave`.

### Phase 5: follow-ups (not in this plan's milestone)

- YouTube `mostPopular` source behind `YOUTUBE_DATA_API_KEY` (respect the 30-day data refresh rule; prune already covers it).
- Python sidecar on GitHub Actions running `trend-pulse` / `trendspyg` into a `marketing-trends-ingest` endpoint (§3.6), only if the dev review shows gaps.
- Official Google Trends API, if the alpha application is accepted: week / month momentum and regional lists (Metro Manila, Cebu, Davao).
- GDELT as a "what's in the news" safety cross-check (block topics with sudden negative coverage), respecting 1 request per 5 s.
- Strategy Planner: trends as a "Trending now" opportunity with stayFit ≥ 2 ([`marketing-strategy-planner.md`](./marketing-strategy-planner.md)).
- Trend chips in the editors' AI rail and in Telegram marketing.
- Weekly "3 trends you can use" in-app notification (opt-in, `notification_preferences`).
- Per-host **Research this topic** using Gemini grounding, with Search Suggestions rendered as the terms require (terms review first).
- Results: compare reach of trend-based vs other publications using `trend_topic_key` + `marketing_publications`.

## 7. Docs to update (same change as the code)

| File                                                                     | Update                                                                                                                                                |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/guides/routes/org/property/marketing.md`                           | Trends section, states, handoff, Host-facing Q&A (what Trends is, where it comes from, why a topic is missing, credits, "can I use celebrity photos") |
| `docs/guides/routes/admin/marketing-trends.md` (new) + `admin/health.md` | Moderation page; staleness check                                                                                                                      |
| `docs/architecture/overview.md`, `docs/PROJECT.md`                       | New functions, tables, env vars (`MARKETING_TRENDS_CRON_SECRET`, optional `YOUTUBE_DATA_API_KEY`), cron                                               |
| `docs/architecture/data-model.md`                                        | 5 tables + `trend_topic_key`                                                                                                                          |
| `docs/architecture/marketing-trends.md` (new)                            | Source registry, weights, how to add a source adapter, the open-source evaluation (§3.6) kept current                                                 |
| `docs/architecture/ai-platform.md`                                       | Feature key, prompt, eval, platform billing                                                                                                           |
| `docs/architecture/plans-feature-matrix.md`, `org/plans.md`              | "Trends (view)" on all Marketing plans                                                                                                                |
| `docs/archive/operations/scheduled-jobs-and-testing.md`                  | Cron entry + local `curl` test                                                                                                                        |
| `docs/archive/operations/migration-runbook.md`                           | New migrations                                                                                                                                        |
| `docs/guides/support/faqs.md`                                            | 2 to 3 FAQs                                                                                                                                           |
| `docs/guides/testing/local-seed-data.md`                                 | New seed file                                                                                                                                         |
| `docs/guides/legal.md` (in-app notices)                                  | The "Mention the trend…" line                                                                                                                         |
| `docs/workflow/planned/ai-opportunities-roadmap.md`                      | Add an entry pointing to this plan                                                                                                                    |

## 8. Verification plan (end to end)

1. Local: `./dev.sh`, apply migrations (`/fix-migration-issues`), `curl -X POST …/functions/v1/marketing-trends-cron -H 'x-marketing-trends-cron-secret: …'` → run `published`, ≥ 5 topics, no blocked topics (checked against the eval labels).
2. Open Marketing → AI Studio at 375 px: rail shows; See all → sheet; Today → topic → **Make a post** → form prefilled with trend chip → Generate → posts contain no endorsement words (brand guard test covers this too).
3. Failure drills: block `trends.google.com` (env override base URL in tests) → still publishes from Wikimedia; unset `GEMINI_API_KEY` and Groq → `failed`, UI shows last list with date; truncate topics → evergreen.
4. Super-admin: hide the top topic → gone from host view ≤ 5 min; audit row written.
5. `bun run ci:quality` (lint, type-check, Vitest, Deno, smoke E2E, build) + `test:edge` + `test:edge:handlers` + the new E2E spec.

## 9. Edge cases

- Same topic under different spellings across days → stable `topic_key` via alias map stored on the topic (`aliases` in `sources`), merged by AI and remembered for momentum.
- Topic turns sensitive mid-day (e.g. a celebrity death) → super-admin hide works immediately; next day's classify blocks it.
- Manila date boundary: `run_date` from `manilaTodayYmd()`, never UTC.
- Wikimedia returns 404 for a day not computed yet → try D-1 then D-2.
- Host opens a generation from a topic that has since been hidden → server returns `trend_unavailable`, the form keeps the text and drops the chip with a toast.
- Filipino and Taglish titles: normalization keeps `ñ` → `n` and doesn't drop Filipino stop words used in titles.
- Copy caption idea on iOS PWA without clipboard permission → fallback select-text sheet.
- Song and show titles that contain denylist words (the OPM hit _Ako ang bagyo_ has "bagyo", typhoon; Netflix's _Surviving Hurricane Otis_). The keyword denylist applies only to news-derived sources (Google Trends, Wikimedia). Music and Netflix titles skip it but still go through the AI safety pass, which judges the topic, not the word.
- The same title on several sources (a song on Apple Music and in Google Trends) → merged by key; the cross-source bonus applies once per distinct source.

## 10. Decisions (recommended defaults; change before Phase 1 if needed)

| #   | Decision                 | Recommended                                                                                                                                                                                            |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Placement                | Rail + sheet inside AI Studio, not a new tab (keeps Plan tab slot for the Strategy Planner)                                                                                                            |
| D2  | Plan gating for viewing  | All plans with Marketing; generation keeps existing gates                                                                                                                                              |
| D3  | Sources at launch        | Google Trends RSS, Wikimedia (EN per-country + Tagalog), Apple Music PH, Netflix PH weekly; YouTube in Phase 5; X / TikTok / Meta / Reddit / Google News / Bluesky / Mastodon excluded                 |
| D8  | Runtime for collectors   | Deno edge only, with MIT libraries (`fast-xml-parser`, `compromise`). No self-hosted servers (RSSHub) and no unofficial scrapers. A Python sidecar on GitHub Actions only if the dev review shows gaps |
| D4  | Grounded search          | Not in the shared daily list; optional per-host feature later after a terms review                                                                                                                     |
| D5  | Schedule                 | Once daily 05:30 Manila; super-admin Run now for breaking topics                                                                                                                                       |
| D6  | Celebrity / brand policy | Reference only; no likeness, logos, endorsement words; owner signs off on the guard wording                                                                                                            |
| D7  | Unreviewed topics        | Never shown: no AI review, no new list                                                                                                                                                                 |

## 11. Open questions

None blocking. D2 and D6 need owner confirmation before Phase 3 ships to hosts.

## Sources

- Google Trends RSS and Wikimedia top-per-country: live probes, 2026-11-09. Tagalog Wikipedia top, Apple Music PH, Netflix Top 10 TSV, Bluesky, Mastodon and GDELT: live probes, 2026-11-10.
- Open source: [trendspyg](https://github.com/flack0x/trendspyg) · [trendspyg on PyPI](https://pypi.org/project/trendspyg/0.4.3/) · [pytrends is archived](https://dev.to/esteban_ortega/pytrends-is-dead-heres-how-to-get-google-trends-data-in-2026-1a18) · [trend-pulse launch](https://claude-world-com.pages.dev/articles/trend-pulse-open-source-launch) · [trend-pulse on PyPI](https://pypi.org/project/trend-pulse/0.5.2/) · [DailyHotApi](https://gittrend.io/repo/imsyy/DailyHotApi) · [TrendRadar](https://themenonlab.blog/blog/trendradar-self-hosted-ai-trend-monitor) · [RSSHub](https://gittrend.io/repo/DIYgod/RSSHub) · [TikTok scraper landscape 2026](https://thunderbit.com/blog/best-tiktok-scraper-alternatives)
- [Google Trends API alpha announcement](https://developers.google.com/search/blog/2025/07/trends-api) · [Alpha early access](https://developers.google.com/search/apis/trends) · [Bluesky getTrendingTopics (atproto source)](https://cdn.jsdelivr.net/npm/@atproto/bsky@0.0.234/src/api/app/bsky/unspecced/getTrendingTopics.ts)
- [Gemini Developer API pricing](https://aistudio.google.com/docs/pricing) · [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/grounding) · [Search Suggestions](https://ai.google.dev/gemini-api/docs/grounding/search-suggestions) · [Gemini API Additional Terms](https://ai.google.dev/terms) · [Terms discussion (display / storage)](https://discuss.ai.google.dev/t/terms-and-conditions-for-gemini-api/178519)
- [Gemini tools: structured outputs with built-in tools (Gemini 3, preview)](https://ai.google.dev/gemini-api/docs/tools.md.txt) · [Structured output + search empty-array bug](https://discuss.ai.google.dev/t/gemini-3-1-pro-cant-return-structured-output-with-empty-arrays-when-using-web-search/144000)
- [Google Trends Trending now help (RSS export)](https://support.google.com/trends/answer/3076011)
- X trends landscape: [TrendsMCP X API](https://trendsmcp.ai/x-api), [Apify X trends scrapers](https://apify.com/feedminer/x-trends-scraper)
