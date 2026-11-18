---
title: 'Audit 27: design remediation backlog'
status: active
tags: [audit, design, backlog, mobile, copy, accessibility]
updated: 2026-11-19
---

# 27: Design remediation backlog

Every design change from phase 4, sequenced by impact. Functional and security defects stay in
[18](./18-remediation-backlog.md); this list is UI, UX, copy and accessibility. Each row names the route or
component and what "done" looks like, so it can become an issue without re-reading the reports.

Sources: [23 design system](./23-design-system-critique.md), [24 public/guest](./24-public-guest-design.md),
[25 host dashboards](./25-host-dashboard-design.md), [26 parking/admin](./26-parking-admin-design.md).

---

## Wave 1 — trust breakers (do first)

These are the screens where a guest or host currently sees something false, missing, or impossible.

| #   | Change                                                                                                                                            | Where                                  | Done when                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| D1  | Make the booking form reachable without an account, or dismissible with a reason                                                                  | `GuestFormPage` auth sheet             | Escape and a visible close work; copy matches home page              |
| D2  | Key guest-form prefill to the signed-in account; block fixture identities in production                                                           | `GuestForm.tsx` prefill                | No `@example.com` identity can render outside dev                    |
| D3  | Replace the broken map with a static map + address fallback; never print the provider error                                                       | listing detail, parking detail         | "Where you'll be" always shows a location visual or a clean fallback |
| D4  | Fix the property `/dashboard` route and add a recovery path on 404                                                                                | property router, public 404            | `.../property/:slug/dashboard` lands on the property index           |
| D5  | Make the trip and step-5 payment blocks reconcile (stay, deposit, paid, balance, refund window)                                                   | trip, form step 5                      | One receipt whose numbers add up                                     |
| D6  | Give Settings a reachable Save on every breakpoint                                                                                                | property/parking settings              | Edit at 390 produces a visible Save; sticky bar clears the tab bar   |
| D7  | Add mobile section navigation to every long admin page                                                                                            | settings, admin org/development detail | Section picker sheet + sticky Save, page navigable in one tap        |
| D8  | Purge seed and internal strings from every surface (`LOCAL_SEED`, `itest-`, `AUDIT-MESSAGE`, `Local demo …`, `seed-owner`, raw UUIDs, 2027 dates) | all                                    | A grep for those literals matches nothing in rendered UI             |

---

## Wave 2 — broken layout and hierarchy

| #   | Change                                                                           | Where                              | Done when                                              |
| --- | -------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| D9  | Fix the org bookings table at 1440 (drop/nest `LISTING`, pin actions, edge fade) | `BookingsListPage`                 | `ACTIONS` visible at 1440 and reachable at 1024        |
| D10 | Render the Revenue Overview chart below 1024                                     | org dashboard                      | Chart or sparkline visible at 390/768                  |
| D11 | Protect every table's action column at `lg`                                      | bookings, admin tables             | No clipped action column at 1024                       |
| D12 | Fix sticky-bar overlap on form steps 3-5                                         | guest form, booking detail         | Last option fully visible at 390                       |
| D13 | Remove the month grid on mobile; agenda list instead                             | property/parking dashboard         | Calendar readable at 390, no 3-character pills         |
| D14 | Replace 4-card KPI rows with one ranked stat band                                | 17 dashboard pages + 5 admin lists | Max 3 numbers above the fold, no decorative icon wells |
| D15 | Fix the mobile Bookings first screen                                             | bookings                           | One chip row + one toolbar before the first booking    |
| D16 | Replace duplicate KPI cards that restate a filter (`Pending 0`)                  | bookings, admin lists              | No card whose value is 0 on first paint                |
| D17 | One table primitive: sticky header, pinned actions, 44px rows, labelled ⋯        | shared table                       | Every list uses it                                     |

---

## Wave 3 — design system

