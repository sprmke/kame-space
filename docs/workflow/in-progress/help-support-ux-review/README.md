---
title: 'Help & Support UI/UX review — org, property and parking mounts'
status: active
tags: [ux, ui, help-support, tickets, faqs, guides, review, qa, e2e, property, parking, org]
updated: 2026-11-24
---

# Help & Support UI/UX review — org, property and parking mounts

Deep review of one module mounted three ways, at every supported width:

| Mount    | Route                                                                  | Tickets filed as                             |
| -------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| Org      | `/org/:orgSlug/help-support` (+ `/docs`, `/tickets`, `/tickets/:id`)   | org-level (`property_id`, `parking_id` null) |
| Property | `/org/:orgSlug/property/:propertySlug/help-support` (+ same subroutes) | `property_id` set                            |
| Parking  | `/org/:orgSlug/parking/:parkingSlug/help-support` (+ same subroutes)   | `parking_id` set                             |

Opened at **1920, 1440, 1280, 1024, 768, 430, 390 and 360** wide, plus the desktop and
phone compose flows. Reviewed with the `impeccable` (context, operate, critique),
`mobile-responsive`, `frontend-design`, `design-taste-frontend`, `accessibility`,
`human-copy`, `minimal-ui-copy` and `skeleton-loaders` skills, against
[the property route guide](../../../guides/routes/org/property/help-support.md),
[org](../../../guides/routes/org/help-support.md),
[parking](../../../guides/routes/org/parking/help-support.md) and `DESIGN.md`.

This pass is **Help & Support only**. The separate Finance and Plans findings live in the
money-module review and are not part of this branch.

## Sync with mainline

The branch is cut from `origin/develop` at `5ec6bc7c3`, whose tree is identical to the current
`origin/main` (`c1cc929d6`) for every Help & Support path. Upstream changed one shared file this
module depends on: `AdminLayout` moved the theme toggle out of the sidebar footer. The Quick
Access condition was re-applied on top of that version.

Earlier local work (the money-module and settings fix passes) was preserved on
`wip/20261124-150055-help-support-ux-and-money-audit` before branching, so nothing was lost.

## Verdict

The information architecture is right: one module shell, three scoped mounts, a real ticket
thread with a composer, guides generated from the route guides, and FAQs that are filtered by
mount. The backend is careful too (path-checked attachments, MIME sniffing, rate limits, private
storage, signed URLs).

What let the experience down was **height and density on the surfaces that are actually used**:

- The four module cards were KPI cards. They reserved a trend row they never use, so on a phone
  they took more than a third of the first screen before any answer was visible.
- Opening a ticket on a phone squeezed the conversation to a 32px strip because the module cards
  and section intro stayed mounted above a fill-height workspace.
- The floating Quick Access launcher sat on the Send button in that thread, on ticket rows, and
  on FAQ tiles at 360 and 768.
- Submitting a new ticket could bounce the host back to the list with an empty compose sheet
  still open.
- A failed ticket list left a hollow "Pick a ticket" pane next to the error.
- Singular topics read "1 questions", and a search with no matches was a dead end.

### Scorecard

Scores are 1–5, from the `impeccable` critique heuristics. "Before" is the mainline build.

| Axis                          | Before | After | Note                                                        |
| ----------------------------- | :----: | :---: | ----------------------------------------------------------- |
| Clarity of the core task      |   4    |   5   | FAQs / Guides / Tickets / Ask AI is obvious                 |
| Visual hierarchy              |   3    |   4   | Navigation stopped competing with the answer surface        |
| Information density           |   2    |   4   | Compact nav tiles; topic grid above the fold at every width |
| Feedback & state honesty      |   3    |   4   | Real error and empty states, no hollow pane, escape hatch   |
| Consistency                   |   4    |   4   | One vocabulary across the three mounts                      |
| Accessibility                 |   3    |   4   | Labels, 44px targets, no clipped conversation               |
| Responsive behaviour          |   1    |   4   | Phone thread usable; no launcher overlap at 360/768         |
| Resilience (no broken states) |   2    |   4   | Submit navigation and empty states are deterministic        |

