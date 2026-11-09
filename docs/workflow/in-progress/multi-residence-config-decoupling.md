---
stage: in-progress
title: 'Multi-residence support: residence profiles managed from super admin'
status: in-progress
readiness: blocked
launch_gate: manual-owner-approval
launch_blocker: >-
  Not mergeable or deployable until Phases 0 to 7 are complete, the full manual test
  matrix in §9 has passed on local Supabase, and the owner explicitly clears it.
  Merging into develop IS a production Supabase deploy in this repo.
merge_blocked: true
deploy_blocked: true
branch: feat/multi-residence-config-decoupling
tags:
  [
    planning,
    planned-modules,
    multi-tenancy,
    developments,
    architecture,
    super-admin,
    booking-workflow,
  ]
updated: 2026-11-09
---

# Multi-residence support: residence profiles managed from super admin

> ## DO NOT MERGE. DO NOT DEPLOY.
>
> `develop` is the production deploy branch in this repo (`cd-prod.yml` runs on every push to
> `develop`). Merging this branch ships migrations, edge functions and UI to production for
> every host.
>
> This plan is **merge-blocked and deploy-blocked** by `docs/workflow/merge-guard.json` plus the
> `merge-guard` CI job. The guard clears only when the owner sets `clearedAt` in that file after
> manual testing. Never remove the guard entry, mark the draft PR ready, or run a Supabase deploy
> for this branch without an explicit instruction from the owner.

> **Revised 2026-11-09 (execute-plan):** added the merge and deploy gate (`merge-guard.json`);
> added the ownership and `N/A` decisions table; added a per-phase acceptance command; added a
> verification results block; recorded that Phase 0 is the only phase shipped so far; noted that
> on this repo a `develop` merge is a production deploy, so "do not deploy" means "do not merge".

**Goal.** Onboard any residence (condo, subdivision, townhouse, mixed use) with its own rules, booking approval steps, building documents, defaults and guest-facing wording, entirely from `/admin/developments/:slug`, with no code change or deploy per residence. Azure North becomes a seeded row that behaves byte-identically to today.

**Scope decisions.**

- 2026-09-22: full audit + decouple. Storage: `developments.settings` JSONB + super-admin UI. Fallback: generic defaults, Azure seeded.
- 2026-11-09 (this revision): re-audited against everything shipped since. The plan now covers the **booking approval engine** (GAF / pet are hardcoded document kinds, not config), **per-residence PDF templates**, **inbound approval routing**, **guest-facing copy**, **property seed defaults** (amenities, house rules, templates), a **field ownership model** (what the building locks vs what the host may change), and **in-flight booking safety**. These were missing from the first draft and are where most of the real work is.

---

## 1. Executive summary

### 1.1 Still true from the first audit

Multi-tenancy is shipped. Org / property / parking scoping, RBAC, plans, a `developments` table with `settings JSONB`, and a super-admin editor at `/admin/developments/:slug` all work. This is a **config-migration and wiring effort, not a tenancy rebuild**. The org/property/parking layer, RBAC, plans and the booking status graph stay as they are.

### 1.2 What the 2026-11-09 re-audit changed

The first draft treated the problem as "112 name-matching call sites". Re-reading every Azure path end to end shows the name-matching is the smaller half. The bigger half: **everything that _does_ something with a building document branches on the literal kinds `'gaf'` and `'pet'`.** The document requirement list is configurable, but generation, emailing, inbound matching, completion rules, stay-guide labels and reminders are not.

Concrete defects found (all verified in code):

| #   | Finding                                                                                                                                                                                                                                                                                                      | Where                                                                                                                                                        | Impact on a second residence                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| F1  | **New developments default to Azure's GAF + pet steps.** `mergeDocumentRequirements(undefined)` returns `DEFAULT_DOCUMENT_REQUIREMENTS` (GAF + pet), so the editor pre-fills them and the first save writes them.                                                                                            | `developmentSettingsForm.ts`, `documentRequirements.ts` (both sides)                                                                                         | New residence silently generates Azure's GAF PDF and emails it         |
| F2  | **Unknown or blank residence falls back to Azure.** `appSettings.loadPropertyResidenceName` returns `DEFAULT_RESIDENCE_NAME` on blank; `pickPmoEmail` then resolves `AZURE_PMO_EMAIL`. `guestFormSettings`, `parsePropertyTowerUnitFromBody`, `create-property` (`?? 'Azure North Residences'`) do the same. | `_shared/appSettings.ts:414-424`, `guestFormSettings.ts:105`, `propertyTowerUnit.ts`, `create-property/index.ts:100`                                         | A non-Azure property's GAF request can be **emailed to Azure's PMO**   |
| F3  | **GAF / pet PDFs come from two global files.** `pdfService` always loads `guest-form-template.pdf` / `pet-form-template.pdf` from the `templates` bucket with a hardcoded field map. A second copy lives in `ui/public/templates` for preview.                                                               | `_shared/pdfService.ts`, `gafPdfPreview.ts`, `petPdfPreview.ts`                                                                                              | Every residence gets Azure's form layout                               |
| F4  | **Document kind is inferred from the label.** `requirementDocKind` treats any label containing `gaf` or `pet` as that kind. "Carpet inspection" becomes a pet document and then needs an approved PDF before it can be marked complete.                                                                      | `documentRequirements.ts` (both sides)                                                                                                                       | Custom steps behave unpredictably                                      |
| F5  | **Orchestrator only knows two documents.** `workflowOrchestrator` generates and emails exactly GAF and pet. A custom requirement gets no PDF, no email, no inbound match. Manual tick only.                                                                                                                  | `_shared/workflowOrchestrator.ts:460-1058`                                                                                                                   | "Move-in permit" style steps cannot be automated                       |
| F6  | **Inbound approval matching is a fixed subject regex** (`- GAF Request (d to d)`, `- Pet Request (d to d)`). Renaming a requirement label breaks auto-approval.                                                                                                                                              | `_shared/approvalEmailMatcher.ts`, `approval-email-webhook`                                                                                                  | Auto-approval only works for Azure wording                             |
| F7  | **Active tower + unit uniqueness ignores residence.** `properties_tower_unit_active_unique ON (lower(tower), unit_number)`.                                                                                                                                                                                  | migration `20261002120100`                                                                                                                                   | "Tower 1 / 0101" in two residences collide                             |
| F8  | **Unit number must be 4 digits** (`/^\d{4}$/`) on both sides.                                                                                                                                                                                                                                                | `propertyTowerUnit.ts` (both sides)                                                                                                                          | `12A`, `PH-1`, `Blk 3 Lot 5` rejected                                  |
| F9  | **Parking levels are per tower in code but flat in settings.** Bay is ground-only, tower codes (`Bay → BY`) and parking type are inferred in code. `settings.parkingLevels` is a flat list and cannot express this.                                                                                          | `parkingResidences.ts`, `parkingSlotUnit.ts`                                                                                                                 | Structured parking cannot be configured                                |
| F10 | **Azure coordinates are hardcoded in SQL**, not only TS: `pls_listing_lat` / `pls_listing_lng` in the public search index.                                                                                                                                                                                   | migration `20261316126800_public_listing_search_index.sql`                                                                                                   | Phase 3 of the first draft would have left search on the Azure literal |
| F11 | **Guest info is AI-only.** `guestRequirements`, `guestGuides`, `importantInfo`, `poolFee`, `poolSchedule` (shipped since 09-22) feed only the AI receptionist and voice tool. Guests never see them on the stay guide or property page.                                                                      | `_shared/developmentGuestInfo.ts`, `guestReceptionistTools.ts`, `voiceReceptionistTool.ts`                                                                   | Super admin writes building info that guests cannot read               |
| F12 | **Building concepts are baked into copy.** "PMO approval", "GAF", "guard house", "GAF request email to Azure", "Azure PMO confirmation" appear in guest form, success page, workflow rail hints, plan-skip toasts, email defaults and listing verification.                                                  | `GuestForm.tsx:2369`, `guestFormBranding.ts`, `workflowPlanSkip.ts`, `workflowAdvanceMode.ts`, `propertyTemplateEmailSections.ts`, `listingAuthorization.ts` | Other residences see Azure wording                                     |
| F13 | **No in-flight protection.** Requirements resolve live on every transition. Editing a residence's steps changes bookings already in `PENDING_DOCUMENTS`.                                                                                                                                                     | `resolveDocumentRequirements` callers                                                                                                                        | A super-admin edit can block or skip steps on live bookings            |
| F14 | **PMO email is required by the editor** even for a residence with no building approvals; the route guide says optional.                                                                                                                                                                                      | `validateDevelopmentProfileDraft`                                                                                                                            | Cannot save a no-approval residence                                    |
| F15 | **No audit trail or concurrency check on development writes.** `update-development` has no `activity_log` event and no `updated_at` check.                                                                                                                                                                   | `update-development/index.ts`                                                                                                                                | Two super admins overwrite each other silently                         |
| F16 | The original anchor finding still stands: `propertyTowers` / `parkingTowers` / `parkingLevels` are **write-only orphans**, and `docs/guides/routes/admin/development-detail.md` still claims they populate host dropdowns.                                                                                   | `update-development`, `PROPERTY_RESIDENCES`                                                                                                                  | Super-admin edits are ignored                                          |

