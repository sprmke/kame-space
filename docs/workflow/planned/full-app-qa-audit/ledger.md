---
title: 'Full-app QA audit: route ledger'
status: planned
stage: planned
kind: reference
tags: [qa, audit, ledger, coverage]
updated: 2026-11-13
---

# Route ledger

One row per route or tightly coupled route group. This is the claim board and the K1 coverage inventory.

- **Baseline SHA:** _set in Phase 0_
- **Built from:** the route files under `ui/src/**/routes` and the 107 guides in `docs/guides/routes/`, read on 2026-11-13 at `fd6ae9c16`. Phase 0 reconciles it against the `route-inventory` script; any route missing here is added before audits start.
- **Status values:** `todo` · `in-audit` · `audited` · `in-fix` · `re-verify` · `signed-off` · `waived`
- **Archetypes:** R redirect · S static · P public data · G guest operational · DR dashboard read · DW dashboard write · WF workflow · SA super-admin · X third-party integration
- **Guide §** is the count of `##` sections in the guide today, a rough size signal. `none` means no guide exists, which is itself a doc gap to close in the audit.

When a row is audited, fill: `Status`, `Elements (pass/fail/blocked/N-A)`, `Findings (P0/P1/P2/P3)`, `Record` (link to `docs/workflow/qa/full-app/pages/…`), `By / date`.

## Public and marketing: [`modules/01-public-marketing.md`](./modules/01-public-marketing.md)

| ID     | Route                                                                                                                           | Arch | Guide (§)                      | Status | Elements | Findings | Record | By / date |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------ | ------ | -------- | -------- | ------ | --------- |
| PUB-01 | `/`                                                                                                                             | P    | `index-landing.md` (10)        | todo   |          |          |        |           |
| PUB-02 | `/search`                                                                                                                       | P    | `search.md` (10)               | todo   |          |          |        |           |
| PUB-03 | `/properties`, `/properties/in/:location`                                                                                       | P    | `properties.md` (16)           | todo   |          |          |        |           |
| PUB-04 | `/properties/:propertySlug` (listing detail)                                                                                    | P    | `properties.md` (16)           | todo   |          |          |        |           |
| PUB-05 | `/properties/:propertySlug/showcase`                                                                                            | P    | `property-showcase.md` (8)     | todo   |          |          |        |           |
| PUB-06 | `/parkings`, `/parkings/in/:location`                                                                                           | P    | `parkings.md` (12)             | todo   |          |          |        |           |
| PUB-07 | `/parkings/:parkingSlug`                                                                                                        | P    | `parkings.md` (12)             | todo   |          |          |        |           |
| PUB-08 | `/developments`, `/developments/in/:location`                                                                                   | P    | `developments.md` (13)         | todo   |          |          |        |           |
| PUB-09 | `/developments/:slug`                                                                                                           | P    | `developments.md` (13)         | todo   |          |          |        |           |
| PUB-10 | `/developments/:slug/properties`                                                                                                | P    | `developments.md` (13)         | todo   |          |          |        |           |
| PUB-11 | `/developments/:slug/parking`, `…/parking/category`                                                                             | P    | `developments.md` (13)         | todo   |          |          |        |           |
| PUB-12 | `/hosts/:orgSlug`                                                                                                               | P    | none                           | todo   |          |          |        |           |
| PUB-13 | `/for-hosts`                                                                                                                    | S    | `for-hosts.md` (10)            | todo   |          |          |        |           |
| PUB-14 | `/for-hosts/pricing`                                                                                                            | P    | `for-hosts.md` (10)            | todo   |          |          |        |           |
| PUB-15 | `/services`                                                                                                                     | S    | `services.md` (7)              | todo   |          |          |        |           |
| PUB-16 | `/about`                                                                                                                        | S    | `legal.md` (10)                | todo   |          |          |        |           |
| PUB-17 | `/contact`                                                                                                                      | S    | `legal.md` (10)                | todo   |          |          |        |           |
| PUB-18 | `/support`                                                                                                                      | P    | `legal.md` / `account/help.md` | todo   |          |          |        |           |
| PUB-19 | `/terms`, `/privacy`, `/cookies`                                                                                                | S    | `legal.md` (10)                | todo   |          |          |        |           |
| PUB-20 | `*` not-found (public and dashboard variants)                                                                                   | S    | none                           | todo   |          |          |        |           |
| PUB-21 | `/app` launch resolver                                                                                                          | R    | `app.md` (9)                   | todo   |          |          |        |           |
| PUB-22 | Dev and preview routes: `/v2`, `/explore-preview`, `/for-hosts/v2`, `/for-hosts/v3`, `/for-hosts/preview`, poster sheet         | R    | none                           | todo   |          |          |        |           |
| PUB-23 | Global public chrome: header, footer, mobile tab bar, search bar and typeahead, cookie consent, auth side panel, install prompt | P    | none                           | todo   |          |          |        |           |

