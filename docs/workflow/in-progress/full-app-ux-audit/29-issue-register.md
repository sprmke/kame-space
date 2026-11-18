---
title: 'Audit 29: issue register'
status: active
tags: [audit, register, priority, ui-change, public]
updated: 2026-11-18
---

# 29: Issue register

Every issue from the public-surface pass, in one ranked list. Machine-readable twin:
[`issue-register.json`](./issue-register.json) (one object per issue, same fields). Use the JSON when an
agent needs to filter by area, priority, type or route; read this page when a human needs the shape of
the problem.

Narrative and page-by-page detail: [28-public-surface-audit.md](./28-public-surface-audit.md). Design
system, host dashboard, parking and admin findings from the earlier phase stay in [23](./23-design-system-critique.md)-[27](./27-design-remediation-backlog.md);
this register covers what those passes did not: the marketing shell, listings, guest operational flows,
auth, the guest account, and the dashboard surfaces that had not been opened yet.

## How to read an item

| Field         | Meaning                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Priority**  | `P0` blocks a core task or leaks data · `P1` wrong or unreachable · `P2` real UX debt · `P3` polish                                                                                                                |
| **Type**      | `REDESIGN` layout restructure · `UI-CHANGE` component/state within the layout · `COPY` text · `CONTENT` data/content · `A11Y` markup and accessibility · `FUNCTIONAL` broken behaviour · `FLOW` multi-step journey |
| **UI impact** | The flag you asked for: does the fix change the interface, and how much                                                                                                                                            |
| **Route**     | Where to look. Combined with [route-inventory.md](./route-inventory.md) this gives the component file                                                                                                              |
| **Evidence**  | Screenshot path in [`screenshots/public/`](./screenshots/public/) or a live reproduction                                                                                                                           |

**UI impact values**

| Value                   | What it means for planning                       | Count |
| ----------------------- | ------------------------------------------------ | ----- |
| Redesign (layout)       | screens move, split, or lose elements            | 16    |
| UI change (same layout) | screens stay, a component or state changes       | 47    |
| UI + markup             | markup and focus/labels change, no visual design | 25    |
| Text only               | strings only, no layout                          | 52    |
| Behaviour               | logic changes, UI may stay identical             | 41    |

**Total: 181 issues** — 2 P0, 53 P1, 94 P2, 32 P3.

| Area                    | Issues |
| ----------------------- | ------ |
| Auth, account and admin | 52     |
| Marketing               | 48     |
| Listings and guest      | 41     |
| Public surface          | 30     |
| Global                  | 10     |

## Start here — top 20 by impact

If you only fix twenty things, these. Chosen for user trust, money, and blocks-the-task severity.

| #   | ID    | Issue                                                                                      | Why now                      |
| --- | ----- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| 1   | GL-01 | The auth gate is a dead end on every gated intent                                          | P0 · Global                  |
| 2   | LG-04 | The payment step never shows what the stay costs                                           | P0 · Listings and guest      |
| 3   | LG-16 | The parking deep link drops its stay context                                               | P1 · Listings and guest      |
| 4   | P4-02 | Trip links cannot be opened by the guest who received them                                 | P1 · Public surface          |
| 5   | P4-03 | The calendar shows no availability state                                                   | P1 · Public surface          |
| 6   | MK-04 | Suggested destinations lead straight to a dead end                                         | P1 · Marketing               |
| 7   | MK-35 | /contact promises a message form that requires an account and never appears                | P1 · Marketing               |
| 8   | AC-22 | `/onboarding` and `/verification-rejected` both redirect to the org Dashboard              | P1 · Auth, account and admin |
| 9   | AC-31 | Super-admin sidebar hides 7 of 21 destinations at 1440x900 with no scroll cue              | P1 · Auth, account and admin |
| 10  | AC-50 | Published showcase hero text sits at 1.1:1 over the photo                                  | P1 · Auth, account and admin |
| 11  | LG-06 | Every parking image is a dead third-party URL, so alt text renders over empty cards        | P1 · Listings and guest      |
| 12  | LG-10 | Calendar renders 27 contrast failures and does not distinguish available, blocked and past | P1 · Listings and guest      |
| 13  | MK-27 | The Free plan is off-screen when the pricing carousel loads                                | P1 · Marketing               |
| 14  | MK-03 | Featured-stays section shows one card in a full-width band                                 | P1 · Marketing               |
| 15  | P4-05 | The showcase page duplicates the listing and leaks the demo host                           | P1 · Public surface          |
| 16  | P4-15 | Contact cannot be used without an account                                                  | P1 · Public surface          |
| 17  | P4-22 | The account area has no page headings and two navigations                                  | P2 · Public surface          |
| 18  | MK-01 | Hero photograph contradicts the inventory and the brand                                    | P1 · Marketing               |
| 19  | LG-22 | The parking detail page is almost empty, so the vertical has no product page               | P1 · Listings and guest      |
| 20  | AC-08 | "On this device" is a build/cache debug panel on a guest page                              | P1 · Auth, account and admin |

## Corrections after verification

An independent verifier tried to falsify eighteen parent claims. Three did not survive as written and are
recorded here so nobody re-reports them.

| Claim                                              | Outcome                     | Correction                                                                                                                                                                                            |
| -------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The guest form pre-fills a stranger for everyone" | **partly false**            | Only **signed-in** guests get the random identity, and only on a dev build (`showDevControls = !import.meta.env.PROD`). Anonymous visitors get an empty form. Re-scoped to P2 with the dev-only note. |
| "The map shows Google's error"                     | **verified, conditionally** | The map initialises lazily: the error text appears once the "Where you'll be" section scrolls into view. Reading the DOM without scrolling finds neither the error nor an iframe.                     |
| "`/accept-invite` is blank"                        | **false as written**        | It renders one sentence, "This invitation link is invalid.", with **zero links and zero buttons** and no brand chrome. Corrected from "blank" to "dead end with no action".                           |

Two further agent claims were re-scoped after reading the source: the "Developer controls" panel and the
random prefill are both gated behind `!import.meta.env.PROD`, so they cannot reach a production bundle,
but they do make local and staging captures unrepresentative.

## Priority groups

### P0 — blocks a task or leaks data (2)

| ID    | ✓   | Area               | Issue                                             | Type | UI impact | Route                                                      |
| ----- | --- | ------------------ | ------------------------------------------------- | ---- | --------- | ---------------------------------------------------------- |
| GL-01 | ✓   | Global             | The auth gate is a dead end on every gated intent | FLOW | Behaviour | `/contact, /properties/kame-home/form, /parkings/monaco-…` |
| LG-04 |     | Listings and guest | The payment step never shows what the stay costs  | FLOW | Behaviour | `/properties/kame-home/form step 5`                        |

### P1 — wrong, unreachable, or misleading (53)

