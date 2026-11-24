---
title: 'New listing UI/UX review — Add property and Add parking'
status: active
tags: [ux, ui, org, properties, parkings, onboarding, e2e, review]
updated: 2026-11-24
---

# New listing UI/UX review — Add property and Add parking

The **New listing** flow is how an org owner or permitted org member creates an asset:

| Entry point            | Route                                 | Dialog                   |
| ---------------------- | ------------------------------------- | ------------------------ |
| Properties inventory   | `/org/:orgSlug/properties`            | `AddPropertyDialog`      |
| Parkings inventory     | `/org/:orgSlug/parkings`              | `AddParkingDialog`       |
| Org switcher / dashbrd | any org route, workspace switcher `+` | `AddEntityDialog` (both) |

Reviewed at **1440, 1024, 768 and 390** wide, with the mobile bottom sheet, the org owner and
read-only member roles, and the Free / paid / overdue plan states. Skills applied:
`impeccable` (context + craft floor), `mobile-responsive`, `frontend-design`,
`design-taste-frontend`, `accessibility`, `human-copy`, `minimal-ui-copy` and `skeleton-loaders`,
against [properties.md](../../../guides/routes/org/properties.md),
[parkings.md](../../../guides/routes/org/parkings.md) and `DESIGN.md`.

This review starts from **updated `main`** (`c1cc929d6`, 2026-11-24). Earlier property-finance
findings are out of scope here and stay in the separate finance audit on the
`fix/settings-blockers` worktree; nothing from that surface is repeated or re-claimed here.

## Verdict

The flow is structurally right: one dialog, a real availability check, a server quote instead of a
hardcoded price, a proper split bottom sheet on phone, and a guarded close when the form is dirty.
The weak spots were all in the last mile of trust and consistency.

Before this pass:

- a **failed price quote looked exactly like the Free plan**: no note, no error, and the create
  button stayed enabled, so a paid host could add a property without ever seeing the price.
- clicking **Add property** opened a dialog titled **New listing**, and **Add parking** opened the
  same "New listing" even though a parking slot is not a listing.
- the create button was enabled **while the display-name check was still running**, so a reserved
  or duplicate name could be submitted before the check answered and then fail server-side.
- the Unit and Slot placeholders (`2604`, `26`) read as filled values, not examples.
- there was **no automated test** for the create flow; the route guide even listed it as N/A.

### Scorecard

1–5, from the `impeccable` critique heuristics.

| Axis                 | Before | After | What moved                                     |
| -------------------- | :----: | :---: | ---------------------------------------------- |
| Clarity of the task  |   4    |   5   | Dialog title matches the button that opened it |
| Trust in the numbers |   2    |   4   | A failed quote is visible and retryable        |
| Consistency          |   3    |   4   | Placeholders read as examples                  |
| Accessibility        |   4    |   4   | Labels/alerts already solid; no regressions    |
| Responsive           |   4    |   4   | Sheet and widths verified, no change needed    |
| Resilience           |   2    |   4   | No silent failure; no premature submit         |
| Automated coverage   |   1    |   4   | 8 @ci cases + unit + demo captures             |

## Findings

| #   | Finding                                                                    | Severity | Status                                       |
| --- | -------------------------------------------------------------------------- | -------- | -------------------------------------------- |
| N1  | A failed plan quote was silent and looked like Free                        | P1 trust | **Fixed**                                    |
| N2  | "New listing" title on Add property / Add parking entry points             | P2       | **Fixed**                                    |
| N3  | Create could submit while the name availability check was in flight        | P2       | **Fixed**                                    |
| N4  | Unit `2604` and Slot `26` placeholders looked like real values             | P3       | **Fixed**                                    |
| N5  | Property/parking wrappers marked `@deprecated` while still the entry point | P3       | **Fixed**                                    |
| N6  | No automated coverage for the create flow                                  | P1 cover | **Fixed**                                    |
| N7  | Two "Add property" buttons in the empty state                              | P3       | Accepted (header + empty CTA is intentional) |
| N8  | Quick Access FAB can cover the last row / sheet edge on phone              | P2 shell | Open, shared shell (not this module)         |
| N9  | Sidebar current-plan card is violet                                        | P3 shell | Open, shared shell (not this module)         |
| N10 | Parking platform-fee note has no amount                                    | P3       | Open, needs a product decision               |
| N11 | Inline error red is ~3.8:1 on white (token-level)                          | P2 a11y  | Open, global token; same as every form error |

### N1 · A failed quote looked like Free

