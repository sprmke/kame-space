---
title: 'Parking Help & Support'
status: active
tags: [guides, routes, org, parking, help-support]
updated: 2026-11-24
---

# Parking Help & Support

Route: `/org/:orgSlug/parking/:parkingSlug/help-support` (+ `/docs`, `/tickets`, `/tickets/new`, `/tickets/:ticketId`)

Announcements: [Announcements](./announcements.md) (`/announcements`). Legacy `/help-support/announcements` redirects there.

> **Status:** Documented

## Progress overview

| Section      | E2E | Validation | Docs | Notes                                              |
| ------------ | --- | ---------- | ---- | -------------------------------------------------- |
| FAQs         | Yes | N/A        | Yes  | Search + category tiles (parking-scoped)           |
| All sections | Yes | Yes        | Yes  | Same feature as the property scope, parking-scoped |
| Mobile       | Yes | N/A        | Yes  | Full-height ticket thread below `lg`               |

## Overview

Identical feature to [Property Help & Support](../property/help-support.md), mounted for a parking slot instead of a property — tickets filed here carry `parking_id` (and `property_id` null). Visible to every parking team member, not gated behind a specific permission (`bookings:view` baseline, same as Dashboard).

Compact nav tiles, singular/plural topic counts, a **New ticket** escape hatch on an empty search, a single-pane ticket error, and full-height phone ticket detail all match the property mount. The launcher is hidden on `/help-support` routes.

## FAQs

FAQs home is **search plus category tiles** for this **parking** mount (slot settings, rates, finance, parking team). Opening a tile shows that topic’s Q&A. Organization account FAQs, property bookings, and AI Assistant stay on those Help pages.

## Host-facing knowledge

Same as the property-level page: searchable and browsable FAQs, documentation, AI Assistant, and support tickets, just scoped to this parking listing. Guest-only FAQ categories stay out of host Help. Synced FAQs are read-only in the super-admin editor; manual FAQs remain editable.

**Common host questions**

- Q: If I file a ticket about a parking issue, does your team know it's about parking?
  A: Yes. Tickets filed from a parking listing's Help & Support page are tagged with that listing, so our team has the context automatically.
- Q: Why don't I see property booking FAQs here?
  A: Help FAQs match the page you're on. Parking Help shows parking answers; open a property's Help & Support for stay and booking questions.
- Q: Can every parking team member open Help & Support?
  A: Yes. It is available to every parking team member, the same as the parking dashboard. No extra permission is needed.
- Q: Where do announcements live now?
  A: Announcements have their own page. The old Help & Support announcements link sends you to the parking announcements archive.
- Q: Does Ask AI know about this parking slot?
  A: Ask AI opens the dashboard assistant with your current context. Parking data and actions are still limited, so use a ticket when you need our team to check a parking issue.

## API reference · Implementation map

Same as [Property Help & Support](../property/help-support.md) — parking-scoped calls use `parkingId` instead of `propertyId`.
---

**Unsaved changes.** Leaving after editing asks to **Discard** or **Keep editing** (nothing is saved until you submit). Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Testing

| Layer | Path / spec                                                                                     | Manual        |
| ----- | ----------------------------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`; `help-support/lib/*.test.ts`                                    | —             |
| E2E   | `ui/e2e/features/help-support/helpSupportModule.spec.ts` (`@ci`) — parking scope + `parking_id` | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs                    | PayMongo live |
| Tour  | `helpSupportTour.slowmo.spec.ts` (`@demo`) — parking scope scenario                             | —             |

## Related docs

- [Route index](../../README.md)
- [Org Help & Support](../help-support.md)
- [Property Help & Support](../property/help-support.md)
- [Super-admin ticket management](../../admin/support.md)
