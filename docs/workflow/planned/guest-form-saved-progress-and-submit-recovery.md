---
title: 'Guest booking form: saved progress and failed-submit recovery'
status: planned
tags: [workflow, planned, guest-form, submit-form, drafts, reliability, storage, bookings]
updated: 2026-11-11
stage: planned
kind: plan
---

# Guest booking form: saved progress and failed-submit recovery

When a guest's booking submit fails, today they get a toast and a **Copy Booking Information**
button and are asked to paste a text dump to the host. Their photos (IDs, receipt, pet record)
are not in that text. If they close the Messenger in-app browser, most of the form is gone.

This plan replaces that with one durable model: **the guest's progress lives on their account,
not on the device**. Text autosaves to the server, every photo uploads the moment it is picked,
and the final submit only confirms what is already saved. A failed submit becomes a saved
request the guest can retry and the host can see, finish, or send back, without anyone copying
anything.

Status: **not started**. Nothing in this plan is implemented.

## Goals

1. A guest who closes the browser (Messenger, Instagram, Safari, Chrome) and opens the link again
   gets **every text field and every photo back**, on the step they left, after signing in.
2. A failed submit **never loses data** and never asks the guest to copy text.
3. The host **finds out on their own** when a guest tried and failed, and can act on it from the
   dashboard (send a finish link, create the booking, or dismiss).
4. Retries **never create duplicate bookings**, including when the response was lost after the
   server saved.
5. Guest-fixable rejections (dates taken, cleaning time, voucher, policy changed) take the guest
   to the right step and field instead of showing a generic error.
6. Engineers see real faults in Sentry with a draft id, without guest PII.

## Non-goals

- No new booking status. Drafts are **not** `guest_submissions` rows and never enter the status
  machine (`_shared/statusMachine.ts`, `.cursor/rules/booking-workflow.mdc` stay untouched).
- No offline submit queue. Submits still need captcha, live availability and the cancellation
  policy check (same stance as `docs/architecture/pwa.md` → "Submit while offline").
- No server drafts for the admin **New booking** embed (`AdminNewBookingModal`, `skipAuthGate`)
  or for edits of an existing booking (`?bookingId=`). Those keep today's local draft.
- No per-failure email to super admins (noise and PII). Faults go to Sentry and the daily ops report.
- Showing hosts drafts the guest **never tried to submit** is out of scope for v1 (see Open questions).

## Current state

| Area           | Today                                                                                                                                                                                  | File                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Auth           | Public form is gated: `GuestAuthModal` opens until the guest signs in (email code or Google). Every real guest submit has a Supabase user.                                             | `GuestForm.tsx` (`requireGuestAuth` effect), `GuestAuthContext.tsx`                                  |
| Local draft    | Text only, IndexedDB, debounced 1.2s. `toDraftValues` strips every `File`. Restore is a **15 second toast** with a Restore button, easy to miss.                                       | `GuestForm.tsx` (draft effects), `ui/src/hooks/useOfflineFormDraft.ts`                               |
| Files          | Held only as `File` objects in React Hook Form. Lost on close. The hook supports file blobs but the booking form does not use it.                                                      | `GuestForm.tsx`, `useOfflineFormDraft.ts`                                                            |
| Booking id     | New bookings get `crypto.randomUUID()` **per mount**, not saved. A reload after a lost response gets a new id, so a retry can create a second booking.                                 | `GuestForm.tsx` ("Generate a new booking ID")                                                        |
| Submit         | One multipart request: all text plus up to 8 images (each up to 12 MB). Server uploads files **one by one** before the DB write. Any later failure leaves orphaned objects in storage. | `GuestForm.tsx#onSubmit`, `submit-form/index.ts`, `DatabaseService.processFormData`, `UploadService` |
| Errors         | Catch-all returns **HTTP 400 for every error**, server faults included. Client classifies by `errorMessage.includes('UPPER_CODE')`.                                                    | `submit-form/index.ts` (final catch), `GuestForm.tsx` catch block                                    |
| Failure UX     | Generic toast: raw error text, copy-paste hint, **Copy Booking Information** (`formatBookingInfoForClipboard`). 7 second toast.                                                        | `GuestForm.tsx`, `lib/bookingFormatter.ts`, `formatGuestCopyPasteHint`                               |
| Host awareness | None. The host learns about a failure only if the guest pastes the text.                                                                                                               | n/a                                                                                                  |
| Faults         | `publicEdgeFetch` reports 5xx to Sentry. Because faults come back as 400, **most `submit-form` faults never reach Sentry**. `captureFaultIfServerError` runs server-side only.         | `ui/src/lib/api/publicEdgeFetch.ts`, `reportEdgeFailure.ts`, `_shared/httpResponse.ts`               |

