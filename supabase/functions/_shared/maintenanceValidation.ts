/**
 * Shared field validation for maintenance-items POST / PATCH.
 *
 * The browser schema (`MaintenanceItemForm`) is not a security boundary: the endpoint is
 * callable with any JWT, so the same limits have to hold here. POST and PATCH used to
 * diverge (POST checked the date, PATCH only sliced it).
 */

export const MAINTENANCE_LIMITS = {
  label: 200,
  category: 80,
  notes: 2000,
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type MaintenanceItemFieldsInput = {
  label: string;
  category: string;
  scheduledOn?: string;
  notes?: unknown;
  recurrenceUntil?: string | null;
};

/** Returns an error message, or null when the fields are valid. */
export function validateMaintenanceItemFields(input: MaintenanceItemFieldsInput): string | null {
  if (!input.label || !input.category) return 'Invalid fields';
  if (input.label.length > MAINTENANCE_LIMITS.label) {
    return `Label must be ${MAINTENANCE_LIMITS.label} characters or fewer`;
  }
  if (input.category.length > MAINTENANCE_LIMITS.category) {
    return `Category must be ${MAINTENANCE_LIMITS.category} characters or fewer`;
  }
  if (typeof input.notes === 'string' && input.notes.length > MAINTENANCE_LIMITS.notes) {
    return `Notes must be ${MAINTENANCE_LIMITS.notes} characters or fewer`;
  }
  if (input.scheduledOn !== undefined && !ISO_DATE.test(input.scheduledOn)) {
    return 'Valid scheduled date required';
  }
  if (input.recurrenceUntil && !ISO_DATE.test(input.recurrenceUntil)) {
    return 'Valid repeat end date required';
  }
  return null;
}
