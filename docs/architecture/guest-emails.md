---
title: 'Guest lifecycle emails — one table'
status: active
tags: [docs, architecture, emails, guest]
updated: 2026-11-11
---

# Guest lifecycle emails

Every email a guest can receive, what triggers it, and where its button goes. The point is to
answer "does this guest get an email, and does it lead somewhere useful?" without reading
`emailService.ts`.

Source of truth for wording: `_shared/propertyTemplates.ts` (`BUILTIN_TEMPLATES`). Hosts edit the
bodies in **Templates**; a property without a saved row uses the default below.

## The table

| #   | Email                        | Template key                                    | Trigger                                                                   | Sender                           | Default subject                             | Primary CTA          | Link                                                              |
| --- | ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------- | -------------------- | ----------------------------------------------------------------- |
| 1   | Request received             | `email-booking-request-received`                | `submit-form`, genuine new submission                                     | `sendBookingRequestReceived`     | `{unit} - Booking Request Received {dates}` | View your booking    | Trip page (button inside the flow section)                        |
| 2   | Booking acknowledgement      | `email-booking-acknowledgement`                 | Host moves `PENDING_REVIEW` → `PENDING_DOCUMENTS`                         | `sendBookingAcknowledgement`     | `{unit} - Booking Acknowledgement {dates}`  | View your booking    | Trip page (button inside the flow section)                        |
| 3   | Ready for check-in           | `email-ready-for-checkin`                       | Host moves to `READY_FOR_CHECKIN`                                         | `sendReadyForCheckin`            | `{unit} - Check-in details {dates}`         | View your booking    | Trip page (`{{trip_cta_section}}`), then the stay guide           |
| 4   | SD refund form request       | `email-sd-refund-form-request`                  | Host moves to `READY_FOR_CHECKOUT` or `PENDING_SD_REFUND`; SD refund cron | `sendSdRefundFormRequest`        | `{unit} - Check-out and deposit refund`     | Check-out and refund | SD form (`{{sd_form_url}}`), then the trip                        |
| 5   | Booking cancelled (guest)    | `email-booking-cancelled-guest`                 | Booking becomes `CANCELLED`                                               | `sendBookingCancelledGuest`      | `{unit} - Booking cancelled`                | View your booking    | Trip page (`{{trip_cta_section}}`)                                |
| 6   | Cancellation request (guest) | `email-cancellation-request-guest`              | Guest requests, host responds                                             | `sendCancellationRequestGuest`   | per state                                   | View your booking    | Trip page (`{{trip_cta_section}}`)                                |
| 7   | Refund sent (guest)          | `email-refund-sent-guest`                       | Host records the refund                                                   | `sendRefundSentGuest`            | `{unit} - Refund sent`                      | View your booking    | Trip page (`{{trip_cta_section}}`)                                |
| 8   | Guest chat reply             | `guest-chat-reply`                              | Host replies in a web chat thread                                         | `maybeNotifyGuestOfHostWebReply` | `New message - {property}`                  | View conversation    | The thread when it is tied to a booking, else `/account/messages` |
| 9   | Review request / reminder    | `review-notice`                                 | Review window opens / closes soon                                         | `reviewLifecycle`                | per state                                   | Leave a review       | Trip page review action                                           |
| 10  | Pre-arrival reminder         | `email-booking-acknowledgement` (body override) | `pre-arrival-reminders` cron, T-48h                                       | `preArrivalReminderCron`         | `{unit} - Check-in in 2 days`               | View your booking    | Trip page (`{{trip_cta_section}}`)                                |

Host-only mail (new booking alert, GAF / pet / parking requests to the building) is not in this
table. **New booking alert** goes to the team, not the guest.

## Rules that must hold

1. **One primary CTA per guest email**, and it opens the trip page or the specific action.
2. **Works without signing in.** Trip and stay guide links carry a booking access token.
3. **`{{trip_cta_section}}` is the default trip button.** A body that places `{{trip_url}}` itself
   suppresses it, so a guest never sees two links to the same place
   (`renderPropertyTemplateSendEmail`).
4. **Requirement-aware.** Nothing says GAF, pet approval or building administration unless this
   property actually requires that document for this booking. The acknowledgement asks
   `resolveDocumentRequirements` and lists only what applies.
5. **Vocabulary.** Status words match `_shared/guestJourneyCopy.ts`: "Request sent", "Confirmed",
   "Ready for check-in", "Checked out", "Deposit refund", "Completed", "Cancelled". A pending
   review is never "confirmed".
6. **Suppression wins.** `email_suppressions` (bounce / complaint) is checked before every guest
   send. A per-property automation toggle can turn a type off; `emailNewBookingRequest` is the
   ops alert and stays free.
7. **Send-once.** `guest_submissions.request_received_emailed_at` records when the request
   email went out, so support can answer "did the guest get a receipt?". The reminder's
   `pre_arrival_emailed_at` is the idempotency key: the candidate query skips a stamped row,
   so a sequential retry does not resend. The stamp is written after the send, so a failed
   send is retried on the next hourly run rather than being lost.
8. **No secrets.** Wi-Fi passwords and door codes are never emailed unless a host deliberately
   places `{{wifi_password}}`-style text in their own template. The default bodies never do.

## Pre-arrival reminder

`pre-arrival-reminders` runs hourly (hosted `pg_cron` + `pg_net`), picks bookings with
`check_in_date` two days out in Manila, and skips:

- cancelled, completed, or already checked-in bookings,
- bookings that already have `pre_arrival_emailed_at`,
- properties where `emailReadyForCheckin` is off (the reminder is the same conversation).

It sends the acknowledgement template with a reminder body override and the trip CTA, so the
guest lands on the page with the balance, directions and (after the reveal time) the door code.

## Where things live

| Concern          | Path                                                             |
| ---------------- | ---------------------------------------------------------------- |
| Send functions   | `supabase/functions/_shared/emailService.ts`                     |
| Built-in bodies  | `supabase/functions/_shared/propertyTemplates.ts`                |
| Dynamic sections | `supabase/functions/_shared/propertyTemplateEmailSections.ts`    |
| Shell + Resend   | `_shared/propertyTemplateEmail.ts`, `_shared/sendResendEmail.ts` |
| Reminder cron    | `supabase/functions/pre-arrival-reminders/index.ts`              |
| Route guide      | `docs/guides/routes/org/property/templates.md`                   |

## Related

- `docs/guides/routes/org/property/templates.md` — the Templates workbench
- `docs/guides/routes/org/property/notifications.md` — the per-property toggles
- `.cursor/rules/booking-workflow.mdc` — which transitions send which email
