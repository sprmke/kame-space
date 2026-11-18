---
title: 'Tasks To Do'
status: active
tags: [planning, intake, backlog]
updated: 2026-11-19
stage: intake
kind: backlog
---

**Status legend:** ❌ cancelled / won't do · ✅ done · 🧪 for testing · 📋 planned (plan doc written) · 🚧 in progress · 🔵 pending / open

## Priority todos

- ✅ **Migration from the legacy prod app to the new app**
  Data, storage, auth, domains, email and repo are on the new stack. Closed 2026-11-03.
  → **Done:** [`../done/kamespace-02-legacy-prod-to-mt-prod-cutover.md`](../done/kamespace-02-legacy-prod-to-mt-prod-cutover.md)
- ✅ **Rename Kame Homes to Kame Space**
  Every label, text, env value, email template and third-party surface uses Kame Space. Guard green in CI.
  → **Done:** [`../done/kamespace-03-rebrand-kame-homes-to-kame-space.md`](../done/kamespace-03-rebrand-kame-homes-to-kame-space.md)
- ✅ **Move domain to kamespace.com**
  DNS, Vercel, Resend, DMARC, Supabase Auth, Turnstile, Meta, PostHog, Sentry, PayMongo and Google Business verified.
  → **Done:** [`../done/kamespace-04-domain-move-kamespace-com.md`](../done/kamespace-04-domain-move-kamespace-com.md)
- ✅ **Get Google services approval**
  Brand verification approved and published 2026-11-03. Remaining hardening is post-launch.
  → **Done:** [`../done/kamespace-05-google-services-verification.md`](../done/kamespace-05-google-services-verification.md) · hardening: [`../in-progress/google-services-production-hardening.md`](../in-progress/google-services-production-hardening.md)
- 🔵 **Get PayMongo approval**
  Business account approval and split payouts are still with PayMongo. Billing is built and sandbox-verified; the webhook and key configuration for go-live is PR-097.

## Pre-release items

- ✅ Update property settings and photos.
- ✅ iCal sync to Airbnb
  → **Done:** [`../done/airbnb-calendar-sync.md`](../done/airbnb-calendar-sync.md)
- 🚧 Live identity verification to simplify real identity checks
  → **In progress:** [`../in-progress/live-identity-verification.md`](../in-progress/live-identity-verification.md)
- 🚧 Booking detail: email sent history, quick resend, and view sent email content.
- 🚧 Cleanup tasks
  - ✅ Cleanup unused settings and email templates related to Parking.
  - ✅ Clean up unused env variables. → **Done:** [`../done/env-variables-cleanup.md`](../done/env-variables-cleanup.md)
  - ✅ Store env variables and keep a current backup per environment. → `bun run env:backup`
  - ✅ Update and clean CI/CD after the legacy to multi-tenant migration. → **Done:** [`../done/ci-cd-environments/README.md`](../done/ci-cd-environments/README.md)
  - 🚧 List every third-party service. Add monitoring and alerts for errors, plus cost and limit tracking. → **In progress:** [`../in-progress/super-admin-system-health.md`](../in-progress/super-admin-system-health.md) · cost limits: [`../planned/super-admin-service-cost-monitoring.md`](../planned/super-admin-service-cost-monitoring.md)
  - ✅ Able to sync data from hosting to local. → **Done:** `bun run sync:prod-data` (prod to local only).
- 📋 AI-supported marketing scheduling and strategy
  → **Planned:** [`../planned/marketing-meta-publishing-gaps.md`](../planned/marketing-meta-publishing-gaps.md)
- 🚧 Refine the archive and delete property flow.
  → **In progress:** [`../in-progress/property-archive-and-delete-lifecycle.md`](../in-progress/property-archive-and-delete-lifecycle.md) — P0 shipped; P1–P7 remain.
- 🚧 Refine cancellation policy settings and the overall cancellation process.
  → **In progress:** [`../in-progress/cancellation-policy-and-process.md`](../in-progress/cancellation-policy-and-process.md)
- ✅ On/off dashboard pages, sections, features or buttons from super admin, with a visible reason
  → **Done:** [`../done/feature-availability-controls.md`](../done/feature-availability-controls.md) · QA: [`../for-testing/feature-availability-controls.md`](../for-testing/feature-availability-controls.md)
