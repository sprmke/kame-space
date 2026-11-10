/**
 * GAF and pet PDF field maps.
 *
 * The field map is data: an AcroForm field name → a typed data key. `buildGafPdfFieldMap`
 * and `buildPetPdfFieldMap` resolve the Azure maps, and `pdfService.ts` fills the template
 * with the result. A second residence supplies its own template and map (Phase 3), so the
 * only thing that changes is the data.
 *
 * The Azure golden set (`scripts/dev/golden/`) snapshots the resolved values, so a change to
 * what the building receives is a reviewed diff instead of a silent change to a PDF.
 *
 * Field names must match `guest-form-template.pdf` / `pet-form-template.pdf`.
 */

import { formatGafGuestDisplayName } from './gafGuestDisplay.ts';
import { extractTowerAndUnit } from './petPdfDefaults.ts';
import type { GuestFormData } from './types.ts';

/** AcroForm field that carries the assigned carpark slot. */
export const GAF_PDF_FIELD_CARPARK_SLOT_NUMBER = 'carparkSlotNumber';

export type PdfFieldMap = Record<string, string | undefined>;

/**
 * Every value a building document can be filled with.
 *
 * A residence maps its own PDF fields onto these keys, so a typo cannot reach the generator
 * and a new template never needs a code change.
 */
export const PDF_DATA_KEYS = [
  // Property / owner
  'property.unitOwner',
  'property.towerAndUnit',
  'property.onsiteContact',
  'property.contactNumber',
  'property.tower',
  'property.unitNumber',
  // Primary guest
  'guest.primary.nameWithAge',
  'guest.primary.email',
  'guest.primary.phone',
  'guest.primary.address',
  'guest.primary.nationality',
  // Additional guests
  'guest.2.nameWithAge',
  'guest.3.nameWithAge',
  'guest.4.nameWithAge',
  'guest.5.nameWithAge',
  // Stay
  'stay.checkInDate',
  'stay.checkOutDate',
  'stay.checkInTime',
  'stay.checkOutTime',
  'stay.nights',
  'stay.adults',
  'stay.children',
  // Vehicle
  'vehicle.plate',
  'vehicle.brandModel',
  'vehicle.color',
  'vehicle.slot',
  // Pet
  'pet.name',
  'pet.type',
  'pet.age',
  'pet.breed',
  'pet.vaccinationDate',
] as const;

export type PdfDataKey = (typeof PDF_DATA_KEYS)[number];

/** AcroForm field name → data key. */
export type PdfFieldMapDefinition = Record<string, PdfDataKey>;

/** One data key → the string a PDF field receives. `undefined` leaves the field blank. */
function pdfDataValue(key: PdfDataKey, fd: GuestFormData): string | undefined {
  switch (key) {
    case 'property.unitOwner':
      return fd.unitOwner;
    case 'property.towerAndUnit':
      return fd.towerAndUnitNumber;
    case 'property.onsiteContact':
      return fd.ownerOnsiteContactPerson;
    case 'property.contactNumber':
      return fd.ownerContactNumber;
    case 'property.tower':
      return extractTowerAndUnit(fd.towerAndUnitNumber).tower;
    case 'property.unitNumber':
      return extractTowerAndUnit(fd.towerAndUnitNumber).unitNumber;

    case 'guest.primary.nameWithAge':
      return formatGafGuestDisplayName(fd.primaryGuestName, fd.primaryGuestAge);
    case 'guest.primary.email':
      return fd.guestEmail;
    case 'guest.primary.phone':
      return fd.guestPhoneNumber;
    case 'guest.primary.address':
      return fd.guestAddress;
    case 'guest.primary.nationality':
      return fd.nationality;
    case 'guest.2.nameWithAge':
      return formatGafGuestDisplayName(fd.guest2Name, fd.guest2Age);
    case 'guest.3.nameWithAge':
      return formatGafGuestDisplayName(fd.guest3Name, fd.guest3Age);
    case 'guest.4.nameWithAge':
      return formatGafGuestDisplayName(fd.guest4Name, fd.guest4Age);
    case 'guest.5.nameWithAge':
      return formatGafGuestDisplayName(fd.guest5Name, fd.guest5Age);

    case 'stay.checkInDate':
      return fd.checkInDate;
    case 'stay.checkOutDate':
      return fd.checkOutDate;
    case 'stay.checkInTime':
      return fd.checkInTime;
    case 'stay.checkOutTime':
      return fd.checkOutTime;
    case 'stay.nights':
      return String(fd.numberOfNights);
    case 'stay.adults':
      return String(fd.numberOfAdults);
    case 'stay.children':
      return String(fd.numberOfChildren);

    case 'vehicle.plate':
      return fd.carPlateNumber;
    case 'vehicle.brandModel':
      return fd.carBrandModel;
    case 'vehicle.color':
      return fd.carColor;
    case 'vehicle.slot':
      return fd.carparkSlotNumber;

    case 'pet.name':
      return fd.petName;
    case 'pet.type':
      return fd.petType;
    case 'pet.age':
      return fd.petAge;
    case 'pet.breed':
      return fd.petBreed;
    case 'pet.vaccinationDate':
      return fd.petVaccinationDate;
  }
}