### 1.3 Measured blast radius (re-counted 2026-11-09, shipping code, excludes mocks/tests/e2e)

| Measure                                                                                                                                            | 2026-09-22  | 2026-11-09 |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| Files referencing Azure                                                                                                                            | 80          | 81         |
| Azure references                                                                                                                                   | 315         | 318        |
| Files with name-matching (`isAzureNorth*`, `DEFAULT_RESIDENCE_NAME`, `AZURE_NORTH_RESIDENCE_NAME`, `isKnownResidence`, `DEFAULT_DEVELOPMENT_NAME`) | 34          | 35         |
| Name-matching call sites                                                                                                                           | 112         | 94         |
| Files referencing `gaf` (edge / ui)                                                                                                                | not counted | 73 / 99    |
| `gaf` references (edge / ui)                                                                                                                       | not counted | 540 / 568  |
| Files reading `residence_name` (edge / ui incl. `residenceName`)                                                                                   | not counted | 47 / 71    |

Most `gaf` references are legacy column names (`gaf_completed_at`, `approved_gaf_pdf_url`) that stay. **The work is removing the places that branch on the kind, not renaming columns.**

### 1.4 Non-goals

- Re-architecting org / property / parking tenancy, RBAC, plans, or the booking status graph (`PENDING_REVIEW → PENDING_DOCUMENTS → READY_FOR_CHECKIN → …`). Residences configure the _sub-steps inside_ `PENDING_DOCUMENTS`, never the top-level graph.
- A general workflow builder (arbitrary statuses, branching, scripting). Out of scope by design: the status graph has invariants in `booking-workflow.mdc` that must not become data.
- Making every UI string configurable. Only strings that name a building concept or state a building rule move into config (see §4.6).
- More than 5 guest slots. `guest2_*`…`guest5_*` are columns; a residence cap above 5 needs a schema change and its own plan.
- Currency / locale. PHP and `Asia/Manila` stay platform-wide.
- Any behavior change for Azure North. Azure must come out byte-identical. **This is the release gate.**

### 1.5 Decisions

Merging into `develop` deploys Supabase to production in this repo, so "do not deploy" is
enforced as "do not merge". Recorded here so a later session does not re-litigate them.

| Decision                         | Choice                                                                                | Why                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Merge and deploy gate            | `docs/workflow/merge-guard.json` + `merge-guard` CI job, draft PR                     | The owner asked for a durable guard, not a promise. Content-based, survives new sessions and new agents.                |
| Merge gate clears                | Owner sets `clearedAt` + `clearedBy` in `merge-guard.json`                            | One explicit, auditable action. No agent can clear it on its own.                                                       |
| Deploy gate clears               | Same `clearedAt` field; deploy mode fails while the module is in the tree and unclear | Prevents "while we are here" deploys from shipping the module early.                                                    |
| Phase 0 scope this session       | Ship Phase 0 only; Phases 1 to 7 stay unchecked                                       | Phase 0 is additive and has no Azure behavior change. Everything else needs the foundation and manual testing time.     |
| F2 generic fallback              | Blank or unmatched residence resolves `GENERIC_RESIDENCE_PROFILE`, never Azure        | Plan §4.4 and §7.1. Azure rows carry `residence_name`, so Azure is unaffected.                                          |
| F1 generic document requirements | Default becomes `[]`; Azure's list comes from its development row                     | A new residence must not inherit Azure's GAF and pet steps.                                                             |
| Mirrored module drift check      | `bun run check:residence-profile-drift` in `ci:quality`                               | Plan §4.8. Cheap, and stops the UI/edge pair silently diverging.                                                        |
| `residence_name` in Phase 0      | Kept as the denormalized display column; `development_id` added alongside             | Phase 7 retires it. Renaming it now would touch 100+ files for no behavior gain.                                        |
| Owner decisions left open (§11)  | Recommended options stand, except §11.5 (`is_test`) which needs the owner             | Phase 0 does not depend on any of them. Do not build the flows they gate until confirmed.                               |
| Plans entitlement for this work  | `Plans: N/A`                                                                          | Residence profiles are a platform and super-admin capability, not a host plan feature.                                  |
| Team RBAC for this work          | `RBAC: N/A` in Phase 0                                                                | Phase 0 adds super-admin-only reads and a migration. The re-snapshot action in Phase 3 must use `bookings.detail:edit`. |
| Activity log for Phase 0         | `activity-log: N/A`                                                                   | Phase 0 has no new mutation surface. Development writes get events in Phase 4.                                          |

---

## 2. How Azure North works today (end-to-end trace)

This is the flow every new residence must be able to express through config. "Configurable today" means editable in `/admin` _and_ read at runtime.

| Stage                        | What happens for Azure                                                                                                                                                                          | Where the rule lives                                                                                 | Configurable today?                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Host onboarding           | Residence is always Azure; tower picked from Monaco / Bali / Barbados; unit must be 4 digits; parking tower + level from Azure lists                                                            | `OnboardingPage.tsx:252`, `orgDevelopments.ts`, `propertyResidences.ts`, `parkingResidences.ts`      | No                                                                                       |
| 2. Property defaults         | Occupancy ranges, floors max 29, check-in 14:00 / out 12:00, map pin, address seeded on create                                                                                                  | `propertyResidenceDefaults.ts`, `propertyLocationDefaults.ts`, `create-property`                     | No                                                                                       |
| 3. Building forms (host)     | Host fills Unit Owner, Tower & Unit, On-site contact, Contact no., signature for the GAF/pet PDFs                                                                                               | `BuildingFormsSettingsSection.tsx`, `app_settings.gaf_*`                                             | Fields fixed; values per property                                                        |
| 4. Guest form                | Steps Guest / Stay / Parking / Pets / Payment. Max 4 adults; a 5th guest must be age 3 or under; valid ID for 18+; pet policy "requires … vaccination records for PMO approval"; GAF email hint | `guestFormSteps.ts`, `guestCounts.ts`, `guestFormSchema.ts`, `GuestForm.tsx`, `guestFormBranding.ts` | Step visibility per property (`allowPets/Parking/Decor`); limits via unit types; copy no |
| 5. Proceed (review → docs)   | Resolve requirements → generate GAF PDF (+ pet PDF if pets) → email PMO with valid IDs attached, reply-to `approvals+{propertySlug}@inbound…`                                                   | `workflowOrchestrator.ts`, `pdfService.ts`, `emailService.ts#sendEmail/sendPetEmail`                 | List/labels/order/trigger yes; generation and email no                                   |
| 6. PMO approval              | PMO replies with signed PDF; webhook parses subject `- GAF Request (d to d)`, stores file, marks step complete, notifies host                                                                   | `approval-email-webhook`, `approvalEmailMatcher.ts`                                                  | Sender allow list = PMO email; subject format no                                         |
| 7. Host review               | Host can upload, reject (reason list) or manually complete; GAF/pet need an approved PDF                                                                                                        | `pendingDocStatusGroups.ts`, `upload-booking-asset`, `requirementNeedsApprovedPdf`                   | No                                                                                       |
| 8. Parking                   | Separate track (`parking_completed_at`, endorsement), not in `documentRequirements`                                                                                                             | `statusMachine.ts`, parking modules                                                                  | No (intentional, see §4.4)                                                               |
| 9. Ready for check-in email  | "Your GAF has been approved … present it at the guard house"                                                                                                                                    | `propertyTemplateEmailSections.ts:535`, property templates                                           | Property template body yes; built-in sections no                                         |
| 10. Stay guide               | "Approved GAF" / "Approved pet form" documents                                                                                                                                                  | `stayGuideCheckInDocuments.ts`                                                                       | No                                                                                       |
| 11. Calendar / Telegram / AI | Calendar prefix + `calendarIcon`; Telegram placeholders; dashboard assistant prompt mentions GAF                                                                                                | `statusMachine.ts`, `telegramPlaceholderGroups.ts`, `ai/prompts/dashboardAssistant.ts`               | Icon yes; rest no                                                                        |
| 12. Listing verification     | Tier 2 "Recommended" requires "Azure PMO confirmation"                                                                                                                                          | `listingAuthorization.ts`                                                                            | No                                                                                       |
| 13. Guest info               | Pool fee ₱200, schedule, guides, requirements: AI receptionist only                                                                                                                             | `developmentGuestInfo.ts` (Azure override merge)                                                     | Yes, but AI-only                                                                         |
| 14. Public search            | Map pin falls back to the Azure literal in TS and SQL                                                                                                                                           | `publicGeoScope.ts:48`, `pls_listing_lat/lng`                                                        | No                                                                                       |

**Already data-driven and worth copying:** the document requirement list (`workflowDefaults.documentRequirements`, residence default → `app_settings.document_requirements_override` → parser fallback), `pmoEmail`, `unitTypes`, `poolFee/Schedule`, guest info, announcements.

---

## 3. The recurring anti-patterns

1. **String-keyed identity.** Residences are matched by display name, not `development_id`. Renaming a development detaches its config. No FK.
2. **Duplicated across the wire.** Every module exists in `ui/src/…` and `supabase/functions/_shared/…`, synced by a comment. No CI check.
3. **Config in code.** `DEFAULTS_BY_RESIDENCE[name] ?? GENERIC_DEFAULTS` maps. Onboarding a residence needs a deploy.
4. **Kind switching.** `if (kind === 'gaf') … else if (kind === 'pet') …` across PDF, email, inbound, stay guide, reminders, rail copy. Including label sniffing (F4).
5. **Silent Azure fallback.** Blank residence resolves to Azure instead of generic (F2).
6. **Building concepts inline in copy.** "GAF", "PMO", "guard house" written into components and email sections (F12).

