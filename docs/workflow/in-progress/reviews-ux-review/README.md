---
title: 'Org & Property Reviews UX/UI review and fixes'
status: active
tags: [ux, ui, reviews, review, qa, e2e, property, org]
updated: 2026-11-24
---

# Org & Property Reviews — UX/UI review and fixes

Deep review of the reviews module (property + org), then a remediation pass on the findings.
Every changed surface has a matched before/after pair in [`comparisons/`](./comparisons), captured
from the same spec against the same fixtures.

| Surface      | Route                                             | What it holds                                                              |
| ------------ | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Property     | `/org/:orgSlug/property/:propertySlug/reviews`    | KPIs, three tabs, toolbar, table or cards, detail sheets, Auto-review sheet |
| Org rollup   | `/org/:orgSlug/reviews`                           | The same, plus a Listing column and a listing filter                        |
| Guests tab   | `?tab=received` (default)                         | Published guest reviews                                                    |
| To write     | `?tab=to_write`                                   | Open 14-day windows with no host review yet                                |
| About guests | `?tab=written`                                    | Host reviews of guests                                                     |
| Rating sheet | from the Average rating card                      | Star distribution and the six category averages                            |
| Auto-review  | header action, property only                      | Pro+ rules: timing, posted ratings, templates, skip rules                  |

Reviewed with the `impeccable` (context + critique), `mobile-responsive`, `frontend-design`,
`ui-ux-pro-max`, `design-md`, `accessibility`, `human-copy`, `skeleton-loaders` and `support-content`
skills, plus both route guides and the two list endpoints.

## Repo state

