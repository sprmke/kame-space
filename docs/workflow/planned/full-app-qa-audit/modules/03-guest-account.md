---
title: 'QA packet 03: guest account'
status: planned
stage: planned
kind: reference
tags: [qa, audit, guest, account]
updated: 2026-11-13
---

# 03 Guest account

**Rows:** ACC-01 to ACC-09 · **Personas:** `guest` (seeded: profile, saved listing, 2 requests, 3 vouchers, 4 trips), a brand-new guest with nothing, `owner` signed in visiting `/account/*`, `anon` · **Environments:** L. P: not used (no guest test identity exists there; do not create one against real listings).

## References

Guides under `docs/guides/routes/account/`. Manual guide: `guest-account-playwright.md`. Specs: `ui/e2e/features/account` (4), `vouchers/guest`. Readiness cards: `guest-account`, `guest-auth`, `vouchers`, `guest-review`. Planned: `guest-auth-feature-showcase`, `guest-trust-safety-reporting`.

## Probe beyond the generic lenses

- **Identity separation (F09):** the guest portal is a different identity from host admin and from the anonymous form. A host session on `/account/*`, a guest session on `/org/*`, and the same email used as both must each behave as the guide says.
- **Index (ACC-01):** every card and shortcut; counts equal the underlying pages.
- **Profile (ACC-02):** each field and save path, avatar upload, email or phone change and verification, password or sign-in method, notification preferences, delete account and data export if offered, unsaved-changes guard. Profile data prefills the booking form (C32).
- **Trips (ACC-03):** trips are linked by email; test a booking made anonymously with the same email, a different email, and a changed email. Upcoming, current, past and cancelled groupings; links into trip page, document, sd-form, review.
- **Messages (ACC-04):** thread list, unread counts, send, attachments, real-time arrival of a host reply, threads across several properties (C24, C25).
- **Vouchers (ACC-05):** each voucher state (available, revealed, claimed, redeemed, expired), reveal animation styles, apply-on-form link, terms (C27).
- **Reviews (ACC-06):** pending vs submitted, edit window, host reply display, two-way review rules (C07).
- **Favorites (ACC-07):** add and remove from listing and from this page, listing that became unavailable.
- **Tickets (ACC-08):** create, reply, attach, close, reopen; visibility in super-admin support (C33).
- **Help (ACC-09):** content equals `faqs.md` guest entries; search; links.
- **Redirects:** `stays`, `wishlist`, `settings` (ledger RED-04).
- Mobile: account navigation as a native tab or list pattern, not a squeezed desktop sidebar.

## Hidden surfaces

Guest auth (Supabase Auth, OTP, Google), trip linking by email, voucher functions, review lifecycle cron, ticket functions, push subscription for guests, guest data purge.

## Connections and journeys

C07, C24, C25, C27, C32, C33. J16, J18, J19, J23, J24.

## Known risks

- Earlier coverage map shows no spec for index, messages, profile, stays, tickets and wishlist. Treat F20 as failing until proven.
- `account/trips.md` had no Testing section.
