---
title: 'Development Settings — operator guide'
status: active
tags: [guides, routes, admin, developments]
updated: 2026-09-27
---

# Development Settings — operator guide

Route: `/admin/developments/:developmentSlug`

> **Status:** Documented · a **← Developments** back link now sits above the pinned header
> (`AdminSectionNavLayout` header slot).

## Progress overview

| Section               | E2E save | Validation | Docs | Notes                                                             |
| --------------------- | -------- | ---------- | ---- | ----------------------------------------------------------------- |
| Basic Information     | Done     | Done       | Done | Name, slug, developer, type, status, description                  |
| Photos & Videos       | Done     | Done       | Done | Shared `PropertyMediaUpload`; saves immediately on reorder/upload |
| Email automations     | Done     | Done       | Done | PMO email (optional)                                              |
| Document Requirements | Done     | Done       | Done | Ordered checklist for PENDING_DOCUMENTS (all properties in dev)   |
| Unit types            | Done     | Done       | Done | Per-type max adults/children capacity presets                     |
| Pool                  | Done     | Done       | Done | Pool fee (PHP) + schedule                                         |
| Guest information     | Done     | Done       | Done | Requirements, guides, other info for guests + AI                  |
| Announcements         | Done     | Done       | Done | Host Announcements page for this development                      |
| Amenities             | Done     | —          | Done | Suggested chips + free-text add                                   |
| Location              | Done     | Done       | Done | Location line + `PropertyLocationPicker`                          |
| Structure             | Done     | Done       | Done | Tower/unit labels, towers, parking towers, formats                |
| History               | Done     | Done       | Done | Last 10 settings versions, one-click restore                      |
| Danger Zone           | Done     | Done       | Done | Delete blocked (409) while linked                                 |

---

## Overview

Single-development settings page for a super admin to edit a development's public profile and manage its lifecycle. All sections save together via one **Save Changes** action in the page header when dirty (no sticky footer), except the media gallery, which persists immediately on upload/reorder/delete.

**Access:** `RequireSuperAdmin` (`SUPER_ADMIN_EMAILS`).

---

## Host-facing knowledge

This page is where the platform team maintains the shared profile for a condo or subdivision project - its name, photos, amenities, location, and the property-management-office email that receives approval requests for every unit inside it. Hosts with a unit inside a registered development benefit from this shared information automatically; they don't edit it themselves.

**Common host questions**

- Q: Can I update my building's development photos or amenities myself?
  A: No. Development-level details are managed by the platform team, since they're shared across every unit in the project. Contact the platform team if something needs updating.
- Q: What happens to my unit if the development profile is deleted?
  A: The platform team can't delete a development while properties or parking slots are still linked to it - they'd need to reassign or remove those first, so this shouldn't affect an active unit unexpectedly.

---

## Basic Information

### Fields

| Field       | Storage                       | Validation                                                                      |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------- |
| Name        | `developments.name`           | 2–160 chars, unique across developments                                         |
| URL slug    | `developments.slug`           | Non-empty, unique; changing it redirects the page                               |
| Developer   | `developments.developer_name` | Optional                                                                        |
| Type        | `developments.type`           | One of `CONDOMINIUM` / `SUBDIVISION` / `MIXED_USE` / `TOWNHOUSE` / `COMMERCIAL` |
| Status      | `developments.status`         | `ACTIVE` / `INACTIVE`                                                           |
| Description | `developments.description`    | Optional free text                                                              |

### Save path

1. **Save Changes** → **`PATCH update-development`** with `developmentId` + changed fields.
2. On success, if the returned `slug` differs from the URL param (name/slug edit), the page navigates to the new slug in place.

---

## Photos & Videos

Reuses the property media-upload component (`PropertyMediaUpload`), scoped by `developmentId` instead of `propertyId`. Uploads/deletes/reorders call **`upload-development-media`** directly and persist immediately — they are not part of the batched Save Changes flow. First uploaded (or first reordered-to-front) image becomes `cover_image_url` automatically. Limits mirror property media (max image/video counts, per-type size caps) from `_shared/propertyMedia.ts`.

---

## Email automations

| Field     | Storage                          | Validation                                                                                                                                                                                    |
| --------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PMO email | `developments.settings.pmoEmail` | Optional; must be a valid email if set. Canonical **To:** for GAF/pet approval request emails for every property in this development (overrides legacy per-property `app_settings.email_to`). |

