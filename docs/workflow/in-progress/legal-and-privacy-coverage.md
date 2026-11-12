---
stage: in-progress
title: 'Legal and privacy coverage: current policies and consistent notices across the app'
status: in-progress
tags: [workflow, in-progress, legal, privacy, terms, cookies, payments, consent, ux]
updated: 2026-11-13
kind: plan
---

# Legal and privacy coverage

Bring the Terms, Privacy and Cookie policies up to date with what the product does today, and
show short, consistent legal notices at every point where a person signs in, submits personal
data, pays, or hands data to an AI or a third party. One component family, one behavior, every
breakpoint.

Builds on [`legal.md`](../../guides/routes/legal.md) (the three static policy pages, footer and
More sheet links) and [`data-privacy-identity.md`](../../architecture/data-privacy-identity.md)
(identity verification PIA).

---

## 1. Audit (2026-11-09)

### 1.1 What the policies miss

| Area                        | In code today                                                                                                    | Policy gap                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Host subscriptions          | PayMongo checkout, monthly per-property billing, renewal links, proration credit, past due grace then suspension | Terms say nothing about plans, billing, renewal, downgrades, no cash refunds, suspension                      |
| Parking payments            | Platform collects the guest rate through PayMongo and pays the host out; paid parking is non-refundable          | Terms only cover booking deposits; no mention of the platform collecting parking payments or payouts          |
| Payment processor           | PayMongo (cards, e-wallets)                                                                                      | Privacy processor list omits PayMongo; no statement that card details never touch our servers                 |
| Identity verification       | ID capture, liveness on device, AI field extraction, 7-day capture retention, hashed document numbers            | Privacy says "verify identity" only; no retention, no hashing, no deletion path                               |
| Bot protection              | Cloudflare Turnstile on booking, SD form, review, voucher, sign-in                                               | Not in Privacy or Cookies                                                                                     |
| Push notifications          | Web Push through browser push services                                                                           | Not mentioned                                                                                                 |
| Offline drafts and PWA      | Booking drafts with PII in IndexedDB for 7 days; service worker cache                                            | Cookies page says only "session and theme"                                                                    |
| Guest booking access tokens | HMAC token in `sessionStorage`                                                                                   | Not mentioned                                                                                                 |
| AI in guest chat            | AI receptionist can answer web chat and Meta messages                                                            | Privacy lists "inbox reply suggestions" only; guests are never told replies can be automated                  |
| Dashboard assistant         | AI reads host data to answer and propose actions (confirm-before-write)                                          | Not listed                                                                                                    |
| Calendar sync               | iCal export/import with Airbnb and other channels                                                                | Not listed                                                                                                    |
| Data import                 | Hosts upload spreadsheets of guest/booking data                                                                  | No host responsibility statement                                                                              |
| Vouchers and rewards        | Next-stay vouchers, SD vouchers, host rewards                                                                    | No terms (expiry, no cash value, host-issued)                                                                 |
| Philippine DPA              | RA 10173 applies                                                                                                 | No lawful basis, no full list of data-subject rights, no NPC complaint route, no cross-border transfer notice |
| Host as controller          | Hosts decide what guest data they collect                                                                        | Privacy never says the host is a separate controller for their own guest records                              |
| AI output                   | Captions, replies, pricing suggestions, receipt checks                                                           | Terms have no "AI output can be wrong, you review it" clause                                                  |
| Host content                | Listings, photos, marketing posts published to Meta                                                              | No content license or responsibility clause                                                                   |
| Termination                 | Suspension exists; org deletion exists                                                                           | Terms cover suspension only, not account closure or what happens to data                                      |

### 1.2 Where notices are missing

Only three surfaces carry any legal text today: the voice receptionist (one Privacy link), the
identity capture consent step (no policy link) and the booking cancellation-policy checkbox.
Sign-in, booking submit, both checkouts, refund payout details, chat, reviews and host
verification show nothing.

Policy links are reachable from `MarketingFooter` (desktop) and `MarketingMoreSheet` (phone).
Every guest operational page (`MainLayout`: calendar, form, success, trip, SD form, guest
review, parking form/status, verification) shows only a copyright line, and the dashboards
show no links at all.

---

## 2. UX pattern (one behavior everywhere)