### Bugs found while researching (fix in Phase 0)

1. **Closed listing shows the generic error.** The server returns `error: 'property_not_accepting_bookings'`
   (lowercase, 409). The client tests `errorMessage.includes('PROPERTY_NOT_ACCEPTING_BOOKINGS')`
   (uppercase), so the guest sees "Could not submit form: property_not_accepting_bookings" plus the
   copy button instead of the closed-listing message.
2. **Cancellation not accepted shows the generic error.** Same mismatch for `cancellation_policy_not_accepted`.
3. **Server faults are invisible to client Sentry** (always 400, see above).
4. **Duplicate booking risk on retry after reload** (per-mount UUID, see above).
5. **Orphaned uploads** when the DB write fails after `UploadService` already stored files.

### Why Messenger loses progress

- The Messenger and Facebook in-app browsers are WebViews. On iOS, WebView storage (localStorage,
  IndexedDB) is reported to be wiped on force close or reboot, and Safari-family storage can be
  evicted after 7 days without a visit. Android behaves better but is not guaranteed. This matches
  the "most of the time it resets" report. Treat device storage as a **cache, never the source of truth**.
- The Supabase session lives in the same storage, so the guest also has to sign in again. That is
  fine: **the account survives even when the WebView does**, which is exactly why the account is the
  right anchor for saved progress.
- Google blocks OAuth inside embedded WebViews (`disallowed_useragent`). If our sign-in modal shows
  "Continue with Google" inside Messenger, guests can hit a dead end before they even reach the form.
  `ui/src/lib/pwa/platform.ts#detectPlatform` already fingerprints Messenger, Facebook and Instagram;
  the auth modal does not use it yet. Verify on device in Phase 0.

## Options considered

| Option                                                                       | Verdict                        | Why                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Better local storage only** (save files to IndexedDB, auto-restore)     | **Partial, keep as a cache**   | Cheap and helps on Android and normal browsers, but iOS WebViews can wipe it, it does not cross devices or browsers, and the host still never knows. Shipped in Phase 0 as a quick win and kept as the offline buffer.                                                            |
| **B. Account-backed server draft** (text autosave to a `booking_drafts` row) | **Adopt**                      | Survives WebView wipes, browser switches ("open in Chrome") and device switches. Possible because the form already requires sign-in.                                                                                                                                              |
| **C. Upload photos when picked** (staged uploads)                            | **Adopt**                      | Removes the biggest failure point (one huge multipart request over mobile data) and makes photos restorable. Each file retries on its own.                                                                                                                                        |
| **D. Draft-based, idempotent submit** (submit sends a draft id, not files)   | **Adopt**                      | Small payload, cheap retries, the draft id doubles as the booking id so a retry cannot duplicate.                                                                                                                                                                                 |
| **E. Your idea: create a "draft booking" visible to the host**               | **Adopt, scoped**              | Correct instinct. Implemented as a **separate drafts table** surfaced to the host only after the guest **tried to submit** and it failed, never as a fake `guest_submissions` row (that would break overlap checks, calendars, iCal feeds, notifications and the status machine). |
| **F. Auto-create a real booking on failure**                                 | Reject                         | Many failures are real rejections (dates taken, cleaning time). Writing a booking anyway would double-book or bypass checks.                                                                                                                                                      |
| **G. Your idea: Sentry + super-admin email per failure**                     | **Adopt Sentry, reject email** | Sentry is for engineers and must not hold PII; it is not a recovery path. Per-failure email is noisy and leaks PII by email. Use Sentry alerts plus the existing daily ops report count.                                                                                          |
| **H. Service worker Background Sync / offline queue**                        | Reject                         | Unreliable in in-app WebViews, Turnstile tokens are single-use, availability must be checked live. Already ruled out in `pwa.md`.                                                                                                                                                 |
| **I. Copy-to-clipboard (today)**                                             | Remove                         | Manual, error-prone, cannot carry photos, and leaves the host with retyping.                                                                                                                                                                                                      |

**Recommendation: B + C + D + E, with A as the device cache.** This is the pattern long forms in
booking and checkout products use: autosave to the account, upload attachments eagerly, make the
final submit an idempotent confirm, and turn a failure into a saved, visible state.

## Target design

