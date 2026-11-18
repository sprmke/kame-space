---
title: 'Audit 24: public site and guest flow design critique'
status: active
tags: [audit, design, public, guest, mobile, copy]
updated: 2026-11-18
---

# 24: Public site and guest flow design critique

Design pass over the marketing site, listing and development pages, the guest booking flow, the guest
account and the transactional guest pages. 390, 768 and 1440.

Raw designer notes (page-by-page, 889 lines, 40 routes): `/tmp/audit/findings-design-public.md`,
captures `/tmp/audit/design-public/` (137 files). Everything below was re-verified in the running app
before being kept; one claim from the raw notes was retracted (see the end).

---

## Critical problems

### P24-1 (P0). The booking form is behind a sign-in sheet you cannot dismiss, and the home page says the opposite

`/properties/kame-home/form` opens a **"Log in or sign up"** bottom sheet over a blurred form. There is no
close button, no "continue as guest", and **Escape does not dismiss it** (verified: the dialog stays
mounted). The only exit is browser Back.

The home page's "How booking works" step 1 reads: _"Pick your dates, add your guests and a valid ID. **No
account needed.**"_

That is the highest-intent moment in the funnel, and it contradicts the promise that got the guest there.

[screenshots/101](./screenshots/101-guest-form-auth-wall.png)

[screenshots/101](./screenshots/101-guest-form-auth-wall.png)

**Change:** either let guests book without an account, or make the sheet dismissible with a stated reason
("Sign in to keep your booking and messages in one place" + "Continue as guest"). Then fix the home copy
to match whichever is true.

### P24-2 (P0). The guest form pre-fills a different stranger on every load

Signed in as `guest.demo@example.com` (profile "Demo Guest"), the form arrives filled with someone else's
details. Two consecutive loads produced **David H. Jones / davidhjones@example.com / 09198831018** and
**Chris A. Miller / chrisamiller@example.com / 09939990143**; an earlier pass got a third (Chris F.
Jones). All `@example.com`, all fake phone numbers, all different.

The form says it will send the GAF to that address, which cannot receive mail. A guest sees another
person's identity in their own booking form.

**Change:** this is the dev "random prefill" escaping into a guest-visible form. Key any prefill to the
signed-in account (email from session, never a fixture) and gate fixture identity behind a dev-only flag
that cannot render in a production build.

### P24-3 (P1). The map shows Google's raw error text to guests

`/properties/kame-home` → "Where you'll be" renders
**"Oops! Something went wrong. This page didn't load Google Maps correctly. See the JavaScript console for
technical details."** with Google's broken error icon. No static fallback, no address-first layout.

The parking listing has no location visual at all, on the page where "which building, which level, which
slot" is the whole decision.

[screenshots/102](./screenshots/102-listing-map-error.png)

**Change:** a static map image with a pin plus "Exact location shared after booking", and an address
block. Never surface the provider's error string.

### P24-4 (P1). Search results look broken

On `/search`:

- **"From ₱0 / night"** on a development card.
- **"1 homes available"** (grammar, and a plural unit over one item).
- The parking card's image 404s (`images.unsplash.com/photo-1590674899484…` → `naturalWidth: 0`), so the
  browser's broken-image glyph renders and the alt text **"Azure North Residences, Parking slot"** bleeds
  across the card, overlapping the "Inside tower" chip.

On `/parkings` the single result is titled **"Parking in Other"**.

**Change:** a fallback image component (branded placeholder, never a broken glyph), a formatter that hides
a zero price instead of printing ₱0, singular/plural handling, and a real location label instead of
"Other".

### P24-5 (P1). The booking summary never reconciles, and nobody can tell what they owe

`/properties/kame-home/trip`: **Stay ₱7,000.00**, **Security deposit ₱2,000.00 / Refund pending**,
**You paid ₱5,000.00**. 7,000 + 2,000 ≠ 5,000. Nothing is labelled balance due, and the refund has no
amount and no date.

**Change:** one receipt block: stay total, deposit (refundable, with the refund window), paid, balance due,
and the next payment date. If the deposit is held separately, say so explicitly.

### P24-6 (P1). The form's sticky bar covers the option the guest needs

On steps 3 (Parking) and 4 (Pets) at 390 the white Continue/Back bar sits on top of the second radio:
"Yes, reserve paid parking" is cut in half and "Yes, I'm bringing a pet" is almost entirely hidden. There
is no bottom padding to clear the sticky bar.

**Change:** `pb-[calc(5.5rem+env(safe-area-inset-bottom))]` on every step with a sticky bar, verified by
scrolling to the last option at 390.

---

## Page-level critique

### Home (`/`)

