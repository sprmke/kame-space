---
title: 'Mobile search and browse: full-screen search flow'
status: for-testing
tags: [workflow, for-testing, mobile, guest, search, ui]
updated: 2026-11-18
stage: for-testing
kind: plan
---

# Mobile search and browse: full-screen search flow

Scope: the **guest search and browse experience below `lg` (1024px)** on every surface that mounts the shared hero search: home (`/`), `/properties`, `/developments`, `/parkings`, their `/in/:location` pages, development detail sub-pages, `/services` and `/search`. Desktop (`lg+`) keeps the segmented bar and dropdown panels unchanged.

Reference: Airbnb's mobile web search (interaction patterns only, never its brand, copy or assets). Kame tokens, Plus Jakarta Sans and Lucide icons stay as in `DESIGN.md`.

## 1. What is wrong today (390px audit, 2026-11-15)

| #   | Finding                                                                                                                                                                                                | Impact                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| M1  | The phone bar is the desktop bar squeezed onto one line: three ~90px segments (`Anywhere`, `Anytime`, `2`) plus a 32 to 40px search button. Labels are gone, the guest segment reads as a bare number. | Guests cannot tell what each control does. Targets are below 44px when docked. |
| M2  | Each segment opens a dropdown anchored under the bar (`computeDropdownLayout`). On a phone it opens partly off-screen; the calendar is clipped at the right edge and the panel scrolls with the page.  | The date step is the hardest step to complete. Reported as "hard to book".     |
| M3  | The Who panel is unreachable once the bar docks; the outside-tap listener closes the panel when the floater re-measures.                                                                               | Guests skip the guest count, results ignore capacity.                          |
| M4  | No way to pick what to search for (stays, residences, parking) other than navigating to that list first.                                                                                               | Parking and developments are hard to find from home.                           |
| M5  | No recent searches. A returning guest retypes the same place and dates.                                                                                                                                | Extra steps on every visit.                                                    |
| M6  | `/search` on a phone stacks four bars: search pill, full-width `Filters & Sort`, count + sort + view toggles, then category pills inside content.                                                      | Results start ~300px down the screen.                                          |
| M7  | Map is a small icon in a segmented control.                                                                                                                                                            | Map browsing (Airbnb's main mobile results mode) is hidden.                    |
| M8  | Android back and the iOS PWA edge swipe leave the page instead of closing an open search panel.                                                                                                        | Loses the page and the search in one gesture.                                  |

## 2. Target flow (below `lg`)

1. **Entry pill.** One full-width pill. Empty: search icon + `Start your search`. With a search: line 1 is the place (or `Anywhere`), line 2 is `dates · guests` (`Any week`, `Add guests`). Same pill in the hero and docked in the header on scroll.
2. **Full-screen search.** Tapping the pill opens a full-screen layer over the page: close button, category tabs (`All`, `Properties`, `Developments`, `Parkings`), then one card per step on a muted canvas. Exactly one card is open; the others collapse to a row showing the current value.
3. **Where.** Title `Where to?`, a rounded search field, then recent searches and suggested destinations (or recommended listings on category tabs). Typing shows the live typeahead. Picking a place moves to When; picking a listing opens it.
4. **When.** Title `When's your trip?` (`When do you need it?` for parking). Sticky weekday row and a vertical scroll of 12 months, range selection, past days disabled. Card footer: `Skip` / `Reset` and `Next` (or `Search` when there is no Who step).
5. **Who.** Title `Who's coming?`, steppers for adults, children and pets with disabled minus at the floor. Hidden for parking.
6. **Footer.** `Clear all` and a primary `Search` button, pinned above the safe area. Hidden while When owns its own footer.
7. **Category scope.** The selected tab scopes the result type (`type` + `focus` in the URL). Parking hides Who. `/services` keeps its own `What` field and shows no tabs.
8. **Dismiss.** Close button, Escape, Android back and PWA back all close the layer without leaving the page. Search and listing picks replace that history entry so Back from results returns to the page in one step.

### Results (`/search`) below `lg`

- Sticky row under the header: category chips with counts (scrolls horizontally) and a round filter button with an active-filter count badge.
- Count line above the list; sort lives in the filter sheet (unchanged).
- Floating `Map` pill above the tab bar when the active category supports the map.
- Desktop toolbar and in-content tab strip stay `lg+` only.

### Listing pages below `lg` (round 2)

- `/properties`, `/developments`, `/parkings`, their `/in/:location` pages, `/developments/:slug/properties` and `/developments/:slug/parking` use the **same results bar** as `/search`: count on the left, round filter button with an applied-filter badge on the right. The old `Filters & Sort` row, the 3-icon view toggle and the stacked desktop toolbar are gone below `lg`. Applied-filter chips stay `lg+` only (the badge carries the count).
- **Map view** (pages with a map): a floating `Map` pill opens a full-bleed map between the results bar and the tab bar. A sheet handle at the bottom shows the count; drag it up, flick it, or tap it to go back to the list. The handle sits under the map, never over it, so the Google logo and terms stay visible. The header search stays docked while the map is open.
- **Flexible dates**: once a full stay is picked, chips under the calendar (phone and desktop) offer `Exact dates`, `± 1 day`, `± 2 days`, `± 3 days`, `± 7 days`. The URL carries `flex`; summaries read `Nov 20 – 23 (±2)`.

## 3. Tasks

| #   | Task                                                                                                                                                                                         | Files                                                                                  | Status |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| T1  | Pure helpers: pill summary, category tabs + fields per category, recent searches store (try/catch, max 5), unit tests                                                                        | `marketing/shared/lib/mobileSearchState.ts` + test                                     | [x]    |
| T2  | History-backed dismiss hook (push on open, back closes, `consume()` for replace navigation)                                                                                                  | `ui/src/hooks/useHistoryBackDismiss.ts`                                                | [x]    |
| T3  | `MobileSearchPill` entry control (empty + summary states, docked size)                                                                                                                       | `hero-search/MobileSearchPill.tsx`                                                     | [x]    |
| T4  | `MobileSearchOverlay` shell: Radix dialog (focus trap, scroll lock, Escape), tabs, accordion cards, footer, motion with reduced-motion off                                                   | `hero-search/MobileSearchOverlay.tsx`                                                  | [x]    |
| T5  | Where card: field, recent searches, suggestions, typeahead, keyboard nav                                                                                                                     | `hero-search/MobileSearchSteps.tsx`                                                    | [x]    |
| T6  | When card: vertical 12-month range calendar, sticky weekdays, Skip/Reset/Next                                                                                                                | `hero-search/MobileSearchSteps.tsx`, `heroSearchCalendarClassNames.ts`                 | [x]    |
| T7  | Who card: steppers (adults min 1, children, pets)                                                                                                                                            | `hero-search/MobileSearchSteps.tsx`                                                    | [x]    |
| T8  | Wire into `HeroSearch` below `lg`: shared state with desktop, category override, scoped submit, recent-search save, replace navigation                                                       | `hero-search/HeroSearch.tsx`                                                           | [x]    |
| T9  | `/search` mobile chrome: sticky chips + filter button with badge, count line, floating Map/List pill, drop duplicate bars                                                                    | `search/pages/SearchResultsPage.tsx`, `search/components/SearchMobileResultsBar.tsx`   | [x]    |
| T10 | Visual QA at 375 / 390 / 768 / 1024 in light and dark; reduced motion                                                                                                                        | Playwright screenshots                                                                 | [x]    |
| T11 | Docs: route guides (home, search, properties, developments, parkings), architecture note, FAQ                                                                                                | `docs/guides/routes/*`, `docs/architecture/overview.md`, `docs/guides/support/faqs.md` | [x]    |
| T12 | Gates: type-check, lint, unit tests, filenames, build                                                                                                                                        | CI scripts                                                                             | [x]    |
| T13 | Listing pages: shared `ListingMobileResultsBar` (count + filter badge), desktop-only toolbars and chips, phone sort on every filter sheet                                                    | `marketing/shared/components/ListingMobileResults.tsx`, 8 list pages, toolbars         | [x]    |
| T14 | Phone map view: full-bleed `ListingMobileMapStage` with a draggable sheet handle, `Map` pill in list view, header held docked                                                                | `ListingMobileResults.tsx`, `ListingScrollSearchContext.tsx`, `index.css`              | [x]    |
| T15 | Flexible dates: `flex` in URL + API, `flexDays` in `search_public_properties` / `search_public_parkings`, chips on phone and desktop                                                         | migration `20261341000000`, 3 edge functions, `searchFlexDays.ts`, `HeroSearch.tsx`    | [x]    |
| T16 | Infants: decided not to add (see D5)                                                                                                                                                         | N/A                                                                                    | [x]    |
| T17 | Fixes found on the way: short pages left the header search half-docked over the logo; `/developments/:slug/properties` never showed its "No homes listed" state and flashed it while loading | `listingScrollSearchEasing.ts`, `DevelopmentPropertiesPage.tsx`                        | [x]    |

## 4. Out of scope (follow-ups)

- Flexible `Months` / `Weekend` / `Week` search ("I'm flexible" tab): needs a different availability query (any N-night window inside a month), not a shift of fixed dates. The `± days` chips shipped in T15.
- A sheet that rests half-open over the map with a scrollable list inside (the native app pattern). The shipped handle switches between full map and full list, which keeps one scroll container and avoids drag-versus-scroll conflicts on mobile web.
- Listing cards do not show which shifted dates matched a flexible search; the detail page calendar shows availability.

## 5. Decisions

| #   | Question                                  | Decision                                                                                                                                                                          |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Hide the tab bar on scroll?               | No. Follows C6 in `mobile-app-chrome-header-and-tab-bar.md`.                                                                                                                      |
| D2  | Tab choice scopes results or only orders? | Scopes (`type` = tab, `focus` = tab). Matches the Nearby pick, and the results tab strip still lets the guest widen to All.                                                       |
| D3  | Selected-day color                        | `bg-primary-strong` ends, `bg-primary/10` band: white text on brand fills must use the strong token (`textOnBrandFill.test.ts`).                                                  |
| D4  | Overlay primitive                         | Radix Dialog (already used by Sheet) for focus trap, scroll lock and Escape. No new dependency.                                                                                   |
| D5  | Add an infants stepper?                   | No. Capacity counts adults + children only and the booking form has no infants field, so the stepper would change nothing. Revisit if the booking form starts collecting infants. |
| D6  | Which flexible windows?                   | `± 1, 2, 3, 7` days. The API accepts only these (anything else is exact); SQL clamps to 14. Shifted stays never start before today (Manila).                                      |
| D7  | Map sheet over or under the map?          | Under. Covering the bottom edge would hide the Google logo and terms, which the Maps terms require to stay visible.                                                               |
