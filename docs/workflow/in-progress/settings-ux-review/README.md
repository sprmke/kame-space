---
title: 'Settings (org, property, parking) UX/UI review'
status: active
tags: [ux, ui, settings, review, qa, e2e, org, property, parking]
updated: 2026-11-23
---

# Settings surfaces UX/UI review — org, property, parking

Deep review of the three settings modules that share the `AdminSectionNavLayout` shell:

| Scope    | Route                                           | Sections |
| -------- | ----------------------------------------------- | -------- |
| Org      | `/org/:orgSlug/settings`                        | 6        |
| Property | `/org/:orgSlug/property/:propertySlug/settings` | 18       |
| Parking  | `/org/:orgSlug/parking/:parkingSlug/settings`   | 9        |

Every section and every inline control was opened at phone (390), tablet (768), laptop (1280),
desktop (1440) and in dark mode. Reviewed with the `impeccable` (critique + audit),
`mobile-responsive`, `frontend-design`, `ui-ux-pro-max`, `design-md`, `accessibility`,
`human-copy` and `property-dashboard-qa` skills.

**This is a review, not a fix.** No product code changed. E2E coverage and a slow-motion tour were
added; see [Test coverage added](#test-coverage-added).

## Verdict

The shell is the strongest part of the app: one grouped rail, one card primitive, one save model,
one unsaved-changes guard, and a real permission matrix behind all three pages. A busy host can
scan 18 property sections and jump to any of them in one click on a laptop.

That strength is undercut by **four defects that block a host**, all at the edges of the model:
a duplicated section, a validation rule a host cannot satisfy, a location field that silently
refuses manual entry, and a legacy listing whose required field cannot be edited. Phone users also
get **no section navigation at all** for the longest settings page in the product.

## Evidence

| Item        | Value                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| App         | `http://127.0.0.1:5186` (Vite worktree port) + local Supabase `:54321`                        |
| Fixtures    | Shared property-team RBAC mocks + realistic residence (`Azure North Residences` / `Monaco`)   |
| Viewports   | 390×844, 768×1024, 1280×800, 1440×960, 1440×960 dark                                          |
| Screenshots | 63, in [`screenshots/`](./screenshots)                                                        |
| Recordings  | 9 slow-motion flows, in [`recordings/`](./recordings)                                         |
| Console     | 0 page errors on the property and parking shells; one `setup-guide-state` crash on org (P2-4) |
| DOM proof   | `section-guest-experience` × 2, `property-settings-heading` × 2 (probe output below)          |

```
duplicate ids (property): property-settings-heading, section-guest-experience
duplicate ids (org):      org-settings-heading
duplicate ids (parking):  parking-settings-heading
section order (property): basic details media amenities house-rules cancellation location
                          branding search guest-form guest-experience guest-rewards payment
                          building-forms email-automations integrations guest-experience
                          activity danger
```

## What works (verified end to end)

| Area                | Verified                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Grouped rail        | Listing / Guest setup / Connections / Account groups; 44px rows; sliding active pill                |
| Deep links          | `#section-<id>` scrolls the right card, with the save-error path scrolling to the blocking section  |
| Validation          | Required markers, inline errors after interaction, Save disabled with the first blocking reason     |
| Save model          | Partial save by section; profile + operational payloads split; `settings_saved` analytics captured  |
| Unsaved guard       | Save & leave / Discard / Keep editing on route change, plus guarded close inside the payment modal  |
| Destructive actions | Delete organization requires typing the slug; property Pause/Archive explain the impact             |
| Permissions         | Read-only property role is redirected and never sees Settings; parking view-only shows an explainer |
| Plan gates          | Plans + team leaves drive section edit locks; `Copy from…` carries a Business tier badge            |
| Payment safety      | Payment edits open the OTP dialog before the settings PATCH                                         |
| Loading             | `AppSettingsNavLayoutSkeleton` matches the rail + cards; no generic spinner                         |
| Dark mode           | Tokens applied on every card, swatch row, rail and dialog                                           |
| Phone chrome        | Teal hero, single overflow action menu, sheets for Manage dialogs                                   |

## Findings

### P1 — blocks a host

#### P1-1. Property Settings renders **Guest experience twice**

Evidence: [property-duplicate-guest-experience](./screenshots/issue-property-duplicate-guest-experience.png),
[property-desktop-16-integrations](./screenshots/property-desktop-16-integrations.png).

`SETTINGS_SECTIONS` lists `guest-experience` twice, and `PropertySettingsCard` renders
`<PropertyGuestExperienceSection>` twice: once with
`propertyId / orgSlug / propertySlug / listingUnitLabel / disabled`, and once with only
`propertyId / disabled`. The second instance lands after **Integrations**, outside the Guest setup
group.

Impact:

- two cards with the same title edit the same data, but one has no listing-unit context, so the
  "unit floor" default behaves differently between the two,
- a duplicate DOM id (`section-guest-experience`) breaks anchors and the rail's scroll spy,
- the rail shows "Guest experience" once, so clicking it scrolls to the first card and hides the
  duplicate further down.

Fix direction: delete the second entry in `SETTINGS_SECTIONS` and the second JSX block; add a
unit test asserting unique section ids.

#### P1-2. Parking settings can never be saved when the slot label is not digits-only

Evidence: [parking-invalid-slot-blocked](./screenshots/issue-parking-invalid-slot-blocked.png).

`isValidParkingSlotNumber` accepts `^\d{1,4}$`. A slot labelled `12A` (the shared fixture, and a
plausible legacy label) fails it. **Slot number is read-only** (`tabIndex={-1}`, `aria-readonly`),
so the host sees:

- `Slot number *` filled with `12A`,
- `Enter a valid slot number` underneath,
- `Save Changes` permanently disabled, with the reason only on the button's `title`.

Every other edit on the page is blocked by a field the host cannot reach.

Fix direction: accept the real label grammar (letters allowed), or stop validating the read-only
display value against the writable rule, or give the slot an explicit "rename in Properties"
route.

#### P1-3. A typed address is silently discarded when Google Maps is unavailable

Evidence: [parking-map-failure](./screenshots/issue-parking-map-failure.png).

With Maps blocked, the card shows `The Google Maps JavaScript API could not load.` above an empty
`Map pin` box. The address input is a Places autocomplete: typing updates the visible text but
**never marks the draft dirty**, so `Save Changes` never appears and the address is lost on leave.
The same component (`PropertyLocationPicker`) powers the property Location dialog.

The earlier failure mode also leaked Google's developer copy into the address placeholder
("Oops! Something went wrong.") and into the map ("see the JavaScript console for technical
details").

Fix direction: keep a plain text address path that commits on change, show a retry, and never
expose provider error copy to a host.

#### P1-4. Legacy residence leaves a required, read-only Tower the host cannot fix

Evidence: [property-incomplete-basic](./screenshots/issue-property-incomplete-basic.png).

`propertyProfileDraftFromProperty` drops `tower` when it is not a known tower for the listing's
residence. For a listing whose `residenceName` is not in `PROPERTY_RESIDENCES` (the shared
"Solea Mactan" fixture behaves exactly like legacy data), the Tower input renders empty,
**read-only**, with a required asterisk and a red rail dot. `propertySettingsCompletion` reports
`Select a tower` for `basic`, so Setup Guide's property-basics step can never complete and the
rail dot never clears. There is no link to the place where tower/residence are actually editable.

Fix direction: either make Tower editable here (it is a profile field), or replace the hard error
with a read-only summary plus a "Change residence and tower in Properties" action.

### P2 — confusing or costly, schedule it

| #     | Finding                                                                                                                                                                                                                                                                                    | Evidence                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-1  | **Phone has no section navigation.** The rail is `lg`-only and nothing replaces it, so the 18-section page is a 12-screen scroll.                                                                                                                                                          | [property-phone-top](./screenshots/property-phone-top.png), [property-phone-basic](./screenshots/property-phone-basic.png)                        |
| P2-2  | The rail's active row is colour-only: no `aria-current`, no selected announcement. Screen-reader users cannot tell where they are.                                                                                                                                                         | [01 rail](./screenshots/property-desktop-01-basic.png)                                                                                            |
| P2-3  | **Partial save toasts success while a field is invalid.** Clearing the name still saves an unrelated `details` section and toasts `New changes has been saved.`; with a restricted role the same path surfaces `You do not have permission to do that` instead of `Enter a property name`. | probe: `plan {"profileSections":["details"],"blockedSections":["basic"],"firstBlockedMessage":"Enter a property name"}`                           |
| P2-4  | `useSetupGuideStateWrite` crashes when `setup-guide-state` answers without `setupGuide`: `TypeError: Cannot read properties of undefined (reading 'dismissedAt')`. It fires automatically when the required setup steps hit zero.                                                          | pageerror captured on the org settings load                                                                                                       |
| P2-5  | **Two-step saves are labelled as one.** The Payment modal's `Save` and the Automations modal's `Done` only stage the draft; the page-level `Save` is still required (and payment then opens OTP). Nothing says so.                                                                         | [04-property-dialogs](./recordings/04-property-dialogs.webm), [08-parking](./recordings/08-parking-overview-automations-location.webm)            |
| P2-6  | **Duplicate heading id on every settings page.** `AdminMobilePage` mounts the mobile hero and the desktop header with the same `titleId`; hidden copies keep the id in the DOM.                                                                                                            | probe: `property-settings-heading`, `org-settings-heading`, `parking-settings-heading`                                                            |
| P2-7  | Superhost says `4 of 4 goals met. Next check: Oct 1, 2026` next to `Not a Superhost yet` with a full progress bar. Nothing explains the wait.                                                                                                                                              | [org-desktop-03-superhost](./screenshots/org-desktop-03-superhost.png)                                                                            |
| P2-8  | Time format is mixed inside one page: Property Details uses `2:00 PM`, the House Rules summary prints `After 14:00`.                                                                                                                                                                       | [property-desktop-02-details](./screenshots/property-desktop-02-details.png), [05 house rules](./screenshots/property-desktop-05-house-rules.png) |
| P2-9  | Cancellation's `Guest preview` shows a **check icon** for `This host has not set cancellation terms yet`. The success icon contradicts the unfinished state.                                                                                                                               | [property-desktop-06-cancellation](./screenshots/property-desktop-06-cancellation.png)                                                            |
| P2-10 | Amenities guidance differs by scope: property says `Select at least 5 amenities (0 selected). This helps guests know what your property offers.`, parking says `Select at least 1 amenity. This helps guests know what this slot offers.`                                                  | [04 amenities](./screenshots/property-desktop-04-amenities.png), [parking 04](./screenshots/parking-desktop-04-features.png)                      |
| P2-11 | Integration status contradicts itself: property says `No API keys configured - AI features are skipped when keys are missing.`; parking says `Run a connection test to confirm AI services are working.`                                                                                   | [property 16](./screenshots/property-desktop-16-integrations.png), [parking 07](./screenshots/parking-desktop-07-integrations.png)                |
| P2-12 | Identity fields (Property Type, Residence, Tower, Unit) are read-only but carry required asterisks, and no surface says where to change them.                                                                                                                                              | [property-desktop-01-basic](./screenshots/property-desktop-01-basic.png)                                                                          |
| P2-13 | Org subtitle promises "profile, billing, and preferences", but billing lives under `Plans & Billing`; the nav also puts a group heading `AI` directly above the single item `AI features`.                                                                                                 | [org-desktop-01-basic](./screenshots/org-desktop-01-basic.png), [org 04](./screenshots/org-desktop-04-ai.png)                                     |
| P2-14 | Brand color swatches wrap to three rows on phone and leave `Reset` orphaned on its own row; the property page shows no explicit selected check (org does).                                                                                                                                 | [property-phone-top](./screenshots/property-phone-top.png), [org 01](./screenshots/org-desktop-01-basic.png)                                      |
| P2-15 | Parking `Code` renders `–` inside an editable-looking input.                                                                                                                                                                                                                               | [parking-desktop-01-basic](./screenshots/parking-desktop-01-basic.png)                                                                            |
| P2-16 | The AI usage card prints the raw plan code (`Pro`) while the sidebar shows the host-facing tier (`Business plan`).                                                                                                                                                                         | [org-desktop-03-superhost](./screenshots/org-desktop-03-superhost.png)                                                                            |
| P2-17 | The House Rules dialog clips its last `Add` row under the sticky footer at 960px height, and a two-line pill misaligns its row.                                                                                                                                                            | [04-property-dialogs](./recordings/04-property-dialogs.webm)                                                                                      |
| P2-18 | Listing status ends the page with ~600px of empty canvas and a `Compare options` CTA whose destination is unclear.                                                                                                                                                                         | [property-desktop-18-danger](./screenshots/property-desktop-18-danger.png)                                                                        |

### P3 — polish and consistency

| #     | Finding                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| P3-1  | Save labels differ by scope: `Save Changes` (property, parking) vs `Save` (org); loading states mix `Saving...` and `Saving…`.  |
| P3-2  | Copy error: `New changes has been saved.`                                                                                       |
| P3-3  | Payment dialog mixes `Account name` and `Account Number`; `QR code - GCash` uses a hyphen as a separator.                       |
| P3-4  | Automations dialog repeats the pronoun: `To: Guest` / `When: When their parking is confirmed and paid.`                         |
| P3-5  | Photo empty-state buttons (`Upload Photos`, `Upload Video`) look disabled because they use muted outline styling while enabled. |
| P3-6  | Cancellation example prints `0% of paid` in the lowest-contrast grey on the dialog.                                             |
| P3-7  | The payment modal auto-focuses its close button, so a large teal ring is the first thing on screen.                             |
| P3-8  | Empty Activity dialog is mostly blank and says `No activity in this range.` although no range control is visible.               |
| P3-9  | Org `Activity` card duplicates the `Activity` rail item and offers a second `Manage` path to the same dialog.                   |
| P3-10 | `Listing status` lives in the `Account` group although it is listing lifecycle, not account settings.                           |
| P3-11 | Nav labels mix sentence case and title case (`Basic information` vs `Basic Information`, `Danger zone` vs `Danger Zone`).       |
| P3-12 | AI cost is USD (`$0.00 / $10`) inside an otherwise PHP product; the credits line reads `~0 / 1,000`.                            |
| P3-13 | The floating quick-access button overlaps the last card's actions on phone (sitewide pattern, visible on Settings).             |
| P3-14 | Cookie banner covers the bottom save area until dismissed (sitewide, but Settings is where it hurts most).                      |

## Cross-viewport matrix

| Element        | 390                         | 768                     | 1280                     | 1440                 |
| -------------- | --------------------------- | ----------------------- | ------------------------ | -------------------- |
| Shell          | Brand hero + bottom tab bar | Same, bottom bar        | Sidebar + compact header | Same                 |
| Section rail   | **Hidden, no replacement**  | Hidden, no replacement  | Visible, sticky          | Visible, sticky      |
| Cards          | 1-up                        | 1-up, two-column fields | Card + 260px rail        | Card + 260px rail    |
| Brand swatches | 3 rows, Reset orphaned      | 1 row + Reset below     | 1 row + Reset inline     | 1 row + Reset inline |
| Manage dialogs | Bottom sheet                | Bottom sheet            | Centered dialog          | Centered dialog      |
| Save action    | Overflow menu in hero       | Overflow menu           | Header button            | Header button        |
| Danger zone    | Stacked buttons             | Stacked                 | Inline button row        | Inline button row    |

## Copy inventory (suggested replacements)

| Current                                                           | Suggested                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `New changes has been saved.`                                     | `Settings saved. Some sections still need attention.`             |
| `You do not have permission to do that` (on a validation failure) | The actual field error first: `Enter a property name`             |
| `The Google Maps JavaScript API could not load.`                  | `Map unavailable. Enter the address manually.` + Retry            |
| `Oops! Something went wrong.` (map / address)                     | Same as above; never provider copy                                |
| `Not a Superhost yet` next to `4 of 4 goals met`                  | `All goals met. Superhost status applies after the Oct 1 review.` |
| `No arrival essentials yet`                                       | `Arrival details not set`                                         |
| `To: Guest / When: When …`                                        | `To: Guest / Sends when …`                                        |
| `QR code - GCash`                                                 | `GCash QR code`                                                   |
| `Account Number`                                                  | `Account number`                                                  |
| `Manage your organization's profile, billing, and preferences.`   | `Organization profile and preferences.`                           |
| `Compare options` (listing status)                                | Name the outcome: `See what changes`                              |
| `Slot number` (read-only, invalid)                                | Show the label as text, with `Rename in Properties`               |

## Accessibility notes

- **No `aria-current` on the section rail** (P2-2). The pill and text colour are the only cues.
- **Duplicate `id` values** on the page heading and on `section-guest-experience` (P1-1, P2-6).
  Duplicate ids break `aria-labelledby` targets and in-page anchors.
- **Touch targets**: rail rows and `Manage` buttons keep a 44px hit area; brand swatches are
  36–40px visual with a 44px pad. The `Reset` chip is 32px tall with a 44px pad.
- **Focus**: the payment modal opens with focus on the close button and a visible ring; the
  cancellation cards are radios with a visible selected ring plus a `POPULAR` chip.
- **Contrast**: dark-mode body text and labels sampled ≥ 6:1. The weakest text on either theme is
  the cancellation example's `0% of paid` grey (P3-6).
- **Forms**: required markers are visual `*` plus `required` on the input; help icons are
  `<button aria-label="About …">` next to each label, so `getByLabel` also matches the help button
  (see [Test coverage added](#test-coverage-added)).

## Test coverage added

| File                                                             | Purpose                                                                                                                                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/e2e/features/dashboard/settings/shared/settingsHarness.ts`   | Scope paths, section lists, the deterministic fixture set (org logo, realistic residence/tower, full settings leaves), save-path mocks and the demo pause/scroll helpers                |
| `ui/e2e/features/dashboard/settings/settingsModule.spec.ts`      | `@ci` — 16 tests + 4 documented `fixme`s: rail, sections, save, unsaved guard, inline error, payment dialog, listing status, phone overflow, org save/delete/AI, parking save/view-only |
| `ui/e2e/features/dashboard/settings/settingsTour.slowmo.spec.ts` | `@demo` — 9 headed slow-motion scenarios, one per flow, recorded to video                                                                                                               |
| `ui/e2e/features/team/shared/propertyTeamRbacHarness.ts`         | Additive options only: `extraPermissions`, `propertyListing`, `orgLogoUploaded`                                                                                                         |
| `ui/e2e/features/parking/shared/parkingFlowHarness.ts`           | Additive option only: `slotLabel` (settings reads it; digits-only is savable)                                                                                                           |

Commands:

```bash
bun run test:e2e:settings            # headless mocked suite
bun run test:e2e:settings:tour       # headed slow-motion walkthrough
bun run test:e2e:settings:tour:video # same, plus .webm under test-results/playwright
```

The `fixme` tests encode P1-1, P1-2, P2-1 and P2-6 so they turn green the moment the defects are
fixed.

### Recorded walkthroughs

| File                                                                                                          | Flow                                                          |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`01-property-overview-and-section-rail.webm`](./recordings/01-property-overview-and-section-rail.webm)       | Hero, 18 rail items in order, every card                      |
| [`02-property-save-and-unsaved-guard.webm`](./recordings/02-property-save-and-unsaved-guard.webm)             | Edit name, leave, guard, keep editing, save                   |
| [`03-property-review-cards.webm`](./recordings/03-property-review-cards.webm)                                 | Slow scroll of all 18 property cards                          |
| [`04-property-dialogs.webm`](./recordings/04-property-dialogs.webm)                                           | Amenities, House Rules, Cancellation, Payment, Listing status |
| [`05-property-phone-layout.webm`](./recordings/05-property-phone-layout.webm)                                 | Phone hero, cards, no rail, bottom sheet                      |
| [`06-org-overview-and-save.webm`](./recordings/06-org-overview-and-save.webm)                                 | Org rail, Socials, Superhost, AI, Activity, Danger, save      |
| [`07-org-delete-confirmation.webm`](./recordings/07-org-delete-confirmation.webm)                             | Slug-gated delete dialog                                      |
| [`08-parking-overview-automations-location.webm`](./recordings/08-parking-overview-automations-location.webm) | Parking rail, Location, Automations dialog, danger zone       |
| [`09-parking-read-only-role.webm`](./recordings/09-parking-read-only-role.webm)                               | `settings:view` without `settings:edit`: explainer, no form   |

## Not covered in this pass

- **Google Maps with a production key.** The failure state is reproduced by aborting the Maps
  scripts; the success path is captured only with the local key.
- **Payment OTP completion.** The dialog and the pre-save gate are covered; entering a real code
  needs email delivery, so the happy path stops at the page-level save.
- **Telegram test-send, AI voice test, Meta publish.** Integration settings need live credentials.
- **Plan-tier sweep.** The org runs on Business in the fixture; Free/Starter/Pro gating for
  settings sections is covered by the existing plan-gate suite, not re-exercised here.
- **Parking plan card.** The sidebar plan entry renders its skeleton indefinitely with the parking
  harness (no parking subscription endpoint mocked); not treated as a product finding.
- **Lighthouse / bundle cost.** Out of scope for a UX pass.

## Recommended remediation order

1. **P1-1** remove the duplicate Guest experience section and assert unique section ids.
2. **P1-2** fix the slot-label validation (or stop validating the read-only value).
3. **P1-3** keep a manual address path that commits without Places, and replace provider copy.
4. **P1-4** make Tower editable or point at the surface that owns it.
5. **P2-1** add a phone jump list (sheet or chip strip) for the section rail.
6. **P2-3 / P2-5** make partial saves and staged modal edits say what actually happened.
7. **P2-2 / P2-6** add `aria-current` and stop mounting two headings with one id.
8. Copy pass (the table above), then P2 layout finishing and the P3 list.

## Related

- Plan: [`settings-cleanup-and-clarity.md`](../settings-cleanup-and-clarity.md) — Phases 1-5 shipped; this review is the post-ship UX audit.
- Route guides: [`org/settings.md`](../../../guides/routes/org/settings.md), [`org/property/settings.md`](../../../guides/routes/org/property/settings.md), [`org/parking/settings.md`](../../../guides/routes/org/parking/settings.md).

## Screenshot index

| Pattern                                                           | Contents                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `property-desktop-00-top.png`                                     | Hero, rail, Basic Information                                 |
| `property-desktop-01-basic.png` … `18-danger.png`                 | One file per rail item, in rail order (02 = Property Details) |
| `property-laptop-top.png`                                         | 1280 layout                                                   |
| `property-tablet-top.png`                                         | 768 layout                                                    |
| `property-phone-top.png`, `-basic`, `-payment`, `-listing-status` | Phone hero and the cards that change most on phone            |
| `property-dark-00-top.png`, `-01-basic.png`                       | Dark mode                                                     |
| `org-desktop-00-top.png` … `06-danger.png`                        | Org sections                                                  |
| `org-phone-top.png`, `-ai.png`, `org-dark-*`                      | Org phone and dark                                            |
| `parking-desktop-00-top.png` … `09-danger.png`                    | Parking sections                                              |
| `parking-phone-top.png`, `-location.png`, `parking-dark-*`        | Parking phone and dark                                        |
| `issue-*.png`                                                     | The four P1 / evidence captures                               |
