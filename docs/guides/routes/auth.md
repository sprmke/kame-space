---
title: 'Guest & host auth — operator guide'
status: active
tags: [guides, routes, auth]
updated: 2026-11-08
---

# Guest & host auth — operator guide

Routes:

- `/for-hosts/login` · `/for-guests/login` — one sign-in page per audience
- `/for-hosts/register` · `/for-guests/register` — legacy aliases, redirect to the matching `/login` (preserve `?redirect=`)
- `/sign-in` — legacy redirect → `/for-hosts/login` (preserves `?redirect=`)
- `/for-guests/*` (any other path) — redirects to `/for-guests/login`

> **Status:** Documented — host and guest sign-in are both fully wired to Supabase: email OTP (two-step: email → code) + Google OAuth (both audiences). No passwords anywhere, no Facebook (removed — not supported). Guest checkout keeps its own contextual modal (unchanged) in addition to the standalone pages below.

## Progress overview

| Section                | E2E save | Validation | Docs       | Notes                                                                                                                                                     |
| ---------------------- | -------- | ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth layout            | —        | —          | Documented | Split panel + form; both audiences use one **`AuthSidePanelShell`**. Host: tour player. Guest: 7-chapter animated showcase (last chapter compares)        |
| Host sign-in           | ✅       | Client     | Documented | Email OTP + Google OAuth — one page for sign-in and sign-up                                                                                               |
| Guest sign-in          | ✅       | Client     | Documented | Email OTP + Google OAuth — one page for sign-in and sign-up                                                                                               |
| Register alias         | —        | —          | Documented | `/for-hosts/register` / `/for-guests/register` → matching `/login` (preserves `?redirect=`)                                                               |
| Guest checkout auth    | ✅       | Client     | Documented | Modal on form/messages entry, calendar Proceed, Reserve, save heart                                                                                       |
| Guest account nav      | ✅       | —          | Documented | Avatar on explore when signed in; real "Sign In" link when not                                                                                            |
| Host dashboard profile | ✅       | Client     | Documented | Sidebar account menu → **Profile** modal (same form as `/account/profile`)                                                                                |
| Mode switcher          | —        | —          | Documented | Global curtain; admin sidebar + marketing/auth triggers                                                                                                   |
| Mobile shell           | —        | —          | Documented | No bottom tab bar by default — `AuthLayout` is its own top-level route, not nested in `MarketingLayoutShell` (verified 2026-09-10, not just assumed)      |
| Form position          | —        | —          | Documented | Phone: card top-aligned under the header; `sm+`: vertically centered. Keeps the card still when a Turnstile challenge appears (CLS 0.25 → ~0.10 at 375px) |

---

## Overview

Guests can sign in two ways, both real and both landing in the same Supabase Auth session:

1. **Contextual checkout modal** (`GuestAuthModal`) — appears when a guest opens a gated surface (booking form, messages, reserve, contact host, **Contact ticket**, save) or commits an action that needs a session. When opened via **`requireGuestAuth`**, the modal has **no close control** and cannot be dismissed with overlay tap, Escape, or sheet drag (sign-in or use the browser back button to leave). Voluntary sign-in from the operational header keeps a dismissible modal.
2. **Standalone pages** (`/for-guests/login`) — reachable directly (nav "Sign In" link, deep links, bookmarks), same email-OTP + Google flow as the modal, just as a full page.

Guests can browse listings and pick dates without signing in. Opening **`/properties/:slug/form`**, **`/parkings/:slug/form`**, or **`/messages`** directly requires auth first (modal + skeleton), same as Reserve / Contact host.

1. **Property detail → Reserve** (desktop `BookingCard`, mobile sticky bar) — `usePropertyReserve` with `onOpenForm` opens **`GuestAuthModal`** first when anonymous, then **`GuestBookingFormModal`** (same pattern as Contact host)
2. **Calendar → Proceed** — `GuestAuthModal` (Airbnb-style)
3. **Property calendar → Book Now** — `usePropertyReserve` without `onOpenForm` navigates to `/form` and gates with `GuestAuthModal` first
4. **Property detail → Contact host** — `GuestAuthModal` first when anonymous, then **`ContactHostSheet`**
5. **Direct form / messages entry** — `/properties/:slug/form`, `/parkings/:slug/form`, and `/messages` open **`GuestAuthModal`** on load when anonymous (skeleton until signed in); submit still re-checks if the session expired
6. **Save property (heart)** — any listing card, list row, or detail gallery Save button → `GuestAuthModal` when anonymous; persists to `guest_saved_properties` after login (OAuth resume via `save_property` intent)
7. **Contact (`/contact`)** — category card → `requireGuestAuth` → `GuestAuthModal`, then **`NewTicketModal`** (OAuth resume navigates back with `?category=`)

