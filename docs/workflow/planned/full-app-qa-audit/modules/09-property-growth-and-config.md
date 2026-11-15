---
title: 'QA packet 09: marketing, public pages, settings, team and the remaining property modules'
status: planned
stage: planned
kind: reference
tags: [qa, audit, property, settings, marketing, team]
updated: 2026-11-13
---

# 09 Marketing, public pages, settings, team, maintenance, reviews, analytics, activity, announcements, help

**Rows:** PROP-10 to PROP-20 · **Personas:** `owner`, `org-admin`, `operations`, `viewer`, `custom`, `stranger` · **Tiers:** Free, Pro (`marketingStudio`, `publicPagesAutosave`, `propertyShowcase`), Business (`aiMarketingGeneration`) · **Environments:** L; P test tenant for viewing and reversible settings edits.

## References

Guides: `org/property/marketing.md`, `public-pages.md`, `custom-pages.md`, `settings.md`, `team.md`, `maintenance.md`, `reviews.md`, `analytics.md`, `activity.md`, `announcements.md`, `help-support.md`. Architecture: `marketing-poster-studio.md`, `marketing-themes.md`, `marketing-video-editor.md`, `unsaved-changes.md`, `storage.md`, `contextual-help.md`. Manual guides: `custom-pages-module-manual.md`, `reviews-manual.md`, `dashboard-modules-playwright.md`, `property-team-rbac-playwright.md`, `image-upload-optimization-manual.md`. Skills: `social-creative`, `unsaved-changes-guard`, `plans-and-permissions`, `audit-logging`. Specs: `ui/e2e/features/marketing` (8), `team` (3), `reviews` (3), `dashboard` (8), `feature-availability` (2). Earlier QA: `06` to `08`, `12`, `14`, `15`, `20`, `21`. Many `for-testing` and in-progress marketing plans; list them in Stage 1.

## Probe beyond the generic lenses

**Marketing studio (PROP-10)**: several sessions; one sub-record per surface.

- Workspace and library: folders, search, filters, select, delete, storage quota and retention.
- Content calendar: create, schedule, drag, edit, delete.
- Design editor (Polotno): open, every tool, templates and themes, undo and redo, export PNG, save, reopen, unsaved-changes guard, very large canvas, phone editing.
- Collage editor and video editor (Remotion, multitrack): tracks, trim, export, render failure, long render.
- AI studio and poster studio: prompt, reference uploads, sessions, regenerate, quality, credit metering and exhaustion, provider outage, unsafe prompt handling, sample assets.
- Publish to Meta (mocked): no channel connected state links to Inbox channels, publish limit per tier, scheduled publish (the cron is a known planned gap; confirm current behavior and that the UI does not promise it).
- Telegram marketing legacy module: still reachable? If dead, file it.
- Performance: the editor chunk must not load on other pages; a static import of Konva or OpenPolotno outside the editors breaks the PWA precache budget.

**Public pages (PROP-11)**: list, create, templates, block editing, reorder, media, autosave (plan gate) vs manual save, publish and unpublish, preview, slug rules, the stay guide template, custom page URLs live on the public site with correct SEO tags (C11). Redirect from `custom-pages`.

**Settings (PROP-12)**: 30 sections; group into about six sub-records.

- For **every** section (Listing status, Basic Information, Property Details, Photos and Videos, Description, Amenities, House Rules, Guest experience, Guest Form, Cancellation policy, Location, Socials, Reviews and vouchers, Payment, Building Forms, Email automations, Integrations, AI features, Activity, Listing status and delete): each field's validation, the save path, the unsaved-changes guard, the `activity_log` event, the permission leaf, and **the consumer** where the value takes effect (C10). A setting with no consumer is a finding; so is a consumer that reads a stale or cached value.
- Setup completeness reflects reality and its links jump to the right section.
- Photos and videos: upload, reorder, cover, delete, optimization, limits; reflected on the listing.
- Payment section: OTP step-up, masking, what guests see.
- Guest Form section: toggling fields changes the public form and its validation on both client and server.
- Cancellation policy: reflected on listing, trip page, refund math.
- Integrations: Google Calendar and Sheets connect, disconnect, revoked token.
- AI features card: toggle only; limits are not host-editable.
- Listing status and delete: publish requirements, pause, archive, delete with confirmation and consequences (C12), in-progress lifecycle plan.
- Copy to properties from org level lands the right sections here.
- Shared validation modules: client and server use the same rules.

**Team (PROP-13)**: invite, roles and templates (Full Access, Operations, Read Only), custom role editor leaf by leaf, manage member, remove, seat limits, property team vs org team precedence when a person has both (C15). Build the leaf matrix for K11 here.

**Maintenance (PROP-14)**: task CRUD, status flow, assignment, photos, recurring tasks if any, filters, notifications and Telegram cron (C23).

**Reviews (PROP-15)**: list, filters, reply, two-way review, moderation and report, publish timing, superhost signals, public display (C07).

**Analytics (PROP-16)**: every chart and metric recomputed for a range; page-view tracking source; AI review playbook; exports; plan gate.

**Activity (PROP-17)**: every event from this property across all modules; filters; pagination; member scope.

**Announcements (PROP-18), Help and support (PROP-19)**: as org level, verified at property scope; docs content equals the route guides synced by `sync-ai-knowledge-base`; tickets workspace.

**Redirects (PROP-20)**: each lands correctly with query preserved, for each role.

## Hidden surfaces

`marketing-*`, `generate-marketing-template`, `publish-*`, `custom-*`, `property-*`, `upload-*`, `settings-*`, `copy-*`, `maintenance-*`, `review-*`, `moderate-*`, `analytics-*`, `activity-*`, storage buckets for media and marketing references, `telegram-marketing-cron`, `telegram-maintenance-cron`, `review-lifecycle-cron`, `property-page-views-prune-cron`, AI gateway.

## Connections and journeys

Source of C10, C11, C12, C15, C23, C26; reader of C07, C18, C20, C36. J11, J12, J13, J18, J21, J22.

## Known risks

- Settings is the widest fan-out page in the product; J11 exists to trace all of it.
- Marketing studio has the most in-flight work (the working tree at plan time had uncommitted marketing changes). Pin the SHA carefully and expect drift re-runs.
- Vitest silently ignores `.test.tsx` under the default project; component tests for editors must run under `test:dom`.