- ✅ Improve and refine default amenities and house rules
- 🚧 Refine and improve cancellation policy options
  → **In progress:** [`../in-progress/cancellation-policy-and-process.md`](../in-progress/cancellation-policy-and-process.md)
- ✅ Fix issue where google map is not rendering properly on both dashboard and public page
- ✅ Display warning message if user refresh the page when editing on a page (ex. Settings). Right now, we only display the default browser warning and not our custom popup modal warning
- ✅ Cleanup usages of "—" on email templates and across the app. If we need to use it, then please ensure that we use the normal "-". But please analyze carefully if it's good UX to use - at all. Then make sure to apply all usages across the entire app that it's still using it. From UI, email templates and other locations that we are using it from our app.
- 📋 Refine templates
  → **Planned:** [`../planned/property-templates-defaults-overhaul.md`](../planned/property-templates-defaults-overhaul.md)
- ✅ Improve activity modal from settings to be the same modal size or I think it's better if we have navigation here to view the activity detail and we can back to it instead of opening it on a new modal
- ✅ Fix super admin UI issue on this: https://kamespace.com/admin/orgs/kame-homes
- ✅ Why stay guide and showcase public page editor is not loading at all (root cause: `public-page-configs` edge function boot error from a duplicate `const row`; also added error states so a failed config no longer leaves the skeleton up forever)
- ✅ Why "Save Changes" button on settings page is showing when we have new changes but disabled
- ✅ Improve marketing landing page to not use dynamic image on "What do you want to make?" and have our fixed static assets. Also please address and remove the accent color that looks ugly specially on dark mode
- ✅ Require OTP when we save any changes from Templates page/module
- 🔵 Refine and further improve the marketing default generated marketing materials/examples/templates. They all look very ugly!
- 🔵 Refine landing page
- ✅ Optional Resend hygiene: send From a dedicated subdomain (e.g. `notify.kamespace.com`) instead of apex `mail@kamespace.com`. Requires new Resend domain + DNS, then `RESEND_FROM_EMAIL` flip (`kamewave`). Image-hosting insight is already fixed in code via CID inlining (`sendResendEmail`).
- ✅ Refine mascot
- 📋 Airbnb conflict
  → **Planned:** [`../planned/calendar-sync-conflict-resolution.md`](../planned/calendar-sync-conflict-resolution.md)
- 🚧 Improve quick access on bottom part of the screen to include (Notifications, chat, dark/light switch, AI assistant)
  → **In progress:** [`../in-progress/mobile-app-chrome-header-and-tab-bar.md`](../in-progress/mobile-app-chrome-header-and-tab-bar.md) — notifications moved to the top-bar bell
- 🔵 Needs manual reload for webapp?
- 🚧 Improve performance, slow queries, lighthouse, before & after
  → **In progress:** [`../in-progress/app-speed-root-cause-overhaul.md`](../in-progress/app-speed-root-cause-overhaul.md)
- ✅ Refine Channel sync modal (From/To progressive empty states + feed card) (UI-36)
- 🔵 Inbox refinement
- 📋 Refine email templates, refine flows/events or actions that we need to send email
  → **Planned:** [`../planned/property-templates-defaults-overhaul.md`](../planned/property-templates-defaults-overhaul.md)
- ❌ Reposition light/dark switch
  → **Won't do:** [`../wont-do/dashboard-top-header-bar.md`](../wont-do/dashboard-top-header-bar.md) — profile, theme toggle and mode switch stay in the sidebar footer
- 🔵 Improve paid/pro subscription badge/flow
- 🔵 Control for auto transition to ready for check-in status?
- 🔵 Refine edit booking detail page
- 🚧 App performance improvements and make the app very fast on both desktop and pwa
  → **In progress:** [`../in-progress/app-speed-root-cause-overhaul.md`](../in-progress/app-speed-root-cause-overhaul.md)
- 🚧 Improve backend performance
  → **In progress:** [`../in-progress/app-speed-root-cause-overhaul.md`](../in-progress/app-speed-root-cause-overhaul.md) · capacity: [`../in-progress/supabase-capacity-and-operational-readiness.md`](../in-progress/supabase-capacity-and-operational-readiness.md)