**First impression:** confident. Full-bleed hero photo, one headline, one line of support, a search bar
with Where/When/Who, then a section title. The hero has a proper scrim (base + copy radial), so white type
holds over any crop.

- Hero alt text describes a different photo: `hero-day.jpg` is three towers over a lagoon pool, alt reads
  "Sunlit living room in a Kame Space stay, looking out to the water".
- Below the hero, "Find your next stay, home, or parking" is followed by a one-line restatement
  ("Every listing is booked straight with its host.") and then three segments carrying counts (`Stays 1`,
  `Residences 1`, `Parking 1`).
- 6,274px at 390 / 7,226px at 1440: the page is long enough that the "How booking works" promise is four
  screens from the booking button that breaks it.
- Mobile bottom nav (Explore / Trips / Messages / Account / More) is correct and stays out of the way.

**Change:** fix the alt text; delete the section subtitle; keep counts only when > 1.

### `/for-hosts`

**First impression:** the strongest marketing page in the product. Real headline, real CTA pair
(`Start free` / `Watch product tour`), restrained gradient.

- The product-tour block is an animated dashboard mock with a caption, chapter chips and a 0:06 / 2:52
  scrubber. **It renders**, but the mock's two lower cards are blank white rectangles throughout the
  Chapters, so the tour shows a dashboard with empty panels.

[screenshots/103](./screenshots/103-host-tour-mock.png)

- The page is 2,161px at 390 and 2,955px at 1440, with a large empty band between the tour and the next
  section.
- `/for-hosts/v2` and `/for-hosts/v3` also ship (10,070px and 11,069px at 390). Three live variants of the
  same page is a maintenance and analytics problem.

**Change:** fill or remove the mock's blank panels; pick one host page and redirect the other two.

### `/for-hosts/pricing`

- The plan carousel opens on **Business** (plan 2 of 5) with no dots, no "1 of 5", and no way to see that
  Free and Starter exist without swiping.

[screenshots/104](./screenshots/104-pricing-carousel-opens-on-business.png)

- On a phone the card's CTA is below ~10 feature bullets, so the button that matters is off-screen.
- Pricing at 390 is 4,021px; at 1440, 4,904px.
- `₱1,799 → ₱1,439 /month · 20% off`: good, this is the pattern the admin pricing page should copy.

**Change:** open on Free, add a counter/dots, and pin the CTA to the card (sticky within the card) so it is
reachable at any scroll position.

### Listing detail (`/properties/kame-home`)

**First impression:** the best-designed screen in the app. Photo mosaic, breadcrumbs, title with type
badge, rating, location line, a facts strip, and a sticky booking card.

- `Hosted by Kame Spa…` truncates mid-word at 390 (the host is the trust anchor).
- The sticky mobile bar repeats the rating that is 200px above it.
- The map section shows Google's error (P24-3).
- The gallery's share/heart buttons are 36px.

### Search, list and development pages

- `/search` 1,779px at 390 with a four-column grid that holds **one card**, so a single result floats in a
  void at 1440.
- `/properties`, `/parkings`, `/developments` and their sub-pages repeat the pattern: one result in a
  multi-column grid, no filter affordance on phone beyond a 36px `Show Filters` target.
- `/developments/azure-north-residences` is the one page that uses the space well (hero, tower stats,
  cross-links to properties and parking).

**Change:** a one-item grid should stretch or switch to a horizontal "featured" layout; never render a
single card in a 4-up grid.

### Calendar (`/properties/kame-home/calendar`)

- 31 disabled-looking day cells with a 260px empty teal band above them; no legend, no minimum-stay hint,
  no price preview on selection.

### Guest form (`/properties/kame-home/form`), all five steps

**First impression:** the teal band with the property photo and the circular thumbnail overlap is nice.
Then three labels for one step (`Guest Advise Form`, `Guest 1 / 5`, `Guest / Contact & guest details`) and
the first field at y≈391.

- Step 1 is **3,146px at 390** (3.7 screens) because guests 2, 3 and 4 are expanded with Name / Age / ID
  each. Most bookings have one known guest at that moment.
- The progress bar contradicts the label: at "2 / 5" it fills ~25%, at "3 / 5" ~51%. On the trip page
  "Step 5 of 5" shows an unfilled fifth segment.
- No booking summary anywhere on steps 1-4, so the guest cannot see the property, dates, nights or price
  while filling in IDs.
- Step 5 (Payment) shows "Downpayment ₱2,000 / Total due now ₱2,000" and two transfer cards, with no stay
  total, no balance, no deadline.