## Findings and resolution

Every item was re-captured at 1920 / 1440 / 1280 / 1024 / 768 / 430 / 390 / 360.
Open **[`screenshots/review.html`](./screenshots/review.html)** for the 31 before/after pairs, or
browse [`screenshots/before/`](./screenshots/before) and
[`screenshots/after/`](./screenshots/after).

| #   | Finding                                                                 | Severity | Status | What changed                                                                                                      |
| --- | ----------------------------------------------------------------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| F1  | Module cards are KPI-sized and push answers below the fold              | P1       | Fixed  | Nav tiles use `density="compact"` and `reserveTrendRow={false}` on `StatCard`; the trend slot stays for real KPIs |
| F2  | Opening a ticket on a phone collapses the conversation                  | P1       | Fixed  | Ticket detail below `lg` hides the module tiles and section intro, so the thread owns the height                  |
| F3  | Quick Access launcher covers tiles, ticket rows and Send                | P1       | Fixed  | `showFab` is off on `/help-support` routes; the launcher duplicates what the page already offers                  |
| F4  | Submitting a new ticket can return to the list with an empty sheet open | P1       | Fixed  | `closeCompose` no longer navigates when the URL already points at a ticket                                        |
| F5  | Topic counts read "1 questions"                                         | P2       | Fixed  | `faqQuestionCountLabel` (singular/plural), unit tested                                                            |
| F6  | A search with no matches is a dead end                                  | P2       | Fixed  | The empty result offers **New ticket** and opens the compose sheet                                                |
| F7  | A failed ticket list still shows a hollow "Pick a ticket" pane          | P2       | Fixed  | Error and empty states are single pane                                                                            |
| F8  | FAQ and ticket skeletons do not match their final layouts               | P2       | Fixed  | Topic-grid skeleton (search + tiles) and list chrome for ticket deep links                                        |
| F9  | `help_article_viewed` fires on every expand, not the first              | P3       | Fixed  | `HelpDisclosure` guards with a ref; a view is counted once per article                                            |
| F10 | Sidebar theme toggle removed upstream                                   | P3       | Synced | Re-applied the Quick Access condition on the new `AdminLayout`                                                    |

### F1 · Navigation sized like a dashboard KPI

The four module cards (`HelpSupportModuleNav`) reused the KPI `StatCard`. Each card therefore
reserved a `min-h-[22px]` trend row and KPI padding for a delta that navigation never has. On a
1440 screen the row was ~100px tall; on a 390 phone the 2×2 block was ~266px, and the FAQ search
started below it.

Fixed by adding `reserveTrendRow` (default `true`, so every KPI keeps its shared baseline) and
using compact density for the nav. The phone block is now ~180px and the FAQ grid is readable in
the first viewport.

### F2 · Phone ticket thread had no room

`TicketsWorkspacePage` is a fill-main workspace, but the page above it still mounted the four
module cards (266px) and the section intro (~78px). The workspace then had ~340px for its header,
messages and composer. Measured before the fix at 390×844:

```
nav tiles        150 → 416   (266px)
thread panel     500 → 840   (340px)
messages area    584 → 616   (32px)
composer         630 → 753
```

The conversation was scrolled to a 32px strip. Ticket detail now hides the chrome below `lg`; the
thread header carries **Back to list**, which returns to the list with the tiles intact.

### F3 · The Quick Access launcher sat on primary controls

At 390 the 52px launcher overlapped the Send button; at 360 and 768 it covered FAQ tiles and
ticket rows. It duplicates sidebar destinations, and Help & Support is where a host already is.
Hidden on `/help-support` routes only.

### F4 · Compose submit race

After a successful submit, the page navigates to the new ticket. The dialog's close event then
ran `closeCompose`, which navigated again, this time to `/tickets`, so the host lost the ticket
they just created and saw an empty sheet. `closeCompose` now returns early when the path is
already a ticket thread. Covered by the property and parking submit specs.