**Target shape:** one resolver fed by the `developments` row keyed by `development_id`; requirement behavior described by fields on the requirement, never by its id or label; generic defaults that do nothing building-specific.

---

## 4. Target model: the Residence Profile

A **Residence Profile** is the building's rulebook: everything about how a stay works at that residence that does not depend on the individual unit or host. It lives on `developments.settings` and is edited only by super admins.

### 4.1 Who owns what

Every configurable value has exactly one ownership class. This is the core design decision: it answers "can a host change this?" for every field and stops building rules from being overridden by accident.

| Class                            | Meaning                                                                                                                | Host UI                                                       | Resolution                                   | Examples                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Building rule** (locked)       | Mandated by the building. Same for every unit.                                                                         | Read-only with "Set by {residence}"                           | Residence → generic. Property value ignored. | Approval steps, PDF templates, PMO recipients, child age rule, ID age, unit number format, towers, pets allowed by building |
| **Building cap** (bounded)       | Building sets a limit; host picks a value within it.                                                                   | Editable, validated against the cap, cap shown in helper text | Property value clamped to residence cap      | Max adults, max children, floors                                                                                            |
| **Building default** (inherited) | Building suggests; host may override per property. Live: residence edits reach every property that has not overridden. | Editable with "Reset to residence default"                    | Property override → residence → generic      | Check-in / out time, email template bodies, check-in instructions, parking reminders                                        |
| **Seed** (copied once)           | Copied into the property at creation, then host-owned. Residence edits do not propagate.                               | Normal host field                                             | Property only, after creation                | Initial enabled amenities, initial house rule presets                                                                       |
| **Building info** (display)      | Facts about the building shown alongside the property.                                                                 | Not editable by host; shown as a "Building" block             | Residence only                               | Building amenities, pool fee and schedule, guest guides, important info                                                     |

Rules:

- A key's class is declared once in a typed registry (`RESIDENCE_FIELD_POLICY`) shared by resolver, editor and host UI. Never decided ad hoc in a component.
- `locked` can be relaxed to `inherited` per residence only where the registry allows it (for example a residence that lets hosts set their own check-in time). Default is the stricter class.
- Seeds are used only where the property already stores the full list (amenity ids, house rule ids). Everything else is inherited, so residence edits propagate.

### 4.2 Profile schema

Additive. **Existing flat keys stay where they are** (`pmoEmail`, `unitTypes`, `poolFee`, `amenities`, `workflowDefaults.documentRequirements`, …). New keys go in namespaced objects. The one exception is towers/levels (F9, F16): nothing reads the flat lists, so they move into `structure` and the flat keys are retired.

```ts
type ResidenceProfile = {
  schemaVersion: 2;

  // Phase 1: replaces flat propertyTowers / parkingTowers / parkingLevels
  structure: {
    towerLabel: string; // 'Tower' | 'Phase' | 'Building' | ''
    unitLabel: string; // 'Unit' | 'Lot' | 'Block & Lot'
    towersRequired: boolean; // false for SUBDIVISION / TOWNHOUSE
    propertyTowers: { name: string; code: string; active: boolean }[];
    parkingTowers: {
      name: string;
      code: string;
      active: boolean;
      levels: string[];
      parkingType: 'inside_tower' | 'outside_tower' | 'motorcycle';
    }[];
    unitNumberFormat: {
      preset: 'digits4' | 'digits' | 'alnum' | 'custom';
      pattern?: string;
      example: string;
    };
    parkingSlotFormat: {
      preset: 'digits1to4' | 'alnum' | 'custom';
      pattern?: string;
      example: string;
    };
    floorsMax: number | null;
  };

  // Phase 2
  occupancy: {
    maxAdultsCap: number; // ≤ 5 (MAX_GUESTS)
    maxChildrenCap: number;
    childMaxAge: number; // Azure 3
    adultMinAge: number; // 18
    idRequiredFromAge: number; // 18
    primaryGuestMinAge: number; // 18
  };
  stay: {
    checkInTime: string; // inherited
    checkOutTime: string; // inherited
    petsAllowed: boolean; // locked: false hides the Pets step for every property
    paidParkingAvailable: boolean; // locked: false hides the Parking step
    surpriseDecorAllowed: boolean;
    petTypes: string[]; // ['Dog', 'Cat']
    petVaccinationRequired: boolean;
  };

  // Phase 3: extends workflowDefaults.documentRequirements (see §4.3)
  approvals: {
    buildingAdminLabel: string; // 'PMO' | 'HOA' | 'Admin office'
    pmoEmail: string | null; // existing flat key, read through here
    ccPropertyEmail: boolean;
    pdfTemplates: ResidencePdfTemplate[];
  };

  // Phase 2 (guest form) and Phase 3 (workflow copy)
  terms: Partial<Record<ResidenceTermKey, string>>; // §4.6
  copy: Partial<Record<ResidenceCopyKey, string>>; // §4.6

  // Phase 5
  propertySeeds: { amenityIds: string[]; houseRuleIds: string[] };
  buildingRules: { id: string; text: string; type: 'info' | 'prohibited' | 'allowed' }[]; // locked, shown on every property
  templateDefaults: Partial<Record<PropertyTemplateKey, { content: string }>>;
  guestInfoVisibility: { stayGuide: boolean; propertyPage: boolean };

  // Phase 3 (listing verification)
  verification: { tier2BuildingProofLabel: string; tier2BuildingProofRequired: boolean };
};
```

`parseResidenceProfile(settings)` is **total**: every key has a generic default, malformed values degrade to that default and log once, and a v1 row (no `schemaVersion`) is upgraded in memory. Writing always produces v2.

### 4.3 Approval steps engine (document requirements v2)

This is the answer to "different steps, different requirements, different docs per residence". The existing `DocumentRequirement` gets the fields that today are implied by the id `'gaf'` / `'pet'`:

```ts
type DocumentRequirementV2 = {
  id: string; // immutable once any booking references it
  order: number;
  active: boolean; // retire instead of delete
  triggerCondition: 'always' | 'has_pets' | 'need_parking';
  blocksCheckIn: boolean; // default true

  labels: {
    step: string; // host rail: 'GAF Request'
    short: string; // chips, calendar, subject: 'GAF'
    guest: string; // guest-facing: 'Guest Advise Form'
    approved: string; // stay guide: 'Approved GAF'
  };

  output:
    | { type: 'none' } // checklist tick only
    | { type: 'generated_pdf'; pdfTemplateId: string }; // id in approvals.pdfTemplates

  delivery:
    | { mode: 'none' }
    | {
        mode: 'email';
        to: 'building_admin' | string[];
        emailTemplateKey: string; // 'email-gaf-request' | 'email-document-request'
        attachments: ('request_pdf' | 'valid_ids' | 'pet_vaccination' | 'pet_image')[];
        subjectTemplate: string; // '{unit} - {short} Request ({checkIn} to {checkOut})'
      };

  approval: {
    source: 'email-listener' | 'manual' | 'none';
    requiresApprovedFile: boolean; // replaces requirementNeedsApprovedPdf kind check
  };

  calendarIcon: string | null;
  legacyKind: 'gaf' | 'pet' | null; // ONLY drives dual-write to gaf_* / pet_* columns
};
```

Design rules:

- **No behavior keyed on id or label.** `requirementDocKind` label sniffing (F4) is deleted. `legacyKind` exists only so Azure keeps writing `gaf_completed_at` / `approved_gaf_pdf_url` during the dual-write period, and is the one place the old names survive.
- **Generic default is an empty list** (F1). No residence gets building approvals unless a super admin adds them. Load error is **not** the same as "no config": if the development row fails to load, the transition fails with a host-facing retry error. It must never default to `[]` and skip Azure's GAF.
- **Snapshot per booking** (F13). When a booking first transitions into `PENDING_DOCUMENTS`, the resolved list is written to `guest_submissions.document_requirements_snapshot` (new nullable JSONB). Every later read for that booking uses the snapshot. Rows without a snapshot (all existing bookings) resolve live, exactly as today. Super-admin edits therefore affect new bookings only. A host/super-admin action "Use the current steps" re-snapshots one booking, logged to `activity_log`.
- **Ids are immutable.** The editor locks `id` after first save. Removing a step that any non-terminal booking snapshot references is blocked; the editor offers "Retire" (`active: false`) instead.
- **Inbound routing by address, not subject** (F6). Reply-to becomes `approvals+{propertySlug}--{requirementId}@inbound…`. The webhook takes property and requirement from the address and only parses dates from the subject with a generic `\((.+?) to (.+?)\)` pattern. For `legacyKind` steps the old address and subject regex stay accepted, so in-flight Azure replies still match.
- **Per-residence PDF templates** (F3). `approvals.pdfTemplates[]`: `{ id, name, storagePath, fieldMap: Record<pdfFieldName, DataKey>, signatureField, signatureNameField, version }`. Files are immutable (new upload = new path). `fieldMap` values come from a typed `PDF_DATA_KEYS` catalog (`guest.primary.nameWithAge`, `guest.2.nameWithAge`, `stay.checkInDate`, `property.unitOwner`, `property.towerAndUnit`, `vehicle.plate`, `pet.name`, …) so a typo cannot reach the generator. Azure's two templates are seeded with exactly today's hardcoded map. Preview reads the same storage file through a signed URL, which removes the `ui/public/templates` duplicate.
- **Generic document email.** A new built-in template `email-document-request` with `{{document_label}}`, `{{building_admin}}` placeholders. Residences can override it per step (`templateDefaults['email-document-request:{id}']`). Azure keeps `email-gaf-request` / `email-pet-request` via `delivery.emailTemplateKey`.
- **Parking stays its own track.** It has payments, matching and endorsement already (`parking-e2e-*` plans). Residences control only `stay.paidParkingAvailable` and the parking copy keys. Re-evaluate after Phase 3.

