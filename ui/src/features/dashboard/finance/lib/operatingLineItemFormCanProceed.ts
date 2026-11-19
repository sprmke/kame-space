const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type OperatingLineItemFormCanProceedInput = {
  stepKind: 'details' | 'repeat' | 'reminders' | 'preview' | string;
  isLastStep: boolean;
  formValid: boolean;
  label: string;
  category: string;
  amount: number;
  occurredOn: string;
  recurrenceInterval: string;
  recurrenceUntil: string;
};

/**
 * Values-based gate for Finance operating-line Next / Save.
 * Kept pure so wizard footers stay in sync without waiting on RHF error state.
 */
export function canProceedOperatingLineItemFormStep(
  input: OperatingLineItemFormCanProceedInput
): boolean {
  if (input.stepKind === 'preview' || input.isLastStep) {
    return input.formValid;
  }

  if (input.stepKind === 'details') {
    const label = input.label.trim();
    const category = input.category.trim();
    const amount = Number(input.amount);
    return (
      label.length > 0 &&
      category.length > 0 &&
      Number.isFinite(amount) &&
      amount > 0 &&
      ISO_DATE.test(input.occurredOn)
    );
  }

  if (input.stepKind === 'repeat') {
    if (input.recurrenceInterval === 'none') return true;
    if (!ISO_DATE.test(input.recurrenceUntil)) return false;
    return input.recurrenceUntil >= input.occurredOn;
  }

  return true;
}
