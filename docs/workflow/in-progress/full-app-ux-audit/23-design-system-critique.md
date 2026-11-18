---
title: 'Audit 23: design system critique'
status: active
tags: [audit, design, tokens, typography, contrast, mobile, copy]
updated: 2026-11-18
---

# 23: Design system critique

The parent pass over the design system itself: measured tokens, type scale, contrast, radius, icon sizes,
motion, loading, and copy. This is the foundation the page-level critiques in 24-26 sit on. Every number
below was measured in the running app with Playwright at 320, 390, 768 and 1440, in light and dark.

**Method.** Computed styles sampled across 19-46 routes per viewport; contrast computed against the
resolved background (walking up for the first opaque layer, with gradient fallbacks); tap targets from
`getBoundingClientRect` (pseudo-element hit pads checked by hand so they are not double-counted); copy
extracted from leaf text nodes and scanned for length, AI tells, apologies, exclamation marks and em
dashes.

---

## Verdict

The system is coherent and unusually disciplined for a product this size: one type family, one teal
palette, real focus rings, motion that honours `prefers-reduced-motion`, no horizontal overflow at 320,
and copy that is free of AI tells. What it lacks is **hierarchy discipline**. The same visual weight is
given to a KPI, a section eyebrow, a helper line and a table cell, so pages read as a grid of equal
boxes. The three biggest systemic costs:

1. **A four-tone type scale collapsed into nine sizes**, three of them below the readable floor
   (9/10/11 px), used 700 times in the dashboard alone.
2. **Dark mode was never contrast-audited.** Teal text links drop to 3.1:1 and required-field markers to
   3.4:1.
3. **Mobile keeps desktop furniture.** Stage cards, month grids and page subtitles all survive to 390
   where they cost more than they earn.

---

## 1. Type scale

Measured usage on the property dashboard at 1440 (leaf text nodes):

| Size / weight | Count | What it is                       |
| ------------- | ----- | -------------------------------- |
| 11px / 600    | 44    | uppercase eyebrows, badges, meta |
| 12px / 400    | 35    | secondary lines, helper text     |
| 14px / 500    | 24    | body and labels                  |
| 11px / 500    | 19    | chips, table meta                |
| 10px / 600    | 9     | calendar day letters, pills      |
| 9px / 600     | 7     | `SUN`–`SAT` calendar header      |
| 24px / 700    | 5     | page title                       |

Source-level counts across `ui/src`: **58** `text-[9px]`, **252** `text-[10px]`, **392** `text-[11px]`,
**238** `text-[13px]` — plus the token classes (`text-caption`, `text-meta`, `text-section-title`).
That is not a scale, it is a continuum.

### S1 (P1). Nine-pixel text is unreadable and fails WCAG targets

The calendar header (`SUN`–`SAT`) renders at **9px**, inbox badges and booking-card tags at 10px. 9px
uppercase with letter-spacing is decoration, not information: at arm's length on a phone it is a grey
smudge. DESIGN.md sets the floor at 12px for caption/meta and 14px for body.

**Change:** delete 9px entirely; move calendar day letters to 11px (they are the only 9px case that is
load-bearing) and every badge to 11px minimum. Then reduce the ladder to five steps: 12 (meta), 14
(body), 16 (card title), 18/24 (page title), 30/44 (public display).

### S2 (P1). Eyebrows are implemented as headings, so settings announce everything twice

`PropertyEmailAutomationsSection.tsx:45` renders an uppercase 12px eyebrow as `<h3>`, and the card title
below it is another heading. The measured outline on Settings is:

```
h1 Settings → h3 RECIPIENTS → h3 CHECK-OUT EMAIL → h3 AUTOMATED SENDS → h4 TELEGRAM → h3 Telegram
→ h4 AI SERVICES → h3 AI services
```

A screen reader reads "TELEGRAM, Telegram, AI SERVICES, AI services" and the outline has a skipped
level (h1 → h3). Visually it is also two labels for one thing.

**Change:** eyebrows become `<p>` (or a `<div>` with `aria-hidden`), group titles stay `h2`, card titles
`h3`, and nothing skips a level. Affects 6 settings sections plus the marketing/analytics eyebrows.

