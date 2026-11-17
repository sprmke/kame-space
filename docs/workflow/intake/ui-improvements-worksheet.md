---
stage: intake
title: 'UI improvements worksheet — claim before touch'
status: active
tags: [workflow, intake, ui, conflict-prevention]
updated: 2026-11-17
kind: reference
---

# UI improvements worksheet

**Purpose.** One place for open UI polish so agents and humans do not collide with
`docs/workflow/in-progress/*` modules or with each other.

**Source list.** Rows come from [`_to-dos.md`](./_to-dos.md) § UI Improvements
plus a few adjacent empty-state items. Keep this file and `_to-dos` in sync when
status changes.

## Claim protocol (required)

1. **Read this table** before editing any guest or dashboard UI that matches a row.
2. **Claim** by setting `Owner` to your session id or branch name, `Status` to
   `claimed`, and `Updated` to today. Do not claim a row already `claimed` /
   `in progress` unless the owner agrees.
3. **Respect `Avoid modules`.** If your change would touch files owned by those
   in-progress docs, either coordinate or pick another row.
4. **Ship or release.** On PR merge: set `Status` to `done` and tick `_to-dos`.
   If you stop: set `Status` back to `open` and clear `Owner`.
5. **New UI items** go here first (with conflict notes), then a one-liner in
   `_to-dos`.

| Status    | Meaning                                               |
| --------- | ----------------------------------------------------- |
| `open`    | Free to claim                                         |
| `claimed` | This session owns it; design or code in flight        |
| `blocked` | Waiting on another module or decision                 |
| `done`    | Shipped; leave for history until `_to-dos` is cleaned |

## Active claim (this session)

| Field | Value                                                                                       |
| ----- | ------------------------------------------------------------------------------------------- |
| Item  | **Batch** — cleanup pass on `sprmke/ui-improvements-backlog-cleanup` (see review notes)     |
| Owner | `sprmke/ui-improvements-backlog-cleanup`                                                    |
| Avoid | Do not edit `legal-and-privacy-coverage`, `dashboard-contextual-help` HowItWorks ownership  |
| Prior | UI-05, UI-18, UI-29–36 done in PR #496; review: `ui-improvements-backlog-cleanup-review.md` |

## Inventory

