import { describe, expect, it } from 'vitest';

import { canProceedOperatingLineItemFormStep } from '@/features/dashboard/finance/lib/operatingLineItemFormCanProceed';

const base = {
  isLastStep: false,
  formValid: true,
  label: 'Rent',
  category: 'Utilities',
  amount: 100,
  occurredOn: '2026-11-01',
  recurrenceInterval: 'none',
  recurrenceUntil: '',
} as const;

describe('canProceedOperatingLineItemFormStep', () => {
  it('requires label, category, positive amount, and ISO date on details', () => {
    expect(canProceedOperatingLineItemFormStep({ ...base, stepKind: 'details' })).toBe(true);
    expect(
      canProceedOperatingLineItemFormStep({ ...base, stepKind: 'details', amount: 0 })
    ).toBe(false);
    expect(
      canProceedOperatingLineItemFormStep({ ...base, stepKind: 'details', label: '' })
    ).toBe(false);
  });

  it('requires until date when repeating', () => {
    expect(
      canProceedOperatingLineItemFormStep({
        ...base,
        stepKind: 'repeat',
        recurrenceInterval: 'monthly',
        recurrenceUntil: '2027-01-01',
      })
    ).toBe(true);
    expect(
      canProceedOperatingLineItemFormStep({
        ...base,
        stepKind: 'repeat',
        recurrenceInterval: 'monthly',
        recurrenceUntil: '',
      })
    ).toBe(false);
  });
});