## Guest booking flows: [`modules/02-guest-booking-flows.md`](./modules/02-guest-booking-flows.md)

| ID     | Route                                                               | Arch | Guide (§)                                        | Status | Elements | Findings | Record | By / date |
| ------ | ------------------------------------------------------------------- | ---- | ------------------------------------------------ | ------ | -------- | -------- | ------ | --------- |
| GST-01 | `/properties/:propertySlug/calendar`                                | G    | `calendar.md` (8)                                | todo   |          |          |        |           |
| GST-02 | `/properties/:propertySlug/form` (every step)                       | G    | `form.md` (12)                                   | todo   |          |          |        |           |
| GST-03 | `/properties/:propertySlug/success`                                 | G    | `success.md` (9)                                 | todo   |          |          |        |           |
| GST-04 | `/properties/:propertySlug/trip`                                    | G    | `trip.md` (15)                                   | todo   |          |          |        |           |
| GST-05 | `/properties/:propertySlug/stay-guide`                              | G    | `stay-guide.md` (9)                              | todo   |          |          |        |           |
| GST-06 | `/properties/:propertySlug/document`                                | G    | `guest-booking-document.md` (8)                  | todo   |          |          |        |           |
| GST-07 | `/properties/:propertySlug/sd-form`                                 | G    | `sd-form.md` (13)                                | todo   |          |          |        |           |
| GST-08 | `/properties/:propertySlug/guest-review`                            | G    | `account/reviews.md` / `org/property/reviews.md` | todo   |          |          |        |           |
| GST-09 | `/properties/:propertySlug/messages` (web chat, voice receptionist) | X    | `properties/chat.md` (12)                        | todo   |          |          |        |           |
| GST-10 | `/properties/:propertySlug/parking/:bookingId` (pay parking)        | X    | `bookings/parking.md` (7)                        | todo   |          |          |        |           |
| GST-11 | `/parkings/:parkingSlug/form`                                       | G    | `parkings.md` (12)                               | todo   |          |          |        |           |
| GST-12 | `/parkings/requests/:bookingId`                                     | G    | `parkings.md` (12)                               | todo   |          |          |        |           |
| GST-13 | `/verify/:sessionToken` (identity capture)                          | G    | `verify.md` (7)                                  | todo   |          |          |        |           |

## Guest account: [`modules/03-guest-account.md`](./modules/03-guest-account.md)

| ID     | Route                | Arch | Guide (§)                  | Status | Elements | Findings | Record | By / date |
| ------ | -------------------- | ---- | -------------------------- | ------ | -------- | -------- | ------ | --------- |
| ACC-01 | `/account`           | DR   | `account/index.md` (7)     | todo   |          |          |        |           |
| ACC-02 | `/account/profile`   | DW   | `account/profile.md` (12)  | todo   |          |          |        |           |
| ACC-03 | `/account/trips`     | DR   | `account/trips.md` (5)     | todo   |          |          |        |           |
| ACC-04 | `/account/messages`  | X    | `account/messages.md` (8)  | todo   |          |          |        |           |
| ACC-05 | `/account/vouchers`  | DW   | `account/vouchers.md` (8)  | todo   |          |          |        |           |
| ACC-06 | `/account/reviews`   | DW   | `account/reviews.md` (8)   | todo   |          |          |        |           |
| ACC-07 | `/account/favorites` | DW   | `account/favorites.md` (7) | todo   |          |          |        |           |
| ACC-08 | `/account/tickets/*` | DW   | `account/tickets.md` (7)   | todo   |          |          |        |           |
| ACC-09 | `/account/help`      | S    | `account/help.md` (7)      | todo   |          |          |        |           |

## Auth and onboarding: [`modules/04-auth-onboarding.md`](./modules/04-auth-onboarding.md)

