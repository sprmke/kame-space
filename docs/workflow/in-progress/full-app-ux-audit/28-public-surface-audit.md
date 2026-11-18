---
title: 'Audit 28: public surface audit'
status: active
tags: [audit, marketing, listings, guest, auth, account, mobile]
updated: 2026-11-19
---

# 28: Public surface audit

The pass the earlier phases skipped: the marketing site end to end, every listing surface, the guest
operational flows, auth, the guest account, and the dashboard screens that had never been opened. Every
route captured at 390 and 1440, with 320/768/1024 where the layout changes.

- Ranked issues: [29-issue-register.md](./29-issue-register.md) (machine-readable: `issue-register.json`)
- Route → component file: [route-inventory.md](./route-inventory.md)
- Screenshots and metrics: [`screenshots/public/`](./screenshots/public/) (271 full-page captures + `manifest.json`)

---

## Method

1. **Capture.** 78 routes × up to 5 widths, full-page JPEG, reduced motion, cookie consent declined,
   authenticated where required. Each record in `manifest.json` carries height, h1s, heading skips, text
   length, open dialogs, measured contrast per text node, tap targets under 44px, broken images, unnamed
   controls, horizontal overflow, and controls hidden under the fixed bottom bar.
2. **Functional.** Every nav item, CTA, card, tab, filter, form and footer link exercised. A crawl of 24
   seed pages produced 83 unique internal links; all resolve.
3. **Copy.** 3,230 strings extracted across 36 routes and reviewed for length, tone, duplication,
   consistency and accuracy against the product's own behaviour.
4. **Design.** Judged against `DESIGN.md`, the repo design skills, and the earlier design-system findings
   in [23](./23-design-system-critique.md).

**A note on the contrast numbers.** The measured counts include three false-positive classes that I
checked by hand: (a) white text over a photo, where the detector resolves the card's white background
instead of the image; (b) the active sidebar item, whose fill is a sibling layer; (c) disabled controls
that WCAG exempts. Where a number is quoted below it has been verified against the element. The
`manifest.json` counts are raw.

---

## Coverage

| Group             | Routes | 320     | 390 | 768 | 1024 | 1440 |
| ----------------- | ------ | ------- | --- | --- | ---- | ---- |
| Marketing shell   | 11     | partial | yes | yes | yes  | yes  |
| Host marketing    | 5      | partial | yes | yes | yes  | yes  |
| Listings          | 14     | partial | yes | yes | yes  | yes  |
| Guest operational | 11     | partial | yes | yes | yes  | yes  |
| Auth              | 5      | —       | yes | —   | —    | yes  |
| Guest account     | 9      | partial | yes | yes | yes  | yes  |
| Dashboard gaps    | 18     | —       | yes | —   | —    | yes  |

---

## The seven things that matter

1. **The auth gate is a dead end.** Contact, the booking form and the parking form each open a sign-in
   sheet with two buttons, no close, no guest path; Escape and the backdrop do nothing. The home page
   says "No account needed."
2. **The signed-in guest form pre-fills a different stranger on every load.** Two consecutive loads gave
   different fake identities with `@example.com` addresses while signed in as the demo guest; anonymous
   visitors get an empty form. Both this and the "Developer controls" panel are gated by
   `!import.meta.env.PROD`, so they are a **local and staging** defect, not a production one — but every
   screenshot and QA pass on a dev build is unrepresentative because of them.
3. **A trip link cannot be opened.** The email link lands on "Sign in to see your trip", which tells the
   guest to open the link they just opened; a signed-in guest who did not make the booking gets "Booking
   not found". Anonymous bookings have no way back to their trip.
4. **The map shows Google's error text.** "Oops! Something went wrong. This page didn't load Google Maps
   correctly." on every listing page.
5. **Search results look broken.** "From ₱0 / night", "1 homes available", a 404'd Unsplash image whose
   alt text bleeds across the card, and "Parking in Other".