| ID    | ✓   | Area                    | Issue                                                                                      | Type       | UI impact               | Route                                                      |
| ----- | --- | ----------------------- | ------------------------------------------------------------------------------------------ | ---------- | ----------------------- | ---------------------------------------------------------- |
| AC-01 | ✓   | Auth, account and admin | Invalid invite link is a total dead end                                                    | FLOW       | Behaviour               | `/accept-invite`                                           |
| AC-08 |     | Auth, account and admin | "On this device" is a build/cache debug panel on a guest page                              | CONTENT    | Text only               | `/account/profile`                                         |
| AC-11 |     | Auth, account and admin | Guest Help is an empty shell with no search                                                | CONTENT    | Text only               | `/account/help`                                            |
| AC-22 | ✓   | Auth, account and admin | `/onboarding` and `/verification-rejected` both redirect to the org Dashboard              | FUNCTIONAL | Behaviour               | `/onboarding, /verification-rejected`                      |
| AC-26 |     | Auth, account and admin | FAQ edit opens a dialog that says "edit this in a markdown file"                           | CONTENT    | Text only               | `/admin/support/faqs`                                      |
| AC-31 | ✓   | Auth, account and admin | Super-admin sidebar hides 7 of 21 destinations at 1440x900 with no scroll cue              | UI-CHANGE  | UI change (same layout) | `/admin/*`                                                 |
| AC-37 | ✓   | Auth, account and admin | `/activity` is Settings with a dialog on top, and the URL rewrites                         | FLOW       | Behaviour               | `/org/:orgSlug/property/:propertySlug/activity`            |
| AC-39 |     | Auth, account and admin | The Help & Support "Guides" tile leads to "No guides yet"                                  | CONTENT    | Text only               | `/org/:orgSlug/property/:propertySlug/help-support/docs`   |
| AC-43 |     | Auth, account and admin | Paused team members are rendered at ~40% opacity and fail contrast                         | A11Y       | UI + markup             | `/org/:orgSlug/team`                                       |
| AC-45 |     | Auth, account and admin | Parking notifications print a raw task id in an alert body                                 | CONTENT    | Text only               | `/org/.../parking/monaco-level-2-slot-27/notifications`    |
| AC-50 | ✓   | Auth, account and admin | Published showcase hero text sits at 1.1:1 over the photo                                  | A11Y       | UI + markup             | `/org/:orgSlug/property/:propertySlug/public-pages/showc…` |
| AC-52 |     | Auth, account and admin | "Open page" is clipped off the right edge at 390                                           | UI-CHANGE  | UI change (same layout) | `showcase editor`                                          |
| GL-02 | ✓   | Global                  | Three public pages have no h1, and four host pages have three or four                      | A11Y       | UI + markup             | `/search, /properties, /parkings, /developments, /proper…` |
| LG-06 | ✓   | Listings and guest      | Every parking image is a dead third-party URL, so alt text renders over empty cards        | CONTENT    | Text only               | `/parkings, /parkings/monaco-level-2-slot-27, /developme…` |
| LG-07 | ✓   | Listings and guest      | "Parking in Other" appears as the listing name on four surfaces                            | CONTENT    | Text only               | `/parkings, /developments/azure-north-residences, /devel…` |
| LG-08 |     | Listings and guest      | Result grids do not fill the viewport, so one result floats in an empty page               | UI-CHANGE  | UI change (same layout) | `/properties, /parkings, /developments, /developments/az…` |
| LG-09 |     | Listings and guest      | Two different listing card designs for the same property                                   | REDESIGN   | Redesign (layout)       | `/properties vs /developments/azure-north-residences/pro…` |
| LG-10 | ✓   | Listings and guest      | Calendar renders 27 contrast failures and does not distinguish available, blocked and past | A11Y       | UI + markup             | `/properties/kame-home/calendar`                           |
| LG-11 |     | Listings and guest      | At 320 the calendar is clipped and its own CTA covers the last week                        | UI-CHANGE  | UI change (same layout) | `/properties/kame-home/calendar`                           |
| LG-13 |     | Listings and guest      | The showcase section nav is six invisible 6px slivers, plus a stray fixed legal strip      | UI-CHANGE  | UI change (same layout) | `/properties/kame-home/showcase, /properties/kame-home/s…` |
| LG-14 |     | Listings and guest      | The trip page is unopenable for the guest it was emailed to                                | FLOW       | Behaviour               | `/properties/kame-home/trip?bookingId=5eed1000-0000-4000…` |
| LG-15 | ✓   | Listings and guest      | `/messages` has no message box and bounces to the listing                                  | FUNCTIONAL | Behaviour               | `/properties/kame-home/messages`                           |
| LG-16 | ✓   | Listings and guest      | The parking deep link drops its stay context                                               | FLOW       | Behaviour               | `/properties/kame-home/parking/5eed1100-0000-4000-8000-0…` |
| LG-17 | ✓   | Listings and guest      | Share fails on desktop                                                                     | FUNCTIONAL | Behaviour               | `/properties/kame-home`                                    |
| LG-18 |     | Listings and guest      | `/success` silently redirects to the calendar                                              | FLOW       | Behaviour               | `/properties/kame-home/success`                            |
| LG-19 |     | Listings and guest      | "Pay to confirm" shows no amount due and claims a timer that does not exist                | FLOW       | Behaviour               | `/parkings/requests/5eed1100-0000-4000-8000-000000000001`  |
| LG-20 |     | Listings and guest      | Mobile property detail collapses a five-photo gallery into one 358x200 frame               | UI-CHANGE  | UI change (same layout) | `/properties/kame-home`                                    |
| LG-21 |     | Listings and guest      | Save and Contact host require an account before the guest has decided anything             | FLOW       | Behaviour               | `/properties/kame-home`                                    |
| LG-22 |     | Listings and guest      | The parking detail page is almost empty, so the vertical has no product page               | REDESIGN   | Redesign (layout)       | `/parkings/monaco-level-2-slot-27`                         |
| MK-01 |     | Marketing               | Hero photograph contradicts the inventory and the brand                                    | REDESIGN   | Redesign (layout)       | `/`                                                        |
| MK-03 |     | Marketing               | Featured-stays section shows one card in a full-width band                                 | REDESIGN   | Redesign (layout)       | `/`                                                        |
| MK-04 |     | Marketing               | Suggested destinations lead straight to a dead end                                         | FUNCTIONAL | Behaviour               | `/`                                                        |
| MK-05 | ✓   | Marketing               | Header nav overlaps the theme toggle at 1024                                               | UI-CHANGE  | UI change (same layout) | `/ (and /search, /services, /about, /contact, /support, …` |
| MK-10 |     | Marketing               | /search has no h1                                                                          | A11Y       | UI + markup             | `/search`                                                  |
| MK-11 | ✓   | Marketing               | Development card advertises "From ₱0 / night"                                              | CONTENT    | Text only               | `/search`                                                  |
| MK-13 |     | Marketing               | Parking result card renders a broken image and its alt text as visible content             | FUNCTIONAL | Behaviour               | `/search`                                                  |
| MK-19 |     | Marketing               | /for-hosts has three h1 elements, one of them from a screenshot mock                       | A11Y       | UI + markup             | `/for-hosts`                                               |
| MK-20 |     | Marketing               | "Reviews" nav link points at an anchor that does not exist                                 | FUNCTIONAL | Behaviour               | `/for-hosts, /for-hosts/pricing`                           |
| MK-21 |     | Marketing               | Host hero H1's second line fails AA large-text contrast                                    | A11Y       | UI + markup             | `/for-hosts (also /for-hosts/v2, /for-hosts/v3)`           |
| MK-22 |     | Marketing               | Host landing content column is ~740px wide on a 1440 canvas                                | REDESIGN   | Redesign (layout)       | `/for-hosts`                                               |
| MK-27 | ✓   | Marketing               | The Free plan is off-screen when the pricing carousel loads                                | REDESIGN   | Redesign (layout)       | `/for-hosts/pricing`                                       |
| MK-30 |     | Marketing               | Compare-features table is unreadable on a phone                                            | UI-CHANGE  | UI change (same layout) | `/for-hosts/pricing`                                       |
| MK-32 |     | Marketing               | Supported FAQ contains a literal `<step>` placeholder                                      | CONTENT    | Text only               | `/support`                                                 |
| MK-35 |     | Marketing               | /contact promises a message form that requires an account and never appears                | FLOW       | Behaviour               | `/contact`                                                 |
| MK-38 |     | Marketing               | /about reads like release notes, not an about page                                         | COPY       | Text only               | `/about`                                                   |
| MK-39 |     | Marketing               | /services is a top-level nav destination that is a "Coming Soon" placeholder               | CONTENT    | Text only               | `/services (linked from every header and footer)`          |
| MK-45 |     | Marketing               | Host login page has four h1s, one of them a mock label                                     | A11Y       | UI + markup             | `/for-hosts/login`                                         |
| P4-02 | ✓   | Public surface          | Trip links cannot be opened by the guest who received them                                 | FLOW       | Behaviour               | `/properties/kame-home/trip`                               |
| P4-03 | ✓   | Public surface          | The calendar shows no availability state                                                   | REDESIGN   | Redesign (layout)       | `/properties/kame-home/calendar`                           |
| P4-04 | ✓   | Public surface          | The pay-parking link silently redirects to the listings                                    | FLOW       | Behaviour               | `/properties/kame-home/parking/:bookingId`                 |
| P4-05 | ✓   | Public surface          | The showcase page duplicates the listing and leaks the demo host                           | CONTENT    | Text only               | `/properties/kame-home/showcase`                           |
| P4-07 | ✓   | Public surface          | Four browse pages have no h1                                                               | A11Y       | UI + markup             | `/search, /properties, /parkings, /developments`           |
| P4-15 | ✓   | Public surface          | Contact cannot be used without an account                                                  | FLOW       | Behaviour               | `/contact`                                                 |

### P2 — real UX debt (94)

