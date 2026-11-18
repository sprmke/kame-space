---
title: 'Audit 16: performance, caching and cost'
status: active
tags: [audit, performance, caching, cost, ai]
updated: 2026-11-18
---

# 16: Performance, caching and cost

Measured on the production build (`bun run build`) and a local stack. Latency numbers are local and
not representative of production, but **counts, payload sizes and cost math are**.

---

## Frontend weight

```
Initial: entry 258.8 KiB gzip + 10 chunks = 657.3 KiB gzip
  index (app)                 258.1 KiB
  react-vendor                 90.6
  observability-vendor         90.5   <- Sentry + PostHog, eager on first paint
  supabase-vendor              55.7
  radix-vendor                 47.1
  motion-vendor (framer)       46.9
  icons / ui / query vendors   55.7 combined

PWA precache shell: 4,413.8 KiB / 4,608 KiB budget (96%)
PWA total:         20,864.5 KiB / 22,528 KiB (92%)
Largest lazy chunks: exportVideoMedia 731 KiB, PropertySettingsCard 617.9 KiB,
                     Kame 491 KiB, AreaChart 345 KiB, renderPdfPageImages 326 KiB
```

### P1. Observability is in the critical path

Sentry + PostHog are 90.5 KiB gzip of the initial bundle for every visitor, including guests who
never sign in, while analytics is supposed to be consent-gated. Lazy-load both: PostHog after the
consent choice, Sentry after first idle (or immediately only for hosts).

### P1. The PWA precache is 4% from breaking the build

4,413.8 of 4,608 KiB. Any shell-level feature will fail `check-precache-budget.mjs`. Decide now:
raise the budget with a number you can defend, or move marketing/mock data (`mockProperties.ts` is
1,668 lines) out of the shell precache list.

### P2. Marketing editors are the heaviest lazy routes

`exportVideoMedia` 731 KiB and `PropertySettingsCard` 617.9 KiB are large for a settings surface.
Property settings is used by every host; split the media-heavy sections (photos/video) into their own
chunk so opening Settings does not pull the editor stack.

---

## API call volume

Measured function invocations for one cold page load as the org owner:

| Page               | Calls  | Duplicates inside that count                         |
| ------------------ | ------ | ---------------------------------------------------- |
| Property dashboard | **22** | `dashboard-assistant-settings` ×2, `app-settings` ×2 |
| Property bookings  | 11     | **`list-bookings` ×4**                               |
| Property finance   | 15     | `finance-summary` ×2, `finance-bookings` ×2          |
| Property inbox     | 16     | `meta-inbox-sync` ×3, `social-inbox-threads` ×2      |
| Property settings  | 14     | none                                                 |
| Org dashboard      | 9      | `dashboard-assistant-settings` ×2                    |

Every page also fetches `get-public-platform-status`, `get-session-context`, `org-plan`,
`user-ui-preferences`, `property-lifecycle` and `dashboard-assistant-settings`.

### P1. Duplicate calls on every page

- `dashboard-assistant-settings` fires twice because two hooks build the query key from different
  identifiers (`orgSlug` vs `orgId`). One key, one call.
- `list-bookings` ×4 on the bookings page. The stage counts, the list, and prefetches each fetch
  independently; the counts can be derived from the list response or a single summary call.
- `finance-summary` and `finance-bookings` are each fetched twice for different keys.

At 1,000 hosts × 20 page views/day × 2 redundant calls, that is ~40k extra invocations/day for
identical data.

### P1. A workspace bootstrap endpoint

`get-session-context`, `org-plan`, `user-ui-preferences`, `dashboard-assistant-settings`,
`property-lifecycle`, `list-properties` and `list-parkings` are fetched on nearly every admin page and
rarely change. One cached `workspace-bootstrap` response (org, plan, properties, parkings,
preferences, feature flags) would remove 5-7 calls per navigation and make the sidebar instant.

---

## Payload sizes

| Request                         | Bytes       | Notes                               |
| ------------------------------- | ----------- | ----------------------------------- |
| `list-bookings` (31 rows)       | **171 KiB** | 179 columns per row                 |
| Property bookings page, all API | **516 KiB** | multiple list calls plus duplicates |
| Property inbox page, all API    | 364 KiB     | threads + messages                  |
| Property dashboard, all API     | 103 KiB     |                                     |

`list-bookings` returns the full `guest_submissions` row: document URLs, AI verdicts, cancellation
snapshots, voucher fields, external-feed metadata. The list renders about 12 of those columns.

