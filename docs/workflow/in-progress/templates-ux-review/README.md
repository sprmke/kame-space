# Property Templates UI/UX review

Scope: the **property Templates module only** (`/org/:orgSlug/property/:propertySlug/templates`).
Finance, marketing and the other modules reviewed in earlier sessions are **not** part of this
change; the session title was left over from that work.

Baseline: `origin/main` at `c1cc929d6` (40 commits newer than the branch the first pass looked at).
The review was re-run on main before any edit, so every finding below is against current
production UI. Two findings from the first pass were already fixed on main and are dropped.

Evidence:

- `screenshots/before/` and `screenshots/after/` — 55 screens each (plus a 360px editor shot in `after` only), every supported width
  (360, 390, 430, 768, 834, 1024, 1280, 1440, 1920) plus dialogs, menus, preview, plan-gated,
  read-only, dark mode, loading, empty and error states.
- `screenshots/compare/` — side-by-side before/after pairs.
- `screenshots/review.html` — one page with all pairs and captions. Open it in a browser.
- `recordings/` — slow-motion walkthroughs of the library, the edit and verify flow, create and
  send, and the phone flow.

Regenerate:

```bash
PLAYWRIGHT_CAPTURE_SCREENS=1 TEMPLATES_SHOT_DIR=after \
  playwright test ui/e2e/features/dashboard/templates/templatesUxReview.spec.ts --project=chromium
python3 scripts/dev/build-templates-ux-review.py
bun run test:e2e:templates:tour:video
```

## Design health (Nielsen, /40)

| Heuristic                       | Before | After  | What moved                                                 |
| ------------------------------- | ------ | ------ | ---------------------------------------------------------- |
| Visibility of system status     | 3      | 3      | Skeleton, Unsaved badge, save/sending states already good. |
| Match system / real world       | 3      | 3      | Clear hospitality language; no jargon added.               |
| User control and freedom        | 3      | 4      | Read-only no longer offers a body it cannot save.          |
| Consistency and standards       | 2      | 3      | One name per action; one "Guest emails" label.             |
| Error prevention                | 3      | 4      | New templates no longer land in the middle of Stay guide.  |
| Recognition rather than recall  | 3      | 3      | Rail groups and placeholders are discoverable.             |
| Flexibility and efficiency      | 2      | 2      | No bulk actions or shortcuts (deferred, feature work).     |
| Aesthetic and minimalist design | 3      | 3      | Phone header is tighter; density unchanged elsewhere.      |
| Error recovery                  | 2      | 4      | Error is centered and actionable; empty is not an error.   |
| Help and documentation          | 2      | 3      | Two FAQ answers and clearer group labelling.               |
| **Total**                       | **26** | **32** | Acceptable → Good                                          |

## Fixed in this change

| #   | Priority | Finding                                                                                                                                                      | Fix                                                                                                   | Files                                |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | P1       | A read-only member could still click **Edit** and type into the rich text body, with no Save.                                                                | The Edit tab is not rendered and the editor body is not mounted for read-only roles.                  | `PropertyTemplateEditorPane.tsx`     |
| 2   | P1       | **New template** defaulted the Group to Stay guide, so host-owned rows landed among the ten built-in sections.                                               | Default is **Custom**. Opening Add template from a group or folder still preselects that destination. | `AddCustomTemplateDialog.tsx`        |
| 3   | P1       | A template inside a folder could never be moved back to the ungrouped list: Custom disappeared from Move once any folder existed.                            | Custom is always a Move destination.                                                                  | `templateLibrary.ts` + unit test     |
| 4   | P2       | Empty library said "Reload to try again" and offered Reload, as if loading had failed.                                                                       | Empty shows **No templates yet**; Reload is only in the error state.                                  | `TemplatesPage.tsx`                  |
| 5   | P2       | Load failure rendered a full-width bordered card with three lines at the top and a huge blank area.                                                          | Centered icon, message and **Try again**, matching the pane's other empty states.                     | `TemplatesPage.tsx`                  |
| 6   | P2       | **Send to guest** listed only the guest name and dates, so the address was invisible at send time.                                                           | Each result shows the guest email; the selected row carries a check and a screen-reader "Selected".   | `SendCustomTemplateDialog.tsx`       |
| 7   | P2       | A folder and a template with the same name produced two identical "Actions for X" buttons in one rail.                                                       | **Group actions for X** vs **Template actions for X**.                                                | `TemplateLibraryRail.tsx` + specs    |
| 8   | P2       | The phone editor spent a full 44px row on "All templates" and showed a two-line description, pushing the editor body down.                                   | Back is an icon on the title row and the description is hidden below `sm`.                            | `PropertyTemplateEditorPane.tsx`     |
| 9   | P2       | On Free, two **Starter** pills floated above the two header buttons and collided with the page title.                                                        | One pill on **New template**. New group still opens the same upgrade dialog.                          | `TemplatesPage.tsx`                  |
| 10  | P2       | At the end of the phone list the last row could sit under the floating Quick Access hub.                                                                     | Extra bottom clearance on the rail's scrollport; an E2E test asserts padding ≥ hub height + 8px.      | `TemplateLibraryRail.tsx` + spec     |
| 11  | P3       | An empty folder said "Move a template here" while also offering **Add template**.                                                                            | "Add or move a template here" when the Add button is present.                                         | `TemplateLibraryRail.tsx`            |
| 12  | P3       | The page subtitle named only house rules and email templates, though the page also holds messages and team alerts.                                           | "Manage the text guests and your team receive."                                                       | `TemplatesPage.tsx`                  |
| 13  | P3       | The Move destination said **Emails** while the rail said **Guest emails**.                                                                                   | One label, enforced by a unit test.                                                                   | `templateLibrary.ts` + test          |
| 14  | P3       | The existing workbench E2E was already red on main: it expected "Emails" and House Rules as the default selection after the reading-order and label changes. | Spec updated to current labels and to Check-in Instructions as the first guide section.               | `propertyTemplatesWorkbench.spec.ts` |

