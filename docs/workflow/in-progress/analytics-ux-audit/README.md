---
title: 'Analytics modules UX/UI review'
status: active
tags: [ux, ui, analytics, review, qa, e2e]
updated: 2026-11-23
---

# Analytics modules UX/UI review — property and org

Deep review of both analytics surfaces:
`/org/:orgSlug/property/:propertySlug/analytics` (single listing) and `/org/:orgSlug/analytics`
(portfolio). Every visible element, every state, every flow, at phone (375), tablet (768), laptop
(1024 / 1280), desktop (1440) and dark mode.
Reviewed against `develop` (`d5a0054bc`) with the `impeccable` (critique + audit),
`mobile-responsive`, `frontend-design`, `design-md`, `accessibility` and `human-copy` skills.

**This is a review, not a fix.** No product code changed. The E2E coverage added is described in
[Test coverage added](#test-coverage-added).

Method: dual-agent (A: isolated design review · B: isolated detector + evidence pass). Detector
coverage note in [Appendices](#appendix-detector-coverage).

## Verdict

The module is **functional, honest and unusually well-instrumented**: the four tabs map to a real
question sequence, the AI review runs end to end, the Playbook turns advice into a next click, and
every state (empty, sparse, gated, unavailable, read-only) has a designed rendering. It also carries
**two problems a host meets on the first screen** — charts that only answer on hover, and an AI
review that leaks server values — plus a long tail of density, copy and mobile-chrome issues.

The page is preview-open on every plan; Export PDF and AI review generation are the only gated
actions. That is the right call for this module, and it works.

## Status after remediation

Two remediation batches shipped in this branch. The screenshots below are the **pre-fix**
evidence that documents the findings; the recordings were re-captured after the fixes, and
[`after/`](./after) holds the post-fix captures. [`before-after.jpg`](./before-after.jpg) is the ten-pair comparison sheet (property: KPI and
deltas, booking sources, pace chart, AI review, 1024 KPI, phone tabs, PDF; org: KPI money, 1024
rows, phone KPIs).

| Item                              | Status  | Change                                                                                                                                                                 |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-1 chart legends and bar values | Shipped | Donut legend (name, count, share, tail folds into Others); counts on age, party and distribution bars; party axis captioned. `lib/donutSlices.ts`                      |
| P1-2 AI review copy               | Shipped | `lib/aiReviewCopy.ts` normalises state ids, ISO dates, `PHP 12000` and ADR/RevPAR in the card and the PDF; prompt rules added                                          |
| P1-3 1024 KPI                     | Shipped | Whole-peso KPI values plus a reserved second title line at `lg` so values share a baseline                                                                             |
| P1-4 zero delta                   | Shipped | `StatCard` renders `change === 0` as a neutral gray chip with a dash icon (shared with Bookings, Finance, Dashboard)                                                   |
| P2-1 section in the URL           | Shipped | `?section=` with Back/reload/deep-link support; `overview` stays out of the URL. `lib/analyticsSection.ts`                                                             |
| P2-2 phone tab strip              | Shipped | Right-edge fade as the scroll cue, and the active tab scrolls fully into view on select                                                                                |
| P2-4 pace chart                   | Shipped | Bookings render as bars; Revenue keeps the area chart; legend hidden for a single series                                                                               |
| P2-5 origins rounding             | Shipped | Whole-percent shares everywhere (17%, not 16.67%); 0% no longer draws a 2% bar                                                                                         |
| P2-6 / P2-7 PDF                   | Shipped | Two pages, readable period, `PHP` currency code, separate channel and origin tables side by side                                                                       |
| P2-8 tab semantics                | Partial | Section tabs are a complete tab/tabpanel pattern with arrow/Home/End keys. The in-card metric toggle keeps its tablist role (shared `SegmentedControl`, separate pass) |
| P2-9 toggle names                 | Shipped | "Bookings" / "Revenue" are the accessible names, no longer lowercase values                                                                                            |
| P2-3 overview signal              | Open    | Product call on what the first viewport should lead with                                                                                                               |
| P2-10 support button overlap      | Open    | Shell-level; fix once for every page                                                                                                                                   |
| P2-11 touch targets               | Open    | The repo sets 36px tab tracks and forbids `min-h` on triggers; a hit pad is clipped by the strip's overflow. Needs a shared-strip decision                             |
| P3 group                          | Open    | Cosmetic pass                                                                                                                                                          |

## Org portfolio page

Reviewed against the same seed (one property + one parking). Three fixes shipped, two notes left
as product calls.

| Item                    | Status   | Detail                                                                                                                                                                                                                                                                                         |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1 1024 list layout     | Shipped  | The list row is a seven-column flex row from `xl` only. At 1024 it stacked and the header labels overlapped ("OccupancyRevenueBookings"), the revenue cell read `₱4...`, and the KPI read `₱46,200....`. Now the row stacks below `xl`, the table option is `xl+`, and the KPI is whole pesos  |
| O2 row revenue cell     | Shipped  | `₱4,200` + `+500.0%` ellipsized at 1280; the amount is now `whitespace-nowrap` and the change badge `shrink-0`                                                                                                                                                                                 |
| O3 KPI money            | Shipped  | `₱46,200.00` → `₱46,200` (same rule as the property KPI)                                                                                                                                                                                                                                       |
| O4 balance risk         | Decision | The portfolio says **On track** / **Needs attention 0** for a property the organisation API reports as `at_risk` with ₱16,500 unpaid. This is deliberate: attention is booking/demand only (`orgAttentionReasons`, and the guide says so). Flagging balances here is a product call, not a bug |
| O5 large revenue change | Decision | `+500.0%` on a tiny prior base is accurate but noisy. Leave, cap, or label as "new" — product call                                                                                                                                                                                             |
| O6 phone Promote chip   | Open     | The floating support button overlaps the Promote chip at 375. Shell-level, same as the property page                                                                                                                                                                                           |

E2E: `ui/e2e/features/analytics/orgAnalytics.spec.ts` (7 tests at `@ci`) covers KPIs, rows,
search + empty result, CSV download, the free-plan upgrade dialog, read-only export, the empty org
and the 1024 stacking.

## Evidence

| Item        | Value                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| App         | `http://127.0.0.1:4187` (Vite, develop checkout) + local Supabase `:54321`            |
| Account     | seeded owner (`seed-owner@example.com`) on the canonical local org/property           |
| Seed        | canonical local dataset, November 2026 period                                         |
| Viewports   | 375×812, 768×1024, 1024×768, 1280×800, 1440×960, dark mode                            |
| Console     | 0 errors across every captured state                                                  |
| Overflow    | no horizontal page overflow at any viewport (`scrollWidth === clientWidth`)           |
| Screenshots | 25, in [`screenshots/`](./screenshots)                                                |
| Recordings  | 6 walkthroughs, in [`recordings/`](./recordings); each state is held ~1.6 s           |
| API proof   | live `analytics-summary`, `analytics-ai-review` GET + POST, and a 3-page exported PDF |
| Tests       | 15 new `@ci` assertions, all green without a database                                 |

## What works (verified end to end)

| Area           | Verified                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Period control | Week / Month / Year / Custom, previous/next arrows, `?from`/`?to` sync, default current month                  |
| KPI strip      | Four headline cards with period-over-period deltas and glossary hints                                          |
| Section tabs   | Overview / Trends / Guests / AI review, sliding pill, per-section analytics events                             |
| Overview       | Guest age, party size, guest origins, booking-source donut, listing visits, marketing results (three by three) |
| Marketing      | The empty state is a centered message with a primary **Open plan** button, not a floating link                 |
| Trends         | New bookings chart with bookings/revenue toggle and last-year series, lead time, length of stay, reviews bars  |
| Guests         | Channel donut (`Direct` roll-up), age, party size, origins with **Others** collapse                            |
| AI review      | Live generate (POST 200 → score 75 → "Review updated"), once-per-day refresh, current-period-only gate         |
| Playbook       | Matched articles, single-open accordion, a review tip expands and scrolls to the matching article              |
| Export PDF     | 2.6 s client-side report, disabled state while building, "PDF downloaded" toast, 3 pages                       |
| Plan gate      | Free plan: Export opens the upgrade dialog, page still readable                                                |
| Permissions    | `analytics:export` and `analytics.aiReview:add` hide Export / Analyze; view-only roles still read the review   |
| Feature switch | `analytics.ai_review` off replaces the card with the shared availability panel                                 |
| Sparse history | Full layout still renders; dashed empty bodies; AI review explains "Need 10 bookings before AI review."        |
| Mobile         | Bottom-sheet period control, floating toolbar, no overflow, tab strip reachable                                |
| Dark mode      | Tokens applied on every surface; sampled muted text ≥ 6:1 contrast both themes                                 |

## Findings

### P1 — fix before the next analytics feature touches this page

#### P1-1. Charts cannot be read without pointing at them

Evidence: [01](./screenshots/01-desktop-1440-overview.png),
[05](./screenshots/05-desktop-1440-guests.png),
[17](./screenshots/17-mobile-375-trends.png),
[21](./screenshots/21-mobile-375-donut-tooltip.png).

**Where bookings come from** and **Listing visits** are rings with no legend, no labels and no
ranking. Their only readable output is a hover tooltip. A single-source month renders one solid blue
ring at `100%` with no way to tell that the source is Airbnb. On a screenshot, in a printed view, or
in the exported PDF, the ring carries no information at all.

The histograms have the same gap: `YAxis` is `hide`d and no bar carries a value label. In the
seeded month the party-size bars show 2 / 3 / 4 / 5+ with no counts, and the lead-time chart renders
zero buckets as nothing, so "0 bookings" and "no bucket" look identical. The x-axis labels are bare
numbers (`2`, `3`, `4`, `5+`) with no unit.

Impact: the page's two core questions, "which channel brings bookings?" and "how big are my
parties?", cannot be answered from a glance. `role="img"` gives screen readers a full summary, but
sighted hosts get less than assistive tech does.

Fix direction: add a compact legend or a ranked list beside the donut (channel, count, share), put
the count above each bar or on the axis, and label the party/bucket axis (`guests`). Keep the
`aria-label` summary.

#### P1-2. The AI review leaks internal state and mixes formats

Evidence: [07](./screenshots/07-desktop-1440-ai-review.png),
[08](./screenshots/08-desktop-1440-playbook-open.png).

The generated review (live model, not a fixture) contains:

- `putting your balance collection state at 'at_risk'` — a raw server enum, quoted, in host copy.
- `smart pricing changes on 2026-11-21 and 2026-11-22` and `published on 2026-11-18` — ISO dates in
  a surface that uses "Nov 21, 2026" everywhere else.
- `Your ADR is PHP 3500` next to `₱3,500.00` in the KPI strip one tab away.

Impact: this is the one block a host screenshots for a co-host or owner. One leaked enum costs more
trust than ten good sentences earn, and it is the only place in the module where currency, dates and
vocabulary all disagree at once.

Fix direction: format dates and money on the server before they enter the payload (or in the card),
map `balanceCollectionState` to its label, and add the enum names and ISO date shapes to the model
prompt's output rules.

#### P1-3. KPI money truncates at 1024, and card titles wrap out of line

Evidence: [14](./screenshots/14-laptop-1024-overview.png).

At 1024 the four KPI cards are ~165 px wide. `₱3,500.00` and `₱1,400.00` render as `₱3,500....` and
`₱1,400....`. "Avg nightly rate" and "Revenue per night" wrap to two lines while "Occupancy" and
"Bookings" stay on one, so the four values no longer share a baseline.

1024 is a real laptop width and the tablet-landscape width, not an edge case. Money is the page's
reason to exist.

Fix direction: drop the decimals in the KPI value (the deltas already carry precision), or allow the
value to wrap, and clamp the title to one line at `lg`. `formatMoneyCompact` already exists for
tight surfaces.

#### P1-4. A zero change renders as a green up-arrow

Evidence: [01](./screenshots/01-desktop-1440-overview.png),
[22](./screenshots/22-desktop-1440-dark-overview.png).

`StatCard` computes `isPositive = change >= 0`, so a flat period shows `↗ 0 pts` and `↗ 0.0%` in the
same emerald chip as a real gain. All four cards do this in the seeded month.

Impact: a green up-arrow on flat data teaches the host to distrust every delta. Direction is the
entire message of the chip.

Fix direction: treat `change === 0` as neutral (gray, flat arrow or no arrow) in `StatCard`. This is
a shared primitive, so it fixes Bookings, Finance, Dashboard and Analytics at once.

### P2 — confusing or costly, should be scheduled

| #     | Finding                                                                                                                                                                                                            | Evidence                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-1  | The section tab is not in the URL. Reload or Back returns to Overview, and a host cannot share "the AI review" with a co-host. `section` is local state only.                                                      | Live: select Trends, reload, `aria-selected` is back on Overview.                                                                                  |
| P2-2  | On phone the tab strip clips the fourth tab (`AI review`) with no scroll affordance: `scrollWidth 373` vs `clientWidth 343`. The active helper tab is the one that disappears.                                     | [16](./screenshots/16-mobile-375-overview.png), [19](./screenshots/19-mobile-375-ai-review.png)                                                    |
| P2-3  | Three of the six Overview cards carry no signal on a real month: Guest age is empty, Marketing results is empty, and the booking-source donut is one solid ring. The first viewport is half absence.               | [01](./screenshots/01-desktop-1440-overview.png), [02](./screenshots/02-desktop-1440-overview-scrolled.png)                                        |
| P2-4  | New bookings smooths discrete counts into tall mountains. Four single-booking days read as four surges, the Y axis only has 0 and 1, and the legend shows a single "This period" row whenever last year is absent. | [03](./screenshots/03-desktop-1440-trends.png), [04](./screenshots/04-desktop-1440-trends-scrolled.png)                                            |
| P2-5  | Guest origins prints two decimals (`16.67%`) while the donut rounds to integers, and `Math.max(pct, 2)` makes 0% and 2% identical bars. Six rows at 16.67% read as a bug.                                          | [01](./screenshots/01-desktop-1440-overview.png), [05](./screenshots/05-desktop-1440-guests.png)                                                   |
| P2-6  | The exported PDF's last page is ~90% blank (Playbook only), the title uses an en dash, the period reads `2026-11-01 – 2026-11-30`, and KPI money has no currency symbol (`3,500.00`).                              | [23](./screenshots/23-pdf-page1.png), [25](./screenshots/25-pdf-page3.png)                                                                         |
| P2-7  | The PDF "Booking channel / Guest origin" table cross-joins two unrelated lists, leaving six empty channel cells and implying a relationship the data does not have.                                                | [24](./screenshots/24-pdf-page2.png)                                                                                                               |
| P2-8  | Tabs are `role="tab"` with no `aria-controls` and no tabpanel role, and there is no arrow-key navigation. Switching sections announces nothing and moves no focus.                                                 | Source: `AnalyticsSectionTabs`, `sliding-tabs.tsx`; the page renders sections conditionally instead of `SlidingTabsContent`.                       |
| P2-9  | The Bookings/Revenue toggle exposes lowercase accessible names (`bookings`, `revenue`) inside a tablist labelled "New bookings metric", even when Revenue is selected.                                             | [03](./screenshots/03-desktop-1440-trends.png); confirmed in the Playwright accessibility snapshot.                                                |
| P2-10 | The support FAB overlaps the chart edge / last x tick on phone and the KPI row at 1024.                                                                                                                            | [17](./screenshots/17-mobile-375-trends.png), [14](./screenshots/14-laptop-1024-overview.png), [21](./screenshots/21-mobile-375-donut-tooltip.png) |
| P2-11 | Hit targets: the chart metric toggle is 22 px tall and the section tabs are 32 to 36 px, under the 44 px rule. Info hints pass via an invisible 44 px pad.                                                         | `BookingPaceCard` segmented control; `sliding-tabs` `h-9` / `h-8` tracks.                                                                          |

### P3 — polish and consistency

| #     | Finding                                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3-1  | The page subtitle restates the title ("Track revenue, occupancy, and guest trends for this property."). Mobile already drops it; desktop should too.                  |
| P3-2  | "Clear date filter" actually resets the range to the current month.                                                                                                   |
| P3-3  | Card titles mix Title Case ("Guest age") with sentence case ("Where bookings come from") in the same grid.                                                            |
| P3-4  | "Lead time" has no unit on the axis, and "Length of stay" buckets read `1 night` / `2-3 nights` only when the chart has data.                                         |
| P3-5  | Empty cards are dead ends: "No age data for this range yet" and "No tracked planner visits" offer no next step beyond the Marketing CTA.                              |
| P3-6  | Percent precision varies inside one screen: `40%`, `+0 pts`, `+0.0%`, `16.67%`.                                                                                       |
| P3-7  | The donut palette hardcodes violet and pink (`#8b5cf6`, `#ec4899`) outside the teal brand ramp, and uses 11 px labels below any type token.                           |
| P3-8  | No `h2`/`h3` anywhere: card titles are `<p>`, so the page outline is one `h1` and nothing else. Screen-reader heading navigation finds only the page title.           |
| P3-9  | Dark mode: `bg-muted` origin tracks and dashed empty bodies read like loading skeletons.                                                                              |
| P3-10 | Repeated magic heights (`min-h-[188px]`, `min-h-[11rem]`) make the card grid rigid; an empty three-column row is taller than its content.                             |
| P3-11 | On desktop the KPI icon wells vanish below `lg` and reappear at `lg`; the 2×2 phone grid has no icon, the 4×1 row does. Acceptable, but it is a visible jump at 1024. |
| P3-12 | The AI review "Refreshed" button has no next-available hint beyond the "Once a day for this month" subtitle.                                                          |
| P3-13 | The Overview donut center repeats the Bookings KPI directly above it ("6 bookings" twice in one screenful).                                                           |

### Documentation notes

| Doc claim                                                                                 | Reality                                                                                                                       |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `docs/guides/routes/org/property/analytics.md` §States: loading uses `DashboardSkeleton`. | `PropertyAnalyticsPage` renders `PropertyAnalyticsSkeleton` (`components/skeletons/AnalyticsSkeleton`). Fixed in this change. |

## Cross-viewport matrix

| Element        | 375                                         | 768                | 1024                     | 1440                  |
| -------------- | ------------------------------------------- | ------------------ | ------------------------ | --------------------- |
| Shell          | Hero + floating period + bottom tabs        | Same               | Sidebar + compact header | Sidebar + full header |
| KPI strip      | 2×2, no icon wells                          | 2×2 wide, no icons | 4×1, **money truncates** | 4×1 with icon wells   |
| Section tabs   | 4 tabs, **4th clipped**, scrollable         | Fits               | Fits                     | Fits                  |
| Overview grid  | 1 column, tall cards                        | 1 column           | 3 columns (3 + 3)        | 3 columns (3 + 3)     |
| Charts         | Full width, tooltip on tap                  | Full width         | Full width               | 3-up                  |
| Marketing card | Full width, centered empty state + CTA      | Full width         | Full width, FAB overlap  | Full width in row 2   |
| Period control | Bottom sheet (Week / Month / Year / Custom) | Bottom sheet       | Compact dropdown         | Compact dropdown      |
| Export         | `···` hero action menu                      | Header button      | Header button            | Header button         |
| AI review      | Header wraps, Analyze under the title       | Stacked panels     | 3 panels                 | 3 panels              |

## Copy inventory (suggested replacements)

| Current                                              | Suggested                                                |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `putting your balance collection state at 'at_risk'` | "two balances are at risk of missing check-in"           |
| `smart pricing changes on 2026-11-21`                | "smart pricing changes on Nov 21"                        |
| `Your ADR is PHP 3500`                               | "Your average nightly rate is ₱3,500"                    |
| "Clear date filter"                                  | "This month" (it resets the range, it does not clear it) |
| "No age data for this range yet"                     | "Add guest ages from the booking form to see this"       |
| "16.67%" (origins)                                   | "17%" (one rounding rule everywhere)                     |
| `bookings` / `revenue` accessible names              | "Bookings" / "Revenue" as labels, not lowercased values  |
| PDF title "Analytics Report – Monaco 2604"           | "Analytics report · Monaco 2604"                         |
| PDF range "2026-11-01 – 2026-11-30 (November 2026)"  | "Nov 1 to Nov 30, 2026"                                  |
| PDF KPI "3,500.00"                                   | "₱3,500.00"                                              |

## Accessibility notes

- **Passes.** Every icon-only control has an accessible name (0 unlabeled buttons/links in the DOM
  scan). Donuts and the score dial carry full `aria-label` summaries. Decorative chart SVG is
  `aria-hidden`. Info hints have a 44 px invisible hit pad, Esc closes them, and they work on touch.
  Contrast: muted text 6.04:1 on card, 5.63:1 on background, dark mode 6.14:1 / 6.58:1, delta chip
  4.84:1 light and 7.95:1 dark. White on `--primary-strong` is 4.68:1 (passes, thin margin).
- **Tabs (P2-8).** `role="tab"` without `aria-controls` or a `role="tabpanel"` companion is an
  incomplete tab pattern. Add the panel role and an `id`/`aria-controls` pair, and roving arrow keys.
- **Toggle names (P2-9).** Visible text is capitalised with CSS, so the accessible name stays
  lowercase. Screen readers announce "bookings, tab, selected" and "revenue, tab".
- **Headings (P3-8).** Card titles are paragraphs, so heading navigation finds only the `h1`.
- **Chart values (P1-1).** Bar values exist only in Recharts tooltips; keyboard users cannot reach
  them. A visually hidden table or inline value labels would close this.
- **Touch targets (P2-11).** The 22 px metric toggle is the smallest interactive element on the page.

## Test coverage added

| File                                                     | Purpose                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/e2e/features/analytics/shared/analyticsHarness.ts`   | Deterministic bundle pinned to the current Manila month: KPIs with stable deltas, 31 pace buckets with a last-year series, all five distributions, public page, marketing, playbook, AI review; empty and sparse variants; consent dismiss; demo pause/scroll helpers |
| `ui/e2e/features/analytics/propertyAnalytics.spec.ts`    | `@ci` — 15 tests: KPIs, overview cards, donut a11y summary, tab switching, year preset refetch, trends, AI review, refresh POST, prior-period gate, sparse layout, PDF download, read-only role, free-plan upgrade, feature switch, phone sheet                       |
| `ui/e2e/features/analytics/analyticsTour.slowmo.spec.ts` | `@demo` — headed slow-motion tour, six scenarios (desktop + phone), one flow per recording                                                                                                                                                                            |

Commands:

```bash
bun run test:e2e:analytics            # headless mocked suite
bun run test:e2e:analytics:tour       # headed slow-motion walkthrough
bun run test:e2e:analytics:tour:video # same, plus .webm under test-results/playwright
```

The tour records one video per scenario. Playwright writes them to
`test-results/playwright/<scenario>/video.webm`.

### Recorded walkthroughs

Six walkthroughs are committed under [`recordings/`](./recordings) so the flows can be reviewed
without re-running the tour. Each scenario holds every state for roughly 1.6 s and animates long
scrolls.

| File                                                                                    | Flow                                                                       |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`01-overview-kpis-and-period.webm`](./recordings/01-overview-kpis-and-period.webm)     | Hero, four KPIs, glossary hint, full overview scroll, Week → Month presets |
| [`02-trends-and-distributions.webm`](./recordings/02-trends-and-distributions.webm)     | New bookings, Revenue toggle, lead time, length of stay, reviews bars      |
| [`03-guests-and-booking-sources.webm`](./recordings/03-guests-and-booking-sources.webm) | Channel donut hover, age, party size, origins                              |
| [`04-ai-review-and-playbook.webm`](./recordings/04-ai-review-and-playbook.webm)         | Review body, Refresh, Playbook tip expansion, deep link                    |
| [`05-export-pdf.webm`](./recordings/05-export-pdf.webm)                                 | Export PDF, disabled state, "PDF downloaded" toast                         |
| [`06-phone-layout.webm`](./recordings/06-phone-layout.webm)                             | 375 layout, tab strip, donut tap tooltip, period bottom sheet              |

## Recommended remediation order

1. **P1-1** legends and bar values (chart readability is the module's job).
2. **P1-2** sanitise AI review payloads: enum labels, Manila-formatted dates, one money format.
3. **P1-4** neutral zero-delta in the shared `StatCard` (one change, four modules).
4. **P1-3** 1024 KPI layout.
5. **P2-1 / P2-2** put the section in the URL and make the phone tab strip legible.
6. **P2-3** promote signal: lead with cards that have data, or collapse no-signal cards behind a toggle.
7. **P2-6 / P2-7** fix PDF pagination, currency and the cross-join table.
8. **P2-8 / P2-9** complete the tab semantics and rename the metric toggle.
9. Copy pass (table above), then P3 density and dark-mode polish.

## Not covered in this pass

- **Org portfolio analytics** (`/org/:orgSlug/analytics`). A separate page with its own listing
  table, card and KPI components; `#581` changed those components in this window. Worth its own pass.
- **Custom date range picker and the two-month calendar.** Only Week/Month/Year presets were
  exercised; the calendar body is shared with Bookings and Finance.
- **Real AI model variance.** One live generation was captured (score 75). Prompt formatting
  (P1-2) needs a fixture-based assertion, not a one-off observation.
- **Peer benchmark.** The card was removed from Overview before this review; the data still feeds
  Export PDF and the AI review, which were only read, not exercised with a live peer sample.
- **PDF pagination at other content sizes.** Three pages from one month; a heavy month would change
  the page count.
- **Playbook article bodies.** The list and the expand behaviour were reviewed; the 17 seeded
  articles' copy was not.
- **Lighthouse / bundle cost** of the analytics route and the `recharts` + `jspdf` chunks.

## Screenshot index

| #     | State                                     |
| ----- | ----------------------------------------- |
| 01    | Desktop 1440 Overview                     |
| 02    | Desktop 1440 Overview, scrolled           |
| 03–04 | Trends, top and scrolled                  |
| 05–06 | Guests, top and scrolled                  |
| 07    | AI review with a generated review         |
| 08    | Playbook article open                     |
| 09    | Period presets                            |
| 10    | KPI glossary hint                         |
| 11    | Exporting (disabled state)                |
| 12    | After export ("PDF downloaded")           |
| 13    | Laptop 1280                               |
| 14    | Laptop 1024 (money truncation)            |
| 15    | Tablet 768                                |
| 16–19 | Phone Overview, Trends, Guests, AI review |
| 20    | Phone period bottom sheet                 |
| 21    | Phone donut tap tooltip                   |
| 22    | Dark mode Overview                        |
| 23–25 | Exported PDF pages 1–3                    |

## Appendix: detector coverage

`impeccable detect --json ui/src/features/dashboard/analytics` exits 0 with 0 findings. That is a
**coverage artifact, not a clean bill**: in this build the TSX regex mode only evaluates
`ai-color-palette` and `gray-on-color` (validated with control fixtures). Arbitrary values, heading
order, `onClick` semantics, alt text and spacing rules did not run on `.tsx`. Everything in this
report therefore comes from source reading, live rendering and measured DOM values, not from the
detector.