| Item         | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Base         | `origin/main` `c1cc929d6` (Merge PR #595), branched as `feat/reviews-ux-fixes` |
| Synced       | 2026-11-24. 40 commits behind, 36 of them through `develop`                |
| App          | Headless Chromium against a clean worktree, mocked edge envelopes          |
| Fixtures     | `ui/e2e/features/reviews/shared/reviewsUxHarness.ts`                       |
| Viewports    | 390×844, 768×1024, 1024×768, 1280×800, 1440×960, dark at 1440               |
| Screenshots  | 39 before + 39 after ([`before/`](./before/screenshots) · [`after/`](./after/screenshots)) |
| Comparisons  | 10 side-by-side pairs in [`comparisons/`](./comparisons)                   |
| Recordings   | 8 slow-motion flows in [`recordings/`](./recordings)                       |
| Console      | 0 page errors on every surface                                             |
| Layout       | `scrollWidth == clientWidth` at 390 / 768 / 1024 / 1440 on both scopes      |

## What the sync changed

`origin/main` removed the **By property** tab and rewrote `ReviewsListPage` and `ReviewsToolbar`
(three tabs everywhere, no per-listing rollup table). That retired five findings before any work
started:

| Retired                                                    | Why                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| `tr role="button"` on the By-property table                | `OrgPropertyReviewsTable.tsx` was deleted upstream        |
| By-property rows showing four dashes                       | tab removed                                               |
| By-property to-write chip looking like a badge              | tab removed                                               |
| Phone tab strip clipping a fourth tab                      | three tabs now fit at 390                                 |
| "KPI row is noise on To write / About guests" (P2-9)       | **not a defect**: the fixture returned zeros for those tabs. The edge function returns the same summary for every tab. Fixture corrected. |

The sync also introduced one new defect that the old review could not see: at 1024 the rewritten
toolbar squeezed the search field to "Se". Fixed in this pass.

## Verdict

The module is structurally sound: one component behind two routes, list state in the URL, per-listing
permissions resolved server-side, every mutation behind an edge function that re-checks the leaf and
writes `activity_log`, loading and empty states that keep the chrome mounted.

What held it back was the laptop layout, the phone's missing primary action, and a set of
accessibility and error-handling contracts that were never wired. All 5 P1s and 14 of the 15 P2s are
fixed here; one P2 and one P3 are deliberately not changed, with reasons.

## Before / after

| Surface                       | Pair                                                                                        | What changed                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Desktop feed, 1440            | [01](./comparisons/01-desktop-property-received.png)                                        | Review text readable, rating column drops the duplicate digit                 |
| Laptop table + toolbar, 1024  | [32](./comparisons/32-laptop1024-property-received.png)                                     | Toolbar wraps, search usable, review column 132→266px, stay date restored     |
| Phone cards, 390              | [20](./comparisons/20-phone-property-received.png)                                          | Reply / Edit reply in the card footer (was ⋯ only)                            |
| Respond sheet                 | [03](./comparisons/03-desktop-respond.png)                                                  | Shows the review and stay; Save disabled until there is text                  |
| Auto-review templates         | [18](./comparisons/18-desktop-auto-review-templates.png)                                    | Live preview with a real pending guest and property name                     |
| Phone Refine, To write        | [25](./comparisons/25-phone-refine-to-write.png)                                            | Empty "Filters" section gone                                                  |
| Read Only member              | [40](./comparisons/40-desktop-read-only-received.png)                                       | Auto-review hidden without `reviews.guests:edit`                              |
| Load error                    | [42](./comparisons/42-desktop-load-error.png)                                               | No false `0` / `—` KPIs; consistent error card with Try again                 |
| Rating breakdown              | [04](./comparisons/04-desktop-rating-breakdown.png)                                         | 3.8 draws 3.8 stars, not 4                                                    |
| Phone card actions            | [21](./comparisons/21-phone-card-actions.png)                                               | Sheet titled with the guest, duplicate reply item removed                     |

## Fixes

### P1

| #    | Finding                                    | What changed                                                                                                                                                     |
| ---- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-1 | Auto-review dialog had no accessible name   | The JSX title now renders `ResponsiveModalTitle`, so `aria-labelledby` exists                                                                    |
| P1-2 | Review column collapsed to 132px at 1024    | Response column moves to `xl`, toolbar wraps with a 13rem search floor; review column 266px at 1024 (measured)                                    |
| P1-3 | Stay dates missing between 768 and 1279     | The guest cell carries the stay (or submitted) date until the column appears at `xl`                                                              |
| P1-4 | Phone reply buried in the ⋯ sheet           | Card footer renders **Reply** / **Edit reply** for anyone with `reviews.responses:edit`; the sheet keeps booking/marketing/report                  |
| P1-5 | Cards exposed as `role="button"` around real controls | The card is a plain surface with one overlay button ("Open {Guest}'s review") as a sibling of the content; ⋯ and Reply sit above it at `z-20`. Tapping anywhere on the card still opens the review, and nothing is nested inside a button |

### P2

| #     | Finding                                    | What changed                                                                                                              |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| P2-1  | Respond sheet hid the review               | Sheet shows stars, stay dates and a four-line review excerpt above the field                                              |
| P2-2  | Blank save said "Response removed"         | Save disabled unless the text changed and is non-empty; removal moved to **Remove**                                        |
| P2-3  | Auto-review offered to read-only members   | Header action requires `reviews.guests:edit`                                                                              |
| P2-4  | Empty Filters section on To write          | The section renders only when the tab has a filter                                                                        |
| P2-5  | Averages rounded up in stars               | `starFillRatio` draws the true fraction (3.8 → 3 full + 0.8); unit tested                                                  |
| P2-6  | Failed queries read as "no reviews"        | Both list services throw instead of returning empty; the page shows its error state. Constraint: search-name lookup stays non-fatal |
| P2-7  | Error state contradicted itself            | KPI cards are not rendered while the request is in error                                                                  |
| P2-8  | Org KPIs ignored the listing filter        | Cards are recomputed from the selected listings (weighted by review count) and the breakdown sheet is disabled while filtered |
| P2-9  | KPI row looked empty on two tabs           | Not a defect (fixture); harness now returns the same summary for every tab                                                |
| P2-10 | Guest-review form validated through toasts | Inline errors on the first save attempt, focus moves to the first invalid field, plus a character counter                  |
| P2-11 | Auto-review had no preview, 40px steppers  | Live template preview with the first pending guest + property name; steppers are 44px                                     |
| P2-12 | Fourth tab clipped on phone                | Retired: three tabs                                                                                                       |
| P2-13 | Destructive actions read as neutral        | **Remove** is destructive-coloured and asks "Remove your response?" first. Report stays in the detail sheet footer (accepted) |
| P2-14 | Same state had three labels                | `Hidden until publish` everywhere (card badge included)                                                                   |
| P2-15 | Archived listings inflated the org rollup  | `listOrgReviewScopeProperties` excludes `inactive_reason = 'archived'`. Constraint: `.or('inactive_reason.is.null,inactive_reason.neq.archived')` because `neq` drops NULLs |

### P3

| #     | Finding                                | What changed                                                                                   |
| ----- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| P3-1  | Unreferenced components                | `ReviewAutomationCard.tsx`, `ReviewAutomationStatusRow.tsx` deleted; gate-coverage map updated   |
| P3-2  | Sort trigger had no accessible name    | `aria-label="Sort reviews: Newest first"` (the popup label is unchanged)                        |
| P3-3  | Rating printed stars and the digit     | Digit removed; the stars announce the rating                                                   |
| P3-4  | Review excerpt was muted               | `text-foreground/80`, still two-line clamped                                                   |
| P3-5  | Sub-44px targets                       | Pagination page buttons 44px on phone; the ⋯ trigger already had a hit pad                     |
| P3-6  | By-property dashes                     | Retired                                                                                         |
| P3-7  | By-property chip looked like a badge   | Retired                                                                                         |
| P3-8  | Stay date wrapped at 1440              | `whitespace-nowrap` on the Stay / Submitted cells                                              |
| P3-9  | Phone sheet had no close control       | Accepted: bottom sheets use the drag handle and overlay, per the repo's mobile pattern          |
| P3-10 | Generic sheet titles                   | `{Guest}'s review`, `Your review of {Guest}`, action sheet titled with the guest                |
| P3-11 | Filters badge double-counted a chip    | Not a defect: the badge counts only controls inside the popover                                 |
| P3-12 | `ReviewsListPage` is large             | Deferred on purpose: a hook extraction changes no behaviour and would double the diff size      |
| P3-13 | Report cap was count-then-insert       | Insert first, re-count, delete your own row when the cap is exceeded                           |

### Also fixed

- **Docs:** both route guides said per page `31 · 50 · 100` (code is 25/50/100) and the property guide
  pointed at a `test:reviews:live` script that does not exist.
- **Setup-guide crash:** `mergeSetupGuidePersistedState` threw
  `Cannot read properties of undefined (reading 'dismissedAt')` when a `setup-guide-state` success
  response had no `setupGuide`. It surfaced on the org Reviews route; now tolerates `null` with a
  unit test.

## Verification

| Gate                        | Result                                                                     |
| --------------------------- | -------------------------------------------------------------------------- |
| `bun run test` (Vitest)     | 6813 passed, 6 skipped (955 files)                                        |
| `bun run test:e2e:reviews`  | 33 tests, all passing (22 module tests + 11 pre-existing reviews specs)    |
| `tsc --noEmit`              | clean                                                                      |
| `eslint` (changed files)    | clean, 0 warnings                                                          |
| `check:filenames`           | clean                                                                      |
| `check:e2e-lane-tags`       | no reviews findings                                                        |
| Layout                      | no page overflow at 375 / 768 / 1024 / 1440 on both scopes                 |
| Console                     | 0 page errors across every captured surface                                |

New unit tests:

- `ui/src/features/reviews/lib/ratingFill.test.ts` — fractional star fill and spoken rating.
- `ui/src/features/reviews/lib/reviewsOrgSummary.test.ts` — weighted listing rollup (count, average
  excluding unrated listings, response rate, due count, empty case).
- `ui/src/features/dashboard/setup-guide/lib/setupGuideState.test.ts` — merge with a missing payload.

New E2E tests (in `reviewsUxReview.spec.ts`, all `@ci`):

1. Laptop table keeps the review readable (Review ≥ 200px, no Response column) and the stay date.
2. Phone cards reply without opening the overflow menu.
3. Read Only member has no reply button and no Auto-review.
4. Respond sheet shows the review and only saves real text.
5. Removing a response asks first.
6. Fractional averages do not round up in stars.
7. To write refine sheet has no empty Filters section.
8. Sort control has an accessible name.
9. Org cards follow the listing filter (3.6 / 5 instead of 3.8 / 9, breakdown disabled).
10. The whole phone card opens the review, not just the name (locks the overlay).

Plus the existing contract tests: feed + KPIs + detail sheet, respond, report validation, to write,
about guests, legacy `?tab=properties` fallback, URL state, view toggle, read-only, auto-review save
and unsaved guard, error state, no overflow.

## Capture

```bash
# before the fixes (on the base commit)
REVIEWS_CAPTURE_PHASE=before bun run test:e2e:reviews:screens

# after the fixes
bun run test:e2e:reviews:screens

bun run test:e2e:reviews          # module suite
bun run test:e2e:reviews:tour:video
```

## Not covered

- **Live data.** Every surface runs on mocked envelopes; double-blind publish timing, the 14-day
  window cron and moderation are covered by `test:edge` and `reviewsLifecycleLocal.integration_test.ts`.
- **Real media.** Review photos are 1px PNGs in the fixtures, so they render as black squares.
- **AI drafting.** `draft-review-with-ai` returns a canned string; quota and provider failure are not driven.
- **Email.** The first-response email is asserted by edge tests, not from the UI.
- **Free plan.** Fixtures run on Business entitlements; the Free/Starter downgrade path is covered by
  the plans suite.
- **Shared-harness gap.** `propertyTeamRbacHarness.entitlementsPayload` still omits `reviewAutomation`;
  `reviewsUxHarness` overrides `property-entitlements` instead. The shared payload should eventually
  mirror `planFeatures` rather than hand-list keys.

## Related

- Route guides: [`org/reviews.md`](../../../guides/routes/org/reviews.md) ·
  [`org/property/reviews.md`](../../../guides/routes/org/property/reviews.md)
- Page: `ui/src/features/reviews/pages/ReviewsListPage.tsx`
- Edge: `list-property-reviews`, `list-org-reviews`, `respond-to-guest-review`, `report-review`,
  `submit-host-guest-review`, `review-automation-settings`, `draft-review-with-ai`
- Shared services: `_shared/propertyReviewList.ts`, `_shared/orgReviewList.ts`
- Sibling audits: [`../settings-ux-review/`](../settings-ux-review/README.md) ·
  [`../marketing-ux-review/`](../marketing-ux-review/README.md) ·
  [`../money-modules-ux-audit/`](../money-modules-ux-audit/README.md)

## Screenshot index

| Pattern     | Contents                                                                 |
| ----------- | ------------------------------------------------------------------------ |
| `01` … `18` | Desktop: feed, detail, respond, breakdown, tabs, Auto-review, cards, filters, empty, org feed, legacy tab, org cards, single listing, paging, Auto-review dirty + preview |
| `20` … `30` | Phone: feed, actions, detail, Refine (both tabs), write review, About guests, Auto-review, org feed, legacy tab |
| `31` … `35` | Tablet 768, laptop 1024, laptop 1280, dark feed, dark breakdown           |
| `40` … `44` | Read Only (both tabs), load error, empty feed, empty To write            |