6. **Four browse pages have no h1 and four host pages have three.** `/search`, `/properties`,
   `/parkings`, `/developments` have none; `/for-hosts` and its variants have three, two of which belong
   to a picture of a dashboard.
7. **The public contact address is a Gmail account**, repeated in the footer, the about page and support.

---

## Global findings

### GL-01 (P0). The auth gate is a dead end

Measured on `/contact`, `/properties/kame-home/form` and `/parkings/monaco-level-2-slot-27/form`: a
`role="dialog"` sheet reading "Log in or sign up" with exactly two controls ("Continue", "Continue with
Google"). No close button, `Escape` leaves it mounted, a backdrop click leaves it mounted. The only exit
is browser Back.

The home page's booking steps say: _"Pick your dates, add your guests and a valid ID. **No account
needed.**"_

[screenshots/public/101-guest-form-auth-wall.png](../screenshots/101-guest-form-auth-wall.png)

### GL-02 (P1). The document outline is broken on the four main browse pages

| Route                                          | Visible h1s                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `/search`                                      | 0                                                                        |
| `/properties`                                  | 0                                                                        |
| `/parkings`                                    | 0                                                                        |
| `/developments`                                | 0                                                                        |
| `/properties/kame-home/calendar`               | 0                                                                        |
| `/account/*`                                   | 0                                                                        |
| `/for-hosts`, `/for-hosts/v2`, `/for-hosts/v3` | 3 each (hero + mock's "Your rentals, run for you." + mock's "Dashboard") |
| `/for-hosts/login`                             | 2 (login card + mock's "Your rentals, run for you.")                     |

The host pages fail because the embedded dashboard mock is real DOM with real `<h1>`s.

### GL-03 (P2). The global nav has ten shapes

An automated comparison across 27 routes found **10 distinct nav link orders** and **4 distinct footer
link sets**. On listing pages the header additionally renders breadcrumbs as nav links; on account pages
the eight-tile strip is appended inside the same `<nav>`. Result: the header cannot be learned, and the
account area ends up with two navigations.

### GL-04 (P2). The public contact address is a Gmail account

`mailto:kameworks.tech@gmail.com` renders in the footer of 20+ routes, twice on `/support`, and in the
"Based in Manila" block on `/about`. `/hosts/kame-homes` additionally publishes
`manager.demo@example.com`.

### GL-05 (P2). Three plans each claim to be the recommended one

`/for-hosts/pricing`: Starter "Best value", Pro "Most popular", Business "Recommended". The carousel also
opens on **Business**, so the first card a visitor sees is the most expensive with a recommendation badge.

### GL-06 (P2). The Free plan advertises a paid capability

Free lists "Finance management" and "Maintenance reminders". The measured tier matrix
([19](./19-dashboard-page-inventory.md)) gates `financeReporting` and `maintenanceReporting` to Starter,
and export returns `upgradeHook: true` on Free.

### GL-07 (P2). "Reviews" in the host nav is inert

`#reviews` does not exist on `/for-hosts`; clicking the nav item leaves `scrollY` at 0 and does not change
the URL hash. `#features` and `#how-it-works` work.

### GL-08 (P2). `/services` is a placeholder in the primary nav

"Coming Soon" with seven chips, a search bar that offers **"Add dates"**, and ~40% dead space above and
below. The nav spends a primary slot on a page that cannot do anything.

### GL-09 (P3). The marketing mock is read as a second product

On `/for-hosts/login`, assistive tech reads: "Property management made simple", "Your rentals, run for
you.", "Dashboard", "Log in or sign up" before reaching the form.

### GL-10 (P3). The internal link graph is clean

83 unique internal links across 24 seeds, all resolving to real content. Recorded so later passes know
routing was checked.

---

## Marketing shell

### Home

Well composed: full-bleed hero with a proper gradient scrim, one headline, one support line, a
Where/When/Who search bar, then a section. 6,214px at 390 and 7,226px at 1440.

- Hero alt text describes a different photo ("Sunlit living room … looking out to the water" for an image
  of three towers over a lagoon pool).
- "Find your next stay, home, or parking" is followed by "Every listing is booked straight with its
  host." — a restatement, and "straight with" is not idiomatic.
- The five-step "How booking works" contradicts the auth wall (GL-01).
- The "Why Kame Space" comparison block is the strongest copy on the site ("The messages you won't have
  to send"); one paragraph there runs 148 characters.
- The listing preview shows one card (`Monaco 2604`, badge "New") in a row built for several.

### Host landing (`/for-hosts`, `/v2`, `/v3`, `/explore-preview`)

- `/for-hosts` is 2,161px at 390 and 2,955px at 1440; `/v2` is **10,070px** and `/v3` **11,069px** at 390
  (13 screens at 1440). Three unlinked variants of one page, each a full build.
- The product-tour mock renders (animated dashboard, chapter chips, 0:06 / 2:52), but its two lower cards
  are empty white panels throughout.
- Claims without proof: "14 connected modules", "24/7 background automation", "AI assisted review".
- The host nav (Features / How It Works / Reviews / Pricing) differs from the guest nav
  (Developments / Properties / Parkings / Services) with only an "Explore" button to cross over.

### Pricing

- 4,021px at 390 and 4,904px at 1440; the phone layout shows one plan at a time with no counter or dots.
- Opens on Business (see GL-05).
- On a phone the CTA sits below ~10 feature bullets.
- `₱1,799 → ₱1,439 · 20% off` is the right pattern; the admin pricing page uses `₱399 · 20% off` with no
  list price.

### About, Contact, Support, legal

- **About:** "Philippine stays, one operating system" is jargon for a property manager; six equal cards
  under "What the platform covers" restate the intro paragraph; the Gmail address appears twice.
- **Contact:** "Send us a message" with four categories. Clicking any category opens the auth sheet
  (GL-01), so an anonymous visitor cannot contact support at all. No email form exists.
- **Support:** 36 answers, no search, the same Gmail address twice. This is the only real help content in
  the product while `/account/help` and the dashboard Guides tab are empty.
- **Terms / Privacy / Cookies:** 6,354 / 7,519 / 2,357px at 390 with no section index or in-page anchors.

### Services and the 404

- `/services`: see GL-08.
- The 404 is well written ("This page wandered off", "Take me home") and keeps the marketing nav.

---

## Listings

### Property detail (`/properties/kame-home`)

The best-designed screen in the product: photo mosaic, breadcrumbs, title + type badge, rating, location
line, facts strip, and a sticky booking card.

- `Hosted by Kame Spa…` truncates mid-word at 390.
- The sticky mobile bar repeats the rating 200px below it.
- The map section shows Google's raw error text (P0 in the register).
- Gallery share/save buttons are 36px.
- 4,668px at 390.

### Parkings

`/parkings` renders one card in a four-column grid with a 404'd image; the card's alt text
("Azure North Residences, Parking slot") draws over the card body, overlapping the "Inside tower" chip,
and the title is "Parking in Other". 916px of page for one item.

### Developments

The only listing family that uses the space well: `/developments/azure-north-residences` has a hero, tower
stats, and cross-links to properties and parking. The list pages still put one card in a wide grid.

### Search

- "From ₱0 / night" on a development card.
- "1 homes available".
- 57 strings total, no h1, and a `Show Filters` control at 36px.

### Host public page (`/hosts/kame-homes`)

- Publishes `manager.demo@example.com` and seed copy ("Local demo host for the canonical seed dataset").
- 2,006px at 390 for one listing.

---

## Guest flows

### Booking form (five steps)

- The auth gate closes the door for anonymous visitors (GL-01).
- Signed in as Demo Guest, the form pre-fills a **different fake identity on each load**
  (Chris C. Garcia, then Lisa F. Johnson; earlier loads gave David H. Jones, Chris A. Miller and
  Chris F. Jones), all with `@example.com` addresses. Anonymous visitors get an empty form.
- Step 1 is 3,629px at 390 because guests 2-4 are expanded with Name / Age / ID.
- Three labels for one step: `Guest Advise Form`, `Guest 1 / 5`, `Guest / Contact & guest details`.
- The progress bar disagrees with its label (25% at "2 / 5", 51% at "3 / 5").
- No summary of property, dates, nights or price on steps 1-4.
- Step 5 shows a downpayment and two transfer cards with no stay total, balance or deadline.
- Check-in and check-out times are editable inputs; they are host policy.
- Dates are `MM/DD/YYYY` here and "Nov 18 – Nov 19, 2026" everywhere else.

### Calendar (`/properties/kame-home/calendar`)

- **Past and booked nights look identical.** 23 of 30 days are disabled (22 past or booked, 1 blocked)
  and render in the same faint grey; only 19-22 and 25-27 are selectable. `aria-label` distinguishes
  them correctly, but visually there is no legend, no booked marker, no minimum stay and no price.
- "Select dates to continue" is disabled with no explanation.
- ~500px of empty space around a 7-column grid that a phone renders at ~44px per cell.

### Success

Without router state the route falls back to the calendar, so a guest who reloads sees availability
instead of a confirmation.

### Trip

- Anonymous: "Sign in to see your trip … Use the email you booked with, **or open the link from your
  booking email.**" The guest is already on that link; there is no resend or reference entry.
- Signed in with the wrong account: "Booking not found … Check the link or sign in with the email you
  booked with."
- The payment block does not reconcile (stay ₱7,000 + deposit ₱2,000, paid ₱5,000, no balance, no refund
  date).
- ~50% of the viewport is empty below the card.

### Stay guide and showcase

Both are long but coherent: 5,155px and 5,193px at 1440. They are the two pages that best explain the
product. Watch the heading order and the repeated "Monaco 2604" at the top of each section.

### Messages

Works (composer, thread, history) but carries the host header inside a guest page and shows 33 targets
under 44px.

### Pay parking

`/properties/kame-home/parking/:bookingId` for an anonymous visitor **redirects to the parkings list**
with no explanation, so the payment link from an email lands on a browse page.

### SD form, guest review, document

- `/sd-form` with a bookingId shows "Form not available. Please use the link from your email or contact us
  on Facebook." — the fallback is a Facebook page.
- `/document` with a non-document token shows "This link is not available." — a clean error state.
- `/guest-review` renders 1,882px with no h1.

---

## Auth

- `/for-hosts/login` and `/for-guests/login` are two different designs: the host login embeds the full
  marketing preview on the right, the guest login embeds a fake listing carousel ("Sunset 1BR Condo /
  Boracay / /night", "Shoreline Studio / La Union", "Bayside Loft / Cebu") with **prices missing**.
- `/for-hosts/register` and `/for-guests/register` redirect into the login page's register tab, so the URL
  and the page title disagree.
- `/accept-invite` renders 0 contrast issues and 0 small targets, but also **no h1** and almost no content
  without a token — a blank page for anyone who trims the query string.

---

## Guest account

- **No h1 on any of the nine pages** (measured 0 across the group).
- Two navigations: an eight-tile strip and a bottom bar containing Trips and Messages again.
- `/account/profile` shows the same data twice: a read-only summary card and an edit form below it.
- `/account/trips` has one broken image.
- `/account/vouchers` has no copy-code affordance and no expiry.
- `/account/help` says "No help topics yet" while `/support` holds 36 answers.
- `/account/tickets` redirects into the first ticket, so a list view does not exist.
- `/account/stays` redirects to Messages and can expose an internal test thread.

---

## Dashboard surfaces opened for the first time

| Surface                           | What it is              | Design problem                                                                                         |
| --------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `/onboarding`                     | host onboarding         | redirects into the dashboard when already onboarded; no visible onboarding state to review             |
| `/verification-rejected`          | verification outcome    | one card, no next step beyond a support link                                                           |
| `/admin/playbook`                 | 17 improvement articles | 75 targets under 44px; long article list with no grouping                                              |
| `/admin/support/faqs`             | FAQ admin               | **121 targets under 44px**; edit/add/publish controls are icon-sized                                   |
| `/admin/health/:section`          | platform health         | tabs inconsistent with AI page (72px vs 62px)                                                          |
| `/admin/ops-reports`              | report list             | 11 contrast fails in a compact table                                                                   |
| `/admin/pricing/payment-settings` | payment config          | 29 small targets; provider cards dense                                                                 |
| `/admin/developments/:slug`       | development detail      | **89 small targets**; every section expanded                                                           |
| property tickets / docs           | help workspace          | tickets 6 contrast fails; docs near-empty                                                              |
| property activity                 | activity log            | redirects into Settings and opens a dialog; 69 raw contrast hits (mostly asterisks and the active nav) |
| property announcements            | list + detail           | detail has no back link                                                                                |
| org team                          | members                 | 21 contrast hits: paused members at 2.26:1, role badges at 2.28:1                                      |
| parking notifications             | module feed             | 4,297 chars of calendar-conflict rows with raw ids                                                     |
| parking announcements             | list                    | same detail dead end                                                                                   |
| public page editor                | showcase editor         | strong screen; 8 h1s from template thumbnails, 106 small targets, sidebar clipped at 900px             |

---

## Page inventory

Heights are CSS px at the given width (full document). "Verdict" is my call on what the page needs.

| Route                                  | 390    | 1440   | h1s | Verdict                                             |
| -------------------------------------- | ------ | ------ | --- | --------------------------------------------------- |
| `/`                                    | 6,214  | 7,226  | 1   | polish (alt text, one restating line, listing row)  |
| `/v2`                                  | 4,783  | 5,559  | 1   | keep as preview, decide one guest landing           |
| `/search`                              | 1,779  | 2,276  | 0   | redesign (h1, one-result layout, broken card)       |
| `/services`                            | 916    | 1,411  | 1   | remove from nav until it ships                      |
| `/about`                               | 1,880  | 1,898  | 1   | polish (hero line, six-card wall, Gmail)            |
| `/contact`                             | 1,036  | 1,427  | 1   | redesign (no guest path, auth dead end)             |
| `/support`                             | 2,690  | 2,831  | 1   | polish + add search                                 |
| `/terms`                               | 6,354  | 5,862  | 1   | add a section index                                 |
| `/privacy`                             | 7,519  | 6,925  | 1   | add a section index                                 |
| `/cookies`                             | 2,357  | 2,773  | 1   | keep                                                |
| 404                                    | 844    | 1,142  | 1   | keep                                                |
| `/for-hosts`                           | 2,161  | 2,955  | 3   | redesign (h1/mock, dead Reviews, empty mock panels) |
| `/for-hosts/pricing`                   | 4,021  | 4,904  | 1   | redesign (carousel, badges, phone CTA)              |
| `/for-hosts/v2`                        | 10,070 | 7,557  | 3   | retire or merge                                     |
| `/for-hosts/v3`                        | 11,069 | 11,749 | 3   | retire or merge                                     |
| `/explore-preview`                     | 5,230  | 4,746  | 1   | retire or merge                                     |
| `/properties`                          | 916    | 2,112  | 0   | redesign (h1, one-result grid)                      |
| `/properties/kame-home`                | 4,668  | 4,675  | 1   | polish (host truncation, map, sticky bar)           |
| `/parkings`                            | 916    | 1,411  | 0   | redesign (broken card, one result)                  |
| `/parkings/monaco-level-2-slot-27`     | 1,021  | 1,612  | 1   | polish                                              |
| `/parkings/…/form`                     | 1,068  | 1,006  | 0   | blocked by auth gate                                |
| `/developments`                        | 916    | 1,525  | 0   | redesign (h1, one-result grid)                      |
| `/developments/azure-north-residences` | 1,746  | 2,395  | 1   | keep                                                |
| `/hosts/kame-homes`                    | 2,006  | 2,532  | 1   | polish (demo email, seed copy)                      |
| `/properties/kame-home/calendar`       | 845    | 1,097  | 0   | redesign (availability state, empty space)          |
| `/properties/kame-home/form`           | 1,142  | 1,089  | 0   | redesign (auth gate, prefill, 5-step length)        |
| `/properties/kame-home/success`        | 845    | 1,097  | 0   | redesign (no state without router)                  |
| `/properties/kame-home/trip`           | 844    | 900    | 1   | redesign (auth wall, receipt)                       |
| stay guide                             | 4,980  | 5,155  | 1   | polish                                              |
| showcase                               | 5,660  | 5,193  | 1   | polish                                              |
| messages                               | 4,668  | 4,675  | 1   | polish (guest header, targets)                      |
| pay parking                            | 916    | 1,411  | 0   | redesign (silent redirect)                          |
| sd form                                | 844    | 900    | 1   | polish (Facebook fallback)                          |
| guest review                           | 1,906  | 1,882  | 0   | polish (h1)                                         |
| document                               | 844    | 900    | 0   | keep (error state)                                  |
| host login                             | 844    | 900    | 2   | polish (mock h1s, guest/host parity)                |
| guest login                            | 1,218  | 900    | 2   | polish (fake carousel, missing prices)              |
| host register                          | 844    | 900    | 2   | fix URL/title mismatch                              |
| guest register                         | 1,218  | 900    | 2   | fix URL/title mismatch                              |
| accept invite                          | 844    | 900    | 0   | add h1 + empty state                                |
| account profile                        | 1,909  | 1,984  | 0   | redesign (h1, dual nav, duplicate data)             |
| account trips                          | 916    | 1,411  | 0   | polish (h1, broken image)                           |
| account messages                       | 844    | 1,411  | 0   | polish (h1)                                         |
| account vouchers                       | 916    | 1,411  | 0   | polish (h1, copy code)                              |
| account reviews                        | 844    | 1,411  | 0   | polish (h1)                                         |
| account favorites                      | 844    | 1,411  | 0   | polish (h1)                                         |
| account tickets                        | 844    | 1,411  | 0   | polish (h1, list view)                              |
| account help                           | 916    | 1,411  | 0   | redesign (reuse support answers)                    |

---

## Copy rewrites (public surface)

| Route                    | Current                                                                    | Proposed                                                            | Why                                           |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| Home                     | "Every listing is booked straight with its host."                          | _(delete)_                                                          | restates the section title and is unidiomatic |
| Home                     | "No account needed."                                                       | remove, or make it true                                             | contradicts the auth gate                     |
| Home                     | hero alt "Sunlit living room … looking out to the water"                   | "Azure North Residences towers above the lagoon pool"               | wrong image description                       |
| About                    | "Philippine stays, one operating system"                                   | "Every stay, one place to run it"                                   | "operating system" is jargon                  |
| About / footer / support | `kameworks.tech@gmail.com`                                                 | `support@kamespace.com`                                             | public product address                        |
| Search                   | "From ₱0 / night"                                                          | hide, or "Price on request"                                         | reads as broken                               |
| Search                   | "1 homes available"                                                        | "1 home available"                                                  | grammar                                       |
| Parkings                 | "Parking in Other"                                                         | "Azure North Residences · Monaco"                                   | "Other" is a fallback value                   |
| Listing                  | "Hosted by Kame Spa…"                                                      | full host name, two lines                                           | truncation in a trust element                 |
| Guest form               | "Guest Advise Form"                                                        | "Guest details"                                                     | internal jargon, misspelled                   |
| Guest form               | "Your GAF will be sent there…"                                             | "Your building registration form is sent there"                     | unexplained acronym                           |
| Trip                     | "Use the email you booked with, or open the link from your booking email." | "Sign in with the email you booked with, or resend your trip link." | the guest is already on the link              |
| SD form                  | "Please use the link from your email or contact us on Facebook."           | "Open the link from your email, or contact support."                | Facebook is not the support channel           |
| Contact                  | "Sign in with your explore account to open a ticket."                      | "Sign in to open a ticket" + "or email us" for guests               | "explore account" is a made-up term           |
| Pricing (Free)           | "Finance management"                                                       | "View bookings and expenses"                                        | overstates the tier                           |
| Pricing badges           | "Best value" / "Most popular" / "Recommended"                              | one badge on one plan                                               | three recommendations cancel out              |
| `/services`              | "Coming Soon"                                                              | remove from nav                                                     | placeholder in a primary slot                 |
| Account help             | "No help topics yet"                                                       | reuse `/support` answers                                            | dead end                                      |

---

## Verification

An independent verifier tried to falsify eighteen parent claims against the live app. Fifteen held. Three
did not, and are corrected here and in the register:

| Claim                                              | Outcome                 | Correction                                                                                                                                                  |
| -------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The guest form pre-fills a stranger for everyone" | partly false            | Only **signed-in** guests, and only on a dev build (`showDevControls = !import.meta.env.PROD`). Anonymous visitors get an empty form.                       |
| "The map shows Google's error"                     | verified, conditionally | The map initialises lazily: the error appears once "Where you'll be" scrolls into view. A DOM read without scrolling finds neither the error nor an iframe. |
| "`/accept-invite` is blank"                        | false as written        | It renders one sentence ("This invitation link is invalid.") with zero links and zero buttons; corrected from "blank" to "dead end with no action".         |

Two agent claims were also re-checked and adjusted:

| Claim                                                  | Outcome                                                                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Header nav overlaps the theme toggle at 1024" (MK-05) | **verified**: "Services" spans x644-702, the toggle x663-707; the moon glyph draws over the word (screenshot `screenshots/public/live/verify-nav-1024.png`). |
| "Mobile property detail hides the gallery" (LG-20)     | **corrected**: it collapses five photos into a single 358×200 frame plus a "5 photos" control. Compressed, not hidden.                                       |

Two findings were re-scoped after reading the source rather than the UI:

- The guest form's random prefill and the "Developer controls" panel both sit behind
  `showDevControls = !import.meta.env.PROD` (`GuestForm.tsx:209,441`), so a production bundle cannot render
  them. They stay in the register as P2 with that note, because they invalidate local QA and staging
  captures.
- `/onboarding` and `/verification-rejected` redirect to the dashboard for an account that is already
  onboarded and verified. The redirect is correct behaviour; what cannot be reviewed from this seed is the
  _rejected_ state, so that finding is scoped as "rejected-verification path unreviewable, and no reason or
  resubmit action is visible from the route".

## What works

- The internal link graph: 83 links, all resolve.
- The 404 page: honest, on-brand, keeps the nav.
- Property detail: the best composition in the product.
- Development detail: the one listing family that uses its width.
- Stay guide and showcase: long but genuinely useful, and the only places the product explains itself well.
- Copy tone: across 3,230 strings, zero AI tells and zero em dashes; the only apology language is
  Google's map error.
- No horizontal overflow at 320 on any of the 11 routes measured.
- Host pricing at `₱1,799 → ₱1,439 · 20% off` shows list price, discount and final price together.

## Gaps

- Payment provider flows (GCash / GoTyme / PayMongo) were not executed; they need a sandbox key.
- Meta publish and channel sync were not exercised.
- The public page editor was reviewed visually, not edited end to end (autosave is covered by 13).
- `/for-hosts/v4` and `/admin/marketing-trends` could not be verified: the dev server is serving stale
  route modules for both. Re-check after a Vite restart.
- Email sending (OTP, guest emails) is not configured locally, so those paths were reviewed by UI only.