### S3 (P2). Type has no ladder, so hierarchy is carried by boxes instead

Because 11px and 14px are used for both labels and values, the page leans on card borders to separate
things. That is why dashboards read as "a wall of equal cards".

**Change:** after S1, enforce one rule: **only two weights per screen region** (500 for labels, 600/700
for values). Section titles 14px/600, card titles 16px/600, KPI values 24px/700, meta 12px/400.

### S4 (P2). Subtitle lines restate the title

Measured duplicates: "Dashboard" + "Overview of your property's performance and activity.", "Finance"

- "Track income and expenses for this property.", "Analytics" + "Track revenue, occupancy, and guest
  trends for this property.", "Bookings" + "Manage and track all bookings for this property.", "Templates"
- "Manage your property's house rules, instructions, and email templates."

Every dashboard page carries one. It is exactly the pattern `ui-minimal-copy` bans, it costs a line of
vertical space on every page, and it says nothing the nav item did not.

**Change:** delete the page subtitle on all dashboard pages. Keep the H1. If a page needs orientation,
put it in the section that needs it.

---

## 2. Colour and contrast

Global tokens are sound (`--muted-foreground` was already tuned to 40% for 4.7:1). Three failures
survive.

### S5 (P1). Dark mode: teal text links and eyebrows fail at 3.1:1

`--primary` is the **fill** token: the tenant's brand colour at 26% lightness (`175 77% 26%` on this
org, rendering `rgb(15,117,109)`). Used as _text_ on a dark card (`#1a1a1a`) it measures **3.1:1**, below
the 4.5 needed at 14px. `--brand-ink` (`175 77% 41%` in dark, `26%` in light) is the text token and is
already defined for exactly this case. Measured on:

| Route              | Node                             | Ratio |
| ------------------ | -------------------------------- | ----- |
| Property dashboard | "View" / "View all (+9 more)" ×5 | 3.1:1 |
| Parking dashboard  | "NEEDS ATTENTION" eyebrow        | 3.1:1 |
| Parking dashboard  | "View"                           | 3.1:1 |

[screenshots/94](./screenshots/94-dark-mode-link-contrast.png)

`--brand-ink` (168 65% 60% in dark, 26% in light) exists for exactly this and is not used here.

**Change:** any `text-primary` used as **text** becomes `text-brand-ink`; keep `text-primary` only for
icons that sit next to a label. Add a `textOnBrandFill`-style unit guard for dark text pairs, mirroring
`src/lib/theme/textOnBrandFill.test.ts`.

### S6 (P2). Required-field asterisks fail in both themes

The red `*` renders `rgb(239,67,67)` → **3.8:1** on white and `rgb(207,48,48)` → **3.4:1** on the dark
card. Measured on the guest form (15 nodes) and Settings (19-21 nodes).

**Change:** use `--destructive` at 45% lightness for the marker (or pair the asterisk with the word
"required" once per form). Decorative or not, it is the only signal that a field is mandatory.

### S7 (P2). Admin badges use raw palette colours that fail on white

`/admin` shows "Organizations" in teal at **2.5:1** and "Subscriptions" in sky at **2.8:1** — 12px text
on white. These are `text-teal-500` / `text-sky-500`-style utilities rather than tokens.

**Change:** route every badge through the semantic pair (`--success`, `--info`, `--warning` with their
`-foreground`), which are already contrast-checked.

### S8 (P3). The chart palette drifts from the brand

`--chart-4` is **violet 280°** and `--chart-5` **pink 340°** in a system whose only accent is teal 168°
plus a warning amber. On the property Breakdown donut the violet and pink slices are the loudest thing
on the page and read as a different brand.

**Change:** rebuild the chart ramp inside the brand hue (168/180/196 for cool, 43 amber for the
exception), or keep purple only for a semantic "other".

---

## 3. Radius, shadow, icons

Measured at 1440:

| Token       | Declared                   | Actually rendered             | Drift                          |
| ----------- | -------------------------- | ----------------------------- | ------------------------------ |
| Card radius | `--radius: 0.75rem` (12px) | **14px** ×52 on the dashboard | token not used by cards        |
| Other radii | —                          | 10px ×14, 12px ×12, 16px ×6   | four card radii                |
| Shadows     | 3 named tokens             | 3 real + 1 stray white ring   | a white `0 0 0 0` shadow leaks |
| Icon sizes  | —                          | 12, 14, 16, 20 px             | four sizes in one viewport     |

