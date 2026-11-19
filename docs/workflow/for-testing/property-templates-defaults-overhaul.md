---
title: 'Property templates: defaults, groups and placeholders overhaul'
status: for-testing
tags: [workflow, for-testing, templates, emails, stay-guide, inbox]
updated: 2026-11-19
stage: for-testing
kind: plan
---

# Property templates: defaults, groups and placeholders overhaul

> **Revised 2026-11-19 (execute-plan):** audited against the code on `develop`.
> No `readString(settings, …)` helper exists; property times are read directly from
> `settings.checkInTime` / `settings.checkOutTime`. `buildSdRefundChecklistSectionHtml`
> takes `unitLabel` + `brandColor` only, so it gains a `checkOutTime` input. Pre-arrival and
> parking reminder bodies live in `_shared/preArrivalReminderCron.ts` and
> `_shared/parkingReminderCron.ts` (the route files are thin wrappers). `email-parking-request`
> had already been retired from the server registry but was still in UI sections, the UI
> placeholder catalog and `PROPERTY_EMAIL_TEMPLATE_KEYS`; Phase 0 removes those last copies.
> `cancellation_request_title` is used inline inside `<strong>`, so it stays a plain token
> (not block-level); `cancellation_intro` and `cancellation_detail_section` become block-level.

## Goal

Make **Templates** (`/org/:orgSlug/property/:propertySlug/templates`) the one place a host controls every word a guest, the building admin, or their team receives for a property. Every automated email becomes a configurable template with an editable subject. The stay guide gets a full condo-ready set of sections. A new **Guest messages** group gives hosts ready-to-send replies for the moments that come up in chat. Every default is rewritten for Philippine condo hosts (Azure North first, no Azure-only literals), uses placeholders that pull real property data so defaults never contradict Settings, and is proven wired end to end by contract tests: registry, editor, preview, send path, stay guide, trip page, chat and copy-settings all read the same definition.

## Design review and pruning (2026-11-19)

A follow-up review of the shipped module tightened the default set and replaced the improvised header controls.

**Final default set: 37 templates** — 10 stay guide, 9 guest messages, 12 guest emails, 3 building admin, 3 team alerts.

| Decision | Detail                                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merged   | `trash-and-recycling` copy moved into **Using the unit** under a Trash and recycling heading. One section covers appliance use and waste instead of two thin chapters.                          |
| Removed  | `local-guide` (Around the area). It shipped a placeholder-only scaffold (`[Restaurant or cafe]`) nobody could send as-is. Hosts who want a local guide can add a custom template.               |
| Removed  | `message-mid-stay` (Checking in). It overlapped check-in day, check-out reminder and thank you, and read like filler in the quick-reply list.                                                   |
| Kept     | All 12 guest emails are wired to a workflow transition, automation toggle or review window. All 3 building admin and 3 team alert templates are required by the GAF, pet or cancellation flows. |

**UI corrections**

- Editor header is one identity block (icon, title, tier/unsaved badges, group and description), a compact icon facts row (recipient, trigger, automation), a full-width Subject field with a Fixed badge, and one action row. Save is always visible and disabled until the draft changes.
- Guest visibility uses the shared `Switch` and shadcn `Select` instead of a native checkbox and `<select>`.
- Rail rows show a muted **Hidden** badge with an eye-off icon instead of the word "Hidden" in the meta line. Group counts are right-aligned chips.
- Preview now renders through the preview edge function for **standard** templates as well, using `buildPropertyPlaceholderVars` so property address, contact card, map CTA and other blocks resolve with real data. The raw `{{tokens}}` bug is fixed.
- Subject placeholders use a new `defaultSubjectPreview` DTO field, filled server-side with this property's unit and name, so the input never shows raw braces.

## Prior work checked

| Item                                                                                                              | State                          | Relation to this plan                                                                       |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| No plan covers template **defaults**, **groups** or **new templates**                                             | n/a                            | This plan                                                                                   |
| [`../intake/_to-dos.md`](../intake/_to-dos.md): "Refine templates", "Refine email templates, refine flows"        | 🔵 open                        | Absorbed here                                                                               |
| UI-23 "Condo-default templates refine" ([`ui-improvements-worksheet.md`](../intake/ui-improvements-worksheet.md)) | skipped, "needs product input" | Absorbed here; this plan is the product input                                               |
| [`../for-testing/chat-templates.md`](../for-testing/chat-templates.md)                                            | for testing                    | Chat picker and snapshot send reused; Phase 6 adds the Messages group to it                 |
| [`../done/stay-guide-showcase-templates.md`](../done/stay-guide-showcase-templates.md)                            | done                           | Page layout templates (different meaning of "template"); chapter rendering reused           |
| [`../in-progress/cancellation-policy-and-process.md`](../in-progress/cancellation-policy-and-process.md)          | in progress                    | Added 4 cancellation email keys server-side; they never reached the Templates rail (gap G1) |
| [`multi-residence-config-decoupling.md`](./multi-residence-config-decoupling.md)                                  | planned                        | Same rule here: no Azure literals in defaults; building specifics come from placeholders    |
| [`guest-journey-followups.md`](./guest-journey-followups.md)                                                      | planned                        | Per-property request-expiry window; defaults avoid hardcoding "7 days"                      |
| [`docs/architecture/guest-emails.md`](../../architecture/guest-emails.md)                                         | reference                      | Guest email inventory and rules; updated by this plan                                       |

**Parking:** there is **no Templates module for parking** (no route, no `templates:*` leaves in parking scope). Parking has only Inbox **quick replies** (`social_reply_templates`, seeded by `_shared/inboxDefaultQuickReplies.ts`). Parking emails (reservation request, confirmed, awaiting payment, host cancelled, no host, endorsement) are hardcoded bodies rendered through the property shell using the `email-booking-acknowledgement` key plus `contentOverride` (`_shared/parkingBroadcastEmail.ts`, `_shared/parkingEndorsementEmail.ts`). Parking templates are out of scope; see "Follow-ups".

## Current state

### What Templates manages today

| Rail group       | Keys                                                                                                                                                                                                | Reaches                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Stay guide       | `house-rules`, `check-in-instructions`, `check-out-instructions`, `parking-reminders`                                                                                                               | Stay guide chapters, trip page (check-in/out), Inbox chat                          |
| Emails           | `email-gaf-request`, `email-pet-request`, `email-new-booking-request`, `email-booking-request-received`, `email-booking-acknowledgement`, `email-ready-for-checkin`, `email-sd-refund-form-request` | Workflow sends via `renderPropertyTemplateSendEmail`                               |
| Folders / Custom | `custom-{uuid}`                                                                                                                                                                                     | Manual "Send to guest" email, chat, trip page + stay guide when **Show to guests** |

Editor: TipTap `StarterKit` (bold, italic, underline, strike, link, H1 to H3, lists, blockquote, rule) + `Image` + `TextAlign` + placeholder highlight (`RichTextEditor.tsx`). No tables or inline styles; dynamic tables come from block placeholders.

### Every email a property sends

| #   | Email                         | To             | Sender                            | Body source today                                             | Configurable today            |
| --- | ----------------------------- | -------------- | --------------------------------- | ------------------------------------------------------------- | ----------------------------- |
| 1   | New booking request           | Team           | `sendNewBookingRequestNotify`     | `email-new-booking-request`                                   | Yes                           |
| 2   | Booking request received      | Guest          | `sendBookingRequestReceived`      | `email-booking-request-received`                              | Yes                           |
| 3   | GAF request                   | Building admin | `sendEmail`                       | `email-gaf-request`                                           | Yes                           |
| 4   | Pet request                   | Building admin | `sendPetEmail`                    | `email-pet-request`                                           | Yes                           |
| 5   | Booking acknowledgement       | Guest          | `sendBookingAcknowledgement`      | `email-booking-acknowledgement`                               | Yes                           |
| 6   | Ready for check-in            | Guest          | `sendReadyForCheckin`             | `email-ready-for-checkin`                                     | Yes                           |
| 7   | Check-out and deposit refund  | Guest          | `sendSdRefundFormRequest`         | `email-sd-refund-form-request` + hardcoded checklist block    | Partly (checklist fixed)      |
| 8   | Booking cancelled (guest)     | Guest          | `sendBookingCancelledGuest`       | `email-booking-cancelled-guest`                               | **Server only, hidden in UI** |
| 9   | Booking cancelled (host)      | Team           | `sendBookingCancelledHost`        | `email-booking-cancelled-host`                                | **Server only, hidden in UI** |
| 10  | Cancellation request (guest)  | Guest          | `sendCancellationRequestGuest`    | `email-cancellation-request-guest`                            | **Server only, hidden in UI** |
| 11  | Refund sent (guest)           | Guest          | `sendRefundSentGuest`             | `email-refund-sent-guest`                                     | **Server only, hidden in UI** |
| 12  | Request expired (guest)       | Guest          | `sendBookingCancelledGuest`       | #8 body + hardcoded intro sentence                            | No                            |
| 13  | Request expiring (host chase) | Team           | `sendPendingReviewChaseHost`      | Hardcoded `contentOverride` on the acknowledgement key        | No                            |
| 14  | Pre-arrival reminder (T-48h)  | Guest          | `preArrivalReminderCron`          | Hardcoded `REMINDER_BODY` on the acknowledgement key          | No                            |
| 15  | Parking reminder              | Guest          | `parkingReminderCron`             | Hardcoded `REMINDER_BODY_TEMPLATE` on the acknowledgement key | No                            |
| 16  | Review request                | Guest          | `sendReviewRequestEmail`          | Static `review-notice.html` + hardcoded strings               | No                            |
| 17  | Review reminder               | Guest          | `sendReviewReminderEmail`         | Static `review-notice.html` + hardcoded strings               | No                            |
| 18  | Custom template send          | Guest          | `sendPropertyCustomTemplateEmail` | `custom-*` row                                                | Yes                           |