### P1. Trim list DTOs

A 20-column projection would cut the bookings list ~80% (171 KiB → ~35 KiB). On mobile that is the
difference between a 1s and a 4s list; on Supabase it is egress you pay for. Apply the same rule to
inbox threads and finance line items.

---

## Caching

What exists and works:

- TanStack Query with `staleTime: 15s` default, `refetchOnWindowFocus: false`, 5-minute stale time
  for org/property structure, and visibility-aware polling for dashboards (60s).
- Edge response cache classes that fail closed to `private, no-store`; public classes carry explicit
  `max-age`/`s-maxage`/`stale-while-revalidate`.
- A Postgres `query_cache` table with a sweeper for expensive aggregates (8 rows locally).
- In-memory caches for platform settings, AI limits, auth user verification, email templates and the
  rate-limit block list.
- Partial indexes for every hot booking query.

Gaps:

| #   | Gap                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **No client cache for session/bootstrap data.** Every navigation re-fetches plan, preferences and assistant settings.                                                                                                            |
| P2  | **`get-public-platform-status` is fetched on every page and rate-limits at 30/min per IP** (see 06-X5). Cache it in `sessionStorage` for 60s and stop logging 429s as console errors.                                            |
| P2  | **Public listing/search responses rely on `publicDynamic` (max-age 60)** but there is no invalidation on publish/archive, so a host can wait up to a minute to see their change on the public site. Acceptable, but document it. |
| P2  | **Image transforms are opt-in** (`VITE_SUPABASE_IMAGE_TRANSFORMS`). If unset in production, full-resolution originals are served for every listing photo, which is the largest egress line item. Verify in the deployed env.     |
| P3  | **`query_cache` is used by only a few aggregates**; dashboard stats are recomputed per request within the 60s client poll.                                                                                                       |

---

## AI cost model and unit economics

Pricing lives in code, not in the database:

| Feature                      | Model                       | Cost driver                   | Cost per action                      |
| ---------------------------- | --------------------------- | ----------------------------- | ------------------------------------ |
| Receipt / ID validation      | gemini-2.5-flash            | tokens ($0.30 / $2.50 per 1M) | ~$0.001 (1 credit)                   |
| Inbox suggest / captions     | gemini-3.1-flash-lite       | tokens ($0.25 / $1.50)        | ~$0.0005                             |
| Dashboard assistant          | flash / flash-lite          | tokens + tool rounds          | ~$0.01 per complex turn (10 credits) |
| Image, draft                 | gemini-3.1-flash-lite-image | per image                     | $0.0336 (34 credits)                 |
| Image, standard 1K / 4K      | gemini-3.1-flash-image      | per image                     | $0.045 / $0.151 (45 / 151 credits)   |
| Image, premium               | gemini-3.1-flash-image      | per image                     | $0.134-0.24 (134-240 credits)        |
| Video, draft 720p 8s         | veo-3.1-lite                | $0.05/s                       | $0.40 (400 credits)                  |
| Video, standard 720p / 1080p | veo-3.1-fast                | $0.10-0.12/s                  | $0.80-0.96 (800-960 credits)         |
| Video, premium               | veo-3.1                     | $0.40/s                       | **$3.20 (3,200 credits)**            |
| Voice receptionist           | gemini live                 | $0.023/min                    | 23 credits/min                       |

Credit unit is $0.001 of estimated provider cost. Plan allowances are per **org**:

| Plan     | Price           | AI credits | Credit value at cost | Share of revenue at full use |
| -------- | --------------- | ---------- | -------------------- | ---------------------------- |
| Free     | ₱0              | 0          | $0                   | n/a                          |
| Starter  | ₱499 (~$8.9)    | 0          | $0                   | n/a                          |
| Pro      | ₱999 (~$17.8)   | 5,000      | $5                   | 28%                          |
| Business | ₱1,799 (~$32.1) | 25,000     | $25                  | **78%**                      |
| Managed  | ₱4,999 (~$89)   | 60,000     | $60                  | **67%**                      |

### P1. Business and Managed AI allowances can consume most of the plan revenue

Twenty-six standard 1080p videos (25,000 credits) cost the platform ~$25 against ~$32 of Business
revenue, before Supabase, Vercel, email and support. A single property on Business that uses the
studio heavily is close to break-even. Options: lower the video allowance or raise its credit price
(video is the outlier: one premium clip is 3,200 credits, 12.8% of the whole allowance), cap premium
tier to Managed, or price video as an add-on.