| ID      | Route                                                                                              | Arch | Guide (§)                       | Status | Elements | Findings | Record | By / date |
| ------- | -------------------------------------------------------------------------------------------------- | ---- | ------------------------------- | ------ | -------- | -------- | ------ | --------- |
| AUTH-01 | `/for-hosts/login`                                                                                 | G    | `auth.md` (8), `sign-in.md` (8) | todo   |          |          |        |           |
| AUTH-02 | `/for-hosts/register`                                                                              | G    | `auth.md` (8)                   | todo   |          |          |        |           |
| AUTH-03 | `/for-guests/login`                                                                                | G    | `auth.md` (8)                   | todo   |          |          |        |           |
| AUTH-04 | `/for-guests/register`                                                                             | G    | `auth.md` (8)                   | todo   |          |          |        |           |
| AUTH-05 | `/onboarding`                                                                                      | DW   | `onboarding.md` (11)            | todo   |          |          |        |           |
| AUTH-06 | `/verification-rejected`                                                                           | DR   | `onboarding.md` (11)            | todo   |          |          |        |           |
| AUTH-07 | `/accept-invite`                                                                                   | G    | `accept-invite.md` (10)         | todo   |          |          |        |           |
| AUTH-08 | `/org` (org selector)                                                                              | DR   | `org/selector.md` (9)           | todo   |          |          |        |           |
| AUTH-09 | Route guards and session behavior across shells (signed-out, wrong identity, expired, step-up OTP) | DR   | `auth.md`                       | todo   |          |          |        |           |

## Org hub: [`modules/05-org-hub.md`](./modules/05-org-hub.md)

| ID     | Route                                                                                                                                          | Arch | Guide (§)                  | Status | Elements | Findings | Record | By / date |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- | ------ | -------- | -------- | ------ | --------- |
| ORG-01 | `/org/:orgSlug/dashboard`                                                                                                                      | DR   | `org/dashboard.md` (16)    | todo   |          |          |        |           |
| ORG-02 | `/org/:orgSlug/bookings`                                                                                                                       | DR   | `org/bookings.md` (7)      | todo   |          |          |        |           |
| ORG-03 | `/org/:orgSlug/properties` (list, create, lifecycle actions)                                                                                   | DW   | `org/properties.md` (15)   | todo   |          |          |        |           |
| ORG-04 | `/org/:orgSlug/parkings`                                                                                                                       | DW   | `org/parkings.md` (6)      | todo   |          |          |        |           |
| ORG-05 | `/org/:orgSlug/team`                                                                                                                           | DW   | `org/team.md` (15)         | todo   |          |          |        |           |
| ORG-06 | `/org/:orgSlug/plans` (and checkout)                                                                                                           | X    | `org/plans.md` (9)         | todo   |          |          |        |           |
| ORG-07 | `/org/:orgSlug/settings`                                                                                                                       | DW   | `org/settings.md` (9)      | todo   |          |          |        |           |
| ORG-08 | `/org/:orgSlug/analytics`                                                                                                                      | DR   | `org/analytics.md` (9)     | todo   |          |          |        |           |
| ORG-09 | `/org/:orgSlug/activity`                                                                                                                       | DR   | `org/activity.md` (8)      | todo   |          |          |        |           |
| ORG-10 | `/org/:orgSlug/reviews`                                                                                                                        | DW   | `org/reviews.md` (13)      | todo   |          |          |        |           |
| ORG-11 | `/org/:orgSlug/announcements`, `…/:announcementId`                                                                                             | DR   | `org/announcements.md` (6) | todo   |          |          |        |           |
| ORG-12 | `/org/:orgSlug/help-support` (overview, `docs`, `tickets/*`)                                                                                   | DW   | `org/help-support.md` (7)  | todo   |          |          |        |           |
| ORG-13 | `/org/:orgSlug/inbox` (redirect)                                                                                                               | R    | `org/inbox.md` (1)         | todo   |          |          |        |           |
| ORG-14 | AI mode, all three levels (`?mode=ai`, `?chat=`, canvas)                                                                                       | X    | `org/assistant.md` (13)    | todo   |          |          |        |           |
| ORG-15 | Setup Guide overlay                                                                                                                            | DW   | `org/setup-guide.md` (7)   | todo   |          |          |        |           |
| ORG-16 | Dashboard shell: sidebar, scope switcher, mobile tab bar and More, header, command and shortcut keys, notification bell, account menu, banners | DR   | none                       | todo   |          |          |        |           |

