---
title: 'QA packet 06: property dashboard, bookings and workflow'
status: planned
stage: planned
kind: reference
tags: [qa, audit, property, bookings, workflow]
updated: 2026-11-13
---

# 06 Property dashboard, bookings, booking detail

**Rows:** PROP-01 to PROP-03 · **Personas:** `owner`, `org-admin`, `operations`, `viewer`, `custom` (one booking leaf at a time), `stranger`; paired with `guest-form` in a second context · **Tiers:** Free and Business at minimum · **Environments:** L for the workflow; P test tenant for the empty and read states only (no bookings can exist there).

## References

Guides: `org/property/dashboard.md`, `bookings.md`, `bookings-detail.md`. **Canonical spec:** `.cursor/rules/booking-workflow.mdc`; read it fully first. Code mirrors: `supabase/functions/_shared/statusMachine.ts`, `workflowOrchestrator.ts`, `ui/src/features/dashboard/bookings/lib/workflow.ts`. Architecture: `guest-emails.md`, `integrations.md`. Manual guides: `booking-workflow-playwright.md`, `cancellation-policy-manual.md`, `contract-expiry-lifecycle-manual.md`. Skills: `booking-workflow`, `bookings-table`, `admin-dashboard`, `emails`, `tanstack-table`, `property-dashboard-qa`. Specs: `ui/e2e/features/bookings` (3), `dashboard`, `plans/gates/bookingDetailPlanGates`, `vouchers/host`. Earlier QA: `qa/property-dashboard/01`, `02`, `03`, `17`, `18`. `for-testing`: `booking-detail-activity-log`. In progress: `cancellation-policy-and-process`.

## Probe beyond the generic lenses

**Dashboard (PROP-01)**

- Every card, chart, list and shortcut. Each number recomputed from the bookings and finance data for the range. Each "pending action" opens the exact record.
- Setup completeness and listing status reflect property settings truthfully.
- AI briefing or assistant entry points obey the plan gate.

**Bookings list (PROP-02)**

- Views (table, kanban, any calendar view), stage summary cards (count equals filtered rows), every filter and its query param, search, sort, column visibility, pagination, bulk actions if any, row actions menu.
- New booking modal: every field, overlap rejection, price calculation, what emails fire for a host-created booking versus a guest-created one.
- CSV import wizard (plan gate `bookingImport`): template download, mapping, validation errors per row, duplicates, partial import, undo, very large file, wrong encoding, dates in both formats.
- Kanban drag between stages: allowed transitions only, and each drop runs the same orchestrator path as the detail page buttons.

**Booking detail (PROP-03)**: the deepest page. One sub-record per area.

- **Transition matrix.** Build the full table from `statusMachine.ts`: every status × every action, including legacy nested `PENDING_GAF`, `PENDING_PARKING_REQUEST`, `PENDING_PET_REQUEST` and `CANCELLED`. For each allowed transition verify, per the canonical spec: guards, required inputs, emails (recipient, template, attachments), PDF generation, Google Calendar title and color, sheet row, notifications, `activity_log` event, guest-facing status word on the trip page, and what unlocks for the guest (stay guide, SD form, review). For each disallowed transition verify the server refuses when called directly.
- **Client and server mirror.** Diff `workflow.ts` against `statusMachine.ts` mechanically; any difference is a finding.
- **Idempotency and failure.** Click a transition twice; retry after a simulated email failure; confirm the failed-side-effect state is surfaced to the host and can be retried without duplicating the others.
- **View and edit modes.** Every field editable in which status; edit triggers the update pipeline (C03) and re-issues what it should (calendar, PDF, emails) and nothing it should not. `petType`-only edit is a known miss.
- **Progress panel.** Each checklist item, document upload (GAF, pet, parking), mark complete, AI validation of receipts and documents with its plan gate (`aiValidations`), inbound approval email changing state while the page is open (C05).
- **Money.** Pricing breakdown, down payment, balance, security deposit, voucher discount, refunds; equals finance entries (C22) and what the guest saw.
- **Cancellation and refunds.** Host cancel with each policy outcome, refund recording, `cancellation-refund-cron` and `sd-refund-cron` effects, guest-initiated cancellation arriving while the host has the page open.
- **Pay parking.** Request, link, payment state, linked parking booking (C28).
- **Identity verdict on guest rows.** Display, permissions to see ID images, purge.
- **Activity log panel.** Every action above appears, in order, with actor.
- **Permissions section.** Each leaf: view, edit, transition, cancel, refund, documents, finance fields. `operations` can run the day but sees no finance; `viewer` changes nothing, also via direct calls.
- **Plan gates** on this page per `bookingDetailPlanGates` and the matrix.
- Real-time: a second host session and the guest session see changes.

## Hidden surfaces

`transition-*`, `update-*`, `cancel-booking`, `guest-cancel-booking`, `record-booking-refund`, `approval-email-webhook`, upload functions, `emailService`, `pdfService`, `uploadService`, calendar and sheet services, `calendar-sync-cron`, `contract-expiry-cron`, `review-lifecycle-cron`, notification fan-out, Telegram staff and admin crons, `static_files` config for email templates in `config.toml`.

## Connections and journeys

Source of C02, C03, C04; reader of C01, C05, C06, C27, C28. J01 to J04, J08, J18, J19, J20.

## Known risks

- Side effects must only run through `workflowOrchestrator.transition()`. Grep for email, calendar or sheet calls outside it.
- Missing `static_files` for a template directory throws `ENOENT` only in production. List every email-sending function and confirm its config; this cannot be seen on L.
- Local Google Calendar and Sheets may be `blocked`; then the calendar title and color map is verified at the unit level and listed for an owner-run manual pass.
