import type { MaintenanceItemFormStep } from '@/features/dashboard/maintenance/lib/maintenanceItemFormSteps';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type MaintenanceItemFormCanProceedInput = {
  stepKind: MaintenanceItemFormStep['kind'];
  isLastStep: boolean;
  /** Full-form validity (Zod) — used on preview / last step. */
  formValid: boolean;
  label: string;
  category: string;
  scheduledOn: string;
  recurrenceInterval: string;
  recurrenceUntil: string;
  /** When false, repeat fields are hidden (one-off edit). */
  showRepeat: boolean;
};

/**
 * Whether Next / Save should stay enabled for the active maintenance wizard step.
 * Mirrors finance `OperatingLineItemForm` gating: values-based, no janky chase of
 * RHF `errors` (those still drive red borders after touch / failed Next).
 */
export function canProceedMaintenanceItemFormStep(
  input: MaintenanceItemFormCanProceedInput
): boolean {
  if (input.stepKind === 'preview' || input.isLastStep) {
    return input.formValid;
  }

  if (input.stepKind === 'details') {
    const label = input.label.trim();
    const category = input.category.trim();
    return label.length > 0 && category.length > 0 && ISO_DATE.test(input.scheduledOn);
  }

  if (input.stepKind === 'reminders') {
    if (!input.showRepeat) return true;
    if (input.recurrenceInterval === 'none') return true;
    if (!ISO_DATE.test(input.recurrenceUntil)) return false;
    return input.recurrenceUntil >= input.scheduledOn;
  }

  return true;
}