`useAddPropertyPreview` runs with `retry: false` and the note returned `null` when `preview` was
undefined, so a 500 from `preview-org-plan-change` rendered no note at all. A host on a paid plan
then saw exactly what a Free host sees: nothing. Fix: the note now takes `isError` / `onRetry` and
renders **Could not load the plan price.** with a **Retry** button. The create button still works;
the post-create toast reports the real billing.

### N2 · One dialog, three names

The dialog hardcoded `title="New listing"`. The Properties page button says **Add property**, the
Parkings page says **Add parking**, and only the combined switcher entry is genuinely a "new
listing". Fix: `newListingDialogTitle()` returns **Add property** / **Add parking** for single-kind
entries and keeps **New listing** for the combined dialog. Unit-tested.

### N3 · Submit raced the name check

`propertyCanSubmit` only checked `!propertyNameBlocked`, not `!propertyNameCheck.isChecking`.
During the 400ms debounce (and the request) the button was enabled, so a duplicate name could be
submitted before the check resolved. Fix: the button now waits for the check. The field already
shows its own spinner, so there is no new copy.

### N4 · Placeholders that looked like values

`FORM_PLACEHOLDERS.unitNumber` was `2604` and the parking slot used a bare `26`. In an empty field
those read as prefilled values. Fix: `Ex. 1204` and `Ex. 27`, matching the `Ex. Monaco 1234` rule.

### N5 · Misleading deprecation

`AddPropertyDialog` and `AddParkingDialog` said `@deprecated Prefer AddEntityDialog` while being the
live entry points for two pages. Fix: the comments now state what each wrapper is for.

## Verification

| Check                                   | Result                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `newListing.spec.ts` (`@ci`)            | **8/8 pass** (property create, free, overdue, quote retry, name gate, permissions, parking, phone) |
| `newListingCopy.test.ts`                | 2/2 pass                                                                                           |
| `newListingScreens.spec.ts` (`@demo`)   | 10/10 captures at 1440 / 1024 / 768 / 390                                                          |
| `orgHubSmoke` + `dashboardModulesSmoke` | Still pass (shared shell untouched)                                                                |
| Type-check + ESLint                     | Clean on changed files                                                                             |

```bash
bun run test:e2e:org:new-listing   # @ci flow
bun run test:e2e:org:new-listing:screens  # before/after captures
```

## Screenshots

Open **[`screenshots/review.html`](./screenshots/review.html)** for the before/after pairs with a
toggle, or browse `screenshots/before/` and `screenshots/after/`. `before` was captured from a
clean `origin/main` worktree (`c1cc929d6`); `after` from `feat/new-listing-ux`, same spec and same
fixtures, so only the code changed between the two sets.

| Screen                          | What the pair shows                               |
| ------------------------------- | ------------------------------------------------- |
| `properties-*`                  | Inventory at 1440 / 1024 / 768 / 390              |
| `new-property-*`                | Dialog title and Unit placeholder                 |
| `new-property-quote-error-1440` | The invisible failure vs the visible Retry note   |
| `new-property-filled-1440`      | Plan quote and generated display name             |
| `new-property-free-1440`        | Free: no note                                     |
| `new-property-overdue-1440`     | Overdue: stays on Free                            |
| `new-parking-*`                 | Add parking title and slot placeholder            |
| `properties-empty-*`            | Empty state with the Add CTA                      |
| `properties-read-only-1440`     | No create control without `org.properties:create` |

## Not changed

- **Quick Access FAB** (bottom-right on phone) can sit over the last list row and the sheet edge.
  It is shared dashboard chrome, not part of this dialog; the finance audit also tracks it.
- **Sidebar plan card** still uses a violet treatment, which `DESIGN.md` bans. Shared shell.
- **Parking platform fee** copy says a fee applies but no number. Adding one needs the plan's
  parking fee, which is a product decision.
- **Inline error contrast.** `--destructive` is `0 84% 60%` (#ef4444), about 3.8:1 on white, used by
  every `text-destructive text-xs` validation line including the unit and slot errors in this
  dialog. Fixing it means darkening the token app-wide, not just this form, so it is flagged rather
  than changed here.

## Related

- [Properties route guide](../../../guides/routes/org/properties.md)
- [Parkings route guide](../../../guides/routes/org/parkings.md)
- `DESIGN.md` · `.cursor/rules/mobile-native-ui.mdc` · `.cursor/rules/skeleton-loaders.mdc`
- Finance UI/UX audit on the `fix/settings-blockers` worktree (separate surface, not part of this change)