| ID    | ✓   | Area                    | Issue                                                                                                    | Type       | UI impact               | Route                                                        |
| ----- | --- | ----------------------- | -------------------------------------------------------------------------------------------------------- | ---------- | ----------------------- | ------------------------------------------------------------ |
| AC-02 |     | Auth, account and admin | Wrong OTP surfaces a raw provider error string                                                           | COPY       | Text only               | `/for-hosts/login, /for-guests/login (code step)`            |
| AC-03 |     | Auth, account and admin | Host login loses the product story on mobile, guest login keeps three screens of it                      | REDESIGN   | Redesign (layout)       | `/for-hosts/login vs /for-guests/login`                      |
| AC-04 |     | Auth, account and admin | The guest login hero advertises a product that does not exist                                            | CONTENT    | Text only               | `/for-guests/login, /for-guests/register`                    |
| AC-07 |     | Auth, account and admin | Profile repeats the whole identity block twice before the first field                                    | REDESIGN   | Redesign (layout)       | `/account/profile`                                           |
| AC-09 |     | Auth, account and admin | Push-alert toggle never resolves                                                                         | FUNCTIONAL | Behaviour               | `/account/profile`                                           |
| AC-12 |     | Auth, account and admin | A future trip is filed under PAST                                                                        | FUNCTIONAL | Behaviour               | `/account/trips`                                             |
| AC-13 |     | Auth, account and admin | Broken thumbnail on the parking trip row                                                                 | FUNCTIONAL | Behaviour               | `/account/trips`                                             |
| AC-14 |     | Auth, account and admin | Same parking listing named two different ways                                                            | CONTENT    | Text only               | `/account/trips, host Dashboard recent bookings`             |
| AC-16 |     | Auth, account and admin | Messages is one row over 600px of nothing, authored by "seed-owner"                                      | REDESIGN   | Redesign (layout)       | `/account/messages`                                          |
| AC-17 |     | Auth, account and admin | Vouchers have no expiry, no code, and no way to use them                                                 | FUNCTIONAL | Behaviour               | `/account/vouchers`                                          |
| AC-18 |     | Auth, account and admin | Favorites truncates the only listing at 390                                                              | UI-CHANGE  | UI change (same layout) | `/account/favorites`                                         |
| AC-20 |     | Auth, account and admin | New ticket sheet opens with the Details field sliced by Submit                                           | UI-CHANGE  | UI change (same layout) | `/account/tickets/new`                                       |
| AC-23 |     | Auth, account and admin | Playbook renders the database slug under every article title                                             | CONTENT    | Text only               | `/admin/playbook`                                            |
| AC-24 |     | Auth, account and admin | The bare "31" pill is a pagination size with no pagination                                               | FUNCTIONAL | Behaviour               | `/admin/playbook, /admin/support/faqs`                       |
| AC-25 |     | Auth, account and admin | Playbook clamps body copy to two lines on mobile with no way to expand                                   | UI-CHANGE  | UI change (same layout) | `/admin/playbook`                                            |
| AC-27 |     | Auth, account and admin | 31 FAQs, nine categories, no search and no filter                                                        | FUNCTIONAL | Behaviour               | `/admin/support/faqs`                                        |
| AC-29 |     | Auth, account and admin | Ops reports show "CRITICAL 0" in red on every row and two different "current weeks"                      | UI-CHANGE  | UI change (same layout) | `/admin/ops-reports`                                         |
| AC-30 |     | Auth, account and admin | Ops report detail exposes "Copy agent prompt" and env-var names                                          | CONTENT    | Text only               | `/admin/ops-reports/:reportId`                               |
| AC-32 |     | Auth, account and admin | The AI page shows a projection below actual spend and a chart with no bars                               | FUNCTIONAL | Behaviour               | `/admin/ai?tab=usage (from /admin/ai-usage)`                 |
| AC-34 |     | Auth, account and admin | Payment rail switches lose their row at 390                                                              | UI-CHANGE  | UI change (same layout) | `/admin/pricing/payment-settings`                            |
| AC-35 |     | Auth, account and admin | Development detail truncates a section name and drops the section nav on mobile                          | UI-CHANGE  | UI change (same layout) | `/admin/developments/azure-north-residences`                 |
| AC-36 |     | Auth, account and admin | 15 unnamed controls and up to 89 sub-44px targets on the development page                                | A11Y       | UI + markup             | `/admin/developments/azure-north-residences`                 |
| AC-40 |     | Auth, account and admin | Property sidebar cuts a nav item mid-word at 900px                                                       | UI-CHANGE  | UI change (same layout) | `/org/:orgSlug/property/:propertySlug/*`                     |
| AC-41 |     | Auth, account and admin | Announcements use a red "error" dot for informational items                                              | UI-CHANGE  | UI change (same layout) | `/org/.../announcements, /org/.../parking/.../announcements` |
| AC-42 |     | Auth, account and admin | Team KPI roles sum to more members than exist                                                            | FUNCTIONAL | Behaviour               | `/org/:orgSlug/team`                                         |
| AC-44 |     | Auth, account and admin | Team tabs become three 36×32 unlabelled-looking icons at 390                                             | UI-CHANGE  | UI change (same layout) | `/org/:orgSlug/team`                                         |
| AC-46 |     | Auth, account and admin | A notification's title and body name different guests                                                    | FUNCTIONAL | Behaviour               | `parking notifications (Activity)`                           |
| AC-47 |     | Auth, account and admin | Four rose-coloured KPI tiles make notifications look like an outage                                      | UI-CHANGE  | UI change (same layout) | `parking notifications`                                      |
| AC-48 |     | Auth, account and admin | "Manage" degrades to a share-looking icon at 390                                                         | UI-CHANGE  | UI change (same layout) | `parking notifications`                                      |
| AC-49 |     | Auth, account and admin | Telegram tab reads like a spec document                                                                  | COPY       | Text only               | `parking notifications → Telegram tab`                       |
| AC-51 |     | Auth, account and admin | The editor renders three `<h1>`s, two of them "Showcase"                                                 | A11Y       | UI + markup             | `same editor route`                                          |
| GL-03 | ✓   | Global                  | The global nav and footer change shape per page                                                          | UI-CHANGE  | UI change (same layout) | `marketing and listing pages`                                |
| GL-04 | ✓   | Global                  | A Gmail address is the public contact address                                                            | CONTENT    | Text only               | `/about, /contact, /support, footer on every marketing page` |
| GL-05 | ✓   | Global                  | The public pricing page carries three competing recommendation badges                                    | COPY       | Text only               | `/for-hosts/pricing`                                         |
| GL-06 | ✓   | Global                  | The Free plan advertises "Finance management", which is a paid capability                                | CONTENT    | Text only               | `/for-hosts/pricing`                                         |
| GL-07 | ✓   | Global                  | "Reviews" in the host nav points at a section that does not exist                                        | FUNCTIONAL | Behaviour               | `/for-hosts, /for-hosts/pricing, /for-hosts/v2, /for-hos…`   |
| GL-08 | ✓   | Global                  | /services is a "Coming Soon" stub in the primary nav, with a date filter on it                           | UI-CHANGE  | UI change (same layout) | `/services`                                                  |
| LG-03 |     | Listings and guest      | "Developer controls" is rendered on the guest payment step, and it is the root cause of LG-02            | FUNCTIONAL | Behaviour               | `/properties/kame-home/form (step 5, Payment)`               |
| LG-05 |     | Listings and guest      | Public host page publishes the seed identity and seed copy                                               | CONTENT    | Text only               | `/hosts/kame-homes`                                          |
| LG-23 |     | Listings and guest      | Nine routes have no h1                                                                                   | A11Y       | UI + markup             | `/properties, /parkings, /developments, /parking-form, /…`   |
| LG-24 |     | Listings and guest      | Sort has no price option                                                                                 | COPY       | Text only               | `/properties`                                                |
| LG-25 |     | Listings and guest      | Filter defaults flip between sibling listing pages, and parking search drops "Who"                       | UI-CHANGE  | UI change (same layout) | `/properties vs /parkings vs /developments vs /developme…`   |
| LG-26 |     | Listings and guest      | The parking search bar pins itself over the site navigation on scroll                                    | UI-CHANGE  | UI change (same layout) | `/parkings`                                                  |
| LG-27 |     | Listings and guest      | The developments list renders a condo listing priced at ₱0 per night                                     | CONTENT    | Text only               | `/developments, /developments/in/pampanga`                   |
| LG-28 |     | Listings and guest      | Development detail spends its hero on a 135px strip and explains nothing                                 | REDESIGN   | Redesign (layout)       | `/developments/azure-north-residences`                       |
| LG-29 |     | Listings and guest      | At 320 the bottom tab bar covers the development's primary CTA                                           | UI-CHANGE  | UI change (same layout) | `/developments/azure-north-residences`                       |
| LG-30 |     | Listings and guest      | "Submit review & continue" looks enabled but is disabled, and the fixed nav covers the first rating rows | A11Y       | UI + markup             | `/properties/kame-home/guest-review?bookingId=…`             |
| LG-31 |     | Listings and guest      | The form's own copy is internal jargon                                                                   | COPY       | Text only               | `/properties/kame-home/form`                                 |
| LG-32 |     | Listings and guest      | Form data entry is inconsistent and the desktop layout wastes the screen                                 | UI-CHANGE  | UI change (same layout) | `/properties/kame-home/form`                                 |
| LG-33 |     | Listings and guest      | The pets step contradicts its own policy and shows pet fields whether or not a pet is coming             | FUNCTIONAL | Behaviour               | `/properties/kame-home/form step 4 (Pets)`                   |
| LG-34 |     | Listings and guest      | Three different cancellation sentences, one of them ungrammatical                                        | COPY       | Text only               | `/properties/kame-home (sidebar and policy block), /prop…`   |
| LG-35 |     | Listings and guest      | One action, four names                                                                                   | COPY       | Text only               | `/properties/kame-home (Reserve), /properties/kame-home/…`   |
| LG-36 |     | Listings and guest      | The stay guide's document status contradicts itself and uses internal identities                         | CONTENT    | Text only               | `/properties/kame-home/stay-guide?token=…`                   |
| LG-37 |     | Listings and guest      | The rating distribution bars render at equal length                                                      | CONTENT    | Text only               | `/properties/kame-home`                                      |
| MK-02 |     | Marketing               | Hero alt text describes a different image                                                                | A11Y       | UI + markup             | `/`                                                          |
| MK-06 |     | Marketing               | Booking explainer burns 4.2 viewports for five short lines                                               | REDESIGN   | Redesign (layout)       | `/`                                                          |
| MK-14 |     | Marketing               | White label over a photo with no scrim ("Century Properties")                                            | A11Y       | UI + markup             | `/search`                                                    |
| MK-15 |     | Marketing               | Result counts are glued into the section headings, and two filter systems compete                        | A11Y       | UI + markup             | `/search`                                                    |
| MK-16 |     | Marketing               | Mobile type-chip row is clipped by the floating filter button                                            | UI-CHANGE  | UI change (same layout) | `/search`                                                    |
| MK-17 |     | Marketing               | Empty-state recovery offers "Search nearby" to someone who typed a place                                 | COPY       | Text only               | `/search`                                                    |
| MK-23 |     | Marketing               | Product tour panels show clipped screenshots and truncated captions                                      | UI-CHANGE  | UI change (same layout) | `/for-hosts, /for-hosts/v2, /for-hosts/v3, /for-hosts/login` |
| MK-24 |     | Marketing               | "1 booking workflow" presented as a headline statistic                                                   | COPY       | Text only               | `/for-hosts`                                                 |
| MK-26 |     | Marketing               | Host pages use a completely different navigation system                                                  | REDESIGN   | Redesign (layout)       | `/for-hosts, /for-hosts/pricing, /for-hosts/v2, /for-hos…`   |
| MK-28 |     | Marketing               | Every paid plan carries a permanent "20% off"                                                            | CONTENT    | Text only               | `/for-hosts/pricing`                                         |
| MK-29 |     | Marketing               | Four plans claim three different kinds of recommendation                                                 | COPY       | Text only               | `/for-hosts/pricing`                                         |
| MK-31 |     | Marketing               | Plan card accents introduce purple and amber into a teal system                                          | UI-CHANGE  | UI change (same layout) | `/for-hosts/pricing`                                         |
| MK-33 |     | Marketing               | 36-question FAQ has no search, no anchors, and expands to 5,903px                                        | FLOW       | Behaviour               | `/support`                                                   |
| MK-34 |     | Marketing               | Public support page is mostly host-dashboard internals                                                   | CONTENT    | Text only               | `/support`                                                   |
| MK-36 |     | Marketing               | "Sign in with your explore account"                                                                      | COPY       | Text only               | `/contact`                                                   |
| MK-37 |     | Marketing               | Ticket modal clips content mid-word and disables Submit without saying why                               | UI-CHANGE  | UI change (same layout) | `/contact`                                                   |
| MK-40 |     | Marketing               | Services chips look tappable but are decorative and hidden from assistive tech                           | A11Y       | UI + markup             | `/services`                                                  |
| MK-41 |     | Marketing               | Legal pages have no table of contents or anchors                                                         | FLOW       | Behaviour               | `/terms, /privacy, /cookies`                                 |
| MK-43 |     | Marketing               | Unknown routes return HTTP 200 (soft 404)                                                                | FUNCTIONAL | Behaviour               | `/this-route-does-not-exist (and any unknown path)`          |
| MK-46 |     | Marketing               | The login page's product tour auto-advances next to the email field                                      | UI-CHANGE  | UI change (same layout) | `/for-hosts/login`                                           |
| MK-47 |     | Marketing               | Login email validation is not programmatically announced                                                 | A11Y       | UI + markup             | `/for-hosts/login`                                           |
| P4-01 | ✓   | Public surface          | The guest form pre-fills a different fake person on every load                                           | FUNCTIONAL | Behaviour               | `/properties/kame-home/form`                                 |
| P4-06 | ✓   | Public surface          | Accept-invite dead-ends on one sentence with zero actions                                                | UI-CHANGE  | UI change (same layout) | `/accept-invite`                                             |
| P4-08 | ✓   | Public surface          | One result renders in a four-column grid                                                                 | REDESIGN   | Redesign (layout)       | `/search, /developments/azure-north-residences/properties`   |
| P4-09 | ✓   | Public surface          | The parking card image 404s and its alt text draws over the card                                         | FUNCTIONAL | Behaviour               | `/parkings, /search, /account/trips`                         |
| P4-10 | ✓   | Public surface          | Search prices a development at ₱0 and pluralises one home                                                | CONTENT    | Text only               | `/search`                                                    |
| P4-11 | ✓   | Public surface          | Guest and host login are two different products                                                          | REDESIGN   | Redesign (layout)       | `/for-hosts/login, /for-guests/login`                        |
| P4-13 | ✓   | Public surface          | The host marketing nav has a dead item and the mock contributes headings                                 | A11Y       | UI + markup             | `/for-hosts, /for-hosts/pricing`                             |
| P4-14 | ✓   | Public surface          | Services sits in the primary nav as a placeholder with a date field                                      | UI-CHANGE  | UI change (same layout) | `/services`                                                  |
| P4-16 | ✓   | Public surface          | Support has 36 answers and no search                                                                     | UI-CHANGE  | UI change (same layout) | `/support`                                                   |
| P4-20 | ✓   | Public surface          | The property detail host name truncates and the sticky bar duplicates the rating                         | COPY       | Text only               | `/properties/kame-home`                                      |
| P4-22 | ✓   | Public surface          | The account area has no page headings and two navigations                                                | REDESIGN   | Redesign (layout)       | `/account/*`                                                 |
| P4-23 | ✓   | Public surface          | The account profile shows the same data twice                                                            | UI-CHANGE  | UI change (same layout) | `/account/profile`                                           |
| P4-24 | ✓   | Public surface          | Account help is empty while support has 36 answers                                                       | CONTENT    | Text only               | `/account/help`                                              |
| P4-25 | ✓   | Public surface          | Admin and property help surfaces are icon-dense at 390                                                   | UI-CHANGE  | UI change (same layout) | `/admin/support/faqs, /admin/playbook, /admin/developmen…`   |
| P4-26 | ✓   | Public surface          | The public page editor is strong but clipped and icon-dense                                              | UI-CHANGE  | UI change (same layout) | `/org/:org/property/:slug/public-pages/:pageId/edit`         |
| P4-27 | ✓   | Public surface          | Paused team members and role badges fail contrast                                                        | A11Y       | UI + markup             | `/org/:org/team, /org/:org/property/:slug/team`              |
| P4-28 | ✓   | Public surface          | Parking notifications are a wall of raw ids                                                              | CONTENT    | Text only               | `/org/:org/parking/:slug/notifications`                      |
| P4-29 | ✓   | Public surface          | The admin shell clips nav at 900px height                                                                | UI-CHANGE  | UI change (same layout) | `/org/:org/property/:slug/*, /admin/*, editor`               |
| P4-30 | ✓   | Public surface          | The setup guide is still taking over deep links on fresh listings                                        | FLOW       | Behaviour               | `/org/:org/property/:newSlug/*`                              |

