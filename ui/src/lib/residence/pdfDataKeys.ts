/**
 * Client mirror of the `PDF_DATA_KEYS` catalog in
 * `supabase/functions/_shared/gafPdfFields.ts`.
 *
 * ⚠️ Keep in sync with the edge module. A key missing here only means the editor cannot map
 * that value; the generator ignores unknown keys, so a drift is visible, never destructive.
 */

export const PDF_DATA_KEYS = [
  'property.unitOwner',
  'property.towerAndUnit',
  'property.onsiteContact',
  'property.contactNumber',
  'property.tower',
  'property.unitNumber',
  'guest.primary.nameWithAge',
  'guest.primary.email',
  'guest.primary.phone',
  'guest.primary.address',
  'guest.primary.nationality',
  'guest.2.nameWithAge',
  'guest.3.nameWithAge',
  'guest.4.nameWithAge',
  'guest.5.nameWithAge',
  'stay.checkInDate',
  'stay.checkOutDate',
  'stay.checkInTime',
  'stay.checkOutTime',
  'stay.nights',
  'stay.adults',
  'stay.children',
  'vehicle.plate',
  'vehicle.brandModel',
  'vehicle.color',
  'vehicle.slot',
  'pet.name',
  'pet.type',
  'pet.age',
  'pet.breed',
  'pet.vaccinationDate',
] as const;

export type PdfDataKey = (typeof PDF_DATA_KEYS)[number];

const GROUP_LABELS: Record<string, string> = {
  property: 'Property',
  guest: 'Guest',
  stay: 'Stay',
  vehicle: 'Vehicle',
  pet: 'Pet',
};

/** "property.unitOwner" → "Property · unit owner". */
export function pdfDataKeyLabel(key: string): string {
  const [group, ...rest] = key.split('.');
  const label = rest.join('.').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\./g, ' ');
  const sentence = `${label.charAt(0).toUpperCase()}${label.slice(1).toLowerCase()}`;
  return `${GROUP_LABELS[group] ?? group} · ${sentence}`;
}

export function isPdfDataKey(value: unknown): value is PdfDataKey {
  return typeof value === 'string' && (PDF_DATA_KEYS as readonly string[]).includes(value);
}

/**
 * Best-effort map for an uploaded PDF: a field named like one of ours (`unitOwner`,
 * `checkInDate`, `petName`, …) gets its data key, everything else starts unmapped.
 */
export function defaultPdfFieldMap(fieldNames: readonly string[]): Record<string, PdfDataKey> {
  const known: Record<string, PdfDataKey> = {
    unitOwner: 'property.unitOwner',
    towerAndUnitNumber: 'property.towerAndUnit',
    ownerOnsiteContactPerson: 'property.onsiteContact',
    ownerContactNumber: 'property.contactNumber',
    unitNumber: 'property.unitNumber',
    unitTower: 'property.tower',
    primaryGuestName: 'guest.primary.nameWithAge',
    guestEmail: 'guest.primary.email',
    guestPhoneNumber: 'guest.primary.phone',
    guestAddress: 'guest.primary.address',
    nationality: 'guest.primary.nationality',
    guest2Name: 'guest.2.nameWithAge',
    guest3Name: 'guest.3.nameWithAge',
    guest4Name: 'guest.4.nameWithAge',
    guest5Name: 'guest.5.nameWithAge',
    checkInDate: 'stay.checkInDate',
    checkOutDate: 'stay.checkOutDate',
    checkInTime: 'stay.checkInTime',
    checkOutTime: 'stay.checkOutTime',
    numberOfNights: 'stay.nights',
    numberOfAdults: 'stay.adults',
    numberOfChildren: 'stay.children',
    carPlateNumber: 'vehicle.plate',
    carBrandModel: 'vehicle.brandModel',
    carColor: 'vehicle.color',
    carparkSlotNumber: 'vehicle.slot',
    petName: 'pet.name',
    petType: 'pet.type',
    petAge: 'pet.age',
    petBreed: 'pet.breed',
    petVaccinationDate: 'pet.vaccinationDate',
  };

  const map: Record<string, PdfDataKey> = {};
  for (const fieldName of fieldNames) {
    const name = fieldName.trim();
    const key = known[name];
    if (key) map[name] = key;
  }
  return map;
}