```
Guest picks a file ──► compress (prepareUpload) ──► guest-booking-draft-upload ──► final bucket,
                                                                                   key {propertyId}/{draftId}/draft-{slot}-{uuid}.{ext}
Guest types       ──► IndexedDB (instant) ──► guest-booking-draft PUT (debounced, on Next, on pagehide)
Guest opens link  ──► sign in ──► guest-booking-draft GET ──► newest of {server, local} restored + photos
Guest submits     ──► flush draft ──► wait for uploads ──► submit-form { draftId, text, captcha }
                         success ──► draft.status = submitted, booking id = draft id
                  guest-fixable ──► jump to step + field error, draft stays open
                          fault ──► draft.status = submit_failed, host notified once, guest sees "Saved, try again"
Host dashboard    ──► Bookings → Needs attention ──► Send finish link | Create booking | Dismiss
```

### 1. Data model

New table, plain SQL migration (next free timestamp after `20261328000000`).

```sql
create table public.booking_drafts (
  id                    uuid primary key,              -- client-generated, becomes guest_submissions.id
  property_id           uuid not null references public.properties(id) on delete cascade,
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  guest_user_id         uuid references auth.users(id) on delete cascade,
  mode                  text not null default 'new' check (mode in ('new','completion')),
  target_booking_id     uuid,                          -- completion mode only
  values                jsonb not null default '{}'::jsonb, -- allowlisted text fields only
  files                 jsonb not null default '{}'::jsonb, -- slot -> {bucket,path,name,mime,size,uploadedAt}
  current_step          smallint,
  policy_hash_accepted  text,                          -- restore the checkbox only if the hash still matches
  revision              integer not null default 0,
  status                text not null default 'open'
                          check (status in ('open','submitting','submit_failed','submitted','converted','dismissed','expired')),
  last_error_code       text,
  last_error_request_id text,
  submit_attempts       integer not null default 0,
  submitting_until      timestamptz,                   -- short lease against double submit
  submitted_booking_id  uuid,
  host_notified_at      timestamptz,
  resume_token_hash     text,                          -- host-sent finish link, single claim
  resume_token_expires_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  expires_at            timestamptz not null default now() + interval '14 days'
);

-- One open draft per guest per property per target.
create unique index booking_drafts_one_open
  on public.booking_drafts (guest_user_id, property_id, coalesce(target_booking_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('open','submitting','submit_failed');

create index booking_drafts_host_attention
  on public.booking_drafts (property_id, status, updated_at desc)
  where status = 'submit_failed';

create index booking_drafts_expiry on public.booking_drafts (expires_at)
  where status not in ('submitted','converted');

alter table public.booking_drafts enable row level security; -- no policies: edge functions (service role) only
```

Notes:

- `status` is a `TEXT` + `CHECK`, matching the repo convention.
- `values` holds PII at the same sensitivity as `guest_submissions`. Server allowlists keys from the
  guest form schema field list and caps the JSON at 32 KB. File fields, prices and dev flags are
  never stored.
- Account deletion cascades through `guest_user_id`. Property or org deletion cascades too.
- RLS is on with no policies, consistent with "edge checks are the access layer" (CLAUDE.md sharp edges).

### 2. Storage: stage at the final key

Files upload straight into the **existing private buckets** (`valid-ids`, `payment-receipts`,
`pet-vaccinations`, `pet-images`) at `bookingAssetStorageKey(propertyId, draftId, "draft-{slot}-{uuid}.{ext}")`.
Because the draft id **is** the booking id, submit only writes the URL columns. No copy, no move,
no second upload at the moment that matters most.

- Server builds the path. The client never sends a path.
- Replacing a photo deletes the previous object for that slot right away.
- Max 16 objects per draft (8 slots plus replacements in flight), enforced server-side.
- Unsubmitted drafts' objects are deleted by the purge cron (section 8). Submitted drafts' objects
  belong to the booking and are never touched by the purge.
- Considered and rejected: a separate `booking-draft-uploads` bucket plus a copy at submit. It adds
  a download and re-upload of up to 8 files inside `submit-form`, which is the failure point we are
  removing.

### 3. Edge functions