Receives GAF and pet approval requests for **all** properties inside this development (see `.cursor/rules/booking-workflow.mdc` for the request-email flow itself; this field only configures the recipient).

---

## Document Requirements

Ordered checklist of documents required before a booking reaches **Ready for check-in** — applies to every property whose `residence_name` matches this development.

| Field         | Storage                                                       | Notes                                                           |
| ------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Document list | `developments.settings.workflowDefaults.documentRequirements` | JSON array; empty list → bookings skip `PENDING_DOCUMENTS` (D2) |

Each row: **label**, **trigger** (Always required / Guest has pets / Guest needs parking), **approval source** (Manual / Email listener), **PDF template** (None / GAF request form / Pet request form), **guest-facing name**, and an **Active** toggle.

- **Label** is what the host booking rail shows. Renaming keeps the row's identity: `id` is what bookings record, so a rename never detaches a live booking (`labels.step` and the legacy `label` alias are written together).
- **Guest-facing name** is what the stay guide calls the document once approved ("Approved GAF"). Blank or retired rows are never shown.
- **Active** off retires the step: it stays in the list so bookings that already have it keep it, but it stops applying to new bookings. A retired email step also stops demanding a PMO email, and a retired row does not need a label to save.
- Steps stored as v2 (`labels`, `output`, `approval`, `active`, `legacyKind`) and old v1 rows both load; the parser upgrades v1 in memory, so saving a development rewrites its list in the v2 shape.

**PDF template** is what binds a row to the request pipeline: `requirementMatchesPdfTemplate` matches on the row's `output.pdfTemplateId` **or** the historical `gaf` / `pet` id. A row left on **None** is tracked as a checklist step only — the orchestrator generates no request PDF and sends no request email for it. Re-adding a deleted GAF/pet row creates it with id `custom-N` and no template, so the template must be set explicitly or the request stops firing.

A row is never classified as the GAF or pet document from its label or from a shared template: only the historical ids `gaf` / `pet` (`legacyKind`) drive the `gaf_*` / `pet_*` columns and the approved-file requirement. A "Carpet inspection" step stays a checklist step even if its label contains "pet".

**PDF templates** (`approvals.pdfTemplates`): `POST upload-development-pdf-template` stores a fillable PDF and returns its AcroForm field names. Each field is mapped to a `PDF_DATA_KEYS` value (`property.unitOwner`, `stay.checkInDate`, `vehicle.slot`, …); a residence template fills by that map, and a field the PDF does not have is logged and left blank rather than failing the send. Uploads are immutable: replacing a template creates a new path, so a booking that already generated its PDF never changes underneath. Azure's two templates are unchanged by this path.

Save path: batched **Save Changes** → **`PATCH update-development`** with `documentRequirements`. The handler rejects the payload if any row is missing `id`, `label`, `order`, `triggerCondition`, or `approvalSource` rather than silently dropping it.

Removing a step is blocked while a non-terminal booking's `document_requirements_snapshot` still lists it: the request fails with 409 and the count, and the editor should retire the step (**Active** off) instead. Bookings snapshot their steps when they first enter `PENDING_DOCUMENTS`, so a save never changes what an in-flight booking is waiting for.

Edge resolution for bookings: `documentRequirements.ts#resolveDocumentRequirements` (property override column deprecated; development default → **empty list**). An unconfigured development has **no** building approval steps; it never inherits another building's GAF and pet steps. A development read error **throws** so a live transition fails and retries instead of skipping documents. Existing developments were seeded with today's list by migration `20261324010300_seed_document_requirements_for_existing_developments.sql`; a new development starts empty.

---

## Unit types

Per-unit capacity presets for properties in this development. Stored in **`developments.settings.unitTypes`** (JSON array).

| Field per row | Notes                                                              |
| ------------- | ------------------------------------------------------------------ |
| `id`          | Stable slug (e.g. `studio`, `1br`, `2br`)                          |
| `label`       | Host-facing name (e.g. `Studio`, `1 bedroom`)                      |
| `maxAdults`   | Maximum adults allowed in the unit                                 |
| `maxChildren` | Maximum children allowed (occupancy rule: age ≤ 3 counts as child) |

**Azure North defaults** (when unset): Studio — 4 adults / 1 child; 1 bedroom — 6 / 2; 2 bedroom — 8 / 3.

Save path: batched **Save Changes** → **`PATCH update-development`** with `unitTypes`.

Public read: **`GET get-residence-unit-types?residenceName=`** (used by property settings + guest form capacity).

