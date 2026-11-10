/**
 * GAF and pet PDF field maps.
 *
 * Pure: a resolved guest form → the AcroForm field values that get written into the
 * template. `pdfService.ts` fills the template with the map; the Azure golden set
 * (`scripts/dev/golden/`) snapshots it, so a change to what the building receives is a
 * reviewed diff instead of a silent change to a PDF.
 *
 * Field names must match `guest-form-template.pdf` / `pet-form-template.pdf`.
 */

import { formatGafGuestDisplayName } from './gafGuestDisplay.ts';
import { extractTowerAndUnit } from './petPdfDefaults.ts';
import type { GuestFormData } from './types.ts';

/** AcroForm field that carries the assigned carpark slot. */
export const GAF_PDF_FIELD_CARPARK_SLOT_NUMBER = 'carparkSlotNumber';

export type PdfFieldMap = Record<string, string | undefined>;

/** GAF request PDF — one entry per AcroForm text field. */
export function buildGafPdfFieldMap(fd: GuestFormData): PdfFieldMap {
  return {
    // Unit and Owner Information
    unitOwner: fd.unitOwner,
    towerAndUnitNumber: fd.towerAndUnitNumber,
    ownerOnsiteContactPerson: fd.ownerOnsiteContactPerson,
    ownerContactNumber: fd.ownerContactNumber,

    // Primary Guest Information
    primaryGuestName: formatGafGuestDisplayName(fd.primaryGuestName, fd.primaryGuestAge),
    guestEmail: fd.guestEmail,
    guestPhoneNumber: fd.guestPhoneNumber,
    guestAddress: fd.guestAddress,
    nationality: fd.nationality,

    // Check-in/out Information
    checkInDate: fd.checkInDate,
    checkOutDate: fd.checkOutDate,
    checkInTime: fd.checkInTime,
    checkOutTime: fd.checkOutTime,
    numberOfNights: String(fd.numberOfNights),

    // Guest Count
    numberOfAdults: String(fd.numberOfAdults),
    numberOfChildren: String(fd.numberOfChildren),

    // Additional Guests
    guest2Name: formatGafGuestDisplayName(fd.guest2Name, fd.guest2Age),
    guest3Name: formatGafGuestDisplayName(fd.guest3Name, fd.guest3Age),
    guest4Name: formatGafGuestDisplayName(fd.guest4Name, fd.guest4Age),
    guest5Name: formatGafGuestDisplayName(fd.guest5Name, fd.guest5Age),

    // Parking Information
    carPlateNumber: fd.carPlateNumber,
    carBrandModel: fd.carBrandModel,
    carColor: fd.carColor,
    [GAF_PDF_FIELD_CARPARK_SLOT_NUMBER]: fd.carparkSlotNumber,
  };
}

/** Pet registration PDF — one entry per AcroForm text field. */
export function buildPetPdfFieldMap(fd: GuestFormData): PdfFieldMap {
  const { tower, unitNumber } = extractTowerAndUnit(fd.towerAndUnitNumber);

  return {
    unitOwner: fd.unitOwner,
    unitNumber: unitNumber,
    unitTower: tower,
    checkInDate: fd.checkInDate,
    petName: fd.petName,
    petType: fd.petType,
    petAge: fd.petAge,
    petBreed: fd.petBreed,
    petVaccinationDate: fd.petVaccinationDate,
  };
}
