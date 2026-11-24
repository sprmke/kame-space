---
title: 'Property templates'
status: active
tags: [guides, routes, org, property]
updated: 2026-11-19
---

# Property templates

Route: `/org/:orgSlug/property/:propertySlug/templates`

> **Status:** Documented — admin UI, DB persistence, workflow email sends, custom template manual send, and chat templates shipped

## Purpose

Each template card shows a **title**, **subtitle** (built-in description from the server registry; custom templates use a generic fallback), a single **Edit / Preview** switch, and one action row with Placeholders, Send test (emails), Reset (built-ins), Save, and a `More` menu for custom-template actions. On phone the view switch is icon-only and Save stays labelled; Placeholders is icon-only until `xl`.

**New template default group:** The page-header **New template** action opens the create dialog with **Custom** preselected, so a host-owned template lands in the ungrouped Custom list instead of in the middle of the ten built-in guide sections. Opening **Add template** from a group heading or folder still preselects that destination. **Move** always offers **Custom**, so a template filed in a folder can return to the ungrouped list.

**Custom templates → Send to guest (shipped):** Custom template cards show **Send to guest** in the More menu once the saved content has no unsaved edits. It opens a dialog to search/pick a booking (guest name, date, or status). Each result shows the guest's email under the name, and the selected row carries a check plus a screen-reader "Selected" label, so the host can confirm the address before sending. While bookings load, the list is row skeletons. The send button keeps a spinner only while the email is sending. It sends that exact saved content to the booking's guest email immediately — not tied to booking status or an automation toggle, and no cooldown. Uses the same `renderPropertyTemplateSendEmail` shell as every other template send. Requires `bookings.detail.workflow:edit` (same leaf as the booking-detail manual workflow email resends). Skipped (with a toast) if the guest's email is on the suppression list. Emits `booking.custom_template_sent` to the org activity log on success (`booking` category, `metadata.template_key` / `template_name`).

**Chat templates (shipped):** the property's standard and custom templates are also selectable in **Guest Inbox → Insert (`+`) → Templates** and in the **AI Assistant → Pin context → Templates**. Email templates are excluded from both. The Inbox opens the same preview as this page, then sends a snapshot into the thread; web chat renders the snapshot as a rich card, Meta DMs receive flattened text. The AI Assistant receives the template body as context, not a message. No new plan key or permission leaf: standard templates stay free and custom templates inherit `customTemplates`; Inbox listing uses `inbox:view`, sending uses `inbox.messages:edit`, and assistant listing uses `templates:view`.

**Plans/RBAC decision (Send to guest):** No new `PlanFeatureKey` — a custom template only exists on Starter+ (creating one is already gated by `customTemplates`), so the send action inherits that gate transitively; a Free org has no custom template card to send from. No new permission leaf — reuses `bookings.detail.workflow:edit`, the same booking-mutation-adjacent leaf that already gates manual workflow email resends from the booking detail page.

On **phone/tablet**, the page scrolls inside the section layout (`AdminSectionNavLayout` + `AdminMobilePage` flex height chain). Desktop keeps the sticky section sidebar + content scrollport.

Operators edit per-property copy here. **Preview and live sends use the same renderer** (`renderPropertyTemplateSendEmail` + `fragments/configurable-template-send.html`). Dynamic blocks (tables, payment breakdown, CTAs) are **`{{placeholders}}` in the template body** — visible in Preview when sample/send HTML is injected.

### Rail groups

The rail is built from the server registry, not a hand-kept UI list. `GET property-templates-settings` returns `group`, `recipient`, `trigger`, `automationToggleKey`, `iconId`, `chapter`, `condition` and `placeholderKeys` per template.

| Order | Group          | Contents                                                                                        |
| ----- | -------------- | ----------------------------------------------------------------------------------------------- |
| 1     | Stay guide     | Guide sections in reading order. Always visible so hosts can add templates.                     |
| 2     | Guest messages | Host-sent replies. Only visible when the property has messages.                                 |
| 3     | Guest emails   | Automated guest mail. Always visible.                                                           |
| 4     | Building admin | GAF, pet and GAF cancellation. Hidden when the property has no GAF or pet document requirement. |
| 5     | Team alerts    | Mail to the property's team inbox.                                                              |
| 6     | Folders        | Host-created folders.                                                                           |
| 7     | Custom         | Ungrouped host-owned templates.                                                                 |

The type filter is **All types**, **Stay guide**, **Messages**, **Emails**, **Custom**. Hidden guide sections carry a muted **Hidden** badge next to the row title instead of a plain word in the meta line.