### 4.4 Resolution order

Applied **per key**, never whole-object:

```text
property value (only if the key's class allows it, clamped to caps)
  → booking snapshot (document requirements only, once taken)
  → developments.settings (Residence Profile)
  → GENERIC_RESIDENCE_PROFILE
```

`app_settings.document_requirements_override` stays as a super-admin-only escape hatch for one property. It has no host UI today and keeps none: building approval steps are a building rule.

### 4.5 Identity: real foreign key, scoped uniqueness

```sql
ALTER TABLE properties ADD COLUMN development_id UUID REFERENCES developments(id);
ALTER TABLE parkings   ADD COLUMN development_id UUID REFERENCES developments(id);
-- backfill on TRIM(residence_name) = TRIM(developments.name); index both

DROP INDEX properties_tower_unit_active_unique;
CREATE UNIQUE INDEX properties_tower_unit_active_unique
  ON properties (development_id, lower(tower), unit_number)
  WHERE status = 'ACTIVE' AND tower IS NOT NULL AND unit_number IS NOT NULL;
```

- `residence_name` stays as a denormalized display column. `update-development` rename updates `properties.residence_name` / `parkings.residence_name` for that `development_id` in the same request, so search place slugs and grouping stay consistent (the `pls_*` triggers refresh rows on update).
- `delete-development` and `developmentStatsByName` switch to `development_id`.
- Rows with `development_id IS NULL` resolve `GENERIC_RESIDENCE_PROFILE` with `developmentId: null`. **Never Azure.**
- The backfill must report unmatched rows (dev and prod) before Phase 1 starts. Each one is either linked by a super admin or knowingly left generic.

### 4.6 Guest-facing text: terms and copy keys

The ask is "labels, placeholders, descriptions, text visible in the UI, as much as possible". Making every string configurable creates an untestable surface (layout at 375px, AI-tell copy, empty strings, missing placeholders). Instead, two small typed layers cover the strings that actually differ per building:

1. **Terms** (`ResidenceTermKey`): short nouns reused everywhere. `buildingAdmin` ("PMO"), `buildingAdminLong` ("Property Management Office"), `arrivalCheckpoint` ("guard house and lobby"), `residenceShortName` (derived: name minus "Residences", overridable). Most strings become templates over terms, so one edit fixes many surfaces.
2. **Copy keys** (`ResidenceCopyKey`): a typed registry. Each entry has `key`, `surface`, `default`, allowed `placeholders`, `maxLength`. Initial set, all currently hardcoded:

| Key                                                       | Today                                                                  | Surface           |
| --------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------- |
| `guestForm.parking.stepHint`                              | `formatParkingStepHint`                                                | Guest form        |
| `guestForm.parking.paidDescription` / `noPaidDescription` | `formatPaidParkingDescription` / `formatNoPaidParkingDescription`      | Guest form        |
| `guestForm.pets.policyTitle`                              | `formatPetPolicyTitle`                                                 | Guest form        |
| `guestForm.pets.policyBody`                               | `GuestForm.tsx:2369` "…vaccination records for PMO approval"           | Guest form        |
| `guestForm.contact.emailHint`                             | `formatGafEmailHint`                                                   | Guest form        |
| `guestForm.guests.limitMessage`                           | `buildGuestLimitMessage` ("…in the unit and at the swimming pool")     | Guest form        |
| `success.administrationLabel`                             | `formatGuestSuccessAdministration`                                     | Success page      |
| `payParking.lastMinuteWarning`                            | `formatPayParkingLastMinuteWarning`                                    | Parking           |
| `workflow.proceedHint`                                    | `workflowAdvanceMode.ts:116` "…to building management"                 | Host booking rail |
| `workflow.automationSkipped.{requirementId}`              | `workflowPlanSkip.ts` "GAF request email to Azure"                     | Host toasts       |
| `email.readyForCheckin.documentsNote`                     | `propertyTemplateEmailSections.ts:535` "present it at the guard house" | Email section     |
| `verification.tier2BuildingProof`                         | `listingAuthorization.ts` "Azure PMO confirmation"                     | Host verification |

Rules for adding a key: the string names a building concept or states a building rule. Everything else stays in code. Save-time validation rejects unknown placeholders, HTML, em dashes (`human-copy`) and over-length values. Render-time: an invalid stored value falls back to the default and logs, never renders broken.

### 4.7 Resolver module (mirrored)

`supabase/functions/_shared/residenceProfile.ts` + `ui/src/lib/residence/residenceProfile.ts`:

```ts
export function parseResidenceProfile(row: DevelopmentRow | null): ResidenceProfile; // total
export async function loadResidenceProfile(
  sb: SupabaseClient,
  developmentId: string | null
): Promise<ResidenceProfile>;
export function resolvePropertyValue<K extends ResidenceFieldKey>(
  key: K,
  profile: ResidenceProfile,
  propertySettings: unknown
): ResolvedValue<K>;
// ResolvedValue carries { value, source: 'property' | 'residence' | 'generic', locked, cap? } so the UI can badge it
```

UI reads the profile through one TanStack Query key `['residence-profile', developmentId]`, invalidated by the super-admin save. Edge caches per request only (no cross-request cache in this plan; measure first). `get-guest-payment-info` returns the resolved guest-facing slice (rules + copy + terms) so the anon guest form makes no extra request.

### 4.8 Drift enforcement

CI check comparing exported type surface, policy registry, copy registry and default constants of each mirrored pair. Fails on divergence. Wired into `bun run ci:quality`. Added in Phase 0, before any mirrored module changes.

---

## 5. Super-admin experience

### 5.1 Information architecture of `/admin/developments/:slug`

Today's editor is one long card with 12 sections. It grows to roughly 25 controls, so it becomes grouped sections with the existing `AdminSectionNavLayout` (desktop side nav, phone bottom-sheet section picker per `mobile-native-ui.mdc`). Each group saves independently with its own unsaved-changes guard.

| Group             | Contents                                                                                                                                                         | New vs existing                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Profile           | Basic info, photos, location, announcements                                                                                                                      | Existing                                          |
| Structure         | Tower label / unit label, property towers, parking towers with per-tower levels and codes, unit and slot formats with live example check, unit types, floors     | Replaces Towers & Parking; unit types moved here  |
| Guest rules       | Occupancy caps and ages, ID age, pets allowed + pet types + vaccination, paid parking available, surprise decor, check-in / out (with "hosts may change" toggle) | New                                               |
| Approval steps    | Step builder (§5.3), PDF templates, building admin label + PMO email, CC property email                                                                          | Extends Document Requirements + Email automations |
| Guest-facing text | Terms and copy keys grouped by surface, each with live preview and "Reset to default"                                                                            | New                                               |
| Property defaults | Initial amenity and house-rule presets, mandatory building rules, template defaults (house rules, check-in / out instructions, parking reminders, email bodies)  | New                                               |
| Building info     | Building amenities, pool fee and schedule, guest guides, requirements, important info, plus where each is shown (stay guide, property page, AI)                  | Existing + visibility                             |
| Danger zone       | Status, delete (blocked while linked)                                                                                                                            | Existing                                          |

### 5.2 Per-field affordances

- **Source badge**: "Platform default" vs "Set for this residence". Uses `ResolvedValue.source`.
- **Reset to default** on every residence-set field.
- **Impact line** under building rules and caps: "Applies to 14 properties. 3 bookings are mid-approval and keep their current steps."
- **Clamp warning** on caps: lowering `maxAdultsCap` below a property's current value lists those properties. Their stored value is not rewritten; it is clamped at read time and flagged in the host's property settings.

### 5.3 Approval step builder

Worked example, adding a "Move-in permit" emailed to an admin office and approved manually:

1. Add step. Labels (step / short / guest / approved) with a live chip preview. Id is generated from the short label and locked after save.
2. When it applies: always / guest has pets / guest needs parking.
3. Output: none, or a generated PDF picked from this residence's templates.
4. Delivery: none, or email to the building admin or listed addresses, with template, attachments and a subject preview rendered against a sample booking.
5. Approval: auto from reply email / host marks done / no approval. "Needs the approved file before it can be completed".
6. Blocks check-in: on by default.
7. Drag to reorder. Retire instead of delete when bookings reference it.

**PDF template upload** (`upload-development-pdf-template`, super admin): the function loads the file with `pdf-lib`, rejects non-fillable PDFs, and returns the AcroForm field names. The editor shows each field with a `PDF_DATA_KEYS` picker, flags unmapped fields, and offers **Test fill** with a sample booking that opens the filled PDF. Save is blocked until every mapped key is valid; unmapped PDF fields are allowed but listed.

