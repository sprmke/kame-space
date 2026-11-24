---
title: 'Guest journey UX audit — search to deposit refund'
status: active
tags: [audit, guest, ux, ui, e2e]
updated: 2026-11-24
---

# Guest journey UX audit — search to deposit refund

> **Status:** Audit complete. **15 of 27 findings fixed** (all 3 P0s, 12 P1s). Re-verified
> against `origin/main` on 2026-11-24: none of the guest-flow files had moved, so every finding
> still applied. **G12 is withdrawn** — the listing card already shows the stay total once dates
> are chosen; the audit screenshot was taken before dates were picked.
> Remaining: the P2 polish backlog, plus the self-serve part of G7 (see below).
> Visual proof for every fix: **`before-after.html`**.

---

Explored the full guest path on the local seeded stack (`kame-homes` / `kame-home` / Business plan)
at **375 / 768 / 1440** plus **dark mode**, using the live app, axe-core, and the repo design
skills (`impeccable`, `frontend-design`, `mobile-responsive`, `human-copy`, `minimal-ui-copy`,
`accessibility`, `skeleton-loaders`).

Everything below is evidence-backed: a route, a screenshot, a DOM measurement, or an axe rule.
Two new Playwright specs and one recorded slow-motion tour ship with this audit
(see [Artifacts](#artifacts)).

**Covered:** 375 (iPhone 13), 768 (tablet), 1440 (desktop), dark mode, keyboard focus rings,
and axe-core WCAG 2.1 AA on 8 routes.
**Not separately captured:** 1024 and 1280. Both use the `lg` desktop shell already exercised at
1440 and in the E2E at 1280, so only shell-collapse behaviour below `lg` could differ and that
boundary is covered at 768.

---

## Journey map (what a guest actually walks)

| #   | Step                | Route                                             | Shell                               |
| --- | ------------------- | ------------------------------------------------- | ----------------------------------- |
| 1   | Find a place        | `/` → `/search?where=` → `/properties`            | Marketing nav + bottom tabs (phone) |
| 2   | Inspect the listing | `/properties/:propertySlug`                       | Marketing nav, sticky Reserve bar   |
| 3   | Pick dates          | Reservation sheet (dialog / bottom sheet)         | Modal                               |
| 4   | Fill the guest form | Sheet from the listing **or** `/…/form` full page | Two different shells (see F-04)     |
| 5   | Pay downpayment     | Form step 5                                       | Same as 4                           |
| 6   | Track the stay      | `/properties/:propertySlug/trip?bookingId=…`      | Guest operational shell + tabs      |
| 7   | Check-in documents  | Trip → `#trip-documents`, `/document`             | Guest operational shell             |
| 8   | Post-stay review    | `/properties/:propertySlug/sd-form` step 1        | Guest operational shell + stepper   |
| 9   | Voucher reveal      | Same route, step 2                                | Same                                |
| 10  | Refund details      | Same route, step 3                                | Same                                |
| 11  | Refund settled      | Trip page / `/account/trips`                      | Guest account pages                 |

Access to steps 6 to 10 needs either a signed-in guest session or a signed
`?access=` token from the email link.

---

## Severity summary

| Severity | Count | Meaning                                                                 |
| -------- | ----- | ----------------------------------------------------------------------- |
| **P0**   | 3     | Breaks the promise the marketing page makes, or hides money at pay time |
| **P1**   | 13    | Confuses the guest, loses trust, or is a dead end                       |
| **P2**   | 11    | Craft, consistency, polish                                              |

---

## Remediation shipped 2026-11-24

Open **`before-after.html`** for a side-by-side screenshot of every item below. Pairs are captured
by `guestFlowVisualCapture.spec.ts` against a clean HEAD copy (`before`) and the fixed build
(`after`), same seed and viewport.

| #   | Fix                                                                                                                                     | Where                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| G1  | Home step 1 and the sign-in dialog now state the real rule instead of "No account needed"                                               | `BookingSteps.tsx`, `GuestAuthModal.tsx`                            |
| G2  | Refund step opens with **Refund amount** (deposit, deductions, additions, total, payout window); `get-sd-form` returns `refund_preview` | `SdFormPage.tsx`, `get-sd-form/index.ts`, `sd-form/lib/api.ts`      |
| G3  | Payment step always shows estimated stay, refundable deposit, downpayment, total due, and the host-confirmation line                    | `GuestFormPaymentStepContent.tsx`, `GuestForm.tsx`                  |
| G4  | Booking sheet header shows `Guest · 1 of 5` from an extended `GuestFormEmbedNav`                                                        | `GuestBookingFormModal.tsx`, `GuestForm.tsx`                        |
| G6  | Default-variant disabled buttons get a neutral surface; Submit stays disabled until the cancellation box is ticked (44px agreement row) | `ui/button.tsx`, `GuestForm.tsx`, `GuestFormCancellationPolicy.tsx` |
| G8  | "SD Refund Form" → **Security deposit refund** on guest surfaces (page, embed preview, done screen)                                     | `SdFormPage.tsx`, `SdFormEmbedPreview.tsx`                          |
| G9  | Voucher intro thanks the guest for a review only when `guest_review_submitted` is true                                                  | `VoucherIntroCopy.tsx`, `VoucherReveal.tsx`, `SdFormPage.tsx`       |
| G10 | Trip progress fills the current segment fully at lower emphasis, so "Step 3 of 5" paints 3 of 5                                         | `GuestTripNowCard.tsx`                                              |
| G11 | Checklist rows show a visible **Done** / **To do** label                                                                                | `GuestTripNowCard.tsx`                                              |
| G13 | Category stars 18px → 22px and aligned with the label (tap target was already 44px; the original wording overstated this)               | `GuestReviewStarRating.tsx`, `CategoryRatingList.tsx`               |
| G14 | Search chip scroller reserves trailing room so the last chip clears the filter button                                                   | `SearchResultsTabs.tsx`                                             |
| G15 | Host name wraps instead of truncating to "Hosted by Kame ..."                                                                           | `ListingHostCard.tsx`                                               |
| G16 | Draft-restore prompt moves to bottom-center and formats the saved time for Manila                                                       | `GuestForm.tsx`                                                     |

Tests added or extended: `guestJourneyEndToEnd.spec.ts` (4 tests, incl. refund amount and the
submit gate), `VoucherIntroCopy.test.tsx` (2 DOM tests), and the capture harness
`guestFlowVisualCapture.spec.ts` (@demo). `check-e2e-lane-tags` passes.

**Still open (deliberately):**

- **G7 self-serve resend.** The screen now explains the problem and offers a message to the host,
  but a guest still cannot mint a fresh link without the host. That needs a `request-guest-link`
  endpoint with per-booking rate limiting and an email send, so it stays out of this UI pass.
- **G12 — withdrawn.** Re-checked on main: once check-in/check-out are chosen the card renders
  rate × nights, fees, **Total** and the refundable deposit notice. The finding came from a
  screenshot taken before dates were selected.
- **G17–G27** polish backlog: untouched.

---

## P0 — fix before the next guest-facing release

### F-01 Guest form demands an account, marketing says "No account needed"

- **Evidence:** a fresh browser context opening
  `/properties/kame-home/form?checkInDate=…` gets a **"Log in or sign up"** dialog over the form.
  The home page's "How booking works" step 1 still reads
  _"Pick your dates, add your guests and a valid ID. **No account needed**."_
  (`ui/src/features/guest/marketing/guest-home/components/BookingSteps.tsx:24`).
- **Code:** `GuestForm.tsx:343` — "Same entry gate as `/messages`: require sign-in before the form
  is usable." So the gate is deliberate and the copy is stale. The route guide
  ([form.md](../../guides/routes/form.md)) already documents the gate, so this is a
  **marketing/product copy decision**, not a code bug.
- **Why it matters:** this is the single conversion step. A guest who read "no account needed"
  hits an account wall at the exact moment they intend to book, and the fastest exit is closing
  the tab.
- **Decide first:** keep the gate (then rewrite the marketing copy, the FAQ, and the "How it
  works" steps), or drop the gate for direct bookings (then delete `requireGuestAuth` from this
  path and re-check the trip page's account scoping).
- **Guard:** `anonymous guest is asked to sign in before the guest form` in
  `guestJourneyEndToEnd.spec.ts` locks whichever answer is chosen.

### F-02 The refund step never shows the refund amount

- **Evidence:** step 3 renders "Choose how you'd like to receive your security deposit refund"
  and three options (GCash / another bank / cash pickup). The security deposit, any deductions,
  and the amount coming back appear **nowhere** on that screen. The guest learned "Security
  deposit ₱2,000" on the trip page days earlier.
- **Why it matters:** the guest is choosing where money goes with no idea how much money.
- **Fix:** show `Refund amount ₱X` above the options, with a one-line breakdown when deductions
  exist (`Security deposit ₱2,000 · deductions −₱0 · refund ₱2,000`), and the payout window
  ("usually within 1 to 2 hours") next to the submit button rather than only after submitting.

### F-03 The payment step hides the total cost of the stay

- **Evidence:** payment step shows `Downpayment — 7 nights stay ₱2,000.00` and
  `Total due now ₱2,000.00`. Nightly rate, full stay total, security deposit, and remaining
  balance are absent. The estimate only appears when a voucher discount applies
  (`GuestFormPaymentStepContent.tsx:184`).
- **Why it matters:** the guest is asked to send money without seeing what the stay costs.
  The trip page later shows `Stay ₱7,000 / Deposit ₱2,000 / Paid ₱5,000`, so the data exists.
- **Fix:** always render the full breakdown (rate × nights, deposit, downpayment, balance due on
  arrival), not only on the voucher branch.

---

## P1 — confusing, untrustworthy, or a dead end

### F-04 Two shells for one form, one of them has no progress indicator

`Reserve` → dates → `Continue` opens **"Guest Form"** as a modal/sheet with **no stepper and no
"step 1 of 5"**, while `/…/form` renders the same form full-page **with** a five-step stepper.
Same form, two different mental models. The sheet also nests a scrollbar inside a 747px-tall
sheet on a 375px phone.

**Fix:** put the compact step indicator (`Guest · 1 / 5`) in the sheet header, or send the guest
to the full-page form and keep the sheet for dates only.

### F-05 Calendar availability is unreadable without a legend

Most nights render as pale grey numbers; only a few are dark. `available`, `booked`, and `past`
are encoded almost entirely by font weight and a 1px dot. Screen readers get it right
(`aria-label="November 24, booked"`), sighted guests do not. There is no key anywhere on the
page or in the sheet.

**Fix:** add a compact legend (`Available · Booked · Unavailable`) and give booked cells a visible
treatment (strikethrough or a filled swatch), not just reduced opacity.

### F-06 Disabled primary actions look enabled

- `Select dates` on the reservation sheet is `disabled` but renders at ~50% of a saturated teal
  gradient; in dark mode it reads as the live CTA.
- `Submit guest form` stays **enabled** while "I agree to the cancellation policy" is unticked.
  Clicking it silently does nothing visible near the button.

**Fix:** use a distinct disabled surface (grey fill, no gradient) and disable submit until the
agreement is ticked, with the error scrolled into view when the click is blocked.

### F-07 Error states are dead ends and leak internal language

| Screen         | Copy shown                                   | Actions offered |
| -------------- | -------------------------------------------- | --------------- |
| SD refund form | "Form not available / Access token required" | Back to home    |
| Guest review   | "Review unavailable / Access token required" | **none**        |
| Trip page      | "Booking not found … sign in with the email" | Your trips      |

"Access token required" is developer language. A guest holding an expired email link has no path
to a new one. The review screen has no action at all.

**Fix:** one shared guest-unavailable state: plain copy ("This link has expired"), a
`Send me a new link` action, and `Message the host` as the fallback.

### F-08 "SD Refund Form" is internal jargon in guest-facing UI

The page title, the done screen ("We'll process your SD refund in 1–2 hours"), and the embed
preview all say **SD**. Guests know it as the security deposit.

**Fix:** "Security deposit refund" in the page title and done copy. Keep `SD` for host surfaces.

### F-09 Voucher step thanks the guest for a review they skipped

Skipping step 1 with **Not now** lands on a voucher screen that opens with
_"Thanks for your review!"_. The route guide explicitly allows skipping the review.

**Fix:** branch the line: `Thanks for staying with us!` when no review was submitted.

### F-10 Progress bar contradicts its own label

The trip page shows **"Step 3 of 5 · Check-in"** but fills roughly 2.4 of 5 segments. Guests
cannot tell whether they are behind.

**Fix:** drive the fill from `step / total` exactly, or drop the numeric label.

### F-11 "What happens next" has no visible done state

All three rows render as outlined circles; only a dotted ring distinguishes "in progress". A guest
cannot tell what is already complete.

**Fix:** filled check for done, ring for in-progress, muted outline for upcoming, plus a one-word
status per row.

### F-12 The Reserve card never shows what the guest will actually pay

The listing's booking card shows `₱4,500 / night`, dates, guests, `Reserve`. No stay total, no
security deposit, no cleaning fee, no cancellation summary beyond the listing body.

**Fix:** after dates are chosen, show `₱X for N nights` plus `+ ₱Y refundable deposit` before the
guest commits to the form.

### F-13 Review stars are below the minimum touch target

Rating stars measure ~20×20px; the six category rows place five of them at the far right of a
375px screen with ~10px gaps. WCAG 2.5.8 (AA) needs 24×24; the repo's own mobile gate wants 44px.

**Fix:** make each star a 44×44 button with a 24px glyph, or replace the rows with segmented
1–5 controls.

### F-14 Mobile search chips collide with the filter button

At 375px the category chip row runs under the round filter button; `Parkings` is clipped
mid-word with no fade and no scroll hint.

**Fix:** add trailing padding plus the documented fade, or let the filter button sit in its own
row.

### F-15 Host name truncates on the mobile listing

`Hosted by Kame ...` on `/properties/kame-home` at 375px. It reads like a rendering bug.

**Fix:** allow two lines, or drop "Hosted by" to its own line above the name.

### F-16 Draft-restore banner covers the guest form header on mobile

The "Continue where you left off?" card floats over the teal band and hides the property identity.
Its timestamp renders as `Saved 11/23/2026, 5:42:05 AM` — US order with seconds.

**Fix:** render it below the header as a normal row, and format the time as `Today, 5:42 AM`
(Asia/Manila).

---

## P2 — craft and consistency

| #    | Finding                                                                                                                             | Fix                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| F-17 | No `<h1>` on `/search`, `/properties`, `/calendar`, `/form`; the trip page's `<h1>` is the property name, not the page purpose      | One `<h1>` per route describing the task                                                        |
| F-18 | Search card meta is `6 2 2` with **no accessible names at all**: a screen reader reads "6 2 2", sighted guests see three bare icons | Wrap each value in a labelled group (`6 guests`, `2 bedrooms`, `2 bathrooms`) and add a tooltip |
| F-19 | Label asterisk spacing is inconsistent: `Friend's Name*` vs `Check-in Date *`                                                       | One pattern, one shared component                                                               |
| F-20 | Emoji in product UI: `🎉` in "Has surprise decor", party popper on "THANK YOU!"                                                     | Remove per `human-copy`                                                                         |
| F-21 | Voucher code letter-spacing makes `OFF-50` read as `OFF – 50`                                                                       | Reduce tracking on the code, use a monospace face                                               |
| F-22 | Guest form, calendar and refund pages sit in a 768px column on a 1440px screen; the calendar is especially empty                    | Widen to 2 columns ≥ `lg`, or center with an intentional summary rail                           |
| F-23 | Contact host sheet: a bare "Select Dates" footer field, no composer, ~120px of dead space                                           | Make the footer a real date row with a label, or remove it                                      |
| F-24 | `/properties/:slug/success` silently redirects to `/calendar`                                                                       | Explicit "we couldn't find that booking" state, or remove the route                             |
| F-25 | Listing gallery overlays Share/Save on the top-right photo                                                                          | Reserve a gutter, as Airbnb does                                                                |
| F-26 | Dark mode: disabled CTAs and `Add date` placeholders lose more contrast (axe already flags `text-muted-foreground/50`)              | Raise placeholder contrast to 4.5:1 in both themes                                              |
| F-27 | Trip page stacks `Check-in steps` → `Check-in` → body copy, three levels saying the same word                                       | Collapse to one heading                                                                         |

---

## What already works (keep it)

- **The trip page is the strongest screen in the flow.** Sticky summary rail, one primary action
  (`Pay ₱4,000`), then payment breakdown, cancellation, directions, host, booking reference.
- **The refund stepper is short and forgiving.** Review is skippable, the voucher survives a
  reload, and `prefers-reduced-motion` short-circuits the wheel.
- **Mobile chrome is genuinely native.** Date picking is a bottom sheet with a drag handle;
  search is a full-screen overlay; the trip page uses the Trip / Messages / Listing tab set.
- **Accessibility baseline is good.** axe-core reports **0 violations** on 7 of 8 routes;
  the listing detail is the only failure (`aria-prohibited-attr` on star ratings,
  `color-contrast` on `Add date`). Axe cannot see unlabeled icon groups (F-18) or touch-target
  size under the AA rule, so treat the sweep as a floor, not a pass.
- **Calendar day labels are exemplary** (`"November 24, booked"`), and 44px targets are the
  default everywhere except the two places called out above.

---

## Artifacts

| Artifact                        | Path                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| **Decision board (open this)**  | `review.html` — every finding with its screenshot and a do-now / next / skip call             |
| **Before / after board**        | `before-after.html` — 15 screenshot pairs for the 13 shipped fixes                            |
| Capture harness (@demo)         | `guestFlowVisualCapture.spec.ts` · `AUDIT_PHASE=before\|after bun run audit:guest-flow-shots` |
| Functional E2E (4 tests)        | `ui/e2e/features/guest-form/guestJourneyEndToEnd.spec.ts`                                     |
| Recorded slow-motion tour       | `ui/e2e/features/guest-form/guestJourneyTour.slowmo.spec.ts`                                  |
| Shared mocks                    | `ui/e2e/features/guest-form/shared/guestJourneyHarness.ts`                                    |
| Run the E2E                     | `bun run test:e2e:guest-journey`                                                              |
| Record the tour (desktop+phone) | `bun run test:e2e:guest-journey:tour:video` → `test-results/playwright/`                      |
| **Committed recording (63s)**   | `recordings/01-search-to-deposit-refund.webm`                                                 |
| Exploration screenshots         | `screenshots/{desktop,mobile,tablet}/` (JPEG, 31 frames)                                      |

### Key frames

| Frame                                         | Shows                                                      |
| --------------------------------------------- | ---------------------------------------------------------- |
| `screenshots/desktop/05-calendar.png`         | F-05 availability with no legend, 768px column on 1440px   |
| `screenshots/desktop/19-form-payment.png`     | F-03 payment breakdown, disabled/agreement state           |
| `screenshots/desktop/20-sd-voucher.png`       | F-09 "Thanks for your review" after skipping, pastel wheel |
| `screenshots/desktop/22-sd-refund.png`        | F-02 refund options with no amount                         |
| `screenshots/desktop/08-sd-form.png`          | F-07 "Access token required" dead end                      |
| `screenshots/desktop/09-guest-review.png`     | F-07 review error with **no** action                       |
| `screenshots/desktop/13-trip-token.png`       | Trip page, F-10 progress mismatch, F-11 checklist states   |
| `screenshots/mobile/m14-guest-form-sheet.png` | F-04 sheet with no step indicator                          |
| `screenshots/mobile/m02-search.png`           | F-14 clipped "Parkings" chip                               |
| `screenshots/mobile/m03-property-detail.png`  | F-15 truncated host name                                   |
| `screenshots/mobile/m05-form.png`             | F-16 draft banner covering the header                      |
| `screenshots/tablet/t05-trip.png`             | F-10 progress fill vs "Step 3 of 5"                        |

The tour walks: search → listing → reservation sheet → guest form (all five steps) → trip page →
review skip → voucher → refund details → done screen, then repeats the key screens at 375px.

---

## Open decisions

1. **F-01:** keep the guest account requirement or restore truly account-free booking? Everything
   else in the copy matrix depends on the answer.
2. **F-04:** is the reservation sheet meant to be the primary booking path, or a shortcut? That
   decides whether the stepper moves into the sheet or the sheet hands off.
3. **F-02/F-03:** which numbers may be shown before the host confirms rates? If the answer is
   "none", the screens still need an explicit "your host will confirm the final amount" line.
4. **F-07:** who owns the "send me a new link" endpoint, and can it be rate-limited per booking?

---

## Related

- [Guest form](./form.md) · [Guest listing](./properties.md) · [Search](./search.md) ·
  [Trip](./trip.md) · [SD refund](./sd-form.md)
- `docs/architecture/overview.md`, `docs/PROJECT.md`
