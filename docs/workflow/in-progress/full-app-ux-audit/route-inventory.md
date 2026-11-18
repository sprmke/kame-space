---
title: 'Route inventory for agents'
status: active
tags: [audit, routes, inventory, agents]
updated: 2026-11-19
---

# Route inventory

Every user-facing route, the component that renders it, and where its evidence lives. Use this to jump
from a finding to the file an agent must open.

Columns:

- **Auth** — `public` (anonymous), `guest` (guest portal session), `host` (admin allow-list).
- **Shots** — screenshot id prefix in [`screenshots/public/`](./screenshots/public/); append `__d1440.jpg`,
  `__m390.jpg`, `__t768.jpg`, `__l1024.jpg`, `__s320.jpg` as available.
- **Guide** — the route guide in `docs/guides/routes/` if one exists.

## Marketing shell

| Path               | Page               | File                                                                    | Auth   | Shots                        | Guide                  |
| ------------------ | ------------------ | ----------------------------------------------------------------------- | ------ | ---------------------------- | ---------------------- |
| `/`                | MarketingHomePage  | `features/guest/marketing/pages/MarketingHomePage.tsx`                  | public | `marketing__home`            | `marketing/home.md`    |
| `/v2`              | GuestLandingV2Page | `features/guest/marketing/pages/GuestLandingV2Page.tsx`                 | public | `marketing__home-v2`         | —                      |
| `/explore-preview` | ExplorePreviewPage | `features/guest/marketing/explore-preview/pages/ExplorePreviewPage.tsx` | public | `for-hosts__explore-preview` | —                      |
| `/search`          | SearchResultsPage  | `features/guest/search/pages/SearchResultsPage.tsx`                     | public | `marketing__search`          | `marketing/search.md`  |
| `/services`        | ServicesPage       | `features/guest/marketing/pages/ServicesPage.tsx`                       | public | `marketing__services`        | —                      |
| `/about`           | AboutPage          | `features/guest/marketing/pages/AboutPage.tsx`                          | public | `marketing__about`           | `marketing/about.md`   |
| `/contact`         | ContactPage        | `features/guest/marketing/pages/ContactPage.tsx`                        | public | `marketing__contact`         | `marketing/contact.md` |
| `/support`         | SupportPage        | `features/guest/marketing/pages/SupportPage.tsx`                        | public | `marketing__support`         | `marketing/support.md` |
| `/terms`           | TermsPage          | `features/guest/marketing/pages/TermsPage.tsx`                          | public | `marketing__terms`           | `marketing/legal.md`   |
| `/privacy`         | PrivacyPage        | `features/guest/marketing/pages/PrivacyPage.tsx`                        | public | `marketing__privacy`         | `marketing/legal.md`   |
| `/cookies`         | CookiesPage        | `features/guest/marketing/pages/CookiesPage.tsx`                        | public | `marketing__cookies`         | `marketing/legal.md`   |
| `*` (404)          | NotFoundPage       | `routes/NotFoundPage.tsx`                                               | public | `marketing__404`             | —                      |

## Host marketing

| Path                 | Page                       | File                                                     | Auth   | Shots                          | Guide          |
| -------------------- | -------------------------- | -------------------------------------------------------- | ------ | ------------------------------ | -------------- |
| `/for-hosts`         | ForHostsPage               | `features/guest/marketing/pages/ForHostsPage.tsx`        | public | `for-hosts__for-hosts`         | `for-hosts.md` |
| `/for-hosts/pricing` | ForHostsPricingPage        | `features/guest/marketing/pages/ForHostsPricingPage.tsx` | public | `for-hosts__for-hosts-pricing` | `for-hosts.md` |
| `/for-hosts/v2`      | ForHostsPreviewPage        | `features/guest/marketing/pages/ForHostsPreviewPage.tsx` | public | `for-hosts__for-hosts-v2`      | —              |
| `/for-hosts/v3`      | ForHostsV3Page             | `features/guest/marketing/pages/ForHostsV3Page.tsx`      | public | `for-hosts__for-hosts-v3`      | —              |
| `/for-hosts/v4`      | ForHostsV4Page             | `features/guest/marketing/pages/ForHostsV4Page.tsx`      | public | `for-hosts__for-hosts-v4`      | —              |
| `/for-hosts/preview` | redirect → `/for-hosts/v2` | `features/guest/marketing/routes/index.tsx`              | public | —                              | —              |

## Listings