### 5.4 Preview and dry run

- **Guest form preview**: `/admin/developments/:slug/preview/form` renders the real guest form against the draft profile and a sample property, submit disabled. Shows step visibility, limits, copy and validation messages exactly as a guest would see them, at phone and desktop widths.
- **Booking dry run**: pick sample conditions (pets yes/no, parking yes/no, party size) and see which steps apply, what each would generate and send, and the calendar title. No writes.
- **Email preview**: reuse `property-templates-preview` with the residence layer.

### 5.5 Safe publishing

- **Optimistic concurrency** (F15): `update-development` takes `expectedUpdatedAt` and returns 409 on mismatch; the editor offers reload.
- **History and revert**: each save inserts the previous `settings` into `development_settings_history (development_id, settings, saved_by, saved_at)`. The editor lists recent versions with "Restore". Cheap, and makes a bad edit to a live residence reversible in one click.
- **Audit** (F15): `activity_log` event per save with a key-level diff summary (`development.settings_updated`, `development.pdf_template_uploaded`, `development.renamed`), per `audit-logging`.
- **Validation on save**: `min ≤ default ≤ max`, `HH:mm` times, unit-type id uniqueness, caps ≤ `MAX_GUESTS`, requirement id uniqueness, every `generated_pdf` step points at an existing template, every `email` step has a recipient, copy rules from §4.6. PMO email required **only** when a step emails the building admin (F14).

### 5.6 Starting a new residence

- **Duplicate residence**: clones a profile (rules, steps, copy, defaults) without identity, media, location, PMO email or PDF files. PDF templates are referenced as "needs upload".
- **Type presets** (`CONDOMINIUM`, `SUBDIVISION`, `TOWNHOUSE`, …) apply seed values once at create (for example `towersRequired: false`, `unitLabel: 'Lot'` for subdivision). Not a runtime layer: a second runtime defaults layer would add an interaction that is hard to test.
- **Readiness checklist** blocks switching status to `ACTIVE`: structure valid for the type, every email step has a recipient, every PDF step has a mapped template, location set. `INACTIVE` doubles as draft. Onboarding and the public directory list `ACTIVE` only.

### 5.7 Host-side changes that follow

- **Onboarding** gets a residence picker (ACTIVE developments). Tower, unit and parking fields relabel and revalidate from the picked residence. "My building isn't listed" opens a support ticket (see open question 3).
- **Property settings**: locked fields render read-only with "Set by {residence}"; capped fields show the cap; inherited fields show "Reset to residence default". Building Forms appears only when an active step uses a generated PDF that maps a `property.*` key, and its labels come from the copy registry.
- **Changing a property's residence** after it has bookings is super-admin only (re-validates tower/unit, re-resolves steps for future bookings, in-flight bookings keep their snapshot).
- **Copy settings between properties** (`copy-property-settings`) skips the Building Forms group when source and target are in different residences.

---

## 6. Config inventory

Every hardcoded value, its ownership class and destination. "Read at runtime today" separates rewiring from new plumbing.

| #   | Config                                                                    | Current location                                                                                         | Class           | Destination                                        | Read at runtime today?                    |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------- | ----------------------------------------- |
| 1   | Property towers                                                           | `propertyResidences.ts` `PROPERTY_RESIDENCES`                                                            | Building rule   | `structure.propertyTowers`                         | **No, write-only orphan**                 |
| 2   | Parking towers, per-tower levels, codes, parking type                     | `parkingResidences.ts` (Bay ground-only, `BY` code, `inferParkingTypeForTower`)                          | Building rule   | `structure.parkingTowers`                          | **No, orphan; flat shape cannot hold it** |
| 3   | Unit number format (4 digits), slot format (1 to 4 digits)                | `propertyTowerUnit.ts`, `parkingResidences.ts` (both sides)                                              | Building rule   | `structure.unitNumberFormat` / `parkingSlotFormat` | No                                        |
| 4   | Tower / unit labels                                                       | Hardcoded "Tower & Unit Number" etc.                                                                     | Building rule   | `structure.towerLabel` / `unitLabel`               | No                                        |
| 5   | Occupancy / structure ranges (bedrooms, bathrooms, floors max 29)         | `propertyResidenceDefaults.ts`                                                                           | Cap             | `structure.floorsMax`, `occupancy.*`               | No                                        |
| 6   | Max adults / children, child max age 3, adult / ID / primary age 18       | `guestCounts.ts`, `guestFormSchema.ts`                                                                   | Cap / rule      | `occupancy.*`                                      | Partial (unit types)                      |
| 7   | Check-in / out 14:00 / 12:00                                              | `propertyResidenceDefaults.ts`, `guestFormPropertyDefaults.ts`                                           | Inherited       | `stay.checkInTime` / `checkOutTime`                | No                                        |
| 8   | Pets / parking / decor allowed                                            | Property `allowPets/Parking/SurpriseDecor` only                                                          | Rule ∧ property | `stay.*` (building false wins)                     | Property only                             |
| 9   | Pet types, vaccination required                                           | `guestFormData.ts` (`petType: 'Dog'`), schema                                                            | Building rule   | `stay.petTypes`, `stay.petVaccinationRequired`     | No                                        |
| 10  | Unit types                                                                | `unitTypes.ts` `DEFAULT_AZURE_NORTH_UNIT_TYPES`                                                          | Building rule   | `unitTypes` (existing)                             | Partial                                   |
| 11  | Map center + seed address                                                 | `propertyLocation.ts`, `propertyLocationDefaults.ts`, `publicGeoScope.ts`, **SQL `pls_listing_lat/lng`** | Inherited       | `latitude` / `longitude` / `address` (existing)    | Partial, Azure-only branch in TS and SQL  |
| 12  | PMO email                                                                 | `AZURE_PMO_EMAIL`                                                                                        | Building rule   | `pmoEmail` (existing)                              | **Yes**, but Azure fallback on blank (F2) |
| 13  | Email automation field copy                                               | `propertyEmailAutomationDefaults.ts`                                                                     | Copy            | `copy` / `terms`                                   | No                                        |
| 14  | Document requirement list                                                 | `DEFAULT_DOCUMENT_REQUIREMENTS`                                                                          | Building rule   | `workflowDefaults.documentRequirements` v2         | **Yes**, defaults to Azure's list (F1)    |
| 15  | GAF / pet PDF files + field map + signature fields                        | `pdfService.ts`, `gafPdfSignature.ts`, `petPdfSignature.ts`, Storage + `ui/public`                       | Building rule   | `approvals.pdfTemplates`                           | No                                        |
| 16  | GAF / pet send, attachments, subject                                      | `emailService.ts#sendEmail/sendPetEmail`, orchestrator                                                   | Building rule   | Requirement `delivery`                             | No                                        |
| 17  | Inbound subject regex                                                     | `approvalEmailMatcher.ts`                                                                                | Building rule   | Address routing by requirement id                  | No                                        |
| 18  | Approved-file rule, stay-guide labels, rail labels                        | `requirementDocKind`, `stayGuideCheckInDocuments.ts`, `pendingDocStatusGroups.ts`                        | Building rule   | Requirement `approval`, `labels`                   | No                                        |
| 19  | GAF / pet email bodies and sections                                       | `propertyTemplates.ts`, `propertyTemplateEmailSections.ts`                                               | Inherited       | `templateDefaults` → property template             | Property layer only                       |
| 20  | Pool fee ₱200 + schedule                                                  | `developmentGuestInfo.ts` Azure merge override (already seeded by `20261316120700`)                      | Building info   | `poolFee`, `poolSchedule` (existing)               | **Yes**, override now redundant           |
| 21  | Guest guides, requirements, important info                                | Shipped since 09-22                                                                                      | Building info   | existing + `guestInfoVisibility`                   | AI only (F11)                             |
| 22  | Initial amenities / house rules                                           | `INITIAL_ENABLED_AMENITIES`, `INITIAL_ENABLED_HOUSE_RULES`                                               | Seed            | `propertySeeds`                                    | No                                        |
| 23  | Mandatory building rules ("Comply with condo rules", "Valid ID at lobby") | Host-chosen presets today                                                                                | Building rule   | `buildingRules`                                    | No                                        |
| 24  | Guest-facing building copy                                                | `guestFormBranding.ts`, `GuestForm.tsx`, `workflowAdvanceMode.ts`, `workflowPlanSkip.ts`                 | Copy            | `copy` / `terms` (§4.6)                            | No                                        |
| 25  | Tier 2 "Azure PMO confirmation"                                           | `listingAuthorization.ts` (both sides)                                                                   | Building rule   | `verification.*`                                   | No                                        |
| 26  | Calendar prefix / icon, Telegram placeholders, AI prompt mentions         | `statusMachine.ts`, `telegramPlaceholderGroups.ts`, `ai/prompts/dashboardAssistant.ts`                   | Derived         | From requirement `labels` + `calendarIcon`         | Icon only                                 |
| 27  | Occupancy child-age constant + deprecated `AZURE_*` aliases               | `guestCounts.ts`                                                                                         | Rule            | `occupancy.childMaxAge`                            | No                                        |
| 28  | Reserved display names (`azurenorth*`)                                    | `reservedDisplayNames.ts`                                                                                | Platform        | Keep as-is                                         | Platform constant                         |
| 29  | Legacy brand regex (`Kame Space — Azure North`)                           | `platformBrand.ts`                                                                                       | Platform        | Keep as-is                                         | Legacy aid                                |