| Function                           | Wrapper                               | Purpose                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guest-booking-draft` (new)        | `serveAuthenticated` (guest JWT)      | `GET ?property=<slug>[&target=<bookingId>]` returns my open draft with **signed** file URLs (30 min, same as `get-form`). `PUT` upserts `values`, `current_step`, `policy_hash_accepted` with `revision` (stale revision returns 409 plus the newer copy). `DELETE` = Start over (deletes row and staged objects). Per-user rate limit about 60 writes per minute.                          |
| `guest-booking-draft-upload` (new) | `serveAuthenticated`                  | Multipart, one file per call: `draftId`, `slot`, `file`. Checks ownership, slot allowlist, `assertWithinUploadLimit(file, 'document' or 'image')`, `assertUploadMatchesBytes` (MIME sniff), object cap. Writes the object and the `files[slot]` entry. Returns `{ slot, signedUrl, name, size }`. `DELETE` removes a slot. Creates the draft row on first upload if text has not saved yet. |
| `guest-booking-draft-claim` (new)  | `serveAuthenticated`                  | Host-sent finish link: `draftId` plus token. Valid unexpired token sets `guest_user_id` to the caller, clears the token (single claim), returns the draft.                                                                                                                                                                                                                                  |
| `submit-form` (changed)            | unchanged entry                       | Accepts `draftId`. When present: loads the draft, requires `guest_user_id = caller`, takes file URLs from `draft.files` (paths re-verified against the `{propertyId}/{draftId}/` prefix and existence), ignores any file parts. Idempotency and failure states in section 5. Legacy multipart path stays until Phase 6.                                                                     |
| `submit-form-completion` (changed) | unchanged entry                       | Same `draftId` support for `mode = 'completion'`.                                                                                                                                                                                                                                                                                                                                           |
| `booking-drafts-admin` (new)       | `serveAdmin` + `verifyPropertyAccess` | `GET` list of `submit_failed` drafts for a property (count + rows), `GET :id` detail with signed URLs, `POST :id/finish-link` mints a resume token and returns the link, `POST :id/dismiss`.                                                                                                                                                                                                |
| `booking-drafts-purge-cron` (new)  | `serveCronPost` + cron secret         | Daily: expire drafts past `expires_at`, delete their staged objects, delete `submitted`/`converted` rows older than 24 h (objects kept, they are booking assets), delete `dismissed`/`expired` rows after 7 days. One summary log line per run, modeled on `identity-captures-purge-cron`. Scheduled via hosted `pg_cron` + `pg_net`, not `config.toml`.                                    |

Shared code goes in `_shared/bookingDraftService.ts` (load/own/upsert/allowlist/files/expire) and
`_shared/guestFormErrors.ts` (section 4). All new functions get explicit JWT policy entries in
`supabase/config.toml`.

### 4. Error taxonomy (server and client)

New `_shared/guestFormErrors.ts` defines one code list used by `submit-form`, `submit-form-completion`
and the draft endpoints. Every rejection returns:

```json
{
  "success": false,
  "error": "<legacy string, unchanged for one release>",
  "code": "DATES_UNAVAILABLE",
  "retryable": false,
  "step": "stay",
  "field": "checkInDate",
  "message": "Those dates were just booked.",
  "requestId": "..."
}
```

| Code                                                | HTTP      | Retryable       | Client behaviour                                                          |
| --------------------------------------------------- | --------- | --------------- | ------------------------------------------------------------------------- |
| `BOOKING_OVERLAP`, `DATES_BLOCKED`                  | 409       | no              | Jump to Stay step, field error on dates, refetch booked dates             |
| `CLEANING_BUFFER`                                   | 409       | no              | Jump to Stay step, field error on the time                                |
| `POLICY_CHANGED`                                    | 409       | no              | Existing flow: refetch policy, clear checkbox                             |
| `POLICY_NOT_ACCEPTED`                               | 400       | no              | Focus the checkbox                                                        |
| `PROPERTY_CLOSED`                                   | 409       | no              | Closed screen (`GuestBookingsClosedNotice`)                               |
| `GUEST_FORM_LOCKED`                                 | 409       | no              | Existing locked hint                                                      |
| `VOUCHER_*`                                         | 409       | no              | Voucher picker error, keep the rest                                       |
| `FIELD_INVALID` (server format checks, party rules) | 422       | no              | Jump to the step for `field`                                              |
| `FILE_MISSING`, `FILE_TOO_LARGE`, `FILE_TYPE`       | 422       | no              | Jump to the upload slot                                                   |
| `ANTI_SPAM`, `RATE_LIMITED`                         | 403 / 429 | yes, after wait | Existing anti-spam copy, auto retry once after `Retry-After`              |
| `MAINTENANCE`                                       | 503       | yes             | Saved panel, "Try again later"                                            |
| `SERVER_FAULT` (anything unclassified)              | **500**   | yes             | Saved panel (section 6). Now reaches client Sentry via `publicEdgeFetch`. |

Client: `ui/src/features/guest/form/lib/guestFormSubmitErrors.ts` maps `code` (falling back to the
legacy string parse for one release) to `{ kind: 'fixable' | 'retryable' | 'closed', step, field, title, description }`.
The 140-line `if/else` chain in `GuestForm.tsx#onSubmit` collapses into one call.

### 5. Submit flow v2 and idempotency

Client, on Submit:

1. Flush the pending draft save (await the PUT).
2. Wait for every required slot's upload to be `uploaded`. Slots still uploading show progress on
   the button ("Uploading photos 2 of 3"). A slot that failed shows **Retry** inline on that slot.