- 🔵 Toolchain upgrade wave: TypeScript 7, Tailwind 4, Zod 4, @hookform/resolvers 7, @types/node 26, @vitest/coverage-v8 5, eslint-plugin-react-hooks 7, @blueprintjs/core 6, framer-motion 14. Each needs a code migration, not a version bump, so the Dependabot majors are closed until it is planned.
- ✅ Pricing plans refinement
  → **Done 2026-11-19:** [`../done/plans-billing-lifecycle-hardening.md`](../done/plans-billing-lifecycle-hardening.md)
- ✅ Payment e2e and management from super admin
  → **Done 2026-11-19:** [`../done/plans-billing-lifecycle-hardening.md`](../done/plans-billing-lifecycle-hardening.md) (sandbox matrix passed, super-admin billing panel shipped)
- 🔵 Billing follow-ups from the lifecycle plan
  Confirm with the accountant whether BIR official receipts or VAT are needed. Confirm the product defaults D5 (suspension behaves like Free) and D6 (auto-cover with a prorated true-up). PayMongo go-live configuration is PR-097 and the deploy flake is PR-098 in [`../in-progress/production-readiness/LEDGER.md`](../in-progress/production-readiness/LEDGER.md).
- 🔵 Improve QR design to include our logo?
- 🔵 Select turtle character and add it on their templates
- 🔵 Super admin - playbook articles?
- 🚧 Super admin -> System health warnings & errors
  → **In progress:** [`../in-progress/super-admin-system-health.md`](../in-progress/super-admin-system-health.md)
- 📋 AI usage, estimates, cost and profits? Implement buy more credits
  → **Planned:** [`../planned/ai-credits-topup-purchase.md`](../planned/ai-credits-topup-purchase.md) · provider and quotas: [`../planned/ai-paid-provider-and-production-quotas.md`](../planned/ai-paid-provider-and-production-quotas.md)
- 📋 Refine super admin pages, sections, etc
  → **Planned:** [`../planned/super-admin-console-followups.md`](../planned/super-admin-console-followups.md)
- 🔵 Make sure updated with new changes and features that we have
  - Subscriptions tier & validation
  - Team access
  - Updated tests (unit, e2e, integration)
  - Updated guide docs for support Q/A and guides
- UI Improvements:
  - **Conflict sheet (claim before touch):** [`ui-improvements-worksheet.md`](./ui-improvements-worksheet.md)
  - ✅ Improve cookies/analytics banner to look more good
  - ✅ ~~Check if we still need to display Kame Space updates, version on clear offline data on Help & Support page?~~ Done: removed from Help; “On this device” on Profile
  - ✅ ~~Fix secondary menu issue on settings~~ Done: idle section-nav items match Card (no gray pill fill)
  - ✅ Improve coming soon, 404 with our new mascot (UI-05) → [`mascot-empty-states-design.md`](../done/mascot-empty-states-design.md)
  - ✅ Notifications UX: Manage-only push card; Activity/Telegram empty + off status panels (UI-29)
  - ✅ Org Bookings: New booking with property/parking picker (UI-30)
  - ✅ Toolbar filter dropdowns: left-align + width vs trigger (UI-31)
  - ✅ Org Analytics listings density + readable metrics / grid (UI-18)
  - ✅ Help FAQ home: category grid only, even tile rows (UI-32)
  - ✅ Settings section nav keeps active row in view (UI-33)
  - ✅ Guest experience summary + Manage modal (UI-34)
  - ✅ Search preview section + SERP redesign (UI-35)
  - ✅ Channel sync Recent activity + modal UX (UI-36)
  - ✅ Landing hero blur / soft photo (UI-01) - verified sharp hero + soft scrims
  - ✅ Landing search toolbar click UX (UI-02)
  - ✅ Landing list section skeleton (UI-03)
  - ✅ Footer: move Install + copyright into content; drop strip (UI-04)
  - ✅ Plan modal UX (Upgrade/Downgrade titles, direction strip) (UI-06)
  - ✅ Airbnb sync conflicts → Needs attention / Notifications click (UI-08)
  - ✅ Bookings list: chat icon + quick actions (UI-09)
  - ✅ Kanban booking click broken UI (UI-10)
  - ✅ Bookings initial load list swap (UI-11)
  - ✅ Table/list action buttons (UI-12) - Finance stay details icon
  - ✅ Edit transaction modal: disable until valid (UI-13)
  - ✅ Finance SD estimate copy (UI-14)
  - ✅ Export PDF Finance / Maintenance UX (UI-15)
  - ✅ Pricing increment 1→100 (UI-16)
  - ✅ Analytics Playbook UI (UI-17)
  - ✅ Marketing AI Studio skeleton layout jump (UI-19)
  - ✅ Inbox: remove Not connected badge (UI-20)
  - ✅ AI import bookings: drop allowed-use line (UI-21)
  - ✅ Download template: rephrase “No manual updates…” (UI-22)
  - 📋 Condo-default templates refine (UI-23)
    → **Planned:** [`../planned/property-templates-defaults-overhaul.md`](../planned/property-templates-defaults-overhaul.md)
  - 🔵 Privacy / legal tech disclosure (UI-24 · blocked by `legal-and-privacy-coverage`)
  - ✅ Guest tickets + dashboard support skeletons (UI-25)
  - ✅ Guest account help UX (UI-26)
  - ✅ Reviews → By Property tab (UI-27)
  - 🔵 Update default pricing (UI-28 · needs product input)
  - 🔵 Channel Sync helper → How it works modal (UI-07 · coord `dashboard-contextual-help`)
  - **Review notes:** [`ui-improvements-backlog-cleanup-review.md`](./ui-improvements-backlog-cleanup-review.md)