| Path                             | Page                       | File                                                                   | Auth   | Shots                              | Guide                       |
| -------------------------------- | -------------------------- | ---------------------------------------------------------------------- | ------ | ---------------------------------- | --------------------------- |
| `/properties`                    | PropertiesListPage         | `features/guest/marketing/pages/PropertiesListPage.tsx`                | public | `listings__properties`             | `marketing/properties.md`   |
| `/properties/in/:location`       | PropertiesLocationPage     | `features/guest/marketing/pages/PropertiesLocationPage.tsx`            | public | `listings__properties-location`    | `marketing/properties.md`   |
| `/properties/:propertySlug`      | PropertyDetailPage         | `features/guest/marketing/pages/PropertyDetailPage.tsx`                | public | `listings__property-detail`        | `guest/property-detail.md`  |
| `/parkings`                      | ParkingsListPage           | `features/guest/marketing/pages/ParkingsListPage.tsx`                  | public | `listings__parkings`               | `marketing/parkings.md`     |
| `/parkings/in/:location`         | ParkingsLocationPage       | `features/guest/marketing/pages/ParkingsLocationPage.tsx`              | public | `listings__parkings-location`      | `marketing/parkings.md`     |
| `/parkings/:parkingSlug`         | ParkingDetailPage          | `features/guest/marketing/pages/ParkingDetailPage.tsx`                 | public | `listings__parking-detail`         | `guest/parking-detail.md`   |
| `/parkings/:parkingSlug/form`    | ParkingFormPage            | `features/guest/marketing/pages/ParkingFormPage.tsx`                   | public | `listings__parking-form`           | `guest/parking-form.md`     |
| `/parkings/requests/:bookingId`  | ParkingRequestStatusPage   | `features/guest/marketing/parkings/pages/ParkingRequestStatusPage.tsx` | public | `listings__parking-request`        | —                           |
| `/developments`                  | DevelopmentsListPage       | `features/guest/marketing/pages/DevelopmentsListPage.tsx`              | public | `listings__developments`           | `marketing/developments.md` |
| `/developments/in/:location`     | DevelopmentsLocationPage   | `features/guest/marketing/pages/DevelopmentsLocationPage.tsx`          | public | `listings__developments-location`  | `marketing/developments.md` |
| `/developments/:slug`            | DevelopmentDetailPage      | `features/guest/marketing/pages/DevelopmentDetailPage.tsx`             | public | `listings__development-detail`     | `marketing/developments.md` |
| `/developments/:slug/properties` | DevelopmentPropertiesPage  | `features/guest/marketing/pages/DevelopmentPropertiesPage.tsx`         | public | `listings__development-properties` | `marketing/developments.md` |
| `/developments/:slug/parking`    | DevelopmentParkingListPage | `features/guest/marketing/pages/DevelopmentParkingListPage.tsx`        | public | `listings__development-parking`    | `marketing/developments.md` |
| `/hosts/:orgSlug`                | HostPublicPage             | `features/guest/marketing/pages/HostPublicPage.tsx`                    | public | `listings__host-public`            | `marketing/host-public.md`  |

## Guest operational

| Path                                   | Page                     | File                                                                  | Auth                  | Shots                                            | Guide                   |
| -------------------------------------- | ------------------------ | --------------------------------------------------------------------- | --------------------- | ------------------------------------------------ | ----------------------- |
| `/properties/:slug/calendar`           | CalendarPage             | `features/guest/calendar/pages/CalendarPage.tsx`                      | public                | `guest-flow__calendar`                           | `guest/calendar.md`     |
| `/properties/:slug/form`               | GuestForm                | `features/guest/form/components/GuestForm.tsx`                        | public + sign-in gate | `guest-flow__form`, `guest-flow__form-signed-in` | `guest/form.md`         |
| `/properties/:slug/success`            | GuestFormSuccess         | `features/guest/form/components/GuestFormSuccess.tsx`                 | public                | `guest-flow__success`                            | `guest/form.md`         |
| `/properties/:slug/trip`               | GuestTripPage            | `features/guest/trip/pages/GuestTripPage.tsx`                         | guest session         | `guest-flow__trip`                               | `guest/trip.md`         |
| `/properties/:slug/stay-guide`         | StayGuidePage            | `features/guest/stay-guide/pages/StayGuidePage.tsx`                   | token                 | `guest-flow__stay-guide`                         | `guest/stay-guide.md`   |
| `/properties/:slug/showcase`           | PropertyShowcasePage     | `features/guest/marketing/showcase/pages/PropertyShowcasePage.tsx`    | public                | `guest-flow__showcase`                           | `guest/showcase.md`     |
| `/properties/:slug/messages`           | PropertyChatPage         | `features/guest/chat/pages/PropertyChatPage.tsx`                      | guest session         | `guest-flow__messages`                           | `guest/messages.md`     |
| `/properties/:slug/sd-form`            | SdFormPage               | `features/guest/sd-form/pages/SdFormPage.tsx`                         | token / booking       | `guest-flow__sd-form`                            | `guest/sd-form.md`      |
| `/properties/:slug/guest-review`       | GuestReviewPage          | `features/guest/sd-form/pages/GuestReviewPage.tsx`                    | booking               | `guest-flow__guest-review`                       | `guest/guest-review.md` |
| `/properties/:slug/parking/:bookingId` | PayParkingPage           | `features/guest/pay-parking/pages/PayParkingPage.tsx`                 | booking               | `guest-flow__pay-parking`                        | `guest/pay-parking.md`  |
| `/properties/:slug/document`           | GuestBookingDocumentPage | `features/guest/booking-documents/pages/GuestBookingDocumentPage.tsx` | token                 | `guest-flow__document`                           | —                       |

