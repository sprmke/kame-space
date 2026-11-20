---
title: 'Org Bookings List — operator guide'
status: active
tags: [guides, routes, org, booking-workflow]
updated: 2026-11-18
---

# Org Bookings List — operator guide

Route: `/org/:orgSlug/bookings`

> **Status:** Documented

## Progress overview

| Section                       | E2E save  | Validation | Docs | Notes                                             |
| ----------------------------- | --------- | ---------- | ---- | ------------------------------------------------- |
| Summary stage cards           | —         | —          | Done | Property + parking rows share stage buckets       |
| Filter bar                    | —         | —          | Done | Includes **Booking type** (property / parking)    |
| Table / card / calendar views | —         | —          | Done | **Listing** column: property or parking name      |
| Kanban view                   | —         | —          | N/A  | Hidden at org level (property list keeps kanban)  |
| New booking                   | via modal | server     | Done | Listing picker → property or parking create modal |

---

## Overview

Paginated list of **property stays** and **parking-slot reservations** across the organization.

Differences from property list:

1. Each row shows **Listing** — property name or parking slot name (no kind badge; use **Booking type** filter to narrow).
2. **More filters → Booking type** narrows to property stays or parking only.
3. Property rows open `/org/:orgSlug/property/:propertySlug/bookings/:bookingId`.
4. Parking rows open `/org/:orgSlug/parking/:parkingSlug/bookings/:bookingId`.
5. **New booking** in the header (desktop) or hero (phone) opens a listing picker, then the same create modal as that listing’s Bookings page. Date range and Import stay on each property page (not here).
6. Views: table, card, calendar only (no kanban).

7. Table **Actions**, card, kanban, and calendar day-detail rows have a **chat icon** that deep-links into the row's property or parking Inbox (there is no org-level Inbox). Visibility is checked per listing with `inbox:view`. Behavior: [Property bookings → Chat shortcut](./property/bookings.md#chat-shortcut).

Stay-side `need_parking` on property bookings is unchanged — that is nested stay workflow, not standalone parking reservations.

---

## Host-facing knowledge

This page combines every property stay and every parking-slot reservation across your organization. Each row's **Listing** column shows the property or parking name, and the **Booking type** filter lets you narrow the list to stays only or parking only.

**Common host questions**

- Q: What does the chat icon on a row do?
  A: It opens that guest's conversation in the Messages of the listing the booking belongs to (property or parking slot). One chat opens directly, several give you a picker, none shows a message with **Search Messages**. The icon is hidden on rows where you cannot view that listing's Messages.
- Q: Why is there no kanban here?
  A: Parking reservations use a simple status path (review → active → completed). Kanban remains on each property’s bookings page for the full stay workflow.
- Q: How do I add a booking from the org page?
  A: Tap **New booking**. Choose a property or parking slot, then fill the same form you would on that listing’s Bookings page. If you only have one listing, the form opens right away.
- Q: How do I add a parking reservation?
  A: **New booking** → pick the parking slot, or open that slot’s Bookings page and use **New booking** there.
- Q: Does opening a row here open the same booking as the property page?
  A: Yes. It is the same booking, so any status change or edit you make here is reflected everywhere.
- Q: Which bookings appear on this page?
  A: Every property stay and every parking reservation in the organization. Use the **Booking type** filter to show only stays or only parking.
- Q: Why can't I open the org Bookings page?
  A: It needs organization-wide booking access. Property-only team members use their assigned property's Bookings page instead.

---

## New booking (org)

**Entry:** **New booking** in the page header (`lg+`) or brand-hero icon (`max-lg`).

**Flow:**

1. Sheet/dialog lists **Properties** and **Parking** the signed-in host can see (`list-properties` / `list-parkings`). Archived listings are omitted. Paused properties show a short **Paused** hint.
2. Choosing a property opens `AdminNewBookingModal` for that `propertySlug`. The modal passes `embed.propertySlug` into `GuestForm` so submit / payment info target the picked listing even on the org route (no `/property/:slug` in the URL).
3. Choosing a parking slot opens `AdminParkingNewBookingModal` for that `parkingId` / slug (same submit path as the parking Bookings page).
4. If there is only one creatable listing, the picker is skipped and that create modal opens directly.

**Permissions:** Page access stays `org.bookings:view`. Create still uses the listing’s existing rules (`bookings.create:add` on property submit, parking `bookings:edit` / submit path). Plans: **N/A** (same create path as listing Bookings). Activity-log: **N/A** for the picker; listing create handlers already own audit.

---

## API

`GET /functions/v1/list-bookings?org_slug=…` (or `org_id=…`)

- Permission: `org.bookings:view`
- Returns rows where `property_id IN (org properties)` **OR** `parking_id IN (org parkings)`.
- Response includes `booking_kind`, `property_*` and/or `parking_*` meta.
- Optional `?booking_kind=property|parking`, `?property_id=` (property stays only within org).

Parking-scoped list: `?parking_id=…` with parking team `bookings:view`.

Chat icon: `GET social-inbox-booking-chats?booking_id=&property_id=|parking_id=` per row click (`inbox:view` on that listing).

Status changes: `POST transition-parking-booking?parking_id=…` with `{ bookingId, toStatus }`.

---

## UI map

| Piece         | Path                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| Page          | `ui/src/features/dashboard/org/pages/OrgBookingsPage.tsx`                       |
| Shared list   | `ui/src/features/dashboard/bookings/pages/BookingsListPage.tsx` (`scope="org"`) |
| Org new flow  | `ui/src/features/dashboard/bookings/components/OrgNewBookingFlow.tsx`           |
| Listing label | `ui/src/features/dashboard/bookings/components/BookingResourceLabel.tsx`        |
| Hook          | `ui/src/features/dashboard/bookings/hooks/useBookings.ts`                       |
| Edge function | `supabase/functions/list-bookings/index.ts`                                     |

---

## Permissions

- Route guard: `RequireOrgPermission` section `bookings` → `org.bookings:view`
- Org-wide `list-bookings`: all-listings admins see every listing; scoped admins (`all_listings = false`) only bookings for assigned properties/parkings
- Parking rows on org list require org-level access; parking-slot mutations use parking team RBAC on detail/create endpoints.

---

## Testing

| Layer | Path / spec                                                                          | Manual                                               |
| ----- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Unit  | `ui/src/features/dashboard/bookings/lib/workflow.test.ts`                            | —                                                    |
| E2E   | `ui/e2e/features/bookings/bookingChatShortcut.spec.ts` (`@ci`) runs on this org list | Org New booking picker → property and parking create |

## Related docs

- [Property bookings](./property/bookings.md)
- [Parking bookings](./parking/bookings.md)