### P3 — polish (32)

| ID    | ✓   | Area                    | Issue                                                                                  | Type       | UI impact               | Route                                                        |
| ----- | --- | ----------------------- | -------------------------------------------------------------------------------------- | ---------- | ----------------------- | ------------------------------------------------------------ |
| AC-05 |     | Auth, account and admin | `/register` has no content of its own                                                  | FLOW       | Behaviour               | `/for-hosts/register, /for-guests/register`                  |
| AC-06 |     | Auth, account and admin | Desktop login column is top-light and bottom-heavy                                     | UI-CHANGE  | UI change (same layout) | `/for-hosts/login, /for-guests/login, /accept-invite sib…`   |
| AC-10 |     | Auth, account and admin | Bio counter is a bare number                                                           | COPY       | Text only               | `/account/profile`                                           |
| AC-15 |     | Auth, account and admin | Desktop trips is a 1040px card holding 300px of content                                | UI-CHANGE  | UI change (same layout) | `/account/trips`                                             |
| AC-19 |     | Auth, account and admin | "My Tickets" repeats the nav label, and the list is a header on an empty card          | UI-CHANGE  | UI change (same layout) | `/account/tickets`                                           |
| AC-21 |     | Auth, account and admin | Submit is disabled with no statement of what is missing                                | COPY       | Text only               | `/account/tickets/new`                                       |
| AC-28 |     | Auth, account and admin | "SYNCED" badge is unexplained                                                          | COPY       | Text only               | `/admin/support/faqs`                                        |
| AC-33 |     | Auth, account and admin | Payment rail switches look instant but commit with a Save that belongs to other fields | UI-CHANGE  | UI change (same layout) | `/admin/pricing/payment-settings`                            |
| AC-38 |     | Auth, account and admin | Activity log repeats the same event five times with the same actor and time            | CONTENT    | Text only               | `/activity dialog`                                           |
| GL-09 | ✓   | Global                  | Brand icons and one mock dashboard drive the host-page outline (duplicate with GL-02)  | A11Y       | UI + markup             | `/for-hosts, /for-hosts/v2, /for-hosts/v3, /for-hosts/login` |
| GL-10 | ✓   | Global                  | No dead internal links across the public site (positive control)                       | FUNCTIONAL | Behaviour               | `public`                                                     |
| LG-38 |     | Listings and guest      | Unknown location slugs silently fall back to all listings                              | FLOW       | Behaviour               | `/properties/in/pampanga, /parkings/in/pampanga, /develo…`   |
| LG-39 |     | Listings and guest      | Listing titles are inconsistent between surfaces                                       | CONTENT    | Text only               | `/properties, /properties/kame-home, /hosts/kame-homes, …`   |
| LG-40 |     | Listings and guest      | The document page is a bare, unbranded dead end                                        | CONTENT    | Text only               | `/properties/kame-home/document?token=…`                     |
| LG-41 |     | Listings and guest      | Money and units are formatted inconsistently                                           | COPY       | Text only               | `/properties, /parkings, /properties/kame-home/form, /pr…`   |
| LG-42 |     | Listings and guest      | Filter groups say "None" where they mean "Any"                                         | COPY       | Text only               | `/properties`                                                |
| LG-43 |     | Listings and guest      | Trip and booking dates drop the separator convention                                   | COPY       | Text only               | `/account/trips, /properties/kame-home/trip`                 |
| LG-44 |     | Listings and guest      | The footer tagline is travel marketing copy on transactional pages                     | COPY       | Text only               | `/parkings, /parkings/requests/…, /properties/kame-home/…`   |
| MK-07 |     | Marketing               | The same search control changes its labels between pages                               | COPY       | Text only               | `/ , /search`                                                |
| MK-08 |     | Marketing               | "Become a host?" is a button, not a link, and asks a question                          | A11Y       | UI + markup             | `/ and every marketing page`                                 |
| MK-09 |     | Marketing               | No skip link on public pages                                                           | A11Y       | UI + markup             | `/, /support, /terms, /privacy (long pages)`                 |
| MK-12 |     | Marketing               | "1 homes available" on the development card                                            | COPY       | Text only               | `/search`                                                    |
| MK-18 |     | Marketing               | Two nested `<main>` landmarks on /search                                               | A11Y       | UI + markup             | `/search`                                                    |
| MK-25 |     | Marketing               | "Start free" / "Create account" both land on "Log in or sign up"                       | FLOW       | Behaviour               | `/for-hosts, /for-hosts/pricing`                             |
| MK-42 |     | Marketing               | Cookie consent nudges in opposite directions on two surfaces                           | UI-CHANGE  | UI change (same layout) | `/cookies vs the consent banner (all routes)`                |
| MK-44 |     | Marketing               | 404 page offers a check-mark icon and one destination                                  | UI-CHANGE  | UI change (same layout) | `404`                                                        |
| MK-48 |     | Marketing               | Theme switch is unreachable below 1024                                                 | A11Y       | UI + markup             | `marketing pages`                                            |
| P4-12 | ✓   | Public surface          | Register URLs redirect to the login page                                               | UI-CHANGE  | UI change (same layout) | `/for-hosts/register, /for-guests/register`                  |
| P4-17 | ✓   | Public surface          | Legal pages have no section index                                                      | UI-CHANGE  | UI change (same layout) | `/terms, /privacy`                                           |
| P4-18 | ✓   | Public surface          | The home page listing row shows one card in a multi-card row                           | UI-CHANGE  | UI change (same layout) | `/`                                                          |
| P4-19 | ✓   | Public surface          | The trip page wastes half the viewport                                                 | UI-CHANGE  | UI change (same layout) | `/properties/kame-home/trip`                                 |
| P4-21 | ✓   | Public surface          | Route-level page titles do not match the page                                          | CONTENT    | Text only               | `/parkings, /for-guests/login, announcement detail`          |