3. `antiSpam.collect()` then POST `submit-form` with `draftId`, text fields and anti-spam fields.
   No file parts.
4. On a **transport failure** (status 0, timeout, WebView killed the request): GET the draft. If
   `status = 'submitted'`, go to the success page. The server saved and only the response was lost.

Server, in `submit-form` with `draftId`:

1. If `draft.status = 'submitted'` and `submitted_booking_id = draftId`: return the same success
   payload (`alreadySubmitted: true`, fresh `guestAccessToken`). No second email, Telegram or notification.
2. Take a lease: `update booking_drafts set status='submitting', submitting_until=now()+'60s', submit_attempts=submit_attempts+1
where id=$1 and guest_user_id=$2 and (status in ('open','submit_failed') or submitting_until < now())`.
   Zero rows updated means another tab is submitting: return 409 `SUBMIT_IN_PROGRESS` (client waits
   and polls the draft).
3. Run today's pipeline unchanged (lifecycle, overlap, cleaning buffer, policy snapshot, voucher,
   `processFormData`) with file URLs from the draft. The primary key on `guest_submissions.id = draftId`
   is the final duplicate backstop.
4. Success: `status='submitted'`, `submitted_booking_id=draftId`.
5. Guest-fixable code: `status='open'`, `last_error_code` set. **No host notification.**
6. Fault: `status='submit_failed'`, `last_error_code`, `last_error_request_id`. On the **first**
   fault for this draft only (`host_notified_at is null`): `createNotification` type
   `booking_draft_submit_failed` (dedupe key `{draftId}:submit_failed`) and a Telegram admin line,
   then set `host_notified_at`. `captureFaultIfServerError` with tags `draft_id`, `property_id`,
   `code`, no PII.

The client keeps `currentBookingId = draft.id` across reloads (restored from the server draft or the
local cache), which fixes bug 4 even before the server draft ships (Phase 0 stores it locally).

### 6. Guest UX

**Restore (replaces the 15 second toast).** When a draft exists, the form restores it automatically
once the property and prefill have settled (same ordering guard as today, so it never races the
`bookingId` reset paths). A small inline banner above the stepper says
"Your details are saved." with a **Start over** link (confirm dialog, then `DELETE`). The form opens
on the furthest step that still validates.

Restore rules:

- Pick the newest of server `updated_at` and local `savedAt`. If local is newer, push it up.
- Photos: show previews from signed URLs immediately, then fetch each into a `File` in the background
  (reusing `fetchImageAsFile`, the same path `?bookingId=` edits use today) so the Zod schema and
  step validation stay unchanged. A `WeakMap<File, StagedRef>` marks restored files as already
  uploaded so they are never sent again.
- Dates now unavailable (booked or blocked since): keep everything else, clear the dates, show the
  field error, land on the Stay step.
- Check-in date in the past: clear dates, keep guest details.
- Cancellation checkbox restores only if `policy_hash_accepted` equals the live hash.
- Voucher no longer eligible: clear it with a short note.

**Uploads.** Each upload slot shows a quiet status: uploading (progress ring), saved (check), failed
(Retry). Upload starts right after pick and compression. Exponential backoff, 3 automatic tries,
then manual Retry. The guest can keep filling other steps while photos upload.

**Save triggers.** Debounced 1.5 s after a change, immediately on **Next**, and on
`visibilitychange: hidden` / `pagehide` via `fetch(..., { keepalive: true })` (keepalive allows the
auth header and our payload stays well under the 64 KB keepalive limit). This is what catches
"guest switched back to Messenger and the app killed the WebView".

**Failure panel (replaces the toast and the copy button).** For retryable codes the last step shows
an inline card, not a toast:

- Title: "We couldn't send your request"
- Body: "Your details and photos are saved. We've let the host know."
- Primary: **Try again** (one automatic retry already happened for transport failures)
- Secondary: **Message the host**: starts or resumes the property web chat
  (`guest-web-chat-start` / `guest-web-chat-resume`, already used by `guestChatApi.ts`) with a
  prefilled line such as "Hi, my booking request for Dec 12 to 14 didn't go through. Ref 7F3A."
  The host opens the saved request from the reference. No PII dump in chat.
- Small text: "Ref 7F3A" (first 4 of the draft id) for phone or Messenger conversations.

All strings go through the `human-copy` skill at implementation time; the lines above are drafts.

**Reserve modal.** The property-detail Reserve modal (`GuestBookingFormModal`, guest-authenticated
embed) uses the same server draft key, so a guest who starts in the modal and later opens the full
`/form` page continues the same draft. The admin embed (`skipAuthGate`) never uses server drafts.

**In-app browsers (Messenger, Facebook, Instagram).**

