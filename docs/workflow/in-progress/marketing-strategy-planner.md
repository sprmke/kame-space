---
stage: in-progress
title: 'Marketing Planner: AI strategy, schedule and execution for listing promotion'
status: planned
tags:
  [workflow, planned, marketing, ai, publishing, meta, scheduling, analytics, plans-and-permissions]
updated: 2026-11-09
kind: plan
---

# Marketing Planner: AI strategy, schedule and execution for listing promotion

> **Revised 2026-11-09 (execute-plan):**
>
> - Audited every named path, symbol and endpoint against the tree; all exist. Two drift notes fixed: `_shared/bookingPace.ts` is a bucketed new-bookings series (Analytics Trends), not a summary "pace vs last year" signal, so §2 now says the planner derives the comparison from it; `resolveDefaultMarketingStudioTab({ lastTab, aiAvailable })` and `MARKETING_STUDIO_TABS` need extending in Phase 1 (recorded in §6 P1.7).
> - Added §10.1 execution `Decisions` table, per-phase `Acceptance` lines, and §9.1 `Edge cases`.
> - Session scope: Phases 0 and 1 are the shipped milestone for this branch. Phases 2 to 6 are left for follow-up PRs; §6 marks them `Not started` rather than implying work was done.

## 1. Goal

Hosts can already **make** marketing (Content Studio: AI Studio, Posts, Videos, Calendar) and **publish** it to a connected Facebook Page or Instagram account. What they cannot do is answer the questions that come first:

- What should I post **today**, in the next **3 / 5 days**, or **this week**?
- **Why** that, and **when** exactly?
- Which **format** (post, carousel, story, reel, availability calendar) and which **channel**?
- How do I get it **done** in a few taps, even if I never connected Facebook?
- Did it **work**?

The Marketing Planner turns the data the app already holds (open nights, gap nights, long weekends, booking pace, lead time, reviews, guest mix, pricing, page traffic) into a short, ranked, dated to-do list of marketing items. Each item explains itself in plain words, opens the right editor already filled in, and ends with **Publish**, **Schedule**, or **Share it yourself**. Results flow back so the plan improves every week.

**Who it is for:** non-technical hosts with 1 to 10 listings who post on Facebook first, Instagram second, and TikTok, Facebook Groups and chat apps by hand.

**Business goal:** a reason to open the app every day that is not an operational chore, and a visible line from "used the planner" to "got bookings". That line is what sells Pro and Business.

### Success metrics (tracked from Phase 1)

| Metric                                                                       | Source                                         | Target after 8 weeks live        |
| ---------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------- |
| Planner onboarded properties / properties with Marketing access              | `marketing_planner_settings.onboarded_at`      | 40%                              |
| Weekly active planner hosts (opened Plan tab and completed at least 1 item)  | PostHog `planner_item_completed`               | 25% of onboarded                 |
| Items completed / items planned                                              | `marketing_plan_items.status`                  | 50%                              |
| Tracked visits per completed item                                            | `property_page_views.utm_campaign`             | Baseline in Phase 5, then +20%   |
| Attributed booking requests per month                                        | `guest_submissions.attribution`                | Baseline in Phase 5              |
| Gap / open nights filled within the promoted window vs. non-planner listings | analytics bundle, cohort compare               | Directional, reported monthly    |
| Upgrade clicks from planner gates (Free/Starter to Pro, Pro to Business)     | PostHog `upgrade_modal_opened{source:planner}` | Tracked, no target until Phase 1 |

---

## 2. What we already have (reuse map)

The planner is mostly a **brain and a to-do list on top of existing parts**. Nothing below gets rebuilt.

| Need                                 | Existing piece                                                                                                                                                                                | Notes for the planner                                                                                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Occupancy, ADR, pace, lead time, mix | `_shared/analyticsService.ts#computeAnalyticsBundle` (`kpis`, `forward.gapNights`, `stateAssessment.forwardOccupancyState30d/60d`, `pickup`, `distributions.leadTime/partySize/guestOrigins`) | Main signal input. Already computed per property for Analytics and the AI review.                                                                                                                                        |
| Night-level availability (Manila)    | `_shared/calendarAvailabilityManila.ts`, `_shared/availabilityService.ts`, `_shared/propertyBlockedDates.ts`, `_shared/cleaningBuffer.ts`                                                     | Source of truth for "open tonight", "2 nights left", claim checks before publish.                                                                                                                                        |
| Booking pace vs. last year           | `_shared/bookingPace.ts#buildNewBookingsPoints`                                                                                                                                               | Buckets new bookings per day/week against the same calendar dates last year. The planner compares the forward window's pickup with the year-earlier series to produce "bookings are slower than last year for December". |
| Nightly rates and discounts          | `_shared/smartPricingEngine.ts` (factors, orphan gap), `_shared/propertyPricing.ts`                                                                                                           | Only a **live** rate may appear in copy. The engine's orphan-gap logic is reused for gap detection.                                                                                                                      |
| Reviews for social proof             | `_shared/marketingGuestReviews.ts` (`socialSeedAllowed`), `guest_reviews`, `_shared/guestReviewFeedbackTags.ts`                                                                               | New 4 star+ reviews and top positive tags (`sparkling_clean`, `great_location`, ...) become content angles.                                                                                                              |
| Property facts (no invention)        | `marketingPosterDirector.ts` facts input (name, brand, location, amenities, nightly rate)                                                                                                     | Same facts object feeds plan briefs, so the "never invent facts" rule carries over.                                                                                                                                      |
| Templates mapped to goals            | Posts presets: **Promos**, **Last slots 1/3/5**, **Giveaway**, **Fully booked**, **Reviews**. Video recipes: **One left**, **Weekday cut**, **Flash deal**, **Guest love**, **Ber months**... | Every opportunity type maps to a preset or recipe, so "Create" opens a finished draft, not a blank canvas.                                                                                                               |
| AI post / photo / clip               | AI Studio (`marketing-ai-sessions`, `generate-marketing-template` `contentType: 'poster'`, `generate-marketing-media`), angles `Vibe · Promo · Amenities · Feature · Stay info`               | Planner hands off a filled description + angle. Credits shown before Generate as today.                                                                                                                                  |
| Availability calendar image          | Calendar builder + AI calendar                                                                                                                                                                | A very common Philippine host post ("available dates this month"). First-class planner format.                                                                                                                           |
| Captions                             | `generate-marketing-caption` / `_shared/marketingCaptionAi.ts`                                                                                                                                | Superseded for planner items by the plan brief (Phase 4), kept for the publish dialog.                                                                                                                                   |
| Publishing                           | `publish-to-meta`, `_shared/metaPublishing.ts`, `marketing_publications`, `PublishDialog`, `PublishHistory`                                                                                   | Gaps (scheduling cron, permalink, retry, Reels in UI) are in [`marketing-meta-publishing-gaps.md`](./marketing-meta-publishing-gaps.md).                                                                                 |
| Meta connection                      | `social_channel_connections` via Guest Inbox (`meta-inbox-oauth-*`), scopes in `_shared/metaInboxConfig.ts`                                                                                   | Insight scopes are **not** requested today (see §5.9).                                                                                                                                                                   |
| Page traffic + UTM                   | `property_page_views` (`utm_source`, `utm_medium`, `utm_campaign`, `referrer_host`), `property-page-view`, `usePropertyPageViewTracking`                                                      | Attribution half-built already. Booking submissions do not record UTM yet.                                                                                                                                               |
| Advisory AI over metrics             | `analytics-ai-review` (+ cron), `_shared/hostPlaybook.ts` (`applies_when` matcher)                                                                                                            | Pattern to copy: deterministic evidence, LLM writes words, deep links into the app.                                                                                                                                      |
| Deterministic engine + LLM rationale | Smart Pricing (`smartPricingEngine.ts` + `smartPricingAi.ts` + `smartPricingRun.ts` + cron)                                                                                                   | **The architecture template for this plan.** Numbers and dates from code, words from the model.                                                                                                                          |
| Scheduled reminders                  | Telegram marketing (`_shared/telegramMarketing.ts`, cron slots, cancellation + new booking hooks), in-app notifications, web push, `notification_preferences`                                 | Reminder delivery and the "dates just freed by a cancellation" trigger already exist.                                                                                                                                    |
| AI gateway, credits, limits, evals   | `_shared/ai/llmClient.ts#generateStructured`, `definePrompt`, `aiModelRouter.ts`, `aiLimitResolver.ts`, `assertOrgAndPropertyAiQuota`, `tests/evals/`                                         | New feature key + prompt module + eval suite. No direct provider calls (CI `check:ai-gateway`).                                                                                                                          |
| Dashboard assistant                  | `dashboardAssistantTools.ts` (`list_marketing_templates`, `get_marketing_publish_history`, publish tools)                                                                                     | Add planner read/write tools in Phase 6.                                                                                                                                                                                 |
| Plan / RBAC / availability gates     | `planEntitlements.ts`, `propertyTeamPermissions.ts`, `featureAvailabilityCatalog.ts` (`marketing.ai_studio`)                                                                                  | New keys and leaves in §5.7.                                                                                                                                                                                             |

**Already-filed idea this plan implements:** #12 "Marketing strategy suggestions" in [`ai-opportunities-roadmap.md`](./ai-opportunities-roadmap.md), and the "Review-to-marketing content pipeline" item in [`property-management-feature-roadmap.md`](./property-management-feature-roadmap.md).

---

## 3. Research findings

Research was done on 2026-11-09. Vendor studies disagree with each other on exact numbers, so the plan treats every number below as a **starting assumption** that each property's own results replace (§4.6, Phase 5). Sources are listed in §12.

### 3.1 Channel reality in the Philippines

- **Facebook is the default channel.** DataReportal Digital 2026 (via GMA News): among internet users 16+, Facebook reaches 94.9% monthly, Messenger 90.6%, YouTube 85%, TikTok 82.2%, Instagram 71.2%. Facebook drives about **84% of social referral traffic**.
- **Product consequence:** the planner is **Facebook-first** by default, Instagram second. TikTok, Facebook Groups, Messenger, Viber and WhatsApp communities are real channels for hosts, but none can be published to from our app today (see §3.5), so they get a first-class **Share it yourself** flow instead of being ignored.