## UI work queue

If you are planning a design sprint rather than a bug sweep, work from these lists.

### Redesign (layout) (16)

- **LG-09** Two different listing card designs for the same property — `/properties vs /developments/azure-north-residences/properties, /hosts/kame-homes, /developments/azure-north-residences`
- **LG-22** The parking detail page is almost empty, so the vertical has no product page — `/parkings/monaco-level-2-slot-27`
- **MK-01** Hero photograph contradicts the inventory and the brand — `/`
- **MK-03** Featured-stays section shows one card in a full-width band — `/`
- **MK-22** Host landing content column is ~740px wide on a 1440 canvas — `/for-hosts`
- **MK-27** The Free plan is off-screen when the pricing carousel loads — `/for-hosts/pricing`
- **P4-03** The calendar shows no availability state — `/properties/kame-home/calendar`
- **AC-03** Host login loses the product story on mobile, guest login keeps three screens of it — `/for-hosts/login vs /for-guests/login`
- **AC-07** Profile repeats the whole identity block twice before the first field — `/account/profile`
- **AC-16** Messages is one row over 600px of nothing, authored by "seed-owner" — `/account/messages`
- **LG-28** Development detail spends its hero on a 135px strip and explains nothing — `/developments/azure-north-residences`
- **MK-06** Booking explainer burns 4.2 viewports for five short lines — `/`
- **MK-26** Host pages use a completely different navigation system — `/for-hosts, /for-hosts/pricing, /for-hosts/v2, /for-hosts/v3`
- **P4-08** One result renders in a four-column grid — `/search, /developments/azure-north-residences/properties`
- **P4-11** Guest and host login are two different products — `/for-hosts/login, /for-guests/login`
- **P4-22** The account area has no page headings and two navigations — `/account/*`

### UI change (same layout) (47)