### F5 · Singular counts

`1 questions` on every topic with one answer. A pure `faqQuestionCountLabel` helper keeps the
copy consistent and is unit tested for 0, 1 and many.

### F6 · No-match search dead end

The empty result said "No FAQs match that search" with no action. It now offers **New ticket**,
which opens the compose sheet for the current mount (property, parking or org).

### F7 · Error state with a hollow detail pane

The list error rendered in the 400px pane while the right pane still invited "Pick a ticket" with
nothing to pick. Error and empty states now take the full width and hide the detail pane.

### F8 · Skeleton parity

The FAQ/guides skeleton was four full-width bars; the loaded body is a search field plus a 2-up
topic grid. A ticket deep link used the cached "empty" hint, so it painted centered empty chrome
and then snapped to a two-pane workspace. Both now match the destination: `HelpTopicGridSkeleton`
and `isHelpSupportTicketDetailPath` (unit tested).

### F9 · Analytics double counting

`HelpDisclosure` called `onFirstOpen` on every open, so `help_article_viewed` counted repeat
expands. A ref now fires it once per mounted article.

## What is already good (keep it)

- **Scope is real, not cosmetic.** FAQ categories are filtered by mount, and tickets carry
  `property_id` / `parking_id`; the E2E asserts the request parameters for all three mounts.
- **The ticket lifecycle is honest.** Resolved explains that a reply reopens; closed hides the
  composer and offers Reopen; errors keep the list usable.
- **Attachments are treated as sensitive.** Private bucket, signed URLs with a 2-hour TTL,
  path prefix tied to the caller, MIME sniffing, size limits, and a 30-uploads-per-10-minutes cap.
- **The compose form adapts to the category.** Broken adds urgency and screenshots, Business adds
  a contact preference, and Submit stays disabled until required fields are valid.
- **Unsaved work is guarded.** Closing a draft asks to discard, and the route guard is skipped
  only for the navigation that follows a successful submit.
- **Guides are generated from the route guides**, so host help cannot drift far from documented
  behavior.

## Deferred and known limits

These are real, but they are shared-platform or product decisions rather than this module's fix:

1. **Support ticket reads are org-wide at the database layer.** `support_tickets_select` and the
   message policy allow any active org or property member to read every ticket in the org. The UI
   only asks for the caller's rows, but PostgREST would not stop a member from selecting others.
   Proposed: scope the policy to `submitted_by_user_id = auth.uid()` or org admins only.
2. **Compose sheet clips the upload area at 960px tall.** The 44rem sheet scrolls, but the dashed
   dropzone is cut mid-control when it first opens. A sticky footer plus a shorter default height
   would remove the "is it broken?" moment.
3. **Thread scroll after image decode.** The thread scrolls to the newest message before an
   attachment image finishes decoding, so a tall screenshot can sit just below the fold. Add an
   `onLoad` scroll or reserve the image box (already `aspect-square`) end to end.
4. **Org vs property FAQ scope.** `Parking`, `Team & Permissions`, `Billing & Finance` and
   `Activity & Audit` are path-scoped. An org admin therefore sees org team and billing answers,
   but not the property team answer. Decide whether org should inherit property-scoped categories.
5. **Property Help has no sidebar entry.** Discovery on desktop relies on the Quick Access
   launcher or the org sidebar. Consider adding it to the property sidebar's Manage group.
6. **Error retries are slow.** TanStack Query retries three times before the error state, which is
   why a list failure takes several seconds to say so. One retry is enough for this surface.

## Test coverage added