### 3.2 What the platforms reward

- Instagram ranking (Mosseri, as reported by Buffer and others): **watch time**, **likes per reach**, **sends per reach**. Sends (DM shares) matter most for reaching non-followers.
- **Reels drive reach, carousels drive engagement and saves** (Buffer, 4M+ posts: Reels about 36% more reach than carousels; carousels about 12% more engagement). Single images are weakest for reach.
- The first **3 seconds** of a reel decide most drop-off; the hook is the opening frame + on-screen text + first line.
- **Product consequence:** each week's mix includes at least one reel (property walkthrough, "one left" or "guest love" recipe) and one carousel (amenities, "what's included", availability + photos). Briefs always contain a **hook** line and a "send this to your barkada" style share prompt, because sends are the reach signal.

### 3.3 Cadence and timing

- Cadence guidance converges on **2 to 5 feed posts a week**, about **2 reels** a week, and **near-daily stories** (Uplisting, Mosseri via secondary sources; not benchmarked).
- Timing studies disagree: Sprout Social 2026 says weekday **midday to evening** (Facebook Tue/Wed 12 to 8 PM; Instagram Mon 2 to 4 PM, Tue 1 to 7 PM, Wed 12 to 9 PM, Thu 12 to 2 PM; weekends weakest). Buffer 2026 favors **mornings** (Thursday 9 AM).
- **Product consequence:** default slots in `Asia/Manila` are **09:00** (same-day availability stories), **12:00 to 14:00** and **19:00 to 21:00** (feed posts and reels), Tuesday to Thursday weighted higher. After a property has enough published posts with insights, its own best windows replace the defaults (§4.6).

### 3.4 Short-term rental tactics that work

- **Every post needs a booking path** (link, "message us", tracked link in bio). Social drives discovery, not bookings.
- **Last-minute availability posts** with a short video beat static text (Guesty). Post open dates in **destination Facebook groups**, local travel groups, Google Business Profile and to past guests (Houfy, Touch Stay).
- Content pillars that cover almost everything: **Property moments, Destination value, Social proof, People and operations** (Boostly); property showcase is the largest share at about 30% (Uplisting).
- **Philippines calendar:** Holy Week demand surged about 50% in 2026, mostly domestic, with 3 to 4 day trips most common (Manila Bulletin, AirAsia MOVE). 73% of Filipinos plan staycations around **long weekends** (Klook Travel Pulse 2024). 2026 holidays are set by **Proclamation No. 1006** (plus separately proclaimed Eid dates). Ber months and summer (March to May) are well-known peaks; payday weekends (15th and 30th) are a common local belief we treat as a **low-weight hypothesis** until our own data confirms it.
- **Product consequence:** a platform **marketing calendar** (holidays, long weekends, seasons) seeded per year, plus host-added **local events** (festival, concert, school break), drives staged campaigns: teaser, reminder, last call.

### 3.5 API constraints that shape the design

| Platform / surface            | What we can do                                                                                                                                                                                       | What we cannot do                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Facebook Page feed photo/post | Publish now; native `scheduled_publish_time` between **10 minutes and 30 days** ahead (Pages API guide; feed reference says 75 days). Scheduled photos must be uploaded unpublished.                 | Edit a scheduled post within 3 minutes of its publish time.                                          |
| Facebook Reels                | `/{page-id}/video_reels` upload session (start, upload to `rupload.facebook.com`, finish). **30 API reels per 24 h** per Page.                                                                       | List reels from the feed edge.                                                                       |
| Facebook Stories              | `photo_stories` / `video_stories` exist (third-party docs only; we did not find an official reference). Scheduling support is unclear.                                                               | Rely on it until verified in Phase 0 spike.                                                          |
| Instagram feed / carousel     | Container + `media_publish`. Carousel **2 to 10** children; `location_id` and `collaborators` on the parent. Publishing cap checked via `GET /{ig-user-id}/content_publishing_limit` (rolling 24 h). | **Native scheduling** (we must run our own scheduler). Containers expire after 24 h.                 |
| Instagram stories             | Publish image/video stories.                                                                                                                                                                         | Interactive stickers (link, poll, countdown) via API. Link stickers stay a manual step.              |
| Instagram reels               | `REELS` container, poll `status_code` until `FINISHED`.                                                                                                                                              | Trial reels and audio picks via API.                                                                 |
| Meta insights                 | IG media `views`, `reach`, likes, comments, shares, saved, total interactions. FB post `post_media_views`; reach moved to `post_total_media_view_unique` (June 15, 2026, Graph v25).                 | `impressions` (removed 2025). Old metrics have no history after removal.                             |
| Facebook Groups               | Nothing. The Groups API and `publish_to_groups` were **removed on April 22, 2024**.                                                                                                                  | Any automated group post. Manual share only.                                                         |
| TikTok                        | Content Posting API **upload to inbox (draft)**; creator finishes in the TikTok app. Direct Post needs a separate **audit**; unaudited clients post **private only**, max 5 users per 24 h.          | Public direct post without the audit.                                                                |
| Messenger / Viber / WhatsApp  | Nothing automated for broadcast to groups.                                                                                                                                                           | Manual share via the phone share sheet.                                                              |
| Any phone app (manual path)   | Web Share API Level 2 (`navigator.canShare({ files })` then `navigator.share`) from the PWA; download fallback.                                                                                      | Pre-fill an Instagram caption through the share sheet; we copy the caption to the clipboard instead. |

**Design decision (recommended, see §10 D3):** run **our own scheduler for every platform**, including Facebook, instead of Facebook's native scheduling. Reasons: Instagram needs it anyway, one code path, and we can **re-check every claim** ("2 nights left this weekend") seconds before publishing. Native scheduling would publish a claim that became false after a booking came in.

### 3.6 Competitor landscape

- **Social schedulers** (Buffer, Later, Hootsuite with OwlyWriter, Canva for design): calendars, AI captions, best-time suggestions. They do not know the host's calendar, so they cannot say "post this because Friday is still open".
- **PMS platforms** (Guesty HostAI marketing strategy for SEM/SEO, Hostaway Booking Website Pro with AI marketing/SEO, Lodgify Direct): focus on direct-booking websites and search. None found with an availability-driven **social** planner.
- **Our edge:** we own the booking calendar, the reviews, the pricing, the design studio and the publisher in one product. The planner is the piece that connects them. That is the pitch: **"Kame Space tells you what to post, makes it, posts it, and shows you the bookings it brought."**

### 3.7 Principles derived from the research

1. **Truth first.** Every factual claim in a post (open dates, nights left, price, rating) comes from code, is stored as a machine-checkable `claims` object, and is re-validated before publish and when the calendar changes. No fake urgency, ever.
2. **Deterministic brain, AI voice.** Signals, ranking, dates and times come from pure, tested code. The model writes hooks, captions and the "why", and may only choose among allowed templates. Same split as Smart Pricing.
3. **Works with zero AI and zero connections.** A rules-only plan with template copy and a Share-it-yourself flow is a complete product. AI and Meta publishing make it better, they are not prerequisites.
4. **Today first.** The default view is what to do today, at most 3 items a day by default. Hosts can look ahead (3 days, 5 days, week) but are never handed a wall of tasks.
5. **One tap to a finished draft.** Every item opens the right editor already filled with the right template, photos, dates and copy.
6. **Facebook-first, every channel welcome.** Connected channels publish; every other channel gets a guided manual flow and still counts.
7. **Close the loop.** Tracked links on every item, results on every card, and a weekly recap in plain words.

---

## 4. Product design

### 4.1 Core loop

```
 data we already have                    pure code                      AI (optional)            host
┌──────────────────────┐   ┌──────────────────────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│ availability, pace,  │──▶│ 1 Signals  →  Opportunities      │──▶│ 3 Brief writer    │──▶│ 4 Prepare (editors)  │
│ lead time, reviews,  │   │ 2 Scheduler → dated plan items   │   │  hook, caption,   │   │ 5 Publish / Schedule │
│ pricing, events,     │   │   (format, channel, time, claims)│   │  why, template    │   │   or Share yourself  │
│ page views, insights │   └──────────────────────────────────┘   └──────────────────┘   └──────────┬───────────┘
└──────────▲───────────┘                                                                            │
           │                         6 Measure: tracked visits, bookings, Meta insights             │
           └────────────────────────────── 7 Learn: best times, formats, angles ◀───────────────────┘
```

### 4.2 Host experience

#### Where it lives

**Marketing → Plan**, a new **first tab** in Content Studio (`?tab=plan`), before AI Studio. Plan is the default tab for a property that has not picked another tab yet (`resolveDefaultMarketingStudioTab`). A compact **"Marketing today"** card on the property Dashboard shows the next 1 to 3 items with their main action. Both decisions are in §10 (D2).

#### First visit: setup in three steps (bottom sheet on phones)

1. **What matters most right now?** Pick up to two: Fill open nights · Weekends and long weekends · More direct bookings · Longer stays · Get known (brand). Pre-selected from data: underbooked 30 days ahead pre-selects "Fill open nights"; high OTA share pre-selects "More direct bookings".
2. **Where do you post?** Connected Facebook Page / Instagram (from Inbox, with a **Connect** link when missing) plus manual places: TikTok, Facebook groups (host adds names and links of groups they post in), Messenger / Viber / WhatsApp groups, Google Business Profile, Other. We never post to manual places; we remind and help share.
3. **How much time do you have?** **Light** (about 30 min a week) · **Steady** (1 to 2 hours) · **Active** (about 3 hours). Plus language: **English**, **Filipino**, **Taglish**. Reminders: app notification (default), Telegram (if set up), email digest.

Then the first plan appears immediately (rules-based, free of credits), with the AI version one tap away on entitled plans.

#### The Plan view