- **AC-31** Super-admin sidebar hides 7 of 21 destinations at 1440x900 with no scroll cue — `/admin/*`
- **AC-52** "Open page" is clipped off the right edge at 390 — `showcase editor`
- **LG-08** Result grids do not fill the viewport, so one result floats in an empty page — `/properties, /parkings, /developments, /developments/azure-north-residences (both carousels)`
- **LG-11** At 320 the calendar is clipped and its own CTA covers the last week — `/properties/kame-home/calendar`
- **LG-13** The showcase section nav is six invisible 6px slivers, plus a stray fixed legal strip — `/properties/kame-home/showcase, /properties/kame-home/stay-guide`
- **LG-20** Mobile property detail collapses a five-photo gallery into one 358x200 frame — `/properties/kame-home`
- **MK-05** Header nav overlaps the theme toggle at 1024 — `/ (and /search, /services, /about, /contact, /support, legal — same header)`
- **MK-30** Compare-features table is unreadable on a phone — `/for-hosts/pricing`
- **AC-18** Favorites truncates the only listing at 390 — `/account/favorites`
- **AC-20** New ticket sheet opens with the Details field sliced by Submit — `/account/tickets/new`
- **AC-25** Playbook clamps body copy to two lines on mobile with no way to expand — `/admin/playbook`
- **AC-29** Ops reports show "CRITICAL 0" in red on every row and two different "current weeks" — `/admin/ops-reports`
- **AC-34** Payment rail switches lose their row at 390 — `/admin/pricing/payment-settings`
- **AC-35** Development detail truncates a section name and drops the section nav on mobile — `/admin/developments/azure-north-residences`
- **AC-40** Property sidebar cuts a nav item mid-word at 900px — `/org/:orgSlug/property/:propertySlug/*`
- **AC-41** Announcements use a red "error" dot for informational items — `/org/.../announcements, /org/.../parking/.../announcements`
- **AC-44** Team tabs become three 36×32 unlabelled-looking icons at 390 — `/org/:orgSlug/team`
- **AC-47** Four rose-coloured KPI tiles make notifications look like an outage — `parking notifications`
- **AC-48** "Manage" degrades to a share-looking icon at 390 — `parking notifications`
- **GL-03** The global nav and footer change shape per page — `marketing and listing pages`
- **GL-08** /services is a "Coming Soon" stub in the primary nav, with a date filter on it — `/services`
- **LG-25** Filter defaults flip between sibling listing pages, and parking search drops "Who" — `/properties vs /parkings vs /developments vs /developments/.../properties`
- **LG-26** The parking search bar pins itself over the site navigation on scroll — `/parkings`
- **LG-29** At 320 the bottom tab bar covers the development's primary CTA — `/developments/azure-north-residences`
- **LG-32** Form data entry is inconsistent and the desktop layout wastes the screen — `/properties/kame-home/form`
- **MK-16** Mobile type-chip row is clipped by the floating filter button — `/search`
- **MK-23** Product tour panels show clipped screenshots and truncated captions — `/for-hosts, /for-hosts/v2, /for-hosts/v3, /for-hosts/login`
- **MK-31** Plan card accents introduce purple and amber into a teal system — `/for-hosts/pricing`
- **MK-37** Ticket modal clips content mid-word and disables Submit without saying why — `/contact`
- **MK-46** The login page's product tour auto-advances next to the email field — `/for-hosts/login`
- **P4-06** Accept-invite dead-ends on one sentence with zero actions — `/accept-invite`
- **P4-14** Services sits in the primary nav as a placeholder with a date field — `/services`
- **P4-16** Support has 36 answers and no search — `/support`
- **P4-23** The account profile shows the same data twice — `/account/profile`
- **P4-25** Admin and property help surfaces are icon-dense at 390 — `/admin/support/faqs, /admin/playbook, /admin/developments/:slug, /org/:org/team`
- **P4-26** The public page editor is strong but clipped and icon-dense — `/org/:org/property/:slug/public-pages/:pageId/edit`
- **P4-29** The admin shell clips nav at 900px height — `/org/:org/property/:slug/*, /admin/*, editor`
- **AC-06** Desktop login column is top-light and bottom-heavy — `/for-hosts/login, /for-guests/login, /accept-invite siblings`
- **AC-15** Desktop trips is a 1040px card holding 300px of content — `/account/trips`
- **AC-19** "My Tickets" repeats the nav label, and the list is a header on an empty card — `/account/tickets`
- **AC-33** Payment rail switches look instant but commit with a Save that belongs to other fields — `/admin/pricing/payment-settings`
- **MK-42** Cookie consent nudges in opposite directions on two surfaces — `/cookies vs the consent banner (all routes)`
- **MK-44** 404 page offers a check-mark icon and one destination — `404`
- **P4-12** Register URLs redirect to the login page — `/for-hosts/register, /for-guests/register`
- **P4-17** Legal pages have no section index — `/terms, /privacy`
- **P4-18** The home page listing row shows one card in a multi-card row — `/`
- **P4-19** The trip page wastes half the viewport — `/properties/kame-home/trip`

### UI + markup (25)

- **AC-43** Paused team members are rendered at ~40% opacity and fail contrast — `/org/:orgSlug/team`
- **AC-50** Published showcase hero text sits at 1.1:1 over the photo — `/org/:orgSlug/property/:propertySlug/public-pages/showcase/edit (and the published page)`
- **GL-02** Three public pages have no h1, and four host pages have three or four — `/search, /properties, /parkings, /developments, /properties/kame-home/calendar, /account/* (none) — /for-hosts, /for-hosts/v2, /for-hosts/v3 (3 visible), /for-hosts/login (2)`
- **LG-10** Calendar renders 27 contrast failures and does not distinguish available, blocked and past — `/properties/kame-home/calendar`
- **MK-10** /search has no h1 — `/search`
- **MK-19** /for-hosts has three h1 elements, one of them from a screenshot mock — `/for-hosts`
- **MK-21** Host hero H1's second line fails AA large-text contrast — `/for-hosts (also /for-hosts/v2, /for-hosts/v3)`
- **MK-45** Host login page has four h1s, one of them a mock label — `/for-hosts/login`
- **P4-07** Four browse pages have no h1 — `/search, /properties, /parkings, /developments`
- **AC-36** 15 unnamed controls and up to 89 sub-44px targets on the development page — `/admin/developments/azure-north-residences`
- **AC-51** The editor renders three `<h1>`s, two of them "Showcase" — `same editor route`
- **LG-23** Nine routes have no h1 — `/properties, /parkings, /developments, /parking-form, /parking-request, /calendar, /form, /guest-review, /document`
- **LG-30** "Submit review & continue" looks enabled but is disabled, and the fixed nav covers the first rating rows — `/properties/kame-home/guest-review?bookingId=…`
- **MK-02** Hero alt text describes a different image — `/`
- **MK-14** White label over a photo with no scrim ("Century Properties") — `/search`
- **MK-15** Result counts are glued into the section headings, and two filter systems compete — `/search`
- **MK-40** Services chips look tappable but are decorative and hidden from assistive tech — `/services`
- **MK-47** Login email validation is not programmatically announced — `/for-hosts/login`
- **P4-13** The host marketing nav has a dead item and the mock contributes headings — `/for-hosts, /for-hosts/pricing`
- **P4-27** Paused team members and role badges fail contrast — `/org/:org/team, /org/:org/property/:slug/team`
- **GL-09** Brand icons and one mock dashboard drive the host-page outline (duplicate with GL-02) — `/for-hosts, /for-hosts/v2, /for-hosts/v3, /for-hosts/login`
- **MK-08** "Become a host?" is a button, not a link, and asks a question — `/ and every marketing page`
- **MK-09** No skip link on public pages — `/, /support, /terms, /privacy (long pages)`
- **MK-18** Two nested `<main>` landmarks on /search — `/search`
- **MK-48** Theme switch is unreachable below 1024 — `marketing pages`

### Text only (52)

