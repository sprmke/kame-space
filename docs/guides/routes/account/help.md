---
title: 'Guest account Help — operator guide'
status: active
tags: [guides, routes, account, help-support]
updated: 2026-11-22
---

# Guest account Help — operator guide

Route: `/account/help`

> **Status:** Documented

## Progress overview

| Section      | E2E save | Validation | Docs       | Notes                                                 |
| ------------ | -------- | ---------- | ---------- | ----------------------------------------------------- |
| FAQ groups   | —        | —          | Documented | Published `guest` + `public` FAQs from the public API |
| Contact link | —        | —          | Documented | Opens `/account/tickets`                              |
| Loading      | —        | —          | Documented | `GuestAccountHelpPageSkeleton` matches home layout    |

## Overview

Signed-in explore guests open **Help** from the account menu. The page reads published FAQs from `list-public-support-faqs` (`guest` or `public` audience). Host-only answers never appear here. If none are published, curated guest fallbacks still fill the topic grid (same idea as `/support` guest fallbacks).

Layout: `help-support` mascot stays on home, search, and topic views. **Help** title + short description show on the home view only (hidden once the guest searches or opens a topic). Below that: search + host-style category grid, then drill-in answers (back returns to all topics). **Contact support** in the footer opens Tickets.

**Loading:** `GuestAccountHelpPageSkeleton` keeps the real mascot, **Help** title, subtitle, search chrome, and contact footer; only topic tiles skeletonize. Suspense uses the same skeleton via `GuestAccountRouteSuspenseFallback`.

## Host-facing knowledge

Guests can open **Help** in their account area to read answers about trips, messages, vouchers, reviews, and account access. Answers are grouped by topic, and a **Contact support** button opens their ticket list.

**Common guest questions**

- Q: How does a guest find help after signing in?
  A: Open **Help** in the account menu. It is separate from Tickets, which is where they write to support.
- Q: Why can a guest see some answers but not host-only ones?
  A: The guest Help page shows answers marked for guests or for everyone. Host dashboard answers stay in the host Help area.
- Q: Where does a guest go if the answer is not there?
  A: Use **Contact support** to open Tickets and send a message with the details.
- Q: Does the Help page need a host or property?
  A: No. It is account-level and works for any signed-in guest.

## API reference

| Action    | Endpoint                       |
| --------- | ------------------------------ |
| List FAQs | `GET list-public-support-faqs` |

## Implementation map

| Concern    | Path                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| Page       | `ui/src/features/guest/account/pages/GuestAccountHelpPage.tsx`                           |
| Skeleton   | `ui/src/components/skeletons/GuestAccountSkeletons.tsx` (`GuestAccountHelpPageSkeleton`) |
| Fallbacks  | `ui/src/features/guest/account/lib/guestHelpFaqs.ts`                                     |
| API client | `ui/src/features/guest/marketing/lib/publicSupportApi.ts`                                |
| Hook       | `ui/src/features/guest/marketing/hooks/usePublicSupportFaqs.ts`                          |
| Nav        | `ui/src/features/guest/account/lib/guestAccountNav.ts`                                   |
| Shared UI  | `HelpTopicList`, `HelpDisclosure` under help-support components                          |
| Edge       | `supabase/functions/list-public-support-faqs/`                                           |

## Testing

| Layer | Path / spec                                 | Manual |
| ----- | ------------------------------------------- | ------ |
| Unit  | `publicSupportApi` helpers when changed     | —      |
| E2E   | Guest account nav smoke when touched        | —      |
| N/A   | Content correctness (docs sync + CI guards) | —      |

## Related docs

- [Route index](../README.md)
- [Guest Tickets](./tickets.md)
- [Guest Profile](./profile.md)
- [Curated FAQs](../../support/faqs.md)