| ID    | Item                                                     | Surface                       | Avoid modules                                            | Status      | Owner | Notes                                                                      |
| ----- | -------------------------------------------------------- | ----------------------------- | -------------------------------------------------------- | ----------- | ----- | -------------------------------------------------------------------------- |
| UI-01 | Landing hero blur / soft photo                           | `/` hero                      | `seo-and-ai-search-visibility`, marketing studio mobile  | **done**    |       | Toolbar opacity reverted to `bg-muted/80`                                  |
| UI-02 | Landing search toolbar click UX                          | `/` search                    | same as UI-01                                            | **done**    |       | Dim overlay only; bar surface left prior                                   |
| UI-03 | Landing list section skeleton                            | `/` below fold                | `skeleton` architecture, SEO                             | **done**    |       | Card-matched explore skeleton                                              |
| UI-04 | Remove footer strip; move Install + rights into footer   | marketing chrome              | `mobile-app-chrome-header-and-tab-bar`, legal            | **done**    |       | Soft Install in brand; © centered under rule                               |
| UI-05 | **Mascot empty states** (404, coming soon)               | catch-all, feature gate       | marketing themes (3D Kame stays social-only)             | **done**    |       | Design + shared `BrandEmptyState`                                          |
| UI-06 | Plan modal UX (+ optional mascot)                        | org Plans                     | plans matrix, billing                                    | **done**    |       | Upgrade/Downgrade titles + direction-aware strip; brand mark removed       |
| UI-07 | Channel Sync helper → full How it works modal            | Pricing channels              | `dashboard-contextual-help`                              | **skipped** |       | Coord contextual-help module                                               |
| UI-08 | Airbnb sync conflicts → Needs attention / Notifications  | pricing + notifications       | `notifications-page-restructure`, calendar sync          | **done**    |       | `?channelSync=1` + attention chip                                          |
| UI-09 | Bookings list: chat icon + quick actions                 | `/bookings` list              | bookings workflow, inbox                                 | **done**    |       | `BookingListQuickActions` + `inbox:view`                                   |
| UI-10 | Kanban booking click broken UI                           | `/bookings` kanban            | bookings, mobile chrome                                  | **done**    |       | Fixed dialog height so body shows; removed card → move menu                |
| UI-11 | Bookings initial load list swap (date range?)            | `/bookings`                   | bookings, skeletons                                      | **done**    |       | Seed month into URL once                                                   |
| UI-12 | Refine table/list action buttons                         | shared tables                 | `bookings-table`, tanstack-table                         | **done**    |       | Finance stay `Eye` details                                                 |
| UI-13 | Edit transaction modal: disable until valid              | Finance                       | finance module                                           | **done**    |       | Wizard `canProceed`                                                        |
| UI-14 | Finance confusing SD estimate copy                       | Finance                       | finance                                                  | **done**    |       | Shorter estimate line                                                      |
| UI-15 | Export PDF Finance / Maintenance UX                      | Finance, Maintenance          | those modules                                            | **done**    |       | Phone sheet + desktop dropdown                                             |
| UI-16 | Pricing increment 1→100                                  | Pricing                       | pricing                                                  | **done**    |       | `step={100}`                                                               |
| UI-17 | Analytics Playbook UI                                    | Org analytics                 | analytics                                                | **done**    |       | Touch targets + scroll list                                                |
| UI-18 | **Org Analytics listings** density + no money ellipsis   | Org analytics                 | analytics playbook (UI-17)                               | **done**    |       | Dedupe Attention/Outlook; readable revenue; spacing                        |
| UI-19 | Marketing AI Studio skeleton layout jump                 | Marketing studio              | `marketing-ai-poster-studio`, `marketing-studio-mobile…` | **done**    |       | Empty-layout skeleton until list resolves                                  |
| UI-20 | Inbox: remove Not connected badge                        | Inbox                         | `guest-inbox-meta-sync-overhaul`                         | **done**    |       | Hide reconnect pill                                                        |
| UI-21 | AI import bookings: drop allowed-use line                | Bookings import               | bookings                                                 | **done**    |       | Downward import icon; host data terms in step copy                         |
| UI-22 | Download template: rephrase “No manual updates…”         | Bookings import               | bookings                                                 | **done**    |       | “Template is optional”                                                     |
| UI-23 | Condo-default templates refine                           | templates                     | property settings, `settings-cleanup…`                   | **skipped** |       | Needs product input                                                        |
| UI-24 | Privacy / legal: tech disclosure review                  | legal pages                   | `legal-and-privacy-coverage`                             | **blocked** |       | Owned by legal module                                                      |
| UI-25 | Guest tickets + dashboard support skeletons              | Support                       | support, skeletons                                       | **done**    |       | Tickets chrome + row cards                                                 |
| UI-26 | Guest account help UX                                    | `/account/help`               | support content                                          | **done**    |       | Title, empty brand, contact footer                                         |
| UI-27 | Reviews → By Property tab                                | Reviews                       | reviews                                                  | **done**    |       | Clearer empty + card actions                                               |
| UI-28 | Update default pricing                                   | Pricing defaults              | pricing, plans                                           | **skipped** |       | Needs target defaults                                                      |
| UI-29 | Manage-only push + Activity/Telegram empty status panels | Manage + hub tabs             | `notifications-page-restructure` (coord: layout only)    | **done**    |       | Unified Manage card; hub empties reuse ChannelPausedPanel pattern          |
| UI-30 | **Org Bookings: New booking** (property + parking)       | `/org/.../bookings`           | booking import wizard, parking status machine            | **done**    |       | Picker sheet → `AdminNewBookingModal` / `AdminParkingNewBookingModal`      |
| UI-31 | **Toolbar filter dropdowns** left-align + hug trigger    | list toolbars                 | avatar/overflow `align=end` menus                        | **done**    |       | Shared `Admin*SelectFilter`, Filters/Status popovers                       |
| UI-32 | **Help FAQ home** category grid only + even tile rows    | Help FAQs tab                 | super-admin FAQ editor, guest Support                    | **done**    |       | Drop common accordion list; odd last tile spans 2 cols                     |
| UI-33 | **Settings section nav** keep active row in view         | property/org/parking settings | sliding pill / scroll-spy                                | **done**    |       | Vertical overflow on nav + `scrollActiveItemIntoView`                      |
| UI-34 | **Guest experience** summary + Manage modal              | property settings             | Templates check-in/out, House rules quiet hours          | **done**    |       | Drop readiness checklist; read-only listing unit; quiet hours elsewhere    |
| UI-35 | **Search preview** own section + stacked SERP redesign   | property settings             | parking SearchPreviewFields still under Basic Info       | **done**    |       | Above Integrations; preview-first; dirty/save as `search`                  |
| UI-36 | **Channel sync** Recent activity + modal UX overhaul     | Pricing → Channel sync        | calendar conflict plan (coord: copy only)                | **done**    |       | Progressive From/To empty states; feed card alignment; hide no-op activity |

### Already done (keep out of claims)

| Item                                                 | Note                        |
| ---------------------------------------------------- | --------------------------- |
| Cookie / analytics banner                            | Shipped                     |
| AppInfo / version off Help; Profile “On this device” | Shipped                     |
| Settings secondary menu idle fills + sliding pill    | Shipped (this chat earlier) |

## Conflict map (modules ↔ UI)

| In-progress doc                                                  | Do not claim without coordination                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `settings-cleanup-and-clarity`                                   | Settings fields, email automations, parking settings chrome |
| `mobile-app-chrome-header-and-tab-bar`                           | BottomTabBar, heroes, sticky headers, footer chrome         |
| `notifications-page-restructure`                                 | Notifications list, deep links (blocks UI-08 alone)         |
| `marketing-ai-poster-studio` / `marketing-themes` / video editor | Studio skeletons, themes, Polotno                           |
| `legal-and-privacy-coverage`                                     | Privacy policy tech lists (UI-24)                           |
| `dashboard-contextual-help`                                      | InfoHint / HowItWorks (UI-07)                               |
| `seo-and-ai-search-visibility`                                   | Landing SEO, hero meta, public route registry               |
| `guest-inbox-meta-sync-overhaul`                                 | Inbox connection badges (UI-20)                             |

## Design specs linked from this sheet

| Spec                                                               | Item IDs                               |
| ------------------------------------------------------------------ | -------------------------------------- |
| [`mascot-empty-states-design.md`](./mascot-empty-states-design.md) | UI-05 (optional reuse for UI-06 later) |

## Agent checklist before a UI PR

- [ ] Row claimed here; `_to-dos` line updated (`🚧` or ✅)
- [ ] `DESIGN.md` + `frontend-design` / `mobile-responsive` when layout changes
- [ ] `human-copy` / `minimal-ui-copy` for any new string
- [ ] Route guide + support Q&A if guest/host-visible behavior changed
- [ ] Plans / RBAC / activity-log / sentry / analytics marked or N/A
- [ ] No overlap with Avoid modules unless coordinated in the PR body