- Auth modal: if `detectPlatform` says in-app, lead with the email code and hide or replace Google
  sign-in (Google blocks OAuth in WebViews). Confirm on device first.
- Optional small hint on the first step: "Opening in your browser works best" with the platform's
  way to do it (Android: intent link to Chrome; iOS: the "..." menu). Because progress is on the
  account, switching browser now loses nothing. This hint is the one place extra copy is justified.

### 7. Host UX

**Where.** Property **Bookings** list (`BookingsListPage.tsx`) gets a **Needs attention** entry
(count chip next to the existing filters, hidden at zero). It lists `submit_failed` drafts:
guest name, stay dates, guests, last tried (relative), plain reason ("Our system had a problem",
never raw errors), and a doc completeness hint (3 of 3 photos).

**Detail sheet** (bottom sheet on phone, side sheet on desktop, per `mobile-native-ui.mdc`):
read-only summary, contact details, photo thumbnails via signed URLs, attempts and last request id
(copyable, for support). Actions:

| Action               | Behaviour                                                                                                                                                                                                                                                                              | Permission      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **Send finish link** | Mints a 14-day single-claim resume token, returns `/properties/:slug/form?draft=<id>&t=<token>`. Copy button, plus "Open conversation" when an inbox thread exists for the guest. The guest opens it, signs in, the draft is claimed and restored.                                     | bookings view   |
| **Create booking**   | Opens `AdminNewBookingModal` prefilled from the draft, photos included (staged refs, nothing re-uploaded). Submit goes through the same `submit-form` path with `draftId` and the host session; the draft becomes `converted`. Overlap, cleaning buffer and capacity checks still run. | bookings create |
| **Dismiss**          | Marks `dismissed`, removes from the list. Staged photos are purged by the cron.                                                                                                                                                                                                        | bookings edit   |

Notifications: in-app `booking_draft_submit_failed` (group `bookings`, push eligible), Telegram
admin line. Deep link opens the detail sheet.

**Parking.** Parking registration has its own form and edge path. Out of scope for v1; the shared
service and UI are built so parking can adopt them later (follow-up item, not silent).

### 8. Retention and privacy

- Open drafts expire **14 days after the last update** (`expires_at` bumped on every write), or at
  check-out date plus 1 day, whichever is first. Expired drafts lose their row and staged photos.
- Submitted or converted: row deleted after 24 h; photos stay because the booking owns them.
- Dismissed: purged after 7 days.
- Start over and account deletion remove everything immediately.
- Local IndexedDB cache keeps the existing 7-day TTL and is wiped by `purgeOfflineState` on sign-out.
- Guests see one short line near the banner the first time a draft saves: "We save your progress
  to your account." Privacy notice (`legal` route) gets a sentence about saved booking progress and
  the 14-day retention. Check against RA 10173 (Data Privacy Act) wording already in the notice.
- No PII in Sentry, PostHog or Telegram beyond what the existing new-booking Telegram line already sends.

### 9. Observability

- PostHog: `guest_form_draft_restored` (source: server or local, photo count),
  `guest_form_upload_failed` (slot, attempt, reason), `guest_form_submit_failed` (code, retryable),
  `guest_form_submit_recovered` (succeeded after at least one failure), `booking_draft_converted`,
  `booking_draft_finish_link_sent`. No per-keystroke events.
- Sentry: faults now return 5xx, so `publicEdgeFetch` and `captureFaultIfServerError` both see them.
  Alert rule: more than 3 `submit-form` 5xx in 10 minutes (create with the Sentry alert tooling at
  implementation time).
- Ops report (`ops-report-cron`): count of `submit_failed` drafts older than 24 h with no host action.
- `/admin/health` (super admin): optional tile with the same count. No cross-org PII console.

### 10. Security

- Draft endpoints require the guest JWT and `guest_user_id = auth uid`. Draft ids are UUIDs but
  ownership is what authorizes, never knowledge of the id.
- Host endpoints: `verifyAdminJwt` / `verifyPropertyAccess` with the bookings permission leaves,
  scoped to the draft's `property_id`.
- Resume token: random 32 bytes, stored hashed, 14-day expiry, single claim, revoked on dismiss or
  convert. Same trust level as today's completion links (`issue-guest-form-completion-token`).
- Uploads: server-built paths, MIME sniff, size ceilings from `_shared/uploadLimits.ts`, per-draft
  object cap, per-user rate limit. Turnstile stays on submit only.
- `submit-form` re-verifies every staged path prefix and existence. A draft cannot point at another
  booking's files.
- Run the `security-auditor` agent over the new endpoints before merge.

## Phases

Each phase ships on its own and leaves the form working. Phases 1 to 4 sit behind a feature
availability flag (existing `feature-availability-controls`) so production can fall back to the
legacy path instantly.

