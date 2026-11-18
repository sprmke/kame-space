---
title: 'Audit 29b: issue details'
status: active
tags: [audit, register, details]
updated: 2026-11-19
---

# 29b: Issue details

Full text for every issue in [29-issue-register.md](./29-issue-register.md). Same order: P0 first, then P1,
P2, P3, grouped by area. Machine-readable twin: `issue-register.json`.

### GL-01 — The auth gate is a dead end on every gated intent

- **Priority:** P0
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Global
- **Route:** /contact, /properties/kame-home/form, /parkings/monaco-level-2-slot-27/form, /account/*
- **Section/element:** "Log in or sign up" sheet
- **Viewports:** 320, 390, 768, 1024, 1440
- **Evidence:** live: opened /contact, clicked any category → sheet with only "Continue" and "Continue with Google"; Escape does not close it, backdrop click does not close it. Same sheet on /properties/kame-home/form.

**What happens.** an anonymous visitor who expresses intent (contact us, book a stay, book parking) is shown a sign-in sheet with no close control, no "continue as guest", and no way back except the browser Back button. The sheet has exactly two buttons, both of which require an account.

**Why it matters.** this is every conversion path at its highest-intent moment. It also contradicts the home page, which says "No account needed." A visitor without an account cannot contact support or start a booking.

**Fix.** add a visible close, an explicit "Continue as guest" where the task allows it, and set `aria-modal` plus a body-scroll lock; if sign-in is genuinely required, state the reason and the alternative (email) inside the sheet.

**Acceptance.** Escape, the close button and the backdrop all dismiss the sheet; a guest can reach the booking form and the contact form without an account, or is told why not.

---

### LG-04 — The payment step never shows what the stay costs

- **Priority:** P0
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /properties/kame-home/form step 5
- **Section/element:** "Payment breakdown"
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `./screenshots/public/live/step-05-payment.jpg` and `.json`

**What happens.** The breakdown is three lines: "Downpayment / 2 nights stay ₱2,000.00 / Total due now ₱2,000.00". There is no nightly rate, no stay total, no balance due on arrival, and the ₱10 voucher applied on step 2 does not appear. The listing says ₱4,500/night, so a 2-night stay is ₱9,000 and the guest cannot reconcile any of it.

**Why it matters.** This is the money screen. A guest is asked to transfer funds to a phone number with no way to verify the amount, and cannot tell whether ₱2,000 is a deposit, a discount, or the whole stay.

**Fix.** Show the full ladder: nightly rate x nights, fees, voucher, total stay, downpayment due now, balance due at check-in. Carry the voucher through from step 2. Round consistently.

**Acceptance.** Step 5 shows at least rate, nights, subtotal, voucher, total, due now, balance; the numbers reconcile with the listing price and the calendar selection.

---

### AC-01 — Invalid invite link is a total dead end

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /accept-invite
- **Section/element:** whole page, empty-token state
- **Viewports:** 390, 1440
- **Evidence:** `./screenshots/public/auth__accept-invite__m390.jpg`, `./screenshots/public/auth__accept-invite__d1440.jpg`; live: `probe-p4b.json → acceptInvite` (`links: []`, body text `"Kame | Space"`)

**What happens.** The page renders a bare grey canvas with one centred card reading "This invitation link is invalid." There is no logo, no header, no footer, no navigation, and the DOM contains **zero** links or buttons. A host who clicks an expired or already-used invite from their email has nothing to do next.

**Why it matters.** This is the first impression for a brand-new invited teammate. The most common real cause (expired link) is also the most recoverable, and the page offers no recovery. It also silently breaks the invite flow's last step.

**Fix.** Keep the error card but add brand chrome (logo, `--public-nav-h` header) and two actions: "Ask for a new invite" (mailto or support link) and "Sign in" (`/for-hosts/login`). Distinguish expired vs malformed vs already-accepted copy, since those need different next steps.

**Acceptance.** `/accept-invite` with no token and with a bogus token both render the logo, one plain-language reason, and at least one working navigation control; keyboard focus lands on the card.

---

### AC-08 — "On this device" is a build/cache debug panel on a guest page

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /account/profile
- **Section/element:** bottom card — Version / Local build / Check updates / Offline / 144 KB used / Keep data / Clear saved data
- **Viewports:** all
- **Evidence:** `./screenshots/public/account__profile__m390.jpg`, `./screenshots/public/account__profile__d1440.jpg`

**What happens.** A card exposes "Version: **Local build**", "Offline 144 KB used", "Check updates", "Keep data", "Clear saved data". "Local build" is a developer string. "Keep data" and "Clear saved data" do not say _which_ data (cached pages? drafts? the booking form you were filling?).

**Why it matters.** Guests are being shown implementation state and given a destructive-sounding button with no object. "Clear saved data" next to a PWA cache is one tap from losing an offline booking draft, and nothing says so. This is exactly the internal-tool leak the pass was asked to flag.

**Fix.** Either remove the card, or keep only user-facing value: "Offline copy 144 KB · Clear" with a confirm naming the consequence. Never render "Local build".

**Acceptance.** No build, byte-count or cache jargon remains; any destructive control names what it deletes.

---

### AC-11 — Guest Help is an empty shell with no search

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /account/help
- **Section/element:** whole page
- **Viewports:** all
- **Evidence:** `./screenshots/public/account__help__m390.jpg`; live `probe-p4b-3.json → help1440` = `No help topics yet | Contact support if you need a hand with your stay. | Contact support`, `inputs: 0`

**What happens.** The Help destination contains one empty-state card with a brand mark, "No help topics yet", and a "Contact support" button. There is no search field, no topic list, no FAQ, no link to the help-centre content that does exist on the marketing site.

**Why it matters.** "No help topics yet" tells the guest the product has no help. The guest's only escalation is a support ticket that costs the host time. Every other account destination has real content; this one is a hole in the nav strip.

**Fix.** Render at least search + 3 to 5 top topics from the existing knowledge base, with "Contact support" as the last resort. If the knowledge base is genuinely empty for guests, show search plus the marketing `/support` link rather than a dead end.

**Acceptance.** `/account/help` shows a search input and at least three real topics, and searching narrows them.

---

### AC-22 — `/onboarding` and `/verification-rejected` both redirect to the org Dashboard

- **Priority:** P1
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /onboarding, /verification-rejected
- **Section/element:** whole page
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__onboarding__d1440.jpg` and `./screenshots/public/admin-gap__verification-rejected__d1440.jpg` are pixel-identical to the org Dashboard; live `probe-p4b.json` — both land on `http://localhost:5173/org/kame-homes/dashboard` with `h1: "Dashboard"`

**What happens.** Both routes resolve to the ordinary org Dashboard. The onboarding entry point has no onboarding content, and the verification-rejected state has no UI at all: a host whose verification was rejected sees a normal dashboard, with a "Verification" item that looks half-selected in the sidebar and no explanation anywhere.

**Why it matters.** Verification is the gate on payouts and public pages. A host who fails it is silently dropped into a dashboard where nothing says they are blocked or why, and every payouts action will fail later with no context. Onboarding is the first-run experience for every new host.

**Fix.** Give both routes real destinations: a 3-to-5 step onboarding checklist (profile, listing, payout, verification) with resume state, and a rejected-verification page stating the reason, the documents to fix, a resubmit action and an escalation contact.

**Acceptance.** `/onboarding` renders an onboarding surface with at least one actionable step; `/verification-rejected` names the rejection reason and offers resubmit.

---

### AC-26 — FAQ edit opens a dialog that says "edit this in a markdown file"

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /admin/support/faqs
- **Section/element:** pencil → edit dialog
- **Viewports:** all
- **Evidence:** live `probe-p4b-2.json → faqEdit` — dialog text `"Synced FAQ / Edit in docs/guides/support/faqs.md and let the sync update this row. The publish toggle stays available."`, fields disabled, only "Close"

**What happens.** The pencil promises editing. The dialog states the answer must be changed in a repository markdown file, shows Category/Question/Answer as read-only, and offers only Close.

**Why it matters.** This is an internal engineering instruction shown as product UI. A super admin with no repo access has an edit button that cannot edit anything, and the FAQ's visible copy cannot be corrected from the admin surface.

**Fix.** Rename the action to "View" (no pencil) with a "Where this comes from: synced from docs" note, and add a real "Add FAQ" path for manual rows. If editing synced rows is genuinely out of scope, remove the affordance.

**Acceptance.** No admin dialog instructs the user to edit a repository file; every edit affordance opens editable fields.

---

### AC-31 — Super-admin sidebar hides 7 of 21 destinations at 1440x900 with no scroll cue

- **Priority:** P1
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /admin/*
- **Verified note:** Re-measured: 21 links, 7 outside the viewport (System health, Operations reports, AI, Rate limits, Audit log, Platform settings, Feature availability); the scroll container is 1119px tall in a 679px box with no visible scrollbar.
- **Section/element:** left nav
- **Viewports:** 900px-tall laptop (1440×900, 1280×800), 1024
- **Evidence:** live `probe-p4b-6.json → adminNav` — 21 links, `scrollHeight 1119` vs `clientHeight 679`, `overflowY: auto`, first hidden item "System health" at y=880, last "Feature availability" at y=1144; visible in `./screenshots/public/admin-gap__admin-playbook__d1440.jpg` (list stops at "Announcements" above the plan card)

**What happens.** The nav scrolls but macOS overlay scrollbars show nothing, and the pinned plan card cuts the list with a hard edge. Items below the cut: System health, Operations reports, AI, Rate limits, Audit log, Platform settings, Feature availability, plus any later additions.

**Why it matters.** These are the platform's operational controls. Reaching `/admin/ai` requires either scrolling an invisible region or knowing the URL (which is why `/admin/ai-usage` exists as a redirect). During an incident, the health and audit pages are precisely what you cannot find.

**Fix.** Group and collapse the nav (Organizations / Billing / Operations / Content / Platform) so 21 items fit ~680px, and add a visible fade + "More" affordance at the cut.

**Acceptance.** At 1440×900 every nav destination is reachable without scrolling, or the scroll region has a persistent visual affordance.

---

### AC-37 — `/activity` is Settings with a dialog on top, and the URL rewrites

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /org/:orgSlug/property/:propertySlug/activity
- **Section/element:** routing
- **Viewports:** all
- **Evidence:** live `probe-p4b-2.json → activity` — after load `url: ".../settings"`, dialog count 1, `dlgTitle: "Activity"`, `h1: "Settings"`; pressing Escape leaves you on Settings at the settings URL. Manifest `prop-activity` h1 = "Settings"

**What happens.** The activity route renders the Settings page and auto-opens an Activity dialog over it, then rewrites the URL to `/settings`. Closing the dialog (or Esc) lands on Settings, not on the activity log. Reloading or sharing the original URL repeats the whole thing.

**Why it matters.** Audit history is a page-level object people link to and screenshot for compliance. Here it is a modal that cannot be linked, cannot be deep-linked to a single event, and leaves the user somewhere they did not ask to be.

**Fix.** Make the activity log its own page (`h1` "Activity") with the filters/export already built, and keep the dialog only as a quick peek from Settings with an "Open full log" link.

**Acceptance.** Navigating to `/activity` yields `h1` "Activity" at the `/activity` URL, and closing any dialog does not change the route.

---

### AC-39 — The Help & Support "Guides" tile leads to "No guides yet"

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /org/:orgSlug/property/:propertySlug/help-support/docs
- **Section/element:** main card
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__prop-docs__d1440.jpg` / `..._m390.jpg` — hub "Guides · How each page works" above a giant card reading "No guides yet"

**What happens.** One of the four prominent Help hub tiles lands on an empty page whose subtitle is "Walkthroughs for each page in the dashboard". The hub tile is styled identically to the working ones.

**Why it matters.** The hub is the first place a stuck host goes. Promising walkthroughs and delivering an empty card removes the fallback that would otherwise send them to Tickets or Ask AI. The empty card is also ~250px of white on desktop.

**Fix.** Populate at least the 5 top routes, or hide the Guides tile until content exists; in the empty state link directly to Tickets and Ask AI.

**Acceptance.** No tile on the Help hub leads to an empty state; the empty state, if kept, offers two working next steps.

---

### AC-43 — Paused team members are rendered at ~40% opacity and fail contrast

- **Priority:** P1
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Auth, account and admin
- **Route:** /org/:orgSlug/team
- **Section/element:** paused member rows
- **Viewports:** all
- **Evidence:** manifest `org-team` — 21 contrast failures, sample: `Demo Manager` 2.4:1, `manager.demo@example.com` 2.4:1, avatar initials `DM` 2.4:1, `Full Access` 2.8:1, `Plan limit` 2.9:1 (need 4.5); visible in `./screenshots/public/admin-gap__org-team__d1440.jpg` and `..._m390.jpg`

**What happens.** Three of five rows are dimmed to roughly 40% opacity to signal "paused". Names, emails and role chips all drop to ~2.3–2.9:1.

**Why it matters.** The paused rows are exactly the ones an owner needs to act on (free a seat or upgrade), and their identity is the information needed to act. Dimming below AA makes the actionable rows the least readable on the page.

**Fix.** Keep text at full contrast and signal paused with a badge/`Plan limit` chip plus a muted avatar ring; use `text-muted-foreground` (not opacity) only for secondary metadata.

**Acceptance.** All member rows meet 4.5:1 for name, email and role chips regardless of paused state.

---

### AC-45 — Parking notifications print a raw task id in an alert body

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /org/.../parking/monaco-level-2-slot-27/notifications
- **Section/element:** "Calendar conflicts" alert
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__parking-notifications__d1440.jpg` — body begins `test-14a390de: 2 imported reservations overlap existing bookings or blocks.`

**What happens.** The alert's body is prefixed with an internal identifier and continues with developer phrasing ("resolve on the platform that should not have them").

**Why it matters.** A host reading an alert needs the two conflicting dates and guests, not a job id. Because the sentence has no dates or guest names, the alert is not actionable even though it describes a double booking.

**Fix.** Lead with the facts ("2 reservations overlap Dec 16–19: June V. and Marco D."), link both bookings, drop the id, and put the fix instruction last.

**Acceptance.** No raw identifier appears in notification copy; every conflict alert names the conflicting dates and guests.

---

### AC-50 — Published showcase hero text sits at 1.1:1 over the photo

- **Priority:** P1
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Auth, account and admin
- **Route:** /org/:orgSlug/property/:propertySlug/public-pages/showcase/edit (and the published page)
- **Verified note:** Re-verified visually: white name/tagline/CTAs sit directly on a bright interior photograph with no overlay, so the text nearly disappears. The 1.1:1 figure is measured against the bright ceiling area, which is the worst case, not the average.
- **Section/element:** preview hero overlay
- **Viewports:** all
- **Evidence:** manifest `prop-public-page-edit` — 147 contrast failures, sample: `Azure North Residences` 1.1:1 (16px), `Monaco 2604` 1.1:1 (20px), `A place made for arriving well` 1.1:1 (18px), `Check dates` 1.1:1 (16px), plus `BEDROOMS / BATHS / GUESTS / CHECK-IN` at 4.3:1; visible in `./screenshots/public/admin-gap__prop-public-page-edit__d1440.jpg` and `..._m390.jpg`

**What happens.** White text and a ghost CTA sit directly on a bright interior photo with no scrim. The preview renders the real template, so this is what guests get on the published page, not a mock artefact.

**Why it matters.** The property name, tagline and secondary CTA are the page's identity and are effectively invisible over light imagery. Any host who uploads a bright photo ships an unreadable hero, and nothing in the editor warns them.

**Fix.** Add a fixed gradient scrim (top-to-bottom or bottom-up, ≥40% at the text band) in the template so any photo works; add a contrast warning in the editor when a chosen image fails behind the text; raise the uppercase kicker colour to meet 4.5:1.

**Acceptance.** The hero text measures ≥4.5:1 over the lightest uploaded photo, and the editor flags a failing image before publish.

---

### AC-52 — "Open page" is clipped off the right edge at 390

- **Priority:** P1
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** showcase editor
- **Section/element:** editor toolbar
- **Viewports:** 320, 390
- **Evidence:** `./screenshots/public/admin-gap__prop-public-page-edit__m390.jpg` ("Open p" cut at the screen edge); live `probe-p4b-2.json → editor390.overlapping` = `{t: "Open page", l: 296, r: 411}` with `vw: 390`, plus four preview tiles extending to x=1593

**What happens.** The toolbar row (Saved · Copy link · Open page) overflows the 390px viewport; the last button runs 21px past the edge and cannot be fully hit. The preview tiles also overflow to 1593px.

**Why it matters.** "Open page" is how a host checks their work before publishing. Half a button means the primary verification step is unreliable on the device most hosts use, and the overflowing preview can hide the right side of the design being edited.

**Fix.** Collapse the toolbar to icons + overflow menu below `sm` (Saved as a dot, Copy/Open in a `MobileHeroActionMenu`), and scale the preview canvas to the container width.

**Acceptance.** No control on the editor route has `right > innerWidth` at 320 or 390, and the preview fits the viewport without horizontal clipping.

---

### GL-02 — Three public pages have no h1, and four host pages have three or four

- **Priority:** P1
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Global
- **Route:** /search, /properties, /parkings, /developments, /properties/kame-home/calendar, /account/* (none) — /for-hosts, /for-hosts/v2, /for-hosts/v3 (3 visible), /for-hosts/login (2)
- **Section/element:** document outline
- **Viewports:** all
- **Evidence:** live: `/for-hosts` h1s = ["Run every stay from one dashboard", "Your rentals, run for you.", "Dashboard"]; `/search` and `/properties` h1 count = 0. Manifest `h1` field per route in `screenshots/public/manifest.json`.

**What happens.** list pages start at h2 with no page title; the marketing pages embed a dashboard mock whose own headings are `<h1>`, so the outline has three top-level headings and one of them belongs to a picture of a product.

**Why it matters.** screen-reader users get no page name on the four main browse pages, and duplicated h1s on host pages make the document structure meaningless.

**Fix.** one `<h1>` per route; the embedded mock should use `<p>`/`<div>` for its fake headings or be wrapped in `aria-hidden="true"` with a text alternative.

**Acceptance.** every route has exactly one visible h1; the mock contributes none.

---

### LG-06 — Every parking image is a dead third-party URL, so alt text renders over empty cards

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /parkings, /parkings/monaco-level-2-slot-27, /developments/azure-north-residences/parking, /parkings/monaco-level-2-slot-27/form
- **Section/element:** Card media and detail hero
- **Viewports:** 320, 390, 768, 1024, 1440
- **Evidence:** `shots/listings__parkings__d1440.jpg`, `__m390.jpg`, `__s320.jpg`, `shots/listings__parking-detail__m390.jpg`, `live1.json` (`https://images.unsplash.com/photo-1590674899484-f5649e4292cf?w=1200&q=85` -> `naturalWidth 0`), `curl` -> HTTP 404

**What happens.** The parking photo is a remote Unsplash asset that now returns 404. The browser paints the alt text inside a blank box ("Azure North Residences, Parking slot", "Azure Monaco - Level 2 - Slot 27 (view 1"), overlapping the card content. At 1440 the detail hero was still cached in the earlier capture; the live measurement now shows it broken at both 390 and 1440.

**Why it matters.** Parking has exactly one listing and it has no image anywhere. Listings depend on a third-party CDN for their primary visual.

**Fix.** Serve listing media from Supabase Storage (or a committed local asset) and add an `onError` fallback that renders a branded placeholder rather than alt text. Replace the dead photo in `scripts/dev/seed/01-identity.sql:275,277`, `10-marketing.sql:134`, `seed-search-fixtures.sql:238,240`.

**Acceptance.** No request to `images.unsplash.com/photo-1590674899484…`; every listing card renders an image or a deliberate placeholder with no bleeding text.

---

### LG-07 — "Parking in Other" appears as the listing name on four surfaces

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /parkings, /developments/azure-north-residences, /developments/azure-north-residences/parking, /hosts/kame-homes
- **Section/element:** Card title and group heading
- **Viewports:** 320, 390, 768, 1024, 1440
- **Evidence:** `shots/listings__parkings__d1440.jpg`, `shots/listings__development-parking__m390.jpg`, `copy.json`

**What happens.** The card title is the literal string "Parking in Other" and it is repeated as the group heading. "Other" is the fallback city.

**Why it matters.** It reads as "parking in a place called Other" and undermines the address shown two lines below ("Azure North Residences"). It is the only parking listing, so it is also the first impression of the whole vertical.

**Fix.** Title parking by what it is: "Covered parking, Monaco Level 2" or "Parking at Azure North Residences". Suppress the group heading when the group equals the card's own location, and fall back to the development name instead of "Other".

**Acceptance.** No rendered string "Parking in Other" on any route; title and location are not duplicates.

---

### LG-08 — Result grids do not fill the viewport, so one result floats in an empty page

- **Priority:** P1
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Listings and guest
- **Route:** /properties, /parkings, /developments, /developments/azure-north-residences (both carousels)
- **Section/element:** Results grid / card row
- **Viewports:** 1024, 1440 (and 390 for the half-width card)
- **Evidence:** `shots/listings__properties__d1440.jpg` (260px card, ~1000px empty), `shots/listings__parkings__d1440.jpg`, `shots/listings__developments__d1440.jpg`, `shots/listings__properties__m390.jpg` (card ~155px wide, title truncated "Condo in San…"), `live3.json` (`cardW: [260]`, `mainW: 1440`)

**What happens.** Cards are a fixed ~260px in a fixed-column row. With one result, the page renders one card at the far left and 3/4 of the viewport is blank, then the footer. On mobile the same card renders at ~40% width with a truncated title.

**Why it matters.** An inventory of one makes the site look broken rather than new. The card and its price are the product; they should own the space.

**Fix.** Use `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` with a max column count, or a single-result layout that spans the content width (a wide horizontal card with a larger image). On phone, render one full-width card.

**Acceptance.** At 1440 with 1, 2 and 3 results, cards fill the row without orphaned whitespace; at 390 the card is full width and the title is not truncated.

---

### LG-09 — Two different listing card designs for the same property

- **Priority:** P1
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Listings and guest
- **Route:** /properties vs /developments/azure-north-residences/properties, /hosts/kame-homes, /developments/azure-north-residences
- **Section/element:** Property card
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/listings__properties__d1440.jpg` (badge + title + subtitle + price) vs `shots/listings__development-properties__d1440.jpg` (image dots, New + Condo badges, 4.50 (10), location with pin, 6 guests / 2 bed / 2 bath, WiFi + AirCon + TV +15 chips, price)

**What happens.** The primary search page uses a bare card with no rating count, no capacity, no amenities and no image pagination. A deep page and the host page use the richer card. `Monaco 2604` is titled "Condo in San Fernando" on one card and "Monaco 2604" on the other.

**Why it matters.** The most-visited surface has the weakest card, and the same property has two names, so guests cannot tell they are the same listing.

**Fix.** Promote the rich card to a single shared component and use it everywhere. Pick one title model: listing name primary, unit/building secondary.

**Acceptance.** One card component renders on all five surfaces, with identical title, price, rating and amenity summary for the same listing.

---

### LG-10 — Calendar renders 27 contrast failures and does not distinguish available, blocked and past

- **Priority:** P1
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Listings and guest
- **Route:** /properties/kame-home/calendar
- **Section/element:** Month grid, day cells
- **Viewports:** 320, 390, 768, 1024, 1440
- **Evidence:** `shots/guest-flow__calendar__d1440.jpg` (days 1 to 17 nearly invisible, 23/24/28/29/30 faint mint), `./screenshots/public/manifest.json` `calendar` `contrastCount: 27-28`, `calendar-cells.json` (1 to 18 `disabled: true`, 19 to 22 open, 23/24 closed, 25 to 27 open, 28 to 30 closed)

**What happens.** Past days, blocked days and today all render in variants of near-white. Only open days are legible. There is no legend, no "unavailable" label, and the current day (18) is a pale mint block that looks like a blocked day. Nothing communicates which days are clickable.

**Why it matters.** Picking a date is the first action in the funnel, and it depends on spotting a 1.1:1 difference. Users will assume the calendar is disabled or broken.

**Fix.** Three explicit states at AA contrast: open (ink on white, hover/focus ring), blocked (struck or hatched with "Unavailable" tooltip), past (muted but legible). Add a one-line legend. Give today a ring, not a fill.

**Acceptance.** All day numbers pass 4.5:1 against their cell; a legend explains open/blocked/past; blocked cells expose `aria-disabled` plus an accessible "Unavailable" name.

---

### LG-11 — At 320 the calendar is clipped and its own CTA covers the last week

- **Priority:** P1
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Listings and guest
- **Route:** /properties/kame-home/calendar
- **Section/element:** Month grid bottom rows + "Select dates to continue" bar
- **Viewports:** 320
- **Evidence:** `shots/guest-flow__calendar__s320.jpg` (29 and 30 sit behind the grey CTA), manifest `calendar 390 height 845` against a 700px viewport

**What happens.** The card is taller than a 320x700 viewport and the disabled CTA block overlaps the final week row, so the last two days cannot be seen without scrolling, and the page has no visual cue that it scrolls.

**Why it matters.** A guest on a small phone cannot tell whether the month continues.

**Fix.** Let the grid own its space (no fixed card height), keep the CTA sticky outside the card, and allow the card to scroll with the page. Set 40px minimum day cells at 320.

**Acceptance.** At 320x700, days 1 to 30 are all reachable, the CTA never overlaps a day cell, and the page has no horizontal scroll.

---

### LG-13 — The showcase section nav is six invisible 6px slivers, plus a stray fixed legal strip

- **Priority:** P1
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Listings and guest
- **Route:** /properties/kame-home/showcase, /properties/kame-home/stay-guide
- **Section/element:** Right-edge section rail, bottom fixed "Terms · Privacy" strip
- **Viewports:** 1024, 1440
- **Evidence:** `live3.json` `showArrows` (`Go to Your stay`, `Go to Gallery`, … `w: 6`, `h: 32-40`, `left: 1418`), `live1.json` fixed elements (`DIV … fixed inset-x-0 bottom-0 z-20` with text `Terms · Privacy`)

**What happens.** Six section buttons render as 6px wide vertical ticks at the right edge with no label and no visible state. Separately, a legal-links strip is `position: fixed` at the bottom of the viewport on both long pages, floating over content for the whole scroll.

**Why it matters.** The section nav cannot be seen or hit, so the page reads as having no navigation despite 5,193px of content. The floating legal strip is unexplained chrome that competes with the real bottom bar.

**Fix.** Render the rail as labelled dots or a small pill list with a 44px hit area and an active state, or remove it. Move Terms/Privacy into the page footer, not a fixed layer.

**Acceptance.** Section nav items have visible labels/state and >=44px targets; no fixed legal strip on scroll.

---

### LG-14 — The trip page is unopenable for the guest it was emailed to

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /properties/kame-home/trip?bookingId=5eed1000-0000-4000-8000-000000000059
- **Section/element:** Whole page
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/guest-flow__trip__d1440.jpg` (anonymous gate), `live2.json` `trip` (signed in as `guest.demo@example.com`: h1 "Booking not found", body "We couldn't find this booking for your account. Check the link or sign in with the email you booked with."), `live2.json` `trips` (the account's own 5 trips do not include this booking)

**What happens.** Anonymous gets a sign-in wall whose subtitle says "or open the link from your booking email" while the link you arrived on is that link. Signed in as a valid guest, the same URL renders "Booking not found". The account's real trips list on `/account/trips` contains different bookings.

**Why it matters.** The trip page is the guest's only operational surface after booking (documents, parking, refund, checkout). Both paths dead-end, and the copy promises a tokenised link that is not implemented.

**Fix.** Add a tokenised access path: `?token=` (or signed URL) that resolves the booking without login, exactly as `stay-guide` already does. When signed in with the wrong account, show "This booking belongs to a different email" plus the trips list and a support link instead of a bare not-found.

**Acceptance.** A booking email link opens the trip signed out; a mismatched signed-in user gets a specific wrong-account message and a way forward.

---

### LG-15 — `/messages` has no message box and bounces to the listing

- **Priority:** P1
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /properties/kame-home/messages
- **Section/element:** Whole route
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/guest-flow__messages__m390.jpg` (login sheet over the property page), manifest `messages` `finalUrl` = `/properties/kame-home`, `live3.json` `msgDialog` (`hasComposer: false`, five canned questions, footer action "Select Dates")

**What happens.** The route redirects to the property detail page. Anonymous gets the login sheet. Signed in, a bottom sheet opens with five generic prompts ("How many guests can stay?", "How do I get to the property?") and a "Select Dates" button - no text field.

**Why it matters.** "Message host" is the escape hatch for every unanswered question, and there is no way to type. The URL also cannot be linked or reloaded because the state lives in a dialog on another page.

**Fix.** Give `/messages` a real thread view with a composer. Keep the FAQ prompts as suggestions above the input. Preserve the route on reload.

**Acceptance.** `/messages` renders a thread and a working text input at 390 and 1440; sending a message appends to the thread without leaving the route.

---

### LG-16 — The parking deep link drops its stay context

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /properties/kame-home/parking/5eed1100-0000-4000-8000-000000000001 -> /parkings?linkStay=…
- **Section/element:** Whole page
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `live2.json` `paypark` vs `paypark-linkstay` (identical text and controls), manifest `pay-parking` `finalUrl` `http://localhost:5173/parkings?linkStay=5eed1100-…`, `shots/guest-flow__pay-parking__d1440.jpg`

**What happens.** The trip's "reserve parking" link lands on the generic parking search. No banner, no stay dates pre-filled ("Add dates"), no filtered availability, no "you're adding this to booking X" context.

**Why it matters.** The guest was promised a spot "for your exact stay dates" in the form's parking step. The link silently converts that into an uncontextualised search where they must re-enter dates and may pick a slot for the wrong nights.

**Fix.** Carry `linkStay` into the search: show a "Adding parking to your Nov 25-27 stay" banner, pre-fill dates from the booking, filter by availability, and keep the booking reference through checkout.

**Acceptance.** Opening the link shows the stay dates in the search header without user input; the reservation created records the same booking id.

---

### LG-17 — Share fails on desktop

- **Priority:** P1
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /properties/kame-home
- **Section/element:** "Share" button, hero
- **Viewports:** 1024, 1440
- **Evidence:** live click at 1440 -> toast "Could not share this link"; `live5.mjs` output `share: { dialog: null, toast: "Could not share this link" }`

**What happens.** The Share button calls `navigator.share` and, when it is unavailable (desktop Chrome without the Web Share API), shows an error toast instead of falling back to copy-link.

**Why it matters.** On the devices where people plan trips, the share action is a visible failure. The toast also persists over the next dialog (it stayed visible under the login sheet).

**Fix.** Fall back to `navigator.clipboard.writeText` with a "Link copied" confirmation, and only error when both fail.

**Acceptance.** Share at 1440 copies the URL and confirms; no error toast on a supported browser.

---

### LG-18 — `/success` silently redirects to the calendar

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /properties/kame-home/success
- **Section/element:** Whole route
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** manifest `success` `finalUrl: /properties/kame-home/calendar` at every width; `shots/guest-flow__success__m390.jpg`

**What happens.** Visiting the success URL without submission state lands on the availability calendar with no message. There is no success page reachable by URL, so a guest who reloads the confirmation (or returns from GCash) loses all evidence the booking was sent.

**Why it matters.** The most anxious moment in the funnel is "did it go through". Reload should be safe and show the confirmation, booking reference and next steps.

**Fix.** Make success a real route keyed by booking id/reference, with a confirmation summary, what happens next, and a link to the trip. Redirect only when no reference is available, and say why.

**Acceptance.** Reloading `/success?ref=…` shows the confirmation; no silent redirect.

---

### LG-19 — "Pay to confirm" shows no amount due and claims a timer that does not exist

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /parkings/requests/5eed1100-0000-4000-8000-000000000001
- **Section/element:** Header badge, summary card, step header
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/listings__parking-request__d1440.jpg` and `__m390.jpg`

**What happens.** (a) A white circle at the top of the card is meant to hold an image but renders the listing title, which overflows the circle in every direction ("zure Monaco - Level 2 - Slot 27" clipped at both widths). (b) The page has no price, no total, no breakdown - only "Nov 2-4, 2026 · 2 nights · Kame Space". (c) "A host accepted. Confirm before the timer ends." with no timer, deadline or countdown anywhere. (d) "27 - Monaco" is a duplicate fragment of the title. (e) Two broken circular images in the header (`brokenImages: 2`). (f) No `<h1>`.

**Why it matters.** This is the payment screen for a reservation. Pressing "Pay now" with no visible amount is a trust failure, and an invented deadline is worse than none.

**Fix.** Replace the circle with the slot photo or drop it. Add an amount block (rate x nights, fees, total) above Pay now. Render a real countdown from the request's expiry, or delete the sentence. Title the page "Confirm and pay" and drop the "27 - Monaco" fragment.

**Acceptance.** The page shows a total that matches the request record, a real expiry timestamp or no timer claim, no overflowing text, and an h1.

---

### LG-20 — Mobile property detail collapses a five-photo gallery into one 358x200 frame

- **Priority:** P1
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Listings and guest
- **Route:** /properties/kame-home
- **Verified note:** Re-measured at 390: a single 358x200 image plus a "5 photos" control. The gallery is not hidden, it is compressed to one frame.
- **Section/element:** Hero gallery, sticky reserve bar
- **Viewports:** 320, 390
- **Evidence:** `shots/listings__property-detail__m390.jpg` ("1 photos", single image, no arrows), `live4.mjs` `pd.nextCount: 0`, `live5.json` `bar320`, `live1.json` `property-detail 390` fixed `DIV.mobile-bottom-bar` text "₱4,500 / night 4.5 ★ · 10 reviews Reserve"

**What happens.** At 390 and 320 the five-photo gallery collapses to one image with a count badge and no next/prev control (`0` matching buttons). The badge reads "1 photos" in the captures and "5 photos" once images load, so the count tracks loaded images and the plural is unhandled. The reserve bar is fixed at the bottom with price, rating and button, sitting over body content as you scroll (measured bar top 634 with content behind it).

**Why it matters.** The photos are the reason someone books, and on phone they get one. The count badge is the only hint there is more, with no way to reach it.

**Fix.** Make the mobile hero swipeable with dots and arrows, always show total photo count, and handle "1 photo". Give the page bottom padding equal to the bar height so nothing is permanently under it.

**Acceptance.** At 390 the hero swipes through all photos with an accurate counter; the last content is reachable above the bar.

---

### LG-21 — Save and Contact host require an account before the guest has decided anything

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /properties/kame-home
- **Section/element:** "Save" and "Contact host"
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** live click on Save (anonymous) -> dialog "Log in or sign up / Email / Continue / OR / Continue with Google"

**What happens.** Both actions open the same login sheet. Save is a bookmark, and Contact host is the pre-booking question channel.

**Why it matters.** Contact host is the highest-intent action on the page; interposing an account creation step loses the question entirely. Save as a login gate is defensible, Contact host is not.

**Fix.** Allow a first contact message with just a name and email (or a mailto), and prompt to create an account after send. Keep Save gated or store it locally.

**Acceptance.** An anonymous visitor can send a question from the listing without creating an account, and receives confirmation.

---

### LG-22 — The parking detail page is almost empty, so the vertical has no product page

- **Priority:** P1
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Listings and guest
- **Route:** /parkings/monaco-level-2-slot-27
- **Section/element:** Whole page
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/listings__parking-detail__d1440.jpg` (527px square hero anchored right, empty left half), `shots/listings__parking-detail__m390.jpg` (broken hero, breadcrumb wraps, sticky bar over "About this parking"), manifest height 1,021 at 390 and 1,612 at 1440, `copy.json` (total body: one sentence)

**What happens.** One image, a title, four spec chips, one sentence ("Covered slot beside the Monaco lobby lift, fits one car or two motorcycles"), then the footer. No map, no entrance/height guidance, no photos of the ramp or lift, no host note, no cancellation terms, no reviews. At 1440 the hero sits in the right column leaving 850px of white on the left.

**Why it matters.** Parking is sold as a separate vertical. A guest deciding whether their car fits has nothing to read, and the price (₱400/night, more than a hotel garage) has no justification.

**Fix.** Give it a proper product page: full-bleed hero, entrance photo, clearance/height, access instructions, walk time to the tower, photos, security, refund policy, reviews. Fix the desktop hero to span the content column.

**Acceptance.** Parking detail contains at least 3 photos, access instructions, an address + map, and a refund policy; the hero spans the full content width at 1440.

---

### MK-01 — Hero photograph contradicts the inventory and the brand

- **Priority:** P1
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Marketing
- **Route:** /
- **Section/element:** Hero background image (day + night variants)
- **Viewports:** 320/390/768/1024/1440
- **Evidence:** `./screenshots/public/marketing__home__d1440.jpg`, `./screenshots/public/marketing__home__m390.jpg`, live file `/marketing/home/hero-day-1280.avif`

**What happens.** The hero shows a multi-tower resort complex with a large colourful water-park slide array. The marketplace's only bookable stay is a studio in Azure North Residences, San Fernando, Pampanga. Nothing on the page is a water park.

**Why it matters.** The first image sets the price and quality expectation. A guest who books expecting the pictured resort and arrives at a condo studio has a legitimate complaint, and hosts cannot use this hero to represent their building. It also reads as generic stock/AI imagery on a trust-based booking product.

**Fix.** Replace the hero with a real photograph of an actual Kame Space stay or building. If the hero must stay abstract, use a wide interior from the Monaco 2604 listing. Keep the day/night pair but shoot both from the same property.

**Acceptance.** Hero `<img>` files are photographs of a property that exists in the catalogue; no water-park or non-catalogue resort appears on `/` at any width.

---

### MK-03 — Featured-stays section shows one card in a full-width band

- **Priority:** P1
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Marketing
- **Route:** /
- **Section/element:** "Find your next stay, home, or parking" listing band
- **Viewports:** 768/1024/1440 (390 less severe)
- **Evidence:** `./screenshots/public/marketing__home__d1440.jpg`, `marketing__t768.jpg`, `marketing__l1024.jpg`; live: section height 838px at 1440 with exactly one property card

**What happens.** A 838px-tall section contains a single ~250px card pinned to the left, with roughly 1,100px of empty canvas to its right. Under the card, the location chip "San Fernando 1" and the "Browse stays" button are centred on the full-width row, detached from the card they relate to. The tab row above offers "Stays 1 / Residences 1 / Parking 1" — filters over a population of one.

**Why it matters.** The section that is supposed to prove the marketplace has inventory proves the opposite. The staggered chip/CTA placement reads as a layout failure rather than a deliberate composition, and the 1-count filter chips advertise scarcity.

**Fix.** For a single result, switch to a deliberate "featured stay" composition: one wide card (image left, details right) spanning the content width, with the CTA inside the card. Hide the type tabs when the total is below the threshold where filtering is meaningful (or show them only when count > 1 per type).

**Acceptance.** At 1440 with one property, the section reads as one intentional feature block with no empty half; type tabs are absent or all show counts greater than 1.

---

### MK-04 — Suggested destinations lead straight to a dead end

- **Priority:** P1
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Marketing
- **Route:** /
- **Section/element:** Hero search → "Where" panel destination suggestions
- **Viewports:** all
- **Evidence:** live: opened "Where", picked "Boracay, Aklan", pressed Search → `/search?where=Boracay%2C+Aklan&adults=2` renders "No matches — Nothing available for "Boracay, Aklan""

**What happens.** The panel suggests Nearby, Manila, Boracay, Baguio, Cebu City and Palawan. All five named destinations have zero inventory. Selecting one and searching produces an empty results page.

**Why it matters.** The single most prominent interaction on the homepage teaches the user that the product has nothing for them. A guest who tries two suggestions concludes the site is empty; that is worse than offering no suggestions.

**Fix.** Derive suggestions from destinations that actually have published inventory (here: San Fernando, Pampanga). If a broader list is wanted for SEO, only show destinations with at least one live listing, and label the rest as "coming soon" instead of making them searchable.

**Acceptance.** Every destination in the suggestion list returns at least one result when searched; a search from any suggestion never lands on "No matches".

---

### MK-05 — Header nav overlaps the theme toggle at 1024

- **Priority:** P1
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Marketing
- **Route:** / (and /search, /services, /about, /contact, /support, legal — same header)
- **Verified note:** Verified at 1024: the "Services" link occupies x644-702 and the theme toggle x663-707, a ~39px overlap. The moon glyph draws on top of the word.
- **Section/element:** Primary nav last item "Services" vs theme toggle button
- **Viewports:** 1024 only (verified clean at 1152; mobile nav renders below ~1000)
- **Evidence:** `./screenshots/public/marketing__home__l1024.jpg`; live measurement at 1024 → "Services" right edge 702px, toggle left edge 663px, **39px overlap**; at 1152 the gap is −25px (clean)

**What happens.** The word "Services" is painted underneath the 44px theme toggle circle, producing a garbled "Servic◐s" glyph collision. The overlap persists across the whole ~1024–1130px band.

**Why it matters.** 1024 is a required viewport for this review and a common laptop/tablet-landscape width. It looks broken at exactly the size where the desktop layout is expected, and the last nav item becomes hard to read and click.

**Fix.** Add a breakpoint gap between the nav and the action cluster (e.g. reduce nav gap, hide the theme toggle until `xl`, or collapse to the mobile/tablet nav earlier). Ensure a minimum 16px gutter between the last nav item and the first action.

**Acceptance.** At 1024 and 1100, `servicesLink.getBoundingClientRect().right + 16 <= toggle.getBoundingClientRect().left`.

---

### MK-10 — /search has no h1

- **Priority:** P1
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /search
- **Section/element:** Page heading
- **Viewports:** 320/390/768/1024/1440
- **Evidence:** manifest `h1: []` for all four captures; live: `document.querySelectorAll('h1').length === 0`

**What happens.** The first heading on the page is `<h2>Properties1</h2>`, followed by `<h3>` cards. There is no top-level heading in either the results state or the empty state ("No matches" is an h2).

**Why it matters.** Screen-reader users get no page title in the heading list, and search engines see a results page with no primary topic. It also means every `/search` landing lacks the one heading that should announce what the user is looking at.

**Fix.** Add a single `<h1>` that reflects state, e.g. "Stays in San Fernando" / "Search results" / "No matches for Boracay", visually styled as the section label or visually hidden if the design must not change.

**Acceptance.** Exactly one `<h1>` exists on `/search` in both the results and empty states.

---

### MK-11 — Development card advertises "From ₱0 / night"

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /search
- **Section/element:** Developments result card price line
- **Viewports:** all
- **Evidence:** `search-lower.png`; live regex match on body text → `From ₱0 / night`

**What happens.** The Azure North Residences development card renders "From ₱0 / night" while the only unit inside it is ₱4,500/night. A development also has no nightly rate of its own.

**Why it matters.** A zero price reads as a data bug or a bait price. On a page whose job is to establish trust in pricing, it is the most damaging string on the screen.

**Fix.** Compute the development "from" price from its cheapest published unit (₱4,500 here), and omit the "/night" suffix or the whole price line when no unit price is available.

**Acceptance.** No card on `/search` renders `₱0`; the development card shows the cheapest child unit price or no price line.

---

### MK-13 — Parking result card renders a broken image and its alt text as visible content

- **Priority:** P1
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Marketing
- **Route:** /search
- **Section/element:** Parkings result card media
- **Viewports:** all
- **Evidence:** manifest `brokenImages: ["https://images.unsplash.com/photo-1590674899484-f5649e4292cf?w=1200&q=85"]`; `search-lower.png` shows "Azure North Residences, Parking Slot" text spilling over the "Inside tower" badge, then a grey gradient with a white "27"

**What happens.** The remote Unsplash request fails (404/blocked), so the browser renders the alt text inside the image box, overlapping the card badge; with no image the white "27" slot number sits on a near-white gradient (measured contrast 1.0).

**Why it matters.** Third-party image hosts are a single point of failure for the whole results grid, and the failure mode is visibly broken rather than a graceful placeholder. It also drags CWV and reliability for every search visitor.

**Fix.** Move listing media to owned storage (Supabase Storage) with a local fallback; on error render a branded placeholder and hide overlays that depend on the image (badge, large slot number).

**Acceptance.** `brokenImages` is empty at every viewport; simulating an image failure shows a branded placeholder with legible overlays and no visible alt-text spill.

---

### MK-19 — /for-hosts has three h1 elements, one of them from a screenshot mock

- **Priority:** P1
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /for-hosts
- **Section/element:** Page headings, including the fake dashboard sidebar
- **Viewports:** all (manifest recorded 4 at some widths)
- **Evidence:** live `h1s` → `["Run every stay from one dashboard", "Your rentals, run for you.", "Dashboard"]`; manifest `h1: 4`

**What happens.** The hero headline, the product-mock tagline and the literal word "Dashboard" inside the decorative dashboard sidebar are all `<h1>`. "Dashboard" is a nav label in a marketing illustration.

**Why it matters.** The document outline is meaningless to assistive tech, and one of the top-level headings is a fake UI label. It also splits SEO signal across three headings.

**Fix.** Keep one `<h1>` (the hero). Demote the mock tagline to `<p>` and every label inside the product illustration to `<div>`/`<span>`, and mark the illustration `aria-hidden="true"` with an adjacent text description.

**Acceptance.** Exactly one `<h1>` on `/for-hosts`; the marketing mock contributes no headings.

---

### MK-20 — "Reviews" nav link points at an anchor that does not exist

- **Priority:** P1
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Marketing
- **Route:** /for-hosts, /for-hosts/pricing
- **Section/element:** Host nav item "Reviews" → `#reviews`
- **Viewports:** all
- **Evidence:** live: clicked `a[href='#reviews']` → `location.hash` stays empty, `scrollY` stays 0; page `id` list is `root, radix-*, grid, features, how-it-works, mode-transition-overlay` — no `reviews`

**What happens.** The link is dead. There is also no reviews/testimonials section anywhere in the page copy, yet "Reviews" is one of four primary nav items.

**Why it matters.** A headline nav item that does nothing is an immediate credibility hit on the page that is supposed to sell the product, and it is one of four items competing for attention.

**Fix.** Either add the reviews section with `id="reviews"` (there are no testimonials today, so this needs content) or remove the nav item. If reviews are aspirational, use a proof strip instead of a nav destination.

**Acceptance.** Clicking every host nav item scrolls to an existing section or navigates; no anchor resolves to zero-height target.

---

### MK-21 — Host hero H1's second line fails AA large-text contrast

- **Priority:** P1
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /for-hosts (also /for-hosts/v2, /for-hosts/v3)
- **Section/element:** H1 emphasis span "from one dashboard"
- **Viewports:** 390/768/1024/1440
- **Evidence:** live computed `color: rgb(36, 168, 142)` at 60px/900 on a near-white band; recomputed contrast ≈ **2.97:1** against white (AA large text needs 3:1); manifest flags the same span at 2.8 need 3

**What happens.** The most important words on the host landing page are brand teal on white at just under the 3:1 threshold, and the backdrop is a soft gradient so it dips lower in places. `/v2` ("dashboard.") and `/v3` ("from one place.") repeat the same treatment at 62–63px.

**Why it matters.** The headline is the one element every visitor reads; at 2.97:1 it is a measurable accessibility failure and visually thin at large sizes.

**Fix.** Use the darker brand token for text on light surfaces (the `--primary-strong` family, ≈4.5:1 against white) for these spans, keeping the lighter teal for fills and icons.

**Acceptance.** Computed contrast of the emphasized H1 span is ≥ 3:1 at every rendered width and ≥ 4.5:1 if the span ever drops below 24px.

---

### MK-22 — Host landing content column is ~740px wide on a 1440 canvas

- **Priority:** P1
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Marketing
- **Route:** /for-hosts
- **Section/element:** Whole page content width
- **Viewports:** 1024/1440
- **Evidence:** `./screenshots/public/for-hosts__for-hosts__d1440.jpg` — hero, video panel and step cards all sit in a ~740px column centred in 1440, with ~350px of empty margin each side; `/about` by comparison uses ~1120px

**What happens.** The page reads as a tablet layout on a desktop monitor. The H1 wraps to two lines at 60px inside 740px, the 4-step row is cramped, and the "HOW IT WORKS" cards are ~170px wide each.

**Why it matters.** The host landing page is the highest-value marketing surface and it looks under-built next to the guest pages. Wasted horizontal space makes a full product look thin, and cramped cards push body copy to 13–14px with tight line lengths.

**Fix.** Adopt the site's wider content width (1120–1200px) for the hero and step sections; keep the long-form video panel narrower if desired but give the surrounding layout a real desktop grid (e.g. hero copy left, product panel right).

**Acceptance.** At 1440 the primary content spans ≥ 1100px; no section leaves more than ~120px of unused margin per side.

---

### MK-27 — The Free plan is off-screen when the pricing carousel loads

- **Priority:** P1
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Marketing
- **Route:** /for-hosts/pricing
- **Section/element:** "Choose your plan" carousel
- **Viewports:** 1024/1440 (and 390, where one card shows at a time)
- **Evidence:** `pricing-initial.png` shows Starter / Pro / Business; live card geometry at 1440 → cards 376px wide at x = −344 (Free), 94 (Starter), 532 (Pro), 970 (Business), 1408 (Managed); clicking "Choose plan to Free" fails with "element is outside of the viewport"

**What happens.** The carousel is pre-scrolled so the Free card sits entirely left of the container. The headline promises "Start free on one listing", but the first price a visitor sees is ₱399, and reaching Free needs two presses of a 32px arrow.

**Why it matters.** This is the primary conversion surface for hosts, and the entry-level offer — the one the hero promises — is hidden. Visitors with no budget read four paid plans and leave.

**Fix.** Show all five plans in a responsive grid on desktop (or at least start at index 0 with Free first and a page indicator), and put Free visually first in DOM and scroll order.

**Acceptance.** On first paint at 1440, the Free plan card is fully visible without interaction; the carousel exposes a position indicator and ≥44px controls.

---

### MK-30 — Compare-features table is unreadable on a phone

- **Priority:** P1
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Marketing
- **Route:** /for-hosts/pricing
- **Section/element:** "Compare features" table
- **Viewports:** 320/390/768
- **Evidence:** `./screenshots/public/for-hosts__for-hosts-pricing__m390.jpg`, `pricing-390-bottom.png`; live at 390 → table content 755px inside a 326px scroller, first column sticky, header row **not** sticky, 62 rows, 5 plan columns ≈ 90px each

**What happens.** Feature names wrap to 3–4 lines, each plan column is a narrow strip of "—", and once you scroll past the header you can no longer tell which column is which. The final "Choose plan" buttons are clipped by the horizontal scroll edge.

**Why it matters.** The comparison table is where a buyer decides between tiers. On the device most hosts actually use, it is unusable and there is no alternative view.

**Fix.** Below `md`, replace the table with per-plan accordions (plan name + price as the summary, feature list inside) or a single "what's in each plan" list group with tier chips. If keeping the table, make the header row sticky and pin the plan name + price under each column.

**Acceptance.** At 390 a user can identify the plan for any cell without horizontal scrolling; no CTA is clipped.

---

### MK-32 — Supported FAQ contains a literal `<step>` placeholder

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /support
- **Section/element:** Hosts FAQ, "Can I go back a step if I made a mistake on a booking?"
- **Viewports:** all
- **Evidence:** live: `dd` text matches `Return to <step> at the bottom left…`; also present in `copy.json` support strings

**What happens.** A template placeholder was never substituted, so the answer tells the reader to press a button literally named `<step>`.

**Why it matters.** This is the single most obvious "unfinished product" tell on a public support page, and it is in the answer to a question about recovering from mistakes.

**Fix.** Replace with the real label, e.g. "Return to Review" / "Return to the previous step" (naming the current previous stage), or "the Return to… button at the bottom left".

**Acceptance.** No angle brackets appear in rendered copy on any public page; manual scan of `document.body.innerText` for `<` returns no placeholder text.

---

### MK-35 — /contact promises a message form that requires an account and never appears

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Marketing
- **Route:** /contact
- **Section/element:** Four category cards (Broken / Idea / Question / Business) and page heading
- **Viewports:** all
- **Evidence:** `./screenshots/public/marketing__contact__d1440.jpg`; live signed-out click on "Broken" → shows a bare "Log in or sign up" modal (`contact-authgate.png`) with no explanation, no category context, and no email fallback. Signed-in click opens a "New ticket" modal instead.

**What happens.** The page is titled "Send us a message" and offers four choices, but the email address is the only action that works without an account. A signed-out visitor who picks a category is dropped into an unexplained auth wall.

**Why it matters.** The people most likely to report a bug are the least likely to have an account, and this is the site's only public contact path. Losing them at an unexplained login is the worst possible outcome for a support surface.

**Fix.** Either allow signed-out submissions (email + message + honeypot/Turnstile) or make the auth wall explicit: a modal titled "Sign in to open a ticket" that names the category, explains why, and offers "or email us at kameworks.tech@gmail.com". Keep the email CTA inside the modal.

**Acceptance.** From a signed-out state, a visitor can send a message end-to-end without creating an account, or the modal states the reason and provides an email fallback in one click.

---

### MK-38 — /about reads like release notes, not an about page

- **Priority:** P1
- **Type:** COPY · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /about
- **Section/element:** Hero and six capability cards
- **Viewports:** all
- **Evidence:** `./screenshots/public/marketing__about__d1440.jpg`; copy inventory long strings: "Guests book through property calendars and forms. Hosts and teams run each stay through a status workflow with email automation where configured.", "Run multiple listings with team roles and permission-scoped dashboards", "IDs, receipts, and stay papers go through structured review, including AI checks where you enable them."

**What happens.** The page describes internal architecture to a public audience. "One operating system", "status workflow", "permission-scoped dashboards", "where you enable them" and "structured review" are engineering phrases; there is no story, no team, no photographs, no numbers, and the only human detail is a one-line "Based in Manila".

**Why it matters.** /about is a trust page. Today it answers "what features exist" (already answered on /for-hosts) and never answers "who are you, why should I trust you with my booking". It is also the page a host checks before paying.

**Fix.** Rewrite around the operator: who runs Kame Space, from where, how many stays hosted, why direct booking. Keep two or three capability cards maximum, in plain language, and cut the dashboard vocabulary entirely.

**Acceptance.** No internal terms (status workflow, permission-scoped, AI checks where you enable them) remain; the page contains at least one specific, verifiable fact about the company.

---

### MK-39 — /services is a top-level nav destination that is a "Coming Soon" placeholder

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /services (linked from every header and footer)
- **Section/element:** Whole page
- **Viewports:** all
- **Evidence:** `./screenshots/public/marketing__services__d1440.jpg`; live snapshot: `region "Coming Soon"` + a `list[aria-hidden]` of 7 chips

**What happens.** One of four primary nav items resolves to a centred "Coming Soon" with ~700px of empty space above and below at 1440. The page also keeps a live search bar ("What / When") for services that do not exist.

**Why it matters.** A dead top-level nav item teaches visitors that some of the site is unfinished, and it occupies the most valuable navigation real estate on every page (including the 404 and the legal pages).

**Fix.** Remove Services from the primary nav and footer until there is content, or replace the page with a real "what we offer" list. If it must stay, drop the search bar and give it one useful action (request a service / notify me).

**Acceptance.** No primary nav destination is a placeholder; `/services` either has bookable content or is unlinked from nav.

---

### MK-45 — Host login page has four h1s, one of them a mock label

- **Priority:** P1
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /for-hosts/login
- **Section/element:** Page headings
- **Viewports:** 1024/1440
- **Evidence:** live signed-out `h1` list → `["Property management made simple", "Your rentals, run for you.", "Dashboard", "Log in or sign up"]`

**What happens.** The marketing tagline, the mock tagline, a sidebar label inside the mock and the actual form heading are all `<h1>`.

**Why it matters.** The page's real heading ("Log in or sign up") is the fourth and least prominent in the outline, and the marketing panel competes with the form for the top-level landmark.

**Fix.** One `<h1>` on the form heading; the left panel becomes decorative (`aria-hidden` with a short accessible description or a plain `<p>`).

**Acceptance.** Exactly one `<h1>` on /for-hosts/login.

---

### P4-02 — Trip links cannot be opened by the guest who received them

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Public surface
- **Route:** /properties/kame-home/trip
- **Section/element:** whole page
- **Viewports:** all
- **Evidence:** live: anonymous → h1 "Sign in to see your trip" and copy "Use the email you booked with, or open the link from your booking email"; signed in as a different guest → h1 "Booking not found".

**What happens.** the only path is a sign-in button. There is no "email me my trip link", no booking-reference entry, and no token in the emailed URL. Anonymous bookings therefore have no way back to their trip.

**Why it matters.** the trip page holds the documents, payment status and stay guide. Losing it sends the guest to support or, worse, nowhere.

**Fix.** issue a signed trip token in the booking email (the stay-guide token already exists) and render the trip for token holders, not just account holders. Add "resend trip link" on the sign-in state.

**Acceptance.** the emailed link opens the trip without an account; a wrong-account session does not block a valid token.

---

### P4-03 — The calendar shows no availability state

- **Priority:** P1
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Public surface
- **Route:** /properties/kame-home/calendar
- **Section/element:** month grid, "Select dates to continue"
- **Viewports:** 320, 390, 768, 1024, 1440
- **Evidence:** measured DOM states: 1-18 disabled (past, plus the 18th booked), 23/24 and 28-30 disabled (booked or blocked), 19-22 and 25-27 selectable. `aria-label` is correct ("November 18, booked" / "November 19, available") but **past and booked render identically** (same `text-muted-foreground/30`, 1.54:1), there is no legend, no price, and the primary button is disabled with no reason.

**What happens.** a guest cannot tell a past night from a booked one, cannot see a rate, and gets a disabled button with no instruction.

**Why it matters.** the calendar is the entry point to booking. Without availability, the guest has to guess and the disabled button reads as broken.

**Fix.** three states (available / booked / past) with a legend, a nightly price on the selected range, a minimum-stay hint, and helper copy under the disabled button.

**Acceptance.** a booked night is visually distinct from a free one at 390, and selecting two dates shows a total.

---

### P4-04 — The pay-parking link silently redirects to the listings

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Public surface
- **Route:** /properties/kame-home/parking/:bookingId
- **Section/element:** route guard
- **Viewports:** all
- **Evidence:** live: anonymous visit to `/properties/kame-home/parking/5eed1100-…-0001` lands on `/parkings` with the parkings list rendered and no message.

**What happens.** the payment link from an email dumps the guest into browsing unrelated slots.

**Why it matters.** the guest cannot pay, and has no idea why they are on a listings page.

**Fix.** render an explanatory state ("Sign in with the email you booked with to pay") or accept a payment token, then redirect back to the payment.

**Acceptance.** the link never lands on an unrelated page without an explanation.

---

### P4-05 — The showcase page duplicates the listing and leaks the demo host

- **Priority:** P1
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Public surface
- **Route:** /properties/kame-home/showcase
- **Section/element:** "Your host", footer contact
- **Viewports:** 390, 768, 1440
- **Evidence:** screenshot `./screenshots/public/guest-flow__showcase__m390.jpg`: "Your host / Demo Manager / VERIFIED / manager.demo@example.com / Contact", repeated in the footer; the page repeats gallery, about, amenities and two booking CTAs already on `/properties/kame-home`.

**What happens.** a marketing page for hosts is publicly reachable and publishes a demo identity and email to guests; it also duplicates the listing detail with less information.

**Why it matters.** guests see a fake host, and the page competes with the real listing in search.

**Fix.** keep the showcase behind the host preview (`?preview=1`) or make it a strictly different artefact; never render a seed identity on a public route.

**Acceptance.** no `@example.com` address or "Demo" persona on any public page.

---

### P4-07 — Four browse pages have no h1

- **Priority:** P1
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Public surface
- **Route:** /search, /properties, /parkings, /developments
- **Section/element:** page heading
- **Viewports:** all
- **Evidence:** manifest `h1: []` at 390 and 1440 for all four.

**What happens.** the document outline starts at h2, and the page has no accessible name.

**Why it matters.** screen-reader and search-engine understanding of the four main browse pages.

**Fix.** add a visually hidden or visible h1 ("Properties", "Parkings for rent").

**Acceptance.** exactly one h1 per route.

---

### P4-15 — Contact cannot be used without an account

- **Priority:** P1
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Public surface
- **Route:** /contact
- **Section/element:** four category buttons
- **Viewports:** all
- **Evidence:** live: clicking "A page or feature isn't working" opens the sign-in dialog (only Continue / Continue with Google); no email form exists on the page.

**What happens.** the page says "Send us a message" but a guest without an account has no way to send one.

**Why it matters.** support access is blocked behind the account the user does not have.

**Fix.** a guest contact form (name, email, message, booking reference) that opens a ticket server-side, or a mailto fallback that works.

**Acceptance.** an anonymous visitor can submit a message.

---

### AC-02 — Wrong OTP surfaces a raw provider error string

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /for-hosts/login, /for-guests/login (code step)
- **Section/element:** OTP error under the heading
- **Viewports:** 320, 390, 768, 1024, 1440
- **Evidence:** live: `probe-p4b-2.json → otpWrong.body` = `"Token has expired or is invalid"`

**What happens.** Entering a wrong six-digit code prints "Token has expired or is invalid". The phrase is Supabase's, it does not say what to do, and it appears as free text above the boxes rather than being tied to them.

**Why it matters.** The user just typed six digits and is told their token expired. The actual likely cause is a typo. There is no per-field state and no `aria-live`/`aria-describedby` relationship, so a screen-reader user gets nothing when the code fails.

**Fix.** "That code did not work. Check the six digits, or send a new code." Attach it to the OTP group with `aria-describedby` and `role="alert"`, and clear the boxes on failure.

**Acceptance.** A wrong code shows the new sentence, focused box is empty, screen reader announces the failure once, and the countdown keeps running.

---

### AC-03 — Host login loses the product story on mobile, guest login keeps three screens of it

- **Priority:** P2
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Auth, account and admin
- **Route:** /for-hosts/login vs /for-guests/login
- **Section/element:** hero / "WHY SIGN IN" block
- **Viewports:** 390 (1440 unaffected)
- **Evidence:** `./screenshots/public/auth__host-login__m390.jpg` (bare form, then footer) vs `./screenshots/public/auth__guest-login__m390.jpg` (form, then a full "WHY SIGN IN" panel with app mock)

**What happens.** At 390 the host login is a naked form with ~370px of empty space below the terms before the footer. The guest login stacks the same form and then a 900px marketing panel underneath it. Same component, two different content decisions.

**Why it matters.** The host side is the paid conversion surface and it has the least reassurance at the size where most hosts arrive. The empty half-screen reads as an unfinished page.

**Fix.** Pick one rule. Simplest: one hero/marketing block on both, placed **below** the form on mobile (as guest login already does) and suppressed on very short viewports; or remove it from both at `<lg`. Do not ship one with and one without.

**Acceptance.** At 390 both logins have the same above-the-fold structure and neither ends in a blank half-screen.

---

### AC-04 — The guest login hero advertises a product that does not exist

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /for-guests/login, /for-guests/register
- **Section/element:** hero mock ("Search the way you talk")
- **Viewports:** 390, 1440
- **Evidence:** `./screenshots/public/auth__guest-login__d1440.jpg`; live `probe-p4b.json → guestLoginAfterEmail.text`

**What happens.** The mock shows a natural-language search ("beach condo for 4"), three invented listings (Sunset 1BR Condo Boracay ₱3,200, Shoreline Studio La Union, Bayside Loft Cebu), and a seven-tab app nav: **Search, Book, Chat, Trip, Guide, Perks, Compare**. The shipped site nav is Developments, Properties, Parkings, Services, and the only seeded listing is Monaco 2604 at ₱4,500.

**Why it matters.** A sign-in screen is a promise. Guests who sign in expecting chat, perks, compare and voice-style search land on a single-listing marketplace. It also undermines trust in the real numbers on the listing pages.

**Fix.** Either ship the mock's surface, or make the mock match the product: real nav, one real listing, no feature that has no route. If the mock is a deliberate future vision, label it as such.

**Acceptance.** Every control and label inside the login mock exists as a route or is removed.

---

### AC-07 — Profile repeats the whole identity block twice before the first field

- **Priority:** P2
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Auth, account and admin
- **Route:** /account/profile
- **Section/element:** identity card + form
- **Viewports:** 320, 390, 768
- **Evidence:** `./screenshots/public/account__profile__s320.jpg`, `./screenshots/public/account__profile__m390.jpg`; manifest `profile m390 height 1909`

**What happens.** The card shows avatar, name, email, location, phone and bio. Immediately below, the form repeats Display name, Bio, Phone, Location. At 320 the header block alone is ~430px, so the first editable field starts around y≈700 and Save is around y≈1250. Total mobile page height 1909px for four fields.

**Why it matters.** The page's only job is editing. Two-thirds of the first two screens is a read-only restatement of the fields directly beneath it, and the duplication makes the user check whether the header updates when the form does.

**Fix.** One identity card with the avatar and email as metadata (not repeated as fields), then the editable fields. Drop the bio/location/phone lines from the header, or delete the form duplicates and edit in place.

**Acceptance.** At 390 the first editable input is within the first viewport after the avatar, and no value is rendered twice.

---

### AC-09 — Push-alert toggle never resolves

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /account/profile
- **Section/element:** "Alerts on this device" card
- **Viewports:** all
- **Evidence:** `./screenshots/public/account__profile__m390.jpg` and `./screenshots/public/account__profile__d1440.jpg` both show a disabled switch and "Checking this device…"

**What happens.** The card renders "Checking this device…" with the switch disabled. It is still in that state in every captured viewport and after full page load.

**Why it matters.** A permanently pending permission check is indistinguishable from a broken permission prompt. The user cannot turn alerts on or off and gets no reason.

**Fix.** Resolve the check into one of three stable states: "Alerts are off · Turn on", "Blocked in your browser settings · How to fix", "On". Cap the checking state at ~2s and fall back to the off state.

**Acceptance.** The card reaches a terminal state on a first visit with notifications unset, and the switch is operable or explains why it is not.

---

### AC-12 — A future trip is filed under PAST

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /account/trips
- **Section/element:** PAST group
- **Viewports:** all
- **Evidence:** `./screenshots/public/account__trips__m390.jpg`, `./screenshots/public/account__trips__d1440.jpg`; live `probe-p4b-3.json → tripRows` = `Monaco 2604Feb 1-2, 2027Completed`

**What happens.** With today at 18 Nov 2026, "Monaco 2604 · Feb 1–2, 2027 · Completed" sits in the PAST group, above an Oct 24–26, 2026 trip that is labelled "Ready for check-in".

**Why it matters.** The grouping is by status, not date, so the list contradicts itself: a completed stay in the future and an unfinished stay in the past. A guest scrolling for their next trip finds it below the fold under a heading that says the opposite.

**Fix.** Group by date (upcoming = check-in ≥ today), and show status as a badge only. Separately, flag the Oct 2026 booking that is still "Ready for check-in" as stale.

**Acceptance.** No trip with a future check-in date appears under PAST; group membership is derivable from the visible date.

---

### AC-13 — Broken thumbnail on the parking trip row

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /account/trips
- **Section/element:** "Azure Monaco – Level 2 - Slot 27" row thumbnail
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `./screenshots/public/account__trips__m390.jpg` (broken-image glyph); live `probe-p4b-3.json → tripImgs` — `es.unsplash.com/photo-1590674899484-...` returns `naturalWidth: 0`

**What happens.** The parking booking's thumbnail is a broken image (the host is `es.unsplash.com`, a malformed variant of `images.unsplash.com`). The other rows fall back to a suitcase icon.

**Why it matters.** A broken-image icon on the guest's own trip list is the single most "unfinished" signal in the account area, and it appears on every viewport.

**Fix.** Fix the stored URL, and add an `onError` fallback to the same suitcase icon the other rows use so a bad URL can never render a broken glyph.

**Acceptance.** No `naturalWidth === 0` images on `/account/trips`; a deliberately bad URL falls back to the icon.

---

### AC-14 — Same parking listing named two different ways

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /account/trips, host Dashboard recent bookings
- **Section/element:** listing title
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__onboarding__d1440.jpg` shows "Azure Monoco – Level 2 - Slot 27"; `./screenshots/public/account__trips__d1440.jpg` and live `tripRows` show "Azure Monaco - Level 2 - Slot 27"

**What happens.** One listing renders as **Monoco** with an en dash and a hyphen in the host surface, and **Monaco** with two hyphens in the guest surface.

**Why it matters.** It is the same bookable object. A guest searching their email for "Monoco" will not find "Monaco", and the dash mix makes the string look machine-assembled.

**Fix.** Store one canonical display name; build it as `Development · Level 2 · Slot 27` from parts rather than a free-text string.

**Acceptance.** The listing name is byte-identical across guest trips, host bookings and emails.

---

### AC-16 — Messages is one row over 600px of nothing, authored by "seed-owner"

- **Priority:** P2
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Auth, account and admin
- **Route:** /account/messages
- **Section/element:** conversation list
- **Viewports:** 390, 768
- **Evidence:** `./screenshots/public/account__messages__m390.jpg`; live `probe-p4b-3.json → msgs` (main text is one row; tall box 652px, `scrollH 955`)

**What happens.** The card holds a single conversation row ("Monaco 2604 / **seed-owner** / about 3 hours ago / AUDIT-MESSAGE please ignore") and then ~600px of empty white. At 390 there is no thread pane and no empty-state copy for it. The sender is rendered as the raw account handle `seed-owner`.

**Why it matters.** Two problems in one viewport. The layout is a two-pane desktop pattern collapsed without a plan for the collapsed state, and a guest is shown an internal account handle instead of a person or property name.

**Fix.** Collapse to a single list with real sender names ("Kame Space · Monaco 2604"), and either open a thread route or show a "Select a conversation" empty state instead of blank card. Never render the auth handle.

**Acceptance.** At 390 the list fills the card or shows an explicit empty state; no message shows an email local-part as the sender.

---

### AC-17 — Vouchers have no expiry, no code, and no way to use them

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /account/vouchers
- **Section/element:** voucher card "STAY10 / ₱10 off"
- **Viewports:** all
- **Evidence:** `./screenshots/public/account__vouchers__m390.jpg`; live `probe-p4b.json → vouchers` (no toast on tapping the code, button list contains no per-voucher action), `probe-p4b-3.json → vouchers1440`

**What happens.** One card: "READY TO USE / STAY10 / ₱10 off / Monaco 2604 · Awarded 10 days ago / Book again". There is no expiry, no minimum spend, no copy-code control (tapping the code does nothing), and no Used/Expired section. "₱10 off" is 0.2% of a ₱4,500 stay.

**Why it matters.** A voucher you cannot copy, whose validity you cannot check, and whose value is negligible is decoration. The guest has no path from "I have a voucher" to "it applied".

**Fix.** Show code with a copy button and a copied state, expiry date, and the condition. Add Used/Expired groups. Give the seeded voucher a realistic value.

**Acceptance.** Copying a code produces a visible confirmation and a pasteable value; each voucher states an expiry date.

---

### AC-18 — Favorites truncates the only listing at 390

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /account/favorites
- **Section/element:** listing card
- **Viewports:** 320, 390, 768
- **Evidence:** `./screenshots/public/account__favorites__m390.jpg`; live `probe-p4b-3.json → fav` — card 156px inside a 324px `grid-cols-2` parent, title renders "CONDO in San…"

**What happens.** The grid is `grid-cols-2` below `sm`, so each card is 156px wide and the title truncates to "CONDO in San…". With one favourite, the right half of the row is empty.

**Why it matters.** The card's title is the only way to tell what was saved, and it is cut. On a saved-items page the identifier must never be the thing that truncates.

**Fix.** One column below `sm` (or 2 columns only from 400px), two-line clamp for the title instead of single-line ellipsis, and keep the price/rating row intact.

**Acceptance.** At 390 the full listing title is readable and the card fills its row.

---

### AC-20 — New ticket sheet opens with the Details field sliced by Submit

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /account/tickets/new
- **Section/element:** bottom sheet, first paint
- **Viewports:** 390
- **Evidence:** `./screenshots/public/account__tickets-new__m390.jpg`, `shots/live-ticket-390.png`; live `probe-p4b.json → ticketNew` (dialog 704px tall at y=140, textarea at y=794, Submit at y=788)

**What happens.** On first open, the sheet's scroll region ends behind the sticky Submit bar: the "Details *" label is half visible and the textarea sits under the footer. Scrolling reaches it (textarea moves to y=437 once scrolled), so it is recoverable, but the first frame shows a form that looks clipped.

**Why it matters.** A required field that appears cut in half at the exact moment the user is deciding whether to fill the form is a drop-off point, and it looks like a layout bug.

**Fix.** Add bottom padding to the scroll region equal to the footer height, or start the sheet at full height (`h-[100dvh]`) with the options block scrollable.

**Acceptance.** At 390×844 the last field's label is fully visible or fully out of view on first paint; nothing is sliced by the footer.

---

### AC-23 — Playbook renders the database slug under every article title

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /admin/playbook
- **Section/element:** article card subtitle
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__admin-playbook__d1440.jpg` — `audit-blocked-dates`, `extend-your-calendar`, `collect-outstanding-balances`, `highlight-amenities-in-title`, `publish-public-page-updates`

**What happens.** Under each human title, the raw key renders in monospace-ish muted text, at the same visual level as the body copy.

**Why it matters.** This is a content tool for super admins; the key is useful for developers, not for the person deciding whether a tip should be published. It reads as an un-stripped internal field.

**Fix.** Move the key to a tooltip or the edit dialog, or render it as a `code` chip visually subordinated to the description. Never make it the second line of the card.

**Acceptance.** Card subtitle is human copy; the key is only visible on hover/expand or inside edit.

---

### AC-24 — The bare "31" pill is a pagination size with no pagination

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /admin/playbook, /admin/support/faqs
- **Section/element:** top-right of the list
- **Viewports:** all
- **Evidence:** live `probe-p4b-2.json → playbookCtl` = `{tag: BUTTON, role: combobox, txt: "31", aria "Items per page", w: 56}`; 17 playbook articles and 31 FAQs on one page

**What happens.** A small pill showing only "31" floats at the right of the list. Its accessible name is "Items per page". There is no page indicator, no prev/next, and both lists fit on one page, so the control changes nothing visible.

**Why it matters.** An unlabelled number in the corner of a list is a puzzle, and a page-size selector with one page is a dead control that implies missing content ("there are more, but where?").

**Fix.** Remove it while total ≤ page size; when it is needed, label it on screen ("Show 31") and pair it with real paging.

**Acceptance.** The control is absent when the list fits on one page; when present it is labelled and changes the visible rows.

---

### AC-25 — Playbook clamps body copy to two lines on mobile with no way to expand

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /admin/playbook
- **Section/element:** article description at 390
- **Viewports:** 320, 390
- **Evidence:** `./screenshots/public/admin-gap__admin-playbook__m390.jpg`; live `probe-p4b-3.json → playbookClamp` = `webkitLineClamp: "2", scrollHeight 114, clientHeight 46`

**What happens.** The description is clamped to 2 lines and ends mid-sentence ("Review your calendar each…"). There is no expand affordance and the card is not tappable except for the toggle and the pencil/trash.

**Why it matters.** The advice is the entire value of the item. Super admins are being asked to publish or delete tips they can only half read.

**Fix.** Remove the clamp (the cards already scroll), or add a "Show more" toggle and make the whole card expand.

**Acceptance.** Every article's full text is reachable at 390 without editing it.

---

### AC-27 — 31 FAQs, nine categories, no search and no filter

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /admin/support/faqs
- **Section/element:** list toolbar
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__admin-faqs__d1440.jpg` (stat cards: Total 31, Published 31, Unpublished 0, Categories 9); live `probe-p4b.json → faqs` = `inputs: []`, `combobox: []`

**What happens.** The page has no input of any kind. Categories are headings only. To find one FAQ among 31 in 9 groups the user scrolls a 5,000px list.

**Why it matters.** This is the tool for answering "what do we tell hosts about X", and the only affordance is scrolling. It is also the page where a wrong or stale answer would be fixed.

**Fix.** Add a search field over question + answer, a category filter, and a Published/Unpublished filter derived from the existing stat cards.

**Acceptance.** Typing a phrase narrows the list to matching FAQs; choosing a category narrows to that group.

---

### AC-29 — Ops reports show "CRITICAL 0" in red on every row and two different "current weeks"

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /admin/ops-reports
- **Section/element:** report rows
- **Viewports:** 390, 1440
- **Evidence:** `./screenshots/public/admin-gap__admin-ops-report__d1440.jpg`, `..._m390.jpg`; live manifest contrast sample (HIGH 0 at 3.6:1 ×3)

**What happens.** Every row carries four pills. "CRITICAL 0" is red on all four rows, including the three healthy ones, so the loudest colour on the page means zero. Row labels mix conventions: "Current week · Nov 16–23", "Week of · Nov 11–18", "Current week · Nov 15–18" (two rows both claim "Current week" with different ranges). Timestamps have no timezone.

**Why it matters.** Severity colour is an alarm channel. Painting a zero red trains the reader to ignore red. The three labeling conventions and the two overlapping "current weeks" make the list unusable as a history.

**Fix.** Hide zero-count pills; show only CRITICAL/HIGH/MEDIUM when > 0. Standardise the label to "Week of <Mon DD>" plus an explicit "manual run" tag, and add "Asia/Manila" to timestamps.

**Acceptance.** No zero-value pill renders; no two rows share a "current week" label with different ranges.

---

### AC-30 — Ops report detail exposes "Copy agent prompt" and env-var names

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /admin/ops-reports/:reportId
- **Section/element:** header actions + Sources
- **Viewports:** all
- **Evidence:** live `probe-p4b-4.json → opsDetail` = `Copy agent prompt | Download .md | Send email | ... SKIPPED Sentry errors | Not configured (SENTRY_AUTH_TOKEN, SENTRY_ORG_SLUG, SENTRY_PROJECT_SLUG)`

**What happens.** The report header offers "Copy agent prompt" as a top-level action, and source status explains itself by naming unset environment variables.

**Why it matters.** "Copy agent prompt" reveals the internal AI ops workflow inside a product admin surface and is meaningless to anyone who does not already know the pipeline. Env-var names are a developer's debugging shortcut, not a status message.

**Fix.** Move "Copy agent prompt" behind a developer menu or remove it from the product surface. Rewrite source rows as "Sentry: not connected" with a "Connect" link.

**Acceptance.** The report page has no reference to an agent prompt or to an env-var name; every skipped source states the user-level consequence.

---

### AC-32 — The AI page shows a projection below actual spend and a chart with no bars

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /admin/ai?tab=usage (from /admin/ai-usage)
- **Section/element:** KPI row and "Cost by feature" chart
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__admin-ai-usage__d1440.jpg`

**What happens.** "Spend $1.13" beside "Projected this month **$1**" (a projection lower than spend to date, and formatted without cents). "Cost by feature" renders an empty plot: axis $0.00–$4.00, no bars, with the single series label "Dashboard assistant (complex turn)" floating in the middle of the plot area. "Feature health" reports Calls 0, Credits 0, Errors 2 (100%).

**Why it matters.** Spend is money. A projection below actual and a 100% error rate on zero calls means at least one number is wrong, and an admin cannot tell which. The empty chart reads as a rendering failure.

**Fix.** Format all currency to 2dp with one formatter; make projection `max(spend, forecast)` or hide it until mid-period; render the empty chart as a real empty state ("No AI spend in this range"); guard the error percentage against a zero denominator.

**Acceptance.** Currency formatting is identical across the tile row, the chart renders bars or an empty state, and no percentage is computed from zero calls.

---

### AC-34 — Payment rail switches lose their row at 390

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /admin/pricing/payment-settings
- **Section/element:** rail rows
- **Viewports:** 320, 390
- **Evidence:** `./screenshots/public/admin-gap__admin-payment-settings__m390.jpg` — "QR Ph" with the switch on the next line, left-aligned

**What happens.** Below `sm` the label and its switch stack vertically, so the control sits under the text at the left edge instead of opposite it. Each rail consumes two lines.

**Why it matters.** The pattern breaks the platform's own settings-row convention and makes a three-item list look like six rows. A left-aligned switch also loses the "this row is on" reading.

**Fix.** Keep label left / switch right on one row at every width (`justify-between`, `shrink-0` on the switch), with the description wrapping under the label only.

**Acceptance.** At 390 each rail is one row with the switch at the right edge.

---

### AC-35 — Development detail truncates a section name and drops the section nav on mobile

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /admin/developments/azure-north-residences
- **Section/element:** section rail
- **Viewports:** 1440 (truncation), 320/390 (missing)
- **Evidence:** `./screenshots/public/admin-gap__admin-development__d1440.jpg` ("Document Requirem…" with no tooltip); `./screenshots/public/admin-gap__admin-development__m390.jpg` (no rail at all)

**What happens.** At desktop the rail truncates "Document Requirements" with no `title`/tooltip. At 390 the rail disappears, leaving a page of 12 stacked sections with no in-page navigation, so reaching "Danger Zone" means scrolling the entire form.

**Why it matters.** The rail is the only map of a long form. Truncated at one size and missing at another, the map is unavailable exactly where the page is longest relative to the viewport.

**Fix.** Widen the rail or allow two-line labels; on mobile replace it with a sticky section chip row (or a select) that jumps to sections.

**Acceptance.** No section label is truncated without a tooltip; at 390 all 12 sections are reachable within two taps.

---

### AC-36 — 15 unnamed controls and up to 89 sub-44px targets on the development page

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Auth, account and admin
- **Route:** /admin/developments/azure-north-residences
- **Section/element:** photo tiles (star / edit / trash overlays)
- **Viewports:** all
- **Evidence:** manifest `admin-development` — `unnamedControls: 15`, `smallCount: 89` (1440) / `65` (390); `./screenshots/public/admin-gap__admin-development__d1440.jpg` (three ~28px circular buttons over the cover photo)

**What happens.** The image action buttons are ~28–32px and carry no accessible name; the same overlay repeats on every photo tile.

**Why it matters.** On touch these are hard to hit, and a screen reader announces 15 anonymous buttons in the middle of a media form.

**Fix.** Use `MobileHeroActionButton`-style invisible hit pads (44×44) and `aria-label`s ("Set as cover", "Replace photo", "Delete photo") that include the photo position.

**Acceptance.** `unnamedControls` is 0 on this route and every tile control measures ≥44×44 including its pad.

---

### AC-40 — Property sidebar cuts a nav item mid-word at 900px

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /org/:orgSlug/property/:propertySlug/*
- **Section/element:** left nav, bottom edge
- **Viewports:** 900px-tall laptop, 1024
- **Evidence:** `./screenshots/public/admin-gap__prop-tickets__d1440.jpg`, `./screenshots/public/admin-gap__prop-docs__d1440.jpg`, `admin-gap__public-page-edit__d1440.jpg` — "Public Pages" sliced horizontally behind the plan card; live `probe-p4b-2.json → sidebar1024` = nav `scrollHeight 810` / `clientHeight 613`, `overflow: auto`

**What happens.** The nav scrolls, but the last visible row is clipped by the pinned plan card with no fade, so it looks like a rendering bug rather than a scroll region.

**Why it matters.** Team/Settings/Help & Support sit at the bottom of this list. A cut label reads as broken chrome and hides that there is more.

**Fix.** Add bottom padding to the scroll region plus a white-to-transparent fade above the plan card, and scroll the active item into view on mount.

**Acceptance.** No nav label is ever visually sliced; the fade indicates scrollability.

---

### AC-41 — Announcements use a red "error" dot for informational items

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /org/.../announcements, /org/.../parking/.../announcements
- **Section/element:** item rows + stat tiles
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__prop-announcement__d1440.jpg`

**What happens.** Every item (payout reminder, Meta reconnect, a maintenance window, a pool cleaning notice) carries a red dot and a coloured left rail. The KPI row offers four overlapping categories: Active 4, Action required 1, Attention 1, Updates 2. "Read all" appears twice, once per section. The payout item's body says "Open Finance if you see a banner."

**Why it matters.** Red is the platform's destructive/error colour. Using it for unread makes a routine pool-closing notice look like an incident, and "Active vs Attention vs Action required" cannot be decoded without an explanation. "If you see a banner" asks the user to go looking.

**Fix.** Unread = a neutral or primary dot; reserve red/amber for the severity the item actually has. Reduce the KPI row to Unread / Action required / All, or label them as filters. Rewrite the banner sentence as a direct instruction.

**Acceptance.** Informational announcements use no destructive colour; the KPI labels are mutually exclusive and act as filters.

---

### AC-42 — Team KPI roles sum to more members than exist

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /org/:orgSlug/team
- **Section/element:** stat row
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__org-team__d1440.jpg`; live `probe-p4b-3.json → teamKpi` = `Total Members 5 | Full Access 1 | Operations 5 | Read Only 0`

**What happens.** 1 + 5 + 0 = 6 against a total of 5, while the member list shows 1 Full Access and 4 Operations. Whatever the extra Operations member is (paused? invited?), the row contradicts itself.

**Why it matters.** These tiles are the summary an owner reads before changing seats or upgrading. Numbers that do not add up make every other tile suspect.

**Fix.** Derive the role tiles from the same query as the list and include paused/invited members explicitly (or exclude them consistently), so the sum equals the total.

**Acceptance.** The three role tiles plus pending invites reconcile to Total Members.

---

### AC-44 — Team tabs become three 36×32 unlabelled-looking icons at 390

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /org/:orgSlug/team
- **Section/element:** Members / Invitations / Permissions tabs
- **Viewports:** 320, 390
- **Evidence:** `./screenshots/public/admin-gap__org-team__m390.jpg`; live `probe-p4b-3.json → teamTabs` = three tabs `36×32`, label text visually hidden, accessible name present

**What happens.** Below `lg` the tab labels collapse to icons only: a people icon, an envelope, a shield. The selected state is not visually distinguishable, and the targets are 36×32.

**Why it matters.** Accessible names survive for screen readers, but a sighted user on a phone gets three cryptic glyphs and no current-tab indicator, on the page that controls who can see what. The 36×32 size is also under the 44px touch minimum.

**Fix.** Keep short labels ("Members", "Invites", "Roles") at 390 in a segmented control, or move to a bottom-sheet picker; enforce ≥44×44 hit area and a clear selected pill.

**Acceptance.** At 390 each tab shows text or an explicit selected state, and every target is ≥44×44.

---

### AC-46 — A notification's title and body name different guests

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** parking notifications (Activity)
- **Section/element:** first activity row
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__parking-notifications__d1440.jpg` — title "Rafa Mercado", body "June Vale requested 3 nights at Monaco 2604."

**What happens.** The row header is one guest's name; the description attributes the request to another.

**Why it matters.** In a notification list the bold line is what the user acts on. Mismatched identity makes it impossible to know whose request is pending.

**Fix.** Bind the title to the same subject as the body (the requesting guest), and put the stay dates in the metadata line.

**Acceptance.** Title and body of every row reference the same guest.

---

### AC-47 — Four rose-coloured KPI tiles make notifications look like an outage

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** parking notifications
- **Section/element:** Unread / Messages / Telegram on / Connected tiles
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__parking-notifications__d1440.jpg` (rose icon chips on all four, all values 0 or 0/3)

**What happens.** All four tiles use a rose/pink chip and icon, including "Unread 0" and "Messages 0". The pink family is the platform's destructive tint.

**Why it matters.** The page's first impression is an alarm, with zeros in every tile. Two of the four ("Telegram on 0/3", "Connected 0/3") do not say what the denominator is.

**Fix.** Use neutral or primary chips for counts; reserve rose for a genuine failure (a failed send). Relabel as "Telegram alerts · 0 of 3 modules on" and "Connected channels · 0 of 3".

**Acceptance.** No zero-value tile uses a destructive tint; both `x/3` tiles name their denominator.

---

### AC-48 — "Manage" degrades to a share-looking icon at 390

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** parking notifications
- **Section/element:** top-right action
- **Viewports:** 320, 390
- **Evidence:** `./screenshots/public/admin-gap__parking-notifications__m390.jpg` (single circular arrow icon in the green hero, no label) vs `..._d1440.jpg` ("Manage" button)

**What happens.** The page's only settings entry point becomes an icon that reads as "share" or "export", with no label at mobile widths.

**Why it matters.** The most important action on the page becomes guesswork, and the icon is not the conventional gear that would at least hint at settings.

**Fix.** Use the standard settings gear with an `aria-label`, or keep the word "Manage" at 390 (space exists in the hero).

**Acceptance.** The mobile action is a gear or a labelled button, with an accessible name.

---

### AC-49 — Telegram tab reads like a spec document

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** parking notifications → Telegram tab
- **Section/element:** right-hand helper lines
- **Viewports:** all
- **Evidence:** live `probe-p4b-4.json → parkTelegram` — `Telegram delivery | Turn every Telegram alert on or off at once. Your module settings stay saved. | Nothing sent yet | Sent alerts from the last 15 days show up here. | Connect a module in Manage | Delivery must stay on | Failed sends show a Failed badge`

**What happens.** The panel ends with three sentence fragments that describe how the system behaves ("Delivery must stay on", "Failed sends show a Failed badge") rather than a state or an action.

**Why it matters.** Copy that documents the UI inside the UI is the clearest internal-tool tell in this pass. A host cannot act on "delivery must stay on".

**Fix.** Replace with states: an empty state ("No alerts sent yet · Connect a module"), a disabled-state hint on the toggle when delivery is off, and a legend only if a "Failed" badge is actually on screen.

**Acceptance.** No helper line describes implementation rules; every line is a state or an action.

---

### AC-51 — The editor renders three `<h1>`s, two of them "Showcase"

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Auth, account and admin
- **Route:** same editor route
- **Section/element:** page header + editor header + preview
- **Viewports:** all
- **Evidence:** manifest `prop-public-page-edit d1440` `h1: ["Showcase","Monaco 2604","Monaco 2604",...]`; live `probe-p4b-2.json → editor390.h1` = `["Showcase","Showcase","Monaco 2604"]`

**What happens.** Two visible "Showcase" headings and the preview's own `h1` all render as `<h1>`, and the desktop count reaches seven.

**Why it matters.** Heading order is the primary navigation for screen readers; seven `h1`s across an editor and its preview is unusable, and the duplicate "Showcase" is also visually redundant.

**Fix.** One `h1` "Edit showcase"; demote the in-page editor title to `h2`; render the preview inside a container that scopes its headings (`role="presentation"` on the wrapper's outline, or heading levels offset via props).

**Acceptance.** The route exposes exactly one `h1` and a monotonic heading order.

---

### GL-03 — The global nav and footer change shape per page

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Global
- **Route:** marketing and listing pages
- **Section/element:** header nav, footer
- **Viewports:** 390, 768, 1440
- **Evidence:** consistency probe (`./screenshots/public/data/consistency.json`): 10 distinct nav link orders and 4 distinct footer link sets across 27 routes. On listing pages the header also renders breadcrumbs (`Home > Stays > Azure North Residences > Monaco 2604`) as nav links; on account pages the 8-tile account strip is appended to the same nav.

**What happens.** the primary navigation's contents and order depend on the page you are on, so the header cannot be learned. Account pages end up with two navigations because the tile strip is rendered inside `nav`.

**Why it matters.** navigation consistency is the cheapest wayfinding signal; here the second and third items move between pages.

**Fix.** one header nav for the marketing shell (Developments, Properties, Parkings, Services) and a separate breadcrumb element outside `<nav>`; move the account strip out of the navigation landmark.

**Acceptance.** the same 4 primary links appear in the same order on every marketing route; breadcrumbs and account tiles are not inside `<nav>`.

---

### GL-04 — A Gmail address is the public contact address

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Global
- **Route:** /about, /contact, /support, footer on every marketing page
- **Section/element:** footer, contact block, support page
- **Viewports:** all
- **Evidence:** footer `mailto:kameworks.tech@gmail.com` on 20+ routes; `/support` prints it twice; `/about` "Based in Manila … email kameworks.tech@gmail.com".

**What happens.** the product's only public contact is a personal Gmail account, repeated in the footer, the about page and the support page.

**Why it matters.** it reads as an unfinished side project, it is not on the product domain, and it gives no routing or record of guest issues.

**Fix.** `support@kamespace.com` (or the domain's real mailbox) in the footer and contact page, with the Gmail retired.

**Acceptance.** no `@gmail.com` address renders on any public page.

---

### GL-05 — The public pricing page carries three competing recommendation badges

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Global
- **Route:** /for-hosts/pricing
- **Section/element:** plan cards
- **Viewports:** 390, 768, 1440
- **Evidence:** copy inventory: Starter "Best value", Pro "Most popular", Business "Recommended".

**What happens.** every paid plan claims to be the plan to pick. The carousel also opens on Business, so the first plan a visitor sees is the most expensive one with a "Recommended" badge.

**Why it matters.** three recommendations cancel out, and the badge stops being a decision aid.

**Fix.** one badge on one plan, chosen deliberately (usually the middle tier), and open the carousel on Free.

**Acceptance.** exactly one plan carries a badge; the first card shown is Free.

---

### GL-06 — The Free plan advertises "Finance management", which is a paid capability

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Global
- **Route:** /for-hosts/pricing
- **Section/element:** Free plan feature list
- **Viewports:** all
- **Evidence:** copy inventory lists "Finance management" and "Maintenance reminders" under Free; the measured tier matrix (report 19) shows `financeReporting` and `maintenanceReporting` gated to Starter, and export is gated with `upgradeHook`.

**What happens.** the plan card promises a capability the product gates. A host on Free can open Finance but cannot export or report.

**Why it matters.** plan copy that overstates the free tier produces refund requests and support tickets.

**Fix.** rename to what Free actually gets ("View bookings and expenses") or move the line to Starter, and make the card match `plans-feature-matrix.md`.

**Acceptance.** every bullet on every plan card maps to a feature key and tier in the matrix.

---

### GL-07 — "Reviews" in the host nav points at a section that does not exist

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Global
- **Route:** /for-hosts, /for-hosts/pricing, /for-hosts/v2, /for-hosts/v3
- **Section/element:** header nav "Reviews"
- **Viewports:** all
- **Evidence:** live: `document.getElementById('reviews')` is null on `/for-hosts`; clicking the link leaves `scrollY` at 0 and the URL hash unchanged.

**What happens.** the nav item does nothing. `#features` and `#how-it-works` work.

**Why it matters.** a dead nav item is the first thing a skeptical host clicks.

**Fix.** point it at the reviews section (add an id) or remove the item until the section exists.

**Acceptance.** clicking Reviews scrolls to a reviews section.

---

### GL-08 — /services is a "Coming Soon" stub in the primary nav, with a date filter on it

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Global
- **Route:** /services
- **Section/element:** page + header search bar
- **Viewports:** 390, 768, 1440
- **Evidence:** screenshot `./screenshots/public/marketing__services__d1440.jpg`: "SERVICES / Coming Soon" with seven chips, a search bar with "What / Search services" and "When / Add dates", and ~40% empty space above and below.

**What happens.** a nav item that promises a capability leads to a placeholder; the search bar offers a date range for a service that has no dates; the chips look interactive.

**Why it matters.** it spends a primary nav slot on nothing and invites clicks that go nowhere.

**Fix.** remove Services from the nav until it ships, or make it a "notify me" page; drop the date field on service search.

**Acceptance.** no primary nav item leads to a placeholder page.

---

### LG-03 — "Developer controls" is rendered on the guest payment step, and it is the root cause of LG-02

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /properties/kame-home/form (step 5, Payment)
- **Verified note:** Dev builds only (`!import.meta.env.PROD`). Not shipped to production, but it can silently disable the database write and the email on any local or unbuilt run.
- **Section/element:** Card between "Payment terms" and the cancellation policy
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `./screenshots/public/live/step-05-payment.jpg`, `step-05-payment.json` (text: "Developer controls / Control which actions run upon form submission. / Save data to database / Save image assets to Supabase Storage / Send email / Paste Booking Info from Clipboard / Generate New Data")

**What happens.** The payment step of a public booking form renders an internal panel with three submission toggles and two debug buttons, including "Generate New Data: Populate form with random sample data", which is what fills the form with fake identities.

**Why it matters.** A guest is asked for a GCash receipt directly above a control that can silently disable "Save data to database", "Save image assets" or "Send email" for their submission. This is both a data-loss risk and the most unprofessional thing on the product.

**Fix.** Gate the whole panel behind an explicit dev/demo flag (never `import.meta.env.DEV` in a shipped build path that local prod data uses) or behind super-admin, and remove "Generate New Data" from the guest render entirely.

**Acceptance.** Submit path in a normal session contains no element matching "Developer controls", "Generate New Data" or "Paste Booking Info"; submission toggles default to on and are not exposed.

---

### LG-05 — Public host page publishes the seed identity and seed copy

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /hosts/kame-homes
- **Verified note:** Seed data rather than product logic: the seeded org publishes `seed-owner`, a demo bio and `manager.demo@example.com`. Needs a seed guard, not a redesign.
- **Section/element:** Host header, host card, review attribution
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/listings__host-public__d1440.jpg`, `shots/listings__host-public__m390.jpg`, `copy.json` (`seed-owner`, `Local demo host for the canonical seed dataset.`)

**What happens.** The hero reads "Kame Space" with "Hosted by seed-owner" and the bio line "Local demo host for the canonical seed dataset." `seed-owner` is the operator account name; the bio is build tooling language.

**Why it matters.** A guest-facing profile that says "canonical seed dataset" reads as a test environment. It also exposes the internal account naming convention.

**Fix.** Seed a real host display name and a human bio, or hide the "Hosted by" line when the host record is the platform account. Never surface account emails/usernames on public pages.

**Acceptance.** `/hosts/kame-homes` contains no `seed-`, `demo`, `dataset`, `example.com`, or internal account identifiers.

---

### LG-23 — Nine routes have no h1

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Listings and guest
- **Route:** /properties, /parkings, /developments, /parking-form, /parking-request, /calendar, /form, /guest-review, /document
- **Section/element:** Document outline
- **Viewports:** All
- **Evidence:** `./screenshots/public/manifest.json` `h1: []` for each of those ids at 390/768/1024/1440

**What happens.** The page title is an `h2` ("Check Availability", "Guest Advise Form", "Guest Review", "Pay to confirm") or missing entirely (listings start at "Homes in San Fernando" as an h2).

**Why it matters.** Screen-reader navigation and search-result structure lose the page identity; the browser tab and the page heading disagree.

**Fix.** Promote the primary page title to `h1` on each route and keep section headings below it.

**Acceptance.** Every listed route returns exactly one `h1` matching its purpose.

---

### LG-24 — Sort has no price option

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /properties
- **Section/element:** Sort combobox
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `live-sort.mjs` -> options `Recommended, Highest Rated, Most Reviews, Newest`

**What happens.** The only sort options are recommendation, rating, review count and recency. Price is filterable but not sortable.

**Why it matters.** On a ₱400 to ₱4,500 inventory, price order is the most common intent, and its absence pushes users into the price filter.

**Fix.** Add "Price: low to high" and "Price: high to low".

**Acceptance.** Sort list includes both price orders and reorders the grid accordingly.

---

### LG-25 — Filter defaults flip between sibling listing pages, and parking search drops "Who"

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Listings and guest
- **Route:** /properties vs /parkings vs /developments vs /developments/.../properties
- **Section/element:** Filter rail default state, search bar fields
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/listings__properties__d1440.jpg` ("Hide Filters", open), `shots/listings__parkings__d1440.jpg` ("Show Filters", closed), `shots/listings__development-properties__d1440.jpg` ("Show Filters"), `copy.json` parkings search has only Where/When

**What happens.** Properties opens with filters expanded; parkings and the development sub-pages open collapsed. The parking search bar has two segments; property and development have three ("Who 2 guests").

**Why it matters.** The three listing types look like three different products, and "2 guests" for parking would be meaningless anyway, so the asymmetry needs a rule rather than an accident.

**Fix.** Pick one default (collapsed everywhere) and one search bar composition, hiding "Who" only where the entity has no guest concept, consistently.

**Acceptance.** All listing pages share the same filter default and search field set, with documented exceptions.

---

### LG-26 — The parking search bar pins itself over the site navigation on scroll

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Listings and guest
- **Route:** /parkings
- **Section/element:** Floating search pill
- **Viewports:** 1024, 1440
- **Evidence:** `shots` live `./screenshots/public/live/live-parkings-scrolled.jpg` (nav links hidden behind the pill), `live3.json` (`bar top: 17, height: 46`, class `fixed left-0 top-[-3px] z-[55]`; header `0-81, z-50`)

**What happens.** After any scroll, the search pill fixes to the top of the viewport at a higher z-index than the header, covering Developments / Properties / Parkings / Services. Its labels also change from "Where / Search parkings / When / Add dates" to "Parkings / Anytime".

**Why it matters.** Scrolling makes global navigation unreachable, and the collapsed labels stop describing an action.

**Fix.** Pin the search bar below the header (respect `--public-nav-h`) or collapse it into the header as a single button. Keep the same labels in both states.

**Acceptance.** On scroll at 1440 all four nav links remain visible and clickable; the search control does not overlap the header.

---

### LG-27 — The developments list renders a condo listing priced at ₱0 per night

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /developments, /developments/in/pampanga
- **Section/element:** Development card
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/listings__developments__d1440.jpg`, `__m390.jpg`, `copy.json` ("1 development", "Condo in San Fernando", "₱0", "/ night", "1 home")

**What happens.** The single development result is titled like a property ("Condo in San Fernando", with a "Condo" type badge), and its price line reads "₱0 / night · 1 home". A development is not nightly-priced.

**Why it matters.** A zero price is the most damaging string on a travel site, and the card does not describe a development at all, so the page's whole premise is unclear.

**Fix.** Development cards should show name, developer, city, "1 home · 1 parking" and a real "from" price computed from available units, or omit the price entirely.

**Acceptance.** No ₱0 anywhere; development card is titled with the development name and shows inventory, not a nightly rate.

---

### LG-28 — Development detail spends its hero on a 135px strip and explains nothing

- **Priority:** P2
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Listings and guest
- **Route:** /developments/azure-north-residences
- **Section/element:** Hero, overlapping identity card, page body
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/listings__development-detail__d1440.jpg`, `shots/listings__development-detail__m390.jpg`

**What happens.** The hero photo is a letterboxed band with the identity card overlapping its lower half. The type appears twice (badge "Condominium" and icon row "Condominium"). Beneath it: four amenity chips and two one-item carousels. There is no description, address, map, developer detail, or availability context.

**Why it matters.** The page is the landing surface for a building, and a guest learns nothing about living there beyond "has a gym".

**Fix.** Taller hero (min 320px at 1440), remove the duplicated type, add an About block, address + map, developer, and make the two carousels one "Available now" section with inventory counts.

**Acceptance.** The page answers what the development is, where it is, who built it and what is available above the fold and in the first two screens.

---

### LG-29 — At 320 the bottom tab bar covers the development's primary CTA

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Listings and guest
- **Route:** /developments/azure-north-residences
- **Section/element:** `View Homes` button
- **Viewports:** 320
- **Evidence:** `live5.json` `devCta` (`View Homes` top 625, bottom 669; nav top 643 -> `covered: true`), `shots/listings__development-detail__s320.jpg`

**What happens.** On first load the fixed bottom nav overlaps the lower half of the "View Homes" button, so the primary action is partly unclickable.

**Why it matters.** The 320px class of phones is small but real, and the overlapping target is the page's main conversion.

**Fix.** Add bottom padding to the page equal to the tab bar height and/or reduce the hero card height so both CTAs sit above it.

**Acceptance.** At 320 no interactive element intersects the tab bar on first load.

---

### LG-30 — "Submit review & continue" looks enabled but is disabled, and the fixed nav covers the first rating rows

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Listings and guest
- **Route:** /properties/kame-home/guest-review?bookingId=…
- **Section/element:** Submit button, rating rows
- **Viewports:** 320, 390, 768
- **Evidence:** `shots/guest-flow__guest-review__m390.jpg` (pale green submit above Not now), manifest `guest-review` `stickyCovered: 5` at 390 and 768, `live3.json` `reviewCovered` (Check-in row 655-734 against nav top 693, `main` padding-bottom `0px`)

**What happens.** The disabled submit renders in brand teal at ~60% opacity, which reads as an active primary button; clicking does nothing and nothing says a star rating is required. On first load the fixed nav sits over the Check-in and Communication star rows.

**Why it matters.** A guest writes a review, taps submit, and gets silence. The star rows they need to complete are partly hidden behind the nav at the same time.

**Fix.** Use an unmistakable disabled style plus a helper line ("Add a star rating to continue"), and add bottom padding so no form row sits under the nav.

**Acceptance.** The disabled state is visually distinct, explains the missing input, and no rating row intersects the nav at 390 on load.

---

### LG-31 — The form's own copy is internal jargon

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /properties/kame-home/form
- **Section/element:** Title, email helper, guest blocks, reminder
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `step-01-guest.json`, `shots/guest-flow__form-signed-in__m390.jpg`

**What happens.** "Guest Advise Form" (what is being advised?), "Use an email you can access. Your GAF will be sent there for Azure North check-in." (GAF is never expanded), "Add more guest" (grammar), "Maximum Guests Reminder" followed by a 44-word run-on that mixes occupancy, the pool and age rules.

**Why it matters.** Guests must understand what they are submitting and where the document goes. Unexplained acronyms and run-ons produce support tickets.

**Fix.** See the Copy rewrites table.

**Acceptance.** No unexplained acronyms on the guest path; helper text under 20 words per line.

---

### LG-32 — Form data entry is inconsistent and the desktop layout wastes the screen

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Listings and guest
- **Route:** /properties/kame-home/form
- **Section/element:** Date fields, step rail, card width
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `step-02-stay.json` ("11/25/2026" in inputs, "Nov 25, 2026" in the summary above it), `shots/guest-flow__form-signed-in__m390.jpg` (rail reduced to "Guest … 1/5"), live signed-in form `scrollHeight` 3,611-3,884 at 1440 with a single ~400px column

**What happens.** Dates render in two formats on one screen. On phone the five-step rail collapses to the current step name plus "1/5", so the guest cannot see that documents and payment are coming. At 1440 the entire form is one narrow column, producing a 3,600px scroll with half the viewport empty.

**Why it matters.** Guests abandon long forms when they cannot see how much is left, and desktop users scroll through a phone layout.

**Fix.** Use one date format (a readable "Wed, 25 Nov 2026"). Keep a compact 5-dot rail with labels on mobile. At 1024+ use a two-column field grid with the step summary as a side rail.

**Acceptance.** One date format per screen; mobile shows all five step labels; at 1440 the form is at most two screens tall for step 1.

---

### LG-33 — The pets step contradicts its own policy and shows pet fields whether or not a pet is coming

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /properties/kame-home/form step 4 (Pets)
- **Section/element:** Pet policy block and pet detail fields
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `(live probe, not committed)` (Pets step text), `step-04-pets` run

**What happens.** The policy says "Only one toy/small dog is allowed" and then the prefill is Pet Type "Dog", Pet Breed "Persian Cat", age "6 months old", with a vaccination date and two required uploads. The detail fields are open and required while the "No pets on this stay" option is still selected above them.

**Why it matters.** A guest with a cat is told cats are not allowed by a field that accepts them, and a guest with no pet still faces required pet fields.

**Fix.** Show pet details only when "Yes, I'm bringing a pet" is chosen, make the policy match what the form accepts (or restrict the type to dog), and clear any prefilled pet data.

**Acceptance.** Selecting "No pets" hides and un-requires all pet fields; the accepted species matches the policy text.

---

### LG-34 — Three different cancellation sentences, one of them ungrammatical

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /properties/kame-home (sidebar and policy block), /properties/kame-home/form step 5
- **Section/element:** Cancellation summary
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `copy.json` property-detail ("Moderate", "Full refund of what you paid up to 3 days before check-in.", "100% of paid at least 3 days before check-in."), `shots/listings__property-detail__m390.jpg` ("Free cancelation until you've paid up to 3 days before check-in."), `./screenshots/public/live/step-05-payment.jpg` ("Moderate / Full refund of what you paid up to 3 days before check-in. / Percentages apply to what you have paid. / 100% of paid until Nov 22, 2026")

**What happens.** The same policy is stated three ways across two screens, with "cancelation" (one l) on mobile and "cancellation" on desktop, and "until you've paid up to" is not parseable.

**Why it matters.** Refund terms are the most scrutinised copy on a booking. Ambiguity here becomes a dispute.

**Fix.** One canonical sentence per policy with a date: "Free cancellation until 22 Nov 2026. After that, 100% of what you paid is non-refundable." Use it on the listing, the form and the receipt.

**Acceptance.** Identical policy text and date on listing, form step 5 and confirmation; correct spelling.

---

### LG-35 — One action, four names

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /properties/kame-home (Reserve), /properties/kame-home/showcase (Request stay, Book now), home page (Send a request), parking (Reserve)
- **Section/element:** Primary CTAs
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `copy.json` (`Reserve`, `Request stay`, `Book now`, `Send a request`), `shots/guest-flow__showcase__d1440.jpg`

**What happens.** The same next step is labelled four ways. Within the showcase page alone, the hero says "Request stay" and the footer CTA says "Book now".

**Why it matters.** Two labels for one action inside one page makes guests think they are different flows (request vs instant book), which is a real product distinction the labels should not fudge.

**Fix.** Decide whether it is a request or an instant booking and use one verb everywhere ("Request to book" if a host confirms).

**Acceptance.** One primary CTA label for the booking entry across listing, showcase and home.

---

### LG-36 — The stay guide's document status contradicts itself and uses internal identities

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /properties/kame-home/stay-guide?token=…
- **Section/element:** Check-in documents row, host block, chapters
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/guest-flow__stay-guide__d1440.jpg`, `live2.json` `stayGuide` links and text ("Approved GAF", "PENDING", "viewer.demo", "manager.demo@example.com", "CHAPTER 01/02/03")

**What happens.** A row labelled "Approved GAF" carries the status "PENDING". The host block shows `viewer.demo` and the footer contact is `manager.demo@example.com`. Chapters open with "Welcome! Here's everything you need to know…", "Welcome to our property! Please follow these guidelines to ensure a pleasant stay:", "Thank you for staying with us! Please follow these steps for check-out:".

**Why it matters.** A guest looking for their check-in document sees "approved" and "pending" at once, and an email to `manager.demo@example.com` bounces. The template prose reads as filler on a page people rely on at arrival.

**Fix.** Label the row by the document ("Azure North guest form") with one status chip. Show the real host display name and a working contact. Replace the welcome openers with the actual instruction.

**Acceptance.** Status is unambiguous; no example.com or account usernames on the page; each chapter starts with the instruction, not a welcome.

---

### LG-37 — The rating distribution bars render at equal length

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /properties/kame-home
- **Section/element:** Reviews summary, 5 to 1 star bars
- **Viewports:** 320, 390
- **Evidence:** `shots/listings__property-detail__s320.jpg`, `shots/listings__property-detail__m390.jpg` (all five bars visually the same width)

**What happens.** The histogram next to "4.5 / 10 reviews" draws five bars at effectively the same length, so it looks like every rating has equal share and contradicts the 4.5 average.

**Why it matters.** A broken chart next to a rating reads as fake reviews.

**Fix.** Bind bar width to the actual counts and hide the block when there are no counts; otherwise replace it with the two category scores already shown.

**Acceptance.** Bar widths are proportional to counts and sum to 10 for this listing.

---

### MK-02 — Hero alt text describes a different image

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /
- **Section/element:** Hero `<img>` alt attribute
- **Viewports:** all
- **Evidence:** live: evaluated `section img` on `/` → `alt="Sunlit living room in a Kame Space stay, looking out to the water"` with `src=/marketing/home/hero-day-1280.avif` (the resort image)

**What happens.** The alt text describes an interior living room. The rendered image is an exterior resort with towers and waterslides. The paired night image uses `alt=""`.

**Why it matters.** Screen-reader and low-vision users get a false description of the page's primary visual, and the mismatch is the kind of thing that erodes trust in every other alt string on the site.

**Fix.** Write alt text that matches the replacement photograph (per MK-01), or mark the decorative layer `alt=""` if the H1 already carries the meaning.

**Acceptance.** Alt text and rendered image describe the same subject; verified by reading the alt string against the screenshot.

---

### MK-06 — Booking explainer burns 4.2 viewports for five short lines

- **Priority:** P2
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Marketing
- **Route:** /
- **Section/element:** "How booking works" pinned scroll sequence
- **Viewports:** 390/768/1024/1440
- **Evidence:** live: section height 3,545px at both 390 and 1440 (≈4.2 viewports); `crops/home-dead-d1440.jpg`; `live-home-2350.png` shows one step on screen with the rest grey

**What happens.** The five-step story is driven by scroll position: each ~700px of scroll advances one step. Live it works (step 1 → 5 as you scroll), but the page holds ~4 screens for ~40 words of copy, and any full-page capture or fast scroll shows large empty grey bands. On mobile, the example-trip card keeps a fixed height sized for the richest step, leaving ~180px of blank white card under "Valid ID" (see `home-messages-390.png`).

**Why it matters.** It is the longest section on the homepage and delivers the least information per pixel. Users who scroll quickly see empty grey and assume the page is broken; users who scroll carefully spend four screens learning five facts.

**Fix.** Cut the pinned height to ~1.5 viewports (one screen per two steps, or drive it with a normal in-flow stepper). Let the example card size to its content per step. Keep the 1→5 progress affordance.

**Acceptance.** Section height ≤ 1.5 × viewport at 390 and 1440; no blank region larger than 120px inside the example card on any step.

---

### MK-14 — White label over a photo with no scrim ("Century Properties")

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /search
- **Section/element:** Development card photo overlay, bottom-left label
- **Viewports:** all
- **Evidence:** manifest contrast entry `Century Properties ratio 1.0 need 4.5 size 12`; `search-lower.png`

**What happens.** The development name is white 12px text placed directly on the building photograph, outside the dark gradient that covers only the right/badge side.

**Why it matters.** At 12px this fails AA even with a good backdrop; measured at 1.0:1 it is effectively invisible against the bright sky band of that photo.

**Fix.** Put the label on a solid or gradient pill (as the "1 homes available" badge does), or extend the image scrim to full width at the bottom.

**Acceptance.** The label's computed contrast against its rendered backdrop is ≥ 4.5:1 on every listing photo.

---

### MK-15 — Result counts are glued into the section headings, and two filter systems compete

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /search
- **Section/element:** Section headings "Properties 1", "Developments 1", "Parkings 1"; filter controls
- **Viewports:** all
- **Evidence:** manifest `headings: ["Properties1", "Developments1", "Parkings1"]`; live `h2` innerText `Properties1`; `search-default.png` shows a "Filter properties" bar with "3 results" plus a second "All 3 / Properties 1 / Developments 1 / Parkings 1" tab row

**What happens.** The count badge is inside the heading element, so assistive tech announces "Properties one". Separately, the page offers both a "Filter properties" control with a "3 results" counter and a type tab row with the same counts.

**Why it matters.** Two controls doing overlapping jobs make the page feel unconsidered, and a heading that reads "Properties1" is a genuine screen-reader defect.

**Fix.** Mark the count `aria-hidden` (or move it outside the heading) and give the heading a clean accessible name. Collapse the two filters into one: the tab row for type, the button for attributes/dates.

**Acceptance.** Heading accessible names are "Properties", "Developments", "Parkings"; only one mechanism changes the result type.

---

### MK-16 — Mobile type-chip row is clipped by the floating filter button

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Marketing
- **Route:** /search
- **Section/element:** Sticky type chips vs the icon-only filter button
- **Viewports:** 390 (worse at 320)
- **Evidence:** `search-390.png` shows "All 3 | Properties 1 | Developme…" cut mid-word under the ⊞ button; live boxes: Properties 83–156px, Parkings 158–232px, filter button at ~338px

**What happens.** The chip row scrolls horizontally but has no right padding to clear the floating filter control, so the third chip is truncated by it. "Parkings" is only reachable by scrolling.

**Why it matters.** On the phone, the page's primary segmentation control is partly hidden and partly illegible, and the icon-only filter button loses its label so nothing explains what it does.

**Fix.** Add right padding equal to the filter button width + gap (`pr-14`), and keep a short text label on the filter control or move it into the header row above the chips.

**Acceptance.** All three chips plus the filter control fit or scroll clear of each other at 320 and 390; no chip is overlapped by a button.

---

### MK-17 — Empty-state recovery offers "Search nearby" to someone who typed a place

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /search
- **Section/element:** "No matches" empty state
- **Viewports:** all
- **Evidence:** `search-empty.png`; live URL `/search?where=Boracay%2C+Aklan&adults=2`

**What happens.** The empty state offers "Search nearby" (a geolocation action) and "Clear place". Neither helps a user who wants Boracay or who simply misspelled something, and no alternative inventory is shown.

**Why it matters.** This is the one screen every failed search lands on, and it sends the user back to the beginning with no information gained.

**Fix.** Offer "See all stays" and 2–3 nearest available destinations with counts ("San Fernando, 1 stay"), and keep "Clear place". Drop "Search nearby" unless geolocation actually returns inventory.

**Acceptance.** From a zero-result search, one click reaches a page with at least one bookable listing.

---

### MK-23 — Product tour panels show clipped screenshots and truncated captions

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Marketing
- **Route:** /for-hosts, /for-hosts/v2, /for-hosts/v3, /for-hosts/login
- **Section/element:** Video/preview panel + caption + chapter chips
- **Viewports:** 320/390/1024/1440
- **Evidence:** `./screenshots/public/for-hosts__for-hosts__d1440.jpg` (dashboard mock inside the panel is cut at both edges with empty white KPI cards; chip row ends "Fin…"), `./screenshots/public/for-hosts__for-hosts__s320.jpg` caption reads "Everyt…" and "Bookin…", `host-login2.png` left panel sidebar clipped ("…board", "ngs", "ws")

**What happens.** The embedded product screenshot is a fixed-width image placed inside a narrower frame, so it is cropped on every edge; the caption and chapter strip are ellipsized mid-word at small widths.

**Why it matters.** This panel is the proof of the product. Cropped UI with empty cards reads as an unfinished demo, and truncated captions look like rendering errors.

**Fix.** Render the mock at the panel's actual size (or use a responsive screenshot at 2×), crop deliberately to a meaningful region, and let captions wrap instead of truncating. Make the chapter strip scrollable with edge fade rather than hard-clipping.

**Acceptance.** At 320 and 1440, no caption or chip is ellipsized mid-word, and the dashboard mock shows a complete frame with no cut-off panels.

---

### MK-24 — "1 booking workflow" presented as a headline statistic

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /for-hosts
- **Section/element:** Stats strip under the hero
- **Viewports:** all
- **Evidence:** `./screenshots/public/for-hosts__for-hosts__d1440.jpg` and `..._s320.jpg` — "14 connected modules · 1 booking workflow · AI assisted review · 24/7 background automation"

**What happens.** Three of the four stats are impressive-scale (14, 24/7, AI); the second is "1", which reads as either a typo or a joke.

**Why it matters.** A stats strip exists to build confidence; one weak cell drags the other three down and invites the question of what "1" is even counting.

**Fix.** Replace with a countable, meaningful figure (e.g. "6 stages, one path" or "0 spreadsheets") or drop the cell and use three stats.

**Acceptance.** Every stat in the strip is either a quantity that reads as an achievement or removed.

---

### MK-26 — Host pages use a completely different navigation system

- **Priority:** P2
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Marketing
- **Route:** /for-hosts, /for-hosts/pricing, /for-hosts/v2, /for-hosts/v3
- **Section/element:** Header nav
- **Viewports:** 1024/1440
- **Evidence:** `./screenshots/public/for-hosts__for-hosts__d1440.jpg` header = Features / How It Works / Reviews / Pricing / Explore / Sign In; `./screenshots/public/marketing__home__d1440.jpg` header = Developments / Properties / Parkings / Services / Become a host? / Sign In

**What happens.** Two unrelated top-level navs share one logo and one footer. The four guest nouns are replaced by four host nouns, and the primary CTA flips from "Become a host?" to "Explore".

**Why it matters.** A visitor who lands on `/for-hosts` from the footer or an ad has no stable way back to inventory, and "Explore" (a bare button) is less clear than the "Become a host?" pattern used everywhere else. Two nav systems means two sets of maintenance and two sets of defects (see MK-20).

**Fix.** Keep the site nav consistent and make the host area a clearly scoped sub-nav (Features / How it works / Pricing) with the global nav above it, or at minimum keep the "Explore" affordance labelled and identical across both.

**Acceptance.** The same global nav renders on every marketing route; host-specific links sit in a visually distinct secondary row.

---

### MK-28 — Every paid plan carries a permanent "20% off"

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /for-hosts/pricing
- **Section/element:** Plan price blocks and compare-table headers
- **Viewports:** all
- **Evidence:** `./screenshots/public/for-hosts__for-hosts-pricing__d1440.jpg`, `pricing-initial.png`, copy inventory: ₱499→₱399, ₱999→₱799, ₱1,799→₱1,439, ₱4,999→₱3,999, each with a "20% off" pill

**What happens.** All four paid tiers show the identical 20% discount, with no end date, no strike-through rationale, and no qualifying condition.

**Why it matters.** A discount that always exists is not a discount; it trains visitors to ignore the badge and invites the assumption that the real price will rise to the struck-through number later. It also threatens price-transparency expectations for a paid SaaS.

**Fix.** Either run a real, dated promotion (with an end date shown) or show one price with no strike-through. If the 20% is a launch offer, state the end date next to the badge.

**Acceptance.** No plan shows a strike-through price without a stated expiry, or all plans show a single non-discounted price.

---

### MK-29 — Four plans claim three different kinds of recommendation

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /for-hosts/pricing
- **Section/element:** Plan badges and one-line subtitles
- **Viewports:** all
- **Evidence:** `pricing-initial.png` — Starter "Best value", Pro "Most popular", Business "Recommended", Managed "Hands-off hosting"

**What happens.** Three badges compete to be the recommendation ("Best value", "Most popular", "Recommended"), plus a fourth badge that is really a description. The subtitles also change axis per card: Starter = automation, Pro = reach, Business = AI, Managed = hands-off.

**Why it matters.** When everything is recommended, nothing is. The visitor is asked to compare four unrelated value propositions with no ladder, which is the main reason multi-tier pricing pages fail.

**Fix.** One recommendation badge ("Most popular" on a single tier). Rewrite each subtitle on the same axis (who it is for), e.g. "For one property, no automation", "For 2–3 units with automated emails", "For teams running several properties". Move "Hands-off hosting" into the Managed card body.

**Acceptance.** Exactly one plan carries a recommendation badge; all five subtitles share one grammatical pattern and one comparison axis.

---

### MK-31 — Plan card accents introduce purple and amber into a teal system

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Marketing
- **Route:** /for-hosts/pricing
- **Section/element:** Plan icons
- **Viewports:** all
- **Evidence:** `pricing-initial.png` — Starter lightning in mint, Pro arrow in a lavender square, Business sparkle in purple, Managed heart in amber

**What happens.** Four unrelated hues appear only on this page, outside the site's teal token set (DESIGN.md explicitly rules out purple-indigo accents).

**Why it matters.** The pricing page is where a buyer compares value; four competing accent colours add visual noise to the one place that should be calm and legible, and they do not encode any information (they are not tied to tier rank).

**Fix.** Use the teal/neutral token set for all plan icons, differentiating tiers by fill weight or badge rather than hue.

**Acceptance.** No purple or amber icon on `/for-hosts/pricing`; all icon accents resolve to teal/neutral tokens.

---

### MK-33 — 36-question FAQ has no search, no anchors, and expands to 5,903px

- **Priority:** P2
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Marketing
- **Route:** /support
- **Section/element:** FAQ list and "Show all 36"
- **Viewports:** all
- **Evidence:** `./screenshots/public/marketing__support__d1440.jpg`; live: 0 search inputs, 0 `details`, 0 `#` anchor links, 0 `h3`; after clicking "Show all 36" the document height is 5,903px

**What happens.** Twelve answers render fully expanded; the rest are hidden behind one button that dumps 24 more paragraphs into a single column. There is no way to filter, jump to a topic, or link to an answer.

**Why it matters.** Support is the page a frustrated user reaches last. All-expanded prose with no search forces full-page scanning, and agents cannot link a user to a specific answer.

**Fix.** Add a search field (client-side filter is enough), an audience switch (Guests / Hosts) as tabs, `id` per question for deep links, and collapse answers to `<details>`/accordion so the page opens short.

**Acceptance.** Typing into a support search filters questions; every question has a shareable `#anchor`; the page is under ~1,200px before any interaction on mobile.

---

### MK-34 — Public support page is mostly host-dashboard internals

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /support
- **Section/element:** "Hosts" FAQ block
- **Viewports:** all
- **Evidence:** `./screenshots/public/marketing__support__d1440.jpg`; copy inventory shows 4 guest questions vs ~12 host questions before "Show all 36", covering "Export report", "New booking", "Import beside New booking", "Pending Review", "GAF"

**What happens.** A guest landing on `/support` (the footer link a guest is most likely to use) sees a majority of answers about a dashboard they cannot access, written in internal vocabulary (GAF, Pending Review, SD refund).

**Why it matters.** Guests bounce because the page does not answer their question in their language; hosts get operational copy on a marketing page instead of in-product help. The two audiences dilute each other.

**Fix.** Default to the Guests tab, put host answers behind the Hosts tab, and expand guest coverage (change a date, cancel, refund timing, parking, ID upload) to at least parity. Translate internal status names into plain language.

**Acceptance.** Guests tab answers ≥ 8 questions, contains no internal status or document acronyms, and is the default view.

---

### MK-36 — "Sign in with your explore account"

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /contact
- **Section/element:** Page subtitle
- **Viewports:** all
- **Evidence:** `./screenshots/public/marketing__contact__d1440.jpg` subtitle: "Pick what your message is about. Sign in with your explore account to open a ticket."

**What happens.** "Explore account" is not a product concept anywhere on the site. The account is a guest account (`/for-guests/login`); "Explore" is also the label of a bottom-nav tab, so the sentence points at two different things.

**Why it matters.** Jargon at the exact moment the user needs to know whether they have an account. It makes a simple step feel like a membership requirement.

**Fix.** "Pick a topic. Sign in to track your ticket, or email us instead."

**Acceptance.** No internal account-type naming appears in public copy.

---

### MK-37 — Ticket modal clips content mid-word and disables Submit without saying why

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Marketing
- **Route:** /contact
- **Section/element:** "New ticket" modal
- **Viewports:** 1024/1440 (also 390 as a bottom sheet)
- **Evidence:** `contact-broken.png` — the attachment drop zone is sliced through the label at the scroll fold; live: `button "Submit" [disabled]` with no validation message and no `aria-invalid` on the fields

**What happens.** The scrollable body ends mid-word with no fade or border to indicate more content, and the primary action is disabled until all required fields are filled, with no inline explanation or error text.

**Why it matters.** A disabled button with no reason is a dead end for users who cannot tell which field is missing; a body that cuts a label in half looks like a rendering fault rather than a scroll region.

**Fix.** Show inline required-field errors on blur/attempt and keep Submit enabled (validating on press). Add a fade or top/bottom border on the scroll region so clipped content reads as scrollable.

**Acceptance.** Pressing Submit with missing fields shows a per-field error message and moves focus to the first invalid field; the modal body has a visible scroll affordance.

---

### MK-40 — Services chips look tappable but are decorative and hidden from assistive tech

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /services
- **Section/element:** Seven category pills (Become a property manager, Maintenance, Food & Essentials, Supplies, Transportation…)
- **Viewports:** all
- **Evidence:** live snapshot → `list [aria-hidden]` containing `listitem` text only, no buttons or links; `./screenshots/public/marketing__services__d1440.jpg` shows pill-shaped chips with icons and hover-ready styling

**What happens.** The page's only content block looks exactly like a set of filter buttons, is not interactive, and is explicitly removed from the accessibility tree.

**Why it matters.** Pointer users tap and nothing happens; screen-reader users are told the page has nothing beyond "Coming Soon". The chips also mix host services (property manager, agent, market properties) with guest services (food, supplies, transport) in one undifferentiated row.

**Fix.** Either make them real links/buttons with destinations, or render them as plain text tags without pill affordance. Split host vs guest services and remove `aria-hidden`.

**Acceptance.** Every chip is either a working link or a non-interactive label with no button affordance; content is exposed to assistive tech.

---

### MK-41 — Legal pages have no table of contents or anchors

- **Priority:** P2
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Marketing
- **Route:** /terms, /privacy, /cookies
- **Section/element:** Long-form legal layout
- **Viewports:** all
- **Evidence:** `./screenshots/public/marketing__terms__d1440.jpg`; live on /terms: 21 `<h2>` sections, 5,862px tall, **0** in-page `#` links, 16px/26px text at a 768px measure

**What happens.** Terms is a single 21-section column with no way to jump to "Cancellation", "Security deposits" or "AI features". The "last updated 9 November 2026" line is buried in the third sentence of the first section.

**Why it matters.** When someone actually needs a legal page it is because of a specific dispute, so they need one section fast. Without a ToC they scroll 5,800px or use browser find.

**Fix.** Add a sticky section index (or a two-column layout with a ToC sidebar at ≥1024) built from the existing `h2`s with `id`s; surface "Last updated" as a meta line under the page title.

**Acceptance.** Every legal page exposes a linked section index; the updated date appears in the page header at every width.

---

### MK-43 — Unknown routes return HTTP 200 (soft 404)

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Marketing
- **Route:** /this-route-does-not-exist (and any unknown path)
- **Section/element:** Server response
- **Viewports:** all
- **Evidence:** manifest `status: 200` for `/this-route-does-not-exist`; the SPA renders the "This page wandered off / ERROR 404" screen

**What happens.** The HTML document returns 200 for every path, so crawlers index 404 pages as valid content; the same applies to the currently-stale `/for-hosts/v4`.

**Why it matters.** Duplicate/false pages dilute indexing, and any mistyped marketing URL becomes a permanent soft 404 in search results. It also means monitoring cannot distinguish a broken deploy from a real page.

**Fix.** Serve a real 404 status for unknown paths at the edge/host (Vercel rewrite to the SPA only for known route prefixes, or a 404 function), keeping the styled screen.

**Acceptance.** `curl -I http://<host>/this-route-does-not-exist` returns 404 while rendering the same page.

---

### MK-46 — The login page's product tour auto-advances next to the email field

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Marketing
- **Route:** /for-hosts/login
- **Section/element:** Left-panel carousel
- **Viewports:** 1024/1440
- **Evidence:** live: slide caption read "Intro", then "Bookings" after 5s with no interaction; pause/next controls exist

**What happens.** A full-bleed panel beside the login form changes image and caption every few seconds. It pauses only if the user finds the small pause button.

**Why it matters.** Motion adjacent to a text field competes for attention exactly when the user is typing an email, and it makes a two-field form feel busy. Automated motion is a WCAG 2.2.2 concern even when a pause control exists.

**Fix.** Do not autoplay beside the form. Start paused on slide 1 with visible "Play tour" control, or respect `prefers-reduced-motion` and start paused for those users.

**Acceptance.** The panel is static on load; no slide change occurs without a user action.

---

### MK-47 — Login email validation is not programmatically announced

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /for-hosts/login
- **Section/element:** Email field + "Continue"
- **Viewports:** 1024/1440 (and the same modal at 390)
- **Evidence:** `host-login-empty.png` shows the inline red "Enter a valid email address"; live after submit → `input[aria-invalid] === null`, `[role=status]` text is empty

**What happens.** The error is visible but not linked to the field (`aria-describedby`/`aria-invalid` absent) and not announced through a live region.

**Why it matters.** Screen-reader users press Continue and get no feedback at all; they cannot tell why nothing happened.

**Fix.** Set `aria-invalid="true"` and `aria-describedby` to the error id, and render the error in an `aria-live="polite"` region that already exists in the DOM.

**Acceptance.** Submitting an invalid email sets `aria-invalid`, associates the message, and announces it (verified in the accessibility tree).

---

### P4-01 — The guest form pre-fills a different fake person on every load

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Public surface
- **Route:** /properties/kame-home/form
- **Verified note:** Dev builds only: the prefill is gated by `showDevControls = !import.meta.env.PROD`, so a production bundle renders an empty form. Kept because local and staging captures are not representative, and the same flag exposes LG-03.
- **Section/element:** Guest step fields (name, email, phone, address)
- **Viewports:** 320, 390, 768, 1024, 1440
- **Evidence:** live: loaded twice as `guest.demo@example.com`; first load filled "David H. Jones / davidhjones@example.com / 09198831018", second "Chris A. Miller / chrisamiller@example.com / 09939990143". An earlier signed-out load showed "Chris F. Jones".

**What happens.** **signed-in** guests get the form populated with a random fixture identity unrelated to their account (name, `@example.com` email, phone, address), and a second load produces a different person. Anonymous visitors get an empty form.

**Why it matters.** a signed-in guest sees a stranger's personal data in their own booking form, and the form promises to send documents to an address that cannot receive mail.

**Fix.** source any prefill from the session (email, name) or leave the fields empty; gate fixture data behind a dev flag that cannot render in a production build.

**Acceptance.** two consecutive signed-in loads show either empty fields or the guest's own details; no `@example.com` value in any field.

---

### P4-06 — Accept-invite dead-ends on one sentence with zero actions

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /accept-invite
- **Section/element:** whole page
- **Viewports:** all
- **Evidence:** live: body text is exactly "This invitation link is invalid. Kame Space"; no `<h1>`; **0 links and 0 buttons** in the DOM.

**What happens.** anyone whose token was stripped or expired sees one grey sentence on an otherwise bare page, with no logo, no navigation and nothing to click.

**Why it matters.** the most common cause (an expired link) is the most recoverable, and there is no way out of the page.

**Fix.** brand chrome, an h1, a plain-language reason per case (expired / already used / malformed), and two actions: "Ask for a new invite" and "Sign in".

**Acceptance.** the route renders a title and at least one working navigation control.

---

### P4-08 — One result renders in a four-column grid

- **Priority:** P2
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Public surface
- **Route:** /search, /developments/azure-north-residences/properties
- **Section/element:** results grid
- **Viewports:** 768, 1024, 1440
- **Evidence:** live: search grid `grid-template-columns` resolves to 4 tracks with 1 child; the same on the development properties page. `/parkings` shows "1 slot" with a single card and a large void.

**What happens.** a single result occupies a quarter of the row and the page reads as unfinished.

**Why it matters.** with a small inventory (the current state) every list page looks empty.

**Fix.** when the result count is below the column count, switch to a wide card or a single-column list.

**Acceptance.** a one-result page fills the content width.

---

### P4-09 — The parking card image 404s and its alt text draws over the card

- **Priority:** P2
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Public surface
- **Route:** /parkings, /search, /account/trips
- **Section/element:** listing card media
- **Viewports:** all
- **Evidence:** live: `img.complete && naturalWidth === 0` for `images.unsplash.com/photo-1590674899484…`, alt "Azure North Residences, Parking slot" rendered across the card body, overlapping the "Inside tower" chip.

**What happens.** a broken image shows the browser glyph plus the alt text as visible copy.

**Why it matters.** it is the first impression of the parking vertical.

**Fix.** an `<img onError>` fallback to a branded placeholder; keep alt on the image only, never as visible text.

**Acceptance.** no card renders a broken-image glyph or alt text as body copy.

---

### P4-10 — Search prices a development at ₱0 and pluralises one home

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Public surface
- **Route:** /search
- **Section/element:** development card
- **Viewports:** all
- **Evidence:** live strings "From ₱0 / night" and "1 homes available".

**What happens.** a zero price and a broken plural.

**Why it matters.** zero reads as a bug in a marketplace; the plural reads as unpolished.

**Fix.** omit the price line when the minimum is 0, and pluralise with a helper.

**Acceptance.** no ₱0 price and no "1 homes".

---

### P4-11 — Guest and host login are two different products

- **Priority:** P2
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Public surface
- **Route:** /for-hosts/login, /for-guests/login
- **Section/element:** right-hand panel
- **Viewports:** 768, 1024, 1440
- **Evidence:** screenshots `./screenshots/public/auth__host-login__d1440.jpg` (admin mock preview) and `./screenshots/public/auth__guest-login__d1440.jpg` (fake listing carousel "Sunset 1BR Condo / Boracay / /night").

**What happens.** each login invents its own marketing panel; the guest one shows listing cards with the price missing.

**Why it matters.** two designs to maintain, and the guest panel ships a broken price.

**Fix.** one auth layout with an audience-appropriate panel, and real prices or no price.

**Acceptance.** both logins share the shell; no card renders an empty price.

---

### P4-13 — The host marketing nav has a dead item and the mock contributes headings

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Public surface
- **Route:** /for-hosts, /for-hosts/pricing
- **Section/element:** nav "Reviews", embedded mock
- **Viewports:** all
- **Evidence:** live: `#reviews` element absent; click leaves scrollY at 0; visible h1s = 3 on `/for-hosts` (hero + "Your rentals, run for you." + "Dashboard").

**What happens.** one nav item does nothing, and the mock's own headings pollute the outline.

**Why it matters.** first-click failure plus a broken reading order.

**Fix.** add the reviews section id or remove the item; mark the mock `aria-hidden`.

**Acceptance.** no dead nav item; one h1.

---

### P4-14 — Services sits in the primary nav as a placeholder with a date field

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /services
- **Section/element:** whole page
- **Viewports:** all
- **Evidence:** screenshot `./screenshots/public/marketing__services__d1440.jpg`: "Coming Soon", seven chips, search bar with "What / Search services" and "When / Add dates", ~40% empty.

**What happens.** a promised capability is a stub, and the search asks for dates it cannot use.

**Why it matters.** it spends a nav slot and invites dead clicks.

**Fix.** remove from nav until shipped; drop the date field.

**Acceptance.** no nav item leads to a placeholder.

---

### P4-16 — Support has 36 answers and no search

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /support
- **Section/element:** page header
- **Viewports:** all
- **Evidence:** live: 0 input elements; "Show all 36" is the only control; 2,690px at 390.

**What happens.** finding one answer means scrolling a long accordion.

**Why it matters.** this is the only real help content in the product.

**Fix.** keyword search over the FAQ set (client-side is enough), plus category chips.

**Acceptance.** typing a keyword filters the list.

---

### P4-20 — The property detail host name truncates and the sticky bar duplicates the rating

- **Priority:** P2
- **Type:** COPY · **UI impact:** Text only
- **Area:** Public surface
- **Route:** /properties/kame-home
- **Section/element:** host card, sticky booking bar
- **Viewports:** 390
- **Evidence:** screenshot `390-listing.png` (earlier pass) and `./screenshots/public/listings__property-detail__m390.jpg`: "Hosted by Kame Spa…", and the bar reads "₱4,500 / night · 4.5 ★ · 10 reviews" 200px below the same rating.

**What happens.** the trust anchor is cut off, and the bar repeats information instead of adding the total.

**Why it matters.** the host name is a decision input; the duplicate rating is noise.

**Fix.** allow two lines for the host name; replace the rating line with "total for N nights" once dates are chosen.

**Acceptance.** the full host name is readable at 390.

---

### P4-22 — The account area has no page headings and two navigations

- **Priority:** P2
- **Type:** REDESIGN · **UI impact:** Redesign (layout)
- **Area:** Public surface
- **Route:** /account/*
- **Section/element:** header, nav
- **Viewports:** all
- **Evidence:** manifest `h1: []` on all nine account routes; the nav link set contains the eight tile links twice (desktop rail + mobile grid) plus Trips and Messages in the bottom bar.

**What happens.** no page title, and Trips/Messages appear in two navigation surfaces at once.

**Why it matters.** users cannot tell where they are, and the duplicate entries compete.

**Fix.** one h1 per account route; four primary tiles + "More"; remove the duplicated destinations from the tile set.

**Acceptance.** one h1; no destination appears in two navs on the same screen.

---

### P4-23 — The account profile shows the same data twice

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /account/profile
- **Section/element:** summary card + edit form
- **Viewports:** all
- **Evidence:** screenshot `acc-390-profile.png`: avatar, name, email, location, phone and bio above a form containing Display name and Bio.

**What happens.** the data is displayed and immediately editable in two stacked blocks, doubling the page height (1,909px at 390).

**Why it matters.** users scan twice and are unsure which copy is authoritative.

**Fix.** a compact header with an Edit button that reveals the form.

**Acceptance.** the page shows either the summary or the form, not both.

---

### P4-24 — Account help is empty while support has 36 answers

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Public surface
- **Route:** /account/help
- **Section/element:** whole page
- **Viewports:** all
- **Evidence:** live: "No help topics yet"; `/support` lists 36.

**What happens.** the in-product help surface is empty and the public one has the content.

**Why it matters.** a signed-in guest is the audience most likely to need help.

**Fix.** reuse the support FAQ set (same source, filtered by audience).

**Acceptance.** `/account/help` shows the guest-relevant answers.

---

### P4-25 — Admin and property help surfaces are icon-dense at 390

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /admin/support/faqs, /admin/playbook, /admin/developments/:slug, /org/:org/team
- **Section/element:** row actions
- **Viewports:** 390
- **Evidence:** manifest at 390: 95 targets under 44px on admin FAQs (36×36 icons, 44×24 chips), 51 on the playbook, 65 on development detail, 10 on team (32×32).

**What happens.** edit/toggle/delete controls are icon-sized on a phone.

**Why it matters.** mis-taps in admin surfaces that change published content.

**Fix.** 44px hit pads (the `before:-inset` pattern already used by `InfoHint`) or move actions into an overflow menu.

**Acceptance.** no admin row action measures under 44px at 390.

---

### P4-26 — The public page editor is strong but clipped and icon-dense

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /org/:org/property/:slug/public-pages/:pageId/edit
- **Section/element:** sidebar, toolbar, template thumbnails
- **Viewports:** 1440, 390
- **Evidence:** screenshot `./screenshots/public/admin-gap__prop-public-page-edit__d1440.jpg`: "Public Pages" is half hidden behind the plan card at 900px height; 8 h1s come from the template thumbnails; 106 targets under 44px at 390.

**What happens.** a nav item is unreachable at a common laptop height, and the template thumbnails inject document headings.

**Why it matters.** the editor is the best-designed admin screen; the shell undermines it.

**Fix.** make the sidebar scroll independently of the plan card; render thumbnails as images or `aria-hidden`; enlarge toolbar targets.

**Acceptance.** every nav item is reachable at 900px height; one h1 on the editor.

---

### P4-27 — Paused team members and role badges fail contrast

- **Priority:** P2
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Public surface
- **Route:** /org/:org/team, /org/:org/property/:slug/team
- **Section/element:** member rows, role badges
- **Viewports:** all
- **Evidence:** measured: "Full Access" badge 2.28:1 at 12px; paused member name 2.4:1 at 14px with ancestor opacity 0.55; "Operations" 2.3:1.

**What happens.** the most privileged role looks like an error, and inactive members are unreadable.

**Why it matters.** role and status are the two things a host reads on this page.

**Fix.** neutral outlines for roles; express paused with a badge instead of opacity.

**Acceptance.** every row's name and role measure 4.5:1 or better.

---

### P4-28 — Parking notifications are a wall of raw ids

- **Priority:** P2
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Public surface
- **Route:** /org/:org/parking/:slug/notifications
- **Section/element:** notification feed
- **Viewports:** all
- **Evidence:** 4,297 characters; rows read `itest-f4a390de: 2 imported reservations overlap existing bookings or blocks…`, 17 times, some dated 2027.

**What happens.** engineering identifiers are the visible message, repeated with no grouping.

**Why it matters.** an operator cannot triage 17 near-identical rows.

**Fix.** group by conflict type with a count and one action; keep the id behind details.

**Acceptance.** the feed shows at most a few grouped rows.

---

### P4-29 — The admin shell clips nav at 900px height

- **Priority:** P2
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /org/:org/property/:slug/_, /admin/_, editor
- **Section/element:** left sidebar
- **Viewports:** 1440x900, 1280x800
- **Evidence:** screenshots `1440-prop-dashboard.png` and `./screenshots/public/admin-gap__prop-public-page-edit__d1440.jpg`: "Public Pages" clipped behind the plan card; Team/Settings/Help below the fold with no scroll cue.

**What happens.** the sidebar list continues under the plan card and the account block.

**Why it matters.** Settings and Help become hard to reach on the most common laptop height.

**Fix.** give the nav list its own scroll area with a fade, and pin the plan card below it.

**Acceptance.** every nav item is reachable and visible at 1440x800 without scrolling the page.

---

### P4-30 — The setup guide is still taking over deep links on fresh listings

- **Priority:** P2
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Public surface
- **Route:** /org/:org/property/:newSlug/*
- **Section/element:** full-page overlay
- **Viewports:** all
- **Evidence:** earlier pass, reconfirmed by the property audit; overlay renders over the requested page with no visible close (Escape works).

**What happens.** deep links to Finance/Bookings show the guide instead.

**Why it matters.** a new host cannot reach the page they clicked.

**Fix.** visible dismiss, remember it, and never block deep links.

**Acceptance.** dismissing the guide persists and the requested route renders.

---

### AC-05 — `/register` has no content of its own

- **Priority:** P3
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Auth, account and admin
- **Route:** /for-hosts/register, /for-guests/register
- **Section/element:** page
- **Viewports:** all
- **Evidence:** live: `probe-p4b-2.json → authRoutes` (both register URLs resolve to `/for-hosts/login` / `/for-guests/login`; titles identical "Log in or sign up")

**What happens.** Both register routes redirect to the matching login page. The heading is "Log in or sign up" and the only field is email, which then goes to an OTP step. That is a legitimate email-first pattern, but the URL, the heading and any "Create account" link never agree.

**Why it matters.** Low severity, but "register" is where a new host expects the terms/consent moment and where analytics usually splits intent. Right now the funnel has one step and no way to tell sign-up from sign-in.

**Fix.** Keep one page, but pass intent: heading "Create your host account" and CTA "Continue" on `/register`, and emit the intent in the analytics event.

**Acceptance.** `/for-hosts/register` shows a sign-up heading and the same single-field flow; the two routes are distinguishable in analytics.

---

### AC-06 — Desktop login column is top-light and bottom-heavy

- **Priority:** P3
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /for-hosts/login, /for-guests/login, /accept-invite siblings
- **Section/element:** right column vertical rhythm
- **Viewports:** 1440, 1024
- **Evidence:** `./screenshots/public/auth__host-login__d1440.jpg` (form block occupies y≈265–760 in a 900 viewport; nothing anchors the bottom)

**What happens.** The form is roughly centred but the card has no container, so the right half reads as floating text over a large empty field. The left hero ends at y≈735 and the right column continues to the footer with a 140px gap.

**Why it matters.** Cosmetic, but this is the highest-traffic authenticated-adjacent page and it looks less resolved than the marketing pages it links from.

**Fix.** Give the right column a max-width block with a bottom-anchored legal/support line, or centre the block optically (form centre at ~46% height).

**Acceptance.** At 1440 the form block has a deliberate top and bottom anchor and no ≥200px dead band inside the column.

---

### AC-10 — Bio counter is a bare number

- **Priority:** P3
- **Type:** COPY · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /account/profile
- **Section/element:** `Bio` label row, right side
- **Viewports:** all
- **Evidence:** `./screenshots/public/account__profile__d1440.jpg` shows "465"; live `probe-p4b.json → profile` shows the value dropping to "464" after typing one character

**What happens.** The counter shows remaining characters as an unlabelled `465`. Nothing says whether it is a limit, a count, or remaining.

**Why it matters.** A number floating at the end of a label row is read as a character count of what is typed, which is the opposite of what it is.

**Fix.** `33 / 500` style, or "465 left" in `text-meta`; hide until the field is focused or below 50 remaining.

**Acceptance.** The counter states its meaning in words or as `used / max`.

---

### AC-15 — Desktop trips is a 1040px card holding 300px of content

- **Priority:** P3
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /account/trips
- **Section/element:** trip list card
- **Viewports:** 1024, 1440
- **Evidence:** `./screenshots/public/account__trips__d1440.jpg`

**What happens.** Rows are ~84px tall and ~360px of content wide inside a full-width card, leaving ~650px of empty card to the right of every row, and ~500px of empty page below the card before the footer.

**Why it matters.** It reads as a mobile layout stretched, not a desktop design. It also wastes the chance to show the useful second column (dates, guest count, amount, next action).

**Fix.** Use the width: add columns for stay dates, status history or a "next step" line, or constrain the card to ~720px and centre it.

**Acceptance.** At 1440 no row contains more than ~35% empty horizontal space.

---

### AC-19 — "My Tickets" repeats the nav label, and the list is a header on an empty card

- **Priority:** P3
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /account/tickets
- **Section/element:** page header + list
- **Viewports:** 390
- **Evidence:** `./screenshots/public/account__tickets__m390.jpg`

**What happens.** The active tab already says "Tickets"; the card header says "My Tickets" with a "+ New" button, then one row, then ~560px of empty card. The heading is an `h3` under no `h2`.

**Why it matters.** Duplicate labels cost a scan and the empty card body makes a healthy account look broken.

**Fix.** Drop the "My Tickets" heading (keep "+ New" in the toolbar), and let the card size to its rows.

**Acceptance.** The page has one title and the list card is not taller than its content plus padding.

---

### AC-21 — Submit is disabled with no statement of what is missing

- **Priority:** P3
- **Type:** COPY · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /account/tickets/new
- **Section/element:** footer Submit
- **Viewports:** 390, 1440
- **Evidence:** live `probe-p4b.json → ticketNewSubmitDisabled: true` with an empty Subject and Details

**What happens.** Submit renders disabled and clicking does nothing. There is no inline hint and no per-field error, only red asterisks.

**Why it matters.** A dead primary button with no explanation is a silent failure. The user cannot tell whether the form is broken or incomplete.

**Fix.** Keep the button enabled and validate on submit with inline messages, or keep it disabled and add one line of help naming the missing fields.

**Acceptance.** Submitting an incomplete form produces an inline message per missing required field.

---

### AC-28 — "SYNCED" badge is unexplained

- **Priority:** P3
- **Type:** COPY · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /admin/support/faqs
- **Section/element:** badge next to every question
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__admin-faqs__d1440.jpg`

**What happens.** Every question carries a bare "SYNCED" chip, with no legend, no tooltip and no distinction from manual rows (there are none).

**Why it matters.** With 31/31 synced the badge is on everything, so it distinguishes nothing, while implying words the user does not have a definition for.

**Fix.** Drop the badge when it applies to every row; otherwise tooltip it ("Comes from the docs knowledge base") and reserve a contrasting "Manual" chip.

**Acceptance.** The badge carries a definition on hover/focus, or is absent.

---

### AC-33 — Payment rail switches look instant but commit with a Save that belongs to other fields

- **Priority:** P3
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Auth, account and admin
- **Route:** /admin/pricing/payment-settings
- **Section/element:** "Enabled rails" card
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__admin-payment-settings__d1440.jpg`; live `probe-p4b.json → payment` (toggle flips, no toast, Save becomes enabled; reload without Save reverts); leave-guard does fire (`probe-p4b-5.json → payGuard: dialog 1`)

**What happens.** Three switches sit at the top of a card whose "Save" button is below two unrelated numeric fields. Flipping a rail saves nothing until Save is pressed ~200px lower, and there is no dirty marker on the switches themselves.

**Why it matters.** Switches are the one control users expect to apply immediately. Because a leave-guard exists, no data is lost, but the mental model is wrong and the guard fires on people who thought they had already applied a change.

**Fix.** Autosave rails on toggle with a per-card saved state, or move Save into the card header so it belongs visually to the switches.

**Acceptance.** Toggling a rail either persists immediately with feedback, or the pending state is visible on the switch and the Save control is inside the same visual group.

---

### AC-38 — Activity log repeats the same event five times with the same actor and time

- **Priority:** P3
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Auth, account and admin
- **Route:** /activity dialog
- **Section/element:** rows 1–5
- **Viewports:** all
- **Evidence:** `./screenshots/public/admin-gap__prop-activity__d1440.jpg` — "Copied a guest trip link for Tomas Tan" ×3 consecutively, then later again, all `seed-owner@example.com · 2 hours ago`

**What happens.** Consecutive duplicate rows, each repeating the actor on every line even though every row has the same actor.

**Why it matters.** A log's value is signal density. Five identical rows push a week of real changes below the fold, and a per-row actor column that never varies is pure noise.

**Fix.** Collapse consecutive duplicates into "Copied Tomas Tan's trip link · 3 times"; show the actor only when it changes (or as an icon), and group by day.

**Acceptance.** Repeated identical events from the same actor within a minute render as one row with a count.

---

### GL-09 — Brand icons and one mock dashboard drive the host-page outline (duplicate with GL-02)

- **Priority:** P3
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Global
- **Route:** /for-hosts, /for-hosts/v2, /for-hosts/v3, /for-hosts/login
- **Section/element:** embedded product mock
- **Viewports:** 1440, 768
- **Evidence:** live h1 list on `/for-hosts/login` = ["Property management made simple", "Your rentals, run for you.", "Dashboard", "Log in or sign up"].

**What happens.** the marketing mock is a real DOM subtree with real headings and a real form-like UI; assistive tech reads a second product inside the page.

**Why it matters.** a screen-reader user on the login page hears two products before reaching the form.

**Fix.** mark the mock `aria-hidden="true"` and expose one short description, or render it as an image.

**Acceptance.** the mock contributes no headings or controls to the accessibility tree.

---

### GL-10 — No dead internal links across the public site (positive control)

- **Priority:** P3
- **Type:** FUNCTIONAL · **UI impact:** Behaviour
- **Area:** Global
- **Route:** public
- **Section/element:** link graph
- **Viewports:** n/a
- **Evidence:** crawl of 24 seed pages → 83 unique internal links, all resolve 200 with real content except the two anchor cases above; `./screenshots/public/data/linkcheck.json`.

**What happens.** nothing; recorded so future passes know the link graph was checked and clean.

**Why it matters.** it bounds the problem to layout, copy and flow rather than broken routing.

**Fix.** none.

**Acceptance.** keep the crawl green.

---

### LG-38 — Unknown location slugs silently fall back to all listings

- **Priority:** P3
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Listings and guest
- **Route:** /properties/in/pampanga, /parkings/in/pampanga, /developments/in/pampanga
- **Section/element:** Routing
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `live4.mjs` (`/properties/in/pampanga` -> `/properties`, `/parkings/in/pampanga` -> `/parkings`, `/developments/in/pampanga` -> `/developments`), while `/properties/in/san-fernando` resolves correctly with h1 "Homes in San Fernando"

**What happens.** A valid-looking city URL that is not in the index redirects to the unfiltered list with no notice. Only `san-fernando` exists today.

**Why it matters.** Shared or hand-typed links appear to work while showing the wrong inventory, and there is no zero-result state for a city with nothing.

**Fix.** Keep the URL and show "No homes in Pampanga yet" with nearby cities, or 404. Do not silently widen the search.

**Acceptance.** An unknown city slug renders an empty state naming the city; no redirect to the unfiltered list.

---

### LG-39 — Listing titles are inconsistent between surfaces

- **Priority:** P3
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /properties, /properties/kame-home, /hosts/kame-homes, /developments/.../properties
- **Section/element:** Card and page titles
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/listings__properties__d1440.jpg` ("Condo in San Fernando" / "Monaco 2604"), `shots/listings__host-public__d1440.jpg` ("Monaco 2604"), `shots/listings__development-properties__d1440.jpg` ("Monaco 2604")

**What happens.** The same unit is "Condo in San Fernando" on the search page and "Monaco 2604" everywhere else.

**Why it matters.** Guests comparing cards to a detail page cannot confirm it is the same place.

**Fix.** One title everywhere: "Monaco 2604" with a secondary "Condo in San Fernando, Azure North Residences".

**Acceptance.** Title string is identical on card, detail, host page and development carousel.

---

### LG-40 — The document page is a bare, unbranded dead end

- **Priority:** P3
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /properties/kame-home/document?token=…
- **Section/element:** Whole page
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `shots/guest-flow__document__m390.jpg`, manifest `document` (h1 none, 844px page with one card)

**What happens.** A guest opening a link from an email sees "This link is not available." on a white page with no logo, no explanation of which document failed, no expiry reason, and only Terms/Privacy/Cookies beneath.

**Why it matters.** This is reached from an email, so the visitor has no context about the product or what to do next.

**Fix.** Brand the page, say what the link was for ("Your Azure North guest form link has expired"), and offer "Ask your host to resend" plus a support link.

**Acceptance.** The page carries the brand, names the document type, and offers one recovery action.

---

### LG-41 — Money and units are formatted inconsistently

- **Priority:** P3
- **Type:** COPY · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /properties, /parkings, /properties/kame-home/form, /properties/kame-home
- **Section/element:** Prices and dimensions
- **Viewports:** All
- **Evidence:** `copy.json` (`₱4,500 / night`, `₱2,000.00`, `₱400 / night`, `5 m length`, `2.5 m width`, `2.1 m clearance`, `Check-in 2:00 PM` vs `Check-in: 2:00PM`)

**What happens.** Some prices have decimals, some do not; some have a space before the unit, some do not ("5 m", "2:00PM").

**Why it matters.** Small format drift reads as unfinished and makes scanning harder in a list of prices.

**Fix.** One money format (₱4,500, no decimals unless cents exist) and one unit format ("5m", "2:00 PM").

**Acceptance.** A grep of rendered price/time strings shows a single pattern per type.

---

### LG-42 — Filter groups say "None" where they mean "Any"

- **Priority:** P3
- **Type:** COPY · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /properties
- **Section/element:** Filter rail summary
- **Viewports:** 1024, 1440
- **Evidence:** `./screenshots/public/live/live-prop-zero.jpg` / `live3.json` ("Property Type / None", "Amenities / None", "Development / None", while Bedrooms shows the "Any" chip)

**What happens.** Three groups use "None" for "no filter selected" and a fourth uses "Any".

**Why it matters.** "None" reads as "no property types exist". It also contradicts the "Any" chip directly below.

**Fix.** Use "Any" consistently.

**Acceptance.** All unset groups read "Any".

---

### LG-43 — Trip and booking dates drop the separator convention

- **Priority:** P3
- **Type:** COPY · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /account/trips, /properties/kame-home/trip
- **Section/element:** Date ranges on cards
- **Viewports:** 390, 768, 1024, 1440
- **Evidence:** `live2.json` `trips` ("Nov 18-19, 2026", "Feb 1-2, 2027") versus "Nov 25, 2026" elsewhere

**What happens.** Ranges use a hyphen with no spaces; single dates use a comma. Other surfaces use a middot or en dash.

**Why it matters.** Minor, but dates are the primary content of a trip card.

**Fix.** "18-19 Nov 2026" (or "18 Nov - 19 Nov 2026") consistently for ranges.

**Acceptance.** All ranges use one format across trips, calendar summary and email.

---

### LG-44 — The footer tagline is travel marketing copy on transactional pages

- **Priority:** P3
- **Type:** COPY · **UI impact:** Text only
- **Area:** Listings and guest
- **Route:** /parkings, /parkings/requests/…, /properties/kame-home/form, /properties/kame-home/stay-guide
- **Section/element:** Footer brand blurb
- **Viewports:** All
- **Evidence:** `copy.json` ("Discover amazing vacation rentals across the Philippines. Book your perfect getaway with confidence.") on every route including the parking and payment pages

**What happens.** The same "amazing vacation rentals" sentence appears under a parking reservation and a booking form.

**Why it matters.** It is the safest kind of filler, it is wrong for two of the verticals, and it is the last thing a guest reads before paying.

**Fix.** Drop the blurb on transactional pages, or replace it with concrete trust facts (response time, verified hosts, refund policy).

**Acceptance.** Transactional routes show no generic marketing sentence in the footer.

---

### MK-07 — The same search control changes its labels between pages

- **Priority:** P3
- **Type:** COPY · **UI impact:** Text only
- **Area:** Marketing
- **Route:** / , /search
- **Section/element:** Hero search bar vs sticky search bar
- **Viewports:** all
- **Evidence:** `./screenshots/public/marketing__home__d1440.jpg` ("Where / When / Who"), `search-lower.png` (sticky bar "Anywhere / Anytime / 2 guests"), manifest button lists for both

**What happens.** On the homepage the three fields read Where / When / Who with values "Search destinations / Add dates / 2 guests". On `/search` the identical control reads Anywhere / Anytime / and drops the "Who" label entirely.

**Why it matters.** Two vocabularies for one control makes users re-learn it mid-task, and "Anywhere/Anytime" reads like a filter setting rather than a starting point.

**Fix.** Pick one label set and use it in both places. "Where / When / Who" with the same value strings is the clearer pair.

**Acceptance.** The same labels and value placeholders render on `/` and `/search` at every width.

---

### MK-08 — "Become a host?" is a button, not a link, and asks a question

- **Priority:** P3
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** / and every marketing page
- **Section/element:** Header CTA "Become a host?"
- **Viewports:** 1024/1440 (mobile hides it)
- **Evidence:** live: header markup is `<button>`; clicking navigates to `/for-hosts`; manifest smallTargets lists it as `BUTTON`

**What happens.** A navigation destination is implemented as a `<button>`, so it cannot be opened in a new tab, has no href for crawlers, and is announced as a button in the nav landmark. The label is phrased as a question.

**Why it matters.** Users lose standard link affordances on the site's main host-acquisition path, and "Become a host?" reads as a prompt for a decision rather than an action.

**Fix.** Render as `<a href="/for-hosts">Become a host</a>`. Keep the filled style.

**Acceptance.** The CTA is an anchor with `href="/for-hosts"` and still renders as the primary button.

---

### MK-09 — No skip link on public pages

- **Priority:** P3
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /, /support, /terms, /privacy (long pages)
- **Section/element:** Document start
- **Viewports:** all
- **Evidence:** live: `document.querySelectorAll('a')` filtered for `skip` returns 0; first focusable is the brand link

**What happens.** There is no "Skip to content" control. Keyboard users tab through brand, four nav links, theme toggle, host CTA and account control before reaching content.

**Why it matters.** On `/support` (36 Q&As, 5,903px expanded) and the legal pages, the nav/footer are the only repeated chrome, but repeated tabbing on every route is still avoidable friction.

**Fix.** Add a visually-hidden-until-focused "Skip to main content" link targeting `#main`, first in DOM order.

**Acceptance.** Pressing Tab once on any public route reveals the skip link and Enter moves focus into `<main>`.

---

### MK-12 — "1 homes available" on the development card

- **Priority:** P3
- **Type:** COPY · **UI impact:** Text only
- **Area:** Marketing
- **Route:** /search
- **Section/element:** Developments card badge
- **Viewports:** all
- **Evidence:** manifest button label `Condominium 1 homes available Century Properties…`; `search-lower.png`

**What happens.** Singular count rendered with a plural noun.

**Why it matters.** Small grammar failure on a card that is supposed to signal inventory quality; it reads as unlocalised template output.

**Fix.** Pluralise: `1 home available` / `N homes available`.

**Acceptance.** Count of 1 renders "1 home available".

---

### MK-18 — Two nested `<main>` landmarks on /search

- **Priority:** P3
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** /search
- **Section/element:** Document landmarks
- **Viewports:** all
- **Evidence:** live: `document.querySelectorAll('main').length === 2`; DOM shows `main > main`

**What happens.** A page-level `<main>` wraps another `<main>` around the results region.

**Why it matters.** Multiple `main` landmarks break the "jump to main content" affordance in screen readers and violate the single-main rule.

**Fix.** Remove the inner `<main>`; use `<section aria-labelledby>` for the results region.

**Acceptance.** Exactly one `<main>` element on `/search`.

---

### MK-25 — "Start free" / "Create account" both land on "Log in or sign up"

- **Priority:** P3
- **Type:** FLOW · **UI impact:** Behaviour
- **Area:** Marketing
- **Route:** /for-hosts, /for-hosts/pricing
- **Section/element:** Primary host CTAs
- **Viewports:** all
- **Evidence:** live href map → "Start free" `/for-hosts/login`, "Create account" `/for-hosts/login`, "View pricing" `/for-hosts/pricing`; navigating to `/for-hosts/register` silently resolves to `/for-hosts/login` whose heading is "Log in or sign up"

**What happens.** Sign-up-intent labels lead to an auth page titled for both actions, with no plan context preserved from the pricing page.

**Why it matters.** Minor but cumulative: the button promises free signup, the destination says "log in", and a user who just chose "Starter" arrives with no indication of what they selected.

**Fix.** Carry intent (`?plan=starter&intent=signup`) and title the page accordingly ("Create your host account"), or rename the CTAs to "Sign up free" to match the destination.

**Acceptance.** Clicking any host CTA lands on a page whose heading matches the CTA wording, with the chosen plan reflected.

---

### MK-42 — Cookie consent nudges in opposite directions on two surfaces

- **Priority:** P3
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Marketing
- **Route:** /cookies vs the consent banner (all routes)
- **Section/element:** Consent buttons
- **Viewports:** all
- **Evidence:** `host-login2.png` banner: "Allow analytics" is the filled primary, "Essential only" is plain text. `./screenshots/public/marketing__cookies__d1440.jpg` "Cookie settings" block: "Essential only" is the filled primary, "Allow analytics" is ghost.

**What happens.** The same two choices are given opposite visual weight depending on where you meet them. The policy also calls the same category both "Necessary" and "Essential".

**Why it matters.** Asymmetric emphasis on a consent choice is the pattern regulators treat as a dark pattern, and having the emphasis flip between screens makes it look deliberate.

**Fix.** Give both options equal visual weight in both places, and use one word for the required category throughout.

**Acceptance.** Both consent surfaces render the two choices with identical styling and identical labels.

---

### MK-44 — 404 page offers a check-mark icon and one destination

- **Priority:** P3
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Marketing
- **Route:** 404
- **Section/element:** "Take me home" button
- **Viewports:** all
- **Evidence:** `./screenshots/public/marketing__404__d1440.jpg` — the CTA carries a check-circle glyph (the "success/confirmed" icon used elsewhere for completed steps)

**What happens.** A "recovered / done" icon is used for a navigation action, and the only recovery path is the homepage; there are no links to Stays, Support or search.

**Why it matters.** The icon signals the opposite of "this page is missing", and a single dead-end action sends users back to the top rather than to what they wanted.

**Fix.** Use a home or arrow icon; add a search field and three links (Stays, Parkings, Support).

**Acceptance.** The 404 CTA uses a navigation icon and the page exposes at least one search or three category links.

---

### MK-48 — Theme switch is unreachable below 1024

- **Priority:** P3
- **Type:** A11Y · **UI impact:** UI + markup
- **Area:** Marketing
- **Route:** marketing pages
- **Section/element:** Theme toggle
- **Viewports:** 320/390/768
- **Evidence:** live at 390 → `themeBtn: true, visible: false` (`offsetParent === null`); no equivalent control in the bottom tab bar

**What happens.** The light/dark control is hidden on phones and tablets, so the stored preference cannot be changed on the device most users are on.

**Why it matters.** Dark mode is a real accessibility preference; hiding the only switch on the primary device makes the feature desktop-only.

**Fix.** Expose the toggle in the mobile "More" sheet or the account sheet.

**Acceptance.** The theme can be changed at 390 without resizing the viewport.

---

### P4-12 — Register URLs redirect to the login page

- **Priority:** P3
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /for-hosts/register, /for-guests/register
- **Section/element:** redirect
- **Viewports:** all
- **Evidence:** both redirect to `/for-hosts/login` (and `/for-guests/login`) and open the register tab, so the URL, the page title and the visible tab disagree.

**What happens.** sharing or bookmarking a register link gives the other URL.

**Why it matters.** minor trust and analytics confusion.

**Fix.** render the register tab at its own URL instead of redirecting.

**Acceptance.** `/for-*-register` keeps its path.

---

### P4-17 — Legal pages have no section index

- **Priority:** P3
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /terms, /privacy
- **Section/element:** page layout
- **Viewports:** 390, 768
- **Evidence:** 6,354px and 7,519px at 390, no in-page anchors.

**What happens.** a single unbroken column of legal text.

**Why it matters.** nobody can find a clause on a phone.

**Fix.** a sticky clause index (collapsible on mobile) and anchor links.

**Acceptance.** each section is linkable.

---

### P4-18 — The home page listing row shows one card in a multi-card row

- **Priority:** P3
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /
- **Section/element:** "Find your next stay" row
- **Viewports:** 1024, 1440
- **Evidence:** screenshot `./screenshots/public/marketing__home__d1440.jpg`, one card with a "New" badge.

**What happens.** a carousel row with a single item and empty space beside it.

**Why it matters.** it looks like a failed load.

**Fix.** stretch the card or show a "more coming" tile.

**Acceptance.** the row is visually complete with one item.

---

### P4-19 — The trip page wastes half the viewport

- **Priority:** P3
- **Type:** UI-CHANGE · **UI impact:** UI change (same layout)
- **Area:** Public surface
- **Route:** /properties/kame-home/trip
- **Section/element:** layout
- **Viewports:** 1440
- **Evidence:** screenshot `./screenshots/public/guest-flow__trip__d1440.jpg`: a 300px card inside a 640px band, then ~350px of empty space above the footer.

**What happens.** the page has a full-height decorative band for a single card.

**Why it matters.** it reads as an error page rather than a state.

**Fix.** size the band to the content or use the space for the sign-in form.

**Acceptance.** no dead vertical band.

---

### P4-21 — Route-level page titles do not match the page

- **Priority:** P3
- **Type:** CONTENT · **UI impact:** Text only
- **Area:** Public surface
- **Route:** /parkings, /for-guests/login, announcement detail
- **Section/element:** document title
- **Viewports:** n/a
- **Evidence:** `document.title` is "Kame Space" on most marketing routes (no page-specific title); the parking announcements page title reads "Dashboard".

**What happens.** browser tabs, history and shares all say the same thing.

**Why it matters.** tabs are indistinguishable and shares look generic.

**Fix.** set `document.title` per route from a single registry (the SEO route registry already exists).

**Acceptance.** each route has a distinct title.

---
