---
title: 'Legal & company pages — operator guide'
status: active
tags: [guides, routes]
updated: 2026-11-09
---

# Legal & company pages — operator guide

Routes: `/terms` · `/privacy` · `/cookies` · `/about` · `/contact` · `/support`

> **Status:** Documented — static public pages with product-grounded copy (not PMA placeholders).

## Progress overview

| Section          | E2E save | Validation | Docs       | Notes                                                                                                          |
| ---------------- | -------- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| Terms of Service | —        | —          | Documented | 2026-11-09 rewrite: billing, parking payments, vouchers, AI, host content and data, termination                |
| Privacy Policy   | —        | —          | Documented | 2026-11-09 rewrite: controller split, lawful basis, payments, identity, AI, RA 10173 rights                    |
| Cookie Policy    | —        | —          | Documented | By purpose: required, preferences, saved drafts, analytics/errors, third parties; consent banner gates PostHog |
| In-app notices   | —        | Unit       | Documented | `LegalNotice` presets at 16 action points + cookie consent banner; links open `LegalDocumentSheet`             |
| About            | —        | —          | Documented | Product capabilities; no fabricated history                                                                    |
| Contact          | Yes      | Yes        | Documented | Explore guest auth + ticket modal; guest Tickets under `/account/tickets`                                      |
| Support          | —        | —          | Documented | Guest + host FAQ                                                                                               |
| Mobile shell     | —        | —          | Documented | `MarketingLayoutShell` bottom tabs — see [index-landing.md](./index-landing.md) § Mobile shell                 |

### Vendors named on the legal pages

