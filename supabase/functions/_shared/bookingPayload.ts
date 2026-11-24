/**
 * Field-level redaction for a booking row returned to a host surface.
 *
 * `get-booking?format=row` reads `guest_submissions` with `select('*')` through the service
 * role, so RLS cannot narrow it. Without this projection every `bookings:view` caller
 * receives the guest's bank account, the door code override and the bearer tokens that
 * unlock guest-facing pages, even when the UI hides them behind an edit leaf
 * (review P2-12, `docs/workflow/in-progress/bookings-ux-review/`).
 *
 * The rule is conservative: a field is returned only when the caller holds the leaf that
 * the UI uses to display it, and the caller's own permission list decides.
 */

/** Fields that only the corresponding edit leaf may receive. */
export const BOOKING_FIELD_LEAVES = [
  {
    permission: 'bookings.detail.pricing:edit',
    fields: ['sd_refund_account_name', 'sd_refund_account_number', 'sd_refund_bank'],
  },
  {
    permission: 'bookings.detail.stay:edit',
    fields: [
      'guest_essentials_override',
      'stay_guide_token',
      'document_share_token',
      'guest_form_token',
    ],
  },
] as const;

/**
 * Returns a copy of `booking` with fields the caller cannot display removed (set to null so
 * the row shape stays stable for the UI).
 *
 * Legacy permission ids (`bookings:edit`, `bookings:workflow`) must already be expanded by
 * the caller — `verifyPropertyAccess` does that — otherwise a legacy id would redact a
 * field the host can legitimately see.
 */
export function redactBookingForPermissions<T extends Record<string, unknown>>(
  booking: T,
  permissions: readonly string[]
): T {
  const granted = new Set(permissions);
  const out: Record<string, unknown> = { ...booking };
  for (const rule of BOOKING_FIELD_LEAVES) {
    if (granted.has(rule.permission)) continue;
    for (const field of rule.fields) {
      if (field in out) out[field] = null;
    }
  }
  return out as T;
}

/** True when the caller holds every field leaf (owner / platform admin path). */
export function holdsFullBookingPayload(permissions: readonly string[]): boolean {
  const granted = new Set(permissions);
  return BOOKING_FIELD_LEAVES.every((rule) => granted.has(rule.permission));
}