- **Range chips:** **Today** (default) · **3 days** · **5 days** · **Week**. A **Coming up** strip below shows staged campaigns further out (for example, a long weekend 3 weeks away).
- **Summary card**, one or two plain sentences generated from the signals, for example: "2 nights are still open this weekend and the Nov 28 to 30 long weekend is fully open. Two posts and a few stories this week will help." A **Why?** link opens the evidence (open dates, pace vs. last year, lead time).
- **Opportunity chips** (tap to filter): Open this weekend · 1-night gaps · Long weekend · New 5-star review · Fully booked (social proof).
- **Agenda list** (phone-first), grouped by day. Each card:
  - Time and channel icons, format glyph (post, carousel, story, reel, calendar).
  - Title in host words: "Open this weekend: Fri and Sat".
  - One-line why: "Guests usually book you 6 days ahead. Friday is 4 days away."
  - Status pill and **one main action** that changes with status: **Create** → **Review** → **Schedule** / **Publish** / **Share** → **Done**. Swipe or ⋯ for Reschedule, Skip, Change format, Delete.
  - Completion uses the check-circle task pattern from `dashboard-mobile-native-v2.md`.
- **Desktop:** agenda left, week grid right (drag to reschedule, drop on a day). Item detail opens in a right sheet.
- **Empty and done states:** "You're done for today. Next: Thursday 7 PM reel." No fake work is invented to fill a day.

#### Item detail (sheet)

- **Brief:** hook, key message, call to action, caption per channel (copy button), hashtags (Instagram only, max 5), suggested photos (thumbnails from the listing gallery), suggested template, best time and why.
- **Truth panel:** the claims this item makes ("Open: Fri Nov 13, Sat Nov 14 · From ₱3,200/night · 4.9 from 38 reviews") with a live check mark, re-checked on open.
- **Asset:** preview of the attached design, video, calendar or AI creation; **Create** if none, **Open in editor** if one exists.
- **Publish options:** connected channels show **Publish now** / **Schedule** (time picker pre-set to the planned slot); manual channels show **Share it yourself**.
- **Results** (after publishing): views, reach, interactions, tracked visits, booking requests, in plain words ("38 people opened your page from this post. 1 booking request.").

#### Share it yourself (no connection needed)