- Dates are `MM/DD/YYYY` ("12/11/2026") while the rest of the product uses "Nov 18 – Nov 19, 2026".
- Check-in and check-out **times are editable inputs** in the Stay step; that is host policy.
- "Guest Advise Form" (a misspelling of GAF) is the page heading on all five steps, and "GAF" appears
  unexplained in helper text.
- A "Continue where you left off? Saved 11/18/2026, 7:03:28 PM" toast floats over the header on load.
- The uploaded-ID preview is a mint rectangle with `Guest4 Valid Id 2027-11-16 08:00:26` (filename +
  timestamp), not the image.

**Change list:** collapse guests 2-4 behind "Add another guest"; add a compact summary bar
(property · dates · nights · price) to every step; make the progress maths `step/total`; one label per
step; read-only times; one date format; rename to "Guest details"; show the actual ID thumbnail.

### Success, trip, stay guide, showcase, SD form, review, document

- **`/success` has no success state.** Without router state the route falls back to the availability
  calendar, so a guest who bookmarks or reloads sees a calendar, not a confirmation.
- Trip: the payment block does not reconcile (P24-5); trip thumbnails are broken images.
- Stay guide and showcase are long but coherent; showcase is 5,660px at 390.
- SD form and guest review are single-screen and clean.

### Guest account

| Route               | Problem                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| all                 | **No `<h1>` on any account page** (measured: zero headings level 1), so the outline starts at h2 and a screen reader gets no page title                                   |
| all                 | Two navigations: an 8-tile strip (Profile / Trips / Reviews / Messages / Vouchers / Favorites / Tickets / Help) **plus** a bottom bar containing Trips and Messages again |
| `/account/profile`  | The same data twice: a read-only summary card (avatar, name, email, location, phone, bio) and then an edit form with Display name and Bio below it                        |
| `/account/stays`    | Redirects to Messages and exposes an internal thread titled **"AUDIT-MESSAGE please ignore"**                                                                             |
| `/account/help`     | "No help topics yet" while `/support` holds 36 answers                                                                                                                    |
| `/account/tickets`  | Redirects straight into the first ticket; the list view does not exist                                                                                                    |
| `/account/vouchers` | No copy-code affordance and no expiry on the card                                                                                                                         |

**Change:** one h1 per page, one navigation (4 tiles + More), a collapsed profile header with an Edit
button, and reuse the `/support` content in `/account/help`.

[screenshots/105](./screenshots/105-account-profile-duplicate-nav.png)

### Public legal and support

- `/support` is well written but has **no search**, and its answers are the only real help content in the
  product (36 entries) while `/account/help` and the dashboard Guides tab are empty.
- `/terms` and `/privacy` are 6,354px and 7,519px on a phone with no section index.

---

## Mobile change list

| Route             | Remove                                                               | Merge                                            | Move                                                             |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Home              | section subtitle, `Stays 1 / Residences 1 / Parking 1` counts when 1 | —                                                | booking steps → one collapsible card                             |
| Listing detail    | duplicate rating in the sticky bar                                   | share + save into one overflow                   | host name → two lines                                            |
| Calendar          | 260px teal band above the grid                                       | legend into the header                           | minimum-stay + price preview under the grid                      |
| Guest form        | theme toggle + account avatar in the guest header                    | 3 step labels → 1                                | progress bar under the step label; guests 2-4 behind "Add guest" |
| Guest form step 5 | transfer instructions duplicated on both cards                       | stay total + balance + deadline into one receipt | —                                                                |
| Trip              | —                                                                    | payment block → one receipt                      | refund window into the deposit line                              |
| Account           | 4 of the 8 tiles (duplicates the bottom bar)                         | profile summary + form                           | Edit into the header                                             |
| Search            | `Show Filters` 36px row                                              | filters into the existing sheet                  | —                                                                |
| Pricing           | feature bullet list on phone                                         | CTA pinned in the card                           | plan indicator (1 of 5)                                          |

---

## Copy rewrites

