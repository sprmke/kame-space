---
title: 'UI improvements backlog cleanup — review notes'
status: active
tags: [workflow, intake, ui, review]
updated: 2026-11-18
stage: intake
kind: reference
---

# UI improvements backlog cleanup — review notes

Branch: `sprmke/ui-improvements-backlog-cleanup`  
Audience: wake-up review of each item (what changed, how it looks, what was skipped).

## Done this pass

| ID    | Understanding                                                             | What changed                                                                                                         | How it looks / behaves                                                        |
| ----- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| UI-01 | Soft/blurry hero photo on `/`                                             | No hero photo change. Accidental toolbar opacity edit (`bg-card/95`) reverted to `bg-muted/80`.                      | Floating bar opacity matches prior.                                           |
| UI-02 | Search toolbar click on hero feels weak / hard to focus                   | Dim overlay `bg-black/25` when a segment is open. Bar surface left at prior `bg-muted/80`.                           | Click a segment → page dims slightly.                                         |
| UI-03 | Explore list skeleton too thin vs cards                                   | Richer PropertyCard-shaped pulse (photo + 3 text lines + meta chips).                                                | Loading grid matches final card footprint at 375/768/1024.                    |
| UI-04 | Footer strip with Install + copyright                                     | Quiet soft Install in brand column; © centered under the rule with socials on the right.                             | Install stays light; legal line sits in the bottom bar.                       |
| UI-06 | Plan review modal feels cold                                              | Clear Upgrade/Downgrade titles; direction-aware plan strip (→ up, ↓ down); brand mark removed after review.          | Sheet still host-tier named; no invented plan copy.                           |
| UI-08 | Calendar conflict notification click did nothing; Needs attention missing | `resolveNotificationPath` → Pricing `?channelSync=1`; Property Pricing opens Channel sync; dashboard attention chip. | Notification click lands on Channel sync; Dashboard shows conflict attention. |
| UI-09 | Bookings list needs chat shortcut                                         | `BookingListQuickActions` (inbox) on table + card (phone + desktop). Gated by `inbox:view`.                          | Message icon next to row affordance / amount; stops row navigation.           |
| UI-10 | Kanban booking modal broken                                               | Dialog needs explicit `h-[min(92dvh,40rem)]` (max-h alone collapsed flex body); skeleton until booking loads.        | Click card → sheet fills height with workflow content; no → on cards.         |
| UI-11 | List jumps after first paint                                              | Seed month `from`/`to` into URL once when missing so first fetch matches Month picker.                               | First paint already filtered to this month.                                   |
| UI-12 | Table action icons unclear                                                | Finance stay rows: `Eye` “Stay details” instead of `⋯`.                                                              | Intent is obvious; edit/delete unchanged.                                     |
| UI-13 | Edit transaction save while invalid                                       | Wizard `canProceed` from live field validation (Operating line + recurring).                                         | Primary stays disabled until required fields valid.                           |
| UI-14 | Confusing SD estimate copy                                                | Shorter estimate line on pricing summary.                                                                            | Plain language; no pass-through essay.                                        |
| UI-15 | Export PDF UX                                                             | Finance + Maintenance: phone uses bottom sheet; desktop keeps dropdown; clearer labels.                              | Phone: Report → sheet. Desktop: Export report menu.                           |
| UI-16 | Price step too fine                                                       | Rate inputs `step={100}`.                                                                                            | Spinners jump by 100.                                                         |
| UI-17 | Playbook cramped / hard to scan                                           | Larger hit targets, rounded cards, scrollable list, clearer empty copy.                                              | Collapsible articles read denser but calmer.                                  |
| UI-19 | AI Studio skeleton → wrong layout                                         | Skeleton matches empty “What do you want to make?”; `AiStudioHome` holds skeleton until first page resolves.         | No library→empty jump for new hosts.                                          |
| UI-20 | Inbox “Not connected” badge noise                                         | Hide reconnect pill when Meta needs reconnect attention.                                                             | Badge gone in that case.                                                      |
| UI-21 | Allowed-use legal line on AI import                                       | Downward `Download` icon for Import; host data terms linked in upload step copy (not under dropzone).                | Import affordance reads as import; terms sit in the description.              |
| UI-22 | “No manual updates needed!”                                               | Rephrased to “Template is optional”.                                                                                 | Download Template step copy.                                                  |
| UI-25 | Support tickets skeleton mismatch                                         | Tickets skeleton keeps “Tickets” + “New” chrome + row cards + “Select a ticket”.                                     | Closer to empty and populated workspace.                                      |
| UI-26 | Guest `/account/help` sparse                                              | Title/intro, category sections, brand empty, contact footer.                                                         | Help reads as a real page, not a bare accordion dump.                         |
| UI-27 | Org Reviews By Property tab                                               | Clearer empty copy; card hint “Tap for guest reviews”; larger open-listing control.                                  | Listing cards explain the primary action.                                     |

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