Marketing **Become a host?** on explore pages runs the global mode-switch curtain to **`/for-hosts`**. On explore pages, signed-in guests always see **Dashboard** in the avatar menu under **Host** (not gated on org membership) — that link runs the same mode-switch curtain, then lands on **`/org`** (the hub redirects to an org the caller can access — usually the last visited one at its listing level — or onboarding if none). Phone/tablet uses the same **Dashboard** row in the marketing **More** sheet. When already in host mode (e.g. **`/for-hosts`** avatar menu), **Dashboard** navigates directly with no curtain. On `/for-hosts`, the pill CTA is **Explore** (back to guest mode); signed-in hosts use the avatar menu for **Dashboard**, signed-out hosts see **Sign In** → **`/for-hosts/login`**. On explore pages, signed-in guests see the avatar menu (**`/account/*`** — profile, stays, wishlist, messages, see **[[profile|Guest account — operator guide]]**), signed-out guests now see a real **Sign In** link → **`/for-guests/login`**.

On the **host dashboard**, the sidebar footer account menu shows the same avatar resolution as explore (saved profile photo → Google OAuth photo → initials). The trigger keeps name and email; the open menu shows only mode switch, **Profile**, and **Sign out** (no duplicate identity block). **Profile** opens a modal with the same edit form as **`/account/profile`**; saves go to **`guest-profile`** and update explore + dashboard immediately.

### Sign-in flow (both audiences)

- Single email field → **Continue** → OTP code emailed (unified sign-in/sign-up via `signInWithOtp` + `shouldCreateUser: true`) → 6-digit code entry → **Verify** (auto-submits once all 6 digits are entered)
- **Google** OAuth below the email path — same order as the guest checkout modal: email + Continue, **or** divider, then **Continue with Google** (both audiences). Facebook was removed and is not supported
- No phone sign-in, no passwords
- **One page per audience.** Email OTP creates the account on the first verified code, so a separate sign-up screen would render the identical form. Both headings read **Log in or sign up**, and the footer is a cross-audience exit (guest page → **Sign in as host**, host page → **Sign in as guest**) instead of a register link. `/for-hosts/register` and `/for-guests/register` stay as redirects to the matching `/login`, preserving `?redirect=`, so old bookmarks and links keep working
- The email step and the code-entry step are mutually exclusive views — once a code is sent, the Google button, divider, and the cross-audience footer are hidden so the code-entry step stays focused (just Back, the 6-digit input, Verify, and a Resend link with a 30s cooldown). Concurrent sends for the same normalized email share one in-flight request, preventing rapid clicks or two mounted auth surfaces from sending duplicate codes; Supabase Auth remains the server-side rate-limit authority.
- **Invisible human verification:** a Cloudflare Turnstile widget (`useCaptchaToken`, `action: auth-email-otp`) is mounted for the whole login flow — kept alive on both the email and the code-entry steps so **Resend** (which lives on the code step) always has a fresh single-use token. Real users see nothing; a suspicious session gets an inline challenge before **Continue** / **Resend** proceeds. The token is passed as `options.captchaToken` on `signInWithOtp` and verified by Supabase Auth's native Turnstile (`supabase/config.toml` `[auth.captcha]`; hosted: Dashboard → Authentication → Attack Protection). Fully degrades (no widget, OTP still sends) when `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` are unset. Google OAuth is unaffected. See [PROJECT.md → Anti-spam & CAPTCHA](../../PROJECT.md).