Built-in content and default subjects live in `supabase/functions/_shared/propertyTemplateDefaults/condo.ts`. Every property resolves to the condo pack until other packs exist. `properties.type` is read by the resolver, so a new pack is a content file plus a resolver branch.

### Guest messages

Nine ready-to-send messages live under **Guest messages**: balance reminder, missing documents, check-in day, early check-in, late check-out, noise reminder, check-out reminder, thank you, and item left behind. They use the same placeholders as emails and can go by chat or email. The generic mid-stay "checking in" message was removed as noise; the check-in day and check-out reminder messages cover the useful moments.

In **Guest Inbox → Insert (`+`) → Messages** a message is inserted as editable text in the composer, so bracketed fill-ins like `[item]` can be changed before sending. **Send to guest** by email uses the same booking picker as custom templates and needs Starter or above.

### Subjects and test send

Every email template shows a compact facts row with the recipient, trigger and automation state (On, Off, or Needs plan), a **Subject** field and **Send test** in the action row. GAF and pet subjects are read-only and marked **Fixed**, because inbound approval matches those subject lines. The Subject placeholder shows the shipped default filled with this property's real unit, guest dates and property name, so hosts never see raw `{{tokens}}`.

The subject is the saved `subject` column when set, otherwise the shipped default. Plain placeholders are filled from the same values as the body; block placeholders are rejected in a subject. **Send test** renders the current draft with this property's real data and mails it to the signed-in account, subject prefixed `[Test]`. It never goes to a guest, so automation switches do not apply. Ten sends per user per hour.

Settings -> Email automations rows link back here with **Edit template**.

Template bodies (and section images) are bulk-copyable via org **Properties → Copy settings**.

**Plan gating (`customTemplates`, Starter+):** Built-in guide sections and built-in Guest messages are free: edit, preview, placeholders, reset, and save with no plan gate and no WYSIWYG blur. Email templates stay editable/previewable on Free; **Reset** always restores the shipped default (ungated `action: reset`); **Save** opens the upgrade modal when not entitled (server also gates email-key content PATCH). **New template** (page header / mobile hero) and create/save **custom or host-owned** templates require Starter+ — client pre-flight plus `property-templates-settings` (`action: create`, custom-key PATCH, and email-key PATCH). Delete custom stays open. Cards that need Starter to save (automated emails and host-owned templates) show a `TierBadge`. The **Email templates** and **Custom templates** section headings also show a `TierBadge` when the org is below Starter.

### Permissions (Phase 5)

Route/nav: `templates:view`. In-page: `templates.standard:edit`, `templates.email:edit`, `templates.custom:{add,edit,delete}`. Members without an edit leaf get a **preview-only** pane: the Edit tab is not rendered, the rich text body is not mounted, and Save/Reset/Delete/New template are absent. Add Custom is hidden without `templates.custom:add`.

Built-in Guest messages use `templates.standard:edit` and save free. A host-created message lives under a `custom-*` key, so it uses `templates.custom:edit` and the Starter+ `customTemplates` gate, like any host-owned template.

## Host-facing knowledge

Templates is where you customize the text guests and your team receive: ten stay guide sections (welcome, getting here, check-in, house rules, using the unit, building amenities, parking, pets, emergency and safety, check-out) and automated emails (booking confirmations, document requests, check-in details). Preview renders the same layout that goes out to guests, using this property's address, unit, times and contact details.

**Mobile editor chrome:** the Edit/Preview switch is icon-only on phone. Placeholders, Reset and Save sit in one action row; Save stays labelled. The guest visibility block uses a proper switch and the standard select control, not native browser inputs.

**Common host questions**

- Q: Which templates do guests actually see?
  A: Ten stay guide sections are available. Welcome, check-in, house rules, emergency and safety, and check-out show by default; getting here, using the unit, and building amenities start hidden until you review the copy and switch them on. Parking shows only when the booking needs parking, and pets only when the guest brings a pet. Email templates are used for automated messages throughout the booking process.
- Q: Where do I upload Stay Guide section photos?
  A: **Public Pages → Stay Guide → Edit → Content**. Templates still edits the text for those sections, but section images upload only in the Stay Guide page editor (with live preview).
- Q: If I mess up an email template, can I undo it?
  A: Yes. Use **Reset** on any built-in template to restore the original wording, including dynamic sections like payment tables and signatures. Reset works on Free; saving your own edits still needs Starter.
- Q: Can I customize email templates on Free?
  A: You can open, edit, and reset them. Saving your changes requires Starter. Standard stay-guide templates can be edited and saved on Free.
- Q: Can I use these templates in chat?
  A: Yes. In Guest Inbox, open **Insert** (`+`) and pick a template under **Templates**. You see the full preview before sending. Web chat shows your template as a card the guest can open; Facebook and Instagram get the same words as plain text. In the AI Assistant, pin a template as context to rewrite or reuse it. Email templates stay email-only.