| #   | Change                                                                                 | Where                                  | Done when                                           |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| D18 | Delete 9px text; floor meta at 11-12px and body at 14px                                | 58 × `text-[9px]`, 252 × `text-[10px]` | No text under 11px                                  |
| D19 | Reduce to a five-step type ladder and two weights per region                           | all surfaces                           | Documented in `DESIGN.md`, enforced in review       |
| D20 | Eyebrows become `<p>`, not headings; fix the h1→h3 skip                                | settings, marketing, analytics         | Heading outline has no skipped levels or duplicates |
| D21 | Delete dashboard page subtitles                                                        | all `/org/**` pages                    | H1 stands alone                                     |
| D22 | `text-primary` → `text-brand-ink` for text; add a dark contrast guard                  | dashboard links, eyebrows              | Dark-mode link contrast ≥4.5:1                      |
| D23 | Darken the required-field marker in both themes                                        | shared field label                     | ≥4.5:1 in light and dark                            |
| D24 | Route badges through semantic tokens (fix 2.5:1 teal / 2.8:1 sky admin badges)         | `/admin`, shared badge                 | All badges ≥4.5:1                                   |
| D25 | Rebuild the chart palette inside the brand hue                                         | tokens, analytics, admin               | No raw sky/violet/pink fills in charts              |
| D26 | Two radii (14 surfaces / 10 controls), set `--radius` to match                         | tokens + card/panel classes            | One card radius, one control radius                 |
| D27 | Two icon sizes (16 inline, 20 nav/stat)                                                | shared icons                           | No 12px or 14px icons in chrome                     |
| D28 | One badge component with status / meta / plan variants                                 | all surfaces                           | Nine styles collapse to three                       |
| D29 | One money/date formatter pair + money input mask                                       | finance, pricing, maintenance, admin   | One currency format, one date format                |
| D30 | Fix opacity-based dimming that breaks contrast (team rows 2.26:1, pricing days 1.93:1) | team, pricing                          | Dimming never drops data below 4.5:1                |

---

## Wave 4 — accessibility

| #   | Change                                                                          | Where                                                         | Done when                                      |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| D31 | Field errors set `aria-invalid` + `aria-describedby`; error node `role="alert"` | shared field wrapper                                          | Invalid field announces its own message        |
| D32 | Add a skip link to both shells                                                  | admin + public layouts                                        | First Tab reveals "Skip to content"            |
| D33 | Give every page one `h1` (account area has none)                                | account, search, properties, parkings, developments, calendar | One h1 per route                               |
| D34 | Restore focus to the trigger on dialog close; set `aria-modal`                  | `ResponsiveModal`                                             | Escape returns focus to the opener             |
| D35 | Label the toast live region                                                     | toast provider                                                | Region has an accessible name                  |
| D36 | 44px minimum for calendar cells and hero icons                                  | calendar, listing, dashboard hero                             | No interactive target under 44px on touch      |
| D37 | Name the status-filter checkboxes                                               | bookings filters                                              | `getByRole('checkbox')` resolves each option   |
| D38 | Add `aria-pressed` and a hex value to the brand colour picker                   | settings                                                      | Selected swatch is announced                   |
| D39 | Chart text alternatives                                                         | analytics, finance, admin                                     | Every chart has a legend or a table equivalent |

---

## Wave 5 — flow and content

| #   | Change                                                                   | Where                                                             | Done when                                                           |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| D40 | Collapse guests 2-4 on form step 1 behind "Add another guest"            | guest form                                                        | Step 1 ≤ 1.5 phone screens                                          |
| D41 | One progress component; `step/total` everywhere                          | guest form, trip                                                  | Fill matches the label on every step                                |
| D42 | Add a booking summary to every form step                                 | guest form                                                        | Property, dates, nights, price always visible                       |
| D43 | Rename "Guest Advise Form" → "Guest details"; spell out GAF              | guest form                                                        | No internal acronym in guest copy                                   |
| D44 | Read-only check-in/check-out times in the Stay step                      | guest form                                                        | Times are text, editable only in settings                           |
| D45 | One date format in guest-facing copy                                     | guest form, trip, calendar                                        | No `MM/DD/YYYY`                                                     |
| D46 | Success page renders without router state                                | `/success`                                                        | Reload shows a confirmation, not a calendar                         |
| D47 | Reuse `/support` answers in `/account/help`; add search to `/support`    | account help, support                                             | 36 answers are reachable from both                                  |
| D48 | Collapse duplicate account navigation; one h1; profile summary + Edit    | `/account/*`                                                      | One nav, one heading, no duplicated data block                      |
| D49 | Fix one-item grids (stretch or feature, never a 4-up void)               | home, search, properties, developments, host, vouchers, favorites | One result never floats in a 4-column grid                          |
| D50 | Fallback image component; hide ₱0; singular/plural; real location labels | listing cards                                                     | No broken glyphs, no "From ₱0", no "1 homes", no "Parking in Other" |
| D51 | Group the notification feed by conflict type with a count and one action | property/parking notifications                                    | 13 rows become 1 with a count                                       |
| D52 | Phone pricing: one plan at a time, counter, open on Free, CTA pinned     | `/for-hosts/pricing`                                              | CTA reachable at any scroll position                                |
| D53 | Split Settings into sub-routes                                           | property settings                                                 | Each section has a URL                                              |
| D54 | One host landing page (retire `/v2`, `/v3` or redirect)                  | marketing                                                         | One canonical page                                                  |
| D55 | Delete restating subtitles and card descriptions across admin            | all                                                               | Copy audit finds no title restatement                               |