**Sign-in email (code + link).** `signInWithOtp` sends Supabase's **Confirm signup** template when the email is new and **Magic link** when the account already exists. Both are wired to the same branded template (`supabase/templates/auth/sign-in-code.html`, subject "Your Kame Space sign-in code"), so a returning login never reads like a separate signup step. The email leads with the `{{ .Token }}` 6-digit code (what `OtpCodeInput` / `verifyOtp` expects) and keeps `{{ .ConfirmationURL }}` as a fallback button. It is rendered and sent by Supabase Auth, not by `emailService` / Resend templates.

- **Local:** `supabase/config.toml` `[auth.email.template.confirmation]` and `.magic_link` point at the template; read the result in Inbucket (`http://127.0.0.1:54324`). Restart `./dev.sh` after editing.
- **Hosted:** templates are dashboard config and are **not** applied by `config.toml`. Paste the same HTML into Dashboard → Authentication → Emails for **Confirm signup** and **Magic link**, and update both whenever the file changes.
- **Sender:** hosted Auth sends through Resend custom SMTP (`smtp.resend.com:465`, user `resend`, from `Kame Space <mail@notify.kamespace.com>`), not the built-in mailer. Hosted limits: 120 emails/hour and a 30s per-address minimum, matching the UI resend cooldown. Supabase Auth has no Reply-To setting, so the template footer links to `/contact` instead of asking for a reply.
- **OTP length:** hosted `mailer_otp_length` must stay **6**. `OtpCodeInput` renders six cells and the sensitive-settings / super-admin reauth dialogs say "Enter the 6-digit code". Raising it server-side silently breaks every code entry.

Resume after OAuth (guest): `sessionStorage` (`guestAuthResume.ts`) restores navigation to the form, contact-host sheet, booking-form modal, or auto-submits after social/email auth when the modal was the entry point. On the standalone guest page, OAuth/OTP success simply navigates to `?redirect=` (or `/`) once the session becomes authenticated.

`?redirect=` must be a same-origin path: `safeRedirect` falls back to the default for absolute URLs, `//…`, and any value with a backslash or control character (browsers turn `/\evil.com` and `/<tab>/evil.com` into `//evil.com`).

### Host sign-in