Properties pick one type under **Property Details → Unit type**; max adults/children are derived from the selection.

---

## Pool

| Field          | Storage                              | Notes                                      |
| -------------- | ------------------------------------ | ------------------------------------------ |
| Pool fee (PHP) | `developments.settings.poolFee`      | Optional; guest-safe amount for AI/inbox   |
| Pool schedule  | `developments.settings.poolSchedule` | Free text (hours, rules, seasonal closure) |

**Azure North defaults** (when unset): pool fee **₱200**; schedule **7 AM to 7 PM. Maintenance every Tuesday.**

Save path: batched **Save Changes** → **`PATCH update-development`**.

Guest-facing AI (inbox auto-reply, voice receptionist) reads these fields when the property's `residence_name` matches this development.

---

## Guest information

Building/residence facts shared across every unit in the development — surfaced to guests via AI tools, not a separate public page yet.

| Field             | Storage                                   | Notes                                      |
| ----------------- | ----------------------------------------- | ------------------------------------------ |
| Requirements      | `developments.settings.guestRequirements` | Free text (ID, noise, move-in rules, etc.) |
| Guides            | `developments.settings.guestGuides`       | JSON array `{ id, title, content }`        |
| Other information | `developments.settings.importantInfo`     | Catch-all free text for AI grounding       |

Document requirement **labels** from the Document Requirements section are also included in AI context (guest-safe checklist names only — no approval internals).

Save path: batched **Save Changes** → **`PATCH update-development`**.

---

## Announcements

Host-facing notices shown on the property/parking **Announcements** page for every org with properties or parking linked to this development (`residence_name` match).

Shown as a compact list (`HostAnnouncementAdminList`, same row style as the platform Announcements page). Clicking a row (or **Add announcement**) opens an edit dialog (`HostAnnouncementEditor`, shared `HostAnnouncementFormFields`) instead of a route — changes apply to this page's in-memory draft only and are not persisted until the page-level **Save Changes** below.

| Field per row    | Storage                                 | Notes                                                                                                                       |
| ---------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Title / message  | `developments.settings.announcements[]` | Message is rich-text HTML (WYSIWYG editor), required                                                                        |
| Severity         | same                                    | `info` / `warning` / `critical`                                                                                             |
| Active           | same                                    | Off = hidden even inside schedule window                                                                                    |
| Starts / ends    | same                                    | Optional calendar dates (Asia/Manila); no time picker — start is inclusive from that day, end is inclusive through that day |
| Link URL / label | same                                    | Optional CTA                                                                                                                |

Notices stay active until **Active** is turned off or optional **Ends** date passes (Asia/Manila day boundaries). Hosts read the full merged list under **Announcements** in the sidebar (unread red-dot on nav); the message renders as HTML there. Other dashboard pages do not show a top banner.

Platform-wide announcements (maintenance, product releases) are managed on **`/admin/announcements`**.

Save path: batched **Save Changes** → **`PATCH update-development`** with `announcements`.

---

## Amenities

Stored as `developments.settings.amenities` (string array). Suggested chips toggle on/off; a free-text input appends custom entries not in the suggestion list.

---

## Location

| Field                                                                       | Storage                                                                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Location line                                                               | `developments.location`                                                                            |
| Address / city / province / country / zip / lat / lng / Maps URL / place ID | `developments.settings.{address,city,province,country,zipCode,latitude,longitude,mapsUrl,placeId}` |

Uses the shared `PropertyLocationPicker`. The location line auto-suggests from city + province when it was previously empty or itself auto-generated (`shouldAutoUpdateDevelopmentLocationLine`) — a manually-typed location line is never overwritten by the picker.

---

## Structure

The building's physical rules, stored in **`developments.settings.structure`** (migration `20261324000400`). This is the runtime source of truth for hosts and the server.

| Field                    | Storage                                        | Notes                                                                                                              |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Tower label / unit label | `structure.towerLabel` / `structure.unitLabel` | Shown in onboarding, the New listing dialog and property settings (`Phase`, `Block & Lot`, …)                      |
| Tower required           | `structure.towersRequired`                     | `false` hides the tower field for a subdivision or lot-only residence                                              |
| Floors max               | `structure.floorsMax`                          | Nullable                                                                                                           |
| Towers                   | `structure.propertyTowers[]`                   | `{ name, code, active }`. Case-insensitive uniqueness, max 60                                                      |
| Parking towers           | `structure.parkingTowers[]`                    | `{ name, code, active, levels[], parkingType }`. Per-tower levels, `inside_tower` / `outside_tower` / `motorcycle` |
| Unit format              | `structure.unitNumberFormat`                   | `digits4` / `digits` / `alnum` / `custom` + `pattern` + `example`                                                  |
| Slot format              | `structure.parkingSlotFormat`                  | `digits1to4` / `alnum` / `custom` + `pattern` + `example`                                                          |