---

## 7. Edge cases and guardrails

Each row is a test case. "Where" names the enforcement point.

### 7.1 Identity and data integrity

| Case                                              | Expected behavior                                                                                          | Where                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Property with blank or unmatched `residence_name` | Generic profile: no building steps, no PMO email, generic copy. Never Azure.                               | Resolver; Phase 0 removes every `DEFAULT_RESIDENCE_NAME` fallback |
| Development renamed                               | Config stays attached via FK; denormalized names updated; public slugs follow                              | `update-development`, `pls_*` triggers                            |
| Same tower + unit in two residences               | Both allowed; same tower + unit in one residence still blocked while ACTIVE                                | Scoped unique index, `check-tower-unit`                           |
| Tower retired while properties use it             | Existing properties keep it (shown "(retired)" in their own dropdown); new properties cannot pick it       | `structure.*.active`, tower validators                            |
| Unit format changed after properties exist        | Existing units are not re-validated; only creates and edits                                                | `create-property`, `update-property`                              |
| Development type changed (condo → subdivision)    | Labels switch; tower data kept; `towersRequired` follows the preset only if the super admin confirms       | Editor                                                            |
| Development set INACTIVE                          | Hidden from onboarding and `/developments`; existing properties keep resolving its profile (never generic) | Resolver ignores status                                           |
| Development delete                                | Blocked (409) while any property or parking links by FK                                                    | `delete-development`                                              |
| Development row fails to load                     | Transition or create fails with retry message. Does not fall back to generic                               | Resolver distinguishes error vs not-found                         |
| Malformed `settings` JSONB                        | Per-key generic default + one log line; public pages never 500                                             | `parseResidenceProfile`                                           |

### 7.2 In-flight bookings

| Case                                                   | Expected behavior                                                                                 | Where                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------- |
| Step added while bookings are in `PENDING_DOCUMENTS`   | Snapshotted bookings unaffected; new bookings get it                                              | Snapshot                        |
| Step removed / retired                                 | Removal blocked while referenced; retire hides it from new snapshots only                         | `update-development` validation |
| Label changed                                          | New labels show everywhere (labels read from current profile by id); behavior from snapshot       | Label lookup                    |
| PDF template replaced                                  | Already generated PDFs stay; a regenerate uses the new version                                    | Immutable storage paths         |
| PMO replies to an email sent before the address change | Old address + subject regex still accepted for `legacyKind` steps                                 | Webhook                         |
| Guest is mid-form when caps change                     | Server validates against current rules; client shows the server message and refetches the profile | `submit-form`, guest form       |
| Airbnb calendar-sync bookings with guest form links    | Same residence rules; payment step stays hidden for Airbnb                                        | Existing `isAirbnb` flag        |
| Legacy `PENDING_GAF` / `PENDING_PET_REQUEST` rows      | Labels unchanged (legacy statuses are Azure-only by definition)                                   | `bookingStatus.ts`              |
| Reschedule / same-day stay / cancellation              | Unaffected by profile changes; cancellation policy stays per property                             | N/A                             |

### 7.3 Guest form

| Case                                                 | Expected behavior                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Building disallows pets, property `allowPets = true` | Pets step hidden; property settings show the toggle locked with "Pets not allowed at {residence}" |
| Property `maxAdults` above residence cap             | Clamped at read; host settings flag it                                                            |
| Cap set above 5                                      | Rejected at save (`MAX_GUESTS`)                                                                   |
| `childMaxAge = 0` (no child exception)               | Overflow-guest hint and default age logic disabled                                                |
| `idRequiredFromAge` lowered to 0                     | Valid ID required for every slot, including identity capture per slot                             |
| Copy value invalid in DB                             | Default string renders; one log line                                                              |
| Long copy at 375px                                   | `maxLength` per key; preview at phone width before save                                           |
| Unknown residence on the anon form                   | Generic copy and rules; no residence name in strings (placeholders render "the building")         |

### 7.4 Approval steps, PDFs, email, inbound

| Case                                                    | Expected behavior                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Label contains "pet" / "gaf" (e.g. "Carpet inspection") | No effect. Behavior comes from fields only (F4 removed)                                                        |
| Non-fillable PDF uploaded                               | Rejected with a clear message                                                                                  |
| PDF field mapped to a key with no data (no parking)     | Field left blank, as GAF does today                                                                            |
| Email step with no recipient                            | Save blocked                                                                                                   |
| Free-tier property (no workflow emails)                 | Steps still listed; sends recorded as `automationSkippedByPlan` with the step's own label, host sends manually |
| Reply from an address not on the allow list             | Ignored, logged (existing behavior, allow list from the residence PMO email)                                   |
| Two bookings match one reply (same dates)               | Existing ambiguous handling; requirement id in the address narrows it                                          |
| Step with `approval.source = 'none'`                    | Never blocks; shown as informational                                                                           |
| All applicable steps empty                              | `PENDING_REVIEW → READY_FOR_CHECKIN` directly (existing skip path)                                             |

### 7.5 Super-admin editing

| Case                                       | Expected behavior                                                                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two super admins save the same development | Second save gets 409 and a reload prompt                                                                                                                                                                       |
| Bad edit on a live residence               | Restore previous version from history                                                                                                                                                                          |
| Leaving with unsaved edits                 | `useUnsavedChangesGuard` per section group                                                                                                                                                                     |
| Testing a new residence on production      | Developments have no `is_test` flag; keep test developments `INACTIVE` (readiness gate prevents accidental ACTIVE), or add `is_test` mirroring `20261322000000_test_tenant_isolation.sql`. See open question 5 |

### 7.6 Multi-residence orgs and host UX

| Case                                                         | Expected behavior                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Org with properties in two residences                        | Bookings list, rail, calendar and Telegram use each booking's own step labels |
| Org-level dashboards mixing residences                       | No residence-specific copy at org level                                       |
| Host copies settings between residences                      | Building Forms group skipped                                                  |
| Host asks the AI assistant about GAF at a non-Azure property | Assistant grounds on that residence's steps, not a GAF assumption             |

### 7.7 Public and search

| Case                                   | Expected behavior                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| Non-Azure property without its own pin | Falls back to its development's coordinates (TS and SQL), else no pin              |
| Development coordinates edited         | Search index rows for its properties and parkings refresh (`pls_trg_developments`) |
| Building info visibility off           | Hidden on stay guide / property page; still available to AI                        |

---

## 8. Phased delivery

Each phase ships independently. Azure snapshots are diffed after every phase. Never one PR per phase if a phase exceeds ~20 files; split by surface.

### Phase 0: Safety net and foundation (no Azure behavior change)

- [ ] **Azure golden snapshots before any code change** (partial): resolver-level snapshot shipped
      (`scripts/dev/residence-profile-snapshots.ts` + `scripts/dev/fixtures/residence-profile.snapshot.json`,
      wired into CI). The full set — `get-guest-payment-info`, `resolve-app-settings`, `search-listings`,
      guest-form settings, GAF and pet PDF **field values**, GAF / pet / acknowledgement / ready-for-check-in
      email HTML and subjects, calendar titles, stay-guide documents — still has to land before the Phase 3
      orchestrator change, because that is the first phase that can alter them.
- [x] Migration: `development_id` on `properties` + `parkings`, backfill, index, unmatched-row report
      (`20261324000000_development_identity.sql`, view `development_unmatched_assets`).
- [x] Migration: scoped tower + unit unique index (F7) — `20261324000100_development_scoped_tower_unit_unique.sql`.
- [x] Migration: `guest_submissions.document_requirements_snapshot` (nullable) and `development_settings_history`
      — `20261324000200_document_requirement_snapshot_and_history.sql`.
- [x] Fix F2: removed every `|| DEFAULT_RESIDENCE_NAME` / `?? 'Azure North Residences'` fallback in
      `appSettings`, `propertyResidenceDefaults`, `propertyTowerUnit`, `guestFormSettings`, `create-property`
      and `propertySettingsCloneGroups`; blank resolves generic. No Azure change when `residence_name` is set.
- [x] Fix F1: generic document requirements default becomes `[]` on both sides; existing developments were
      seeded with today's list by `20261324000300_seed_document_requirements_for_existing_developments.sql`.
      Load error is now distinct from not-found: it throws in the booking path.
- [x] Build `residenceProfile.ts` (both sides), field policy registry, parsers, `GENERIC_RESIDENCE_PROFILE`.
- [x] CI drift check for mirrored modules (`bun run check:residence-profile-drift`).
- [x] `seed.sql`: second local development ("Test Residence", `SUBDIVISION`, no towers, alnum units, pets not
      allowed, one manual step + one generated-PDF step) so local dev is never single-residence
      (`scripts/dev/seed/03b-test-residence.sql`, asserted in `99-verify.sql`).

**Gate:** Azure snapshots identical. Second residence resolves generic everywhere except where its row sets values.

**Acceptance:** `bun run check:residence-profile-drift && bun run test && bun run test:edge -- --filter residenceProfile && bun run ci:quality` — plus `bun scripts/dev/residence-snapshots.ts --check` shows zero diff.