System notices that **stay in code** (not host copy, or security/legal content): guest chat reply notification (`guestChatEmail.ts`), review published / host response / report decision (`reviewEmails.ts`), support ticket mail, team invites (org, property, parking), settings OTP and change notices, super-admin step-up, org verification, billing, contract lifecycle, Superhost earned/lost, ops report, property deleted. Telegram message templates stay on **Notifications**.

### Gaps and bugs found

| ID  | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Evidence                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| G1  | The 4 cancellation templates exist on the server but **never show in the Templates rail**, so hosts cannot edit them. The rail only lists keys from a hand-kept UI array.                                                                                                                                                                                                                                                                                                                                           | `ui/.../lib/propertyTemplateSections.ts` `EMAIL_TEMPLATE_SECTIONS`; `templateLibrary.ts#buildTemplateLibrary`          |
| G2  | Four hand-synced lists drift: server registry, UI sections, UI placeholder reference + samples, server reference. Retired `email-parking-request` is still in UI sections, server `PROPERTY_EMAIL_TEMPLATE_KEYS` and the placeholder catalog. `email-booking-cancelled-host` has no catalog entry. `cancellation_*` tokens are not block-level and not in the UI reference. `stay_guide_cta_section` is missing from the server reference. `pet_age`, `form_url`, `review_url` are filled at send but undocumented. | `propertyTemplatePlaceholders.ts` (both), `templatePlaceholderCatalog.ts`, `propertyTemplateEmail.ts`                  |
| G3  | Preview renders `cancellation_*` sections blank (no sample builder).                                                                                                                                                                                                                                                                                                                                                                                                                                                | `propertyTemplateEmailSections.ts#buildSampleDynamicSections`                                                          |
| G4  | Templates a host adds to **Stay guide** or **Emails** are dead ends: no Show to guests, no Send, never rendered in the stay guide (only `category = 'custom'` rows are read), email-category rows are blocked from chat.                                                                                                                                                                                                                                                                                            | `PropertyTemplateEditorPane.tsx` (`isCustom = category === 'custom'`), `guestTripContent.ts`, `chatTemplateMessage.ts` |
| G5  | Times contradict each other. The check-out checklist block hardcodes **11:00 AM** plus Azure-only steps (elevator card mailbox, visitor's pass). Send-time fallbacks are `2:00 PM` / `11:00 AM` while property defaults are `14:00` / `12:00`. Standard defaults hardcode 2:00 PM / 11:00 AM.                                                                                                                                                                                                                       | `buildSdRefundChecklistSectionHtml`, `buildBookingPlaceholderVars`, `propertyResidenceDefaults.ts`                     |
| G6  | Five guest/team emails have bodies hardcoded outside Templates (#12 to #17). The pre-arrival reminder prints "Your balance is ₱0.00" when nothing is due.                                                                                                                                                                                                                                                                                                                                                           | `preArrivalReminderCron.ts`, `emailService.ts#sendPendingReviewChaseHost`, `parkingReminderCron.ts`, `reviewEmails.ts` |
| G7  | Subjects and shell titles are hardcoded. GAF and pet subjects **must stay fixed**: inbound approval matching parses `- GAF Request (date to date)` / `- Pet Request (...)`.                                                                                                                                                                                                                                                                                                                                         | `emailService.ts` subjects; `approvalEmailMatcher.ts#parseApprovalSubject`                                             |
| G8  | Stay guide defaults duplicate structured settings and can contradict them (quiet hours, pets, check-in time vs **Settings → House rules** and **Guest experience**).                                                                                                                                                                                                                                                                                                                                                | `propertyTemplates.ts` defaults vs `propertyHouseRulesConstants.ts`, `property_guest_essentials`                       |
| G9  | Unknown or out-of-context tokens silently render empty at send; the route guide says they stay literal. Nothing warns on save. A host can put a tokenized guest link (`{{trip_url}}`) in a building admin email.                                                                                                                                                                                                                                                                                                    | `applyPropertyTemplatePlaceholders` returns `''`; `templates.md` Edge cases                                            |
| G10 | `isDefault` compares raw strings. TipTap re-serializes lists as `<li><p>…</p></li>`, so saving an untouched default likely flips it to **Customized**. Verify with a test.                                                                                                                                                                                                                                                                                                                                          | `propertyTemplates.ts#rowToDto`                                                                                        |
| G11 | Copy issues: acknowledgement has no greeting and says "confirmed" twice (body + flow block); host cancellation default says "A booking was cancelled." even for a **request**; request-expired wording blames the host in the guest's inbox.                                                                                                                                                                                                                                                                        | `propertyTemplates.ts`, `emailService.ts`                                                                              |
| G12 | Copy settings clones template content only: no subject, folders, `guest_visible`, `guest_phase`.                                                                                                                                                                                                                                                                                                                                                                                                                    | `propertySettingsCloneGroups.ts#templatesGroup`                                                                        |
| G13 | Default Inbox quick replies hardcode "Azure North, San Fernando, Pampanga".                                                                                                                                                                                                                                                                                                                                                                                                                                         | `inboxDefaultQuickReplies.ts`                                                                                          |
| G14 | Docs drift: route guide Sections table lacks the cancellation keys and documents the wrong unknown-token behavior.                                                                                                                                                                                                                                                                                                                                                                                                  | `docs/guides/routes/org/property/templates.md`                                                                         |

## Scope

**In**

- Property Templates module: registry, rail groups, editor, preview, placeholders, subjects, test send, save validation.
- Moving emails #12 to #17 into configurable templates; exposing #8 to #11.
- New stay guide sections, new Guest messages group, condo default pack for every template.
- Wiring to stay guide, trip page, Inbox chat, AI Assistant context, email automations settings, copy settings.
- Backfill so properties holding an untouched old default get the new one.
- Docs, tests, QA matrix.

**Out**

- Parking templates module (follow-up).
- System notices listed above, Telegram templates, marketing templates, page layout templates.
- Non-condo default packs (resolver ready, content later).
- New scheduled automations beyond what exists (check-in day email, mid-stay email). Those moments ship as **Guest messages** the host sends.
- Conditional syntax in templates (`{{#if}}`). Optional data is handled by block placeholders that hide when empty.

## Decisions

| #   | Decision                   | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Source of truth            | **Server registry** (`_shared/propertyTemplates.ts`) describes every built-in: key, group, behavior, recipient, trigger, toggle, icon id, allowed placeholders, default subject, guide chapter/phase/visibility/condition. `GET property-templates-settings` returns it. The UI deletes its mirrored lists (`propertyTemplateSections.ts` arrays, property part of `templatePlaceholderCatalog.ts`, UI `propertyTemplatePlaceholders.ts`). |
| D2  | Groups vs behavior         | `category` stays the **behavior** (`standard` = guide section, `email` = automated email, `message` = new, sendable in chat or by email, `custom` = host-owned). A new registry field `group` drives the rail: **Stay guide**, **Guest messages**, **Guest emails**, **Building admin**, **Team alerts**, then host folders, then **Custom**.                                                                                              |
| D3  | Default packs              | Defaults live in `_shared/propertyTemplateDefaults/condo.ts`. `resolveTemplatePack(properties.type)` returns the condo pack for every type until other packs exist. Building admin group shows only when the property has a GAF or pet document requirement.                                                                                                                                                                               |
| D4  | Where hosts can add        | **Add template** targets: Stay guide, Guest messages, folders, Custom. Not Guest emails / Building admin / Team alerts (those are fired by the workflow, a host-added one could never send). Existing host-owned `email` rows migrate to `message`; host-owned `standard` rows gain Show to guests + chapter.                                                                                                                              |
| D5  | Built-in guide visibility  | Built-in guide sections get the same **Show to guests** switch as custom ones, stored on the row (`guest_visible`, `guest_phase`). No row means the registry default. Sections with a `condition` (`has_pets`, `need_parking`) only render for matching bookings.                                                                                                                                                                          |
| D6  | Unedited scaffold guard    | Sections flagged `requiresEdit` (Around the area) cannot be switched on while the body still equals the default. Server returns 400 with a short reason.                                                                                                                                                                                                                                                                                   |
| D7  | Subjects                   | New nullable `subject` column. Registry carries `defaultSubject`. Plain placeholders only. Urgent and update prefixes stay system-added. **GAF and pet subjects are locked** (not editable) because inbound approval parses them.                                                                                                                                                                                                          |
| D8  | Optional data              | Defaults use plain tokens only for values that always exist (guest name, dates, times, unit, property name, token links, money). Optional values (phone, Wi-Fi name, address, garbage schedule) go through **block placeholders that render nothing when empty**. The editor warns when a plain token is empty for this property and links to the setting that fills it.                                                                   |
| D9  | Secrets                    | `{{wifi_password}}` and `{{door_code}}` allowed **only in Stay guide templates**, rendered through the essentials reveal gate. Everywhere else (chat, email, preview sent as email) they render "on your trip page". Save rejects them in email and message templates. Defaults never use them.                                                                                                                                            |
| D10 | Token links                | `trip_url`, `sd_form_url`, `review_url`, `stay_guide_url`, `messages_url` and their CTA blocks carry a booking access token. Server-side save validation rejects them in **Building admin** and **Team alerts** templates.                                                                                                                                                                                                                 |
| D11 | Unknown tokens             | Keep rendering them empty at send (current behavior, safer than leaking braces) and fix the docs. Save returns `warnings[]` for unknown or not-allowed tokens; the editor shows them inline.                                                                                                                                                                                                                                               |
| D12 | Write once, use everywhere | New blocks `{{check_in_instructions_section}}`, `{{check_out_instructions_section}}`, `{{house_rules_section}}` embed the host's guide templates in emails. The check-out email uses the host's **Check-out** section instead of the hardcoded checklist. Legacy `{{sd_refund_checklist_section}}` keeps rendering for saved rows but reads the booking's check-out time.                                                                  |
| D13 | Labels                     | Host language: "Booking acknowledgement" becomes **Booking confirmed** (matches `guestJourneyCopy.ts` vocabulary), "SD Refund Form Request" becomes **Check-out and deposit refund** (matches Email automations). Keys never change.                                                                                                                                                                                                       |
| D14 | Quick replies vs messages  | Quick replies stay short, plain-text, org-scoped Inbox snippets. Guest messages are property-scoped rich templates that use the full placeholder set and can go by chat or email. Inbox inserts a message template as **editable text** in the composer (bracketed fill-ins like `[item]` need an edit); guide and custom templates keep the card send.                                                                                    |
| D15 | Existing host copy         | Never overwrite a customized row. Rows whose normalized content equals a previously shipped default are deleted by a one-shot backfill so they fall through to the new default. Customized rows get a **New default available** badge with compare and "Use new default".                                                                                                                                                                  |
| D16 | Plans                      | No new `PlanFeatureKey`. Guide sections and Guest messages: edit, save and chat send free. Email body and subject save: `customTemplates` (Starter+), as today. Sending a message by email: `customTemplates`. Pre-arrival toggle: `automatedBookingFlow`, like Ready for check-in. Test send: ungated, rate-limited.                                                                                                                      |
| D17 | Permissions                | No new leaf. Guest messages use `templates.standard:edit` (team UI label becomes "Stay guide and messages"). Emails `templates.email:edit`. Custom `templates.custom:*`. Message email send `bookings.detail.workflow:edit` (same as custom send). Test send needs the edit leaf of that template's category.                                                                                                                              |
| D18 | OTP                        | Subject, content and visibility saves go through the existing org-owner OTP (15-minute sudo). Test send and organise actions do not.                                                                                                                                                                                                                                                                                                       |
| D19 | Default equality           | `isDefault` compares `normalizeTemplateContentForCompare()` on both sides: stored normalization plus TipTap list canonicalization (`<li>x</li>` → `<li><p>x</p></li>`) and formatting-newline collapse. Export lives in `_shared/propertyTemplates.ts` so the Deno test can assert a round-tripped default still reads Default.                                                                                                            |
| D20 | Cancellation block level   | `cancellation_intro` and `cancellation_detail_section` are block-level tokens (own `<p>`). `cancellation_request_title` stays plain because the default body uses it inline inside `<strong>`.                                                                                                                                                                                                                                             |
| D21 | Missing check-out time     | The check-out checklist makes no time claim when both the booking and the property have no check-out time; it says "check out by the time shown on your booking" instead of printing a wrong fixed time.                                                                                                                                                                                                                                   |

## Target model

### Groups (rail order)

1. **Stay guide**: guide sections, shown under chapter sub-labels (Getting in, Make yourself at home, Before you go).
2. **Guest messages**: host-sent replies for chat or email.
3. **Guest emails**: automated guest mail.
4. **Building admin**: GAF, pet, cancelled GAF notice. Hidden when the property has no GAF/pet requirement.
5. **Team alerts**: mail to the property's team inbox.
6. Host folders, then **Custom**.

Filter chips become: All, Stay guide, Messages, Emails (Guest + Building admin + Team), Custom.

Each email template header shows: **To** (recipient), **When** (trigger), **Automation** (On / Off / Needs plan, linking to Settings → Email automations with that row focused), **Subject**, and **Send test to me**. Settings → Email automations rows get an **Edit template** link back (`?template=<key>`).

### Template catalog

`NEW` = new key. `MOVE` = existing hardcoded body becomes a template. `REFINE` = existing key, new default. `EXPOSE` = existing server key added to the rail.

**Stay guide** (`category: standard`)

| Key                      | Label                | Chapter               | Phase    | Default shown | Condition            | Status                               |
| ------------------------ | -------------------- | --------------------- | -------- | ------------- | -------------------- | ------------------------------------ |
| `welcome-note`           | Welcome              | Getting in            | arrival  | On            | none                 | NEW                                  |
| `getting-here`           | Getting here         | Getting in            | before   | Off           | none                 | NEW                                  |
| `check-in-instructions`  | Check-in             | Getting in            | arrival  | On            | none                 | REFINE                               |
| `house-rules`            | House rules          | Make yourself at home | always   | On            | none                 | REFINE                               |
| `using-the-unit`         | Using the unit       | Make yourself at home | stay     | Off           | none                 | NEW                                  |
| `building-amenities`     | Building amenities   | Make yourself at home | stay     | Off           | none                 | NEW                                  |
| `trash-and-recycling`    | Trash and recycling  | Make yourself at home | stay     | Off           | none                 | Removed (merged into Using the unit) |
| `parking-reminders`      | Parking              | Make yourself at home | arrival  | On            | `need_parking`       | REFINE                               |
| `pet-guidelines`         | Pet guidelines       | Make yourself at home | arrival  | On            | `has_pets`           | NEW                                  |
| `emergency-and-safety`   | Emergency and safety | Make yourself at home | stay     | On            | none                 | NEW                                  |
| `local-guide`            | Around the area      | Make yourself at home | stay     | Off           | none, `requiresEdit` | Removed (placeholder scaffold)       |
| `check-out-instructions` | Check-out            | Before you go         | checkout | On            | none                 | REFINE                               |

"Off" sections make claims only the host can confirm (appliances, amenities, chute location, local places). They show a **Not shown to guests** badge in the rail.

**Guest messages** (`category: message`, new)

| Key                          | Label              | Typical moment                    |
| ---------------------------- | ------------------ | --------------------------------- |
| `message-balance-reminder`   | Balance reminder   | Before check-in, balance unpaid   |
| `message-document-follow-up` | Missing documents  | Pending documents                 |
| `message-check-in-day`       | Check-in day       | Morning of arrival                |
| `message-early-check-in`     | Early check-in     | Guest asks to arrive early        |
| `message-late-check-out`     | Late check-out     | Guest asks to stay later          |
| `message-mid-stay`           | Checking in        | Removed: overlapped other moments |
| `message-noise-reminder`     | Noise reminder     | Complaint from the building       |
| `message-check-out-reminder` | Check-out reminder | Evening before check-out          |
| `message-thank-you`          | Thank you          | After check-out                   |
| `message-lost-and-found`     | Item left behind   | After check-out                   |

**Guest emails** (`category: email`)

| Key                                | Label                        | Trigger                                     | Toggle                          | Status          |
| ---------------------------------- | ---------------------------- | ------------------------------------------- | ------------------------------- | --------------- |
| `email-booking-request-received`   | Booking request received     | Guest submits the form                      | `emailBookingRequestReceived`   | REFINE          |
| `email-booking-acknowledgement`    | Booking confirmed            | Host approves the request                   | `emailBookingAcknowledgement`   | REFINE (rename) |
| `email-ready-for-checkin`          | Check-in details             | Booking reaches Ready for check-in          | `emailReadyForCheckin`          | REFINE          |
| `email-pre-arrival-reminder`       | Arrival reminder             | 2 days before check-in                      | `emailPreArrivalReminder` (new) | MOVE            |
| `email-parking-reminder`           | Parking reminder             | Guest asked for parking and has no slot yet | `emailParkingReminder` (new)    | MOVE            |
| `email-sd-refund-form-request`     | Check-out and deposit refund | Before check-out (cron lead time)           | `emailSdRefundCheckout`         | REFINE (rename) |
| `email-review-request`             | Review request               | Review window opens                         | `emailReviewRequest`            | MOVE            |
| `email-review-reminder`            | Review reminder              | Review window closes soon                   | `emailReviewReminder`           | MOVE            |
| `email-booking-cancelled-guest`    | Booking cancelled            | Booking becomes Cancelled                   | none (always)                   | EXPOSE + REFINE |
| `email-request-expired-guest`      | Request expired              | Pending request expires                     | none (always)                   | NEW (split)     |
| `email-cancellation-request-guest` | Cancellation request         | Guest requests; host approves or declines   | none (always)                   | EXPOSE + REFINE |
| `email-refund-sent-guest`          | Refund sent                  | Host records a refund                       | none (always)                   | EXPOSE + REFINE |

**Building admin** (`category: email`)

| Key                                 | Label            | Trigger                                   | Toggle                                 | Status                    |
| ----------------------------------- | ---------------- | ----------------------------------------- | -------------------------------------- | ------------------------- |
| `email-gaf-request`                 | GAF request      | Host approves a booking that needs a GAF  | `emailGafRequest`                      | REFINE, subject locked    |
| `email-pet-request`                 | Pet request      | Host approves a booking with a pet        | `emailPetRequest`                      | REFINE, subject locked    |
| `email-building-admin-cancellation` | GAF cancellation | A booking whose GAF was sent is cancelled | `emailBuildingAdminCancellation` (new) | NEW (see open question 1) |

**Team alerts** (`category: email`)

| Key                            | Label               | Trigger                                    | Toggle                   | Status          |
| ------------------------------ | ------------------- | ------------------------------------------ | ------------------------ | --------------- |
| `email-new-booking-request`    | New booking request | Guest submits the form                     | `emailNewBookingRequest` | REFINE          |
| `email-request-expiring-host`  | Request expiring    | Request still pending 2 days before expiry | none (always)            | MOVE            |
| `email-booking-cancelled-host` | Booking cancelled   | Guest cancels or asks to cancel            | none (always)            | EXPOSE + REFINE |

### Placeholder catalog

One server module, `_shared/propertyTemplateCatalog.ts`, exports every token with `key`, `label`, `group`, `kind` (`plain` / `block` / `secret` / `link`), `sample`, `contexts` (which groups may use it) and `source` (the setting that fills it, for missing-data hints). The GET response returns it; the Placeholders dialog groups by `group`, shows this property's real value (sample booking for booking fields), and marks block, link and secret tokens.

| Group                    | Tokens (new in **bold**)                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest                    | `guest_name`, **`guest_first_name`** (falls back to "there"), `primary_guest_name`, `guest_facebook_name`, `guest_email`, `guest_phone`                                                                                                                                                                                                                                                                                                            |
| Stay                     | `check_in_date`, `check_out_date`, `check_in_time`, `check_out_time` (fallback to property times, not fixed strings), `nights`, **`nights_label`** ("1 night"), `pax`, **`guests_label`** ("2 guests"), **`stay_dates`** (subject format), `special_requests`, `booking_source`                                                                                                                                                                    |
| Property                 | `property_name`, `tower_and_unit_number`, `unit_number`, **`residence_name`**, **`property_address`**, **`map_link`**, **`host_name`**, **`org_name`**, **`max_guests`**                                                                                                                                                                                                                                                                           |
| Arrival essentials       | **`wifi_name`**, **`unit_floor`**, **`parking_slot_note`**, **`garbage_schedule`**, **`quiet_hours`**, **`building_security_phone`**, **`emergency_contact_name`**, **`emergency_contact_phone`**; secrets **`wifi_password`**, **`door_code`** (Stay guide only, reveal-gated)                                                                                                                                                                    |
| Contact                  | `contact_name`, `contact_phone`, `contact_email`, `facebook_page_url`, `airbnb_url`, `social_contact_mentions`                                                                                                                                                                                                                                                                                                                                     |
| Money                    | `total_guest_balance`, `security_deposit`, **`pet_fee`**, **`parking_rate`**                                                                                                                                                                                                                                                                                                                                                                       |
| Pet / vehicle            | `pet_name`, `pet_type`, `pet_breed`, `pet_age`, `car_brand_model`, `car_color`, `car_plate_number`                                                                                                                                                                                                                                                                                                                                                 |
| Links (tokenized)        | `trip_url`, `sd_form_url`, `review_url`, `form_url`, **`stay_guide_url`**, **`messages_url`**; team only: `booking_link`                                                                                                                                                                                                                                                                                                                           |
| Workflow text            | `cancellation_intro`, `cancellation_request_title`, **`cancellation_request_message`**, **`cancellation_host_intro`**, **`cancellation_host_title`**, **`expires_in_days`**, **`review_window_days`**                                                                                                                                                                                                                                              |
| Blocks (hide when empty) | existing section tokens, plus **`contact_section`**, **`emergency_contacts_section`**, **`house_rules_list`**, **`amenities_list`**, **`house_rules_section`**, **`check_in_instructions_section`**, **`check_out_instructions_section`**, **`balance_due_section`**, **`arrival_access_note_section`**, **`cancellation_policy_section`**, **`review_cta_section`**, **`parking_cta_section`**, **`map_cta_section`**, **`messages_cta_section`** |

**Context rules** (enforced by the catalog on save, mirrored in the dialog):

| Token kind                         | Stay guide                                   | Guest messages | Guest emails | Building admin | Team alerts |
| ---------------------------------- | -------------------------------------------- | -------------- | ------------ | -------------- | ----------- |
| Guest, stay, property, contact     | Yes                                          | Yes            | Yes          | Yes            | Yes         |
| Arrival essentials (non-secret)    | Yes                                          | Yes            | Yes          | No             | Yes         |
| Secrets                            | Yes                                          | No             | No           | No             | No          |
| Tokenized guest links + CTA blocks | Yes                                          | Yes            | Yes          | **No**         | **No**      |
| `booking_link`, `booking_link_cta` | No                                           | No             | No           | No             | Yes         |
| Workflow sections                  | Only the template that fills them (as today) |

## Phases

### Phase 0: Correctness fixes (ship first, independent)

- [x] Show the 4 cancellation templates in the rail now (temporary UI list entries until Phase 1 removes the list). `ui/src/features/dashboard/bookings/lib/propertyTemplateSections.ts`
- [x] Remove retired `email-parking-request` from UI sections, `PROPERTY_EMAIL_TEMPLATE_KEYS` (`_shared/propertyTemplateEmail.ts`) and `templatePlaceholderCatalog.ts`.
- [x] Catalog entry for `email-booking-cancelled-host`; add `cancellation_*` to block keys and both references; add `stay_guide_cta_section` to the server reference; document `pet_age`, `form_url`, `review_url`.
- [x] Sample builders for `cancellation_intro`, `cancellation_detail_section`, `cancellation_request_title` in `buildSampleDynamicSections`.
- [x] `buildBookingPlaceholderVars`: drop the fixed `'2:00 PM'` / `'11:00 AM'` fallbacks; `renderPropertyTemplateSendEmail` resolves the property's guest form times once per render and fills only the blanks. Same for `buildGuestFormPlaceholderVars`.
- [x] `buildSdRefundChecklistSectionHtml`: use the booking's check-out time; drop "strictly"; keep steps until Phase 5 replaces the block.
- [x] Pre-arrival reminder: omit the balance sentence when the balance is ₱0.
- [x] `rowToDto#isDefault`: compare normalized content (`normalizeTemplateContentForCompare` on both sides, including TipTap list canonicalization); add a regression test that a round-tripped default stays "default".
- [x] Route guide: fix unknown-token behavior and the Sections table (G14).
- [x] Tests: extend `propertyTemplates_test.ts` and `templateLibrary.test.ts`.

**Acceptance:** `bun run type-check`, `bun run lint`, `bunx vitest run ui/src/features/dashboard/bookings/lib/templateLibrary.test.ts`, and `deno test supabase/functions/_shared/propertyTemplates_test.ts supabase/functions/_shared/propertyTemplateEmailSections_test.ts` all pass.

### Phase 1: Registry as the single source of truth

- [x] Extend `PropertyTemplateDefinition` (`_shared/propertyTemplates.ts`): `group`, `recipient`, `trigger`, `automationToggleKey`, `iconId`, `allowedPlaceholders` (delivered as `placeholderKeys`), `defaultSubject`, `subjectLocked`, guide fields (`chapter`, `defaultPhase`, `defaultGuestVisible`, `condition`, `requiresEdit`), `appliesWhen` (for Building admin). `requiredBlocks` is still open.
- [x] New `_shared/propertyTemplateDefaults/condo.ts` + `index.ts#resolveTemplatePack(type)`; registry reads `defaultContent` / `defaultSubject` from the pack. Package resolution does not yet read `properties.type` because only the condo pack exists; `resolveTemplatePack` ignores the type today.
- [x] New `_shared/propertyTemplateCatalog.ts` with allowed keys per template and the block key list. `_shared/propertyTemplatePlaceholders.ts` still provides the human reference lines and sample values.
- [x] `serializePropertyTemplatesForAdmin` returns per-template metadata, `placeholderKeys`, and hides Building admin when no GAF/pet requirement applies. Automation state is still fetched separately by the Settings page.
- [x] UI: `usePropertyTemplates.ts` DTO types; `templateLibrary.ts#buildTemplateLibrary` builds the five groups from `template.group`; icon map keyed by `iconId`; `propertyTemplateSections.ts` reduced to the four guide keys the page editor needs. UI `propertyTemplateCatalog` and `propertyTemplatePlaceholders` remain as a fallback when a cached response predates `placeholderKeys`.
- [ ] Consumers of the static lists switch to DTO metadata: `page-editor/lib/stayGuideChapterSections.ts`, `guest/stay-guide/lib/mapStayGuideData.ts` (`CHAPTER_TEMPLATE_KEYS` from `section.chapter`), setup guide hooks. (The chat and inbox consumers did not reference the deleted lists.)
- [x] Contract tests (Deno, `propertyTemplates_test.ts`): every built-in has group, recipient (emails), trigger, icon, label and subject; every token in every default body and subject is allowed; block tokens sit alone in a `<p>`; defaults contain no `style=`, `<table`, `—` or `–`.
- [ ] Remaining contract test: every allowed token is produced by the send-path var builder with a fixture booking (assert no `{{` remains), and GAF/pet rendered subjects still match `parseApprovalSubject`.
- [ ] Vitest DOM test (`.test.tsx`, happy-dom project): each default round-trips through the TipTap schema unchanged.

### Phase 2: Placeholder engine

- [x] New `_shared/propertyTemplatePropertyVars.ts#buildPropertyPlaceholderVars(propertyId, booking?)`: property, essentials (non-secret), contact, money, links and blocks. Reuses `loadPublicPropertyById` house rules / amenities / address / maps, `guestEssentials.ts`, `guestContactInfo.ts`, `resolveGuestFormSettings`, and builds `cancellation_policy_section` from the property policy.
- [x] Merged into every render path: `renderPropertyTemplateSendEmail` (covers email, custom send and preview), `guestStayGuide.ts#resolveSectionHtml`, `guestTripContent.ts`, `chatTemplateMessage.ts`. Guide and trip pass `revealSecrets: true`; email, chat and preview never do.
- [x] Secrets: guide and trip fill `wifi_password` / `door_code` from the reveal-gated essentials DTO (value or "Available ..."); every other path fills "on your trip page". Save rejects secrets outside Stay guide.
- [x] Blocks built: `contact_section`, `emergency_contacts_section`, `house_rules_list`, `amenities_list`, `check_in_instructions_section`, `check_out_instructions_section`, `house_rules_section` (guide body embedded, dropped above 8 000 chars), `balance_due_section`, `arrival_access_note_section`, `review_cta_section`, `parking_cta_section`, `map_cta_section`, `messages_cta_section`, `cancellation_policy_section`. The four CTA blocks render from real URLs at send time.
- [x] Save validation in `property-templates-settings`: errors for secrets outside Stay guide, tokenized links in Building admin / Team alerts, and block tokens in a subject; `warnings[]` for unknown tokens and removed `requiredBlocks`.
- [x] Missing data: GET returns `propertyEmptyPlaceholders` for the property. The per-template chip row in the editor is still open (Phase 3 UI).
- [ ] Placeholders dialog grouped list with kind badges and real values. The dialog already groups and searches; the kind badge and real-value columns remain.
- [x] Tests: `propertyTemplateCatalog_test.ts` covers secret gating, link gating by group, unknown-token warnings, subject block rejection and required-block warnings.

### Phase 3: Groups, guide visibility, subjects, test send

- [x] Migration `supabase/migrations/20261343001100_property_template_contents_v2.sql`: `subject TEXT NULL`, `default_hash TEXT NULL`, `message` added to the category check, host-owned email rows converted to message.
- [x] `upsertPropertyTemplateRow` / `updateCustomTemplateRow`: `guest_visible` / `guest_phase` now allowed on standard rows, `subject` persisted (locked subjects ignored), `default_hash` written from the current default.
- [x] Stay guide reads built-in guide visibility from the row, falling back to the registry default; `chapter` returned per section and the guest page groups by it.
- [ ] Trip page phase filtering for built-in sections. Check-in and check-out instructions remain status-driven.
- [x] Show to guests on host-owned and built-in standard templates. The chapter is derived from the registry, so a separate chapter picker was not needed.
- [x] Rail + filters: five registry groups, Messages filter, not-organisable built-ins, Building admin hidden when not applicable.
- [ ] Not shown to guests rail badge and the New default available badge with compare. Both are Phase 5 UI.
- [x] Add template targets: Stay guide, folders, Custom. Guest emails, Building admin and Team alerts are not targets; Guest messages targets arrive with Phase 6.
- [x] Email header: To, When, Automation (On / Off / Needs plan), Subject (read-only with a Fixed note for GAF and pet) and Send test.
- [x] Settings -> Email automations: **Edit template** link per row. Arrival and parking reminder rows arrive with Phase 4.
- [x] New edge function `send-property-template-test-email`: renders the draft with real property data, sends to the caller's own address with a `[Test]` subject, checks suppression, 10 sends per user per hour, requires the edit leaf of that template's category.
- [x] Preview returns the rendered subject; the card and the test send use it.
- [x] Dirty state includes subject and visibility, so the unsaved-changes guard covers them.
- [ ] Tests: settings handler tests and the Playwright templates shell update for subject edit and test send.

### Phase 4: Move hardcoded emails into templates

- [x] `email-pre-arrival-reminder`: `preArrivalReminderCron.ts` renders the template instead of `REMINDER_BODY`; toggle `emailPreArrivalReminder` (plan-gated like ready for check-in, inherits `emailReadyForCheckin` when the newer key was never saved, so current behaviour is unchanged).
- [x] `email-parking-reminder`: `parkingReminderCron.ts` renders the template; toggle `emailParkingReminder` (not plan-gated, default on).
- [x] `email-review-request` / `email-review-reminder`: `reviewEmails.ts` request and reminder go through `renderPropertyTemplateSendEmail` with `review_cta_section`; published / response / report-decision stay system notices.
- [x] `email-request-expired-guest`: `sendBookingCancelledGuest` picks this key when `reasonCode === 'request_expired'`.
- [x] `email-request-expiring-host`: `sendPendingReviewChaseHost` renders the template and adds the missing **View booking** button through `booking_link_cta`.
- [x] Host cancellation: `cancellation_host_intro` / `cancellation_host_title` filled per case; guest request fills `cancellation_request_message` per state.
- [x] Subjects: the main guest and team senders read the saved subject or the shipped default and render plain placeholders, then add system prefixes. Locked GAF and pet subjects ignore the row.
- [x] `email-building-admin-cancellation`: sent from the cancel transition when `gaf_request_pdf_url` exists; toggle `emailBuildingAdminCancellation`; recipient is the building admin mailbox, same as the GAF request.
- [x] Toggle keys added to `_shared/propertyAutomationToggles.ts` and the UI mirror, including `PLAN_GATED_AUTOMATION_TOGGLE_KEYS`.
- [x] `booking-workflow.mdc` email table and `docs/architecture/guest-emails.md` updated.
- [ ] Tests: a dedicated Deno test per sender (toggles respected, request-expired key, subject prefixes, GAF/pet subjects unchanged). Current coverage is the shared template contract, toggle contract and the existing cron tests.

### Phase 5: Condo default pack and backfill

- [x] Every Appendix A default written into `propertyTemplateDefaults/condo.ts`, including the 8 new stay guide sections.
- [x] Copy refresh in `propertyTemplateEmailSections.ts`: the acknowledgement summary shows unit and dates without repeating "confirmed"; the deposit refund block is titled "Deposit refund" with a "Request deposit refund" button.
- [x] Backfill script `scripts/backfill-property-template-defaults.ts` with a frozen copy of every old default, dry run by default, counts per key, `bun run backfill:templates`. Runbook entry added.
- [x] **New default available** shown in the editor with **Use new default** (goes through Reset, so OTP applies). A side-by-side compare is not built; the badge and Reset are the recovery path.
- [x] Defaults pass the contract tests and the human-copy rules (no em or en dashes, no Azure literals, optional data through blocks).
- [x] `requiresEdit` guard: Around the area cannot be switched on while its body is still the default scaffold.

### Phase 6: Guest messages

- [x] Registry entries for the 10 message templates (`category: message`, group Guest messages) with shipped copy.
- [x] `chat-templates` and `chatTemplateMessage.ts` include `message`; the Inbox Insert menu has a **Messages** section that inserts flattened, placeholder-filled text into the composer for editing. Guide and custom templates keep the card flow.
- [x] `send-property-custom-template-email` accepts `message-*` keys as well as `custom-*`; the Send to guest dialog is reused; the send is gated on `customTemplates`.
- [x] AI Assistant `get_property_template_content` lists and reads messages; the tool description names them.
- [x] Team permissions label `templates.standard:edit` is now **Stay guide and messages**.
- [x] Quick replies: the Azure location literal is gone (map link only) and the check-in reply points at the booking's own times.
- [ ] Tests: a Deno test for chat send of a message template and a Playwright `@ci` case for Inbox insert as text. Existing chat template tests still pass.

### Phase 7: Cross-surface wiring, docs, QA

- [x] Copy settings: the Templates group clones `subject`, `guest_visible`, `guest_phase` and folders (matched by name, with new folders created on the target). Both the base and asset-aware groups share one reader/writer.
- [x] AI Assistant tools read the registry, so guest messages and guide sections are listed and readable; the tool description names messages.
- [x] Setup guide: no "Review email templates" step exists in `setupGuideSteps.ts` today, so there was nothing to relabel. N/A.
- [ ] QA matrix below run on local and dev. Needs the local stack and live cron triggers; the code gates are green but the manual walk was not run in this session.

## Verification matrix

| Template                               | Trigger locally                                                                                 | Check                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Stay guide sections                    | Booking at Ready for check-in, open `/properties/:slug/stay-guide?token=`                       | Chapters, visibility, conditions (pet/parking booking), secrets before/after reveal |
| Trip page sections                     | Same booking, `/properties/:slug/trip`                                                          | Phase filtering, built-ins before custom                                            |
| Booking request received / New booking | Submit the guest form                                                                           | Guest + team mail, subjects, no empty sentences                                     |
| Booking confirmed, GAF, pet            | Proceed from Pending review                                                                     | GAF/pet subjects unchanged; approval reply still matches (`approval-email-webhook`) |
| Check-in details                       | Move to Ready for check-in (balance > 0 and = 0)                                                | Payment blocks hide at ₱0; access note only with essentials                         |
| Arrival reminder                       | Run `pre-arrival-reminders` with a T-2 booking                                                  | Toggle respected, no ₱0 balance line                                                |
| Parking reminder                       | Run `send-parking-reminders`                                                                    | Template + toggle                                                                   |
| Check-out and deposit refund           | Run `sd-refund-cron` scoped to a booking                                                        | Host's Check-out section embedded, refund button present                            |
| Review request / reminder              | Run `review-lifecycle-cron`                                                                     | Template + toggles                                                                  |
| Cancellation set (4) + request expired | Cancel as host, as guest, request + approve/decline, record refund, run `pending-review-expiry` | Right key per case; host intro matches the case                                     |
| Request expiring                       | `pending-review-expiry` at day 5                                                                | View booking button                                                                 |
| Guest messages                         | Inbox Insert → Templates → Messages; Send to guest by email                                     | Editable text in composer; email send gated on Free                                 |
| Test send                              | Send test on any email                                                                          | Arrives at own address with `[Test]`; 11th send in an hour rejected                 |
| Copy settings                          | Copy Templates to another property                                                              | Subject, visibility, folders copied                                                 |

Gates per phase: `bun run ci:quality`, `bun run test:edge`, `bun run test:edge:handlers`, targeted Playwright `@ci` specs. Mobile check at 375 / 768 / 1280 for every changed screen.

## Plans, permissions, audit

- **plans:** no new key. See D16. `docs/architecture/plans-feature-matrix.md` gains rows for message email send and the pre-arrival toggle. Tier-gate tests in `planGateCoverage.test.ts`.
- **permissions:** no new leaf. See D17. Server checks in `property-templates-settings`, `send-property-template-test-email`, message send.
- **activity-log:** `settings.template_saved` metadata gains `subject_changed`, `guest_visible`, `guest_phase`; message email send reuses `booking.custom_template_sent` with `metadata.category`; new toggles go through the existing `settings.updated`. Test send: N/A (no org state change, goes only to the caller). Backfill: N/A (one-shot maintenance, runbook entry instead).
- **sentry:** new edge function uses the `serveAdmin` seam; render failures in crons keep `recordCronItemFailure`.

## Docs to update

- `docs/guides/routes/org/property/templates.md` (groups, catalog, subjects, test send, visibility, validation, Host-facing knowledge Q&A)
- `docs/guides/routes/org/property/settings.md` (Email automations rows + Edit template links)
- Stay guide and trip route guides (`docs/guides/routes/stay-guide.md`, `docs/guides/routes/trip.md`)
- `docs/guides/routes/org/property/inbox.md` (Messages insert)
- `docs/guides/routes/org/assistant.md` (template context)
- `docs/architecture/guest-emails.md` (table rows 10 to 17 point at real keys; building admin and team tables)
- `docs/architecture/data-model.md` (`subject`, `default_hash`, `message`)
- `docs/architecture/edge-functions.md`, `docs/PROJECT.md`, `docs/architecture/overview.md` (new function, catalog)
- `.cursor/rules/booking-workflow.mdc` (email side-effect table, toggles)
- `docs/archive/operations/migration-runbook.md` (backfill)
- `docs/guides/support/faqs.md` + Host-facing knowledge, then `check:support-content` and `check:ai-knowledge-coverage`
- `.claude/skills/emails` / `.cursor/skills/emails` (registry and catalog are the source of truth)

## Open questions

1. **GAF cancellation notice to the building admin.** Ship `email-building-admin-cancellation`? Recommended: **yes**, default on only for properties with a GAF requirement, host can switch it off. Cancelled guests otherwise stay on the building's approved list.
2. **GAF name.** Code uses both "Guest Advice Form" (6) and "Guest Advise Form" (9). Recommended: "Guest Advice Form", applied everywhere in the same change.

## Review and hardening (2026-11-19)

Self-review and a focused security pass found and fixed:

- **Registry drift:** the ten message keys were in the pack and metadata but missing from `BUILTIN_CONTENT`, so they never serialized. A new contract test compares the pack keys with the registry.
- **Chat links:** chat never passed the property slug, so `trip_url` and `review_url` rendered empty in guest messages. The slug is now resolved and passed.
- **Guest link scrub order:** building-admin and team emails blanked guest links before the parking CTA was re-injected. The scrub now runs last.
- **OTP bypass scope:** `publicPagesAutosaveGate` could skip re-auth for subject and visibility writes. The bypass is now limited to standard guide content with no subject or visibility change.
- **Send rate limit:** `send-property-custom-template-email` now has a per-user, per-property limit.
- **Tenant link minting:** a booking from another property can no longer mint guide or chat links under this property.
- **Review lookup:** the review email booking read is scoped by property.
- **Subject entities:** subjects decode HTML entities so a property name with `&` reads correctly.
- **Preview samples:** the new email and message templates have sample sections, including the trip CTA.
- **Backfill:** collects matches first, then deletes, and prints matched property ids in the dry run.
- **Accessibility:** the active rail row now meets color contrast.

Tests added: pack/registry contract, message and guide metadata, subject lock and hash, subject validation, message token rules, preview sample coverage, message insert E2E, subject and test-send E2E, and the chat-link regression is covered by the Inbox message E2E path.

## Local verification (2026-11-19)

- Restarted the shared local stack from this worktree so the edge runtime served these functions, then applied the canonical seed (`seed:verify` passed).
- Templates rail on `/org/kame-homes/property/kame-home/templates`: 12 Stay guide, 10 Guest messages, 12 Guest emails, 3 Building admin, 3 Team alerts before the pruning pass. Labels, Hidden badges, Subject, Send test and the new default copy all render.
- Guest stay guide with a real token: Welcome, Check-in, House rules, Emergency and safety and Check-out render; Getting here, Using the unit and Building amenities stay hidden; Pet guidelines stay hidden without pets. Trash and recycling appears inside Using the unit when that section is on; Around the area is no longer a default.
- Inbox Insert -> Messages inserts editable text with the guest first name and the property check-in time.
- Fixed from this pass: labels to host language, guide reading order, registry phase default, blank chat name/time, message CTA blocks, and block placeholders nesting inside a paragraph (left an empty paragraph in the guide).
- The Supabase CLI `db query` was killed by the host during `seed:local` (exit 137); the same seed SQL was applied through the database container and `99-verify` passed. Local CLI issue, not a seed failure.

## Redesign pass (2026-11-19)

- Rail: 10 Stay guide, 9 Guest messages, 12 Guest emails, 3 Building admin, 3 Team alerts. Hidden sections show a muted badge, group counts are right-aligned, and group headings stay pinned while scrolling.
- Editor at 1440, 1024, 768 and 375: identity header, icon facts row, full-width Subject with resolved placeholder, one action row, Switch and Select controls, and Save disabled until the draft changes.
- Standard preview (`Check-in`, `Welcome`) renders real dates, times, unit, address, contact card and map CTA in the sandboxed iframe. No raw `{{tokens}}`.
- Email preview (`Booking confirmed`, `Check-in details`) renders the production shell with sample guest data. Subject placeholders read "Monaco 2604 - Check-in details (July 10, 2026 to July 12, 2026)".
- No console errors on the Templates route.
- Stay guide token URL still renders only the visible sections after the trash merge and local-guide removal.

## Verification results

| Gate                                  | Result                                            |
| ------------------------------------- | ------------------------------------------------- |
| `bun run type-check`                  | pass                                              |
| `bun run lint`                        | 0 errors                                          |
| `bun run test:fast`                   | pass (6459 unit tests, 84 DOM tests)              |
| `bun run build`                       | pass                                              |
| Deno `_shared` suite                  | 2082 passed, 0 failed                             |
| `bun run check:support-content`       | pass (201 FAQs)                                   |
| `bun run check:ai-knowledge-coverage` | pass (79 guides)                                  |
| `bun run test:support-content`        | pass                                              |
| `bun run check:plan-catalog`          | not run (needs a fresh local DB)                  |
| Manual QA matrix                      | not run (needs the local stack and cron triggers) |
| Production deploy                     | not run; requires `kamewave`                      |

## Follow-ups (not in this plan)

- Parking templates module for parking listings (reuse registry, catalog and editor with a parking pack).
- Non-condo packs (house, villa, resort) once there is demand.
- Scheduled check-in day and mid-stay emails, if hosts ask for automation beyond Guest messages.

---

## Appendix A: Default copy (condo pack)

Rules applied: plain words, short sentences, no em or en dashes, vocabulary from `guestJourneyCopy.ts`, optional data only through blocks that hide when empty, no secrets, block tokens on their own line. Lists are written as `<li>text</li>` here for review; stored defaults use TipTap canonical `<li><p>text</p></li>`.

### Stay guide

**`welcome-note`** (Welcome, on)

```html
<h2>Welcome</h2>
<p>Hi {{guest_first_name}}, welcome to {{property_name}}. We are happy to host you.</p>
<p>
  This guide covers your stay from arrival to check-out: how to get in, how things work, and what to
  do before you leave. Keep it open on your phone during your stay.
</p>
<p>{{contact_section}}</p>
```

**`getting-here`** (Getting here, off until reviewed)

```html
<h2>Getting here</h2>
<p>{{property_name}} is at {{property_address}}.</p>
<p>{{map_cta_section}}</p>
<h3>By car</h3>
<ul>
  <li>Use the main gate and tell the guard you are staying at {{tower_and_unit_number}}.</li>
  <li>Drop off at your tower lobby. Do not leave your car in the drop-off area.</li>
  <li>If you booked parking, see the Parking section of this guide.</li>
</ul>
<h3>By taxi or ride-hailing</h3>
<p>Set the pin to the address above and ask to be dropped at your tower lobby.</p>
```

**`check-in-instructions`** (Check-in, on)

```html
<h2>Check-in</h2>
<p>
  Check-in is from <strong>{{check_in_time}}</strong> on <strong>{{check_in_date}}</strong>. If you
  plan to arrive earlier, message us first so we can check if the unit is ready.
</p>
<h3>At the lobby</h3>
<ol>
  <li>Go to the reception desk of your tower.</li>
  <li>Show a valid ID for each registered guest.</li>
  <li>Tell the receptionist you are checking in to <strong>{{tower_and_unit_number}}</strong>.</li>
  <li>Collect the access card or visitor pass if the building gives one.</li>
</ol>
<h3>Getting into the unit</h3>
<p>
  Your door code and Wi-Fi details are under Essentials at the top of this guide. They appear
  shortly before check-in.
</p>
<p>
  Only guests registered with the building can stay in the unit. Visitors need our approval first.
</p>
```

**`house-rules`** (House rules, on)

```html
<h2>House rules</h2>
<p>
  Please follow these rules during your stay. They keep the unit in good shape and keep us on good
  terms with the building and our neighbors.
</p>
<p>{{house_rules_list}}</p>
<h3>Building rules</h3>
<p>
  The building's own rules apply to all guests, including rules for the lobby, elevators, pool and
  common areas. Building staff may ask you to follow them at any time.
</p>
<h3>Damage</h3>
<p>
  Tell us about any damage or broken item as soon as you notice it. Damage beyond normal use may be
  charged to you or deducted from your security deposit.
</p>
```

**`using-the-unit`** (Using the unit, off until reviewed)

```html
<h2>Using the unit</h2>
<h3>Air conditioning</h3>
<p>Keep doors and windows closed while the aircon is on, and turn it off when you go out.</p>
<h3>Water heater</h3>
<p>Switch on the heater a few minutes before your shower and switch it off after.</p>
<h3>Kitchen</h3>
<ul>
  <li>Cookware, plates and utensils are in the kitchen cabinets.</li>
  <li>Please wash and put away what you use.</li>
  <li>Never leave the stove on unattended.</li>
</ul>
<h3>TV and internet</h3>
<p>The Wi-Fi details are under Essentials. Sign out of your streaming accounts before you leave.</p>
<h3>If something stops working</h3>
<p>Message us right away. Please do not try to repair appliances yourself.</p>
```

**`building-amenities`** (Building amenities, off until reviewed)

```html
<h2>Building amenities</h2>
<p>
  As our guest, you may use the building amenities below. The building sets the hours, fees and
  rules.
</p>
<h3>Swimming pool</h3>
<ul>
  <li>Bring your access card or visitor pass. The pool desk may ask for it.</li>
  <li>Wear proper swimwear.</li>
  <li>An adult must watch children at all times.</li>
  <li>No glass or alcohol in the pool area.</li>
</ul>
<h3>Gym</h3>
<p>Wear workout clothes and closed shoes. Wipe down equipment after use.</p>
<h3>Common areas</h3>
<p>Keep noise down in hallways and elevators, and do not leave items in the corridor.</p>
<p>Ask the reception desk for today's hours.</p>
```

**`trash-and-recycling`** (Trash and recycling, off until reviewed)

```html
<h2>Trash and recycling</h2>
<p>The building requires waste segregation. Please sort your trash before you throw it out.</p>
<ul>
  <li><strong>Biodegradable:</strong> food scraps and kitchen waste</li>
  <li><strong>Recyclable:</strong> plastic bottles, cans and clean paper</li>
  <li><strong>Residual:</strong> everything else</li>
</ul>
<p>Collection schedule: {{garbage_schedule}}</p>
<p>Before you check out, bag all trash and take it to the garbage room or chute on your floor.</p>
```

**`parking-reminders`** (Parking, on, only for bookings with `need_parking`)

```html
<h2>Parking</h2>
<p>Parking is only for guests who arranged a slot with us before arrival.</p>
<h3>Your vehicle</h3>
<ul>
  <li>Plate number: <strong>{{car_plate_number}}</strong></li>
  <li>Vehicle: {{car_brand_model}}, {{car_color}}</li>
</ul>
<h3>Parking rules</h3>
<ul>
  <li>Park only in the slot assigned to you.</li>
  <li>Show your parking pass when the guard asks for it.</li>
  <li>Do not park in reserved, PWD or loading areas.</li>
  <li>Keep valuables out of sight.</li>
</ul>
```

**`pet-guidelines`** (Pet guidelines, on, only for bookings with `has_pets`)

```html
<h2>Pet guidelines</h2>
<p>Your pet is welcome for this stay. Please follow these rules so we can keep hosting pets.</p>
<ul>
  <li>Keep your pet on a leash or in a carrier in the lobby, elevators and common areas.</li>
  <li>Pets are not allowed in the pool, gym or other amenities.</li>
  <li>Clean up after your pet right away, inside and outside the unit.</li>
  <li>Do not leave your pet alone in the unit for long periods.</li>
  <li>Keep your pet off beds and sofas unless you cover them with your own blanket.</li>
</ul>
<p>
  Extra cleaning or damage caused by your pet may be charged or deducted from your security deposit.
</p>
```

**`emergency-and-safety`** (Emergency and safety, on)

```html
<h2>Emergency and safety</h2>
<p>In an emergency, call <strong>911</strong> first, then tell us.</p>
<p>{{emergency_contacts_section}}</p>
<h3>Fire</h3>
<ul>
  <li>Find the nearest fire exit on your floor when you arrive.</li>
  <li>Use the stairs, never the elevator.</li>
</ul>
<h3>Earthquake</h3>
<ul>
  <li>Drop, cover and hold on until the shaking stops.</li>
  <li>Leave by the stairs once it is safe and follow building staff.</li>
</ul>
<h3>Power or water interruption</h3>
<p>If the power or water goes out, message us and we will check with the building.</p>
```

**`local-guide`** (Around the area, off, `requiresEdit`)

```html
<h2>Around the area</h2>
<h3>Food and coffee</h3>
<ul>
  <li>[Restaurant or cafe]: [what to order, how far]</li>
</ul>
<h3>Groceries and essentials</h3>
<ul>
  <li>[Store]: [distance, opening hours]</li>
</ul>
<h3>Getting around</h3>
<ul>
  <li>[Transport tip]</li>
</ul>
<h3>Things to do</h3>
<ul>
  <li>[Place]: [why we like it]</li>
</ul>
```

**`check-out-instructions`** (Check-out, on; also embedded in the check-out email)

```html
<h2>Check-out</h2>
<p>
  Check-out is by <strong>{{check_out_time}}</strong> on <strong>{{check_out_date}}</strong>. Need
  more time? Message us before your check-out day and we will check if a late check-out is possible.
</p>
<h3>Before you leave</h3>
<ol>
  <li>Bag all trash and take it out. Please do not leave unwashed dishes.</li>
  <li>Turn off the lights, aircon and appliances. Leave the refrigerator on.</li>
  <li>Close the windows and lock the door.</li>
  <li>Check closets, drawers, the bathroom and outlets for your belongings.</li>
  <li>
    Return the access card and visitor pass to the lobby reception, or where we asked you to leave
    them.
  </li>
  <li>Message us once you have left so we can inspect the unit.</li>
</ol>
```

### Guest messages

**`message-balance-reminder`** (Balance reminder)

```html
<p>
  Hi {{guest_first_name}}, a reminder that your remaining balance for your stay on {{check_in_date}}
  is <strong>{{total_guest_balance}}</strong>.
</p>
<p>{{gcash_payment_section}}</p>
<p>Once paid, upload your receipt on your trip page: {{trip_url}}</p>
```

**`message-document-follow-up`** (Missing documents)

```html
<p>
  Hi {{guest_first_name}}, we still need a few documents before your stay on {{check_in_date}}. The
  building needs them to register you as a guest.
</p>
<p>Please upload them on your trip page: {{trip_url}}</p>
```

**`message-check-in-day`** (Check-in day)

```html
<p>Hi {{guest_first_name}}, today is check-in day. The unit is ready from {{check_in_time}}.</p>
<p>Your arrival steps and access details are on your trip page: {{trip_url}}</p>
<p>Message us here if anything comes up on the way. Safe travels.</p>
```

**`message-early-check-in`** (Early check-in)

```html
<p>Hi {{guest_first_name}}, thanks for asking. Check-in starts at {{check_in_time}}.</p>
<p>
  We can't confirm an early check-in yet because it depends on when the unit is ready after the
  previous guest. We will message you on {{check_in_date}} as soon as we know.
</p>
```

**`message-late-check-out`** (Late check-out)

```html
<p>
  Hi {{guest_first_name}}, thanks for asking. Check-out is by {{check_out_time}} on
  {{check_out_date}}.
</p>
<p>
  A late check-out depends on whether a guest arrives after you. We will confirm by the evening
  before. An extra fee may apply.
</p>
```

**`message-mid-stay`** (Checking in)

```html
<p>
  Hi {{guest_first_name}}, we hope you are enjoying your stay at {{property_name}}. Is everything
  working well in the unit?
</p>
<p>If you need anything, like extra towels or help with an appliance, message us here.</p>
```

**`message-noise-reminder`** (Noise reminder)

```html
<p>
  Hi {{guest_first_name}}, the building let us know about noise from the unit. Please keep the
  volume down, especially during quiet hours ({{quiet_hours}}).
</p>
<p>Repeated complaints can lead to a fine from the building. Thank you for understanding.</p>
```

**`message-check-out-reminder`** (Check-out reminder)

```html
<p>
  Hi {{guest_first_name}}, a reminder that check-out is tomorrow, {{check_out_date}}, by
  {{check_out_time}}.
</p>
<p>The check-out steps are on your trip page: {{trip_url}}</p>
<p>Please message us once you have left the unit so we can start the inspection.</p>
```

**`message-thank-you`** (Thank you)

```html
<p>
  Hi {{guest_first_name}}, thank you for staying at {{property_name}}. We hope you had a great time.
</p>
<p>If you have a minute, we would appreciate a short review: {{review_url}}</p>
<p>We would be happy to host you again.</p>
```

**`message-lost-and-found`** (Item left behind)

```html
<p>
  Hi {{guest_first_name}}, we found something in the unit after your stay: <strong>[item]</strong>.
</p>
<p>
  Let us know if it is yours and how you want to get it back. We can keep it for you for a few
  weeks, or send it to you at your cost.
</p>
```

### Guest emails

**`email-booking-request-received`** (Booking request received)
Subject: `{{tower_and_unit_number}} - Booking request received {{stay_dates}}`

```html
<p>Hi {{guest_first_name}},</p>
<p>
  Thanks for your booking request for <strong>{{property_name}}</strong> from
  <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong> ({{nights_label}},
  {{guests_label}}).
</p>
<p>Your request is not confirmed yet. Here is what happens next.</p>
<p>{{booking_request_received_flow_section}}</p>
<p>{{email_signature_section}}</p>
```

**`email-booking-acknowledgement`** (Booking confirmed)
Subject: `{{tower_and_unit_number}} - Booking confirmed {{stay_dates}}`

```html
<p>Hi {{guest_first_name}},</p>
<p>Good news. Your booking at <strong>{{property_name}}</strong> is confirmed.</p>
<p>{{booking_acknowledgement_flow_section}}</p>
<p>Thank you for choosing {{property_name}}. We look forward to hosting you.</p>
<p>{{email_signature_section}}</p>
```

**`email-ready-for-checkin`** (Check-in details)
Subject: `{{tower_and_unit_number}} - Check-in details {{stay_dates}}`

```html
<p>Hi {{guest_first_name}},</p>
<p>
  You are all set for your stay at <strong>{{property_name}}</strong>. Here are your check-in
  details.
</p>
<p>{{trip_cta_section}}</p>
<p>{{ready_for_checkin_booking_summary_section}}</p>
<p>{{payment_breakdown_section}}</p>
<p>{{gcash_payment_section}}</p>
<p>{{document_reminders_section}}</p>
<p>{{arrival_access_note_section}}</p>
<p>{{stay_guide_cta_section}}</p>
<p>{{ready_for_checkin_contact_section}}</p>
<p>{{email_signature_section}}</p>
```

**`email-pre-arrival-reminder`** (Arrival reminder)
Subject: `{{tower_and_unit_number}} - Check-in on {{check_in_date}}`

```html
<p>Hi {{guest_first_name}},</p>
<p>
  Your stay at <strong>{{tower_and_unit_number}}</strong> starts on
  <strong>{{check_in_date}}</strong>. Check-in is from {{check_in_time}}, and check-out is by
  {{check_out_time}} on {{check_out_date}}.
</p>
<p>{{balance_due_section}}</p>
<p>Directions, house rules and your arrival steps are on your trip page.</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>
```

**`email-parking-reminder`** (Parking reminder)
Subject: `{{tower_and_unit_number}} - Reserve parking for your stay`

```html
<p>Hi {{guest_first_name}},</p>
<p>
  You mentioned you need parking for your stay at <strong>{{tower_and_unit_number}}</strong> on
  {{check_in_date}}, and you have not reserved a slot yet.
</p>
<p>Slots are limited, so book one before you arrive.</p>
<p>{{parking_cta_section}}</p>
<p>{{email_signature_section}}</p>
```

**`email-sd-refund-form-request`** (Check-out and deposit refund)
Subject: `{{tower_and_unit_number}} - Check-out and deposit refund {{stay_dates}}`

```html
<p>Hi {{guest_first_name}},</p>
<p>
  Thank you for staying with us. Your check-out is by <strong>{{check_out_time}}</strong> on
  <strong>{{check_out_date}}</strong>.
</p>
<p>{{check_out_instructions_section}}</p>
<p>{{sd_refund_details_section}}</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>
```

System block copy for `{{sd_refund_details_section}}`: title "Deposit refund"; text "After you check out, fill out the refund form so we can return your security deposit of {amount}. We send it after we inspect the unit."; button "Request deposit refund".

**`email-review-request`** (Review request)
Subject: `How was your stay at {{property_name}}?`

```html
<p>Hi {{guest_first_name}},</p>
<p>Thank you for staying at <strong>{{property_name}}</strong>. We hope you had a good stay.</p>
<p>
  Would you leave a short review? It helps future guests and helps us improve. You have
  {{review_window_days}} days to write it.
</p>
<p>We will not see your review until we have reviewed your stay too, or until the window closes.</p>
<p>{{review_cta_section}}</p>
<p>{{email_signature_section}}</p>
```

**`email-review-reminder`** (Review reminder)
Subject: `Reminder: review your stay at {{property_name}}`

```html
<p>Hi {{guest_first_name}},</p>
<p>
  The review window for your stay at <strong>{{property_name}}</strong> closes soon. If you have a
  minute, we would like to hear how it went.
</p>
<p>{{review_cta_section}}</p>
<p>{{email_signature_section}}</p>
```

**`email-booking-cancelled-guest`** (Booking cancelled)
Subject: `{{tower_and_unit_number}} - Booking cancelled {{stay_dates}}`

```html
<p>Hi {{guest_first_name}},</p>
<p>{{cancellation_intro}}</p>
<p>
  This was for your stay at <strong>{{tower_and_unit_number}}</strong> from
  <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>.
</p>
<p>{{cancellation_detail_section}}</p>
<p>
  If a refund is due, we send it based on the cancellation policy above. You can check its status on
  your trip page.
</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>
```

**`email-request-expired-guest`** (Request expired)
Subject: `{{tower_and_unit_number}} - Request expired {{stay_dates}}`

```html
<p>Hi {{guest_first_name}},</p>
<p>
  Your booking request for <strong>{{property_name}}</strong> from
  <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong> expired because it was
  not confirmed in time. Nothing was charged.
</p>
<p>
  We are sorry about that. If the dates are still open, you can send the request again from your
  trip page.
</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>
```

**`email-cancellation-request-guest`** (Cancellation request)
Subject: `{{tower_and_unit_number}} - {{cancellation_request_title}}`

```html
<p>Hi {{guest_first_name}},</p>
<p><strong>{{cancellation_request_title}}</strong></p>
<p>{{cancellation_request_message}}</p>
<p>{{cancellation_detail_section}}</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>
```

`{{cancellation_request_message}}` by state: received "We received your request to cancel. We will review it and let you know."; approved "Your cancellation is approved. Any refund due is shown below."; declined "We could not approve your cancellation request, so your booking stays active. Our note is below."

**`email-refund-sent-guest`** (Refund sent)
Subject: `{{tower_and_unit_number}} - Refund sent`

```html
<p>Hi {{guest_first_name}},</p>
<p>
  We sent your refund for your stay at <strong>{{tower_and_unit_number}}</strong>. Depending on your
  bank or e-wallet, it may take a few days to show.
</p>
<p>{{cancellation_detail_section}}</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>
```

### Building admin

**`email-gaf-request`** (GAF request, subject locked: `{unit} - GAF Request ({in} to {out})` with system urgent/update prefixes)

```html
<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>
  Please find attached the Guest Advice Form (GAF) for
  <strong>{{tower_and_unit_number}}</strong> for the stay from <strong>{{check_in_date}}</strong> to
  <strong>{{check_out_date}}</strong> ({{guests_label}}).
</p>
<p>
  Kindly review it for approval. You can reply to this email with the approved form, or let us know
  if you need anything else.
</p>
<p>Thank you.</p>
<p>{{email_signature_section}}</p>
```

**`email-pet-request`** (Pet request, subject locked)

```html
<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>
  We would like to request approval for our guest to bring a pet to
  <strong>{{tower_and_unit_number}}</strong> from <strong>{{check_in_date}}</strong> to
  <strong>{{check_out_date}}</strong>. The pet details are below, and the documents are attached.
</p>
<p>{{pet_details_section}}</p>
<p>{{pet_attachments_section}}</p>
<p>You can reply to this email with the approved form, or let us know if you need anything else.</p>
<p>Thank you.</p>
<p>{{email_signature_section}}</p>
```

**`email-building-admin-cancellation`** (GAF cancellation, pending open question 1)
Subject: `{{tower_and_unit_number}} - GAF cancellation {{stay_dates}}`

```html
<p>Good day,</p>
<p>
  Please cancel the GAF we sent for <strong>{{tower_and_unit_number}}</strong> for the stay from
  <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>. The booking was
  cancelled, and these guests will not check in.
</p>
<p>Thank you.</p>
<p>{{email_signature_section}}</p>
```

### Team alerts

**`email-new-booking-request`** (New booking request)
Subject: `{{tower_and_unit_number}} - New booking request {{stay_dates}}` (system urgent prefix kept)

```html
<p>{{urgent_notice}}</p>
<p>
  <strong>{{guest_name}}</strong> sent a booking request for
  <strong>{{tower_and_unit_number}}</strong>. Please review it soon so the guest is not left
  waiting.
</p>
<p>{{new_booking_detail_tables}}</p>
<p>{{downpayment_receipt_ai_section}}</p>
<p>{{booking_link_cta}}</p>
```

**`email-request-expiring-host`** (Request expiring)
Subject: `{{tower_and_unit_number}} - Request expires in {{expires_in_days}} days {{stay_dates}}`

```html
<p>Hi,</p>
<p>
  <strong>{{guest_name}}</strong> asked for <strong>{{tower_and_unit_number}}</strong> from
  {{check_in_date}} to {{check_out_date}}, and the request is still waiting for your decision.
</p>
<p>
  If no one answers it, it expires in {{expires_in_days}} days. The dates are released and the guest
  is told. Nothing has been charged, so there is nothing to refund.
</p>
<p>{{booking_link_cta}}</p>
```

**`email-booking-cancelled-host`** (Booking cancelled)
Subject: `{{tower_and_unit_number}} - {{cancellation_host_title}} {{stay_dates}}`

```html
<p>Hi,</p>
<p>{{cancellation_host_intro}}</p>
<p>{{cancellation_detail_section}}</p>
<p>{{booking_link_cta}}</p>
```

`{{cancellation_host_intro}}` by case: guest cancelled "{guest} cancelled their booking."; guest asked "{guest} asked to cancel. Approve or decline it from the booking."; host or system "This booking was cancelled." `{{cancellation_host_title}}`: "Cancellation" or "Cancellation requested".