Benchmark: Airbnb (one line above "Confirm and pay" naming house rules, rebooking and refund
policy), Stripe/PayMongo hosted checkout (processor + Terms + Privacy in the footer),
Google/Notion/Linear sign-in ("By continuing, you agree to the Terms and acknowledge the
Privacy Policy"), Booking.com (policy link under the final button).

**Decision**

1. **Browsewrap line at the moment of action, not a checkbox.** A single muted line, 12 to 13 px,
   directly above or below the primary button, naming what applies. Checkboxes stay only where
   the record matters and already exists: the cancellation policy (stored acceptance hash),
   identity capture (sensitive personal information, DPA §13 explicit consent, enforced
   server-side), and the Free-downgrade acknowledgment.
2. **Links open the policy in a sheet, not a new page.** Navigating away mid-form loses state
   and breaks modals. Tapping a link opens `LegalDocumentSheet`: a bottom sheet below `lg`, a
   dialog at `lg+`, with the full policy, the right section scrolled into view, and an
   "Open full page" link. The link is a real `<a href="/terms#payments">`, so
   cmd/ctrl/middle-click and long-press "Open in new tab" still work, and it degrades to
   navigation without JS.
3. **Passive links where people look for them, never on every page.** Footer on guest
   operational pages, the dashboard account menu and More sheet, and the guest account
   Settings page. Not on host dashboard page bodies.
4. **Same words everywhere.** "Terms", "Privacy Policy", "Cookie Policy". Copy lives in one
   module so wording does not drift.

### 2.1 Components (`ui/src/components/legal/`)

| Component            | Role                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LegalLink`          | `<a>` with `doc` (`terms` · `privacy` · `cookies`) and optional `section` anchor. Plain click opens the sheet; modified click navigates normally.                          |
| `LegalNotice`        | The one-line notice. Muted, wraps, centered or start aligned, 44 px tap rows not needed (inline text link with padding); takes children with links.                        |
| `LegalDocumentSheet` | `ResponsiveModal` with the policy body, section scroll, inline "Open full page" header action, and one Done action. Lazy-loaded so the policy text is not in every bundle. |
| `LegalFooterLinks`   | "Terms · Privacy · Cookies" row for layout footers and account menus.                                                                                                      |
| `LegalSheetProvider` | One sheet instance mounted at the app root; `LegalLink` calls `openLegalDocument(doc, section)`.                                                                           |

Content moves from the three page components into `ui/src/lib/legal/` (`termsContent.ts`,
`privacyContent.ts`, `cookiesContent.ts`, `legalMeta.ts` with the shared last-updated date).
The pages and the sheet render the same data. Every section gets a stable `id` for anchors.

---

## 3. Policy content updates

Last updated date moves to one constant. All copy follows `human-copy` (no em dashes, plain).

### 3.1 Terms of Service, new or rewritten sections

| Section (`id`)                           | Content                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who we are (`about`)                     | Keep. Add: we provide software; hosts run their own stays and are not our agents or employees.                                                                                                                                                                                      |
| Accounts (`accounts`)                    | Keep. Add 18+ for account holders, one person per account, team members act for the org that invited them, org owner is responsible for the team.                                                                                                                                   |
| Bookings (`bookings`)                    | Keep. Add: house rules and cancellation policy shown at booking are part of the agreement with the host; the host may decline.                                                                                                                                                      |
| Stay payments and deposits (`payments`)  | Rewrite: guests pay hosts directly using the host's payment details; we check receipts with AI and the host confirms; security deposit refunds follow the property's workflow; refunds on cancellation follow the policy accepted at booking.                                       |
| Parking payments (`parking`)             | New: the platform collects parking payments through PayMongo on the host's behalf and pays the host out; paid parking is non-refundable once confirmed unless the host cancels; a request expires if not paid in time.                                                              |
| Host plans and billing (`billing`)       | New: plans billed monthly per property in PHP through PayMongo; renewal is a payment link, not an automatic charge; upgrades charge today with credit for unused time; downgrades apply at once with no cash refund; past due grace then suspension; prices can change with notice. |
| Vouchers and rewards (`vouchers`)        | New: vouchers are issued by the host, have no cash value, cannot be transferred or sold, and follow the expiry shown; we may void vouchers obtained by abuse.                                                                                                                       |
| Identity verification (`verification`)   | New: guests and hosts may be asked to verify; we may refuse or suspend when a document looks fraudulent; verification is a check, not a guarantee of a person's conduct.                                                                                                            |
| Reviews (`reviews`)                      | Keep.                                                                                                                                                                                                                                                                               |
| AI features (`ai`)                       | New: AI can be wrong; hosts review suggestions, replies and pricing before relying on them; guests may get automated replies in chat; you are responsible for what you send or publish.                                                                                             |
| Host content (`content`)                 | New: you keep ownership; you grant us a license to host and display it to run the service and publish where you ask (for example Meta); you confirm you have the rights.                                                                                                            |
| Host data responsibilities (`host-data`) | New: hosts are responsible for having a lawful basis for guest data they import or collect, for using it only to run stays, and for honoring guest requests.                                                                                                                        |
| Acceptable use (`acceptable-use`)        | Keep. Add: no off-platform payment fraud, no scraping, no automated account creation.                                                                                                                                                                                               |
| Third parties (`third-parties`)          | Keep. Name PayMongo, Meta, Google.                                                                                                                                                                                                                                                  |
| Ending your account (`termination`)      | New: you can close your account by contacting us; org owners can delete an org; we may suspend for breach or unpaid billing; some records are kept as the Privacy Policy describes.                                                                                                 |
| Liability (`liability`)                  | Keep.                                                                                                                                                                                                                                                                               |
| Law and changes (`changes`)              | Keep. Add: we tell account holders about material changes by email or in the app.                                                                                                                                                                                                   |

### 3.2 Privacy Policy, new or rewritten sections

| Section (`id`)                        | Content                                                                                                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who is responsible (`controller`)     | New: we are the controller for accounts and platform data; each host is a separate controller for its guest records and we process them for the host.                                                                              |
| Information we collect (`collect`)    | Rewrite into groups: booking, documents, identity verification, payments, messages and calls, reviews, host and team, device and usage.                                                                                            |
| Payments (`payments`)                 | New: PayMongo collects card and e-wallet details on its own pages; we receive status, amount, method type and reference, never full card numbers; refund payout details are used only to send the refund.                          |
| Identity verification (`identity`)    | New: summary of the PIA: captures kept 7 days, document numbers stored as a hash, liveness on device, result kept up to a year or document expiry, delete any time.                                                                |
| How we use information (`use`)        | Keep, add dashboard assistant, calendar sync, push notifications, bot protection.                                                                                                                                                  |
| Lawful basis (`basis`)                | New: contract (bookings, billing), consent (identity verification, voice, optional analytics), legitimate interest (security, fraud, product improvement), legal obligation (tax, accounting).                                     |
| AI processing (`ai`)                  | New: what goes to Gemini and Groq, that providers process it to return a result, that chat replies may be automated and labeled, that we do not use your data to train our own models.                                             |
| Voice (`voice`)                       | Keep existing text.                                                                                                                                                                                                                |
| Reviews (`reviews`)                   | Keep.                                                                                                                                                                                                                              |
| Processors and sharing (`sharing`)    | Rewrite as a list: Supabase, PayMongo, Resend, Google (sign-in, Maps, Gemini), Groq, Meta, Cloudflare Turnstile, PostHog, Sentry, Telegram, browser push services, calendar channels the host connects, Jamendo.                   |
| International transfers (`transfers`) | New: processors may store data outside the Philippines; we use providers with contractual safeguards.                                                                                                                              |
| Security (`security`)                 | Keep, plain wording (drop the internal RLS explanation).                                                                                                                                                                           |
| Retention (`retention`)               | Keep, add identity 7 days and offline drafts 7 days on device.                                                                                                                                                                     |
| Analytics and errors (`analytics`)    | Keep.                                                                                                                                                                                                                              |
| Your rights (`rights`)                | Rewrite with RA 10173 rights: be informed, access, object, erasure or blocking, rectification, portability, damages, file a complaint with the National Privacy Commission. How to ask, response time target (15 days for access). |
| Children (`children`)                 | Keep.                                                                                                                                                                                                                              |
| Breach notification (`breach`)        | New: we notify the NPC and affected people as the law requires.                                                                                                                                                                    |
| Changes and contact (`changes`)       | Keep. Add Data Protection Officer contact line (env-driven email, falls back to platform email).                                                                                                                                   |

### 3.3 Cookie Policy

Rewrite as a table-like list by purpose: **Required** (Supabase session, guest booking access
token in session storage, Cloudflare Turnstile, service worker cache), **Preferences** (theme,
dismissed tips, voice disclosure seen), **Offline drafts** (IndexedDB, 7 days, wiped on submit
or sign out), **Analytics** (PostHog when enabled), **Errors** (Sentry, no cookies for ads),
**Third parties** (Google sign-in, Maps, PayMongo checkout, Meta). Controls: browser settings,
sign out clears offline data.

---

## 4. Surface inventory

P0 = shipped in this change. P1 = shipped in this change if time allows. P2 = follow-up.

### 4.1 Notices at the moment of action

| #   | Surface                                                                                    | File                                                                       | Copy (final wording in `legalCopy.ts`)                                                                                                                                                            | P    |
| --- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | Host and guest sign-in pages (`/sign-in`, `/sign-up`, host auth)                           | `features/guest/auth/components/AuthPageContent.tsx`                       | By continuing, you agree to the **Terms** and acknowledge the **Privacy Policy**.                                                                                                                 | P0   |
| 2   | Guest auth modal (Reserve, Contact host, Contact page)                                     | `features/guest/auth/components/GuestAuthModal.tsx`                        | Same as 1.                                                                                                                                                                                        | P0   |
| 3   | Booking form last step (`/form`, property Reserve modal); hidden for host-entered bookings | `features/guest/form/components/GuestForm.tsx`                             | By submitting, you agree to the host's house rules, the **Terms** and the **Privacy Policy**.                                                                                                     | P0   |
| 4   | Booking form payment step (receipt upload)                                                 | `GuestFormPaymentStepContent.tsx`                                          | You pay the host directly. We check your receipt and keep it private. **Payments terms**                                                                                                          | P1   |
| 5   | Parking request form (page + modal); hidden for host-entered requests                      | `features/guest/marketing/parkings/components/ParkingRegistrationForm.tsx` | By submitting, you agree to the **Terms** and the **Privacy Policy**.                                                                                                                             | P0   |
| 6   | Parking **Pay now**                                                                        | `ParkingRequestStatusView.tsx`                                             | Paid securely through PayMongo. Non-refundable once paid unless the host cancels. **Parking terms**                                                                                               | P0   |
| 7   | Plan checkout and downgrade (`PlanReviewDialog`)                                           | `features/dashboard/plans/components/PlanReviewDialog.tsx`                 | Upgrade: Paid through PayMongo. Renews monthly by payment link. No cash refunds for unused time. **Billing terms** · Downgrade: Changes apply now. Unused time is not refunded. **Billing terms** | P0   |
| 8   | SD refund payout details (`/sd-form`)                                                      | `features/guest/sd-form/...`                                               | We use these details only to send your refund. **Privacy Policy**                                                                                                                                 | P0   |
| 9   | Cancellation refund details (`/trip`)                                                      | `features/guest/trip/components/GuestTripCancellationSection.tsx`          | Same as 8.                                                                                                                                                                                        | P0   |
| 10  | Identity capture consent step                                                              | `features/verification/components/IdentityCaptureFlow.tsx`                 | Add **Privacy Policy** link to the existing consent list (checkbox stays).                                                                                                                        | P0   |
| 11  | Voice receptionist                                                                         | `features/guest/chat/components/voice/VoiceSessionPanel.tsx`               | Replace the bare `/privacy` anchor with `LegalLink` to `#voice` (opens sheet, keeps the call screen).                                                                                             | P0   |
| 12  | Guest web chat composer (first message)                                                    | `features/guest/chat/components/ContactHostSheet.tsx` / chat page          | Replies may come from an AI assistant. **Privacy Policy**                                                                                                                                         | P0   |
| 13  | Guest review submit and host guest-review submit                                           | `GuestReviewPage.tsx`, host review form                                    | Reviews must be honest and follow our **review rules**.                                                                                                                                           | P1   |
| 14  | Host Get verified (ID, selfie, ownership proof)                                            | `features/dashboard/org/components/verification/GetVerifiedModal.tsx`      | We use these files only to verify your account and keep them private. **Privacy Policy**                                                                                                          | P1   |
| 15  | Inbox Meta connect                                                                         | `InboxChannelsTab.tsx`                                                     | Connecting lets us read and reply to this Page's messages. **Privacy Policy**                                                                                                                     | done |
| 16  | Data import upload                                                                         | `ImportWizardModal.tsx`                                                    | Only import guest data you are allowed to use. **Host data terms**                                                                                                                                | done |
| 17  | Marketing AI generate / publish                                                            | `PublishDialog.tsx`                                                        | AI drafts can be wrong. Review before you publish. **AI terms**                                                                                                                                   | done |

### 4.2 Passive links

| #   | Surface                                                    | File                                                        | What                                                                                                                                | P    |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 18  | Guest operational footer (all `MainLayout` pages)          | `layouts/MainLayout.tsx`                                    | `LegalFooterLinks` under the copyright line                                                                                         | P0   |
| 19  | Dashboard account menu (desktop rail)                      | `features/dashboard/bookings/components/AdminLayout.tsx`    | Muted "Terms · Privacy" row at the bottom of the menu                                                                               | P0   |
| 20  | Dashboard More sheet (phone)                               | `AdminMoreSheet.tsx`                                        | Same row under Sign out                                                                                                             | P0   |
| 21  | Guest account Settings                                     | `features/guest/account/pages/GuestAccountSettingsPage.tsx` | "Privacy and data" block: policy links + "Request your data or deletion" (mailto with subject)                                      | P0   |
| 22  | Marketing footer and More sheet                            | `marketingSiteLinks.ts`                                     | Already present. No change.                                                                                                         | -    |
| 23  | Stay guide, showcase, booking document pages (own layouts) | `features/guest/stay-guide`, showcase, booking-documents    | `ShowcaseLegalFooterLink` (floating pill) on stay guide/showcase; `LegalFooterLinks` on the booking-document "not available" screen | done |
| 24  | Transactional email footer                                 | `_shared/emailLegalFooter.ts`                               | Privacy link next to the copyright line, every `configurable-template-send.html` email                                              | done |

### 4.3 Deliberately not doing

- **Checkbox clickwrap on every form.** Adds friction and taps on phone; a dated browsewrap line
  at the button plus the stored cancellation acceptance is the industry pattern.
- **Legal text on host dashboard page bodies.** Hosts accepted the Terms at sign-in; repeating it
  is noise. The account menu covers lookup.
- ~~Cookie consent banner~~ — shipped 2026-11-09 as owner decision D1 (see §7): PostHog now
  waits for an explicit Allow analytics before it starts, instead of relying only on disclosure.
- **Self-serve account deletion.** Separate feature; the Privacy Policy keeps the email route.
- **Per-property editable legal text.** House rules already cover property terms.

---

## 5. Phases

| Phase | Scope                                                                                                 | Status                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1     | Move policy content to `lib/legal/*`, section ids, shared date; pages render from data                | done                                                                                      |
| 2     | Rewrite Terms, Privacy, Cookies content (§3)                                                          | done                                                                                      |
| 3     | `components/legal/*`: `LegalLink`, `LegalNotice`, `LegalDocumentSheet` (lazy), provider, footer links | done                                                                                      |
| 4     | P0 action notices (#1 to #3, #5 to #12)                                                               | done                                                                                      |
| 5     | P0 passive links (#18 to #21)                                                                         | done (guest privacy card lives on Account > Profile; `/account/settings` redirects there) |
| 6     | P1 notices (#4, #13, #14)                                                                             | done                                                                                      |
| 7     | Docs: `legal.md`, affected route guides, `PROJECT.md`, FAQs + Host-facing knowledge, support checks   | done                                                                                      |
| 8     | P2 follow-ups (#15 to #17, #23, #24); owner decisions D1 to D3                                        | done except D3 (counsel review, needs a human lawyer and stays open)                      |

## 6. Verification

- Unit (Vitest): every `LegalLink` section id exists in its document; policy data has unique ids;
  no em dash in any legal string.
- `bun run type-check`, `lint`, `check:filenames`, `build` (bundle: the sheet chunk is lazy).
- Manual at 375 / 768 / 1280: sign-in, booking last step, Reserve modal (sheet over sheet),
  parking pay, plan review dialog, footer and account menus; sheet scrolls to the section;
  cmd-click opens the page.

## 7. Owner decisions

| #   | Decision                                                                 | Resolution                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Cookie consent banner before PostHog loads                               | **Decided 2026-11-09: build it.** `CookieConsentBanner` + `kh-cookie-consent` storage; `posthog.init()` never runs before an explicit Allow analytics. See [legal.md § Cookie consent](../../guides/routes/legal.md#cookie-consent-owner-decision-d1). |
| D2  | Named Data Protection Officer and NPC registration number                | **Decided 2026-11-09: platform email, no registration line.** Already the shipped default in `privacyContent.ts` (no named individual exists to publish; NPC registration is a business/legal filing, not something this change can create).           |
| D3  | Lawyer review of the rewritten Terms and Privacy before marketing launch | **Still open** — shipped as product copy per the default, since this requires a human lawyer. Carried on [legal.md](../../guides/routes/legal.md) § Pending / follow-ups.                                                                              |