| Vendor               | What it does                         | What it never receives                                      |
| -------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Supabase             | Auth, database, storage, edge        | n/a                                                         |
| PostHog              | Product analytics and funnels        | Error reports, guest email, message bodies, tokens          |
| Sentry               | Error monitoring                     | Names, emails, phone numbers, message content, IP addresses |
| Resend               | Transactional email                  | n/a                                                         |
| PayMongo             | Parking and plan payments            | Full card numbers (collected on PayMongo's own pages)       |
| Cloudflare Turnstile | Bot checks on forms and sign-in      | n/a                                                         |
| Google Gemini / Groq | AI checks, replies, assistant, voice | Raw voice audio is not stored by us                         |

PostHog no longer records errors; Sentry does not record product analytics. Both scrub the
same deny list (`ui/src/lib/telemetry/scrub.ts`). Ship copy changes here **before** turning
on production keys.

---

## Overview

Policy text lives in **`ui/src/lib/legal/`** (`termsContent.ts`, `privacyContent.ts`, `cookiesContent.ts`) as section data with stable ids. The three pages and the in-flow sheet render the same data. **`LEGAL_LAST_UPDATED`** in `legalMeta.ts` is the one date for all three; bump it on any policy change. Section ids are anchors (`/terms#billing`); renaming one breaks in-app links, and `legalContent.test.ts` fails if any `LegalLink` points at a missing id.

Footer links from **`MarketingFooter`** (desktop, `lg+`); on phone the footer is hidden and the same links, contact details, socials and copyright live in the bottom-nav **More** sheet (`MarketingMoreSheet`), both fed by `marketingSiteLinks.ts`. Phone and social icons come from `VITE_PLATFORM_CONTACT_PHONE` / `VITE_PLATFORM_SOCIAL_*` and are hidden when unset. Legal pages use **`LegalSimplePage`** (shared **`MarketingPublicPageHero`** with About / Contact / Support). Operating brand: **Kame Space**; guest fallback **kameworks.tech@gmail.com**.

Privacy and Terms disclose the rename once: **"Kame Space was previously called Kame Homes"**, plus a last-updated line. The sentence comes from `platformFormerNameNote()` in `ui/src/lib/platformBranding.ts`, so the current name stays env-driven.

Site-wide `Organization` structured data is injected at bootstrap by `ui/src/lib/seo/organizationJsonLd.ts` (not inline in `index.html`, which the CSP guard forbids). It carries `name: Kame Space`, `alternateName: Kame Homes` and the request origin, and the brand smoke test asserts it.

Footer **Pricing** points to **`/for-hosts/pricing`**. Careers, Blog, and Host Resources were removed from the footer (no backing content).

---

## Host-facing knowledge

These public pages explain the company, how to reach support, common guest/host questions, and the legal rules for using Kame Space. Guests and hosts see the same pages; there is nothing to configure in the dashboard.

**Common host questions**

- Q: Can I edit the terms or privacy text from my dashboard?
  A: Not today. The copy lives in the app, so changes need a product update. Have a lawyer review before a major marketing launch.
- Q: Do guests have to accept these before booking?
  A: Yes. A short line above Submit says that sending the booking means they agree to your house rules, our Terms, and the Privacy Policy. Your cancellation policy still has its own checkbox.
- Q: Where do people see the terms inside the app?
  A: At sign-in, on the last booking step, on parking requests and payment, on the plan checkout, when guests enter refund details, start a chat, verify their ID, or leave a review. Tapping a link opens the policy over the page, so nothing they typed is lost.
- Q: How are plan payments and refunds handled?
  A: Plans are billed monthly per property through PayMongo. Renewal is a payment link, not an automatic charge. Upgrades credit unused time; downgrades apply right away. Unused time is never refunded in cash.
- Q: Are parking payments refundable?
  A: No, once paid, unless the space cannot be provided. The guest sees this next to Pay now.
- Q: Who is responsible for my guests' data?
  A: You decide what you collect for your stays, so you are responsible for having a good reason to collect it. We store and process it for you and help you answer a guest who asks for their data or wants it deleted.
- Q: Are my verification documents covered by the privacy policy?
  A: Yes. The policy describes host verification uploads and how they're stored privately.
- Q: Where do guests go for help?
  A: Support (`/support`) for FAQs, or Contact (`/contact`). Signed-in explore guests open a ticket (same form as Help & Support); stay questions can also email kameworks.tech@gmail.com.
- Q: Does the public Support page show the same answers as Help & Support in the dashboard?
  A: The public page shows published answers for guests and hosts. Signed-in hosts get the full Help & Support area, with guides, search, and tickets for their listings.
- Q: Can someone contact us without creating an account?
  A: Yes. They can email us or use the Contact page. Filing a ticket needs a sign-in so we can reply in the same thread.
- Q: What is the cookie banner that appears on a first visit?
  A: A short choice between Accept and Necessary only. Analytics cookies never load until someone chooses Accept, and the Cookie Policy page lets them choose again later. It is hidden inside an installed app, where the Cookie Policy page is the place to change the choice.
- Q: Do connecting Meta, importing a spreadsheet, or publishing an AI caption show any legal text?
  A: Yes. Each shows a one-line reminder next to the action (what connecting shares, to only import data you're allowed to use, and to review AI drafts before publishing), with a link to the relevant Terms section.

---

## Behavior

- All routes render inside **`MarketingLayoutShell`** (nav + footer).
- Shared hero band: **`MarketingPublicPageHero`** (centered eyebrow / title / description by default) + body via **`MarketingPublicPageContent`**. Company pages reuse **`MarketingPublicSectionHeading`**, **`MarketingPublicIconCard`**, **`MarketingPublicCallout`**, and **`MarketingPublicFaqList`** for consistent spacing and typography. Legal / Support / Pricing use **`narrow`** on both hero and content so title and body share one **centered** reading column (`mx-auto max-w-3xl`). Legal pages use **`LegalSimplePage`** (divided sections, left hero blob).
- Content is hard-coded in page components; no CMS.
- **Support** (`/support`) — reads published FAQs from **`list-public-support-faqs`** and splits them into **Guests** (`guest` + `public`) and **Hosts** (`host` + `public`), eight per section with a **Show all** toggle. While the request is loading it shows layout-matched skeleton rows; on error or an empty response it falls back to the trimmed static arrays so the page never renders empty. Content source: `docs/guides/support/faqs.md`.
- **Contact** (`/contact`) — four ticket categories (**Broken**, **Idea**, **Question**, **Business**) matching Help & Support. Clicking a category runs **`requireGuestAuth`** → **`GuestAuthModal`** (same as Reserve / Contact host on listings), then opens the same **`NewTicketModal`**. OAuth return uses `?category=` (+ optional `?subject=`). Deep links: Managed plan from **`/for-hosts/pricing`**. After submit → **`/account/tickets/:ticketId`**. Org-scoped host tickets remain under dashboard Help & Support. Guests also see Support + mailto fallback below the categories.
- Privacy states that Gemini processes live microphone audio, the platform does not store raw
  audio, unverified captions default to 30-day retention (configurable from 1 to 90 days), and the
  guest can delete captions after the call. Caption deletion also clears derived safety flags;
  timing, outcome, model, and estimated usage remain with account/property operational records.
- Cookie policy groups storage by purpose: required (session, booking access key, Turnstile, service worker), preferences, saved booking drafts (device only, 7 days), PostHog when enabled, Sentry, and third parties. No ad pixels.

---

## Cookie consent (owner decision D1)

A compact banner (`CookieConsentBanner`, mounted once in `App.tsx`) shows on first visit, before any choice is stored: **Accept** or **Necessary only**, with a `LegalLink` to the Cookie Policy. It is bottom-centered and sits above the mobile tab bar (`aboveBottomTabBarOverlayClassName`), never over the desktop sidebar or the assistant launcher. **It is hidden when `useDisplayMode().standalone` is true** (an installed app shares same-origin storage with the browser, and a first launch without a choice simply leaves analytics off). The PWA install offer waits while the choice is `null`, so the two bottom chips never stack on a first visit.

The choice is `localStorage` key `kh-cookie-consent` (`accepted` / `declined`). PostHog is never started (`posthog.init()` is never called) until the stored choice is `accepted` — see `lib/posthog/client.ts#startPostHogIfConsented`, which also listens for the `kh:cookie-consent-changed` event so accepting later in the same session starts it immediately. Required cookies (Supabase session, booking access token, Turnstile, service worker cache) are never gated by this choice. The Cookie Policy page (`/cookies`) carries `CookiePreferencesControl`, which offers **Allow analytics** and **Necessary only** directly (not only a reset), so a standalone user can still choose from there. `isPostHogActive()` (not `isPostHogEnabled`, which only means "configured") gates every `capture`/`identify`/`group` call site.

---

## In-app notices

One pattern everywhere: a short muted line at the moment of action, with policy links. A plain tap opens the policy in **`LegalDocumentSheet`** (bottom sheet below `lg`, dialog at `lg+`) scrolled to the linked section. It uses the same split chrome as the standard shells: a fixed header with title and "Last updated", a scrolling body, and a fixed footer with an outline **Open full page** button plus a primary **Done**, right-aligned on desktop and stacked full-width on phone with safe-area padding. The link is a real `<a href="/terms#section">`, so cmd/ctrl/middle-click and long-press open the page in a new tab. Checkboxes stay only where a record matters: the cancellation policy, identity check consent, and the Free downgrade acknowledgment.

| Surface                                            | Preset                        | Links to                | Hidden when                 |
| -------------------------------------------------- | ----------------------------- | ----------------------- | --------------------------- |
| Host and guest sign-in pages (bottom, last item)   | `SignInLegalNotice`           | Terms, Privacy          | OTP step                    |
| Guest auth modal (under Google)                    | `SignInLegalNotice`           | Terms, Privacy          | OTP step                    |
| Booking form, last step (above Submit)             | `BookingSubmitLegalNotice`    | Terms#bookings, Privacy | Host-entered booking, edits |
| Booking form, payment step (under receipt)         | `StayPaymentLegalNotice`      | Terms#payments          | Host-entered booking        |
| Parking request, last step and linked-stay confirm | `ParkingRequestLegalNotice`   | Terms#parking, Privacy  | Host-entered request        |
| Parking status, Pay now                            | `ParkingPaymentLegalNotice`   | Terms#parking           | Not in payment state        |
| Plans & Billing review dialog                      | `PlanBillingLegalNotice`      | Terms#billing           | Never                       |
| SD form refund step, trip cancellation refund      | `RefundDetailsLegalNotice`    | Privacy#payments        | Cash pickup chosen          |
| Guest chat composer                                | `GuestChatLegalNotice`        | Privacy#ai              | After the first message     |
| Guest review, host review of a guest               | `ReviewLegalNotice`           | Terms#reviews           | Never                       |
| Host Get verified (submit step)                    | `HostVerificationLegalNotice` | Privacy#identity        | Nothing to submit           |
| Identity check consent step                        | inline `LegalLink`            | Privacy#identity        | Never                       |
| Voice receptionist (before the call)               | inline `LegalLink`            | Privacy#voice           | Never                       |
| Inbox Channels tab, Meta row                       | `MetaConnectLegalNotice`      | Privacy#sharing         | Already connected           |
| Data import wizard, Upload step                    | `DataImportLegalNotice`       | Terms#host-data         | Never                       |
| Marketing Studio Publish dialog                    | `MarketingAiLegalNotice`      | Terms#ai                | No connected channel        |

Passive links (`LegalFooterLinks`): every `MainLayout` page footer (calendar, form, success, trip, SD form, guest review, parking pages, verification), the dashboard account menu and phone More sheet (Terms, Privacy), guest **Account > Profile** (**Privacy and data** card under Identity, with a mailto for data requests), and the booking-document "not available" screen. Marketing footer and More sheet are unchanged. The stay guide and property showcase pages (bespoke templates, no shared footer) get a small floating `ShowcaseLegalFooterLink` pill instead, hidden only in the dashboard's inline editor preview. Every transactional email sent through `fragments/configurable-template-send.html` carries a Privacy Policy link next to the copyright line (`emailLegalFooter.ts#buildEmailLegalFooterHtml`).

Not shown on dashboard page bodies: hosts accept the Terms at sign-in.

---

## Implementation map

| Concern        | Path                                                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| About          | `ui/src/features/guest/marketing/pages/AboutPage.tsx`                                                                                                                                                                                                                             |
| Contact        | `ui/src/features/guest/marketing/pages/ContactPage.tsx` · `marketing/contact/components/*` · reuses `NewTicketModal` + `submit-support-ticket`                                                                                                                                    |
| Support        | `ui/src/features/guest/marketing/pages/SupportPage.tsx`                                                                                                                                                                                                                           |
| Terms          | `ui/src/features/guest/marketing/pages/TermsPage.tsx`                                                                                                                                                                                                                             |
| Privacy        | `ui/src/features/guest/marketing/pages/PrivacyPage.tsx`                                                                                                                                                                                                                           |
| Cookies        | `ui/src/features/guest/marketing/pages/CookiesPage.tsx`                                                                                                                                                                                                                           |
| Content        | `ui/src/lib/legal/` (`legalMeta.ts`, `termsContent.ts`, `privacyContent.ts`, `cookiesContent.ts`, `legalDocuments.ts`, `legalContent.test.ts`)                                                                                                                                    |
| Account        | `features/guest/account/components/GuestPrivacyCard.tsx` on `GuestProfilePage`                                                                                                                                                                                                    |
| Notices        | `ui/src/components/legal/` (`LegalLink`, `LegalNotice`, `LegalNoticePresets`, `LegalFooterLinks`, `LegalDocumentBody`, `LegalDocumentSheet`, `LegalSheetProvider`, `CookieConsentBanner`, `CookiePreferencesControl`, `ShowcaseLegalFooterLink`, all mounted/used from `App.tsx`) |
| Cookie consent | `ui/src/lib/posthog/cookieConsent.ts` (storage + event) · `ui/src/hooks/useCookieConsentChoice.ts` (shared reactive read for banner, preferences, install offer) · gated in `ui/src/lib/posthog/client.ts` (`startPostHogIfConsented`, `isPostHogActive`)                                                                                                                                  |
| Email footer   | `supabase/functions/_shared/emailLegalFooter.ts`, used by `brandedEmailShell.ts` and `propertyTemplateEmail.ts`                                                                                                                                                                   |
| Layout         | `MarketingPublicPageHero` · `MarketingPublicPageContent` · `MarketingPublicSectionHeading` · `MarketingPublicIconCard` · `MarketingPublicCallout` · `MarketingPublicFaqList` · `LegalSimplePage` · `MarketingLayoutShell` · `MarketingFooter`                                     |
| Routes         | `ui/src/features/guest/marketing/routes/index.tsx`                                                                                                                                                                                                                                |
| Hash           | Legacy **`/for-hosts#pricing`** redirects to **`/for-hosts/pricing`** in `MarketingLayoutShell`                                                                                                                                                                                   |

---

## Related docs

- [Route index](./README.md)
- [Architecture routing](../../architecture/routing.md)

---

## Pending / follow-ups

- [ ] Legal counsel review before production marketing launch (rewritten 2026-11-09, see [`legal-and-privacy-coverage.md`](../../workflow/in-progress/legal-and-privacy-coverage.md)) — the only owner decision still open (D3)
- [x] Cookie consent banner before PostHog loads (D1) — `CookieConsentBanner` + `kh-cookie-consent` gate, 2026-11-09
- [x] Data Protection Officer contact (D2) — platform email, already the fallback in `privacyContent.ts`; no NPC registration number exists yet
- [x] P2 notices: Meta connect, data import, marketing AI publish, stay guide / showcase footers, email footer (2026-11-09)
- [ ] Replace placeholder phone / social URLs when real accounts exist
- [ ] Optional CMS or markdown source for policy updates