### Phase 1: Structure (towers, units, parking, identity)

- [ ] Migrate flat `propertyTowers` / `parkingTowers` / `parkingLevels` into `structure` for every development; Azure gets per-tower levels, codes and parking types matching `parkingResidences.ts`.
- [ ] `propertyTowerUnit.ts`, `parkingSlotUnit.ts`, `check-tower-unit`, `useTowerUnitConflict` read structure and formats from the resolver.
- [ ] `create-property` / `create-parking` / `update-property` validate against the resolved residence; remove `azureLocation` branch, seed location from the profile.
- [ ] Onboarding residence picker; delete `ORG_DEVELOPMENTS` and `DEFAULT_DEVELOPMENT_NAME`.
- [ ] `PropertyProfileSettingsSections.tsx` residence + tower dropdowns and labels from the resolver.
- [ ] Rename cascade in `update-development`; `delete-development` and stats by FK.
- [ ] `publicGeoScope.ts` and SQL `pls_listing_lat/lng` read the development's coordinates via `development_id` (new migration redefining the functions).
- [ ] Super-admin Structure group (§5.1).

**Gate:** in local dev, create a property and a parking slot in Test Residence with its own units and levels; it appears in search at the development pin. Azure dropdowns, codes and snapshots unchanged.

**Acceptance:** `bun run test:edge` (structure resolver), `bun run test:e2e:ci -- --grep "onboarding residence"`, and `bun scripts/dev/residence-snapshots.ts --check` zero diff.

### Phase 2: Guest rules and guest form

- [ ] `occupancy` and `stay` wired into `guestFormSettings`, `get-guest-payment-info`, `guestCounts.ts`, `guestFormSchema.ts` (rename `azureAgeCounts`), `guestFormSteps.ts`, `submit-form` validation.
- [ ] Building locks over property `allowPets` / `allowParking` / `allowSurpriseDecor`; property settings show locks and caps.
- [ ] `propertyResidenceDefaults.ts` (both sides) and `unitTypes.ts` resolver-backed; delete `DEFAULTS_BY_RESIDENCE`, `DEFAULT_AZURE_NORTH_UNIT_TYPES`, deprecated `AZURE_*` aliases.
- [ ] Terms + copy registry v1 with the guest-form, success and pay-parking keys (§4.6); `guestFormBranding.ts` reads them.
- [ ] Super-admin Guest rules and Guest-facing text groups; guest form preview route.

**Gate:** Test Residence guest form hides pets, enforces its own caps, shows its own copy; Azure's 4-adult rule, child-age-3 overflow, 18+ ID rule and every string unchanged.

**Acceptance:** `bun run test` (guest form logic), `bun run test:e2e:ci -- --grep "guest form residence"`, snapshots zero diff.

### Phase 3: Approval steps engine

