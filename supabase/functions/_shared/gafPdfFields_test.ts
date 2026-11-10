import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildGafPdfFieldMap, buildPetPdfFieldMap } from './gafPdfFields.ts';
import type { GuestFormData } from './types.ts';

function form(overrides: Partial<GuestFormData> = {}): GuestFormData {
  return {
    guestFacebookName: '',
    primaryGuestName: 'Kyle Santos',
    guestEmail: 'kyle@example.test',
    guestPhoneNumber: '0917 555 0134',
    guestAddress: 'Makati City',
    checkInDate: '2027-03-14',
    checkOutDate: '2027-03-17',
    findUs: 'Facebook',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    nationality: 'Filipino',
    numberOfAdults: 2,
    numberOfChildren: 1,
    numberOfNights: 3,
    primaryGuestAge: 32,
    guestRequestsSurpriseDecor: false,
    needParking: true,
    hasPets: true,
    unitOwner: 'Maria Santos',
    towerAndUnitNumber: 'Monaco 2604',
    ownerOnsiteContactPerson: 'Ana Lim',
    ownerContactNumber: '+63 917 123 4567',
    ...overrides,
  };
}

Deno.test('GAF map: copies owner, stay and parking fields', () => {
  const map = buildGafPdfFieldMap(
    form({ carPlateNumber: 'ABC 1234', carBrandModel: 'Toyota Vios', carColor: 'Silver' })
  );

  assertEquals(map.unitOwner, 'Maria Santos');
  assertEquals(map.towerAndUnitNumber, 'Monaco 2604');
  assertEquals(map.checkInDate, '2027-03-14');
  assertEquals(map.numberOfNights, '3');
  assertEquals(map.numberOfAdults, '2');
  assertEquals(map.numberOfChildren, '1');
  assertEquals(map.carPlateNumber, 'ABC 1234');
});

Deno.test('GAF map: the carpark slot uses the template field name', () => {
  const map = buildGafPdfFieldMap(form({ carparkSlotNumber: 'B2-27' }));
  assertEquals(map.carparkSlotNumber, 'B2-27');
});

Deno.test('GAF map: children 3 and under carry their age next to the name', () => {
  const map = buildGafPdfFieldMap(
    form({ guest2Name: 'Mateo Santos', guest2Age: 3, guest3Name: 'Ana Reyes', guest3Age: 29 })
  );

  assertEquals(map.guest2Name, 'Mateo Santos (3 years old)');
  assertEquals(map.guest3Name, 'Ana Reyes');
});

Deno.test('GAF map: an empty extra guest stays undefined so the field is left blank', () => {
  const map = buildGafPdfFieldMap(form({ guest4Name: '   ', guest4Age: 20 }));
  assertEquals(map.guest4Name, undefined);
});

Deno.test('pet map: splits tower and unit from the unit label', () => {
  const map = buildPetPdfFieldMap(
    form({ petName: 'Biscuit', petType: 'Dog', petBreed: 'Shih Tzu', petAge: '3 years' })
  );

  assertEquals(map.unitTower, 'Monaco');
  assertEquals(map.unitNumber, '2604');
  assertEquals(map.petName, 'Biscuit');
  assertEquals(map.petType, 'Dog');
});

Deno.test('pet map: splits on the trailing number, which subdivision labels also end with', () => {
  // Existing behavior: `Blk 3 Lot 5` -> tower `Blk 3 Lot`, unit `5`. Documented here so a
  // change to the split shows up as a test diff, not a silently different pet PDF.
  const map = buildPetPdfFieldMap(form({ towerAndUnitNumber: 'Blk 3 Lot 5' }));
  assertEquals(map.unitTower, 'Blk 3 Lot');
  assertEquals(map.unitNumber, '5');
});