### Phase 0: quick wins and device checks (no schema change)

- Fix bugs 1 and 2 (lowercase codes) and return 5xx for unclassified faults (bug 3).
- Add `guestFormErrors.ts` + client `guestFormSubmitErrors.ts`; replace the `if/else` chain;
  fixable errors jump to the right step and field.
- Persist the new-booking UUID in the local draft and reuse it on restore (bug 4).
- Save file blobs in the existing IndexedDB draft (`useOfflineFormDraft` already supports `files`).
- Auto-restore with the inline banner and Start over, replacing the 15 second toast.
- `pagehide` / `visibilitychange` flush of the local draft.
- Device test matrix (below) on the current build to record baseline behaviour, including Google
  sign-in inside Messenger. Write results to the plan's evidence notes.

Done when: closed-listing and policy errors show the right UI; a reload restores text and photos on
Android Messenger and desktop browsers; a reload after a lost response does not create a second booking.

### Phase 1: server draft for text

- Migration for `booking_drafts`, `bookingDraftService.ts`, `guest-booking-draft` (GET/PUT/DELETE).
- Client sync hook `useGuestBookingDraft` (server plus local, newest wins, revision handling,
  keepalive flush), wired into `GuestForm` for the public route and the Reserve modal.

Done when: fill steps 1 to 3 in iOS Messenger, force close, reopen the link, sign in: text restored on step 3.

### Phase 2: staged uploads

- `guest-booking-draft-upload`, per-slot upload queue with retry and progress, previews from signed
  URLs, background `File` hydration, `WeakMap` staged markers, slot replace and delete.

Done when: pick 3 photos in iOS Messenger, force close, reopen: all 3 previews back, Continue enabled.

### Phase 3: draft-based submit and failure handling

- `submit-form` / `submit-form-completion` `draftId` branch, lease, idempotent replay, status
  updates, first-fault host notification, Telegram line, Sentry tags.
- Client submit v2 (flush, wait for uploads, transport-failure status check), failure panel,
  Message the host, remove **Copy Booking Information** from the guest path.

Done when: forced 500 shows the saved panel, host gets one notification, Try again succeeds after the
fault is cleared; killing the network after the server commits still lands on the success page; ten
rapid retries produce exactly one booking.

### Phase 4: host Needs attention

- `booking-drafts-admin`, Bookings list entry and count, detail sheet, Send finish link, claim
  endpoint and `?draft=&t=` handling in `GuestForm`, Create booking via `AdminNewBookingModal`
  prefill, Dismiss.

Done when: a host with bookings view sees the failed request, sends the link, the guest finishes it on
another device; a host with bookings create converts one into a real booking with photos attached.

### Phase 5: retention, observability, docs

- `booking-drafts-purge-cron` + pg_cron schedule + secret, PostHog events, Sentry alert, ops report
  count, privacy notice line, all docs and support content listed below.

### Phase 6: cleanup (one release after Phase 3 is stable)

- Remove the legacy multipart file path from the public guest submit (keep `processFormData` file
  handling for the admin embed if it still needs it, otherwise move it to staged uploads too).
- Remove the legacy string error field and `formatBookingInfoForClipboard` from the guest path.
  Keep `parseBookingInfoFromClipboard` only if dev paste still uses it.

## Testing

| Level                                                 | Coverage                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deno (`_shared/*_test.ts`)                            | `bookingDraftService`: ownership, allowlist, 32 KB cap, revision conflict, expiry bump. `guestFormErrors`: every code maps to status and retryable. Staged path verification (wrong prefix, missing object, other draft). Lease: concurrent submits, expired lease takeover. Idempotent replay sends no second notification. |
| Deno handlers (`functions/tests/*.test.ts`)           | `submit-form` with `draftId`: success, fixable rejection keeps `open`, fault sets `submit_failed` and notifies once, already-submitted replay. Upload endpoint: MIME spoof, oversize, object cap. Claim: valid, expired, reused token.                                                                                       |
| Vitest                                                | `guestFormSubmitErrors` mapping incl. legacy fallback; draft merge (server vs local newest, stale revision); upload queue backoff; restore rules (past dates, unavailable dates, policy hash, voucher).                                                                                                                      |
| Playwright mocked E2E (`ui/e2e/features/guest-form/`) | Fill, reload, restored on the right step with photo previews; submit 500 shows saved panel, retry succeeds; aborted response then draft says submitted, lands on success; `PROPERTY_CLOSED` shows closed screen; host Needs attention list, detail, finish link, dismiss.                                                    |
| Manual device matrix                                  | iOS Messenger, Android Messenger, Facebook app, Instagram, iOS Safari, Android Chrome, desktop Chrome. Cases: force close mid-form, phone reboot, switch to external browser, airplane mode during upload, airplane mode during submit, sign in with Google vs email code inside Messenger.                                  |