1. At the planned time the host gets a reminder: "Time to post: Open this weekend (Facebook groups)".
2. Opening it on the phone shows the finished image or video, the caption (auto-copied), and the list of places (the host's groups and apps) as a checklist.
3. **Share** opens the phone share sheet with the file (`navigator.share({ files })`); the host picks Facebook, TikTok, Viber or any app and pastes the caption. Desktop or unsupported browsers get **Download** + **Copy caption**.
4. The host ticks the places they posted to and taps **I posted it** (optionally pastes the post link). Status becomes `posted_manually`; tracked link visits still count toward results.

#### Prepare my week (batch)

One button prepares drafts for every item in the range that has no asset yet:

- Template-based items (Last slots, Promos, Reviews, Fully booked, calendars, video recipes) are filled from the brief for free.
- AI Studio items (AI Post, photo, clip) show the total credit cost first and run only on confirm.
- Each item moves to **Ready to review**. Nothing is published without the host's tap unless Autopilot is on (Phase 6).

#### Weekly recap and next plan

On the host's chosen plan day (default Monday 08:00 Manila), entitled properties get "Your plan for this week is ready" plus last week's results in two lines. Delivered in-app and by the host's chosen reminder channels.

### 4.3 Opportunity catalog

Each opportunity is produced by pure code from the inputs in §2. The **post-by** rule uses the property's own median lead time (`distributions.leadTime`), falling back to the defaults shown here.

| Type (`opportunity_type`) | Trigger (deterministic)                                                                                    | Post-by rule (default)                                             | Formats (in priority order)     | Maps to                                                      | Pillar       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------ | ------------ |
| `tonight_tomorrow`        | Check-in possible tonight or tomorrow (night open, min stay and cleaning buffer satisfied)                 | Now, then a 09:00 story the next morning if still open             | Story, FB post                  | Calendar story, **Last slots** preset                        | Offers       |
| `weekend_open`            | Friday and/or Saturday night open within the next 14 days                                                  | Primary: weekend minus median lead time; last call: Thursday story | Reel, carousel, story           | **Last slots**, **One left** / **Weekday cut** recipes       | Offers       |
| `gap_nights`              | 1 to 2 night orphan gap between bookings (reuse Smart Pricing orphan logic)                                | Gap start minus median lead time, min 2 days                       | FB post, story                  | **Last slots 1**, AI Post angle Promo                        | Offers       |
| `last_slots_month`        | 5 or fewer open check-in dates left in this or next month                                                  | As soon as true, then weekly while true                            | Calendar image, carousel        | Calendar builder, **Last slots 1/3/5**                       | Offers       |
| `long_weekend`            | Holiday or long weekend in `marketing_calendar_events` with open nights                                    | Teaser at 35 days, reminder at 14, last call at 3 (tuned by data)  | Reel, carousel, calendar, story | Seasonal recipes, AI Post angle Vibe                         | Offers       |
| `seasonal_moment`         | Season window (Ber months, summer, Valentine's, Christmas, New Year, school break)                         | Window start minus 21 days                                         | Reel, post                      | **Ber months** and seasonal recipes                          | Destination  |
| `freed_dates`             | A cancellation freed nights inside the next 30 days (event from `cancel-booking`, same hook Telegram uses) | Immediately (urgent)                                               | Story, FB post                  | **Last slots**, calendar story                               | Offers       |
| `rate_live_drop`          | Smart Pricing **applied** a lower rate on open nights (never on a recommendation alone)                    | Next slot                                                          | Post, story                     | **Promos** preset, **Flash deal** recipe                     | Offers       |
| `fully_booked`            | A weekend or month is fully booked                                                                         | Within 2 days of selling out                                       | Post, story                     | **Fully booked** (stamp / waitlist) + next open dates        | Social proof |
| `new_review`              | New `socialSeedAllowed` review, 4 stars or more, not yet used in any plan item or design                   | Within 7 days                                                      | Post, reel                      | **Reviews** presets, **Guest love** / **Stay again** recipes | Social proof |
| `rating_milestone`        | Average 4.8+ with at least 10 reviews, every 10th review, Superhost or verified badge earned               | Within 7 days                                                      | Post                            | **Reviews** preset (Stars stack)                             | Social proof |
| `amenity_spotlight`       | Rotating amenity or feature from listing facts, weighted by top positive review tags                       | Fills cadence gaps                                                 | Carousel, reel                  | AI Post angle Amenities / Feature                            | Property     |
| `audience_fit`            | Strong party-size or origin pattern (e.g. 60% groups of 5+, top origin city)                               | Fills cadence gaps                                                 | Post, reel                      | Copy angle only ("barkada weekend", "family-ready")          | Property     |
| `direct_booking_push`     | Top channel share over 70% from an OTA, or goal "More direct bookings"                                     | Once a week                                                        | Post, story                     | **Promos** with a voucher or perk, tracked link              | Offers       |
| `local_event`             | Host-added local event near the property                                                                   | Event start minus 21 days, reminder at 7                           | Post, reel                      | AI Post angle Vibe                                           | Destination  |
| `content_refresh`         | New listing photos uploaded, or photos never used in any asset                                             | Fills cadence gaps                                                 | Carousel, reel                  | Collage, AI Post angle Vibe                                  | Property     |
| `cadence_gap`             | No feed post in 5 days, or no reel in 10 days                                                              | Next free slot                                                     | Reel                            | Evergreen recipes (Quiet morning, Soft stay)                 | Property     |
| `payday_weekend`          | Weekend after the 15th or the last day of the month (low weight hypothesis)                                | Thursday before                                                    | Story                           | **Promos** / **Last slots**                                  | Offers       |

**Ranking score** (pure, unit-tested): `urgency × value × fit × freshness`, where urgency comes from hours until post-by, value from nights at stake × ADR (capped), fit from the host's goals and channels, and freshness penalizes an angle used in the last 7 days. Ties break toward the cheapest-to-make format.

### 4.4 Strategy playbook (versioned data, not prompts)

Lives in `_shared/marketingPlaybook.ts` with a `PLAYBOOK_VERSION`. Every plan stores the version it used.

**Cadence presets** (from §3.3):

| Preset | Feed posts / week | Of which reels | Stories / week | Max items / day |
| ------ | ----------------- | -------------- | -------------- | --------------- |
| Light  | 2                 | 1              | 3              | 2               |
| Steady | 3 to 4            | 2              | 5              | 3               |
| Active | 5                 | 2 to 3         | 7              | 4               |

**Pillar mix by forward occupancy state** (`stateAssessment.forwardOccupancyState30d`). Product defaults, labelled as heuristics, tuned in Phase 5:

| State          | Offers / availability | Property moments | Social proof | Destination | People / behind the scenes |
| -------------- | --------------------- | ---------------- | ------------ | ----------- | -------------------------- |
| `underbooked`  | 40%                   | 25%              | 20%          | 10%         | 5%                         |
| `building`     | 30%                   | 30%              | 20%          | 10%         | 10%                        |
| `strong`       | 20%                   | 30%              | 25%          | 15%         | 10%                        |
| `fully_booked` | 10% (next open dates) | 30%              | 30%          | 15%         | 15%                        |

**Format guide:** reels for reach (walkthrough, "one left", guest love); carousels for saves (amenities, what's included, availability plus photos, "5 reasons"); single image for announcements and availability calendars; stories for urgency and daily availability (link sticker added by hand).

**Copy rules** fed to the brief writer and the template copy library:

- Hook in the first line and first frame; no more than 8 words.
- One message per post; one call to action: Message us · Book with the link · Comment "DATES".
- Prices, dates, ratings and amenities only from claims and facts.
- A share prompt on reach posts ("Send this to the friend you'd bring").
- Instagram: up to 5 relevant hashtags, location tag when the Page has one. Facebook: no hashtag blocks.
- Language follows the host setting; Taglish keeps sentences short and natural, never forced.
- No em dash, no AI tells (same rules as `human-copy`).

**Default posting windows** (`Asia/Manila`): 09:00 (stories, same-day availability), 12:00 to 14:00 and 19:00 to 21:00 (feed, reels). Tuesday to Thursday weighted 1.2, Friday 1.0, Monday 1.0, weekend 0.8. Never between 23:00 and 07:00.

### 4.5 Truthfulness rules

Every item stores `claims` such as `{ openNights: ['2026-11-13','2026-11-14'], nightsLeftInMonth: 3, rateFrom: 3200, rating: { avg: 4.9, count: 38 }, reviewId }`.

| When                                  | Check                                                                                                        | If false                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Item detail opened                    | `validateClaims(claims, live)`                                                                               | Truth panel shows what changed and offers **Update the post**                                                  |
| Booking created / cancelled / blocked | Planner refresh for that property (debounced)                                                                | Items whose claims broke move to `stale` with a plain reason ("Saturday got booked")                           |
| 60 seconds before a scheduled publish | Scheduler re-runs `validateClaims`                                                                           | Publish is **held** (`status: held`), host notified: "Not posted: Saturday is no longer open. Update or skip." |
| Rate claim                            | Rate must equal the resolved live rate for those nights                                                      | Hold, same as above                                                                                            |
| AI copy                               | `marketingPlanGuard` finds every number, date and amenity in the text and checks it against claims and facts | Reject the draft, fall back to template copy, record `guard_rejected`                                          |

### 4.6 Learning (Phase 5)

- **Best times:** per property, engagement per view by weekday × time bucket from `marketing_post_metrics`, blended with the default prior using a shrinkage weight `n / (n + 12)`. Shown only after 12 published posts with insights: "Your audience reacts most Tue to Thu, 7 to 9 PM."
- **Best formats and angles:** same blend over format and `opportunity_type`, nudging the mix within ±10 points of the pillar table.
- **Lead time:** promote windows by the property's own lead-time distribution, separate for holidays when there are at least 8 holiday stays.
- **Never learned:** truth rules, quiet hours, cadence caps.

### 4.7 A day in the planner (example)

Maria hosts one condo in Tagaytay. Monday, November 9, 2026, 8:10 AM:

> **Today** · 2 nights are still open this weekend (Fri 13, Sat 14). The Nov 28 to 30 long weekend is fully open.
>
> 1. **9:00 AM · Facebook + Instagram story · Ready** "Open this weekend" calendar story. **Publish**
> 2. **7:00 PM · Reel · Needs photos** "Weekend escape, 2 nights left". Why: guests book you about 6 days ahead. **Create** (opens the Weekday cut recipe with her 5 best photos and the dates filled in)
> 3. **Anytime · Facebook groups · Share it yourself** Same calendar, caption copied. **Share**
>
> **Coming up** · Thu: carousel "Long weekend in Tagaytay" (teaser) · Sun: new 5-star review from Anna as a post.

On Wednesday, Saturday gets booked. Item 2, scheduled for 7 PM, moves to `stale` with "Saturday got booked. Update to 'Last night left: Friday'?" One tap swaps the claim and the copy.

---

## 5. Architecture

### 5.1 Layering

```
marketing-planner (edge, thin)          marketing-planner-cron              marketing-publish-scheduler-cron
  auth → leaf → plan gate → zod            verifyCronSecret                    verifyCronSecret
        ↓                                         ↓                                    ↓
_shared/marketingPlanner.ts (service: load inputs, run engine, persist, AI optional)
   ├─ marketingSignalsData.ts   loads bundle, availability, reviews, pricing, events, inventory, metrics
   ├─ marketingSignals.ts       PURE  inputs → Opportunity[]
   ├─ marketingScheduler.ts     PURE  opportunities + settings + existing items + horizon → ItemDraft[]
   ├─ marketingClaims.ts        PURE  claims vs live availability/rate → ok | stale(reason)
   ├─ marketingPlaybook.ts      DATA  cadence, mix, windows, lead-time defaults, format → template map
   ├─ marketingCopyLibrary.ts   DATA  rules-mode copy with {{placeholders}} per opportunity × language
   ├─ marketingPlanBriefAi.ts   AI    generateStructured(feature 'marketing_plan_brief')
   ├─ marketingPlanGuard.ts     PURE  AI copy grounding check
   ├─ marketingTrackedLinks.ts  PURE  tracked URL + short code
   └─ marketingTimingModel.ts   PURE  learned windows with shrinkage (Phase 5)
```

All pure modules are Deno-tested with fixtures and contain no clock, DB or network access (Smart Pricing engine convention). Any logic the client needs (range math, status labels, handoff payloads) lives in `.ts` libs, not components, because Vitest does not run `.test.tsx` files.

### 5.2 Data model (new migrations; never edit shipped ones)

**`marketing_planner_settings`** (one row per property)

| Column                                     | Type / notes                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `property_id` PK, `organization_id`        | FK, cascade                                                                                 |
| `goals`                                    | `text[]` CHECK subset of `fill_open_nights, weekends, direct_bookings, longer_stays, brand` |
| `cadence_preset`                           | `light` · `steady` · `active` · `custom`; custom counts in `cadence jsonb`                  |
| `channels`                                 | `jsonb` array: `{ kind: 'facebook_page'                                                     | 'instagram', connectionId }`or`{ kind: 'facebook_group' | 'tiktok' | 'messenger' | 'viber' | 'whatsapp' | 'google_business' | 'other', label, url? }`(max 20, URLs validated with`safeOutboundUrl`) |
| `language`, `tone`                         | `en` · `fil` · `taglish`; tone `warm` · `playful` · `premium`                               |
| `posting_windows`                          | `jsonb` override, null = playbook defaults                                                  |
| `approval_mode`                            | `ask` (default) · `auto_publish_connected` (Phase 6, Business)                              |
| `auto_plan`, `plan_weekday`, `plan_time`   | weekly plan generation (default Monday 08:00 Manila)                                        |
| `reminders`                                | `jsonb` `{ inApp: true, push: true, telegram: false, emailDigest: false, leadMinutes: 30 }` |
| `onboarded_at`, `updated_at`, `updated_by` |                                                                                             |

**`marketing_calendar_events`** (platform and property events)

| Column                           | Type / notes                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `scope`                    | `platform` · `property`                                                                                                          |
| `property_id`, `organization_id` | null for platform rows                                                                                                           |
| `kind`                           | `regular_holiday` · `special_non_working` · `long_weekend` · `season` · `payday` · `school_break` · `local_event` · `commercial` |
| `name`, `starts_on`, `ends_on`   | dates (Manila)                                                                                                                   |
| `country`, `region`              | `PH`, optional region for local holidays                                                                                         |
| `weight`, `source`, `metadata`   | `source` e.g. `Proclamation 1006 (2025)`                                                                                         |

Seed 2026 (remaining) and 2027 platform rows in the migration from the official proclamation; long weekends are **derived in code** from holidays + weekends, not hand-entered. Eid dates are added when proclaimed (super-admin edit).

**`marketing_plans`** (one per generation run)

`id, property_id, organization_id, horizon_start, horizon_end, mode ('rules'|'ai'), trigger ('host'|'weekly_cron'|'event'), playbook_version, signals_snapshot jsonb (aggregates only, no guest rows), summary text, ai_model, prompt_id, prompt_version, credits_consumed, created_by, created_at, superseded_at`.

**`marketing_plan_items`**

| Column                                                     | Type / notes                                                                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `short_code`                                         | `short_code` 8 chars, unique, used in `utm_campaign=ks-<code>`                                                                                                                                   |
| `property_id`, `organization_id`, `plan_id`                | `plan_id` null for host-added items                                                                                                                                                              |
| `source`                                                   | `rules` · `ai` · `host` · `event`                                                                                                                                                                |
| `opportunity_type`, `opportunity_key`                      | key is the dedupe key (`weekend_open:2026-11-13`); partial unique index on `(property_id, opportunity_key)` where status is active                                                               |
| `title`, `pillar`, `objective`                             |                                                                                                                                                                                                  |
| `channel_kind`, `connection_id`, `manual_targets`          | one item per channel family; manual targets are labels from settings                                                                                                                             |
| `format`                                                   | `post` · `carousel` · `story` · `reel` · `calendar`                                                                                                                                              |
| `scheduled_for`, `post_by`                                 | `timestamptz`                                                                                                                                                                                    |
| `target_from`, `target_to`                                 | promoted stay window (`date`)                                                                                                                                                                    |
| `claims`, `brief`                                          | `jsonb` (§4.5, brief = hook, message, cta, captions per channel, hashtags, photo ids, template ref, why)                                                                                         |
| `status`, `status_reason`                                  | `suggested` · `planned` · `preparing` · `ready` · `scheduled` · `publishing` · `published` · `posted_manually` · `held` · `stale` · `skipped` · `expired` · `failed` (TEXT + CHECK, house style) |
| `asset_kind`, `asset_id`, `asset_version_id`               | `template` (`marketing_templates.id`), `ai_session` (+ version), `media` (`marketing_media_assets.id`)                                                                                           |
| `publication_ids`                                          | `uuid[]` into `marketing_publications`                                                                                                                                                           |
| `tracked_url`, `posted_url`, `posted_at`, `skipped_reason` |                                                                                                                                                                                                  |
| `results`                                                  | `jsonb` latest rollup (views, reach, interactions, tracked visits, booking requests)                                                                                                             |
| `created_by`, `created_at`, `updated_at`, `deleted_at`     | soft delete, 30-day purge like templates                                                                                                                                                         |

Indexes: `(property_id, scheduled_for)`, `(status, scheduled_for)` for the crons, `(short_code)`.

**`marketing_post_metrics`** (insight snapshots)

`id, publication_id, plan_item_id, property_id, captured_at, age_bucket ('24h'|'72h'|'7d'|'28d'), views, reach, likes, comments, shares, saves, interactions, raw jsonb, metric_version`.

**Changes to existing tables**

| Table                    | Change                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketing_publications` | `plan_item_id`, `permalink`, `media_items jsonb` (carousel), `request_payload jsonb` (retry), `attempt_count`, `next_attempt_at`, `last_error_code`; status CHECK adds `scheduled`, `publishing`, `held`, `cancelled`; publish_type CHECK adds `carousel`. Coordinate with [`marketing-meta-publishing-gaps.md`](./marketing-meta-publishing-gaps.md) so one migration covers both. |
| `guest_submissions`      | `attribution jsonb` (first-touch `utm_source/medium/campaign`, `landing_at`, `plan_item_code`), set by `submit-form` from a client-captured value; no PII                                                                                                                                                                                                                           |
| `property_page_views`    | Index `(property_id, utm_campaign, viewed_at)` for item results                                                                                                                                                                                                                                                                                                                     |
| `pricing_plans.features` | New keys `marketingPlanner`, `aiMarketingPlanner` (§5.7)                                                                                                                                                                                                                                                                                                                            |

RLS stays enabled with service-role grants only; access is enforced in edge functions (house rule).

### 5.3 Edge functions

| Function                           | New / changed | Purpose                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketing-planner`                | new           | `GET ?range=today                                                                                                                                                                                                                                                                | 3d  | 5d  | 7d  | 14d`items + summary + opportunities;`GET ?view=settings`; `POST {action}`: `generate` (`mode: rules | ai`), `add_item`, `update_item`(reschedule, format, brief edit),`skip`, `mark_posted`, `attach_asset`, `refresh_brief`, `prepare_batch`; `PATCH`settings.`serveAuthenticated`+`resolveScopedPropertyAccess`. |
| `marketing-planner-cron`           | new           | Every 15 min: weekly auto-plans due, debounced refresh queue (claims → `stale`), `expired` sweep, due reminders, urgent event opportunities. `verifyCronSecret`, Sentry cron monitor.                                                                                            |
| `marketing-publish-scheduler-cron` | new           | Every minute: claim `scheduled` publications due (`FOR UPDATE SKIP LOCKED`), re-validate claims, check connection health and `content_publishing_limit`, publish via `marketingPublishAction.ts`, retry with backoff (3 attempts), notify on failure. Shared with the gaps plan. |
| `marketing-insights-cron`          | new           | Every 6 h: for publications at 24 h / 72 h / 7 d / 28 d, fetch IG media insights and FB post metrics, write `marketing_post_metrics`, roll up into `marketing_plan_items.results`.                                                                                               |
| `marketing-calendar-events`        | new           | Super-admin CRUD for platform rows (step-up not needed, audit logged); host CRUD for property `local_event` rows (`marketing.plan:edit`).                                                                                                                                        |
| `publish-to-meta`                  | changed       | `scheduledAt` → scheduled row instead of Meta-native schedule; carousel; `planItemId`; permalink fetch; retry action (gaps plan).                                                                                                                                                |
| `submit-form`                      | changed       | Accept and sanitize `attribution` (allow-listed keys, length caps).                                                                                                                                                                                                              |
| `cancel-booking` / workflow        | changed       | After `CANCELLED`, enqueue a planner refresh + `freed_dates` opportunity through the orchestrator's existing post-transition hook (same place as the Telegram cancellation message). No inline side effects in handlers.                                                         |
| Booking create / block date paths  | changed       | Enqueue a debounced planner refresh (claims check) for that property.                                                                                                                                                                                                            |

All email-free, so no `static_files` entries needed. JWT policy in `config.toml` follows `supabase-edge-functions.mdc`.

### 5.4 Scheduled jobs (hosted `pg_cron` + `pg_net`)

| Job                              | Schedule       | Notes                                                         |
| -------------------------------- | -------------- | ------------------------------------------------------------- |
| `marketing-planner-quarter-hour` | `*/15 * * * *` | Batches properties; at most N AI plans per run to smooth cost |
| `marketing-publish-scheduler`    | `* * * * *`    | Short, idempotent, skips when nothing is due                  |
| `marketing-insights-6h`          | `17 */6 * * *` | Rate-limited per connection                                   |
| `marketing-plan-items-purge`     | daily          | Soft-deleted rows older than 30 days                          |

Document in `docs/archive/operations/scheduled-jobs-and-testing.md` and register Sentry cron monitors (`sentryCron.ts`).

### 5.5 AI feature

- **Router key:** `marketing_plan_brief` in `_shared/aiModelRouter.ts` (text tier, structured output, Groq fallback allowed). Price and credit cost set in Phase 0 from measured tokens; client mirror + parity test like `marketingGenerationPricing`.
- **Prompt:** `_shared/ai/prompts/marketingPlanBrief.ts` with `definePrompt({ id: 'marketing_plan_brief', version: '2026-11-xx.1' })`.
- **Input** (aggregates only): property facts, claims per item, opportunity evidence, pillar targets, language and tone, allowed template ids (enum), top review quotes wrapped with `wrapUntrusted` + `UNTRUSTED_DATA_RULE`.
- **Output schema** (zod + `responseSchema`): `summary` (max 240 chars), and per item `{ itemKey, title, hook, message, cta, captions: { facebook, instagram, manual }, hashtags[], photoIds[], templateRef (enum), why }`. The model may drop or merge items but **cannot add dates, times or channels**; the scheduler owns those.
- **Guard:** `marketingPlanGuard.ts` (deterministic) checks every number, peso amount, date and amenity in the copy against claims and facts; violations drop that item to template copy.
- **Fail-open:** quota exhausted, AI disabled, provider down or guard failure → rules copy from `marketingCopyLibrary.ts`. The plan is never blocked by AI.
- **Billing:** host-triggered generation bills the org (`actorType: 'staff'`); weekly cron runs bill as `system`, respect `aiLimitResolver` limits and AI on/off toggles, and are skipped when the org is over its allowance.
- **Rate limit:** 6 AI generations per property per day (`rateLimitGate`), `refresh_brief` 30 per hour.
- **Evals:** new suite `marketing_plan` in `tests/evals/` (offline: schema, guard red-team, enum validity; live: fact fidelity, no invented prices or dates, language adherence, length caps). Gate 90%.

### 5.6 Client modules

```
ui/src/features/dashboard/marketing/
├── components/planner/
│   ├── PlannerHome.tsx              (tab body: summary, chips, agenda, coming up)
│   ├── PlannerSummaryCard.tsx       PlannerWhySheet.tsx
│   ├── PlannerRangeChips.tsx        OpportunityChips.tsx
│   ├── PlanAgenda.tsx               PlanWeekGrid.tsx (desktop, drag to reschedule)
│   ├── PlanItemCard.tsx             PlanItemSheet.tsx (brief, truth panel, asset, publish, results)
│   ├── PlannerSetupWizard.tsx       (3 steps, ResponsiveModal / bottom sheet)
│   ├── ShareItYourselfSheet.tsx     PrepareWeekDialog.tsx
│   └── PlannerTodayCard.tsx         (property Dashboard widget)
├── hooks/
│   ├── useMarketingPlan.ts          useMarketingPlannerSettings.ts
│   ├── usePlanItemActions.ts        usePrepareWeek.ts
└── lib/planner/
    ├── plannerRange.ts              planItemStatus.ts (labels, next action)
    ├── plannerHandoff.ts            (item → editor URL + prefill payload per template family)
    ├── plannerShare.ts              (canShare files, clipboard, download fallback)
    ├── plannerCopy.ts               plannerTrackedLink.ts
    └── *.test.ts
```

- Handoffs reuse existing entry points: `?tab=design&item=new&from=preset:<id>` with a binding payload (dates, copy, photos) like `marketingReviewHandoff.ts`; calendar via `?tab=calendar&item=new`; AI Studio via `?tab=generate&item=new&output=post` with description + angle (like `aiStudioHandoff.ts`). The created asset is attached back with `attach_asset` on first save.
- **Bundle rule:** the Plan tab must not statically import Polotno, Konva or Remotion. Previews use stored thumbnails; editors stay lazy. A static import renames the `config-*` chunk and fails the PWA precache budget.
- Route state: `?tab=plan&range=today|3d|5d|7d&item=<uuid>`; last range per property in `localStorage` (try/catch).

### 5.7 Plans, permissions, feature availability

**Plan keys** (recommended mapping, §10 D1). Permission = visibility, plan = actionability (D16), so lower tiers see the real feature and hit the gate on the paid action.

| Capability                                                              | Free / Starter                                | Pro (`growth`) | Business (`pro`) and up |
| ----------------------------------------------------------------------- | --------------------------------------------- | -------------- | ----------------------- |
| Plan tab, opportunity chips, today's top 3 suggestions (rules)          | ✅ read-only, Create opens the existing gates | ✅             | ✅                      |
| Full rules plan, all ranges, reminders, Share it yourself, manual items | upgrade modal (`marketingPlanner`)            | ✅             | ✅                      |
| Tracked links and tracked-visit results                                 | upgrade modal                                 | ✅             | ✅                      |
| AI strategist briefs, AI summary, Prepare my week with AI copy          | upgrade modal (`aiMarketingPlanner`)          | upgrade modal  | ✅ (uses AI credits)    |
| Schedule / publish / auto-publish to Meta                               | existing `marketingPublishLimitPerGroup` gate | existing gate  | ✅                      |
| Meta insights results on items                                          | n/a (needs publishing)                        | n/a            | ✅                      |

- `marketingPlanner` (boolean, `growth`+, matches `marketingStudio`); `aiMarketingPlanner` (boolean, `pro`+, matches `aiMarketingGeneration`). Seed migration + `_shared/planFeatures.ts` + UI mirror + `planPresentation.ts` rows and tier-card gains + `featureGateCopy.ts`.
- **Permission leaves:** read uses `marketing:view`. New `marketing.plan:edit` (settings, add, reschedule, skip, mark posted, attach). AI generation reuses `marketing.generate:add` (text AI). Publishing stays `marketing.publish:add`. Seed: Full Access all, Operations gets `marketing.plan:edit`, Read Only none; backfill migration like `20261318140000`. Server allowlist `_shared/propertyTeamPermissions.ts`, UI catalog `propertyTeamConstants.ts`.
- **Feature availability keys:** `marketing.planner` (tab), `marketing.planner.ai` (AI generation), `marketing.planner.autopublish` (Phase 6). Reads stay allowed when a key is paused.
- **Downgrade:** existing items, assets and results stay readable; only new generation, scheduling and AI stop. Scheduled publications on a downgraded org are **held** with a clear reason, never silently dropped.

### 5.8 Notifications and activity log

**Notification types** (new migration extending the type CHECK + `notification_preferences` defaults):

| Type                           | When                                                      | Default channels             |
| ------------------------------ | --------------------------------------------------------- | ---------------------------- |
| `marketing_plan_ready`         | Weekly plan generated                                     | in-app, push                 |
| `marketing_item_due`           | `leadMinutes` before a manual or unscheduled item         | in-app, push, Telegram (opt) |
| `marketing_opportunity_urgent` | `freed_dates`, `tonight_tomorrow` when nothing is planned | in-app, push                 |
| `marketing_publish_held`       | Claim check held a scheduled publish                      | in-app, push                 |
| `marketing_publish_failed`     | Final retry failed or the connection expired              | in-app, push, email          |

Telegram reuses the property Telegram marketing credentials; copy follows `human-copy`.

**Activity log** (`_shared/activityLog.ts`):

| Event                                 | Notes                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `marketing.plan_generated`            | mode, range, item count, credits; `cron` actor for weekly runs                      |
| `marketing.plan_item_scheduled`       | channel, time                                                                       |
| `marketing.plan_item_skipped`         | reason                                                                              |
| `marketing.plan_item_posted_manually` | targets                                                                             |
| `marketing.scheduled_publish_held`    | claim that failed                                                                   |
| `marketing.published_to_meta`         | existing; add `planItemId` and `scheduled: true` metadata                           |
| `marketing.planner_settings_saved`    |                                                                                     |
| `marketing.calendar_event_saved`      | host local events and super-admin platform rows                                     |
| N/A                                   | reschedule drags, brief text edits, insight snapshots (high-frequency editor state) |

### 5.9 Meta app review and connection

- Add **`instagram_manage_insights`** and **`read_insights`** to `META_PUBLISHING_SCOPES` (behind `META_OAUTH_EXTRA_SCOPES` until App Review approves). Update `docs/archive/operations/meta-app-review.md` (use case table, screencast script for "show post results to the Page owner").
- Existing connections lack the scopes: the item Results area shows **Reconnect to see results** linking to Inbox → Channels. Publishing keeps working without them.
- Reels for Facebook Pages need `pages_manage_posts` (already requested) plus the video upload flow; verify in the Phase 0 spike.
- Before each scheduled publish: token validity check; an expired token holds the item and sends `marketing_publish_failed` with a reconnect link.

### 5.10 Privacy

- Signals snapshots and AI inputs carry **aggregates only**: no guest names, emails or phone numbers. Review quotes are the guest's published text, used only when `socialSeedAllowed` (Kame + approved Facebook; Airbnb stays excluded per its terms).
- `guest_submissions.attribution` holds UTM values and a plan item code, no identifiers. `property_page_views` already avoids PII.
- Add a row to the privacy table in `docs/architecture/ai-platform.md` §7.

---

## 6. Phased tasks

Sizes: S (≤2 days), M (3 to 5 days), L (1 to 2 weeks). Each phase ships on its own and leaves the app consistent.

### Phase 0: Decisions, spikes and foundations (M)

- [x] **P0.1** Confirm §10 decisions D1 to D7 with the owner; record answers at the top of this file.
- [ ] **P0.2** Meta spike on the dev app: FB Reels upload session, FB photo/video stories endpoints and scheduling, IG carousel with `location_id`, `content_publishing_limit`, insights metric names on Graph v25+ for IG media and FB posts. Write findings into §3.5.
- [ ] **P0.3** Measure token use of a draft `marketing_plan_brief` prompt on 5 fixture properties; set credit price; add router entry and client price mirror with parity test.
- [x] **P0.4** Migrations: `marketing_planner_settings`, `marketing_calendar_events` (+ 2026/2027 PH seed from Proclamation 1006 and its 2027 successor when published), `marketing_plans`, `marketing_plan_items`, `marketing_post_metrics`, plan keys, permission leaf + backfill, notification types, feature availability keys. Apply locally with `bun run db:migrate`.
- [x] **P0.5** `_shared/marketingPlaybook.ts` and `marketingCopyLibrary.ts` (English, Filipino, Taglish rules copy per opportunity type, reviewed with `human-copy`).
- [x] **P0.6** Architecture doc `docs/architecture/marketing-planner.md` (layering, data model, truth rules, playbook versioning).
- [ ] **P0.7** PostHog event catalog entries (`posthogCatalog.ts`): `planner_viewed`, `planner_onboarded`, `plan_generated`, `planner_item_created_asset`, `planner_item_completed`, `planner_item_skipped`, `planner_share_used`, `upgrade_modal_opened{source:planner}`.

**Status (2026-11-09):** P0.1, P0.4, P0.5 and P0.6 shipped. P0.2 (Meta spike), P0.3 (AI token measurement) and P0.7 (PostHog catalog entries) are open; nothing in Phase 1 depends on them.

**Exit:** migrations apply cleanly on a fresh `db:reset`; decisions recorded; spike notes in §3.5.
**Acceptance:** `bun run db:migrate` applies, `bun run check:plan-catalog` passes, `bun run test` passes for the new playbook/copy fixtures.

### Phase 1: Signals engine, rules planner and the Plan tab (L)

Engine (Deno, pure, tested):

- [ ] **P1.1** `marketingSignalsData.ts`: one loader that reuses `computeAnalyticsBundle` (cached per property per Manila day), night-level availability with min stay and cleaning buffer, upcoming events, review candidates, live rates, asset inventory and last-posted dates.
- [x] **P1.2** `marketingSignals.ts`: every opportunity in §4.3 except `freed_dates` (Phase 3) and learned weights (Phase 5). Fixture suite: empty calendar, fully booked, scattered gaps, thin history (`sufficiency.enough = false`), long weekend in range, Manila midnight boundaries, DST-free but UTC-offset edge cases.
- [x] **P1.3** `marketingScheduler.ts`: cadence caps, pillar mix, per-day max, quiet hours, default windows, post-by rules, dedupe by `opportunity_key`, never schedule in the past, keep host-edited items untouched on regenerate.
- [x] **P1.4** `marketingClaims.ts`: build and validate claims (open nights, nights left, rate, rating, review id).
- [ ] **P1.5** `marketingPlanner.ts` service + `marketing-planner` edge function (GET range, settings, `generate` mode `rules`, `add_item`, `update_item`, `skip`, `mark_posted`). Zod bodies, RBAC, plan gates, feature availability, activity log.
- [ ] **P1.6** Debounced refresh on booking create, cancel and date block (marks `stale` with reason).

UI:

- [ ] **P1.7** Plan tab (`?tab=plan`), first in `MarketingStudioModeTabs`, default for properties without a remembered tab; route skeleton per `skeleton-loaders.md`.
- [ ] **P1.8** `PlannerSetupWizard` (3 steps, data-driven preselects, Connect link to Inbox, manual places list) with `useGuardedClose`.
- [ ] **P1.9** `PlannerHome`: summary card + Why sheet, range chips, opportunity chips, agenda grouped by day, Coming up strip, empty and done states.
- [ ] **P1.10** `PlanItemCard` + `PlanItemSheet` (brief from rules copy, truth panel, reschedule, change format, skip with reason, mark posted). Brief edits use `useUnsavedChangesGuard`.
- [x] **P1.11** Lower-tier showcase: Free / Starter see the summary and top 3 suggestions; other actions open the upgrade modal with planner-specific copy.
- [ ] **P1.12** Mobile: bottom sheets, sticky main action, 44px targets, swipe actions on cards; verify at 375 / 768 / 1024+ (`mobile-responsive`).

**Status (2026-11-09):** the engine, a first endpoint, the Plan tab and the tier showcase shipped. Known gaps, deliberately left open rather than half-claimed:

- P1.1: no per-day memo cache, min stay is fixed at 1 and the cleaning buffer is not applied to opportunity nights yet.
- P1.5: `add_item` (host-authored items) is not implemented, and the `marketing.planner*` feature-availability keys are deferred (X9).
- P1.6: no debounced refresh on booking create, cancel or date block, so claims are re-checked on read rather than moved to `stale` automatically.
- P1.8: no setup wizard. New properties get defaults and can build a plan.
- P1.9: no Coming up strip and no Why sheet.
- P1.10: no item sheet, no reschedule or format-change UI. The card can copy the caption, skip and mark posted.
- P1.12: not verified in a browser at 375 / 768 / 1024.
- P1.2/P1.3/P1.4: `content_refresh` cannot fire yet (X8), and `freed_dates` is Phase 3 by design.

**Exit:** a Pro property gets a correct rules plan for Today / 3 / 5 / 7 days with zero AI calls; claims go stale when a booking lands; gates behave per §5.7.
**Acceptance:** `bun run test:edge` covers signals/scheduler/claims fixtures; `bun run test:edge:handlers` covers `marketing-planner`; `bun run test:e2e:smoke` loads `?tab=plan` at 375 and 1024.

### Phase 2: Prepare (one tap to a finished draft) (M)

> Not started.

- [ ] **P2.1** `plannerHandoff.ts`: map each `opportunity_type` × `format` to a preset or recipe and a binding payload (dates, nights left, rate, review id, photo ids, copy). Reuse the review and AI Studio handoff patterns.
- [ ] **P2.2** Editors accept the planner payload and call `attach_asset` on first save (design, video, calendar, AI session). The item moves to `ready`.
- [ ] **P2.3** Photo picking: rank listing photos by use count and recency so suggestions vary between items.
- [ ] **P2.4** `PrepareWeekDialog`: batch-create template drafts for all items in range (free), list AI Studio items with total credits, run on confirm, show progress per item.
- [ ] **P2.5** Item preview uses stored thumbnails only (no editor engines in the Plan bundle). Check the PWA precache budget in the build.

**Exit:** every catalog opportunity opens a filled, editable draft; batch prepare works for a 7-day plan.

### Phase 3: Publish, schedule and share (L)

> Not started.

Depends on [`marketing-meta-publishing-gaps.md`](./marketing-meta-publishing-gaps.md); implement that plan's scope 1 to 4 here if it has not shipped.

- [ ] **P3.1** Publications migration (§5.2 changes) and `marketing-publish-scheduler-cron` with `SKIP LOCKED` claiming, idempotency key per item + channel, backoff, connection health, publishing-limit check.
- [ ] **P3.2** Pre-publish claim check → `held` + `marketing_publish_held` notification + one-tap **Update the post**.
- [ ] **P3.3** `PublishDialog`: schedule picker (pre-filled with the planned slot), Instagram Reels, **carousel** (2 to 10 assets; multi-size groups and AI versions as sources), permalink on success, retry in Publish History.
- [ ] **P3.4** Decide and implement or clearly message Facebook Reels / video and Facebook stories per the P0.2 spike.
- [ ] **P3.5** `ShareItYourselfSheet` + `plannerShare.ts`: Web Share with files where `canShare` allows, caption to clipboard, download fallback, per-target checklist, **I posted it** with optional link.
- [ ] **P3.6** `marketing-planner-cron`: reminders (`marketing_item_due`), expiry sweep, weekly rules plan for opted-in properties, `freed_dates` and `tonight_tomorrow` urgent opportunities.
- [ ] **P3.7** Property Dashboard `PlannerTodayCard` and a due-count badge on the Marketing nav item.

**Exit:** a scheduled item publishes at its time on FB and IG, a booking that breaks its claim holds it, manual channels complete with Share, reminders arrive on the chosen channels.

### Phase 4: AI strategist (M/L)

> Not started.

- [ ] **P4.1** `marketing_plan_brief` prompt module, schema, `marketingPlanBriefAi.ts`, `marketingPlanGuard.ts`.
- [ ] **P4.2** `generate` mode `ai`: rules skeleton → AI briefs → guard → persist; fail-open to rules copy; credits shown before running; rate limits.
- [ ] **P4.3** `refresh_brief` for one item ("make it shorter", "more playful", "Taglish") with the same guard.
- [ ] **P4.4** AI summary card copy and "Why" explanation in plain words (aggregates only).
- [ ] **P4.5** Prepare my week uses AI captions and hooks for template items when entitled.
- [ ] **P4.6** Eval suite `marketing_plan` (offline in CI, live manual) with fixtures for underbooked, fully booked, long weekend, thin history, Taglish.

**Exit:** Business properties get AI briefs that pass the guard at 90%+ on the live suite; AI outages never break a plan.

### Phase 5: Measure and learn (L)

> Not started.

- [ ] **P5.1** `marketingTrackedLinks.ts`: every item gets `?utm_source=<channel>&utm_medium=social&utm_campaign=ks-<code>` on the property page or booking link; captions include it where links work (Facebook, manual), Instagram uses "link in bio" copy.
- [ ] **P5.2** Public pages keep first-touch UTM in `sessionStorage`; the booking form sends it as `attribution`; `submit-form` stores it.
- [ ] **P5.3** Request insight scopes (§5.9) and file App Review; reconnect prompt in Results.
- [ ] **P5.4** `marketing-insights-cron` + metric mapper isolated in `_shared/marketingInsights.ts` (one place to update when Meta renames metrics).
- [ ] **P5.5** Results on cards and sheet; weekly recap (`marketing_plan_ready` body) with last week's posts, visits and booking requests.
- [ ] **P5.6** `marketingTimingModel.ts` and learned format / angle weights (§4.6), surfaced only past the data threshold.
- [ ] **P5.7** Analytics module: a "Marketing" section with tracked visits and attributed requests by item and channel.

**Exit:** a published item shows Meta metrics and tracked visits; an attributed booking request links back to its item; learned windows replace defaults after 12 posts.

### Phase 6: Autopilot, portfolio and reach (M)

> Not started.

- [ ] **P6.1** Weekly AI auto-plan for opted-in Business properties (cron, cost-batched).
- [ ] **P6.2** Auto-prepare drafts on plan creation (template items only by default; AI Studio items need a per-week credit cap set by the host).
- [ ] **P6.3** `approval_mode = auto_publish_connected`: items in `ready` publish at their slot after claim check; a daily digest lists what went out. Off by default; feature availability key `marketing.planner.autopublish`.
- [ ] **P6.4** Dashboard assistant tools: `get_marketing_plan`, `add_marketing_plan_item`, `mark_marketing_item_posted`, `generate_marketing_plan` (Tier per risk classifier; writes need confirmation).
- [ ] **P6.5** Org portfolio view: which listings need promotion most this week (rank by open nights × ADR), one tap into each property's plan.
- [ ] **P6.6** TikTok: evaluate Content Posting API **upload to inbox (draft)** for reels; keep Share it yourself as the default until the audit question is settled.
- [ ] **P6.7** Analytics AI review deep link: improvements like "Promote open weeknights" link to `?tab=plan`; host playbook articles for marketing tactics.

---

## 6.1 Verification results (2026-11-09)

| Gate                            | Result                                                        |
| ------------------------------- | ------------------------------------------------------------- |
| `bun run db:migrate`            | applied `20261324000000_marketing_planner` on the local stack |
| `bun run check:plan-catalog`    | pass (6 plans vs golden matrix)                               |
| `bun run test` (Vitest)         | 5861 passed, 6 skipped                                        |
| `bun run test:edge` (Deno)      | 1471 passed                                                   |
| `bun run type-check`            | pass                                                          |
| `bun run lint`                  | 0 errors (warnings only, all pre-existing)                    |
| `bun run check:filenames`       | pass                                                          |
| `bun run build`                 | pass, precache budget OK                                      |
| `bun run check:support-content` | pass (148 FAQs)                                               |

Not run: `test:e2e:smoke` (no planner journey spec yet), `check:plan-catalog` against a fresh
`db:reset` (applied incrementally on the running local stack).

## 7. Testing

| Layer                 | What                                                                                                                                       | Command                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Deno unit (pure)      | signals, scheduler, claims, guard, playbook invariants, tracked links, timing model, insights mapper, long-weekend derivation              | `bun run test:edge`                         |
| Deno handlers         | `marketing-planner` actions, gates, RBAC, crons (claim, hold, retry, reminders), `submit-form` attribution sanitizing                      | `bun run test:edge:handlers`                |
| AI evals              | `marketing_plan` offline (CI) and live (manual / nightly)                                                                                  | `bun run eval:ai -- --suite marketing_plan` |
| Vitest (Node)         | `plannerRange`, `planItemStatus`, `plannerHandoff` payloads, `plannerShare` fallbacks, price mirror parity                                 | `bun run test`                              |
| Playwright mocked E2E | `ui/e2e/features/marketing/planner.spec.ts`: setup wizard, range chips, item lifecycle, stale item, Share fallback, tier gates, team leaf  | `bun run test:e2e:smoke`                    |
| Plan / team matrix    | Extend plan-tier and property-team RBAC suites with the new keys and leaf                                                                  | existing suites                             |
| Manual (dev Meta app) | Schedule FB + IG post for +5 min, book the promoted night, confirm hold; carousel; reel; insights after 24 h; Share on iOS and Android PWA | `docs/guides/testing/` new manual page      |

Gate before claiming any phase done: `bun run ci:quality` (lint, type-check, unit, edge, smoke E2E, build), `check:filenames`, `check:ai-gateway`, `check:support-content`, `check:ai-knowledge-coverage`.

---

## 8. Docs to update (same change as each phase)

| Doc                                                                        | Change                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docs/guides/routes/org/property/marketing.md`                             | New **Plan** section (URL state, item lifecycle, save paths, gates) + at least 8 Host-facing Q&A |
| `docs/guides/routes/org/property/dashboard.md`                             | Marketing today card                                                                             |
| `docs/guides/routes/org/property/notifications.md`                         | New notification types and Telegram reminder option                                              |
| `docs/guides/routes/org/property/analytics.md`                             | Marketing results section (Phase 5)                                                              |
| `docs/architecture/marketing-planner.md` (new)                             | Architecture of record                                                                           |
| `docs/architecture/overview.md`, `docs/PROJECT.md`                         | Module, edge functions, crons, tables                                                            |
| `docs/architecture/plans-feature-matrix.md`                                | `marketingPlanner`, `aiMarketingPlanner`, leaf mapping                                           |
| `docs/architecture/feature-availability.md`                                | `marketing.planner*` keys                                                                        |
| `docs/architecture/ai-platform.md`                                         | Feature row, privacy row, eval suite                                                             |
| `docs/architecture/data-model.md`, `edge-functions.md`                     | Tables and functions                                                                             |
| `docs/archive/operations/scheduled-jobs-and-testing.md`                    | Four new jobs                                                                                    |
| `docs/archive/operations/meta-app-review.md`                               | Insight scopes, screencast script                                                                |
| `docs/archive/operations/migration-runbook.md`                             | Seed and backfill notes                                                                          |
| `docs/guides/support/faqs.md` + Host-facing knowledge sync                 | Planner FAQs (what to post, Share yourself, why an item was held)                                |
| `/for-hosts/pricing` via `planPresentation.ts`, `org/plans.md`             | Tier bullets and compare rows                                                                    |
| [`marketing-meta-publishing-gaps.md`](./marketing-meta-publishing-gaps.md) | Mark items shipped by Phase 3                                                                    |
| [`ai-opportunities-roadmap.md`](./ai-opportunities-roadmap.md) #12         | Link to this plan                                                                                |

---

## 9. Risks and mitigations

| Risk                                                     | Mitigation                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A post claims dates or prices that are no longer true    | Claims object on every item, refresh on calendar change, pre-publish check with hold, guard on AI copy, live-rate-only rule               |
| AI invents facts or writes awkward Taglish               | Deterministic guard, enum-only template choice, eval suite with Taglish fixtures, rules copy fallback, host edits before publish          |
| Host overwhelm (too many tasks)                          | Today-first view, Light preset default, per-day cap, merge similar items, Skip with no penalty                                            |
| Over-posting hurts reach or looks spammy                 | Cadence caps, angle freshness penalty, no duplicate opportunity keys, stories capped per day                                              |
| Meta App Review delay for insight scopes                 | Results start with tracked visits (no scopes needed); insights land when approved; publishing unaffected                                  |
| Meta metric and endpoint churn                           | One mapper module, `metric_version` on snapshots, Graph version pinned in `metaInboxConfig.ts`, Phase 0 spike                             |
| Scheduled publish fails silently (expired token, limits) | Health check before publish, retries with backoff, `held` / `failed` states, push + email notification, Publish History retry             |
| AI cost from weekly cron across many properties          | Rules-first; AI only for text; batching; skip when over allowance; per-day rate limit; response cache on identical inputs                 |
| Timezone bugs (Manila vs UTC)                            | `timestamptz` storage, Manila date helpers only (`manilaTodayIso`, `calendarAvailabilityManila`), fixture tests at 23:30 and 00:30 Manila |
| Bundle bloat breaks the PWA precache budget              | No editor engines in the Plan tab; thumbnails only; build check in Phase 2                                                                |
| Multi-property hosts get N separate plans                | Per-property first; org portfolio ranking in Phase 6                                                                                      |
| Holiday seed goes out of date                            | Super-admin edit surface, yearly seed task in the runbook, long weekends derived in code                                                  |
| Attribution undercounts (Instagram links, manual posts)  | Treat as directional; show "at least" wording; combine with Meta insights and host-pasted links                                           |

---

### 9.1 Edge cases

| Case                                                     | Behaviour                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| No calendar data at all (new property, no listing dates) | Plan shows the setup wizard + a "add your first listing dates" item. No invented opportunities.                |
| Fully booked for the whole horizon                       | `fully_booked` social-proof items only, capped at one per week. No availability claims.                        |
| Thin history (`sufficiency.enough = false`)              | Default lead time and posting windows; no "your best time" copy until 12 published posts with insights.        |
| Property paused / archived                               | `marketing-planner` returns 409 with the property lifecycle reason; the tab shows the paused panel.            |
| Plan downgraded while items are scheduled                | Scheduled publications move to `held` with a downgrade reason; existing items stay readable.                   |
| AI quota exhausted mid-batch                             | Remaining items fall back to rules copy; the batch reports "used template copy for N items".                   |
| Two hosts generate at the same time                      | `marketing_plan_items` partial unique index on active `(property_id, opportunity_key)`; the second run merges. |
| Clock crosses Manila midnight during a run               | Range boundaries computed once from `manilaTodayYmd()` at start and passed down; a run never mixes days.       |
| Host edits a brief, then regenerates the plan            | Host-edited items are untouched; only system items regenerate.                                                 |
| Meta token expired when publishing                       | Item held, `marketing_publish_failed` sent with a reconnect link, no retry storm (backoff caps at 3).          |
| Manual share on a browser without `navigator.canShare`   | Download + copy caption fallback; the checklist still completes as `posted_manually`.                          |
| `?range=` invalid in the URL                             | Normalized to `today` without an error toast.                                                                  |

---

## 10. Open decisions (recommendation first)

| #   | Decision                      | Recommendation                                                                                                                            | Alternatives                                                   |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| D1  | Tier mapping                  | **(recommended)** Showcase on Free / Starter, rules planner on Pro (`marketingPlanner`), AI strategist on Business (`aiMarketingPlanner`) | Whole planner on Pro with AI credits; or planner Business-only |
| D2  | Where the planner lives       | **(recommended)** First tab in Marketing (**Plan**) + Dashboard card                                                                      | Separate sidebar item "Marketing plan"                         |
| D3  | Facebook scheduling           | **(recommended)** Our scheduler for all platforms (claim re-check at publish)                                                             | Facebook native `scheduled_publish_time` for FB, ours for IG   |
| D4  | TikTok in the first release   | **(recommended)** Share it yourself only; evaluate draft upload in Phase 6                                                                | Build the Content Posting API draft flow in Phase 3            |
| D5  | Booking attribution           | **(recommended)** First-touch UTM in session storage → `guest_submissions.attribution` (no PII)                                           | Page-view-only results                                         |
| D6  | Languages                     | **(recommended)** English, Filipino, Taglish from day one (rules copy + AI)                                                               | English only first                                             |
| D7  | Auto-publish without approval | **(recommended)** Not before Phase 6, opt-in, Business only, claim check always on                                                        | Never; or available from Phase 3                               |

### 10.1 Decisions made while executing

| #   | Decision            | Choice                                                                                                     | Why                                                                                           |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| X1  | D1 to D7            | Taken as recommended (they are the plan's own defaults and the owner asked for execution, not a re-debate) | Unblocks Phase 0 without a round trip; any change is a one-line edit in this table.           |
| X2  | Session scope       | Ship Phase 0 + Phase 1 on this branch; Phases 2 to 6 stay open                                             | Phase 1 is the plan's first shippable milestone ("a Pro property gets a correct rules plan"). |
| X3  | Plan tab tab-id     | Add `plan` as the first member of `MARKETING_STUDIO_TABS`, before `generate`                               | Matches D2; keeps tab ids stable for links.                                                   |
| X4  | Default tab         | `resolveDefaultMarketingStudioTab` returns `plan` when the host has Marketing access and no remembered tab | Matches D2; remembered tab still wins.                                                        |
| X5  | Booking pace signal | Derive the year-over-year comparison from `buildNewBookingsPoints`, not a new module                       | Reuses the tested series instead of duplicating it.                                           |

---

## 11. Out of scope

- Paid ads and boosting (Meta Marketing API); the Managed plan's social boosts stay a service, not a feature.
- Automated posting to Facebook Groups (API removed in 2024), Messenger or chat-app broadcasts.
- Google Business Profile API posting (manual channel only; revisit after Phase 5 with access approval).
- Comment and DM automation on posts (Guest Inbox owns that).
- Influencer and collaborator workflows beyond the IG `collaborators` field.
- Competitor or market scraping (Smart Pricing's first-party-only rule applies here too).
- Email marketing campaigns to past guests (separate plan; the planner may later add an `email` channel kind).

---

## 12. Sources

- Sprout Social, best times to post: [sproutsocial.com/best-times-to-post](https://sproutsocial.com/best-times-to-post), [Instagram 2026](https://sproutsocial.com/insights/best-times-to-post-on-instagram/)
- Buffer, Instagram algorithm guide 2026: [buffer.com/library/instagram-algorithm](https://www.buffer.com/library/instagram-algorithm)
- CreatorFlow, Instagram algorithm 2026 (Mosseri quotes): [creatorflow.so/blog/instagram-algorithm-2026](https://creatorflow.so/blog/instagram-algorithm-2026)
- Reels hooks and 3-second window: [inro.social](https://www.inro.social/blog/instagram-reels-3-second-hook-leads), [opus.pro](https://www.opus.pro/blog/instagram-reels-hook-formulas)
- Vacation rental social strategy: [Boostly](https://boostly.co.uk/vacation-rental-social-media-strategy/), [Uplisting](https://www.uplisting.io/blog/social-media-marketing-for-vacation-rentals), [Guesty last-minute bookings](https://www.guesty.com/blog/how-attract-last-minute-bookings-for-vacation-rentals/), [Houfy last-minute](https://www.houfy.com/blog/how-to-attract-last-minute-vacation-rental-bookings), [Touch Stay](https://touchstay.com/blog/short-term-rental-conference-how-to-boost-last-minute-bookings)
- Philippines usage (DataReportal via GMA News): [gmanetwork.com](https://www.gmanetwork.com/news/topstories/nation/991811/filipinos-time-tiktok-facebook-report/story/), [gmanetwork.com social identities](https://www.gmanetwork.com/news/topstories/nation/991808/ph-social-media-user-identities-surge-by-9m-hit-95-8m-report/story/)
- Philippine holidays 2026, Proclamation No. 1006: [lawphil.net](https://lawphil.net/executive/proc/proc2025/proc_1006_2025.html), [Inquirer list](https://newsinfo.inquirer.net/2104754/list-2026-regular-holidays-special-non-working-days)
- PH travel behavior: [Manila Bulletin Holy Week 2026](https://mb.com.ph/2026/04/01/holy-week-exodus-filipino-travel-demand-surges-50-despite-rising-costs), [PNA long weekends](https://alpha.pna.gov.ph/articles/1220652), [SunStar 2026 long weekends](https://www.sunstar.com.ph/cebu/planning-more-quietcations-in-2026-the-calendar-is-on-your-side)
- Meta: [IG content publishing](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/content-publishing), [IG publishing limit](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit), [IG user media (carousel, location, collaborators)](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media), [IG media insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/), [Graph v22 changelog](https://developers.facebook.com/docs/graph-api/changelog/version22.0), [Pages API posts (scheduling window)](https://developers.facebook.com/docs/pages-api/posts), [FB Reels publishing](https://developers.facebook.com/docs/video-api/guides/reels-publishing), [Page insights updates 2025](https://developers.facebook.com/blog/post/2025/08/15/page-insights-api-updates/), [Page deprecated metrics](https://developers.facebook.com/documentation/pages-api/platforminsights/page/deprecated-metrics), [June 2026 reach metric changes (Coupler)](https://docs.coupler.io/sources/category/social-media/facebook-page-insights/data-overview/meta-facebook-insights-deprecated-metrics-june-2026)
- Facebook Groups API removal: [Meta developer community](https://developers.facebook.com/community/threads/2076398286093257/), [Agorapulse notice](https://support.agorapulse.com/en/articles/9167708-facebook-groups-update-april-2024)
- TikTok Content Posting API: [Direct Post reference](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [Content sharing guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines), [Get started](https://developers.tiktok.com/docs/en/content-posting-api-get-started)
- Web Share API: [web.dev share files](https://web.dev/patterns/files/share-files), [MDN canShare](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare)
- Competitors: [Hostaway Booking Website Pro](https://www.traveldailynews.com/hospitality/hostaway-launches-booking-website-pro-for-direct-bookings/), [Lodgify 2026 rebrand](https://use.lodgify.com/hubfs/Marketing/Content/Lodgify_Rebrand_2026_Press_Release.pdf), [content planner roundup](https://www.hopperhq.com/blog/the-best-content-planners-for-social-media/)
