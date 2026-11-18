---
title: 'Booking chat deep link'
status: in-progress
tags: [workflow, bookings, inbox]
updated: 2026-11-19
---

# Booking chat deep link (UI-09 follow-up)

The chat icon on a bookings list row opens that guest's thread in the property or parking Inbox, not the inbox root.

## Decisions

| Case            | Behavior                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| One thread      | Navigate to `…/inbox?conversationId=&platform=`                                                                          |
| Several threads | **Open chat** picker (sheet below `lg`, dialog on desktop): icon, name, channel, last activity, unread, `Name match` tag |
| None            | Toast **No chat for this booking yet** + **Search Messages** (`…/inbox?search=<guest name>`)                             |
| Channel         | Always Kame Messages. Never facebook.com or Messenger                                                                    |
| Org bookings    | Icon shows per row when the viewer has `inbox:view` on that row's property or parking                                    |
| Kanban          | Out of scope                                                                                                             |
| Plans / RBAC    | N/A. Reuses `inbox:view`; Inbox keeps its own gates                                                                      |
| activity-log    | N/A. Read-only navigation                                                                                                |

## Gaps the plan missed

- `BookingListQuickActions` only existed on unmerged commit `2cbe30722` (branch `sprmke/ui-improvements-backlog-cleanup`). This change recreates it and mounts it in `BookingTable` and `BookingCardGrid` with the same hunks; expect a trivial conflict when that branch lands.
- `usePropertyPermissions()` could not run on org lists. Added `usePropertyPermissionsFor(propertyId)` (same cache key).
- Soft name match alone misses a returning guest whose thread is linked to an earlier stay, so a **same signed-in guest** tier (`guest_user_id`) sits between exact and name.
- Parking Inbox is Chat only: Meta threads are never offered for parking. Meta threads are skipped when `inbox.meta` is off.
- Name tokens go into a PostgREST `or()` filter: letters and digits only, no escaping holes.
- The booking must belong to the scope the caller proved access to; otherwise 404 (no existence leak).
- The "no chat" action needs somewhere to go: Inbox now reads `?search=` into its initial search box.
- Pickers must not float on desktop: `ResponsiveModal` (sheet below `lg`, dialog above).
- New edge functions must be listed in `config.toml`, `dashboardAssistantParity.ts` (`read`), and `scripts/dev/batch-commit-all-deployable.sh`.

## Shipped

- Edge: `social-inbox-booking-chats`, `_shared/inboxBookingChats.ts`
- UI: `BookingListQuickActions`, `BookingChatPickerDialog`, `lib/bookingChatLink.ts`, `fetchBookingChats`, `InboxPage` `?search=`
- Tests: unit (`inboxBookingChats_test.ts`, `bookingChatLink.test.ts`), DOM (`BookingListQuickActions.test.tsx`), handler contract, live Postgres (`bun run test:booking-chats:live`), E2E (`bookingChatShortcut`, `inboxDeepLink`, `parkingHostBookingChat`)
- Docs: bookings guides (property, org, parking), inbox guide, `faqs.md`, `edge-functions.md`

## Follow-ups

- Manual "Link this Meta thread to this booking" on booking detail or inbox header.
- Kanban chat affordance.
- Org-level Inbox route.