## Property dashboard: modules [`06`](./modules/06-property-bookings-workflow.md), [`07`](./modules/07-property-money.md), [`08`](./modules/08-property-comms.md), [`09`](./modules/09-property-growth-and-config.md)

Base: `/org/:orgSlug/property/:propertySlug`

| ID      | Route                                                                                     | Arch | Guide (§)                                                        | Module | Status | Elements | Findings | Record | By / date |
| ------- | ----------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- | ------ | ------ | -------- | -------- | ------ | --------- |
| PROP-01 | index (dashboard)                                                                         | DR   | `org/property/dashboard.md` (14)                                 | 06     | todo   |          |          |        |           |
| PROP-02 | `bookings` (table, filters, import, new booking)                                          | DW   | `org/property/bookings.md` (14)                                  | 06     | todo   |          |          |        |           |
| PROP-03 | `bookings/:bookingId`                                                                     | WF   | `org/property/bookings-detail.md` (16)                           | 06     | todo   |          |          |        |           |
| PROP-04 | `finance`                                                                                 | DW   | `org/property/finance.md` (13)                                   | 07     | todo   |          |          |        |           |
| PROP-05 | `pricing` (rules, calendar, smart pricing, sync)                                          | DW   | `org/property/pricing.md` (12), `calendar.md` (1)                | 07     | todo   |          |          |        |           |
| PROP-06 | Vouchers surfaces (settings, booking detail pricing)                                      | DW   | `account/vouchers.md`, settings                                  | 07     | todo   |          |          |        |           |
| PROP-07 | `inbox`                                                                                   | X    | `org/property/inbox.md` (9)                                      | 08     | todo   |          |          |        |           |
| PROP-08 | `notifications` (activity, push, Telegram, staff, operations)                             | X    | `org/property/notifications.md` (8), `staff.md`, `operations.md` | 08     | todo   |          |          |        |           |
| PROP-09 | `templates`                                                                               | DW   | `org/property/templates.md` (14)                                 | 08     | todo   |          |          |        |           |
| PROP-10 | `marketing` (calendar, design editor, video editor, AI studio, library, publish)          | X    | `org/property/marketing.md` (7)                                  | 09     | todo   |          |          |        |           |
| PROP-11 | `public-pages`, `public-pages/:pageId/edit`                                               | DW   | `org/property/public-pages.md` (10), `custom-pages.md`           | 09     | todo   |          |          |        |           |
| PROP-12 | `settings` (30 sections; one sub-record per section group)                                | DW   | `org/property/settings.md` (30)                                  | 09     | todo   |          |          |        |           |
| PROP-13 | `team`                                                                                    | DW   | `org/property/team.md` (11)                                      | 09     | todo   |          |          |        |           |
| PROP-14 | `maintenance`                                                                             | DW   | `org/property/maintenance.md` (9)                                | 09     | todo   |          |          |        |           |
| PROP-15 | `reviews`                                                                                 | DW   | `org/property/reviews.md` (14)                                   | 09     | todo   |          |          |        |           |
| PROP-16 | `analytics`                                                                               | DR   | `org/property/analytics.md` (6)                                  | 09     | todo   |          |          |        |           |
| PROP-17 | `activity`                                                                                | DR   | `org/property/activity.md` (5)                                   | 09     | todo   |          |          |        |           |
| PROP-18 | `announcements`, `…/:announcementId`                                                      | DR   | `org/property/announcements.md` (9)                              | 09     | todo   |          |          |        |           |
| PROP-19 | `help-support` (overview, `docs`, `tickets/*`)                                            | DW   | `org/property/help-support.md` (13)                              | 09     | todo   |          |          |        |           |
| PROP-20 | Redirects: `plans`, `calendar`, `pricing/calendar`, `custom-pages`, `staff`, `operations` | R    | respective guides                                                | 09     | todo   |          |          |        |           |

## Parking dashboard: [`modules/10-parking.md`](./modules/10-parking.md)

Base: `/org/:orgSlug/parking/:parkingSlug`