- Q: Do custom templates get sent automatically?
  A: No, custom templates are never part of the automated booking workflow. Use the **Send to guest** action on a custom template to send it to a specific booking's guest on demand. The built-in sections and emails are the only ones wired to guest-facing pages and automated status-driven sends.
- Q: Why do I need a code to save a template?
  A: Template text can reach guests and building admins, so saving, resetting, or creating a template asks the org owner for a one-time email code first. Renaming, moving, or deleting does not.
- Q: Why is the custom template action asking me to upgrade?
  A: Custom templates and saving email templates are on Starter and above. You can still fully edit and save the standard stay-guide templates on Free, and you can preview, edit, and reset email copy. Save prompts you to upgrade.

## Integration status

### Shipped

| Layer                           | Behavior                                                                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin UI**                    | Load, edit, save, reset, custom create/delete, Edit/Preview, placeholders insert, image resize                                                                                                                       |
| **Persistence**                 | `property_template_contents` per `property_id` + `template_key`; optional **`section_image_url`** (standard only — uploaded from Stay Guide Page Editor); built-ins fall back to shipped defaults when no row exists |
| **API**                         | `GET/PATCH property-templates-settings`, `POST property-templates-preview`, `POST upload-property-template-asset` (section + inline images)                                                                          |
| **Preview**                     | Standard: server-rendered HTML with this property's real values in a sandboxed iframe. Email: same send shell + `buildSampleDynamicSections()` as production                                                         |
| **Workflow sends**              | `emailService.ts` → `renderPropertyTemplateSendEmail()` resolves DB/default body, substitutes plain + dynamic section placeholders, wraps in send shell                                                              |
| **Custom template manual send** | `POST send-property-custom-template-email` → `sendPropertyCustomTemplateEmail()` — booking picker dialog, on-demand send, no status/automation gate                                                                  |

### Standard templates → guest stay guide (shipped)

All ten **standard** guide keys (`welcome-note`, `getting-here`, `check-in-instructions`, `house-rules`, `using-the-unit`, `building-amenities`, `parking-reminders`, `pet-guidelines`, `emergency-and-safety`, `check-out-instructions`) render on the token-gated guest page **`/properties/:slug/stay-guide?token=`** during the booking access window. See **[[stay-guide|Guest stay guide (token-gated brochure)]]**.

The default set was pruned: trash and recycling now lives inside **Using the unit**, and the placeholder-heavy **Around the area** section was removed. Hosts who want a local guide can add a custom template.

**Stay guide preview** — use **Public Pages → Stay Guide → Edit** (live preview) or open the Stay Guide card's preview URL. Templates edits body copy only; it does not include a **Preview stay guide** button.

### Standard sections inside emails

`{{check_in_instructions_section}}`, `{{check_out_instructions_section}}` and `{{house_rules_section}}` embed the host's guide section in an email. The check-out and deposit refund email uses `check_out_instructions_section` by default, so the guest gets the same check-out steps as the stay guide. Legacy `{{sd_refund_checklist_section}}` rows keep rendering until reset.

### Email send path

