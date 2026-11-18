import { describe, expect, it } from 'vitest';

import {
  billingDetailsDirty,
  EMPTY_BILLING_DETAILS,
  validateBillingDetailsForm,
} from '@/features/dashboard/plans/lib/billingDetailsForm';

describe('validateBillingDetailsForm', () => {
  it('accepts an empty form', () => {
    expect(validateBillingDetailsForm(EMPTY_BILLING_DETAILS)).toEqual({});
  });

  it('accepts 9 and 12 digit TINs with or without dashes', () => {
    for (const tin of ['123456789', '123-456-789', '123-456-789-000', '123456789000']) {
      expect(validateBillingDetailsForm({ ...EMPTY_BILLING_DETAILS, tin })).toEqual({});
    }
  });

  it('rejects a bad TIN, email and oversize text', () => {
    const errors = validateBillingDetailsForm({
      legalName: 'x'.repeat(121),
      address: 'y'.repeat(301),
      tin: '12-34',
      billingEmail: 'nope',
    });
    expect(Object.keys(errors).sort()).toEqual(['address', 'billingEmail', 'legalName', 'tin']);
  });
});

describe('billingDetailsDirty', () => {
  it('ignores whitespace and email case', () => {
    const saved = { ...EMPTY_BILLING_DETAILS, legalName: 'Maria Stays', billingEmail: 'a@b.co' };
    expect(
      billingDetailsDirty({ ...saved, legalName: ' Maria Stays ', billingEmail: 'A@B.CO' }, saved)
    ).toBe(false);
    expect(billingDetailsDirty({ ...saved, tin: '123-456-789' }, saved)).toBe(true);
  });
});