## Auth

| Path                    | Page                             | File                                                       | Auth           | Shots                  | Guide                   |
| ----------------------- | -------------------------------- | ---------------------------------------------------------- | -------------- | ---------------------- | ----------------------- |
| `/for-hosts/login`      | HostLoginPage                    | `features/guest/auth/pages/HostAuthPages.tsx`              | public         | `auth__host-login`     | `auth/host-login.md`    |
| `/for-guests/login`     | GuestLoginPage                   | `features/guest/auth/pages/GuestAuthPages.tsx`             | public         | `auth__guest-login`    | `auth/guest-login.md`   |
| `/for-hosts/register`   | redirect to login (register tab) | `features/guest/auth/routes/index.tsx`                     | public         | `auth__host-register`  | `auth/host-login.md`    |
| `/for-guests/register`  | redirect to login (register tab) | `features/guest/auth/routes/index.tsx`                     | public         | `auth__guest-register` | `auth/guest-login.md`   |
| `/accept-invite`        | AcceptInvitePage                 | `features/dashboard/team/pages/AcceptInvitePage.tsx`       | public (token) | `auth__accept-invite`  | `auth/accept-invite.md` |
| `/verify/:sessionToken` | MobileCaptureHandoffPage         | `features/verification/pages/MobileCaptureHandoffPage.tsx` | token          | —                      | —                       |

## Guest account

| Path                                                       | Page                    | File                                                       | Auth  | Shots                                      | Guide                  |
| ---------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- | ----- | ------------------------------------------ | ---------------------- |
| `/account/profile`                                         | GuestProfilePage        | `features/guest/account/pages/GuestProfilePage.tsx`        | guest | `account__profile`                         | `account/profile.md`   |
| `/account/trips`                                           | GuestTripsPage          | `features/guest/account/pages/GuestTripsPage.tsx`          | guest | `account__trips`                           | `account/trips.md`     |
| `/account/messages`                                        | GuestMessagesPage       | `features/guest/account/pages/GuestMessagesPage.tsx`       | guest | `account__messages`                        | `account/messages.md`  |
| `/account/vouchers`                                        | GuestVouchersPage       | `features/guest/account/pages/GuestVouchersPage.tsx`       | guest | `account__vouchers`                        | `account/vouchers.md`  |
| `/account/reviews`                                         | GuestAccountReviewsPage | `features/guest/account/pages/GuestAccountReviewsPage.tsx` | guest | `account__reviews`                         | `account/reviews.md`   |
| `/account/favorites`                                       | GuestWishlistPage       | `features/guest/account/pages/GuestWishlistPage.tsx`       | guest | `account__favorites`                       | `account/favorites.md` |
| `/account/tickets`                                         | GuestTicketsPage        | `features/guest/account/pages/GuestTicketsPage.tsx`        | guest | `account__tickets`, `account__tickets-new` | `account/tickets.md`   |
| `/account/help`                                            | GuestAccountHelpPage    | `features/guest/account/pages/GuestAccountHelpPage.tsx`    | guest | `account__help`                            | `account/help.md`      |
| `/account/stays`, `/account/settings`, `/account/wishlist` | redirects               | `features/guest/account/routes/index.tsx`                  | guest | —                                          | —                      |

## Dashboard surfaces not covered before this pass

