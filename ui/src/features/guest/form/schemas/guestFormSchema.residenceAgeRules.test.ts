import { describe, expect, it } from 'vitest';

import type { GuestFormData } from '@/features/guest/form/schemas/guestFormSchema';
import { createGuestFormSchema } from '@/features/guest/form/schemas/guestFormSchema';

/**
 * Residence age rules (plan §4.2 `occupancy`): the guest form must use the building's
 * numbers, not the platform's 3 / 18 constants, once `get-guest-payment-info` returns them.
 */

const BASE = {
  isAirbnb: false,
  allowParking: true,
  allowPets: false,
  allowSurpriseDecor: true,
  maxAdults: 5,
  maxChildren: 3,
};

function validForm(overrides: Partial<Record<keyof GuestFormData, unknown>> = {}) {
  const file = new File(['x'], 'id.png', { type: 'image/png' });
  return {
    guestFacebookName: 'Kyle Santos',
    primaryGuestName: 'Kyle Santos',
    primaryGuestAge: 32,
    guestEmail: 'kyle@example.test',
    guestPhoneNumber: '0917 555 0134',
    guestAddress: 'Makati, Metro Manila',
    checkInDate: '2027-03-14',
    checkOutDate: '2027-03-17',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    nationality: 'Filipino',
    numberOfAdults: 1,
    numberOfChildren: 0,
    guestRequestsSurpriseDecor: false,
    needParking: false,
    hasPets: false,
    findUs: 'Facebook',
    unitOwner: 'Maria Santos',
    towerAndUnitNumber: 'Monaco 2604',
    ownerOnsiteContactPerson: 'Ana Lim',
    ownerContactNumber: '0917 123 4567',
    paymentReceipt: file,
    validId: file,
    ...overrides,
  };
}

function messagesFor(result: { success: boolean; error?: { issues: Array<{ message: string }> } }) {
  return (result.error?.issues ?? []).map((issue) => issue.message);
}

describe('guest form residence age rules', () => {
  it('accepts the platform defaults when no rules are passed', () => {
    const schema = createGuestFormSchema(BASE);
    expect(schema.safeParse(validForm()).success).toBe(true);
  });

  it('rejects a primary guest below the residence minimum', () => {
    const schema = createGuestFormSchema({
      ...BASE,
      ageRules: {
        adultMinAge: 21,
        idRequiredFromAge: 18,
        primaryGuestMinAge: 21,
        childMaxAge: 3,
      },
    });

    const result = schema.safeParse(validForm({ primaryGuestAge: 19 }));
    expect(result.success).toBe(false);
    expect(messagesFor(result)).toContain('Primary guest must be 21 years or older');
  });

  it('requires a valid ID from the residence age, not from 18', () => {
    const schema = createGuestFormSchema({
      ...BASE,
      ageRules: {
        adultMinAge: 18,
        idRequiredFromAge: 16,
        primaryGuestMinAge: 18,
        childMaxAge: 3,
      },
    });

    const result = schema.safeParse(
      validForm({
        primaryGuestAge: 17,
        validId: undefined,
        guest2Name: 'Ana Reyes',
        guest2Age: 16,
        guest2ValidId: undefined,
      })
    );
    expect(result.success).toBe(false);
    expect(messagesFor(result)).toContain('Valid ID is required for guests aged 16 and above');
  });

  it('lets a guest below 18 hold the fifth slot when the residence child age is 12', () => {
    const rules = {
      adultMinAge: 18,
      idRequiredFromAge: 18,
      primaryGuestMinAge: 18,
      childMaxAge: 12,
    };
    const schema = createGuestFormSchema({
      ...BASE,
      ageRules: rules,
    });

    const fiveGuests = validForm({
      guest2Name: 'Ana Reyes',
      guest2Age: 29,
      guest2ValidId: new File(['x'], 'id2.png', { type: 'image/png' }),
      guest3Name: 'Mateo Santos',
      guest3Age: 12,
      guest4Name: 'Lia Santos',
      guest4Age: 10,
      guest5Name: 'Noah Santos',
      guest5Age: 12,
    });

    expect(schema.safeParse(fiveGuests).success).toBe(true);
  });
});