## Post-release items

- 🔵 Add short helpful info for sections and features that need it (start with External Reviews).
- 🧪 Add templates (not email) to chat boxes across the app (AI assistant, Inbox)
  → **For testing:** [`../for-testing/chat-templates.md`](../for-testing/chat-templates.md)
- 🧪 Support content refresh + docs → FAQ sync
  → **For testing:** [`../for-testing/support-content-and-faq-sync.md`](../for-testing/support-content-and-faq-sync.md)
- 🧪 Booking detail activity log coverage
  → **For testing:** [`../for-testing/booking-detail-activity-log.md`](../for-testing/booking-detail-activity-log.md)
- 🧪 Public pages native element sizing
  → **For testing:** [`../for-testing/public-native-density.md`](../for-testing/public-native-density.md)
- 🚧 AI Studio example photos and clips
  → **In progress:** [`../in-progress/ai-studio-sample-assets.md`](../in-progress/ai-studio-sample-assets.md)
- 🚧 Dashboard contextual help
  → **In progress:** [`../in-progress/dashboard-contextual-help.md`](../in-progress/dashboard-contextual-help.md)
- 🚧 Mobile app chrome: header and tab bar
  → **In progress:** [`../in-progress/mobile-app-chrome-header-and-tab-bar.md`](../in-progress/mobile-app-chrome-header-and-tab-bar.md)
- 🚧 Notifications page restructure
  → **In progress:** [`../in-progress/notifications-page-restructure.md`](../in-progress/notifications-page-restructure.md)
- 🚧 Telegram delivery control + sent-message history
  → **In progress:** [`../in-progress/telegram-delivery-and-history.md`](../in-progress/telegram-delivery-and-history.md)
- 🚧 Settings cleanup and clarity
  → **In progress:** [`../in-progress/settings-cleanup-and-clarity.md`](../in-progress/settings-cleanup-and-clarity.md)
- 🚧 Weekly operations report
  → **In progress:** [`../in-progress/weekly-ops-report.md`](../in-progress/weekly-ops-report.md)
- 🔵 Make table action columns consistent across pages (for example Maintenance).
- 🔵 Add a timeline view similar to Kame-Lends (Bookings, Finance, Maintenance).
- 🔵 Add a calendar or custom view to spot overlapping bookings and check the minimum cleaning window.
- 🔵 Refine public pages, their copy and open actions.
- 🔵 Refine the Reviews page.
- ✅ Returning to the dashboard opens the last visited listing at the correct level (org, property or parking).
- ✅ Use Sentry for error monitoring and PostHog for analytics
  → **Done:** [`../done/observability-sentry-posthog-split/README.md`](../done/observability-sentry-posthog-split/README.md)

Back to [intake index](./README.md).