## Verified, no change needed

- **Preview does not run under the bottom dock.** Measured on a 390px phone: iframe bottom is at or
  above the dock top. The email body scrolls inside its own frame. Locked by a test.
- **Group counts render for read-only members.** Verified in the DOM and in the capture.
- **No horizontal overflow** at any width from 360 to 1920 (0px document overflow measured).
- **No unnamed icon buttons, unlabeled fields or untexted images** in the captured states.
- **Dark mode** holds contrast on the rail, editor, sheets and dock.
- The unsaved-changes guard, OTP flow, reset, delete, move, folder CRUD and preview all still work.
- The contrast probe's only flags were a gradient-filled primary button (background-image, not a
  token failure) and a placeholder token chip at 4.49:1 (rounding, not prose).

## Deferred, with reason

| Item                                               | Why it is not in this change                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Bulk actions and keyboard shortcuts on the rail    | New capability, not a defect. Needs its own scope and permission decisions.                                    |
| Quick Access hub overlapping rows mid-scroll       | Global floating pattern shared by every list page. The end-of-scroll clearance is guaranteed here.             |
| Upgrade dialog showing `₱NaN` in the Free capture  | Harness does not mock `preview-org-plan-change`. Not a product finding; verify in Plans.                       |
| Inline "Not set for this property: {{token}}" line | Those tokens are the saved content. The editor already lists them so the host can fill the setting.            |
| Templates writes and activity logging              | Unchanged. `property-templates-settings` already emits `settings.template_saved` / `_deleted` / folder events. |

## Code changes

- `ui/src/features/dashboard/bookings/components/property-templates/PropertyTemplateEditorPane.tsx`
- `ui/src/features/dashboard/bookings/components/property-templates/AddCustomTemplateDialog.tsx`
- `ui/src/features/dashboard/bookings/components/property-templates/TemplateLibraryRail.tsx`
- `ui/src/features/dashboard/bookings/components/property-templates/SendCustomTemplateDialog.tsx`
- `ui/src/features/dashboard/bookings/lib/templateLibrary.ts`
- `ui/src/features/dashboard/bookings/pages/TemplatesPage.tsx`
- `ui/e2e/features/team/shared/propertyTeamRbacHarness.ts` (export the entitlements fixture)
- `scripts/dev/build-templates-ux-review.py` (before/after index builder)

## Tests

| Layer | Spec                                                                                   | Covers                                                                                      |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Unit  | `ui/src/features/dashboard/bookings/lib/templateLibrary.test.ts`                       | Reading order, Custom always a Move destination, one label per destination (51 tests).      |
| E2E   | `ui/e2e/features/dashboard/templates/templatesModule.spec.ts` (`@ci`)                  | Read-only preview, Custom default, Move to Custom, guest email, empty state, dock clearance |
| E2E   | `ui/e2e/features/dashboard/propertyTemplatesWorkbench.spec.ts` (`@ci`, `@smoke` phone) | Workbench contract after the label and ordering changes                                     |
| Demo  | `ui/e2e/features/dashboard/templates/templatesUxReview.spec.ts` (`@demo`)              | Every-width stills plus layout, contrast, tap-target and semantics measurements             |
| Demo  | `ui/e2e/features/dashboard/templates/templatesTour.slowmo.spec.ts` (`@demo`)           | Slow-motion walkthrough recordings                                                          |

Commands:

```bash
bun run test
bun run test:e2e:templates
bun run test:e2e:smoke
bun run lint
bun run type-check
```

## Decisions required by the repo rules

- **Plans:** no new `PlanFeatureKey`. Custom templates stay behind `customTemplates` (Starter+); the
  default group change does not alter entitlement.
- **Team permissions:** no new leaf. The read-only change makes the existing
  `templates.*:edit` leaves truthful; it does not add a permission.
- **Activity log:** N/A for this change. It is client-side only; existing
  `settings.template_saved` / `settings.template_deleted` / folder events still cover writes.
- **Support content:** two FAQ answers added in `docs/guides/support/faqs.md`; route guide updated.
- **Notify on failure:** unchanged. Faults still surface through the existing toast and Sentry seams.