- [ ] `DocumentRequirementV2` parser with v1 upgrade (Azure gets `legacyKind`, labels, delivery and approval equal to today's behavior).
- [ ] Delete `requirementDocKind` label sniffing; every caller reads fields.
- [ ] `approvals.pdfTemplates` + `upload-development-pdf-template` + `PDF_DATA_KEYS`; `pdfService` fills any template by map; Azure seeded with today's two files and map; preview via signed URL, delete `ui/public/templates` copies after the gate.
- [ ] Orchestrator loops over applicable steps: generate, send, record. GAF / pet become two configured steps, not branches. Dual-write to `gaf_*` / `pet_*` columns only for `legacyKind`.
- [ ] Generic `email-document-request` template; residence template layer in `resolvePropertyTemplateContent` (property → residence → built-in).
- [ ] Inbound routing by `approvals+{slug}--{requirementId}@`, legacy address and subjects still accepted.
- [ ] Snapshot on first entry into `PENDING_DOCUMENTS`; "Use the current steps" action.
- [ ] Labels from requirements in rail (`pendingDocStatusGroups.ts`, `workflowAdvanceMode.ts`), stay guide, calendar, Telegram, plan-skip toasts, AI prompt grounding.
- [ ] `listingAuthorization.ts` Tier 2 label and requirement from `verification`.
- [ ] Remove `mergeDevelopmentPoolSettings` Azure override (values already seeded); remove `AZURE_PMO_EMAIL` and `developmentPmoEmailPlaceholder` name check.
- [ ] Super-admin Approval steps group with builder, PDF mapper, test fill, dry run.

**Gate:** Test Residence booking runs its manual step and its PDF step end to end (generate, email, reply, auto-complete) on local Supabase. Azure GAF and pet PDFs have identical field values; emails, subjects, reply-to and calendar titles match snapshots; an in-flight Azure booking created before the deploy completes normally.

**Acceptance:** `bun run test:edge:handlers` (orchestrator, inbound routing, snapshot), `bun run test:e2e:smoke` (booking journey), snapshots zero diff, and the manual walkthrough recorded in §9.

### Phase 4: Super-admin editor completion and safety

- [ ] Grouped IA with per-group save and unsaved-changes guards.
- [ ] Source badges, reset, impact lines, clamp warnings.
- [ ] Optimistic concurrency, history + restore, `activity_log` diffs.
- [ ] Duplicate residence, type presets at create, readiness checklist gating `ACTIVE`.
- [ ] Mobile pass at 375px on every group (`mobile-responsive`).

**Acceptance:** `bun run test:e2e:ci -- --grep "development editor"`, `bun run test:edge:handlers` (`update-development` 409 + validation), and a 375 / 768 / 1024 px walkthrough of every group.

### Phase 5: Property defaults and building info

- [ ] `propertySeeds` applied in `create-property` / `seedPropertySettings` instead of `INITIAL_ENABLED_*`.
- [ ] `buildingRules` shown on property page, stay guide and showcase alongside host rules, marked as building rules.
- [ ] `templateDefaults` for house rules, check-in / out instructions, parking reminders and email bodies.
- [ ] `guestInfoVisibility`: building info block on stay guide and property page.

**Gate:** a new Test Residence property starts with its residence's amenities, rules and templates; editing a residence template changes every property that has not customized it.

**Acceptance:** `bun run test:edge` (seed + template resolution), `bun run test:e2e:ci -- --grep "residence defaults"`, snapshots zero diff.

### Phase 6: Route audit sweep

Phases 1 to 5 are driven by static analysis. This sweep catches copy, empty states and single-tenant assumptions grep misses. Each route against: **(a)** hardcoded residence / tower / unit / document copy, **(b)** empty state with no development, **(c)** behavior with 2+ developments in one org, **(d)** mobile at 375px.

**Public / guest:** `index-landing`, `search`, `properties`, `properties/chat`, `developments`, `parkings`, `property-showcase`, `calendar`, `form`, `success`, `sd-form`, `stay-guide`, `trip`, `services`, `for-hosts`, `bookings/parking`, `guest-booking-document`, `identity` capture + phone handoff, `legal`, `auth`, `sign-in`, `accept-invite`.

**Guest account:** `account/index`, `stays`, `messages`, `profile`, `tickets`, `vouchers`, `favorites`, `wishlist`, reviews.

**Org / property dashboard:** `org/selector`, `dashboard`, `properties`, `parkings`, `settings`, `team`, `plans`, `activity`, `analytics`, `announcements`, `inbox`, `help-support`, `setup-guide`, `onboarding`, verification (Get Verified, listing authorization), every `org/property/*` (bookings, bookings-detail, calendar, finance, maintenance, pricing, marketing, templates, public-pages, custom-pages, operations, staff, settings incl. listing status, notifications, reviews) and every `org/parking/*`.

**Super-admin:** `admin/developments`, `development-detail`, `orgs`, `hosts`, `host-detail`, `org-properties`, `platform-properties`, `approvals`, `settings`, `platform-tools`, `pricing-plans`, `org-subscriptions`, `parking-payouts`, `announcements`, `support`, `overview`, `playbook`, `ai`, system health.

Known targets: `propertyOverviewStats.ts:12` (`isKnownResidence`), `workflowPlanSkip.ts`, `for-hosts` v3 data and showcase demos, film scenes (`FilmShell.tsx` `FILM_ORG_NAME`, `scenes/Scene*.tsx`), `inboxMockData.ts`, `mockProperties.ts`, `mockDevelopments.ts`, `mockParkingSlots.ts`, `propertyTemplatePlaceholders.ts` sample values (`Monaco 2604`, `/properties/azure-north/…`).

Record findings as a checklist table in this doc rather than fixing inline.

**Acceptance:** the sweep table is filled in, every row has a verdict, and each real defect has an issue or a follow-up phase entry.

### Phase 7: Cleanup and hardening

- [ ] Delete `propertyResidences.ts`, `parkingResidences.ts`, `orgDevelopments.ts`, `propertyResidenceDefaults.ts` maps (both sides) once unreferenced.
- [ ] Drop flat tower keys from every `settings` row.
- [ ] `development_id NOT NULL` once the unmatched-row report is empty on prod.
- [ ] Retire `ui/public/templates` PDF copies (CLAUDE.md "Known sharp edges" entry updated).
- [ ] Follow-up plan for `residence_name` retirement and `gaf_*` / `pet_*` column retirement.

**Acceptance:** `rg -n "propertyResidences|parkingResidences|orgDevelopments|propertyResidenceDefaults" ui/src supabase/functions` returns no hits, and snapshots still zero diff.

---

## 9. Verification strategy

- **Azure golden snapshots** (Phase 0) diffed after every phase; any diff blocks the phase.
- **Unit (Vitest, `.ts` only):** parser totality, v1 → v2 upgrade, per-key resolution and clamping, policy registry, copy validation, unit / slot format presets, requirement applicability. Note: Vitest silently ignores `.test.tsx`, so UI logic must sit in `.ts` helpers to be covered.
- **Deno:** resolver, orchestrator step loop (both residences), PDF fill by map (compare field values, not bytes), inbound routing (new and legacy addresses), snapshot behavior, scoped unique index, rename cascade, `update-development` 409 and validation.
- **Playwright mocked E2E:** super-admin step builder save + reload; guest form under Test Residence (pets hidden, caps, copy); host property settings locks; onboarding residence picker. Phone viewport for each.
- **Manual on local Supabase:** full Test Residence booking with a real inbound reply through the webhook.

---

## 10. Risks

| Risk                                            | Mitigation                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Silent Azure behavior change                    | Golden snapshots before Phase 0, diffed every phase. Primary gate                                                |
| Super-admin edit breaks live bookings           | Per-booking snapshot, retire-not-delete, history + restore                                                       |
| Orchestrator refactor regresses GAF / pet       | Azure modeled as two configured steps with `legacyKind`; dual-write kept; in-flight booking test in Phase 3 gate |
| Inbound replies stop matching after cutover     | Legacy address and subject regex accepted indefinitely for `legacyKind`                                          |
| Rename detaches config                          | FK in Phase 0                                                                                                    |
| ui / edge drift                                 | CI drift check in Phase 0                                                                                        |
| Malformed `settings` 500s a public page         | Total parsers + degradation tests                                                                                |
| Config surface grows untestable                 | Copy registry admission rule (§4.6); typed `PDF_DATA_KEYS`; no workflow builder                                  |
| Scope creep into tenancy or status-graph rework | Explicit non-goals (§1.4)                                                                                        |
| Large change sets hard to review                | Independent phases; split phases over ~20 files by surface                                                       |

**Rollback:** Phases 0 to 2 are additive: FK, history table, snapshot column and new settings keys are harmless if resolvers revert. Phase 3 changes inbound addresses: keep legacy acceptance so a revert does not strand replies. Phase 7 deletions are the first irreversible step; hold until Azure snapshots pass on prod-like data.

---

## 11. Open questions

One decision each. Recommended option first.

1. **Multi-development orgs.** Can one org host properties across several residences? **Recommended: yes.** The resolver is per property, so it costs nothing now; confirm before the Phase 1 onboarding picker.
2. **Non-condo structure.** For `SUBDIVISION` / `TOWNHOUSE`, is "Phase / Block & Lot" via `towerLabel` + `unitLabel` + alnum format enough? **Recommended: yes for this plan**; a structured lot/block model is a follow-up only if a real subdivision needs it.
3. **Who creates developments?** **Recommended: super admin only**, with "My building isn't listed" opening a support ticket. Self-serve creation needs a verification path and its own plan.
4. **Can hosts change check-in / out times?** **Recommended: inherited (yes) by default**, with a per-residence lock for buildings that enforce times at the gate.
5. **Testing a new residence on production.** **Recommended: add `developments.is_test`** mirroring the test-tenant guardrail, rather than relying on `INACTIVE`.
6. **Extra property-level inputs for a residence's PDF** (beyond unit owner, onsite contact, contact number, signature). **Recommended: out of scope**; map existing keys only and revisit when a real template needs more.
7. **`residence_name` and `gaf_*` / `pet_*` column retirement.** Out of scope; follow-up once `development_id` is `NOT NULL` and dual-write has run clean.

---

## 12. Documentation to update (per `documentation-maintenance`)

- `docs/architecture/overview.md`, `docs/PROJECT.md`, `data-model.md` (FK, snapshot column, history table, Residence Profile schema).
- `.cursor/rules/booking-workflow.mdc` (requirement v2, snapshot, step loop, inbound routing) and `docs/workflow/done/booking-workflow-configurable-docs.md` cross-link.
- `docs/guides/routes/admin/development-detail.md` (**correct the Towers & Parking claim once true**; new groups), `onboarding.md`, `org/property/settings.md`, `form.md`, `stay-guide.md`, `search.md`, bookings detail guide.
- `docs/archive/operations/migration-runbook.md` (backfill, unmatched-row report, structure migration, Azure PDF template seed).
- CLAUDE.md "Known sharp edges" (two PDF template copies) once retired.
- Support content: host FAQs for locked fields and "My building isn't listed" (`support-content`).

Invoke `route-guides` for every route touched, `mobile-responsive` and `unsaved-changes-guard` for every editor group, `audit-logging` for development writes and the re-snapshot action, `plans-and-permissions` for the re-snapshot action (Plans: N/A, platform feature; RBAC: `bookings.detail` edit leaf).

---

## 13. Related

- [`docs/guides/routes/admin/development-detail.md`](../../guides/routes/admin/development-detail.md): existing editor
- [`docs/workflow/done/booking-workflow-configurable-docs.md`](../done/booking-workflow-configurable-docs.md): the pattern this extends
- [`docs/workflow/done/booking-workflow-multi-tenancy.md`](../done/booking-workflow-multi-tenancy.md)
- [`docs/workflow/done/guest-form-configurable-sections.md`](../done/guest-form-configurable-sections.md)
- [`docs/workflow/done/public-operational-guest-pages-multi-tenant.md`](../done/public-operational-guest-pages-multi-tenant.md)
- [`docs/workflow/in-progress/live-identity-verification.md`](../in-progress/live-identity-verification.md): per-slot ID capture (`idRequiredFromAge` interacts)
- [`docs/workflow/in-progress/cancellation-policy-and-process.md`](../in-progress/cancellation-policy-and-process.md): stays per property, not per residence

---

## 14. Verification results

Fill in after each phase. A phase is not done until every row is `pass`.

| Phase | Gate                                                         | Result                   | Date       | Notes                                                                             |
| ----- | ------------------------------------------------------------ | ------------------------ | ---------- | --------------------------------------------------------------------------------- |
| 0     | Azure snapshots identical, second residence generic          | pass (partial), see note | 2026-11-09 | Unit + Deno + local-DB proof; full email/PDF golden set still owed before Phase 3 |
| 1     | Test Residence property + parking in search at own pin       | TBD                      |            |                                                                                   |
| 2     | Test Residence guest form, Azure unchanged                   | TBD                      |            |                                                                                   |
| 3     | End-to-end Test Residence booking, Azure snapshots identical | TBD                      |            |                                                                                   |
| 4     | Editor groups, concurrency, history, 375px                   | TBD                      |            |                                                                                   |
| 5     | Property seed defaults and inherited templates               | TBD                      |            |                                                                                   |
| 6     | Route sweep table filled                                     | TBD                      |            |                                                                                   |
| 7     | Orphan modules deleted, snapshots still identical            | TBD                      |            |                                                                                   |

**Phase 0 gate log (2026-11-09):**

| Gate                                                     | Result                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `bun run type-check`                                     | pass                                                         |
| `bun run lint`                                           | 0 errors (warnings only, repo baseline)                      |
| `bun run test` (Vitest)                                  | 862 files / 5818 tests pass                                  |
| `bun run test:edge` (Deno `_shared`)                     | 1419 tests pass                                              |
| `bun run check:residence-profile-drift`                  | pass                                                         |
| `bun scripts/dev/residence-profile-snapshots.ts --check` | pass                                                         |
| `bun run test:e2e:smoke`                                 | 245 pass on re-run; 3 parallel-load flakes pass in isolation |
| `bun run test:e2e:ci`                                    | 317 pass                                                     |
| `bun run build` + budget / source-map / blocking-script  | pass (bundle budget is warn-only)                            |
| `bun run db:migrate` (local)                             | all four migrations applied                                  |
| `bun run seed:local` + `99-verify`                       | pass; `test-residence` present, property and parking linked  |
| `development_unmatched_assets`                           | 0 rows locally                                               |
| Merge guard, merge mode on this branch                   | fails as intended                                            |
| Merge guard, deploy mode with the module present         | fails as intended                                            |

Not run here: a production or hosted-dev unmatched-row count. That is a read-only query the
owner should run before Phase 1.

## 15. Merge and deploy guard

| Artifact                            | Role                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/workflow/merge-guard.json`    | Single source of truth. `blockMerge` fails CI on the branch; `blockDeploy` fails a deploy while the module is in the tree.                   |
| `scripts/dev/check-merge-guard.mjs` | Reads the registry. `--mode=merge` (CI on every PR and push) and `--mode=deploy` (before a Supabase deploy). `--self-test` proves the logic. |
| `.github/workflows/ci.yml`          | Runs `merge` mode as a required check on this branch.                                                                                        |
| `.github/workflows/cd-prod.yml`     | Runs `deploy` mode before any Supabase deploy.                                                                                               |
| Draft PR                            | Native GitHub guard: a draft PR cannot be merged.                                                                                            |

**To clear it, the owner edits `merge-guard.json`:**

```json
"clearedAt": "2026-11-20T00:00:00Z",
"clearedBy": "owner"
```

No agent clears it. Removing the file or the entry is not a valid clear; the CI job fails when
the registry is missing.