**Layout (lg+, host routes):** 50/50 split — left **`HostWorkspaceSidePanel`** (`variant="auth"`) shared with onboarding: solid **`bg-primary`**, **`MarketingBrandLogo`** inset `p-4` (same top-left as **`MarketingNav`**), headline + description, compact **`HostDashboardTourPlayer`** (expand modal — the tour film is theme-aware and follows the viewer's light/dark choice; see `for-hosts.md` § Dark mode). No footer links on the panel.

**Shared panel shell:** host and guest left panels both render through **`AuthSidePanelShell`** (`marketing/shared/components`): `aside` on solid **`bg-primary-strong`**, logo link inset top-left, left-aligned title + one-line description, then the audience content. Only that content differs between host and guest. The column has `pt-20` so the heading never runs into the logo on short screens.

### Guest sign-in layout

**Desktop (lg+, `/for-guests/login`):** left **`GuestExperienceSidePanel`**: title "Your whole stay, in one app", then:

1. **`GuestFeatureShowcase`**: a card with a live mock-UI stage and seven chapter tabs, in trip order. Each scene plays a short story: a fingertip tap on the control itself, a state change, then the result.
   - **Search:** the query types itself, Search is tapped, intent chips appear, results and map pins drop in, then each result highlights with its pin.
   - **Book:** check-in and check-out are tapped, the range fills, nights and totals count up, **Reserve** turns into **Requested**, and the host is notified.
   - **Chat:** two acts. Text: question starters (the real FAQ starters), one is tapped, the host reads and replies. Voice: the mic is tapped and the call view slides up with the real 3D turtle receptionist (`ReceptionistAvatar`, lazy-loaded with its idle image as placeholder) inside the real booth ring, moving through connecting, listening, thinking and speaking with live captions. If the device has no usable WebGL, or the 3D render fails, the turtle's still image shows instead (error boundary); the page never breaks.
   - **Trip:** status moves Requested, Confirmed, Ready; documents go from In review to Approved; parking gets a slot; a next-step banner appears.
   - **Guide:** a phone shows the stay guide; Wi-Fi is copied, then the page scrolls to house rules and check-in steps. Wide stages add side callouts.
   - **Perks:** the real after-stay reward. A prize wheel with the default prize pool and colors of the live voucher wheel (5% to 50% off, or a free stay) is tapped, spins and lands on 15% off; a ticket shows the code with **Book again**, and the deposit line turns to **Sent to GCash**.
   - **Compare:** "same trip, two ways". Five moments of one stay sit on matched rows: booking, receipt, building documents, parking, deposit. On the left, where each usually happens (a middleman app, a chat, an email, a phone call, a follow-up); on the right, the same step on the trip page. The divider wipes from the clutter to the trip page and rests in the middle, then each row is matched (cross, dashed link across the divider, check) and a tally closes it: "5 places to keep up with" vs "1 trip page". Guests can drag the divider. Competitors are not named on purpose.
   - Autoplay: each chapter has its own length (5.5 to 8s) with a progress fill on the active tab. Pauses on hover, keyboard focus inside the card, when the card is off-screen, when the browser tab is hidden, or via the pause button.
   - Tabs: click, or Left/Right/Home/End when a tab is focused (`role="tablist"`).
   - Reduced motion: no autoplay, no pause button, no tap animations; every scene renders its final state and the Compare divider rests in the middle.
   - Stage height follows the viewport (`clamp`, 240 to 340px) so the panel never scrolls from 1024x768 to 1920x1080.

All scene content is sample data (fictional listings, host "Mara", guest "Ana"). The old invented stats (500+ properties, 4.9 rating, 10k+ guests) were removed.

**Phone / tablet (< lg):** the side panel is not rendered. Under the sign-in form, a **Why sign in** section (`GuestExperienceMobileSection`) shows the same showcase (4:3 stage on phone, 16:10 from `sm`). Scenes adapt to the stage width (container queries): narrow stages drop the map, the price breakdown and the side callouts. Only one showcase is mounted at a time (`useIsBelowLg`). Host routes have no such section.

1. User enters their email (OTP) or clicks **Continue with Google** on `/for-hosts/login`.
2. Either path lands a normal Supabase Auth session — `useAdminSession` treats any session as signed-in regardless of which method was used.
3. On success, **`useHostGoogleAuth`** (name unchanged, now also drives OTP) + **`resolvePostSignInPath`** routes to onboarding **only when the email has no usable org**. Sign-in and a `?redirect=/onboarding` deep link both call `list-organizations` first: existing owners/members go to their workspace; hard-rejected hosts go to **`/verification-rejected`**. The same response carries the server-derived `isSuperAdmin` capability used by the Admin mode tab and `/admin/*` route guard; super-admin email addresses never ship in the browser bundle. One email = one Auth user = at most one usable owned organization. If that call fails in the browser as `TypeError: Failed to fetch` / `net::ERR_FAILED` (often wrapped by PostHog session replay), it is a CORS preflight miss, not a bad Google session. `_shared/cors.ts` must allow the exact page origin (including `http://127.0.0.1:*`; temporary previews use `CORS_ALLOWED_ORIGINS`) and PostHog tracing headers. Local: restart `functions serve`. Hosted dev: deploy functions (`bun run deploy:supabase:dev`).

Guards send unauthenticated hosts to **`hostLoginPath(currentPath)`**.

There is no password anywhere in this flow. What used to be `/for-hosts/forgot-password`, `/for-hosts/reset-password`, and `/for-hosts/verify-email` no longer exist — those pages only ever supported a password flow that was never real, and passwords aren't part of the model at all now (email OTP already proves email ownership per code entry, the same guarantee a password reset link would give).

---

## Host-facing knowledge

Hosts and guests can both sign in with a one-time code sent to their email, or with their Google account. There's no password to remember or reset for either, and no Facebook sign-in option.

**Common host questions**

- Q: How do I sign in to my dashboard?
  A: Use "Continue with Google," or enter your email to get a one-time sign-in code - either way, no password is needed.
- Q: Where do I create an account?
  A: The sign-in page does it. Enter your email, confirm the code we send, and your account exists. New and returning people use the same page.
- Q: I'm on the wrong sign-in page. Can I switch?
  A: Yes. The line under the form switches between guest and host sign-in.
- Q: I can't find a password option. Is that normal?
  A: Yes. Signing in only works through a one-time email code or your Google account, by design.
- Q: Why does a guest get asked to sign in partway through booking, not at the start?
  A: Guests can browse dates and start filling out the form freely. They're only asked to verify their identity right before the booking is actually submitted, though they can also sign in any time from the "Sign In" link.
- Q: What sign-in options do guests have?
  A: A one-time code sent to their email, or Google. Facebook is not offered.
- Q: Can I edit my profile from the dashboard?
  A: Yes. Open the account menu at the bottom of the sidebar and choose **Profile**. It is the same info as the guest account profile on explore.
- Q: I already set up a host account with this email. Why am I not sent through setup again?
  A: Each email is one host account. Sign-in opens your existing workspace. You cannot create a second organization with the same email.
- Q: I signed in with Google but the page says it could not load my workspace.
  A: Refresh and try again. Sign-in worked; the workspace list did not load.
- Q: What do guests see on the sign-in page?
  A: A short animated tour of what they can do after signing in: search, booking with you directly, messaging, their trip page, the stay guide, the voucher wheel and deposit refunds, a voice call with the turtle receptionist, plus a side-by-side of the same trip on other apps versus one trip page. On a phone it shows under the sign-in form.
- Q: What does the sign-in email look like?
  A: It comes from Kame Space with a 6-digit code and a sign-in button. Enter the code on the sign-in screen, or use the button. The code expires after 1 hour.

---

## Implementation map

| Concern                               | Path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth layout                           | `ui/src/features/guest/auth/components/AuthLayout.tsx` (lazy-loads both side panels)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Shared side-panel shell               | `ui/src/features/guest/marketing/shared/components/AuthSidePanelShell.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Guest side panel + phone section      | `ui/src/features/guest/auth/components/GuestExperienceSidePanel.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Guest showcase (card, tabs, autoplay) | `ui/src/features/guest/auth/components/GuestFeatureShowcase.tsx` · scenes `GuestShowcaseScenes.tsx` (Search, Book, Chat, Trip + registry), `GuestShowcaseVoiceCall.tsx` (receptionist call), `GuestShowcaseStayScenes.tsx` (Guide), `GuestShowcasePerksScene.tsx` (wheel; palette `sd-form/lib/voucherWheelPalette.ts`), `GuestShowcaseCompareScene.tsx` · kit `GuestShowcaseSceneKit.tsx` · clock `hooks/useShowcaseTimeline.ts` · copy `lib/guestShowcaseChapters.ts` · motion `lib/guestShowcaseMotion.ts` · keyframes `guest-showcase-progress` in `index.css` |
| Host workspace side panel (shared)    | `ui/src/features/guest/marketing/shared/components/HostWorkspaceSidePanel.tsx` — also used by onboarding (`OnboardingFeatureShowcase`)                                                                                                                                                                                                                                                                                                                                                                                                                             |
|                                       | `ui/src/features/guest/auth/context/GuestAuthContext.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Session / OTP / OAuth (shared)        | `ui/src/features/guest/auth/hooks/useGuestSession.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
|                                       | `ui/src/features/guest/auth/hooks/useGuestAuthActions.ts` (used by both audiences)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| OAuth resume (checkout modal)         | `ui/src/features/guest/auth/lib/guestAuthResume.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Calendar / Reserve / Save gates       | `ui/src/features/guest/calendar/pages/CalendarPage.tsx`, `ui/src/features/guest/marketing/properties/hooks/usePropertyReserve.ts`, `ui/src/features/guest/marketing/properties/hooks/usePropertySave.ts`                                                                                                                                                                                                                                                                                                                                                           |
| Form gate                             | `ui/src/features/guest/form/components/GuestForm.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Unified auth page content             | `ui/src/features/guest/auth/components/AuthPageContent.tsx` (email OTP two-step + `OtpCodeInput.tsx` + `GoogleSignInButton`)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Host sign-in page                     | `ui/src/features/guest/auth/pages/HostAuthPages.tsx` (`HostLoginPage`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Host OTP + OAuth + redirect hook      | `ui/src/features/guest/auth/hooks/useHostGoogleAuth.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Guest sign-in page                    | `ui/src/features/guest/auth/pages/GuestAuthPages.tsx` (`GuestLoginPage`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Register alias (host + guest)         | `ui/src/features/guest/auth/components/LegacyAuthRegisterRedirect.tsx` → matching `/login`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Guest OTP + OAuth + redirect hook     | `ui/src/features/guest/auth/hooks/useGuestAuthPage.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Auth page config                      | `ui/src/features/guest/auth/config/auth-page-config.ts` (`AUTH_PAGE_CONFIG.host` / `.guest`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Auth sign-in email template           | `supabase/templates/auth/sign-in-code.html` + `supabase/config.toml` (`[auth.email.template.confirmation]` / `.magic_link`)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Path helpers                          | `ui/src/features/guest/auth/lib/hostAuthPaths.ts`, `ui/src/features/guest/auth/lib/guestAuthPaths.ts`, `ui/src/features/guest/auth/lib/authRedirect.ts` (shared `safeRedirect`)                                                                                                                                                                                                                                                                                                                                                                                    |
| Nav mode/CTA helpers                  | `ui/src/features/guest/auth/config/auth-navigation.ts` (`getAuthAudienceFromPath`, `getHostMarketingNavCta`, `getGuestLoginCta`), `ui/src/features/guest/auth/config/mode-switch.ts`                                                                                                                                                                                                                                                                                                                                                                               |
| Marketing nav sign-in CTA             | `ui/src/features/guest/marketing/shared/components/MarketingNav.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Dashboard account menu + profile      | `ui/src/features/dashboard/bookings/components/AdminLayout.tsx` (`AdminProfileFooter`), `ui/src/features/guest/account/components/GuestProfileModal.tsx`, `useAccountIdentity.ts`                                                                                                                                                                                                                                                                                                                                                                                  |
| Auth routes                           | `ui/src/features/guest/auth/routes/index.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Dashboard edge JWT                    | `ui/src/features/dashboard/org/lib/edgeClient.ts` (`getSessionJwt`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

`getSessionJwt` reuses the cached access token and refreshes only when it is near expiry (single-flight). Do not call `refreshSession()` on every edge request: hosted Auth rate-limits `/token` (`over_request_rate_limit`) and a 429 can sign the user out.

---

## Env / Supabase

- **Google OAuth:** `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (host + guest)
- Email OTP must be enabled in Supabase Auth (both audiences). Auth email transport and templates are Supabase-side config, not env vars: custom SMTP is required for real users (the built-in mailer only reaches organization team addresses), and **Confirm signup** + **Magic link** must both use `supabase/templates/auth/sign-in-code.html`. Local copies are wired in `config.toml`; hosted copies live in Dashboard → Authentication → Emails.
- **Turnstile CAPTCHA (optional):** `VITE_TURNSTILE_SITE_KEY` (UI) + `TURNSTILE_SECRET_KEY` (edge). Local: add the secret to `ui/.env.development`, set `VITE_TURNSTILE_SITE_KEY`, flip `[auth.captcha] enabled = true` in `supabase/config.toml`, restart. Hosted: Dashboard → Authentication → Attack Protection → enable Turnstile with the secret. Test keys in [`validation-and-env.md`](../../architecture/validation-and-env.md) §11.
- Facebook OAuth was removed — `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` and the `[auth.external.facebook]` block in `supabase/config.toml` no longer exist. Not supported; do not reintroduce it.

---

## Testing

| Layer | Path / spec                                                                                                                                                                                   | Manual                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Unit  | OTP/reserved-name validators when touched; `auth/lib/hostAuthPaths.test.ts`, `guestAuthPaths.test.ts` (path + redirect encoding); `_shared/cors_test.ts` (PostHog tracing + loopback origins) | —                                                       |
| E2E   | `ui/e2e/features/auth/authPagesSmoke.spec.ts` (headings + cross-audience footer), `authRedirectSmoke.spec.ts`, `legacyRedirectSmoke.spec.ts` (`@smoke` / `@ci`)                               | Google OAuth, real email OTP                            |
| N/A   | —                                                                                                                                                                                             | Turnstile live, Facebook removed                        |
| N/A   | Auth email render is Supabase-side                                                                                                                                                            | New + existing email in Inbucket, then hosted SMTP send |

---

## Related docs

- [For hosts](./for-hosts.md)
- [Calendar](./calendar.md)
- [Route index](./README.md)

---

## Pending / follow-ups

None currently open.