| ID      | Route                 | Arch | Guide (§)                          | Status | Elements | Findings | Record | By / date |
| ------- | --------------------- | ---- | ---------------------------------- | ------ | -------- | -------- | ------ | --------- |
| PARK-01 | index (dashboard)     | DR   | `org/parking/dashboard.md` (5)     | todo   |          |          |        |           |
| PARK-02 | `bookings`            | DW   | `org/parking/bookings.md` (7)      | todo   |          |          |        |           |
| PARK-03 | `bookings/:bookingId` | WF   | `org/parking/bookings.md` (7)      | todo   |          |          |        |           |
| PARK-04 | `finance`             | DW   | `org/parking/finance.md` (8)       | todo   |          |          |        |           |
| PARK-05 | `pricing`             | DW   | `org/parking/pricing.md` (7)       | todo   |          |          |        |           |
| PARK-06 | `inbox`               | X    | `org/parking/inbox.md` (8)         | todo   |          |          |        |           |
| PARK-07 | `notifications`       | X    | `org/parking/notifications.md` (9) | todo   |          |          |        |           |
| PARK-08 | `settings`            | DW   | `org/parking/settings.md` (9)      | todo   |          |          |        |           |
| PARK-09 | `team`                | DW   | `org/parking/team.md` (8)          | todo   |          |          |        |           |
| PARK-10 | `activity`            | DR   | `org/parking/activity.md` (5)      | todo   |          |          |        |           |
| PARK-11 | `announcements`       | DR   | `org/parking/announcements.md` (4) | todo   |          |          |        |           |
| PARK-12 | `help-support`        | DW   | `org/parking/help-support.md` (7)  | todo   |          |          |        |           |

## Super-admin: [`modules/11-super-admin.md`](./modules/11-super-admin.md)

Base: `/admin`. Exercised on L only; viewed on P.

| ID     | Route                                                                                            | Arch | Guide (§)                                                       | Status | Elements | Findings | Record | By / date |
| ------ | ------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------- | ------ | -------- | -------- | ------ | --------- |
| ADM-01 | index (overview)                                                                                 | SA   | `admin/overview.md` (9)                                         | todo   |          |          |        |           |
| ADM-02 | `hosts`                                                                                          | SA   | `admin/hosts.md` (12)                                           | todo   |          |          |        |           |
| ADM-03 | `hosts/:hostId`                                                                                  | SA   | `admin/host-detail.md` (9)                                      | todo   |          |          |        |           |
| ADM-04 | `orgs`                                                                                           | SA   | `admin/orgs.md` (9)                                             | todo   |          |          |        |           |
| ADM-05 | `orgs/:orgSlug` (hub, properties, subscriptions)                                                 | SA   | `admin/org-properties.md` (1), `admin/org-subscriptions.md` (7) | todo   |          |          |        |           |
| ADM-06 | `properties` (platform)                                                                          | SA   | `admin/platform-properties.md` (11)                             | todo   |          |          |        |           |
| ADM-07 | `approvals`                                                                                      | SA   | `admin/approvals.md` (10)                                       | todo   |          |          |        |           |
| ADM-08 | `developments`                                                                                   | SA   | `admin/developments.md` (12)                                    | todo   |          |          |        |           |
| ADM-09 | `developments/:developmentSlug`                                                                  | SA   | `admin/development-detail.md` (20)                              | todo   |          |          |        |           |
| ADM-10 | `support`, `support/faqs`                                                                        | SA   | `admin/support.md` (11)                                         | todo   |          |          |        |           |
| ADM-11 | `announcements`                                                                                  | SA   | `admin/announcements.md` (8)                                    | todo   |          |          |        |           |
| ADM-12 | `ai` (controls, usage tabs)                                                                      | SA   | `admin/ai.md` (7), `admin/settings.md` (11)                     | todo   |          |          |        |           |
| ADM-13 | `playbook`                                                                                       | SA   | `admin/playbook.md` (7)                                         | todo   |          |          |        |           |
| ADM-14 | `health`, `health/:section`                                                                      | SA   | `admin/health.md` (6)                                           | todo   |          |          |        |           |
| ADM-15 | `ops-reports`, `ops-reports/:reportId`                                                           | SA   | `admin/ops-reports.md` (8)                                      | todo   |          |          |        |           |
| ADM-16 | `rate-limits`                                                                                    | SA   | `admin/platform-tools.md` (8)                                   | todo   |          |          |        |           |
| ADM-17 | `audit`                                                                                          | SA   | `admin/platform-tools.md` (8)                                   | todo   |          |          |        |           |
| ADM-18 | `platform-settings`                                                                              | SA   | `admin/settings.md` (11)                                        | todo   |          |          |        |           |
| ADM-19 | `feature-availability`                                                                           | SA   | `admin/feature-availability.md` (5)                             | todo   |          |          |        |           |
| ADM-20 | `pricing/plans`                                                                                  | SA   | `admin/pricing-plans.md` (7)                                    | todo   |          |          |        |           |
| ADM-21 | `pricing/payment-settings`                                                                       | SA   | `admin/payment-settings.md` (7)                                 | todo   |          |          |        |           |
| ADM-22 | `pricing/subscriptions`                                                                          | SA   | `admin/org-subscriptions.md` (7)                                | todo   |          |          |        |           |
| ADM-23 | `parking/payouts`                                                                                | SA   | `admin/parking-payouts.md` (8)                                  | todo   |          |          |        |           |
| ADM-24 | Redirects: `settings`, `ai-usage`, `hosts/:hostId/*`, `orgs/:orgSlug/*`; step-up OTP gate; shell | R    | `admin/*`                                                       | todo   |          |          |        |           |

