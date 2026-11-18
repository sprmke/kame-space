---
title: 'Audit 15: security review'
status: active
tags: [audit, security]
updated: 2026-11-19
---

# 15: Security review

Threat model: the UI ships the Supabase anon key, so **every authenticated user can talk to PostgREST
and every edge function directly** with their own JWT. Anything enforced only in React is not
enforced. Findings below were reproduced against the local stack.

---

## P0

### S1. Any team member can read, rewrite or delete bookings through PostgREST

RLS is enabled on all 169 tables, and `guest_submissions` has four policies. All four authorize via
`private.user_can_access_guest_submission(...)`, which only checks **membership**:

```
owner_id = auth.uid()
OR active organization_members row
OR active property_members row
OR active parking_members row
```

It never checks the permission leaves (`bookings:view`, `bookings.detail.workflow:edit`,
`bookings.finance:edit`, …) that every edge function enforces. So a member whose role is view-only can
write directly.

Reproduced with `viewer.demo@example.com` (role has only `*:view` leaves):

```bash
# read everything in scope
GET /rest/v1/guest_submissions?select=id     -> 206, Content-Range: 0-0/76

# rewrite any column, including workflow status
PATCH /rest/v1/guest_submissions?id=eq.<booking>
{"status":"CANCELLED"}                        -> 204, row is CANCELLED
```

A second probe wrote `cancellation_override_note`. Both were reverted.

Impact:

- **Workflow tampering**: status changes bypass `WorkflowOrchestrator`, so no emails, no PDFs, no
  calendar sync, no `booking.status_changed` activity row. The booking ends in a state the app cannot
  explain.
- **Financial tampering**: `booking_rate`, `down_payment`, `security_deposit`, `guest_balance_paid_amount`,
  `sd_refund_*` bank fields are all writable.
- **PII**: guest names, emails, phones, addresses and document URLs are readable in bulk.
- **Deletion**: the same function backs the DELETE policy, so any active member can delete bookings in
  scope.

Why the tests did not catch it: the app never uses direct writes (only two direct reads), and there is
no test that asserts RLS matches the permission leaves.

Fix direction (pick one, ideally both):

1. **Split read from write in RLS**: keep membership for SELECT, and for INSERT/UPDATE/DELETE require
   the specific leaf via a SQL helper that reads `property_members.permissions` /
   `organization_members.permissions` (or drop the write policies entirely and force all writes
   through edge functions).
2. **Close direct access**: revoke `authenticated` grants on `guest_submissions` (and other sensitive
   tables) so only `service_role` can touch them, and move the two direct UI reads to edge functions.
   This matches the stated architecture ("RLS is not the access-control layer").

Add a test: for each role fixture, attempt a REST PATCH and assert 403.

### S2. Guest PII is readable by anyone with a booking UUID when access enforcement is off

`GUEST_BOOKING_ACCESS_ENFORCE` is an opt-in env var (documented as `true` in `.env.example`, unset in
the local env and therefore false). With it unset, an anonymous caller holding only the anon key gets
full guest data:

```bash
curl "$API/get-form/5eed1000-0000-4000-8000-000000000032" -H "apikey: $ANON"
# 200 ->
# guestEmail, guestPhoneNumber, guestAddress, primaryGuestName, guest2Name..guest5Name,
# paymentReceiptUrl, validIdUrl..guest5ValidIdUrl
```

48 fields including every document URL.

Booking UUIDs are shared in emails, chat messages, support threads and screenshots, so "unguessable"
is doing a lot of work here. If production has the flag off, this is a live PII exposure with no
authentication at all.

Fix direction: make enforcement **default on** (absence of the var = enforce), keep a documented grace
window for legacy links, and have `get-form` return a minimal projection (dates + status) without
documents when there is no token.

---

## P1

### S3. Payment receipts are stored in a public bucket

`storage.buckets.payment-receipts` has `public = true`. Receipt images routinely contain the sender's
name, bank/GCash account details and amounts. Anyone with the URL (the URL is stored on the booking
row, shown to the guest, and copied into emails) can fetch it without auth. `pet-vaccinations`,
`parking-endorsements` and `guest-chat-attachments` are also public; the first two may contain personal
data.

Private-by-default is the correct posture for anything a guest uploaded. `valid-ids` and
`identity-captures` are already private, so the pattern exists.

### S4. Three edge functions are missing from `config.toml`

`notification-preferences`, `telegram-delivery-settings` and `telegram-message-log` have no
`[functions.*]` entry, so a deploy applies the project default (`verify_jwt = true`). All three are
called from the UI with modern ES256 tokens, which the repo's own `admin-auth` rule says Kong rejects.
They pass locally only because `supabase functions serve` does not enforce `verify_jwt`.