| Route      | Current                                                                    | Proposed                                                  | Why                                 |
| ---------- | -------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------- |
| Home       | "Every listing is booked straight with its host."                          | _(delete)_                                                | restates the section title          |
| Home       | "No account needed."                                                       | match reality, or remove until true                       | contradicts the auth wall           |
| Search     | "From ₱0 / night"                                                          | _(hide)_ or "Price on request"                            | zero price reads as broken          |
| Search     | "1 homes available"                                                        | "1 home available"                                        | grammar                             |
| Parkings   | "Parking in Other"                                                         | "Azure North Residences · Monaco"                         | "Other" is a fallback value leaking |
| Listing    | "Hosted by Kame Spa…"                                                      | full host name, two lines                                 | truncation in a trust element       |
| Guest form | "Guest Advise Form"                                                        | "Guest details"                                           | internal jargon, misspelled         |
| Guest form | "Your GAF will be sent there…"                                             | "Your building registration form is sent there"           | unexplained acronym                 |
| Guest form | "Continue where you left off? Saved 11/18/2026, 7:03:28 PM"                | "Resume your booking? Saved 2 minutes ago"                | machine timestamp                   |
| Success    | _(falls back to calendar)_                                                 | "Booking requested. Check your email for next steps."     | there is no success state           |
| Trip       | "Security deposit ₱2,000.00 / Refund pending"                              | "Deposit ₱2,000.00 · refunded within 7 days of check-out" | no amount or date                   |
| Account    | "No help topics yet"                                                       | reuse `/support` answers                                  | dead end                            |
| Map        | "Oops! Something went wrong. This page didn't load Google Maps correctly." | "Map unavailable. Exact location shared after booking."   | provider error shown to guests      |

---

## Cross-page issues

1. **One card in a four-column grid** on every listing surface.
2. **No h1** on the account area; two h1 elements in the DOM elsewhere (one per breakpoint) — harmless, but
   the published outline is inconsistent.
3. **Three date formats** in guest-facing copy: `12/11/2026`, `Nov 18 – Nov 19, 2026`, `November 2026`.
4. **Seed strings reach guests**: `@example.com` identities in the form, `AUDIT-MESSAGE please ignore` in
   Messages, `seed-owner` and "Local demo host for the canonical seed dataset" on `/hosts/kame-homes`, a
   `LOCAL_SEED` badge on booking detail.
5. **Pricing surfaces disagree**: the public pricing page uses `₱1,799 → ₱1,439 · 20% off`, the admin
   pricing page uses `₱399 · 20% off` with no list price.
6. **Accessibility floor**: no skip link on any public page, `Show Filters` 36px, filter chips 34px,
   `SAVE 20%` chip measured at **2.09:1**.

---

## Top 20 by impact

| #   | Change                                                                                        |
| --- | --------------------------------------------------------------------------------------------- |
| 1   | Remove the auth wall from booking, or make it dismissible with a reason                       |
| 2   | Never render a guest-visible prefill that is not the signed-in account                        |
| 3   | Replace the broken map with a static map + address fallback                                   |
| 4   | Fix the sticky-bar overlap on form steps 3-5                                                  |
| 5   | Make the trip and step-5 payment blocks reconcile                                             |
| 6   | Fix broken listing images, ₱0 prices, "1 homes", "Parking in Other"                           |
| 7   | Add a booking summary to every form step                                                      |
| 8   | One progress component so "2/5" matches its fill                                              |
| 9   | Collapse guests 2-4 on form step 1                                                            |
| 10  | One-item grids: stretch or feature, never a 4-up void                                         |
| 11  | Give `/search`, `/properties`, `/parkings`, `/developments`, `/account/*` a real h1           |
| 12  | Reuse `/support` answers in `/account/help`                                                   |
| 13  | One listing card component everywhere                                                         |
| 14  | Phone pricing: one plan at a time, monthly/annual, open on Free, CTA pinned                   |
| 15  | Calendar: legend, minimum stay, price preview, remove the 260px band                          |
| 16  | Purge seed and internal strings from guest and public routes                                  |
| 17  | Deduplicate actions and facts (one Leave a review, one set of check-in facts)                 |
| 18  | Fix the review histogram and trip thumbnails                                                  |
| 19  | Trim marketing pages: dead bands, the 420vh pin, three host-landing variants                  |
| 20  | Accessibility floor: skip link, brand focus ring, alt text, 12px minimum, 4.5:1, 44px targets |

---

## Retracted

The raw notes reported that the `/for-hosts` product-tour visual renders blank (a 1425×1600 canvas
painting white). Re-verified: the tour **does** render (animated dashboard mock, caption, chapter chips,
0:06 / 2:52 scrubber; the canvas has real non-white content). What is true is narrower: the mock's two
lower cards are empty white panels throughout the animation. Kept as a polish item (fill or remove those
panels, ship a poster frame), not a P0.

---

## Coverage

| Group                           | Routes | 390 | 768     | 1440 |
| ------------------------------- | ------ | --- | ------- | ---- |
| Public marketing                | 14     | yes | partial | yes  |
| Listing / development / parking | 9      | yes | partial | yes  |
| Guest booking + transactional   | 10     | yes | partial | yes  |
| Guest account                   | 9      | yes | —       | yes  |
| Auth / legal / 404              | 7      | yes | —       | yes  |

Metrics: page height in screens, above-fold content, contrast (with opacity blending), tap targets,
heading outline, image load status, sticky-bar overlap, and copy length.
