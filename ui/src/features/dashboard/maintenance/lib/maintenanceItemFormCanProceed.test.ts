import { describe, expect, it } from 'vitest';

import { canProceedMaintenanceItemFormStep } from '@/features/dashboard/maintenance/lib/maintenanceItemFormCanProceed';

const base = {
  isLastStep: false,
  formValid: true,
  label: 'Inspect seals',
  category: 'Safety',
  scheduledOn: '2026-11-30',
  recurrenceInterval: 'none',
  recurrenceUntil: '',
  showRepeat: true,
} as const;

describe('canProceedMaintenanceItemFormStep', () => {
  it('blocks details when label or category is empty', () => {
    expect(canProceedMaintenanceItemFormStep({ ...base, stepKind: 'details', label: '  ' })).toBe(
      false
    );
    expect(canProceedMaintenanceItemFormStep({ ...base, stepKind: 'details', category: '' })).toBe(
      false
    );
    expect(canProceedMaintenanceItemFormStep({ ...base, stepKind: 'details' })).toBe(true);
  });

  it('requires a valid ISO date on details', () => {
    expect(
      canProceedMaintenanceItemFormStep({
        ...base,
        stepKind: 'details',
        scheduledOn: '11/30/2026',
      })
    ).toBe(false);
  });

  it('requires an end date on or after the start when repeating', () => {
    expect(
      canProceedMaintenanceItemFormStep({
        ...base,
        stepKind: 'details',
        recurrenceInterval: 'monthly',
        recurrenceUntil: '',
      })
    ).toBe(false);
    expect(
      canProceedMaintenanceItemFormStep({
        ...base,
        stepKind: 'details',
        recurrenceInterval: 'monthly',
        recurrenceUntil: '2026-10-01',
      })
    ).toBe(false);
    expect(
      canProceedMaintenanceItemFormStep({
        ...base,
        stepKind: 'details',
        recurrenceInterval: 'monthly',
        recurrenceUntil: '2027-01-01',
      })
    ).toBe(true);
  });

  it('skips repeat validation when repeat is hidden or off', () => {
    expect(
      canProceedMaintenanceItemFormStep({
        ...base,
        stepKind: 'details',
        showRepeat: false,
        recurrenceInterval: 'monthly',
        recurrenceUntil: '',
      })
    ).toBe(true);
    expect(
      canProceedMaintenanceItemFormStep({
        ...base,
        stepKind: 'details',
        recurrenceInterval: 'none',
        recurrenceUntil: '',
      })
    ).toBe(true);
  });

  it('uses formValid on preview / last step', () => {
    expect(
      canProceedMaintenanceItemFormStep({
        ...base,
        stepKind: 'preview',
        formValid: false,
      })
    ).toBe(false);
    expect(
      canProceedMaintenanceItemFormStep({
        ...base,
        stepKind: 'details',
        isLastStep: true,
        formValid: false,
        label: '',
      })
    ).toBe(false);
  });
});