### S9 (P2). Four card radii and four icon sizes

14px cards sit next to 10px inputs and 12px panels. Icons appear at 12, 14, 16 and 20px in the same
column (measured 26 at 20px, 22 at 12px, 10 at 14px, 9 at 16px on one dashboard).

**Change:** two radii (14px surfaces, 10px controls, pills full), and two icon sizes (16px inline,
20px in nav and stat cards). Set `--radius` to 14px so the token matches reality.

### S10 (P3). One component renders a white shadow

A `rgb(255,255,255) 0 0 0 0` box-shadow appears on both the dashboard and admin: harmless today, a halo
on any tinted surface tomorrow.

**Change:** remove the stray `shadow-[...]` utility.

---

## 4. Mobile ergonomics

### S11 (P1). The primary action hides behind a 36×36 icon menu

At 390, page actions collapse into a single unlabeled icon button:

| Route       | Header affordances                           | Primary action                           |
| ----------- | -------------------------------------------- | ---------------------------------------- |
| Finance     | "Finance actions" 36×36                      | **Add Transaction** only inside the menu |
| Maintenance | "Maintenance actions" 36×36                  | **Add reminder** only inside             |
| Bookings    | "Import bookings" 36×36, "New booking" 36×36 | New booking is an icon                   |
| Team        | "Invite member" 36×36                        | Invite is an icon                        |

Adding a transaction is the main job on Finance. A 36px glyph (also under the 44px target) is the only
door to it. The pattern is right for secondary actions and wrong for the page's one job.

**Change:** keep one labelled primary (`native-cta`, 44-48px) in the header and move the rest into the
overflow menu. Use the existing `ContextualActionBar` for the mobile primary where the page already has
one.

### S12 (P1). The property dashboard month grid is unusable at 390

Booking pills collapse to three characters: `• R…`, `• S…`, `• T…` (screenshot evidence in 24). The
grid also consumes ~40% of the first screen above the fold, pushing KPIs and cash flow down.

[screenshots/89](./screenshots/89-mobile-dashboard-calendar-pills.png)

**Change (mobile only):** replace the month grid with a 3-day agenda list ("Today", "Tomorrow", "Wed")
or a compact week strip; put the full grid behind "Open calendar". This is a **remove on mobile**
candidate, not a resize.

### S13 (P1). Bookings spends the first screen on four empty stage cards

At 390 the 2×2 stage grid (Action Required 5, Pending Docs 0, Confirmed Stays 1, History 0) fills ~180px
before the search field. Zero-valued cards earn the same space as the one that matters.

[screenshots/90](./screenshots/90-mobile-bookings-stage-cards.png)

**Change:** one horizontal scroll row of filter chips with counts, or a single line "5 need action · 1
confirmed". Hide zero-count stages behind "More". Then the search field is above the fold.

### S14 (P2). The guest form carries host chrome and says the same thing three times

At 390 the form shows a **dark-mode toggle** and an account avatar in the guest header, then three labels
for one step: `Guest Advise Form` (title), `Guest 1/5` (step), `Guest / Contact & guest details` (card).

[screenshots/91](./screenshots/91-guest-form-redundant-labels.png)

**Change:** remove the theme toggle and avatar from guest flows (guests are not account holders here);
keep the step label; delete the card header and let the fields start under the progress bar. Rename
"Guest Advise Form" to "Guest details" — "advise" reads like a verb and is not what the form does.

### S15 (P2). Listing host name truncates mid-word

`Hosted by Kame Spa…` at 390, next to a "Contact host" button. The host is the trust anchor on this page.

[screenshots/92](./screenshots/92-listing-host-truncated.png)

**Change:** allow two lines, or show the org name at 14px/600 and the trust line beneath.

### S16 (P2). Listing repeats the rating in the sticky bar

The bar reads `₱4,500 / night` + `4.5 ★ · 10 reviews`, 200px after the same rating in the header.