- **AC-08** "On this device" is a build/cache debug panel on a guest page — `/account/profile`
- **AC-11** Guest Help is an empty shell with no search — `/account/help`
- **AC-26** FAQ edit opens a dialog that says "edit this in a markdown file" — `/admin/support/faqs`
- **AC-39** The Help & Support "Guides" tile leads to "No guides yet" — `/org/:orgSlug/property/:propertySlug/help-support/docs`
- **AC-45** Parking notifications print a raw task id in an alert body — `/org/.../parking/monaco-level-2-slot-27/notifications`
- **LG-06** Every parking image is a dead third-party URL, so alt text renders over empty cards — `/parkings, /parkings/monaco-level-2-slot-27, /developments/azure-north-residences/parking, /parkings/monaco-level-2-slot-27/form`
- **LG-07** "Parking in Other" appears as the listing name on four surfaces — `/parkings, /developments/azure-north-residences, /developments/azure-north-residences/parking, /hosts/kame-homes`
- **MK-11** Development card advertises "From ₱0 / night" — `/search`
- **MK-32** Supported FAQ contains a literal `<step>` placeholder — `/support`
- **MK-38** /about reads like release notes, not an about page — `/about`
- **MK-39** /services is a top-level nav destination that is a "Coming Soon" placeholder — `/services (linked from every header and footer)`
- **P4-05** The showcase page duplicates the listing and leaks the demo host — `/properties/kame-home/showcase`
- **AC-02** Wrong OTP surfaces a raw provider error string — `/for-hosts/login, /for-guests/login (code step)`
- **AC-04** The guest login hero advertises a product that does not exist — `/for-guests/login, /for-guests/register`
- **AC-14** Same parking listing named two different ways — `/account/trips, host Dashboard recent bookings`
- **AC-23** Playbook renders the database slug under every article title — `/admin/playbook`
- **AC-30** Ops report detail exposes "Copy agent prompt" and env-var names — `/admin/ops-reports/:reportId`
- **AC-49** Telegram tab reads like a spec document — `parking notifications → Telegram tab`
- **GL-04** A Gmail address is the public contact address — `/about, /contact, /support, footer on every marketing page`
- **GL-05** The public pricing page carries three competing recommendation badges — `/for-hosts/pricing`
- **GL-06** The Free plan advertises "Finance management", which is a paid capability — `/for-hosts/pricing`
- **LG-05** Public host page publishes the seed identity and seed copy — `/hosts/kame-homes`
- **LG-24** Sort has no price option — `/properties`
- **LG-27** The developments list renders a condo listing priced at ₱0 per night — `/developments, /developments/in/pampanga`
- **LG-31** The form's own copy is internal jargon — `/properties/kame-home/form`
- **LG-34** Three different cancellation sentences, one of them ungrammatical — `/properties/kame-home (sidebar and policy block), /properties/kame-home/form step 5`
- **LG-35** One action, four names — `/properties/kame-home (Reserve), /properties/kame-home/showcase (Request stay, Book now), home page (Send a request), parking (Reserve)`
- **LG-36** The stay guide's document status contradicts itself and uses internal identities — `/properties/kame-home/stay-guide?token=…`
- **LG-37** The rating distribution bars render at equal length — `/properties/kame-home`
- **MK-17** Empty-state recovery offers "Search nearby" to someone who typed a place — `/search`
- **MK-24** "1 booking workflow" presented as a headline statistic — `/for-hosts`
- **MK-28** Every paid plan carries a permanent "20% off" — `/for-hosts/pricing`
- **MK-29** Four plans claim three different kinds of recommendation — `/for-hosts/pricing`
- **MK-34** Public support page is mostly host-dashboard internals — `/support`
- **MK-36** "Sign in with your explore account" — `/contact`
- **P4-10** Search prices a development at ₱0 and pluralises one home — `/search`
- **P4-20** The property detail host name truncates and the sticky bar duplicates the rating — `/properties/kame-home`
- **P4-24** Account help is empty while support has 36 answers — `/account/help`
- **P4-28** Parking notifications are a wall of raw ids — `/org/:org/parking/:slug/notifications`
- **AC-10** Bio counter is a bare number — `/account/profile`
- **AC-21** Submit is disabled with no statement of what is missing — `/account/tickets/new`
- **AC-28** "SYNCED" badge is unexplained — `/admin/support/faqs`
- **AC-38** Activity log repeats the same event five times with the same actor and time — `/activity dialog`
- **LG-39** Listing titles are inconsistent between surfaces — `/properties, /properties/kame-home, /hosts/kame-homes, /developments/.../properties`
- **LG-40** The document page is a bare, unbranded dead end — `/properties/kame-home/document?token=…`
- **LG-41** Money and units are formatted inconsistently — `/properties, /parkings, /properties/kame-home/form, /properties/kame-home`
- **LG-42** Filter groups say "None" where they mean "Any" — `/properties`
- **LG-43** Trip and booking dates drop the separator convention — `/account/trips, /properties/kame-home/trip`
- **LG-44** The footer tagline is travel marketing copy on transactional pages — `/parkings, /parkings/requests/…, /properties/kame-home/form, /properties/kame-home/stay-guide`
- **MK-07** The same search control changes its labels between pages — `/ , /search`
- **MK-12** "1 homes available" on the development card — `/search`
- **P4-21** Route-level page titles do not match the page — `/parkings, /for-guests/login, announcement detail`

## Route index

Every route that appears in an issue, with the issue ids attached. Use this to batch work per page.