## Redirects and legacy aliases (one table-driven session)

| ID     | Routes                                                                                                                                                                      | Arch | Status | Record |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ | ------ |
| RED-01 | `/sign-in`, `/for-guests/*`                                                                                                                                                 | R    | todo   |        |
| RED-02 | `/dashboard`, `/bookings`, `/bookings/:bookingId`, `/finance`, `/maintenance`, `/notifications`, `/marketing`, `/staff`, `/operations`, `/settings` (`LegacyAdminRedirect`) | R    | todo   |        |
| RED-03 | `/calendar`, `/form`, `/success`, `/guest-review`, `/sd-form`, `/bookings/:bookingId/parking` (legacy guest paths, with and without `?property=`)                           | R    | todo   |        |
| RED-04 | `/account/stays`, `/account/wishlist`, `/account/settings`                                                                                                                  | R    | todo   |        |
| RED-05 | `/developments/:slug/parking/list`, `/for-hosts/preview`                                                                                                                    | R    | todo   |        |
| RED-06 | Old link shapes still present in sent emails, PDFs, QR codes, push payloads and the sitemap                                                                                 | R    | todo   |        |

## Cross-cutting: [`modules/12-cross-cutting.md`](./modules/12-cross-cutting.md)

| ID    | Audit                                                                              | Status | Record |
| ----- | ---------------------------------------------------------------------------------- | ------ | ------ |
| XC-01 | Emails (every template, every trigger)                                             | todo   |        |
| XC-02 | PDFs and documents (both template copies)                                          | todo   |        |
| XC-03 | Crons                                                                              | todo   |        |
| XC-04 | Webhooks (PayMongo, Meta, Resend inbound)                                          | todo   |        |
| XC-05 | PWA, service worker, offline, push                                                 | todo   |        |
| XC-06 | SEO and AI search                                                                  | todo   |        |
| XC-07 | Accessibility sweep                                                                | todo   |        |
| XC-08 | Performance and bundle                                                             | todo   |        |
| XC-09 | Security, tenancy, RLS and storage                                                 | todo   |        |
| XC-10 | Dates, time zones, money formatting                                                | todo   |        |
| XC-11 | AI surfaces (assistant, inbox AI, marketing AI, receipts, smart pricing, voice)    | todo   |        |
| XC-12 | Observability and analytics                                                        | todo   |        |
| XC-13 | Data integrity and derived data                                                    | todo   |        |
| XC-14 | Design system consistency (shared components, modal chrome, tables, forms, toasts) | todo   |        |
| XC-15 | Orphan sweep (Phase 5)                                                             | todo   |        |

## Journeys: [`flow-graph.md`](./flow-graph.md)

| ID         | Status | Free | Business | Unhappy branches | Record                                        |
| ---------- | ------ | ---- | -------- | ---------------- | --------------------------------------------- |
| J01 to J30 | todo   |      |          |                  | one row per journey, added as each is claimed |

## Progress

| Area          | Rows    | Audited | Signed off |
| ------------- | ------- | ------- | ---------- |
| Public        | 23      | 0       | 0          |
| Guest flows   | 13      | 0       | 0          |
| Guest account | 9       | 0       | 0          |
| Auth          | 9       | 0       | 0          |
| Org           | 16      | 0       | 0          |
| Property      | 20      | 0       | 0          |
| Parking       | 12      | 0       | 0          |
| Super-admin   | 24      | 0       | 0          |
| Redirects     | 6       | 0       | 0          |
| Cross-cutting | 15      | 0       | 0          |
| Journeys      | 30      | 0       | 0          |
| **Total**     | **177** | **0**   | **0**      |