**Change:** sticky bar keeps price + Reserve only; add "total for N nights" when dates are chosen.

### S17 (P3). Tap targets below 44px

Measured (excluding pseudo-element hit pads, which correctly pass — `InfoHint` is 24×24 visual with a
52px-tall pad):

- Calendar day cells **40×40** (390).
- Hero action icons **36×36** (listing share/heart, dashboard workspace switch, mobile page actions).
- Inputs at **40px** height on mobile settings (DESIGN.md allows 40; native is 44).

**Change:** calendar cells and hero icons to 44px visual on touch.

---

## 5. Copy

The copy audit across 46 routes found **zero** AI-tell phrases, zero apologies ("Oops", "Something went
wrong") in normal states, one exclamation mark (a mock chat bubble on the home page), and zero em
dashes. That is a genuine pass. The issues are structural rather than tonal.

### S18 (P2). Page subtitles and eyebrows are the main redundancy (see S4, S2)

### S19 (P2). Raw values leak into prose

- Parking pricing prints a full URL as body text:
  `http://localhost:5173/parkings/monaco-level-2-slot-27/form?dl=8cec…` — wraps to four lines on a phone.
  **Change:** show `kamespace.com/p/…` truncated with a copy button.
- Notifications feed prints internal ids in the message: `itest-f4a390de: 2 imported reservations…`
  (15 such strings on one page). **Change:** hide the id, or show it only in the detail.
- Parking settings say "Telegram 0 of 2 channels configured" as a button that goes nowhere.

### S20 (P2). Hero alt text does not match the image

Home hero image `hero-day.jpg` (three towers, pool, slides) has alt
"Sunlit living room in a Kame Space stay, looking out to the water". Wrong description for a real photo.

**Change:** "Azure North Residences towers above the lagoon pool".

### S21 (P3). Money and date formats differ by surface

Inputs are unformatted (`4500`), read-only values are `₱4,500.00`, finance rows use `Nov 3, 2026`,
money inputs in the transaction wizard use `MM/DD/YYYY` for the date field. One product, three date
formats and two money formats.

**Change:** one formatter pair (`formatMoney`, `formatDateLong`) and one input mask for money.

### S22 (P3). Admin mixes currencies

`/admin` shows `AI spend $1.13` in a row of PHP-denominated cards. Either convert with the rate shown or
label the unit next to the value.

[screenshots/93](./screenshots/93-admin-twelve-cards-usd.png)

---

## 6. Motion, loading, and state

| Check                      | Result                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prefers-reduced-motion`   | **Pass.** Transitions drop from 0.5s to 0.001s and animations from 9 to 0.                                                        |
| Layout-matched skeletons   | **Pass on the routes checked** (finance, bookings, property dashboard, admin): ~30 `.animate-pulse` blocks appear before content. |
| Blank first frame          | **Fail (minor).** ~270ms of empty body before any paint, then skeleton at ~700-880ms.                                             |
| Spinner fallbacks          | 126 files import `Loader2`; only 3 literal "Loading" strings, so spinners are mostly in-button.                                   |
| Horizontal overflow at 320 | **Pass.** 8 routes measured, all `scrollWidth - clientWidth = 0`.                                                                 |
| Focus rings                | **Pass.** `focus-visible:ring-*` present on sampled controls; no bare `outline-none`.                                             |
| Icon-only buttons          | **Pass.** 1 unnamed button found across 19 routes (listing page), 0 elsewhere.                                                    |

### S23 (P3). No shell before JS boots

`index.html` paints nothing until React mounts, so a cold load is a white flash for ~0.3s and then a
skeleton. Cheap win: a teal brand block or the last-painted shell in `index.html`.

---

## 7. Interaction and accessibility

Measured on the guest form, property dashboard, bookings, settings and a booking dialog.

### S24 (P1). Form errors are visible but not announced

On the guest form, submitting with a bad field shows "Enter a valid email address" in the page, but:

- `aria-invalid` count: **0**
- `aria-describedby` on inputs: **0**

So the message is not associated with the field and a screen reader user tabbing the form hears nothing
wrong until they hit the live region. The same field components are used in the admin forms.

**Change:** every field sets `aria-invalid` and `aria-describedby` pointing at its error node; the error
node gets `role="alert"`. This is one change in the shared field wrapper, not per form.

### S25 (P2). No skip link anywhere

`a[href^="#"]` as the first focusable element: absent on home, dashboard, bookings and settings. The admin
sidebar has ~25 links before the content.

**Change:** add a `sr-only focus:not-sr-only` skip link to the layout shells (admin and public).

### S26 (P3). Dialog focus does not return to the trigger

Opening New booking, pressing Escape closes it, but focus lands on the workspace switcher instead of the
button that opened it. `aria-modal` is also absent on the `role="dialog"` node (Radix hides 103 outside
nodes and locks scroll, so it mostly works).

**Change:** restore focus to the trigger on close, and set `aria-modal`.

### S27 (P3). Toasts announce, but the region is not named

`[role=status]` and `SECTION[polite]` exist (so Sonner-style toasts do announce). No `aria-label` on the
region, so a screen reader says "polite region" with no context.

**Change:** label the live region "Notifications".

---

## 8. What the system gets right (do not regress)

- One type family (Plus Jakarta Sans) across 1,130 leaf nodes on a page; no fallback leakage.
- Semantic colour tokens with a documented `--primary-strong` / `--brand-ink` split, plus a unit test
  that fails on white-on-`bg-primary`.
- Three shadow tokens, used consistently; no neon stacks.
- Breakpoint discipline: 320/390/768/1024/1440 all measured clean.
- Copy free of AI tells, em dashes, and apology language.
- Reduced motion honoured globally.

---

## Change list (design system)

| #   | Change                                                                    | Where                                        | Effort |
| --- | ------------------------------------------------------------------------- | -------------------------------------------- | ------ |
| 1   | Delete 9px; floor metadata at 11px and body at 14px                       | `text-[9px]` (58), `text-[10px]` (252)       | M      |
| 2   | Eyebrows become `<p>`, not headings; fix the h1→h3 skip                   | settings, marketing, analytics               | S      |
| 3   | Delete dashboard page subtitles                                           | all `/org/**` pages                          | S      |
| 4   | `text-primary` → `text-brand-ink` for text; add a dark contrast guard     | dashboard links, parking eyebrow             | S      |
| 5   | Darken the required-field marker in both themes                           | shared field label                           | S      |
| 6   | Route admin badges through semantic tokens                                | `/admin`                                     | S      |
| 7   | Rebuild the chart ramp inside the brand hue                               | `--chart-4/5`                                | M      |
| 8   | Two radii (14 surfaces / 10 controls), `--radius: 14px`                   | tokens + card/panel classes                  | M      |
| 9   | Two icon sizes (16 inline / 20 nav-stat)                                  | shared icons                                 | M      |
| 10  | One labelled mobile primary action per page                               | finance, maintenance, team, bookings headers | M      |
| 11  | Remove the month grid on mobile (agenda instead)                          | property dashboard                           | M      |
| 12  | Stage cards become a chip row on mobile                                   | bookings                                     | S      |
| 13  | Remove theme toggle + avatar from guest flows; rename "Guest Advise Form" | guest form header                            | S      |
| 14  | Host name wraps; sticky bar drops the duplicate rating                    | listing detail                               | S      |
| 15  | 44px calendar cells and hero icons                                        | calendar, listing, dashboard hero            | S      |
| 16  | Truncate + copy for the parking booking URL; hide `itest-*` ids           | parking pricing, notifications               | S      |
| 17  | Correct the hero alt text                                                 | home                                         | S      |
| 18  | One money/date formatter pair                                             | finance, pricing, maintenance                | M      |

---

## Coverage

| Viewport | Routes measured | Text nodes checked | Contrast nodes | Targets       |
| -------- | --------------- | ------------------ | -------------- | ------------- |
| 320      | 8               | —                  | —              | overflow only |
| 390      | 14              | 1,829              | 1,829          | 350           |
| 768      | 14              | 1,918              | 1,918          | 344           |
| 1440     | 17              | 2,222              | 2,222          | 553           |

Themes: light and dark on 5 dashboard/admin routes. Motion: `no-preference` vs `reduce`. Copy: 46 routes,
3,300 strings.
