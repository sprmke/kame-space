---
title: 'Audit 03: booking workflow'
status: active
tags: [audit, bookings, workflow]
updated: 2026-11-19
---

# 03: Booking workflow (list → detail → transitions → side effects)

Exercised end to end with a real guest submission (`a0858608-…`, 5 pax, Mar 10-12 2027) and the
seeded rows for every status: `PENDING_REVIEW`, `PENDING_DOCUMENTS`, `PENDING_GAF`,
`PENDING_PARKING_REQUEST`, `PENDING_PET_REQUEST`, `READY_FOR_CHECKIN`, `READY_FOR_CHECKOUT`,
`PENDING_SD_REFUND`, `COMPLETED`, `CANCELLED`, plus the non-canonical `PENDING_HOST_ACCEPTANCE`,
`PENDING_PAYMENT`, `NO_HOST_AVAILABLE`, `IMPORTED`.

---

## P0

### B1. A transition commits the new status, then fails, then tells the admin it failed

Reproduction (real, observed):

1. Guest submits a booking. It lands in `PENDING_REVIEW`.
2. Admin opens the booking, ticks the review acknowledgement, clicks **Proceed to Pending Documents**,
   then **Confirm**.
3. Edge log: status write → `Generating PDF...` → `Error downloading template: Object not found` →
   HTTP **400** `GAF request PDF could not be generated`.
4. DB: `guest_submissions.status = PENDING_DOCUMENTS`, `updated_at` = the moment of the failed call.
5. UI: error toast, page still shows **Pending Review** (no refetch of the failed transition), no
   ack checkbox on reload, and **no `booking.status_changed` activity row**.

So the admin believes nothing happened while the guest pipeline has moved, the GAF request document
does not exist, and the audit trail has a hole. The same ordering risk applies to every transition
with a PDF, email or calendar side effect.

Fix direction: write the status only after the required artifacts succeed, or mark the transition as
"pending artifacts" and return a resumable state (with a visible "retry PDF" action). At minimum,
always emit `booking.status_changed` and refetch the booking regardless of the HTTP outcome.

### B2. Local dev cannot complete the transition at all (see 08)

`templates/guest-form-template.pdf` and `templates/pet-form-template.pdf` are not uploaded by the
seed, so every GAF/pet transition fails with the 400 above on a fresh clone. Manually uploading the
two files from `ui/public/templates` fixes it, which proves the code is fine and the seed is not.

---

## P1

### B3. Opening a booking writes a false "copied a guest trip link" audit event

Loading `/org/…/bookings/:id` as the owner creates
`booking.trip_link_issued` with summary "seed-owner@example.com copied a guest trip link for Yuri
Ibarra". The admin never clicked anything. Confirmed by loading one detail page and diffing
`activity_log` (exactly one new row). The trip-link button probably prefetches the link on mount; the
log call must move to the actual copy/open action.

Impact: the activity feed, org activity modal, super-admin audit views and any future compliance
export all overstate trip-link sharing. This is the kind of event an owner would use to answer "who
sent the guest their trip link?".

### B4. Read-only viewers get interactive workflow controls

See H4. On booking detail a viewer with `*:view` sees the acknowledgement checkbox and an editable
door-code field with Save. Server returns 403. The workflow panel correctly hides Proceed / Cancel /
Return, so only these two controls slipped through.

### B5. Non-canonical statuses are present in data and render as generic states

`PENDING_HOST_ACCEPTANCE`, `PENDING_PAYMENT`, `NO_HOST_AVAILABLE` and `IMPORTED` exist in
`guest_submissions` but are not in the documented 6-step pipeline. Two of them (booking `Icko`,
`Hazel`) appear in the dashboard "Recent Bookings" with "Finding host" and "No host" pills, and in
the bookings table with no explanation. Decide whether these are a marketplace track (real feature,
needs docs and a stepper) or legacy rows (needs a migration to a canonical status).

### B6. Booking edit is a hidden second workflow surface