| UI `template_key`                  | `emailService` function        | Dynamic section placeholders                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email-gaf-request`                | `sendEmail`                    | `{{urgent_notice}}`, `{{update_notice}}`, `{{email_signature_section}}`                                                                                                                                                                         |
| `email-pet-request`                | `sendPetEmail`                 | `{{urgent_notice}}`, `{{update_notice}}`, `{{pet_details_section}}`, `{{pet_attachments_section}}`, `{{email_signature_section}}`                                                                                                               |
| `email-new-booking-request`        | `sendNewBookingRequestNotify`  | `{{urgent_notice}}`, `{{new_booking_detail_tables}}`, `{{downpayment_receipt_ai_section}}`, `{{booking_link_cta}}`                                                                                                                              |
| `email-booking-request-received`   | `sendBookingRequestReceived`   | `{{booking_request_received_flow_section}}`, `{{email_signature_section}}`                                                                                                                                                                      |
| `{{trip_cta_section}}`             | any guest email                | Renders "View your booking". A body that places `{{trip_url}}` itself suppresses the button, so the guest never sees two links to the same place.                                                                                               |
| `email-booking-acknowledgement`    | `sendBookingAcknowledgement`   | `{{booking_acknowledgement_flow_section}}`, `{{email_signature_section}}`                                                                                                                                                                       |
| `email-ready-for-checkin`          | `sendReadyForCheckin`          | `{{ready_for_checkin_booking_summary_section}}`, payment/GCash sections (empty when total balance is 0), `{{document_reminders_section}}`, `{{stay_guide_cta_section}}`, `{{ready_for_checkin_contact_section}}`, `{{email_signature_section}}` |
| `email-sd-refund-form-request`     | `sendSdRefundFormRequest`      | `{{sd_refund_checklist_section}}` (check-out time from the booking, property time fallback), `{{sd_refund_details_section}}`                                                                                                                    |
| `email-booking-cancelled-guest`    | `sendBookingCancelledGuest`    | `{{cancellation_intro}}`, `{{cancellation_detail_section}}`, `{{trip_cta_section}}`, `{{email_signature_section}}`                                                                                                                              |
| `email-booking-cancelled-host`     | `sendBookingCancelledHost`     | `{{cancellation_detail_section}}`, `{{email_signature_section}}`                                                                                                                                                                                |
| `email-cancellation-request-guest` | `sendCancellationRequestGuest` | `{{cancellation_request_title}}`, `{{cancellation_detail_section}}`, `{{trip_cta_section}}`, `{{email_signature_section}}`                                                                                                                      |
| `email-refund-sent-guest`          | `sendRefundSentGuest`          | `{{cancellation_detail_section}}`, `{{trip_cta_section}}`, `{{email_signature_section}}`                                                                                                                                                        |

Static files under `email-templates/*.html` remain for reference; live sends use the configurable body + send shell above. The retired `email-parking-request` template is no longer listed or editable: property parking broadcast emails were removed and parking uses **Find parking** / `linkStay`. Any stored row for that key is ignored.

## Sections

| Group    | Keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard | `welcome-note`, `getting-here`, `check-in-instructions`, `house-rules`, `using-the-unit`, `building-amenities`, `parking-reminders`, `pet-guidelines`, `emergency-and-safety`, `check-out-instructions`                                                                                                                                                                                                                                                                                                                                         |
| Messages | `message-balance-reminder`, `message-document-follow-up`, `message-check-in-day`, `message-early-check-in`, `message-late-check-out`, `message-noise-reminder`, `message-check-out-reminder`, `message-thank-you`, `message-lost-and-found`                                                                                                                                                                                                                                                                                                     |
| Email    | `email-gaf-request`, `email-pet-request`, `email-new-booking-request`, `email-booking-request-received`, `email-booking-acknowledgement`, `email-ready-for-checkin`, `email-pre-arrival-reminder`, `email-parking-reminder`, `email-sd-refund-form-request`, `email-review-request`, `email-review-reminder`, `email-booking-cancelled-guest`, `email-request-expired-guest`, `email-cancellation-request-guest`, `email-refund-sent-guest`, `email-building-admin-cancellation`, `email-request-expiring-host`, `email-booking-cancelled-host` |
| Custom   | `custom-{uuid}` — operator-created; sent on demand to a picked booking's guest via **Send to guest**                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Built-in defaults ship in `propertyTemplates.ts` on the server. Rows in `property_template_contents` override defaults per property.

**Requirement-aware acknowledgement.** The "What's next" steps are built from what this property
actually requires for this booking. A property with no GAF requirement never mentions the GAF or
the building administration; a pet requirement names the pet form instead. The follow-up email
is called the **check-in details email**, never a "Booking Confirmation email".

**Custom templates can reach guests.** A custom template has **Show to guests** plus a trip-stage
picker (`always / before / arrival / stay / checkout / after`). Visible ones render as collapsed
"From your host" sections on the guest trip page and as chapters in the stay guide.

**Reset to default** restores shipped body copy including dynamic section placeholders (each on its own paragraph). Existing saved rows from before this layout will not show tables/CTAs until reset or placeholders are added manually.

## Save paths

| Action                                                                                          | API                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load all                                                                                        | `GET property-templates-settings?property_id=`                                                                                                                                                |
| Save standard content                                                                           | `PATCH property-templates-settings` `{ templateKey, content, sectionImageUrl?, settingsVerificationToken }` — free on every tier; **org-owner OTP** required (same modal as Payment settings) |
| Save email content                                                                              | same PATCH shape — requires **`customTemplates`** (429 + `upgradeHook` when not entitled); Free UI opens upgrade modal on Save; OTP after upgrade check                                       |
| Reset built-in to default                                                                       | `PATCH` `{ action: "reset", templateKey, settingsVerificationToken }` — free on every tier (including email); OTP required                                                                    |
| Upload section / inline image                                                                   | `POST upload-property-template-asset` multipart `assetType`, `file`, `templateKey` (section only) — stages only; content save still OTP-gated                                                 |
| Create custom                                                                                   | `PATCH` `{ action: "create", name, content, settingsVerificationToken }` — **`customTemplates`** + OTP                                                                                        |
| Save custom content                                                                             | `PATCH` `{ templateKey: "custom-…", content, name?, settingsVerificationToken }` — same **`customTemplates`** + OTP as create                                                                 |
| Delete custom                                                                                   | `PATCH` `{ action: "delete", templateKey }` — no OTP (organise / remove only)                                                                                                                 |
| Rename / move / folders                                                                         | organise PATCHes — no OTP                                                                                                                                                                     |
| Preview (all templates)                                                                         | `POST property-templates-preview` `{ templateKey, category, content, subject?, name? }`                                                                                                       |
| Send test to me                                                                                 | `POST send-property-template-test-email` `{ templateKey, category, content, subject?, name? }` — caller's own address, 10 per user per hour                                                   |
| Auth: `verifyAdminJwt` + property scope via `property_id` query (same as other admin settings). |                                                                                                                                                                                               |

**OTP (org owner).** Saving template content, resetting a built-in template, or creating a custom template opens **Verify template changes** (same **Send OTP** → code → **Verify and save** flow as [Property Settings → Payment](settings.md)) on the **first** content write (or after the window expires). Code goes to the **org owner** email only. After a successful verify, the tab keeps a **15-minute fixed sudo token** (sessionStorage, per property) so further Save / Reset / Create in that window skip the modal. Payment settings stay fingerprint-bound per save. Server rejects content writes without a valid `settingsVerificationToken` for action `property_templates` (stable fingerprint `property_templates`, not content-hash). **Exception:** Stay Guide / Page Editor autosave (`publicPagesAutosaveGate: true`) stays ungated so typing there is not interrupted. That bypass is limited to standard guide content: a request that also changes a subject, Show to guests or trip stage still needs the OTP. Rename, move, folder CRUD, and delete do not require OTP.

## Preview

- **Both categories** render through `POST property-templates-preview` in a sandboxed iframe, so what the host sees is what the send path renders.
- **Standard:** the preview edge function starts from the shipped sample variables, then overlays `buildPropertyPlaceholderVars({ propertyId })`. Address, unit, map link, contact card, house rules, amenities and other property-data blocks resolve with this property's real values. No raw `{{tokens}}` reach the iframe.
- **Email:** **`renderPropertyTemplatePreview`** calls **`renderPropertyTemplateSendEmail`** with `contentOverride`, sample vars, and **`buildSampleDynamicSections()`** for section placeholders present in the template body (same layout as production sends).

The preview shows the rendered subject above the body. Preview and send are aligned on `fragments/configurable-template-send.html`. The preview pane owns its own scroll; the header and action row stay fixed. When the open template uses a property token that is empty, the editor lists it above the body so the host can fill the missing setting.

**Phone editor chrome:** the back control is an icon button on the title row (it used to be a full-width "All templates" row), and the template description is hidden below `sm`, so the editor body starts roughly one row higher on a phone. The tab strip becomes a single **Preview** pill for read-only members.

**Empty and error states:** an empty library shows **No templates yet** with no Reload prompt, because nothing failed. A failed load shows a centered **Templates did not load** message with **Try again** in the content area, not a full-width empty card.

## Placeholders

Each template card has a **Placeholders** button (next to Edit / Preview). Tap a token to copy + insert at the editor cursor (modal closes); use the copy icon to copy only.

### Block-level section placeholders

Full-width dynamic blocks (tables, CTAs, urgent/update callouts, signatures, etc.) must each sit on **their own paragraph** — one `{{token}}` per `<p>` line, never inline with other copy or other section tokens.

| Rule          | Detail                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Insert**    | Placeholders modal + editor insert put block-level tokens on a new paragraph automatically (`PROPERTY_BLOCK_PLACEHOLDER_KEYS` in `templatePlaceholderCatalog.ts`).                            |
| **Defaults**  | Shipped bodies in `propertyTemplates.ts` put `{{urgent_notice}}` and `{{update_notice}}` **above** `Good day,` on GAF, pet, and parking templates (new booking: urgent above intro only).     |
| **Normalize** | `normalizeBlockLevelPlaceholdersInHtml()` splits inline section tokens; `normalizeEmailCalloutPlaceholders()` moves callouts above the salutation and inserts missing tokens on load/preview. |
| **Reset**     | Restores the shipped default layout when operators want a clean starting point.                                                                                                               |

Block-level keys include: `urgent_notice`, `update_notice`, `new_booking_detail_tables`, `downpayment_receipt_ai_section`, `booking_link_cta`, `pet_details_section`, `pet_attachments_section`, `booking_vehicle_copy`, `parking_reply_callout_section`, `booking_acknowledgement_flow_section`, all ready-for-check-in sections, `sd_refund_checklist_section`, `sd_refund_details_section`, and `email_signature_section`.

**`{{urgent_notice}}`** — GAF, pet, and new booking request templates only (empty when check-in is not same-day in Asia/Manila). **`{{update_notice}}`** — GAF and pet request templates only (empty on first send; amber callout on resubmit). **Preview** shows sample HTML for both when those placeholders are in the saved body.

### Placeholder context rules

The server catalog (`_shared/propertyTemplateCatalog.ts`) decides what each template may use. Saving enforces it:

| Token kind                             | Stay guide | Guest messages | Guest emails | Building admin | Team alerts |
| -------------------------------------- | ---------- | -------------- | ------------ | -------------- | ----------- |
| Guest, stay, property, contact         | Yes        | Yes            | Yes          | Yes            | Yes         |
| Arrival essentials (non-secret)        | Yes        | Yes            | Yes          | No             | Yes         |
| Secrets (`wifi_password`, `door_code`) | Yes        | No             | No           | No             | No          |
| Tokenized guest links and CTA blocks   | Yes        | Yes            | Yes          | No             | No          |
| `booking_link`, `booking_link_cta`     | No         | No             | No           | No             | Yes         |

Secrets save only in Stay guide templates and render reveal-gated. Everywhere else they read "on your trip page". A secret or guest link in a forbidden template returns **400** naming the token. Unknown tokens save but return warnings, and the editor shows them.

`GET property-templates-settings` also returns `propertyEmptyPlaceholders`, the property-data tokens that are empty for this property. The editor lists the ones the open template actually uses, so a host can fill the missing setting before a guest sees a blank line.

**New blocks:** `contact_section`, `emergency_contacts_section`, `house_rules_list`, `amenities_list`, `check_in_instructions_section`, `check_out_instructions_section`, `house_rules_section`, `balance_due_section`, `arrival_access_note_section`, `review_cta_section`, `parking_cta_section`, `map_cta_section`, `messages_cta_section`, `cancellation_policy_section`, `garbage_schedule_section`, `quiet_hours_section`.

## WYSIWYG in real email

At send time, `prepareConfigurableEmailBodyHtml()`:

- Adds inline image styles (`max-width:100%`, block display) when missing
- Absolutizes root-relative links (`href="/…"`) using `publicGuestAppOrigin`

Admin-authored HTML is trusted (not stripped). Plain placeholder **values** are HTML-escaped; dynamic section HTML is injected pre-rendered.

## DB

Table **`property_template_contents`**: `property_id`, `template_key`, `category`, `name` (custom only), `content`, `updated_at`.

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Dirty compares the draft to the **normalized** editor baseline (`normalizePropertyTemplateEditorContent`), not raw stored HTML — load-time callout/block normalize alone must not prompt. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Layer                       | Path                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                        | `ui/src/features/dashboard/bookings/pages/TemplatesPage.tsx`                                                                                              |
| Editor card                 | `ui/src/features/dashboard/bookings/components/property-templates/PropertyTemplateEditorCard.tsx`                                                         |
| WYSIWYG                     | `ui/src/features/dashboard/bookings/components/property-templates/RichTextEditor.tsx`                                                                     |
| Hooks                       | `ui/src/features/dashboard/bookings/hooks/usePropertyTemplates.ts`                                                                                        |
| Registry / defaults         | `supabase/functions/_shared/propertyTemplates.ts`                                                                                                         |
| Send render                 | `supabase/functions/_shared/propertyTemplateEmail.ts`                                                                                                     |
| Dynamic sections            | `supabase/functions/_shared/propertyTemplateEmailSections.ts`                                                                                             |
| Block placeholder normalize | `supabase/functions/_shared/normalizeBlockLevelPlaceholders.ts` (+ UI mirror `ui/src/features/dashboard/bookings/lib/normalizeBlockLevelPlaceholders.ts`) |
| Preview render              | `supabase/functions/_shared/propertyTemplatePreview.ts`                                                                                                   |
| Settings API                | `supabase/functions/property-templates-settings/index.ts`                                                                                                 |
| Preview API                 | `supabase/functions/property-templates-preview/index.ts`                                                                                                  |
| **Send path**               | `supabase/functions/_shared/emailService.ts` → `renderPropertyTemplateSendEmail()`                                                                        |
| **Custom send dialog**      | `ui/src/features/dashboard/bookings/components/property-templates/SendCustomTemplateDialog.tsx`                                                           |
| **Custom send hook**        | `ui/src/features/dashboard/bookings/hooks/usePropertyTemplates.ts` → `useSendPropertyCustomTemplateEmail()`                                               |
| **Custom send API**         | `supabase/functions/send-property-custom-template-email/index.ts` → `sendPropertyCustomTemplateEmail()` (`_shared/emailService.ts`)                       |

## Dynamic branding (subjects, From, shell)

Workflow emails resolve labels from the database via **`propertyEmailBranding.ts`**:

| Field                                                           | Source                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organization name** (shell `{{brandName}}`, logo alt, footer) | `organizations.name`                                                                                                                                                                                                                |
| **Property name** (`{{property_name}}` placeholder)             | `properties.name`                                                                                                                                                                                                                   |
| **Unit label** (shell subtitle, subjects, From display name)    | Booking/form `tower_and_unit_number` → **`app_settings.gaf_tower_and_unit_number`** → **`properties.tower_and_unit`** → property name                                                                                               |
| **From email address**                                          | **`RESEND_FROM_EMAIL`** env, else **`app_settings.email_reply_to`**. Sends go through **`sendResendEmail`**, which CID-inlines off-domain images (e.g. org logos on Supabase Storage) so Resend deliverability insights stay clean. |
| **From display name**                                           | e.g. `{unit} - GAF Request` or `{unit} - {org}` for guest mail                                                                                                                                                                      |
| **Logo**                                                        | **`org_settings.email_logo_url`** (via merged app settings)                                                                                                                                                                         |
| **Brand color**                                                 | Org/property `brandColor` (property override → org settings) — the picker hex, same as admin `--primary` / `bg-primary`. Email CTA labels stay white.                                                                               |
| **Body copy**                                                   | **`property_template_contents`** (Templates page)                                                                                                                                                                                   |

Platform defaults (not property-specific): **`DEFAULT_EMAIL_LOGO_URL`** when org has no logo; **`PUBLIC_GUEST_APP_ORIGIN`** for link absolutization; preview sample placeholders still use demo values in the UI catalog.

## Dynamic section data sources (live sends)

Preview uses **`buildSampleDynamicSections()`** with demo dates/names/phones. **Production sends** resolve real values from booking rows + org/property settings (never legacy Kame Space / Monaco 2604 literals).

| Section placeholder                             | Templates                                              | Live data source                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{{urgent_notice}}`                             | GAF, pet, parking, new booking                         | Same-day check-in vs Asia/Manila today                                                                                                                    |
| `{{update_notice}}`                             | GAF, pet, parking                                      | Resubmit flag + unit label from branding                                                                                                                  |
| `{{email_signature_section}}`                   | GAF, pet, parking, acknowledgement, ready-for-check-in | `app_settings.gaf_unit_owner` + unit label                                                                                                                |
| `{{pet_details_section}}`                       | Pet request                                            | Guest form / booking pet fields                                                                                                                           |
| `{{pet_attachments_section}}`                   | Pet request                                            | Static attachment list (no property-specific copy)                                                                                                        |
| `{{parking_reply_callout_section}}`             | Parking request                                        | Static ops callout                                                                                                                                        |
| `{{booking_vehicle_copy}}`                      | Parking request                                        | Booking vehicle fields + unit label                                                                                                                       |
| `{{new_booking_detail_tables}}`                 | New booking notify                                     | Booking stay/guest/notable columns                                                                                                                        |
| `{{downpayment_receipt_ai_section}}`            | New booking notify                                     | `dp_receipt_ai_*` on booking (empty when absent)                                                                                                          |
| `{{booking_link_cta}}`                          | New booking notify                                     | Admin booking URL + org brand color                                                                                                                       |
| `{{booking_acknowledgement_flow_section}}`      | Acknowledgement                                        | Unit + booking dates; step 2 includes Facebook + Airbnb “message us on …” links; ends with a **View your booking** button (trip page)                     |
| `{{ready_for_checkin_booking_summary_section}}` | Ready for check-in                                     | Booking dates/times/pax + unit label                                                                                                                      |
| `{{document_reminders_section}}`                | Ready for check-in                                     | GAF always; parking/pet lines from `need_parking` / `has_pets`                                                                                            |
| `{{payment_breakdown_section}}`                 | Ready for check-in                                     | Booking pricing columns (empty when total balance is 0). For Airbnb, shows **Stay: Paid through Airbnb** plus only pet, parking, and additional fee rows. |
| `{{gcash_payment_section}}`                     | Ready for check-in                                     | All payment methods (account name/number); QR image only when uploaded (empty section when total balance is 0)                                            |
| `{{ready_for_checkin_contact_section}}`         | Ready for check-in                                     | Facebook + Airbnb links; phone + email from property profile → org profile                                                                                |
| `{{trip_url}}`                                  | Acknowledgement, RFCI, SD refund                       | Guest [trip page](../../trip.md) URL with the booking access key                                                                                          |
| `{{facebook_page_url}}`                         | Acknowledgement, RFCI, SD refund                       | Resolved Facebook URL (`app_settings` → `org_settings`)                                                                                                   |
| `{{airbnb_url}}`                                | Acknowledgement, RFCI, SD refund                       | Resolved Airbnb URL (`app_settings` → `org_settings`)                                                                                                     |
| `{{contact_name}}`                              | Acknowledgement, RFCI, SD refund                       | Property `contactName` → org `contactName`                                                                                                                |
| `{{contact_phone}}`                             | Acknowledgement, RFCI, SD refund                       | Property `contactPhone` → org `contactPhone`                                                                                                              |
| `{{contact_email}}`                             | Acknowledgement, RFCI, SD refund                       | Property `contactEmail` → org `contactEmail`                                                                                                              |
| `{{social_contact_mentions}}`                   | Acknowledgement, RFCI, SD refund                       | “message us on **Facebook** or **Airbnb**” — only platform names linked                                                                                   |
| `{{sd_refund_checklist_section}}`               | SD refund                                              | Unit label (elevator card step)                                                                                                                           |
| `{{sd_refund_details_section}}`                 | SD refund                                              | Security deposit amount, `/sd-form` URL, brand color                                                                                                      |

Plain body placeholders (`{{guest_name}}`, `{{property_name}}`, etc.) are filled by **`buildBookingPlaceholderVars()`** from the booking row + **`loadPropertyEmailBranding()`** + merged app settings.

Implementation: **`guestContactInfo.ts`** (contact resolution), **`propertyTemplateEmailSections.ts`** (section HTML builders), **`emailService.ts`** (send-time injection).

## Edge cases

- Custom templates capped at **20** per property.
- Content max **120 000** characters.
- Reset writes the shipped default back to DB (same as PMA).
- Unknown `{{tokens}}` in saved content render as an empty string at send, not as literal braces. Preview and the Placeholders dialog flag unknown or out-of-context tokens so a typo is visible before a guest sees it.
- **Base64 / data-URI images** from the editor may be blocked or inflate message size in some clients — prefer HTTPS image URLs.
- **Existing saved templates** may lack dynamic section placeholders until **Reset to default** or manual insert; inline section tokens are auto-split onto separate lines on load/save/render via `normalizeBlockLevelPlaceholdersInHtml`.
- **SD refund** — default body uses `{{sd_refund_checklist_section}}` and `{{sd_refund_details_section}}` on separate lines. Saved templates with legacy `{{sd_refund_footer_section}}` still render (combined block) until reset or manual swap.
- **Ready for check-in** — payment/GCash placeholders resolve to empty strings when total guest balance is 0.
- **`house-rules`** standard template is not injected into ready-for-check-in (legacy `houseRulesSection` remains disabled for Gmail size).
- Missing `property_id` on a booking falls back to built-in defaults (no DB row).

---

## Testing

| Layer  | Path / spec                                                                                                   | Manual                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Unit   | `ui/src/features/dashboard/org/lib/templatesSudoToken.test.ts` (15m sudo sessionStorage)                      | —                                                                                                     |
| E2E    | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` templates shell (`@ci`)                             | WYSIWYG save, email send; asserts no console "duplicate" TipTap extension warnings                    |
| E2E    | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` "custom template sends to a picked booking" (`@ci`) | Send to guest: picker, POST `send-property-custom-template-email`, success toast                      |
| E2E    | `ui/e2e/features/dashboard/templates/templatesModule.spec.ts` (`@ci`)                                         | Read-only preview-only body, Custom default, Move to Custom, guest email, empty state, dock clearance |
| E2E    | `ui/e2e/features/dashboard/templates/templatesUxReview.spec.ts` (`@demo`)                                     | Every-width screenshots + layout/contrast/tap-target metrics (review evidence, never CI)              |
| Unit   | `ui/src/features/dashboard/bookings/lib/templateLibrary.test.ts` (reading order, Custom always a Move target) | —                                                                                                     |
| Manual | —                                                                                                             | First Save → OTP → persists; second Save within 15m skips modal; after expiry OTP again               |

plans: N/A — reuses existing `customTemplates` + templates.* leaves; OTP is additive safety like payment.
permissions: N/A — OTP is in addition to existing `templates.*:edit` / `:add` leaves (same pattern as payment OTP + `settings.payment:edit`).
activity-log: N/A — existing `settings.template_saved` / delete / folder events unchanged; sudo reuse is the same write path.
sentry: N/A — faults still go through existing edge / client seams.
analytics: N/A — no new host outcome beyond existing template save toasts.
