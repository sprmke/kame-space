---
title: 'Audit 09: roles, permissions and access control'
status: active
tags: [audit, rbac, security, permissions]
updated: 2026-11-18
---

# 09: Roles, permissions and access control

Six real accounts, one per role shape, each exercised across every route and every mutating action,
with the edge response captured. Escalation tests were run against a separate tenant
(`audit-tenant-b`) so the canonical org stayed intact, then re-verified after the shared DB churn.

| Account                       | Shape                                                     |
| ----------------------------- | --------------------------------------------------------- |
| `seed-owner@example.com`      | org owner + `ADMIN_ALLOWED_EMAILS` + `SUPER_ADMIN_EMAILS` |
| scoped org admin              | org ADMIN, `all_listings=false`, Read Only on one listing |
| `operations.demo@example.com` | property member, 38 leaves, no finance/settings/team      |
| `viewer.demo@example.com`     | property member, 12 view-only leaves                      |
| `parking.demo@example.com`    | parking STAFF, empty permissions                          |
| full parking member           | all 16 parking leaves, no org membership                  |

Screenshots: `/tmp/audit/role-screens/` (79 files). Raw route walks: `/tmp/audit/matrix-*.json`.

---

## P0

### R1. Property members can promote themselves to Full Access

A property member who holds `team.members:edit` (a delegated "manage members" leaf) can PATCH their
own `property_members` row:

```
PATCH /functions/v1/property-team-members
{"property_id":"…","memberId":"<own id>","roleId":"<Full Access role>"}
→ 200, then property-access returns all 96 permissions
```

`updatePropertyTeamMember` (`_shared/propertyTeamService.ts:762`) blocks self-deactivation and
org-managed rows but has **no self-role guard and no "cannot grant more than you hold" check**. The
same call can promote any other member.

Impact: a narrow delegated grant becomes full tenant control (settings, payment accounts, finance,
team) in one request. The whole role matrix is bypassable.

Fix: reject role changes where `targetUserId === ctx.user.id` unless the caller is the org owner, and
require `team.customRoles:edit` (or ownership) to assign the Full Access template. Add a test that
attempts self-promotion for every role fixture.

### R2. Scoped org admins can lift their own listing scope to "All listings"

An org admin invited for one listing (with a Read Only property role) can PATCH themselves:

```
PATCH /functions/v1/org-team-members {"memberId":"<self>","allListings":true} → 200
GET property-access?property_id=<another listing> → accessKind "org_admin", 96 permissions
```

`verifyPropertyAccess` returns the full permission set for any org admin with `all_listings = true`.
The invite UI presents listing scope as a restriction; the restricted party can remove it.
(`_shared/orgTeamService.ts:800` guards owner edits and self-deactivation, not self-scope.)

Fix: only the owner (or an explicit `org.team.listingScope:edit` leaf) may change `allListings`, and
never for the caller's own row.

### R3. Parking team RBAC is unreachable for parking-only members

A parking member with all 16 parking leaves:

```
200 parking-access?parking_id=…          (accessKind member, 16 permissions)
200 list-bookings?parking_id=…           (data plane works)
403 list-parkings?orgSlug=…              ("Access restricted")
```

The parking shell resolves the workspace through `list-parkings`, which requires the **org**
permission `org.parkings:view`. A parking-only teammate never has it, so every
`/org/:slug/parking/:parkingSlug/*` page renders "No organization access" even though the underlying
data is authorized.

Impact: the parking Team feature is the product's RBAC promise for that vertical, and every parking
teammate is locked out of the entire parking dashboard.

Fix: resolve the parking shell from `parking-access`, or let `list-parkings` accept parking membership
for the requested parking. Give parking routes parking-specific denial copy rather than the org error.

---

## P1

### R4. The legacy allow-list is implicit membership on every tenant

`ADMIN_ALLOWED_EMAILS` is checked before membership in `verifyOrgAccess`, `verifyPropertyAccess` and
`verifyParkingTeamAccess`, returning `accessKind: "platform_admin"` with all 96 leaves. A test account
on that list read a tenant it had never joined. No audit row marks the access as cross-tenant.

This is the documented legacy admin gate, so it is not a surprise, but it means one env var typo (or a
stale teammate address) is a full cross-tenant compromise, and it silently outranks the role editor.

Fix: separate platform staff from tenant owners (an explicit table plus audit logging), and stop
treating the allow-list as membership for tenant-scoped reads.

### R5. Plan entitlements are not enforced on four data APIs

On a Free plan, these return 200 with full data:

| Endpoint                                                    | Plan feature it should require |
| ----------------------------------------------------------- | ------------------------------ |
| `finance-summary`, `finance-line-items`, `finance-bookings` | `financeReporting`             |
| `analytics-summary` (returns `tier: "full"`)                | `analyticsInsights`            |
| `maintenance-items`                                         | `maintenanceReporting`         |
| `social-inbox-threads`                                      | `metaChatChannel`              |