| Path                                                 | Page                                    | File                                                                       | Auth | Shots                               |
| ---------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- | ---- | ----------------------------------- |
| `/onboarding`                                        | OnboardingPage                          | `features/dashboard/org/pages/OnboardingPage.tsx`                          | host | `admin-gap__onboarding`             |
| `/verification-rejected`                             | HostVerificationRejectedRoutePage       | `features/dashboard/org/pages/HostVerificationRejectedRoutePage.tsx`       | host | `admin-gap__verification-rejected`  |
| `/admin/playbook`                                    | SuperAdminPlaybookArticlesPage          | `features/dashboard/super-admin/pages/SuperAdminPlaybookArticlesPage.tsx`  | host | `admin-gap__admin-playbook`         |
| `/admin/support/faqs`                                | SuperAdminHelpFaqsPage                  | `features/dashboard/super-admin/pages/SuperAdminHelpFaqsPage.tsx`          | host | `admin-gap__admin-faqs`             |
| `/admin/ai-usage` → `/admin/ai?tab=usage`            | SuperAdminAiPage                        | `features/dashboard/super-admin/pages/SuperAdminAiPage.tsx`                | host | `admin-gap__admin-ai-usage`         |
| `/admin/health/:section`                             | SuperAdminHealthPage                    | `features/dashboard/super-admin/pages/SuperAdminHealthPage.tsx`            | host | `admin-gap__admin-health-section`   |
| `/admin/ops-reports`                                 | SuperAdminOpsReportsPage                | `features/dashboard/super-admin/pages/SuperAdminOpsReportsPage.tsx`        | host | `admin-gap__admin-ops-report`       |
| `/admin/marketing-trends`                            | SuperAdminMarketingTrendsPage           | `features/dashboard/super-admin/pages/SuperAdminMarketingTrendsPage.tsx`   | host | — (see note)                        |
| `/admin/pricing/payment-settings`                    | SuperAdminPaymentSettingsPage           | `features/dashboard/super-admin/pages/SuperAdminPaymentSettingsPage.tsx`   | host | `admin-gap__admin-payment-settings` |
| `/admin/developments/:slug`                          | SuperAdminDevelopmentDetailPage         | `features/dashboard/super-admin/pages/SuperAdminDevelopmentDetailPage.tsx` | host | `admin-gap__admin-development`      |
| `/org/:org/property/:slug/help-support/tickets`      | TicketsWorkspacePage                    | `features/dashboard/help-support/pages/TicketsWorkspacePage.tsx`           | host | `admin-gap__prop-tickets`           |
| `/org/:org/property/:slug/help-support/docs`         | HelpDocumentationPage                   | `features/dashboard/help-support/pages/HelpDocumentationPage.tsx`          | host | `admin-gap__prop-docs`              |
| `/org/:org/property/:slug/activity`                  | ActivityLogRedirect → Settings activity | `features/dashboard/activity/pages/ActivityLogRedirect.tsx`                | host | `admin-gap__prop-activity`          |
| `/org/:org/property/:slug/announcements`             | HostAnnouncementsListPage               | `features/dashboard/announcements/pages/HostAnnouncementsListPage.tsx`     | host | `admin-gap__prop-announcement`      |
| `/org/:org/team`                                     | OrgTeamPage                             | `features/dashboard/team/pages/OrgTeamPage.tsx`                            | host | `admin-gap__org-team`               |
| `/org/:org/parking/:slug/notifications`              | ParkingNotificationsPage                | `features/dashboard/parking/pages/ParkingNotificationsPage.tsx`            | host | `admin-gap__parking-notifications`  |
| `/org/:org/parking/:slug/announcements`              | HostAnnouncementsListPage               | `features/dashboard/announcements/pages/HostAnnouncementsListPage.tsx`     | host | `admin-gap__parking-announcements`  |
| `/org/:org/parking/:slug/help-support/tickets`       | TicketsWorkspacePage                    | `features/dashboard/help-support/pages/TicketsWorkspacePage.tsx`           | host | `admin-gap__parking-tickets`        |
| `/org/:org/property/:slug/public-pages/:pageId/edit` | PageEditorPage                          | `features/dashboard/page-editor/pages/PageEditorPage.tsx`                  | host | `admin-gap__prop-public-page-edit`  |

**Note on `/admin/marketing-trends`:** at capture time the Vite dev server was serving a stale route module
(the source route exists and the nav links to it). It 404s in the running app until the dev server reloads.
Not recorded as a product defect; re-verify after a restart.

## Legacy redirects (no UI to review)

`/sign-in`, `/calendar`, `/form`, `/success`, `/guest-review`, `/sd-form`, `/bookings/:id/parking`,
`/dashboard`, `/bookings`, `/finance`, `/maintenance`, `/notifications`, `/marketing`, `/staff`,
`/operations`, `/settings`, `/org` (selector), `/for-hosts/preview`, `/developments/:slug/parking/category`,
`/developments/:slug/parking/list`, `/admin/settings`, `/admin/ai-usage`, `/admin/hosts/:id/*`,
`/admin/orgs/:slug/*`, `/account/stays`, `/account/settings`, `/account/wishlist`.