### P1. Failed and timed-out generations are not billed

`expireStaleMarketingGenerationJobs` marks `pending/processing/finalizing` jobs as failed with
`error_code: timeout` and writes no usage. The billing-repair sweeper only looks at
`job_status = 'completed'`. For async Veo jobs the provider may already have produced (and charged
for) the clip. The platform eats that cost with no credit deduction and no record. Add a
`billed_partial` path for provider-confirmed-but-unfinalized jobs, or reconcile provider usage
totals against `ai_platform_usage_events` daily.

### P2. Prompt-enhance calls are platform cost

`marketing_image_prompt_enhance` and `marketing_video_prompt_enhance` are recorded with
`recordAiUsagePlatformOnly` (0 credits) by design. Individually trivial (~$0.0003), but it means every
image generation costs the platform one extra text call with no host credit. Fine at current volume;
worth a line in the unit-economics doc.

### P2. Budget controls are generous by default

Defaults: 200 calls/day, 5,000/month, $10 cost/day per org, 100,000 credits/day, 1,000,000/month, and
a platform-wide $150/day cap. The daily credit limit is **4× the Business monthly allowance**, so if
a monthly window resets or an override is misconfigured, one org can burn four months of allowance in
a day before the platform cap notices.

### P2. Cost visibility exists but does not reconcile

See 04-A4: four admin surfaces report different spend for the same month, and `ai_platform_usage_events`
showed 2 assistant calls with $0 cost while the Limits tab showed $0.62. If these numbers are used for
pricing decisions they need one aggregate.

---

## Third-party inventory and cost risks

| Service            | Role                                   | Cost risk                | Note                                                                                                                                             |
| ------------------ | -------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase           | DB, Auth, Storage, Functions, Realtime | **Egress + invocations** | 368 functions and full-row list payloads are the two biggest multipliers. Image transforms off = full-size photos.                               |
| Vercel             | Hosting, previews, SEO middleware      | Bandwidth/functions      | Public marketing pages are static-ish; fine.                                                                                                     |
| Gemini             | All AI                                 | Video is the outlier     | See unit economics. Batch API (~50% cheaper) is unused for non-urgent jobs (trends, receipt re-checks).                                          |
| Groq               | Text fallback                          | Low                      | Priced separately in code, good.                                                                                                                 |
| Resend             | Transactional + inbound                | Low per email            | 5-8 emails per booking; volume scales with bookings, not page views.                                                                             |
| PayMongo           | Payments                               | % per transaction        | Only cost when checkout works.                                                                                                                   |
| PostHog            | Analytics                              | Event volume             | Eager bundle cost is the bigger issue right now.                                                                                                 |
| Sentry             | Errors                                 | Event volume             | Same.                                                                                                                                            |
| Meta               | Messenger/IG                           | Free                     | Webhook-driven.                                                                                                                                  |
| Google Maps        | Address picker                         | Per load                 | Only on settings; key exposed client-side by design (referrer-restricted).                                                                       |
| Remotion / Polotno | Video/image editing                    | Licence                  | Commercial licences required for both; `VITE_REMOTION_LICENSE_KEY` ships to the client (expected for Remotion, but confirm it is domain-locked). |
| Telegram           | Notifications                          | Free                     | Fine.                                                                                                                                            |
| Unsplash           | Seed images only                       | Free                     | One URL is 404 (see 05-O8); replace with hosted assets.                                                                                          |

---

## Recommendations, ordered by leverage

1. **Trim `list-bookings` and inbox list DTOs** to rendered columns. Biggest egress and mobile win for
   the least code.
2. **Add a cached `workspace-bootstrap` endpoint** and fix duplicate query keys. Removes 5-7 calls per
   navigation and the `×2` duplicates measured here.
3. **Lazy-load Sentry and PostHog** out of the initial bundle.
4. **Verify `VITE_SUPABASE_IMAGE_TRANSFORMS=true` in production**, or accept full-size image egress.
5. **Fix the AI video economics** (credit price, tier gating, or add-on) and bill timed-out provider
   jobs.
6. **Consolidate edge functions** (368 → under 100) to cut cold starts and deploy time; see
   14-C3.
7. **Move the PWA precache budget** off 96% before the next shell change.
8. **Batch non-urgent Gemini work** (trends, nightly re-checks) at 50% cost.