None of them calls `requirePropertyFeature` / `requireOrgFeature`; only the React route guard hides the
pages. A Free host can read (and in some endpoints write) data their plan excludes by calling the API
directly.

Fix: add the same `requirePropertyFeature` gate the other paid endpoints use, and add these paths to
`GATE_COVERAGE` so the drift cannot come back.

### R6. Seeded parking members are locked out entirely

`parking_members.permissions` is `[]` for every seeded member (STAFF, MANAGER, VIEWER) and
`effectiveMemberPermissions` has no role-preset fallback. `parking-access` therefore returns 403 and
the pages show "No property access". A parking member granted 16 leaves explicitly works, which
isolates the cause to the empty-array presets.

Fix: resolve role presets when `permissions` is empty (same as property team), or seed the arrays.

### R7. Inactive org admins look active in Property Team

`manager.demo` is `inactive` in `organization_members` but `active` in `property_members`. Property
Team lists them with an enabled Manage button and no paused badge, while every property route 403s.
The UI should reflect the effective state (or the member should not be listed as active).

### R8. Viewer affordances still imply write access

A view-only member sees a full rich-text toolbar and editable body on Templates (only Save is
withheld), and an enabled Save plus Stay/Guests/Pricing tabs on booking detail (click is a silent
no-op). The server is correct; the affordances are not. This repeats in the AI settings and
public-page editor surfaces.

---

## P2

| #   | Finding                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R9  | **`/org/:slug/activity` is unreachable for org admins.** The preset grants `org.activity:view`, but the route redirects to Settings (403) and bounces to the dashboard.                                                                 |
| R10 | **`/org/:slug/property/:slug/dashboard` renders the public guest 404** inside the admin shell (the dashboard is the index route).                                                                                                       |
| R11 | **`/org/:slug/inbox` silently lands on Properties** (`OrgInboxRedirect`) with no notice.                                                                                                                                                |
| R12 | **Seat cap returns 429 with `upgradeHook: true`.** A billing limit looks like rate limiting; use 402/403 with the upgrade envelope.                                                                                                     |
| R13 | **Invite validation is inconsistent.** Org invites require a Gmail address; property invites accept any address but the accept page only offers Google; org preview discloses the invited email while property/parking previews do not. |
| R14 | **Role editor confirms but does not prevent privilege growth.** A custom role can be saved with more leaves than the editor, and the UI does not warn when a role grants an action the editor (the role creator) cannot perform.        |
| R15 | **No "last owner" protection test.** Owner transfer/removal is blocked in code, but there is no test asserting an org can never end with zero owners.                                                                                   |
| R16 | **Team audit events exist for property (`team.member_permissions_changed`) but the org and parking equivalents are inconsistent**, so a cross-scope role change is not uniformly traceable.                                             |

---

## What works

- **Cross-tenant isolation holds** for normal members: org A cannot read org B (403), and a foreign
  booking id is rejected even with a valid own `property_id`.
- **Super-admin boundary** blocks both UI and API for a plain org owner.
- **Invite trust controls** are solid: email binding on accept, 410 on expired/reused tokens,
  plan-gated seats, and role-template edits propagating only to untouched members.
- **Custom roles** cannot be created without the right leaf (400/403 verified).
- **Seat limits** are respected in the UI (`aria-disabled`) even though the status code is wrong.
- **Per-route permission checks** (hide the nav item _and_ 403 the handler) are the default pattern;
  the gaps above are exceptions, not the norm.

## Coverage

| Surface                                                   | Owner | Org admin | Property ops     | Viewer  | Parking staff | Parking full        |
| --------------------------------------------------------- | ----- | --------- | ---------------- | ------- | ------------- | ------------------- |
| Org dashboard / bookings / reviews / analytics            | ✅    | ✅ scoped | 403              | 403     | 403           | 403                 |
| Org properties / parkings / team / plans / settings       | ✅    | partial   | 403              | 403     | 403           | 403                 |
| Property dashboard / bookings / finance                   | ✅    | ✅ scoped | ✅ / 403 finance | ✅ view | 403           | 403                 |
| Property pricing / maintenance / templates / public pages | ✅    | partial   | ✅ / partial     | view    | 403           | 403                 |
| Property team / settings                                  | ✅    | ✅        | 403              | 403     | 403           | 403                 |
| Property inbox / marketing                                | ✅    | partial   | 403              | 403     | 403           | 403                 |
| Parking dashboard / bookings / finance / pricing / team   | ✅    | ✅ scoped | 403              | 403     | **403 (bug)** | **403 shell (bug)** |
| `/admin/*`                                                | ✅    | 403       | 403              | 403     | 403           | 403                 |