Net effect: notification preferences and both Telegram history surfaces can 401 in production while
working in dev. Add the entries (or set the project default explicitly) and add a CI check that every
function directory has a config entry.

### S5. Invitation tokens are stored in plaintext

`organization_invitations.token`, `property_invitations.token`, `parking_invitations.token` are
plaintext. `identity_verification_sessions` already uses `token_hash`, so the pattern exists. A
read-only database leak (backup, log, dashboard) turns every pending invite into an account takeover
vector. Hash them and compare hashes on accept.

---

## P2

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S6  | **Two super-admin sources of truth.** `platform_super_admins` rows are not used for authorization (`SUPER_ADMIN_EMAILS` env is), so the table cannot grant or revoke access. See C5.                                                                                                                                                                                                                                                                                                                                             |
| S7  | **CORS is `*` on every edge response.** Fine for bearer-token APIs, but it means any website can drive the public endpoints (`submit-form`, `search`, `get-form`) from a visitor's browser. CAPTCHA and rate limits are the only defenses. Consider an origin allowlist for the public write endpoints.                                                                                                                                                                                                                          |
| S8  | **IP rate limits trust `x-forwarded-for` as a fallback.** `clientIpFromRequest` prefers `cf-connecting-ip`/`x-real-ip` and falls back to `x-forwarded-for`, which a client can spoof if the deployment does not overwrite it. Verify Supabase/Kong sets `x-real-ip` in production; otherwise public limits are bypassable per request.                                                                                                                                                                                           |
| S9  | **No idempotency on checkout creation.** `create-org-subscription-checkout` and `submit-form` do not use `withIdempotency`. A network retry can open two PayMongo sessions; if both are paid, the org is double-charged and needs a manual refund.                                                                                                                                                                                                                                                                               |
| S10 | **Authed host surface allows SVG uploads** (`property-media` MIME list includes `image/svg+xml`). Served from the storage origin, an SVG with script is same-origin for that domain and can be used for phishing or storage-origin XSS. Drop SVG or rasterize it.                                                                                                                                                                                                                                                                |
| S11 | **`VITE_INBOX_MOCK_DATA`** can be turned on by a build env var and would show fake conversations in a real host inbox. Guard it with `import.meta.env.DEV` as well.                                                                                                                                                                                                                                                                                                                                                              |
| S12 | **`property_guest_essentials.wifi_password` is plaintext.** Low sensitivity, but it is guest data in a table any org member can read (and, per S1, write).                                                                                                                                                                                                                                                                                                                                                                       |
| S13 | **A user with activity history cannot be deleted.** `activity_log` has an append-only trigger that blocks UPDATE and DELETE; deleting an auth user makes Auth null its actor references, which fires that trigger, so the admin delete returns 500 `activity_log is append-only`. Account deletion, GDPR erasure and compromised-account removal are all blocked once the user has any audit trail. Decide the erasure policy (anonymise the actor id, or allow a controlled delete with a documented exception) and add a test. |

---

## Verified as sound

- **Webhooks**: Resend (Svix signature + timestamp), PayMongo (signature + dedupe table), Meta
  (`x-hub-signature-256` + verify token). All reject unsigned calls.
- **XSS**: all 6 `dangerouslySetInnerHTML` sinks go through DOMPurify with dedicated configs; TipTap
  output is sanitized on render, not just on save.
- **Uploads**: server-side magic-byte check (`assertMimeMatchesBytes`) plus bucket MIME and size limits.
- **Open redirects**: `safeRedirect` rejects protocol-relative and backslash tricks, with tests.
- **Service-role key**: not present in any `VITE_*` var or UI code; client only holds the anon key.
- **Guest identity separation**: a signed-in guest with no membership gets 0 booking rows from
  PostgREST (verified), so the RLS scoping itself works across tenants.
- **Payment webhooks**: `processed_paymongo_events` dedupes replay.
- **Search**: user input is escaped for PostgREST `.or()` trees (`postgrestOrIlikeValue`).
- **Guest access tokens**: HMAC-signed, TTL bounded, no service-role fallback.
- **Help-desk surfaces**: guest ticket creation requires auth; review submission is rate limited and
  token-gated.

## Recommended order

1. S1 (RLS write bypass) — one migration plus a role fixture test.
2. S2 (guest PII) — flip the default and narrow the projection.
3. S3 (public receipts bucket) — make private, serve signed URLs.
4. S4 (config entries) — add three entries + CI check.
5. S5, S9, S10 — hash invites, add idempotency to checkout, drop SVG.