Gates per phase: `bun run ci:quality` (lint, type-check, unit, edge, smoke E2E, build), plus
`check:filenames`. Note: `.test.tsx` component tests are silently skipped by the Vitest config, so
UI logic under test lives in `.ts` modules.

## Required checklists at implementation time

- **Plans:** N/A. Saved progress and recovery are reliability, available on every tier.
- **RBAC:** reuse the existing bookings view / create / edit leaves for Needs attention, Create
  booking and Dismiss. Confirm exact leaf names in the permission catalog; no new leaves expected.
- **activity-log:** `booking_draft.submit_failed` (actor `public_form`, once per draft),
  `booking_draft.converted`, `booking_draft.finish_link_sent`, `booking_draft.dismissed` (actor host).
  Guest autosave and uploads: N/A (not org state, would flood the log).
- **unsaved-changes-guard:** the form keeps `useUnsavedChangesGuard`, but once the server draft is
  confirmed saved the guard can relax to "your progress is saved" (decide in Phase 1, the guard is
  still correct when a save is pending).
- **mobile-responsive:** upload slot states, saved panel, restore banner, host detail sheet as a
  bottom sheet, Needs attention chip at 375 / 768 / 1024.
- **human-copy:** every new string.

## Docs to update in the same changes

| Doc                                                                 | Change                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `docs/guides/routes/form.md`                                        | Saved progress, restore rules, uploads, submit v2, failure panel, finish link, error codes |
| `docs/guides/routes/org/property/` bookings list guide              | Needs attention list, detail sheet, actions, permissions                                   |
| `docs/architecture/overview.md` + `docs/PROJECT.md`                 | `booking_drafts`, new endpoints, cron, secret, env flag                                    |
| `docs/architecture/pwa.md`                                          | Drafts are now server-backed with a local cache; offline submit stance unchanged           |
| `docs/architecture/routing.md` (line about copy booking info)       | Replace with the saved-request flow                                                        |
| `docs/archive/operations/migration-runbook.md` + scheduled jobs doc | Migration, pg_cron schedule, cron secret                                                   |
| `docs/guides/support/faqs.md` + Host-facing knowledge               | "My booking didn't go through", "What is Needs attention", "How long is progress kept"     |
| Legal privacy notice                                                | Saved booking progress and retention                                                       |

Then run `check:support-content` and `check:ai-knowledge-coverage`.

## Risks and mitigations

| Risk                                                  | Mitigation                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Autosave load on the edge and DB                      | Debounce, write only on change, per-user rate limit, small JSON. Roughly one write per 10 to 20 seconds of active typing per guest. |
| Two devices editing at once                           | Revision check returns the newer copy; client keeps the newer one and tells the guest once.                                         |
| Staged photos never submitted pile up                 | 14-day expiry, purge cron with heartbeat, object cap per draft.                                                                     |
| Restore hydration downloads photos on slow data       | Previews come from signed URLs first; `File` hydration runs in the background and only blocks Submit, not navigation.               |
| Host sees a "failed" request the guest then completes | Draft flips to `submitted`; Needs attention updates; notification body links to the booking instead.                                |
| Flagged rollout split-brain                           | One flag gates client and server draft paths together; legacy path untouched until Phase 6.                                         |
| Google sign-in dead end in Messenger                  | Phase 0 device check, then email-code-first in in-app browsers.                                                                     |

## Open questions

1. Should hosts also see **abandoned** drafts (guest reached the Payment step but never pressed
   Submit) as leads? Higher conversion value, but it shows data the guest never chose to send.
   Default in this plan: **no**, only drafts the guest tried to submit.
2. Retention: 14 days after last edit is the default. Shorter (7) is safer for PII, longer helps
   guests who plan weeks ahead.
3. Should parking registration adopt the same model in the same project or as a follow-up?
   Default: follow-up.

## Sources

- Supabase Storage signed uploads (considered for direct uploads, not chosen for v1):
  [createSignedUploadUrl](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl),
  [uploadToSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl)
- iOS WebView storage loss on force close or reboot (third-party report):
  [Shopify community thread](https://community.shopify.com/t/shopify-mobile-and-pos-local-storage-cleared-on-ios-after-reboot-for-embedded-apps/29250),
  [Apple Developer Forums: IndexedDB in WebView](https://developer.apple.com/forums/thread/750682)
- Late localStorage commits lost on app exit: [Mozilla bug 1536797](https://bugzilla.mozilla.org/show_bug.cgi?id=1536797)
