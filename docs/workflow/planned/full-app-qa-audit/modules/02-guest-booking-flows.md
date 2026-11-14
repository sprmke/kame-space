---
title: 'QA packet 02: guest booking flows'
status: planned
stage: planned
kind: reference
tags: [qa, audit, guest, booking, forms]
updated: 2026-11-13
---

# 02 Guest booking flows

**Rows:** GST-01 to GST-13 · **Personas:** `guest-form` (anon with link, iPhone Safari first), `guest` (signed in), paired with `owner` in a second context for every chain · **Environments:** L only for writes. P: view the form shell of a real listing without submitting; never submit.

This is the revenue entry point and the first wave. A defect here is P0 by default until shown otherwise.

## References

Guides: `calendar.md`, `form.md`, `success.md`, `trip.md`, `stay-guide.md`, `guest-booking-document.md`, `sd-form.md`, `properties/chat.md`, `bookings/parking.md`, `parkings.md`, `verify.md`. Rules: `booking-workflow.mdc` (canonical). Architecture: `identity-verification.md`, `data-privacy-identity.md`, `guest-emails.md`, `validation-and-env.md`, `storage.md`. Manual guides: `guest-journey-manual.md`, `identity-verification-manual.md`, `image-upload-optimization-manual.md`, `stay-guide-manual.md`, `guest-chat-ai-manual.md`, `voice-receptionist-manual.md`, `cancellation-policy-manual.md`, `voucher-reveal-playwright.md`. Skills: `forms`, `booking-workflow`, `public-ui`, `emails`. Specs: `ui/e2e/features/guest-form` (7), `guest-chat` (1), `vouchers` (7), `parking/guest`. Planned work touching this: `guest-form-saved-progress-and-submit-recovery`, `live-identity-verification`, `cancellation-policy-and-process` (in progress).

## Probe beyond the generic lenses

**Calendar (GST-01)**: month navigation, blocked and booked dates, min and max stay, same-day turnover, selecting across months, past dates, price per night display vs pricing rules, legend, time zone at Manila midnight, handoff of dates into the form.

**Form (GST-02)**: one sub-record per step.

- Every field in the guide's Fields section: required, format, conditional visibility (pets, parking, extra guests, vehicle), min and max, defaults, prefill for signed-in guests (C32).
- Step navigation: next with invalid data, back, jump, reload mid-step, close tab and return, switch device. Record exactly what is lost today; the saved-progress plan depends on this baseline.
- Uploads (ID, selfie, payment receipt, pet documents, signatures): camera vs library on phone, HEIC, huge photo, rotated photo, slow upload, failed upload and retry, replace, remove. Server-side sniffing and optimization.
- AI receipt validation and identity checks: correct receipt, wrong amount, unrelated image, provider outage. The form must never block submission on an AI outage unless the guide says so.
- Voucher apply: valid, expired, already used, wrong property, removal (C27).
- Price summary equals the pricing engine and equals what the host sees on booking detail.
- Submit: double tap, network drop mid-submit, server validation error, overlap with a booking made a second earlier (two contexts), duplicate submission of the same guest and dates.
- Developer controls must be absent in production builds (check B and P).
- Parking CTA from the form into the parking flow.
- Consent, privacy notice and captcha behavior.
- Edit flow: reopening a submitted form via its link, what can change in which status, and that changes run the update pipeline (C03). Known sharp edge: changing only `petType` is not detected by `compareFormData`.

**Success (GST-03)**: content per booking type, next-step links, refresh, direct visit without a booking, back button does not resubmit.

**Trip (GST-04)**: every guest status word against every booking status; request-sent banner; arrival content and access unlock timing; cancellation by guest inside and outside policy with the refund preview; links to stay guide, document, sd-form, chat, parking; invalid, expired and foreign tokens.

**Stay guide (GST-05)**: token and status gating, content from the public-pages editor (C11), plan gate, offline readability.

**Document (GST-06)**: correct PDF for the booking, no access to another booking's document, download on phone.

**SD form (GST-07)**: three steps (review, voucher reveal, refund details); reveal styles; refund details validation (bank, e-wallet formats); only reachable in the right status; resubmission; the standalone guest-review page (GST-08) and its legacy path.

**Web chat (GST-09)**: anon and signed-in threads, attachments, AI auto-reply labeling, voice receptionist consent, rate limits, host reply arriving live (C24, C25).

**Pay parking (GST-10)** and **parking form and status (GST-11, 12)**: quote, vehicle details, payment start, return from PayMongo (success, failed, cancelled, expired checkout, reused link), status page states for every booking outcome (C28). Stale-checkout reuse and double-payment paths were flagged in the parking hardening audit; re-test them.

**Identity capture (GST-13)**: session token valid, expired, reused; camera permission denied; capture retry; purge behavior per retention policy.

## Hidden surfaces

`submit-*` functions, `upload-*` functions, public property resolution (`resolvePublicPropertyId`), `workflowOrchestrator` on create, host and guest emails, PDF generation from Storage `templates`, Google Calendar and sheet writes, notifications fan-out, `activity_log`, `cancellation-refund-cron`, `sd-refund-cron`, `review-lifecycle-cron`, `identity-captures-purge-cron`, `paymongo-webhook`, AI gateway calls, captcha and rate limiting, storage buckets for guest uploads.

## Connections and journeys

Source of C01, C03, C04 (guest side), C06, C07, C25, C27 (redeem), C28. J01 to J04, J08, J16, J18, J19.

## Known risks

- `petType`-only edits skip the update and revert pipeline.
- Two PDF template copies can drift (Storage `templates` vs `ui/public/templates`).
- Legacy static email HTML references a dead `{{urgentBlock}}` placeholder; confirm no live send uses it.
- Booking overlap is filtered in application memory, not by a DB constraint; test concurrent submissions deliberately.
- Date format split (`MM-DD-YYYY` in DB, `YYYY-MM-DD` in UI).
- There was a production guest-form outage; ask the owner for its cause and re-test that exact path first.