---

## Wave 6 — polish

| #   | Change                                                           | Where             |
| --- | ---------------------------------------------------------------- | ----------------- |
| D56 | Shell paint before JS boots (brand block in `index.html`)        | `ui/index.html`   |
| D57 | Correct the home hero alt text                                   | home              |
| D58 | Fill or remove the tour mock's blank panels; ship a poster frame | `/for-hosts`      |
| D59 | Truncate + copy button for the parking booking URL               | parking pricing   |
| D60 | Hide `itest-*` ids behind a details expansion                    | notifications     |
| D61 | Labelled `Rows: 31 ▾` instead of a bare `31`                     | 12 admin toolbars |
| D62 | Remove the stray white box-shadow                                | shared card       |
| D63 | Label the mobile More sheet; verify all destinations at 390      | mobile shell      |
| D64 | A real 768 layout (icon rail + table)                            | admin shell       |
| D65 | Regroup super admin nav into 5 groups + ⌘K search                | `/admin`          |

---

## Mobile removals (explicit)

The user asked what should be **removed** on mobile, not just resized:

1. **Property/parking dashboard month grid.** Unusable at 390 (pills render `• R…`). Replace with a 3-day
   agenda.
2. **Bookings `Card | Calendar` toggle.** Calendar view of a booking list on a phone is a dead end; the
   shell already defaults to cards.
3. **Guest form theme toggle and account avatar.** Host chrome on a guest form.
4. **The guest form's third label per step** (`Guest / Contact & guest details` card header).
5. **Four-account-tile duplicates** (Trips, Messages appear in both the tile strip and the bottom bar).
6. **The second chart panel on the parking dashboard** until data exists; one card, not two empty ones.
7. **`FLAGS` column and `Pending 0` card** where every value is empty or zero.
8. **Duplicate rating in the listing sticky bar.**
9. **Six unlabelled workflow dots** on booking detail; replace with a named step.
10. **Decorative KPI icon wells** on every dashboard card.

---

## Acceptance gates to add

| Gate                                                                                   | Catches       |
| -------------------------------------------------------------------------------------- | ------------- |
| Contrast check with **ancestor opacity blending**                                      | D22, D23, D30 |
| No `text-[9px]` / `text-[10px]` in `ui/src`                                            | D18           |
| One `h1` per route, no skipped levels                                                  | D33, D20      |
| Every icon-only button has an accessible name                                          | D37, D38      |
| No interactive target < 44px at 390                                                    | D36           |
| No seed literals in rendered DOM (`example.com`, `LOCAL_SEED`, `itest-`, `Local demo`) | D8            |
| Every table's last column visible at 1024/1440                                         | D9, D11       |
| Bottom-nav destinations all visible in the mobile More sheet at 390                    | D63           |

---

## Sequencing summary

| Wave | Items   | Theme                | Why first                                                        |
| ---- | ------- | -------------------- | ---------------------------------------------------------------- |
| 1    | D1-D8   | Trust breakers       | A guest cannot book, a host cannot save, and both see false data |
| 2    | D9-D17  | Layout and hierarchy | The page's job is invisible or unreachable                       |
| 3    | D18-D30 | Design system        | Fixes 200+ individual instances at once                          |
| 4    | D31-D39 | Accessibility        | Legal floor and the cheapest quality signal                      |
| 5    | D40-D55 | Flow and content     | Conversion and comprehension                                     |
| 6    | D56-D65 | Polish               | Perceived quality                                                |

Total: 65 design items. Waves 1-2 are ~2 weeks of focused work; the design-system wave is the multiplier
because it removes the per-screen fixes that follow it.