| Route                                                                                        | Issues                                                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/`                                                                                          | MK-01, MK-02, MK-03, MK-04, MK-06, MK-07, MK-09, P4-18                                                  |
| `/ (and /search`                                                                             | MK-05                                                                                                   |
| `/ and every marketing page`                                                                 | MK-08                                                                                                   |
| `/about`                                                                                     | GL-04, MK-05, MK-38                                                                                     |
| `/accept-invite`                                                                             | AC-01, P4-06                                                                                            |
| `/accept-invite siblings`                                                                    | AC-06                                                                                                   |
| `/account/*`                                                                                 | GL-01, P4-22                                                                                            |
| `/account/* (none) — /for-hosts`                                                             | GL-02                                                                                                   |
| `/account/favorites`                                                                         | AC-18                                                                                                   |
| `/account/help`                                                                              | AC-11, P4-24                                                                                            |
| `/account/messages`                                                                          | AC-16                                                                                                   |
| `/account/profile`                                                                           | AC-07, AC-08, AC-09, AC-10, P4-23                                                                       |
| `/account/tickets`                                                                           | AC-19                                                                                                   |
| `/account/tickets/new`                                                                       | AC-20, AC-21                                                                                            |
| `/account/trips`                                                                             | AC-12, AC-13, AC-14, AC-15, LG-43, P4-09                                                                |
| `/account/vouchers`                                                                          | AC-17                                                                                                   |
| `/activity dialog`                                                                           | AC-38                                                                                                   |
| `/admin/*`                                                                                   | AC-31, P4-29                                                                                            |
| `/admin/ai?tab=usage (from /admin/ai-usage)`                                                 | AC-32                                                                                                   |
| `/admin/developments/:slug`                                                                  | P4-25                                                                                                   |
| `/admin/developments/azure-north-residences`                                                 | AC-35, AC-36                                                                                            |
| `/admin/ops-reports`                                                                         | AC-29                                                                                                   |
| `/admin/ops-reports/:reportId`                                                               | AC-30                                                                                                   |
| `/admin/playbook`                                                                            | AC-23, AC-24, AC-25, P4-25                                                                              |
| `/admin/pricing/payment-settings`                                                            | AC-33, AC-34                                                                                            |
| `/admin/support/faqs`                                                                        | AC-24, AC-26, AC-27, AC-28, P4-25                                                                       |
| `/calendar`                                                                                  | LG-23                                                                                                   |
| `/contact`                                                                                   | GL-01, GL-04, MK-05, MK-35, MK-36, MK-37, P4-15                                                         |
| `/cookies`                                                                                   | MK-41                                                                                                   |
| `/cookies vs the consent banner (all routes)`                                                | MK-42                                                                                                   |
| `/developments`                                                                              | GL-02, LG-08, LG-23, LG-27, P4-07                                                                       |
| `/developments/.../properties`                                                               | LG-39                                                                                                   |
| `/developments/azure-north-residences`                                                       | LG-07, LG-09, LG-28, LG-29                                                                              |
| `/developments/azure-north-residences (both carousels)`                                      | LG-08                                                                                                   |
| `/developments/azure-north-residences/parking`                                               | LG-06, LG-07                                                                                            |
| `/developments/azure-north-residences/properties`                                            | P4-08                                                                                                   |
| `/developments/in/pampanga`                                                                  | LG-27, LG-38                                                                                            |
| `/document`                                                                                  | LG-23                                                                                                   |
| `/for-guests/login`                                                                          | AC-04, AC-06, P4-11, P4-21                                                                              |
| `/for-guests/login (code step)`                                                              | AC-02                                                                                                   |
| `/for-guests/register`                                                                       | AC-04, AC-05, P4-12                                                                                     |
| `/for-hosts`                                                                                 | GL-07, GL-09, MK-19, MK-20, MK-22, MK-23, MK-24, MK-25, MK-26, P4-13                                    |
| `/for-hosts (also /for-hosts/v2`                                                             | MK-21                                                                                                   |
| `/for-hosts/login`                                                                           | AC-02, AC-06, GL-09, MK-23, MK-45, MK-46, MK-47, P4-11                                                  |
| `/for-hosts/login (2)`                                                                       | GL-02                                                                                                   |
| `/for-hosts/login vs /for-guests/login`                                                      | AC-03                                                                                                   |
| `/for-hosts/pricing`                                                                         | GL-05, GL-06, GL-07, MK-20, MK-25, MK-26, MK-27, MK-28, MK-29, MK-30, MK-31, P4-13                      |
| `/for-hosts/register`                                                                        | AC-05, P4-12                                                                                            |
| `/for-hosts/v2`                                                                              | GL-02, GL-07, GL-09, MK-23, MK-26                                                                       |
| `/for-hosts/v3`                                                                              | GL-07, GL-09, MK-23, MK-26                                                                              |
| `/for-hosts/v3 (3 visible)`                                                                  | GL-02                                                                                                   |
| `/for-hosts/v3)`                                                                             | MK-21                                                                                                   |
| `/form`                                                                                      | LG-23                                                                                                   |
| `/guest-review`                                                                              | LG-23                                                                                                   |
| `/hosts/kame-homes`                                                                          | LG-05, LG-07, LG-09, LG-39                                                                              |
| `/onboarding`                                                                                | AC-22                                                                                                   |
| `/org/.../announcements`                                                                     | AC-41                                                                                                   |
| `/org/.../parking/.../announcements`                                                         | AC-41                                                                                                   |
| `/org/.../parking/monaco-level-2-slot-27/notifications`                                      | AC-45                                                                                                   |
| `/org/:org/parking/:slug/notifications`                                                      | P4-28                                                                                                   |
| `/org/:org/property/:newSlug/*`                                                              | P4-30                                                                                                   |
| `/org/:org/property/:slug/*`                                                                 | P4-29                                                                                                   |
| `/org/:org/property/:slug/public-pages/:pageId/edit`                                         | P4-26                                                                                                   |
| `/org/:org/property/:slug/team`                                                              | P4-27                                                                                                   |
| `/org/:org/team`                                                                             | P4-25, P4-27                                                                                            |
| `/org/:orgSlug/property/:propertySlug/*`                                                     | AC-40                                                                                                   |
| `/org/:orgSlug/property/:propertySlug/activity`                                              | AC-37                                                                                                   |
| `/org/:orgSlug/property/:propertySlug/help-support/docs`                                     | AC-39                                                                                                   |
| `/org/:orgSlug/property/:propertySlug/public-pages/showcase/edit (and the published page)`   | AC-50                                                                                                   |
| `/org/:orgSlug/team`                                                                         | AC-42, AC-43, AC-44                                                                                     |
| `/parking-form`                                                                              | LG-23                                                                                                   |
| `/parking-request`                                                                           | LG-23                                                                                                   |
| `/parkings`                                                                                  | GL-02, LG-06, LG-07, LG-08, LG-23, LG-26, LG-41, LG-44, P4-07, P4-09, P4-21                             |
| `/parkings/in/pampanga`                                                                      | LG-38                                                                                                   |
| `/parkings/monaco-level-2-slot-27`                                                           | LG-06, LG-22                                                                                            |
| `/parkings/monaco-level-2-slot-27/form`                                                      | GL-01, LG-06                                                                                            |
| `/parkings/requests/5eed1100-0000-4000-8000-000000000001`                                    | LG-19                                                                                                   |
| `/parkings/requests/…`                                                                       | LG-44                                                                                                   |
| `/privacy`                                                                                   | MK-41, P4-17                                                                                            |
| `/privacy (long pages)`                                                                      | MK-09                                                                                                   |
| `/properties`                                                                                | GL-02, LG-08, LG-23, LG-24, LG-39, LG-41, LG-42, P4-07                                                  |
| `/properties vs /developments/azure-north-residences/properties`                             | LG-09                                                                                                   |
| `/properties vs /parkings vs /developments vs /developments/.../properties`                  | LG-25                                                                                                   |
| `/properties/in/pampanga`                                                                    | LG-38                                                                                                   |
| `/properties/kame-home`                                                                      | LG-17, LG-20, LG-21, LG-37, LG-39, LG-41, P4-20                                                         |
| `/properties/kame-home (Reserve)`                                                            | LG-35                                                                                                   |
| `/properties/kame-home (sidebar and policy block)`                                           | LG-34                                                                                                   |
| `/properties/kame-home/calendar`                                                             | GL-02, LG-10, LG-11, P4-03                                                                              |
| `/properties/kame-home/document?token=…`                                                     | LG-40                                                                                                   |
| `/properties/kame-home/form`                                                                 | GL-01, LG-31, LG-32, LG-41, LG-44, P4-01                                                                |
| `/properties/kame-home/form (step 5`                                                         | LG-03                                                                                                   |
| `/properties/kame-home/form step 4 (Pets)`                                                   | LG-33                                                                                                   |
| `/properties/kame-home/form step 5`                                                          | LG-04, LG-34                                                                                            |
| `/properties/kame-home/guest-review?bookingId=…`                                             | LG-30                                                                                                   |
| `/properties/kame-home/messages`                                                             | LG-15                                                                                                   |
| `/properties/kame-home/parking/5eed1100-0000-4000-8000-000000000001 -> /parkings?linkStay=…` | LG-16                                                                                                   |
| `/properties/kame-home/parking/:bookingId`                                                   | P4-04                                                                                                   |
| `/properties/kame-home/showcase`                                                             | LG-13, P4-05                                                                                            |
| `/properties/kame-home/showcase (Request stay`                                               | LG-35                                                                                                   |
| `/properties/kame-home/stay-guide`                                                           | LG-13, LG-44                                                                                            |
| `/properties/kame-home/stay-guide?token=…`                                                   | LG-36                                                                                                   |
| `/properties/kame-home/success`                                                              | LG-18                                                                                                   |
| `/properties/kame-home/trip`                                                                 | LG-43, P4-02, P4-19                                                                                     |
| `/properties/kame-home/trip?bookingId=5eed1000-0000-4000-8000-000000000059`                  | LG-14                                                                                                   |
| `/search`                                                                                    | GL-02, MK-07, MK-10, MK-11, MK-12, MK-13, MK-14, MK-15, MK-16, MK-17, MK-18, P4-07, P4-08, P4-09, P4-10 |
| `/services`                                                                                  | GL-08, MK-05, MK-40, P4-14                                                                              |
| `/services (linked from every header and footer)`                                            | MK-39                                                                                                   |
| `/support`                                                                                   | GL-04, MK-05, MK-09, MK-32, MK-33, MK-34, P4-16                                                         |
| `/terms`                                                                                     | MK-09, MK-41, P4-17                                                                                     |
| `/this-route-does-not-exist (and any unknown path)`                                          | MK-43                                                                                                   |
| `/verification-rejected`                                                                     | AC-22                                                                                                   |
| `404`                                                                                        | MK-44                                                                                                   |
| `Book now)`                                                                                  | LG-35                                                                                                   |
| `Payment)`                                                                                   | LG-03                                                                                                   |
| `announcement detail`                                                                        | P4-21                                                                                                   |
| `editor`                                                                                     | P4-29                                                                                                   |
| `footer on every marketing page`                                                             | GL-04                                                                                                   |
| `home page (Send a request)`                                                                 | LG-35                                                                                                   |
| `host Dashboard recent bookings`                                                             | AC-14                                                                                                   |
| `legal — same header)`                                                                       | MK-05                                                                                                   |
| `marketing and listing pages`                                                                | GL-03                                                                                                   |
| `marketing pages`                                                                            | MK-48                                                                                                   |
| `parking (Reserve)`                                                                          | LG-35                                                                                                   |
| `parking notifications`                                                                      | AC-47, AC-48                                                                                            |
| `parking notifications (Activity)`                                                           | AC-46                                                                                                   |
| `parking notifications → Telegram tab`                                                       | AC-49                                                                                                   |
| `public`                                                                                     | GL-10                                                                                                   |
| `same editor route`                                                                          | AC-51                                                                                                   |
| `showcase editor`                                                                            | AC-52                                                                                                   |