Save path: batched **Save Changes** → **`PATCH update-development`** with `structure`. The handler normalises it with the shared resolver and rejects an invalid shape (empty labels, duplicate tower or level, a custom pattern that does not compile or does not match its example, floors outside 1–200). The flat `propertyTowers` / `parkingTowers` / `parkingLevels` keys are written from `structure` for compatibility until Phase 7 retires them.

The same structure drives the public reads **`list-residence-options`** (onboarding, New listing) and **`get-residence-profile`**.

---

## History and concurrent edits

Every save that changes `settings` writes the **previous** settings into `development_settings_history` (`development_id`, `settings`, `saved_by`, `saved_by_email`, `saved_at`). `GET get-development` returns the last 10 versions as metadata only (`id`, `savedAt`, `savedByEmail`); the payload stays on the server.

**Restore** → **`PATCH update-development`** with `restoreHistoryId`. The server checks the version belongs to this development, replaces `settings` wholesale, writes a `development.settings_restored` super-admin audit event, and returns the restored row. Restore is disabled while the draft has unsaved edits.

**Concurrent edits.** Save sends the `updatedAt` it loaded as `expectedUpdatedAt`. A second admin saving from a stale tab gets **409** with a message; the toast offers **Reload**, which refetches the latest version. Nothing is overwritten silently.

Platform-level writes emit `super_admin_audit_events` (`development.settings_updated`, `development.renamed`, `development.settings_restored`), not org `activity_log`, because a development is not org-scoped.

---

## Danger Zone

**Delete** → **`POST delete-development`**. Server counts `properties` and `parkings` rows whose `residence_name` matches the development's `name` (case-sensitive exact match) and returns **409** ("Cannot delete a development that still has linked properties or parking slots") if either count is `> 0`. The UI disables the Delete button and shows the same reason whenever `stats.propertyCount` or `stats.parkingCount` is non-zero.

---

## API reference

| Action       | Endpoint                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------- |
| Get          | `GET get-development?slug=` — single development + stats                                  |
| Update       | `PATCH update-development` — `{ developmentId, ...changed fields }`                       |
| Delete       | `POST delete-development` — `{ developmentId }`; `409` if properties/parking still linked |
| Upload media | `POST upload-development-media?development_id=` — FormData `file`                         |
| Delete media | `DELETE upload-development-media?development_id=` — `{ storagePath                        | mediaId }` |

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Concern               | Path                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                  | `ui/src/features/dashboard/super-admin/pages/SuperAdminDevelopmentDetailPage.tsx`                                                                                                                         |
| Settings shell        | `ui/src/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentSettingsCard.tsx`                                                                                           |
| Section fields        | `ui/src/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentProfileSections.tsx`, `DevelopmentGuestInfoSection.tsx`                                                     |
| Form draft / diff     | `ui/src/features/dashboard/super-admin/lib/developmentSettingsForm.ts`                                                                                                                                    |
| Media adapter         | `ui/src/features/dashboard/super-admin/lib/developmentMedia.ts`                                                                                                                                           |
| Location auto-suggest | `ui/src/features/dashboard/super-admin/lib/developmentLocation.ts`                                                                                                                                        |
| Constants             | `ui/src/features/dashboard/super-admin/lib/developmentSettingsConstants.ts`                                                                                                                               |
| Query hooks           | `ui/src/features/dashboard/super-admin/hooks/useDevelopments.ts`, `ui/src/features/dashboard/super-admin/hooks/useUploadDevelopmentMedia.ts`                                                              |
| Edge functions        | `supabase/functions/get-development/index.ts`, `supabase/functions/update-development/index.ts`, `supabase/functions/delete-development/index.ts`, `supabase/functions/upload-development-media/index.ts` |

---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

---

## Related docs

- [Route index](../README.md)
- [Developments list guide](./developments.md)
- [`docs/PROJECT.md`](../../PROJECT.md)

---

## Pending / follow-ups

- [ ] None known.