/** Azure's GAF template — exactly the map the generator shipped before the v2 model. */
export const AZURE_GAF_PDF_FIELD_MAP: PdfFieldMapDefinition = {
  // Unit and Owner Information
  unitOwner: 'property.unitOwner',
  towerAndUnitNumber: 'property.towerAndUnit',
  ownerOnsiteContactPerson: 'property.onsiteContact',
  ownerContactNumber: 'property.contactNumber',

  // Primary Guest Information
  primaryGuestName: 'guest.primary.nameWithAge',
  guestEmail: 'guest.primary.email',
  guestPhoneNumber: 'guest.primary.phone',
  guestAddress: 'guest.primary.address',
  nationality: 'guest.primary.nationality',

  // Check-in/out Information
  checkInDate: 'stay.checkInDate',
  checkOutDate: 'stay.checkOutDate',
  checkInTime: 'stay.checkInTime',
  checkOutTime: 'stay.checkOutTime',
  numberOfNights: 'stay.nights',

  // Guest Count
  numberOfAdults: 'stay.adults',
  numberOfChildren: 'stay.children',

  // Additional Guests
  guest2Name: 'guest.2.nameWithAge',
  guest3Name: 'guest.3.nameWithAge',
  guest4Name: 'guest.4.nameWithAge',
  guest5Name: 'guest.5.nameWithAge',

  // Parking Information
  carPlateNumber: 'vehicle.plate',
  carBrandModel: 'vehicle.brandModel',
  carColor: 'vehicle.color',
  [GAF_PDF_FIELD_CARPARK_SLOT_NUMBER]: 'vehicle.slot',
};

/** Azure's pet registration template. */
export const AZURE_PET_PDF_FIELD_MAP: PdfFieldMapDefinition = {
  unitOwner: 'property.unitOwner',
  unitNumber: 'property.unitNumber',
  unitTower: 'property.tower',
  checkInDate: 'stay.checkInDate',
  petName: 'pet.name',
  petType: 'pet.type',
  petAge: 'pet.age',
  petBreed: 'pet.breed',
  petVaccinationDate: 'pet.vaccinationDate',
};

/** Fill any template by its map. */
export function resolvePdfFieldValues(
  map: PdfFieldMapDefinition,
  fd: GuestFormData
): PdfFieldMap {
  const values: PdfFieldMap = {};
  for (const [fieldName, dataKey] of Object.entries(map)) {
    values[fieldName] = pdfDataValue(dataKey, fd);
  }
  return values;
}

/** GAF request PDF — one entry per AcroForm text field. */
export function buildGafPdfFieldMap(fd: GuestFormData): PdfFieldMap {
  return resolvePdfFieldValues(AZURE_GAF_PDF_FIELD_MAP, fd);
}

/** Pet registration PDF — one entry per AcroForm text field. */
export function buildPetPdfFieldMap(fd: GuestFormData): PdfFieldMap {
  return resolvePdfFieldValues(AZURE_PET_PDF_FIELD_MAP, fd);
}