"Edit booking" opens a large form whose saving rules mirror the guest form, including the
"workflow-sensitive field" revert to `PENDING_REVIEW`. The revert notice only appears while the draft
differs from the server, so a host who edits and saves in one go never sees that the status will
reset until after the fact. Show the consequence in the save button area ("Save and return to Pending
Review") before the save, not as an alert inside the form.

---

## P2

### B7. The step deck's chevrons look interactive but are not

Every status shows "<" and ">" either side of the current step name. They read as "previous/next
step" but do nothing (or are disabled with no visual difference). Either remove them or make them
navigate the step _map_ (the top-right icon already opens a full map).

### B8. "Still open" lines are ambiguous

"Still open: Balance receipt" and "Still open: Balance receipt, Check-in documents" on the Guest view
card list things the _guest_ still owes, but the phrasing reads like an internal to-do. Link each
item to the action that resolves it.

### B9. Confirm modal copy is excellent but not reused elsewhere

The transition confirm lists exactly what will happen ("Creates the GAF request document", "Emails
building management…") and, for past-dated stays, per-email checkboxes default to off. This is the
best pattern in the app. Cancel booking, Pause/Archive property and plan downgrade should use the
same "This will:" list instead of a generic confirmation.

### B10. Cancelled bookings lose the stepper entirely

`CANCELLED` removes the stepper and shows a status strip, but the "Return to …" recovery path that
other statuses have is gone. If a cancellation can be undone (or if it can't), say so explicitly.

### B11. The pricing card is hidden until review, then appears mid-page

While `PENDING_REVIEW` the pricing card is hidden (by design), so the page height and layout jump
after the ack checkbox is ticked. On mobile this puts the Proceed button below a newly inserted card.

### B12. Nested document progress mixes "4 of 6" and "0 of 1"

`PENDING_DOCUMENTS` shows "SENT DOCS 4 of 6" and "PENDING DOCS 0 of 1" side by side with no
indication of what happens when both are complete. Guests' valid IDs (5) count towards one group
while the approved GAF is a separate group.

### B13. Booking detail auto-refresh can wipe an in-progress edit

The page refetches every ~15s. If the host is typing in the pricing form when a refetch returns, the
values are replaced. (Observed as a form reset during a slow confirm; hard to reproduce reliably, but
the risk is structural.)

---

## P3

- `LOCAL_SEED` badge is shown to hosts in the booking header. It is useful locally; make sure it
  cannot reach production data (or rename it to something a host would understand).
- The "..." overflow menu on the booking header has no visible label or tooltip.
- The Files tab shows only text buttons ("Downpayment receipt", "Valid ID") with an external-link
  icon; no thumbnail, no file name, no size, no upload date.
- The Activity tab is a plain list; it does not show the new `booking.status_changed` events (they
  were missing entirely in this run) and has no filter.

---

## What works

- The stepper, nested sub-steps, and the "single next action" CTA are clear. Each stage explains what
  is missing before allowing progress.
- Past-dated stay handling (amber banner plus per-email opt-in checkboxes, default off) is
  thoughtful and prevents accidental re-sends.
- Parking and pet requirements are derived from property settings; stages disappear when disabled.
- The review gate (acknowledge before pricing/actions) prevents accidental transitions.
- Confirmation dialogs summarise side effects in plain language.
- Guest view, stay details, cancellation policy with exact deadline, guest reputation and door code
  are grouped logically.

---

## Coverage

| Surface                                                                       | Desktop | Mobile | Notes                |
| ----------------------------------------------------------------------------- | ------- | ------ | -------------------- |
| `/org/…/bookings` table                                                       | yes     | yes    | card view on phone   |
| `/org/…/bookings?view=kanban`                                                 | yes     | yes    |                      |
| `/org/…/bookings?view=calendar`                                               | yes     | yes    |                      |
| Booking detail `PENDING_REVIEW`                                               | yes     | yes    | transition attempted |
| `PENDING_DOCUMENTS`                                                           | yes     | yes    | nested GAF / parking |
| `PENDING_GAF`, `PENDING_PET_REQUEST`, `PENDING_PARKING_REQUEST`               | yes     | yes    | seeded rows          |
| `READY_FOR_CHECKIN`                                                           | yes     | yes    |                      |
| `READY_FOR_CHECKOUT`                                                          | yes     | yes    |                      |
| `PENDING_SD_REFUND`                                                           | yes     | yes    |                      |
| `COMPLETED`                                                                   | yes     | yes    |                      |
| `CANCELLED`                                                                   | yes     | yes    |                      |
| `PENDING_HOST_ACCEPTANCE`, `PENDING_PAYMENT`, `NO_HOST_AVAILABLE`, `IMPORTED` | yes     | yes    | non-canonical        |
