---
title: 'PR-016: tenant storage paths, upload sniffing and deletion propagation (2026-11-20)'
status: active
stage: in-progress
kind: reference
readiness: verified
launch_gate: B
launch_blocker: true
last_verified: 'local 2026-11-20'
---

# Storage hardening

Doc 20 was stale in two rows and genuinely open in one.

## Path scoping (row 2)

Verified in code, not changed:

| Surface                                                | Path                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Booking assets (IDs, receipts, pet docs, endorsements) | `{propertyId}/{bookingId}/{fileName}` via `bookingStoragePaths.ts#bookingAssetStorageKey` |
| Property media                                         | `{propertyId}/…`                                                                          |
| Listing authorization                                  | `org/{orgId}/property/{propertyId}/…`                                                     |
| Guest chat attachments                                 | `{orgId}/{conversationId}/…`                                                              |
| App-settings property assets                           | `{kind}/{propertyId}/…`                                                                   |

## Upload sniffing (row 4)

Every `_shared` helper that writes bytes to Storage now validates file bytes before upload: guest
documents, booking assets, org/team logos, support tickets, inbox chat, guest avatar, verification,
listing authorization, app settings, parking and property media, templates, assistant attachments
and marketing. Audio uses `sniffAudioMime` in `marketingMusicStorage.ts`.

Server-generated or copy-only writers are explicit allowlist entries with a reason in
`scripts/dev/check-storage-upload-sniff.sh`. That guard fails when a new writer appears without a
sniff, so the stale "remaining paths" row cannot come back silently.

## Deletion propagation (row 6)

`_shared/tenantStoragePurge.ts`:

- `propertyStoragePurgeTargets({ propertyId, orgId, conversationIds })` returns the prefix map:
  property media, marketing media, listing authorization, app-settings assets, guest chat
  attachments and all five guest-PII buckets (`valid-ids`, `payment-receipts`,
  `pet-vaccinations`, `pet-images`, `parking-endorsements`).
- `removeStoragePrefix` walks nested folders and removes files only; a list/remove error logs and
  continues, so storage never blocks the database delete.
- `delete-property` and `delete-organization` both call it. Org deletion runs the purge for every
  property before the cascade.

Unit tests: `tenantStoragePurge_test.ts` (4) cover the target map, nested traversal, the
best-effort list failure and target order.

**Deferred, with a reason:** a scheduled orphan reconcile. Property and org deletion are blocked
while bookings exist, so the remaining orphans come from failed uploads, and
`bun run media:storage-audit` is the reconcile tool until a cron is justified.

## Verification

| Run                                                     | Result                                    |
| ------------------------------------------------------- | ----------------------------------------- |
| `deno test .../tenantStoragePurge_test.ts`              | 4 passed                                  |
| `delete-property` / `delete-organization` handler tests | 6 passed                                  |
| `bun run check:edge-types`                              | pass                                      |
| `bash scripts/dev/check-storage-upload-sniff.sh`        | OK, every writer sniffs or is allowlisted |
