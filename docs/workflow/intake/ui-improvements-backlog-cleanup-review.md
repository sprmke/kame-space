# UI improvements backlog cleanup — review notes

Branch: `sprmke/ui-improvements-backlog-cleanup`  
Audience: wake-up review of each item (what changed, how it looks, what was skipped).

## Done this pass

| ID    | Understanding                                                             | What changed                                                                                                         | How it looks / behaves                                                             |
| ----- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| UI-01 | Soft/blurry hero photo on `/`                                             | Verified existing sharp `srcset` + soft corner scrims (no progressive blur). Marked done; no large CSS rewrite.      | Hero stays sharp; copy readable via text-shadow + radial scrim.                    |
| UI-02 | Search toolbar click on hero feels weak / hard to focus                   | Expanded bar uses solid `bg-card` + stronger shadow; dim overlay `bg-black/25` behind panels.                        | Click a segment → page dims slightly; bar reads as a solid control over the photo. |
| UI-03 | Explore list skeleton too thin vs cards                                   | Richer PropertyCard-shaped pulse (photo + 3 text lines + meta chips).                                                | Loading grid matches final card footprint at 375/768/1024.                         |
| UI-04 | Footer strip with Install + copyright                                     | Moved Install + copyright into brand column; bottom strip keeps social only.                                         | No second “legal strip”; Install sits under contact.                               |
| UI-06 | Plan review modal feels cold                                              | Header adds brand mark well beside title/description.                                                                | Sheet still host-tier named; no invented plan copy.                                |
| UI-08 | Calendar conflict notification click did nothing; Needs attention missing | `resolveNotificationPath` → Pricing `?channelSync=1`; Property Pricing opens Channel sync; dashboard attention chip. | Notification click lands on Channel sync; Dashboard shows conflict attention.      |
| UI-09 | Bookings list needs chat shortcut                                         | `BookingListQuickActions` (inbox) on table + card (phone + desktop). Gated by `inbox:view`.                          | Message icon next to row affordance / amount; stops row navigation.                |
| UI-10 | Kanban booking modal broken                                               | Keep skeleton until booking loads; wrap panel in flex `min-h-0` overflow host.                                       | Click card → sheet fills height; content/actions scroll correctly.                 |
| UI-11 | List jumps after first paint                                              | Seed month `from`/`to` into URL once when missing so first fetch matches Month picker.                               | First paint already filtered to this month.                                        |
| UI-12 | Table action icons unclear                                                | Finance stay rows: `Eye` “Stay details” instead of `⋯`.                                                              | Intent is obvious; edit/delete unchanged.                                          |
| UI-13 | Edit transaction save while invalid                                       | Wizard `canProceed` from live field validation (Operating line + recurring).                                         | Primary stays disabled until required fields valid.                                |
| UI-14 | Confusing SD estimate copy                                                | Shorter estimate line on pricing summary.                                                                            | Plain language; no pass-through essay.                                             |
| UI-15 | Export PDF UX                                                             | Finance + Maintenance: phone uses bottom sheet; desktop keeps dropdown; clearer labels.                              | Phone: Report → sheet. Desktop: Export report menu.                                |
| UI-16 | Price step too fine                                                       | Rate inputs `step={100}`.                                                                                            | Spinners jump by 100.                                                              |
| UI-17 | Playbook cramped / hard to scan                                           | Larger hit targets, rounded cards, scrollable list, clearer empty copy.                                              | Collapsible articles read denser but calmer.                                       |
| UI-19 | AI Studio skeleton → wrong layout                                         | Skeleton matches empty “What do you want to make?”; `AiStudioHome` holds skeleton until first page resolves.         | No library→empty jump for new hosts.                                               |
| UI-20 | Inbox “Not connected” badge noise                                         | Hide reconnect pill when Meta needs reconnect attention.                                                             | Badge gone in that case.                                                           |
| UI-21 | Allowed-use legal line on AI import                                       | Removed from legal presets.                                                                                          | Modal no longer shows that sentence.                                               |
| UI-22 | “No manual updates needed!”                                               | Rephrased to “Template is optional”.                                                                                 | Download Template step copy.                                                       |
| UI-25 | Support tickets skeleton mismatch                                         | Tickets skeleton keeps “Tickets” + “New” chrome + row cards + “Select a ticket”.                                     | Closer to empty and populated workspace.                                           |
| UI-26 | Guest `/account/help` sparse                                              | Title/intro, category sections, brand empty, contact footer.                                                         | Help reads as a real page, not a bare accordion dump.                              |
| UI-27 | Org Reviews By Property tab                                               | Clearer empty copy; card hint “Tap for guest reviews”; larger open-listing control.                                  | Listing cards explain the primary action.                                          |

## Skipped / blocked (need you)

| ID    | Why skipped                                 | Flagged understanding                                                          |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| UI-07 | Owned by `dashboard-contextual-help`        | Channel Sync helper → HowItWorks modal; do not fork help patterns here.        |
| UI-23 | Product content for condo default templates | Need which templates/fields change; avoid guessing marketing/settings content. |
| UI-24 | Blocked by `legal-and-privacy-coverage`     | Tech disclosure legal review.                                                  |
| UI-28 | Product decision on default pricing numbers | Need target defaults before editing seeds/rates.                               |

## Prior already done (PR #496)

UI-05, UI-18, UI-29–36 (see worksheet).

## Verification

| Gate                                               | Result                                      |
| -------------------------------------------------- | ------------------------------------------- |
| `bun run type-check`                               | **pass**                                    |
| Vitest `notificationsPaths` + listing scroll paths | **pass** (17)                               |
| Full `ci:quality` / E2E                            | **not run**                                 |
| Visual browser pass                                | **not run** (review in preview recommended) |

## Plans / audit

- Plans/RBAC: N/A for most items (UI-09 gates with existing `inbox:view`).
- activity-log: N/A — UI/copy/routing only.
- sentry/analytics: N/A — no new fault or outcome events.

## Suggested review order

1. `/` hero + search expand (UI-01–04)
2. `/bookings` month seed, kanban click, chat icon (UI-09–11)
3. Notifications conflict → Pricing Channel sync (UI-08)
4. Finance transaction modal + export sheets (UI-13–15)
5. Marketing AI Studio cold load (UI-19)
6. `/account/help` + org Reviews By property (UI-26–27)
7. Decide UI-23 / UI-28 product inputs when ready
