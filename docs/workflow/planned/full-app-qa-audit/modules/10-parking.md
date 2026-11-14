---
title: 'QA packet 10: parking vertical'
status: planned
stage: planned
kind: reference
tags: [qa, audit, parking]
updated: 2026-11-13
---

# 10 Parking

**Rows:** PARK-01 to PARK-12 (host side). Guest-side parking pages are GST-10 to GST-12 and PUB-06, PUB-07, PUB-11. · **Personas:** `owner`, `org-admin`, `parking` member (Manager, Staff, Viewer templates and a custom role), a property-only member (must see nothing here), `stranger`; guest in a second context · **Environments:** L; P test tenant (`kame-test-parking`) for views.

Parking is its own vertical with its own scope and RBAC (`parkingScope.ts#resolveScopedParkingAccess`), not a property sub-feature. It reuses property modules at a second level and has had the least test attention on those shared modules.

## References

Guides under `docs/guides/routes/org/parking/`, plus `org/parkings.md`, `parkings.md`, `bookings/parking.md`, `admin/parking-payouts.md`. Manual guide: `parking-playwright.md`. Specs: `ui/e2e/features/parking` (21: guest, host, flows, live). Readiness: `audits/parking-e2e-production-readiness.md`, cards `pay-parking`, `parking-payments`. In progress: `parking-module-hardening` (payment fulfillment crash, stale checkout reuse, double payment paths, found 2026-11-07). `for-testing`: `parking-property-parity`.

## Probe beyond the generic lenses

- **Scope isolation (F08):** a parking member cannot read or write any property data and the reverse. A member of parking A cannot touch parking B in the same org. Check nav, direct URLs and direct function calls.
- **Dashboard (PARK-01):** every card and number recomputed.
- **Bookings (PARK-02, 03):** list, filters, new booking modal; detail with the full parking status flow. Build the parking transition matrix the same way as for property bookings: request, host claim, decline, payment pending, paid, fulfilled, cancelled, expired, refunded. Free manual workflow vs paid marketplace workflow. Linked property booking and the legacy pay-parking path.
- **Payments:** checkout creation, expiry, reuse of a stale checkout, paying twice, webhook arriving before the return page, webhook arriving twice, payment after cancellation, refund and override path (flagged as a decision still needed). Payout records and their super-admin view (C28).
- **Host claim and marketplace:** several hosts eligible for one request, first claim wins, the others see the outcome, guest status page updates.
- **Pricing (PARK-05):** rates, rules, availability; reflected on public parking pages and the parking form quote (C29).
- **Settings (PARK-08):** every section and save path, setup completeness, lifecycle (publish, pause, archive), development and tower association.
- **Shared modules as deltas (PARK-04, 06, 07, 09, 10, 11, 12):** finance, inbox, notifications, team, activity, announcements, help-support. Run the property inventory at parking scope and record every difference. Parity plan in `for-testing` gives the intended list.
- **Org parkings list (ORG-04)** and the guest-form parking CTA end to end.

## Hidden surfaces

`parking-*`, `create-parking-booking`, `claim-*`, `decline-*`, `pending-*`, `expire-*`, `paymongo-webhook`, parking emails, payout computation, parking permission catalog.

## Connections and journeys

Source of C28, C29; reader of C04. J08, J27.

## Known risks

- The hardening audit's findings may be partly fixed; re-test each one explicitly and record its state.
- Several parking specs were once untagged and ran in no CI lane; confirm they run now (`check:e2e-lane-tags`).