| File                                                                  | Kind     | Covers                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/e2e/features/help-support/shared/helpSupportHarness.ts`           | Fixtures | 17 FAQs across scopes/audiences, 5 articles, 5 tickets in every status, stateful submit/reply/reopen, error/empty switches, consent seeded on any port                                                                                                                                          |
| `ui/e2e/features/help-support/helpSupportModule.spec.ts`              | `@ci`    | Mount filtering (org/property/parking), topic open, search + escape hatch, sanitized guides, thread, reply, closed/reopen, resolved banner, compose validation + scope payloads, org/parking scope params, read-only access, single-pane states, phone thread height, 7 widths with no overflow |
| `ui/e2e/features/help-support/helpSupportTour.slowmo.spec.ts`         | `@demo`  | 6 recorded scenarios (FAQs, guides, tickets, compose, scopes, phone)                                                                                                                                                                                                                            |
| `ui/e2e/features/help-support/helpSupportScreens.spec.ts`             | `@demo`  | 31 fixed before/after captures                                                                                                                                                                                                                                                                  |
| `ui/src/features/dashboard/help-support/lib/helpSupportPaths.test.ts` | Unit     | Ticket-detail path detection, including `/tickets`, `/new`, and non-UUID segments                                                                                                                                                                                                               |
| `ui/src/features/dashboard/help-support/lib/helpFaqModules.test.ts`   | Unit     | `faqQuestionCountLabel` for 0, 1 and many                                                                                                                                                                                                                                                       |

```bash
bun run test:e2e:help               # @ci regression spec
bun run test:e2e:help:tour          # slow-motion, headed, no video
bun run test:e2e:help:tour:video    # slow-motion + video
bun run test:e2e:help:screens       # recapture into screenshots/after
```

### Recordings

Slow-motion videos land in [`recordings/`](./recordings) after
`bun run test:e2e:help:tour:video`:

| Video                                 | Scenario                                                    | Width |
| ------------------------------------- | ----------------------------------------------------------- | ----- |
| `01-faqs-browse-search-recovery.webm` | Topic browse, answer, search, no-match **New ticket**       | 1440  |
| `02-guides.webm`                      | Guide groups, sanitized article, in-topic search            | 1440  |
| `03-tickets-thread-reply-reopen.webm` | Statuses, thread, reply, resolved banner, closed and reopen | 1440  |
| `04-new-ticket.webm`                  | Category switch, validation, Business contact, submit       | 1440  |
| `05-org-and-parking-scope.webm`       | The same module at org and parking scope                    | 1440  |
| `06-phone.webm`                       | Phone FAQs, list, full-height thread, reply, compose sheet  | 390   |

## Implementation map

| Concern                 | Path                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Shell and mobile chrome | `ui/src/features/dashboard/help-support/components/HelpSupportLayout.tsx`           |
| Module nav              | `.../components/HelpSupportModuleNav.tsx` + `ui/src/components/shared/StatCard.tsx` |
| FAQ home                | `.../components/HelpCenterFaqAccordion.tsx`                                         |
| Guides                  | `.../pages/HelpDocumentationPage.tsx`                                               |
| Tickets workspace       | `.../pages/TicketsWorkspacePage.tsx`                                                |
| Disclosure analytics    | `.../components/HelpDisclosure.tsx`                                                 |
| Path helpers            | `.../lib/helpSupportPaths.ts` (`isHelpSupportTicketDetailPath`)                     |
| Copy helpers            | `.../lib/helpFaqModules.ts` (`faqQuestionCountLabel`)                               |
| Skeletons               | `ui/src/components/skeletons/HelpSupportSkeleton.tsx`                               |
| Quick Access condition  | `ui/src/features/dashboard/bookings/components/AdminLayout.tsx`                     |

`plans-and-permissions`: **N/A**. No new capability, entitlement, or permission leaf. Help &
Support stays available to every non-plan-limited member and every parking team member.

`audit-logging`: **N/A**. No new mutation. Existing ticket create, reply and reopen already go
through their edge functions; this pass changes presentation and navigation only.

## Related

- [Property Help & Support route guide](../../../guides/routes/org/property/help-support.md)
- [Org Help & Support](../../../guides/routes/org/help-support.md)
- [Parking Help & Support](../../../guides/routes/org/parking/help-support.md)
- `DESIGN.md` (tokens, admin density, mobile chrome)
- `.cursor/rules/mobile-native-ui.mdc` · `.cursor/rules/skeleton-loaders.mdc`
