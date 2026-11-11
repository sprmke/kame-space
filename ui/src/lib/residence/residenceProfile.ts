/**
 * Residence Profile — client mirror of `supabase/functions/_shared/residenceProfile.ts`.
 *
 * ⚠️ The block between `#region shared-core` and `#endregion shared-core` must be
 * byte-identical on both sides. `bun run check:residence-profile-drift` fails when it is not.
 *
 * UI reads the profile through one TanStack Query key `['residence-profile', developmentId]`
 * (Phase 1), invalidated by the super-admin save.
 */

import { MAX_GUESTS } from '@/features/guest/form/lib/guestCounts';

import type { DocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';

import type { SupabaseClient } from '@supabase/supabase-js';

// #region shared-core

export type ResidenceOwnership = 'locked' | 'cap' | 'inherited' | 'seed' | 'display';

export type ResidenceNumericRange = { min: number; max: number; default: number };

export type ResidenceTower = { name: string; code: string; active: boolean };

export type ResidenceParkingTower = ResidenceTower & {
  levels: string[];
  parkingType: 'inside_tower' | 'outside_tower' | 'motorcycle';
};

export type ResidenceUnitNumberFormat = {
  preset: 'digits4' | 'digits' | 'alnum' | 'custom';
  pattern?: string;
  example: string;
};

export type ResidenceParkingSlotFormat = {
  preset: 'digits1to4' | 'alnum' | 'custom';
  pattern?: string;
  example: string;
};

export type ResidencePdfTemplate = {
  id: string;
  name: string;
  storagePath: string;
  fieldMap: Record<string, string>;
  signatureField: string | null;
  signatureNameField: string | null;
  version: number;
};

export type ResidenceTermKey =
  'buildingAdmin' | 'buildingAdminLong' | 'arrivalCheckpoint' | 'residenceShortName';

export type ResidenceCopyKey =
  | 'guestForm.parking.stepHint'
  | 'guestForm.parking.paidDescription'
  | 'guestForm.parking.noPaidDescription'
  | 'guestForm.pets.policyTitle'
  | 'guestForm.pets.policyBody'
  | 'guestForm.contact.emailHint'
  | 'guestForm.guests.limitMessage'
  | 'success.administrationLabel'
  | 'payParking.lastMinuteWarning'
  | 'workflow.proceedHint'
  | 'email.readyForCheckin.documentsNote'
  | 'verification.tier2BuildingProof';

export type ResidenceBuildingRule = {
  id: string;
  text: string;
  type: 'info' | 'prohibited' | 'allowed';
};

export type ResidenceProfile = {
  schemaVersion: 2;
  developmentId: string | null;
  developmentName: string | null;
  developmentType: string | null;
  structure: {
    towerLabel: string;
    unitLabel: string;
    towersRequired: boolean;
    propertyTowers: ResidenceTower[];
    parkingTowers: ResidenceParkingTower[];
    unitNumberFormat: ResidenceUnitNumberFormat;
    parkingSlotFormat: ResidenceParkingSlotFormat;
    floorsMax: number | null;
  };
  occupancy: {
    maxAdultsCap: number;
    maxChildrenCap: number;
    childMaxAge: number;
    adultMinAge: number;
    idRequiredFromAge: number;
    primaryGuestMinAge: number;
  };
  stay: {
    checkInTime: string;
    checkOutTime: string;
    petsAllowed: boolean;
    paidParkingAvailable: boolean;
    surpriseDecorAllowed: boolean;
    petTypes: string[];
    petVaccinationRequired: boolean;
  };
  location: {
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    zipCode: string | null;
  };
  approvals: {
    buildingAdminLabel: string;
    pmoEmail: string | null;
    ccPropertyEmail: boolean;
    documentRequirements: DocumentRequirement[];
    pdfTemplates: ResidencePdfTemplate[];
  };
  terms: Partial<Record<ResidenceTermKey, string>>;
  copy: Partial<Record<ResidenceCopyKey, string>>;
  propertySeeds: { amenityIds: string[]; houseRuleIds: string[] };
  buildingRules: ResidenceBuildingRule[];
  templateDefaults: Record<string, { content: string }>;
  guestInfoVisibility: { stayGuide: boolean; propertyPage: boolean };
  verification: { tier2BuildingProofLabel: string; tier2BuildingProofRequired: boolean };
};

/** Generic, building-neutral defaults. No Azure values live here. */
export const GENERIC_RESIDENCE_PROFILE: ResidenceProfile = {
  schemaVersion: 2,
  developmentId: null,
  developmentName: null,
  developmentType: null,
  structure: {
    towerLabel: 'Tower',
    unitLabel: 'Unit',
    towersRequired: false,
    propertyTowers: [],
    parkingTowers: [],
    unitNumberFormat: { preset: 'alnum', example: '0101' },
    parkingSlotFormat: { preset: 'alnum', example: 'B2-07' },
    floorsMax: null,
  },
  occupancy: {
    maxAdultsCap: MAX_GUESTS,
    maxChildrenCap: 4,
    childMaxAge: 3,
    adultMinAge: 18,
    idRequiredFromAge: 18,
    primaryGuestMinAge: 18,
  },
  stay: {
    checkInTime: '14:00',
    checkOutTime: '12:00',
    petsAllowed: true,
    paidParkingAvailable: true,
    surpriseDecorAllowed: true,
    petTypes: ['Dog', 'Cat'],
    petVaccinationRequired: true,
  },
  location: {
    latitude: null,
    longitude: null,
    address: null,
    city: null,
    province: null,
    country: null,
    zipCode: null,
  },
  approvals: {
    buildingAdminLabel: 'Building admin',
    pmoEmail: null,
    ccPropertyEmail: false,
    documentRequirements: [],
    pdfTemplates: [],
  },
  terms: {},
  copy: {},
  propertySeeds: { amenityIds: [], houseRuleIds: [] },
  buildingRules: [],
  templateDefaults: {},
  guestInfoVisibility: { stayGuide: true, propertyPage: true },
  verification: { tier2BuildingProofLabel: '', tier2BuildingProofRequired: false },
};

export type ResidenceFieldKey =
  | 'structure.towersRequired'
  | 'structure.propertyTowers'
  | 'structure.parkingTowers'
  | 'structure.unitNumberFormat'
  | 'structure.parkingSlotFormat'
  | 'structure.floorsMax'
  | 'occupancy.maxAdults'
  | 'occupancy.maxChildren'
  | 'stay.checkInTime'
  | 'stay.checkOutTime'
  | 'stay.petsAllowed'
  | 'stay.paidParkingAvailable'
  | 'stay.surpriseDecorAllowed'
  | 'approvals.pmoEmail'
  | 'verification.tier2BuildingProofRequired';

/**
 * One ownership class per field. This is the answer to "can a host change this?".
 * `locked` — building decides, host sees read-only.
 * `cap` — building sets the ceiling, host picks a value under it.
 * `inherited` — host may override, otherwise the residence value applies.
 */
export const RESIDENCE_FIELD_POLICY: Record<
  ResidenceFieldKey,
  { ownership: ResidenceOwnership; propertySetting?: string }
> = {
  'structure.towersRequired': { ownership: 'locked' },
  'structure.propertyTowers': { ownership: 'locked' },
  'structure.parkingTowers': { ownership: 'locked' },
  'structure.unitNumberFormat': { ownership: 'locked' },
  'structure.parkingSlotFormat': { ownership: 'locked' },
  'structure.floorsMax': { ownership: 'cap', propertySetting: 'floors' },
  'occupancy.maxAdults': { ownership: 'cap', propertySetting: 'maxAdults' },
  'occupancy.maxChildren': { ownership: 'cap', propertySetting: 'maxChildren' },
  'stay.checkInTime': { ownership: 'inherited', propertySetting: 'checkInTime' },
  'stay.checkOutTime': { ownership: 'inherited', propertySetting: 'checkOutTime' },
  'stay.petsAllowed': { ownership: 'locked', propertySetting: 'allowPets' },
  'stay.paidParkingAvailable': { ownership: 'locked', propertySetting: 'allowParking' },
  'stay.surpriseDecorAllowed': { ownership: 'locked', propertySetting: 'allowSurpriseDecor' },
  'approvals.pmoEmail': { ownership: 'locked' },
  'verification.tier2BuildingProofRequired': { ownership: 'locked' },
};

export type ResolvedValue<T> = {
  value: T;
  source: 'property' | 'residence' | 'generic';
  ownership: ResidenceOwnership;
  /** Present only when the value was clamped by a building cap. */
  cap?: number;
  /** True when the stored property value was outside the cap and got clamped at read. */
  clamped?: boolean;
};

export const RESIDENCE_COPY_DEFAULTS: Record<ResidenceCopyKey, string> = {
  'guestForm.parking.stepHint': 'Parking is arranged with the building.',
  'guestForm.parking.paidDescription': 'Paid parking is available for this stay.',
  'guestForm.parking.noPaidDescription': 'Parking is not offered for this stay.',
  'guestForm.pets.policyTitle': 'Pets',
  'guestForm.pets.policyBody': 'Pets need the building approval before arrival.',
  'guestForm.contact.emailHint': 'Use an email you check. The building may contact you.',
  'guestForm.guests.limitMessage': 'This unit has a guest limit.',
  'success.administrationLabel': 'Building management',
  'payParking.lastMinuteWarning': 'Pay before the deadline to keep the slot.',
  'workflow.proceedHint': 'Sends the request to building management.',
  'email.readyForCheckin.documentsNote': 'Bring the approved documents on arrival.',
  'verification.tier2BuildingProof': 'Building confirmation',
};

export const RESIDENCE_TERM_DEFAULTS: Record<ResidenceTermKey, string> = {
  buildingAdmin: 'Building admin',
  buildingAdminLong: 'Building administration',
  arrivalCheckpoint: 'the entrance',
  residenceShortName: '',
};

const warnedKeys = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[residenceProfile] ${key}: ${message}`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' ? value.trim() : null;
}

function readBoolean(record: Record<string, unknown> | null, key: string): boolean | null {
  const value = record?.[key];
  return typeof value === 'boolean' ? value : null;
}

function readNumber(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringArray(record: Record<string, unknown> | null, key: string): string[] | null {
  const value = record?.[key];
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim());
  return items.filter(Boolean);
}

function parseTowers(value: unknown): ResidenceTower[] | null {
  if (!Array.isArray(value)) return null;
  const towers: ResidenceTower[] = [];
  for (const raw of value) {
    if (typeof raw === 'string') {
      const name = raw.trim();
      if (name) towers.push({ name, code: name, active: true });
      continue;
    }
    const entry = asRecord(raw);
    const name = readString(entry, 'name');
    if (!name) continue;
    towers.push({
      name,
      code: readString(entry, 'code') || name,
      active: readBoolean(entry, 'active') ?? true,
    });
  }
  return towers;
}

function parseParkingTowers(value: unknown): ResidenceParkingTower[] | null {
  const towers = parseTowers(value);
  if (towers === null) return null;
  const raw = Array.isArray(value) ? value : [];
  return towers.map((tower, index) => {
    const entry = asRecord(raw[index]);
    const parkingType = readString(entry, 'parkingType');
    return {
      ...tower,
      levels: readStringArray(entry, 'levels') ?? [],
      parkingType:
        parkingType === 'outside_tower' || parkingType === 'motorcycle'
          ? parkingType
          : 'inside_tower',
    };
  });
}

function parseTime(record: Record<string, unknown> | null, key: string, fallback: string): string {
  const value = readString(record, key);
  if (value === null) return fallback;
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  warnOnce(key, 'invalid HH:mm time, using the generic default');
  return fallback;
}

/**
 * Total. Never throws. A v1 row (no `schemaVersion`) is upgraded in memory because every
 * v1 key is read from its existing location with a generic fallback.
 */
export function parseResidenceProfile(row: unknown): ResidenceProfile {
  const record = asRecord(row);
  const settings = asRecord(record?.settings);
  const base: ResidenceProfile = {
    ...GENERIC_RESIDENCE_PROFILE,
    structure: { ...GENERIC_RESIDENCE_PROFILE.structure },
    occupancy: { ...GENERIC_RESIDENCE_PROFILE.occupancy },
    stay: { ...GENERIC_RESIDENCE_PROFILE.stay },
    location: { ...GENERIC_RESIDENCE_PROFILE.location },
    approvals: { ...GENERIC_RESIDENCE_PROFILE.approvals },
    terms: {},
    copy: {},
    propertySeeds: { amenityIds: [], houseRuleIds: [] },
    buildingRules: [],
    templateDefaults: {},
    guestInfoVisibility: { ...GENERIC_RESIDENCE_PROFILE.guestInfoVisibility },
    verification: { ...GENERIC_RESIDENCE_PROFILE.verification },
    developmentId: readString(record, 'id'),
    developmentName: readString(record, 'name'),
    developmentType: readString(record, 'type'),
  };

  const structure = asRecord(settings?.structure);
  base.structure = {
    towerLabel: readString(structure, 'towerLabel') ?? base.structure.towerLabel,
    unitLabel: readString(structure, 'unitLabel') ?? base.structure.unitLabel,
    towersRequired: readBoolean(structure, 'towersRequired') ?? base.structure.towersRequired,
    propertyTowers: parseTowers(structure?.propertyTowers) ?? base.structure.propertyTowers,
    parkingTowers: parseParkingTowers(structure?.parkingTowers) ?? base.structure.parkingTowers,
    unitNumberFormat:
      parseUnitNumberFormat(structure?.unitNumberFormat) ?? base.structure.unitNumberFormat,
    parkingSlotFormat:
      parseParkingSlotFormat(structure?.parkingSlotFormat) ?? base.structure.parkingSlotFormat,
    floorsMax: readNumber(structure, 'floorsMax') ?? base.structure.floorsMax,
  };

  const occupancy = asRecord(settings?.occupancy);
  base.occupancy = {
    maxAdultsCap: clampInt(
      readNumber(occupancy, 'maxAdultsCap'),
      1,
      MAX_GUESTS,
      base.occupancy.maxAdultsCap
    ),
    maxChildrenCap: clampInt(
      readNumber(occupancy, 'maxChildrenCap'),
      0,
      30,
      base.occupancy.maxChildrenCap
    ),
    childMaxAge: clampInt(readNumber(occupancy, 'childMaxAge'), 0, 17, base.occupancy.childMaxAge),
    adultMinAge: clampInt(readNumber(occupancy, 'adultMinAge'), 0, 99, base.occupancy.adultMinAge),
    idRequiredFromAge: clampInt(
      readNumber(occupancy, 'idRequiredFromAge'),
      0,
      99,
      base.occupancy.idRequiredFromAge
    ),
    primaryGuestMinAge: clampInt(
      readNumber(occupancy, 'primaryGuestMinAge'),
      0,
      99,
      base.occupancy.primaryGuestMinAge
    ),
  };

  const stay = asRecord(settings?.stay);
  base.stay = {
    checkInTime: parseTime(stay, 'checkInTime', base.stay.checkInTime),
    checkOutTime: parseTime(stay, 'checkOutTime', base.stay.checkOutTime),
    petsAllowed: readBoolean(stay, 'petsAllowed') ?? base.stay.petsAllowed,
    paidParkingAvailable:
      readBoolean(stay, 'paidParkingAvailable') ?? base.stay.paidParkingAvailable,
    surpriseDecorAllowed:
      readBoolean(stay, 'surpriseDecorAllowed') ?? base.stay.surpriseDecorAllowed,
    petTypes: readStringArray(stay, 'petTypes') ?? base.stay.petTypes,
    petVaccinationRequired:
      readBoolean(stay, 'petVaccinationRequired') ?? base.stay.petVaccinationRequired,
  };

  const locationSettings = asRecord(settings?.location) ?? settings;
  base.location = {
    latitude: readNumber(locationSettings, 'latitude'),
    longitude: readNumber(locationSettings, 'longitude'),
    address: readString(locationSettings, 'address') ?? readString(settings, 'address'),
    city: readString(locationSettings, 'city'),
    province: readString(locationSettings, 'province'),
    country: readString(locationSettings, 'country'),
    zipCode: readString(locationSettings, 'zipCode'),
  };

  const approvals = asRecord(settings?.approvals);
  const workflowDefaults = asRecord(settings?.workflowDefaults);
  const workflowRequirements = workflowDefaults?.documentRequirements;
  base.approvals = {
    buildingAdminLabel:
      readString(approvals, 'buildingAdminLabel') ?? base.approvals.buildingAdminLabel,
    // The existing flat key wins so v1 rows keep reading their PMO address.
    pmoEmail: readString(settings, 'pmoEmail') ?? readString(approvals, 'pmoEmail') ?? null,
    ccPropertyEmail: readBoolean(approvals, 'ccPropertyEmail') ?? base.approvals.ccPropertyEmail,
    // Read raw here; the resolution path parses with `parseDocumentRequirements`.
    // Phase 3 replaces this with the immutable DocumentRequirementV2 parser.
    documentRequirements: Array.isArray(workflowRequirements)
      ? (workflowRequirements as DocumentRequirement[])
      : base.approvals.documentRequirements,
    pdfTemplates: parseResidencePdfTemplates(approvals?.pdfTemplates) ?? base.approvals.pdfTemplates,
  };

  base.terms = readTerms(asRecord(settings?.terms));
  base.copy = readCopy(asRecord(settings?.copy));

  const seeds = asRecord(settings?.propertySeeds);
  base.propertySeeds = {
    amenityIds: readStringArray(seeds, 'amenityIds') ?? [],
    houseRuleIds: readStringArray(seeds, 'houseRuleIds') ?? [],
  };

  base.buildingRules = parseResidenceBuildingRules(settings?.buildingRules) ?? [];
  base.templateDefaults = parseTemplateDefaults(settings?.templateDefaults);
  base.guestInfoVisibility = {
    stayGuide: readBoolean(asRecord(settings?.guestInfoVisibility), 'stayGuide') ?? true,
    propertyPage: readBoolean(asRecord(settings?.guestInfoVisibility), 'propertyPage') ?? true,
  };
  base.verification = {
    tier2BuildingProofLabel:
      readString(asRecord(settings?.verification), 'tier2BuildingProofLabel') ??
      base.verification.tier2BuildingProofLabel,
    tier2BuildingProofRequired:
      readBoolean(asRecord(settings?.verification), 'tier2BuildingProofRequired') ??
      base.verification.tier2BuildingProofRequired,
  };

  return base;
}

function clampInt(value: number | null, min: number, max: number, fallback: number): number {
  if (value === null) return fallback;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return Math.min(max, Math.max(min, rounded));
  return rounded;
}

function parseUnitNumberFormat(value: unknown): ResidenceUnitNumberFormat | null {
  const record = asRecord(value);
  if (record === null) return null;
  const preset = readString(record, 'preset');
  if (preset !== 'digits4' && preset !== 'digits' && preset !== 'alnum' && preset !== 'custom') {
    return null;
  }
  const pattern = readString(record, 'pattern');
  return {
    preset,
    ...(preset === 'custom' && pattern ? { pattern } : {}),
    example:
      readString(record, 'example') || GENERIC_RESIDENCE_PROFILE.structure.unitNumberFormat.example,
  };
}

function parseParkingSlotFormat(value: unknown): ResidenceParkingSlotFormat | null {
  const record = asRecord(value);
  if (record === null) return null;
  const preset = readString(record, 'preset');
  if (preset !== 'digits1to4' && preset !== 'alnum' && preset !== 'custom') return null;
  const pattern = readString(record, 'pattern');
  return {
    preset,
    ...(preset === 'custom' && pattern ? { pattern } : {}),
    example:
      readString(record, 'example') ||
      GENERIC_RESIDENCE_PROFILE.structure.parkingSlotFormat.example,
  };
}

export function parseResidencePdfTemplates(value: unknown): ResidencePdfTemplate[] | null {
  if (!Array.isArray(value)) return null;
  const templates: ResidencePdfTemplate[] = [];
  for (const raw of value) {
    const entry = asRecord(raw);
    const id = readString(entry, 'id');
    const name = readString(entry, 'name');
    const storagePath = readString(entry, 'storagePath');
    if (!id || !name || !storagePath) continue;
    const fieldMap: Record<string, string> = {};
    const rawMap = asRecord(entry?.fieldMap);
    if (rawMap) {
      for (const [field, dataKey] of Object.entries(rawMap)) {
        if (typeof dataKey === 'string' && dataKey.trim() && field.trim()) {
          fieldMap[field.trim()] = dataKey.trim();
        }
      }
    }
    templates.push({
      id,
      name,
      storagePath,
      fieldMap,
      signatureField: readString(entry, 'signatureField'),
      signatureNameField: readString(entry, 'signatureNameField'),
      version: readNumber(entry, 'version') ?? 1,
    });
  }
  return templates;
}

function readTerms(
  value: Record<string, unknown> | null
): Partial<Record<ResidenceTermKey, string>> {
  const terms: Partial<Record<ResidenceTermKey, string>> = {};
  for (const key of Object.keys(RESIDENCE_TERM_DEFAULTS) as ResidenceTermKey[]) {
    const text = readString(value, key);
    if (text) terms[key] = text;
  }
  return terms;
}

function readCopy(
  value: Record<string, unknown> | null
): Partial<Record<ResidenceCopyKey, string>> {
  const copy: Partial<Record<ResidenceCopyKey, string>> = {};
  for (const key of Object.keys(RESIDENCE_COPY_DEFAULTS) as ResidenceCopyKey[]) {
    const text = readString(value, key);
    if (text) copy[key] = text;
  }
  return copy;
}

export function parseResidenceBuildingRules(value: unknown): ResidenceBuildingRule[] | null {
  if (!Array.isArray(value)) return null;
  const rules: ResidenceBuildingRule[] = [];
  for (const raw of value) {
    const entry = asRecord(raw);
    const id = readString(entry, 'id');
    const text = readString(entry, 'text');
    if (!id || !text) continue;
    const type = readString(entry, 'type');
    rules.push({
      id,
      text,
      type: type === 'prohibited' || type === 'allowed' ? type : 'info',
    });
  }
  return rules;
}

function parseTemplateDefaults(value: unknown): Record<string, { content: string }> {
  const record = asRecord(value);
  if (record === null) return {};
  const defaults: Record<string, { content: string }> = {};
  for (const [key, raw] of Object.entries(record)) {
    const content = readString(asRecord(raw), 'content');
    if (content) defaults[key] = { content };
  }
  return defaults;
}

/** A residence copy value is usable only when it is a non-empty string inside the registry. */
export function resolveCopy(profile: ResidenceProfile, key: ResidenceCopyKey): string {
  return profile.copy[key]?.trim() || RESIDENCE_COPY_DEFAULTS[key];
}

export function resolveTerm(profile: ResidenceProfile, key: ResidenceTermKey): string {
  return profile.terms[key]?.trim() || RESIDENCE_TERM_DEFAULTS[key];
}

function isGenericValue(key: ResidenceFieldKey, profile: ResidenceProfile): boolean {
  const generic = GENERIC_RESIDENCE_PROFILE;
  switch (key) {
    case 'structure.towersRequired':
      return profile.structure.towersRequired === generic.structure.towersRequired;
    case 'structure.propertyTowers':
      return profile.structure.propertyTowers.length === 0;
    case 'structure.parkingTowers':
      return profile.structure.parkingTowers.length === 0;
    case 'structure.floorsMax':
      return profile.structure.floorsMax === generic.structure.floorsMax;
    case 'occupancy.maxAdults':
      return profile.occupancy.maxAdultsCap === generic.occupancy.maxAdultsCap;
    case 'occupancy.maxChildren':
      return profile.occupancy.maxChildrenCap === generic.occupancy.maxChildrenCap;
    case 'stay.checkInTime':
      return profile.stay.checkInTime === generic.stay.checkInTime;
    case 'stay.checkOutTime':
      return profile.stay.checkOutTime === generic.stay.checkOutTime;
    case 'stay.petsAllowed':
      return profile.stay.petsAllowed === generic.stay.petsAllowed;
    case 'stay.paidParkingAvailable':
      return profile.stay.paidParkingAvailable === generic.stay.paidParkingAvailable;
    case 'stay.surpriseDecorAllowed':
      return profile.stay.surpriseDecorAllowed === generic.stay.surpriseDecorAllowed;
    case 'approvals.pmoEmail':
      return profile.approvals.pmoEmail === generic.approvals.pmoEmail;
    case 'verification.tier2BuildingProofRequired':
      return (
        profile.verification.tier2BuildingProofRequired ===
        generic.verification.tier2BuildingProofRequired
      );
    case 'structure.unitNumberFormat':
      return (
        profile.structure.unitNumberFormat.preset === generic.structure.unitNumberFormat.preset
      );
    case 'structure.parkingSlotFormat':
      return (
        profile.structure.parkingSlotFormat.preset === generic.structure.parkingSlotFormat.preset
      );
    default:
      return true;
  }
}

function residenceSource(
  key: ResidenceFieldKey,
  profile: ResidenceProfile
): 'residence' | 'generic' {
  return isGenericValue(key, profile) ? 'generic' : 'residence';
}

function clampToCap(
  value: number | null,
  cap: number
): { value: number; clamped: boolean; cap: number } {
  if (value === null) return { value: cap, clamped: false, cap };
  const rounded = Math.round(value);
  if (rounded > cap) return { value: cap, clamped: true, cap };
  return { value: Math.max(0, rounded), clamped: false, cap };
}

/** Building rules can only take an option away, never grant one the building forbids. */
function resolveAllowFlag(
  residenceAllows: boolean,
  propertyAllows: unknown,
  key: ResidenceFieldKey,
  profile: ResidenceProfile,
  policy: { ownership: ResidenceOwnership }
): ResolvedValue<boolean> {
  const property = typeof propertyAllows === 'boolean' ? propertyAllows : null;
  const value = residenceAllows && (property ?? true);
  const source = !residenceAllows
    ? residenceSource(key, profile)
    : property === false
      ? 'property'
      : residenceSource(key, profile);
  return { value, source, ownership: policy.ownership };
}

/**
 * Resolve one field. Property value first only when the ownership class allows it, clamped
 * to the building cap. Building rules (`locked`) ignore the property value, except the
 * allow-* flags where the building can only take an option away.
 */
export function resolvePropertyValue<K extends ResidenceFieldKey>(
  key: K,
  profile: ResidenceProfile,
  propertySettings: unknown
): ResolvedValue<
  K extends 'structure.towersRequired'
    ? boolean
    : K extends 'structure.propertyTowers'
      ? ResidenceTower[]
      : K extends 'structure.parkingTowers'
        ? ResidenceParkingTower[]
        : K extends 'structure.unitNumberFormat'
          ? ResidenceUnitNumberFormat
          : K extends 'structure.parkingSlotFormat'
            ? ResidenceParkingSlotFormat
            : K extends 'structure.floorsMax'
              ? number | null
              : K extends 'occupancy.maxAdults' | 'occupancy.maxChildren'
                ? number
                : K extends 'stay.checkInTime' | 'stay.checkOutTime' | 'approvals.pmoEmail'
                  ? string | null
                  : K extends
                        | 'stay.petsAllowed'
                        | 'stay.paidParkingAvailable'
                        | 'stay.surpriseDecorAllowed'
                        | 'verification.tier2BuildingProofRequired'
                    ? boolean
                    : never
> {
  const settings = asRecord(propertySettings) ?? {};
  const policy = RESIDENCE_FIELD_POLICY[key];

  const fallback = (): ResolvedValue<never> =>
    ({
      value: genericValue(key, profile),
      source: residenceSource(key, profile),
      ownership: policy.ownership,
    }) as ResolvedValue<never>;

  if (policy.ownership === 'locked') {
    if (key === 'stay.petsAllowed') {
      return resolveAllowFlag(
        profile.stay.petsAllowed,
        settings.allowPets,
        'stay.petsAllowed',
        profile,
        policy
      ) as ResolvedValue<never>;
    }
    if (key === 'stay.paidParkingAvailable') {
      return resolveAllowFlag(
        profile.stay.paidParkingAvailable,
        settings.allowParking,
        'stay.paidParkingAvailable',
        profile,
        policy
      ) as ResolvedValue<never>;
    }
    if (key === 'stay.surpriseDecorAllowed') {
      return resolveAllowFlag(
        profile.stay.surpriseDecorAllowed,
        settings.allowSurpriseDecor,
        'stay.surpriseDecorAllowed',
        profile,
        policy
      ) as ResolvedValue<never>;
    }
    return fallback();
  }

  if (policy.ownership === 'cap') {
    const propertyKey = policy.propertySetting as string;
    const stored = readNumber(settings, propertyKey);
    const cap =
      key === 'occupancy.maxAdults'
        ? profile.occupancy.maxAdultsCap
        : key === 'occupancy.maxChildren'
          ? profile.occupancy.maxChildrenCap
          : profile.structure.floorsMax;
    if (cap === null) {
      return {
        value: stored,
        source: stored === null ? residenceSource(key, profile) : 'property',
        ownership: policy.ownership,
      } as ResolvedValue<never>;
    }
    const clamped = clampToCap(stored, cap);
    return {
      value: clamped.value,
      source: clamped.clamped || stored === null ? residenceSource(key, profile) : 'property',
      ownership: policy.ownership,
      cap: clamped.cap,
      ...(clamped.clamped ? { clamped: true } : {}),
    } as ResolvedValue<never>;
  }

  // inherited
  if (key === 'stay.checkInTime' || key === 'stay.checkOutTime') {
    const stored = readString(settings, policy.propertySetting as string);
    const residenceValue =
      key === 'stay.checkInTime' ? profile.stay.checkInTime : profile.stay.checkOutTime;
    if (stored && /^([01]\d|2[0-3]):[0-5]\d$/.test(stored)) {
      return {
        value: stored,
        source: 'property',
        ownership: policy.ownership,
      } as ResolvedValue<never>;
    }
    return {
      value: residenceValue,
      source: residenceSource(key, profile),
      ownership: policy.ownership,
    } as ResolvedValue<never>;
  }

  return fallback();
}

function genericValue(key: ResidenceFieldKey, profile: ResidenceProfile): unknown {
  switch (key) {
    case 'structure.towersRequired':
      return profile.structure.towersRequired;
    case 'structure.propertyTowers':
      return profile.structure.propertyTowers;
    case 'structure.parkingTowers':
      return profile.structure.parkingTowers;
    case 'structure.unitNumberFormat':
      return profile.structure.unitNumberFormat;
    case 'structure.parkingSlotFormat':
      return profile.structure.parkingSlotFormat;
    case 'structure.floorsMax':
      return profile.structure.floorsMax;
    case 'occupancy.maxAdults':
      return profile.occupancy.maxAdultsCap;
    case 'occupancy.maxChildren':
      return profile.occupancy.maxChildrenCap;
    case 'stay.checkInTime':
      return profile.stay.checkInTime;
    case 'stay.checkOutTime':
      return profile.stay.checkOutTime;
    case 'stay.petsAllowed':
      return profile.stay.petsAllowed;
    case 'stay.paidParkingAvailable':
      return profile.stay.paidParkingAvailable;
    case 'stay.surpriseDecorAllowed':
      return profile.stay.surpriseDecorAllowed;
    case 'approvals.pmoEmail':
      return profile.approvals.pmoEmail;
    case 'verification.tier2BuildingProofRequired':
      return profile.verification.tier2BuildingProofRequired;
    default:
      return null;
  }
}

/**
 * Load and parse one residence. `strict` (default) turns a database error into a thrown
 * error: a transition must fail and retry, never silently resolve "no steps". Pass
 * `strict: false` only on read-only surfaces that can render a generic profile.
 */
export async function loadResidenceProfile(
  supabase: SupabaseClient,
  developmentId: string | null,
  options: { strict?: boolean } = {}
): Promise<ResidenceProfile> {
  const strict = options.strict ?? true;
  if (!developmentId) return parseResidenceProfile(null);

  const { data, error } = await supabase
    .from('developments')
    .select('id, name, slug, type, settings')
    .eq('id', developmentId)
    .maybeSingle();

  if (error) {
    console.warn('[residenceProfile] development load failed:', error.message);
    if (strict) {
      throw new Error("Could not load this residence's settings. Try again.");
    }
    return parseResidenceProfile(null);
  }

  return parseResidenceProfile(data);
}

// ---------------------------------------------------------------------------
// Structure: towers, unit and slot formats, parking levels
// ---------------------------------------------------------------------------

export type ResidenceParkingType = 'inside_tower' | 'outside_tower' | 'motorcycle';

export type ResidenceTowerValidation = { ok: true; tower: string } | { ok: false; error: string };

export function activePropertyTowers(profile: ResidenceProfile): ResidenceTower[] {
  return profile.structure.propertyTowers.filter((tower) => tower.active);
}

export function activeParkingTowers(profile: ResidenceProfile): ResidenceParkingTower[] {
  return profile.structure.parkingTowers.filter((tower) => tower.active);
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/**
 * `towersRequired: false` plus an empty list means the residence has no tower concept
 * (a subdivision lot, for example). A provided value is accepted as typed so the resolver
 * never becomes a hard lock; a configured list is enforced.
 */
export function validateTowerForProfile(
  profile: ResidenceProfile,
  rawValue: string
): ResidenceTowerValidation {
  const value = rawValue.trim();
  const towers = activePropertyTowers(profile);

  if (!value) {
    if (!profile.structure.towersRequired) return { ok: true, tower: '' };
    return { ok: false, error: `${profile.structure.towerLabel} is required` };
  }

  if (towers.length === 0) return { ok: true, tower: value };

  const match = towers.find((tower) => sameName(tower.name, value));
  if (match) return { ok: true, tower: match.name };

  return {
    ok: false,
    error: `${profile.structure.towerLabel} must be one of: ${towers.map((tower) => tower.name).join(', ')}`,
  };
}

const ALNUM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ./#-]{0,14}$/;
const SLOT_ALNUM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .-]{0,9}$/;

function compilePattern(pattern: string | undefined): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern);
  } catch {
    warnOnce('structure.pattern', 'invalid custom pattern, falling back to the preset');
    return null;
  }
}

function unitNumberPattern(format: ResidenceUnitNumberFormat): RegExp {
  switch (format.preset) {
    case 'digits4':
      return /^\d{4}$/;
    case 'digits':
      return /^\d{1,6}$/;
    case 'custom':
      return compilePattern(format.pattern) ?? ALNUM_PATTERN;
    case 'alnum':
    default:
      return ALNUM_PATTERN;
  }
}

function slotPattern(format: ResidenceParkingSlotFormat): RegExp {
  switch (format.preset) {
    case 'digits1to4':
      return /^\d{1,4}$/;
    case 'custom':
      return compilePattern(format.pattern) ?? SLOT_ALNUM_PATTERN;
    case 'alnum':
    default:
      return SLOT_ALNUM_PATTERN;
  }
}

export function unitNumberExample(profile: ResidenceProfile): string {
  return profile.structure.unitNumberFormat.example;
}

export function parkingSlotExample(profile: ResidenceProfile): string {
  return profile.structure.parkingSlotFormat.example;
}

/** Null when valid, otherwise a short host-facing message. */
export function unitNumberError(profile: ResidenceProfile, rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return 'Unit number is required';
  const format = profile.structure.unitNumberFormat;
  if (!unitNumberPattern(format).test(value)) {
    const example = format.example ? ` (example: ${format.example})` : '';
    return `Unit number does not match this residence's format${example}`;
  }
  return null;
}

/** Null when valid, otherwise a short host-facing message. */
export function parkingSlotError(profile: ResidenceProfile, rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return 'Slot number is required';
  const format = profile.structure.parkingSlotFormat;
  if (!slotPattern(format).test(value)) {
    const example = format.example ? ` (example: ${format.example})` : '';
    return `Slot number does not match this residence's format${example}`;
  }
  return null;
}

/** Digits-only presets strip punctuation as the host types; alnum presets keep the value. */
export function sanitizeSlotLabel(profile: ResidenceProfile, rawValue: string): string {
  const format = profile.structure.parkingSlotFormat;
  if (format.preset === 'digits1to4') return rawValue.replace(/\D/g, '').slice(0, 4);
  return rawValue.trim().slice(0, 20);
}

export function formatUnitLabel(
  _profile: ResidenceProfile,
  tower: string,
  unitNumber: string
): string {
  const towerTrim = tower.trim();
  const unitTrim = unitNumber.trim();
  return towerTrim ? `${towerTrim} ${unitTrim}` : unitTrim;
}

export function parkingLevelsForTower(profile: ResidenceProfile, towerName: string): string[] {
  const tower = profile.structure.parkingTowers.find((entry) => sameName(entry.name, towerName));
  return tower ? [...tower.levels] : [];
}

export function parkingTypeForTower(
  profile: ResidenceProfile,
  towerName: string
): ResidenceParkingType {
  const tower = profile.structure.parkingTowers.find((entry) => sameName(entry.name, towerName));
  return tower?.parkingType ?? 'inside_tower';
}

export function parkingTowerCode(profile: ResidenceProfile, towerName: string): string {
  const tower = profile.structure.parkingTowers.find((entry) => sameName(entry.name, towerName));
  return tower?.code?.trim() || '';
}

/**
 * Validates a parking location against the residence. A residence with no configured
 * parking towers falls back to accepting the value (it has no slot structure yet).
 */
export function parkingSlotLocationError(
  profile: ResidenceProfile,
  towerName: string,
  level: string
): string | null {
  const towers = activeParkingTowers(profile);
  if (towers.length === 0) return null;

  const tower = towers.find((entry) => sameName(entry.name, towerName));
  if (!tower) {
    return `Parking tower must be one of: ${towers.map((entry) => entry.name).join(', ')}`;
  }
  if (tower.levels.length > 0 && !tower.levels.some((entry) => sameName(entry, level))) {
    return `Level must be one of: ${tower.levels.join(', ')}`;
  }
  return null;
}

function levelShortCode(level: string): string {
  const match = level.trim().match(/^Level\s+(\d+)$/i);
  return match ? `L${match[1]}` : '';
}

/** e.g. `Monaco - Level 1 - Slot 26`; falls back to a plain join when a part is missing. */
export function formatParkingLocation(
  _profile: ResidenceProfile,
  tower: string,
  level: string,
  slotLabel: string
): string {
  const parts = [tower.trim(), level.trim(), slotLabel.trim()].filter(Boolean);
  if (parts.length < 2) return parts.join(' - ');
  return `${parts[0]} - ${parts[1]} - Slot ${parts[2]}`;
}

/** Compact code for narrow UI, e.g. `ML1S26`. Empty when the tower has no code. */
export function formatParkingCodeForProfile(
  profile: ResidenceProfile,
  tower: string,
  level: string,
  slotLabel: string
): string {
  const towerCode = parkingTowerCode(profile, tower);
  const levelCode = levelShortCode(level);
  const slot = slotLabel.trim();
  if (!towerCode || !levelCode || !slot) return '';
  return `${towerCode}${levelCode}S${slot}`;
}

/**
 * Load the profile for an existing property, by `development_id` when linked and by the
 * denormalized `residence_name` for rows the Phase 0 backfill could not match.
 */
export async function loadResidenceProfileForProperty(
  supabase: SupabaseClient,
  propertyId: string,
  options: { strict?: boolean } = {}
): Promise<ResidenceProfile> {
  const strict = options.strict ?? true;
  const { data, error } = await supabase
    .from('properties')
    .select('development_id, residence_name')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    console.warn('[residenceProfile] property load failed:', error.message);
    if (strict) throw new Error("Could not load this property's residence. Try again.");
    return parseResidenceProfile(null);
  }

  const developmentId = (data as { development_id?: string | null } | null)?.development_id ?? null;
  if (developmentId) return loadResidenceProfile(supabase, developmentId, options);

  const residenceName = (data as { residence_name?: string | null } | null)?.residence_name ?? '';
  return loadResidenceProfileForResidence(supabase, { residenceName }, options);
}

export async function loadResidenceProfileForParking(
  supabase: SupabaseClient,
  parkingId: string,
  options: { strict?: boolean } = {}
): Promise<ResidenceProfile> {
  const strict = options.strict ?? true;
  const { data, error } = await supabase
    .from('parkings')
    .select('development_id, residence_name')
    .eq('id', parkingId)
    .maybeSingle();

  if (error) {
    console.warn('[residenceProfile] parking load failed:', error.message);
    if (strict) throw new Error("Could not load this parking's residence. Try again.");
    return parseResidenceProfile(null);
  }

  const developmentId = (data as { development_id?: string | null } | null)?.development_id ?? null;
  if (developmentId) return loadResidenceProfile(supabase, developmentId, options);

  const residenceName = (data as { residence_name?: string | null } | null)?.residence_name ?? '';
  return loadResidenceProfileForResidence(supabase, { residenceName }, options);
}

/** Profile for a create/update request that knows a development id or a residence name. */
export async function loadResidenceProfileForResidence(
  supabase: SupabaseClient,
  input: { developmentId?: string | null; residenceName?: string | null },
  options: { strict?: boolean } = {}
): Promise<ResidenceProfile> {
  const strict = options.strict ?? true;
  const developmentId = input.developmentId?.trim();
  if (developmentId) return loadResidenceProfile(supabase, developmentId, options);

  const residenceName = input.residenceName?.trim();
  if (!residenceName) return parseResidenceProfile(null);

  const { data, error } = await supabase
    .from('developments')
    .select('id, name, slug, type, settings')
    .eq('name', residenceName)
    .maybeSingle();

  if (error) {
    console.warn('[residenceProfile] residence name lookup failed:', error.message);
    if (strict) throw new Error("Could not load this residence's settings. Try again.");
    return parseResidenceProfile(null);
  }

  return parseResidenceProfile(data);
}

function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

/**
 * Settings and address for a NEW property or parking in this residence. Null when the
 * residence has no location data, which leaves the host to place the pin.
 */
export function residenceLocationSeed(
  profile: ResidenceProfile
): { address: string; settings: Record<string, unknown> } | null {
  const { latitude, longitude } = profile.location;
  if (latitude === null || longitude === null) return null;
  return {
    address: profile.location.address ?? '',
    settings: {
      city: profile.location.city ?? '',
      province: profile.location.province ?? '',
      country: profile.location.country ?? 'Philippines',
      zipCode: profile.location.zipCode ?? '',
      latitude,
      longitude,
      mapsUrl: mapsUrl(latitude, longitude),
      placeId: '',
    },
  };
}

/** Normalise a raw `settings.structure` payload. Total: malformed input degrades. */
export function normalizeResidenceStructure(raw: unknown): ResidenceProfile['structure'] {
  return parseResidenceProfile({ settings: { structure: raw } }).structure;
}

/**
 * Save-time validation for the super-admin Structure editor. Returns a short message or
 * null. Structural validity only; it never decides policy.
 */
export function validateResidenceStructure(
  structure: ResidenceProfile['structure']
): string | null {
  if (structure.towerLabel.trim().length > 40) return 'Tower label is too long';
  if (structure.unitLabel.trim().length > 40) return 'Unit label is too long';
  if (structure.towerLabel.trim().length === 0) return 'Tower label cannot be empty';
  if (structure.unitLabel.trim().length === 0) return 'Unit label cannot be empty';

  if (structure.propertyTowers.length > 60) return 'Too many towers';

  const towerNames = new Set<string>();
  for (const tower of structure.propertyTowers) {
    const name = tower.name.trim();
    if (!name) return 'Every tower needs a name';
    if (name.length > 40) return 'Tower names must be 40 characters or fewer';
    const key = name.toLowerCase();
    if (towerNames.has(key)) return `Duplicate tower: ${name}`;
    towerNames.add(key);
  }

  const parkingNames = new Set<string>();
  for (const tower of structure.parkingTowers) {
    const name = tower.name.trim();
    if (!name) return 'Every parking tower needs a name';
    if (name.length > 40) return 'Parking tower names must be 40 characters or fewer';
    const key = name.toLowerCase();
    if (parkingNames.has(key)) return `Duplicate parking tower: ${name}`;
    parkingNames.add(key);

    const levels = new Set<string>();
    for (const level of tower.levels) {
      const trimmed = level.trim();
      if (!trimmed) return `Remove the empty level under ${name}`;
      if (levels.has(trimmed.toLowerCase())) return `Duplicate level under ${name}: ${trimmed}`;
      levels.add(trimmed.toLowerCase());
    }
  }

  const unitError = validateFormatPreset(
    structure.unitNumberFormat.preset,
    'Unit format',
    UNIT_FORMAT_PRESETS
  );
  if (unitError) return unitError;
  const slotError = validateFormatPreset(
    structure.parkingSlotFormat.preset,
    'Slot format',
    SLOT_FORMAT_PRESETS
  );
  if (slotError) return slotError;

  if (!structure.unitNumberFormat.example.trim()) return 'Add a unit number example';
  if (!structure.parkingSlotFormat.example.trim()) return 'Add a slot number example';

  if (structure.unitNumberFormat.preset === 'custom') {
    const pattern = structure.unitNumberFormat.pattern ?? '';
    if (pattern) {
      const checked = compilePattern(pattern);
      if (!checked) return 'Unit format pattern is not a valid regular expression';
      if (!checked.test(structure.unitNumberFormat.example.trim())) {
        return 'Unit format example does not match the pattern';
      }
    }
  }
  if (structure.parkingSlotFormat.preset === 'custom') {
    const pattern = structure.parkingSlotFormat.pattern ?? '';
    if (pattern) {
      const checked = compilePattern(pattern);
      if (!checked) return 'Slot format pattern is not a valid regular expression';
      if (!checked.test(structure.parkingSlotFormat.example.trim())) {
        return 'Slot format example does not match the pattern';
      }
    }
  }

  if (
    structure.floorsMax !== null &&
    (!Number.isFinite(structure.floorsMax) || structure.floorsMax < 1 || structure.floorsMax > 200)
  ) {
    return 'Floors must be between 1 and 200';
  }

  return null;
}

const UNIT_FORMAT_PRESETS = new Set(['digits4', 'digits', 'alnum', 'custom']);
const SLOT_FORMAT_PRESETS = new Set(['digits1to4', 'alnum', 'custom']);

function validateFormatPreset(preset: string, label: string, allowed: Set<string>): string | null {
  return allowed.has(preset) ? null : `${label} preset is not supported`;
}

// #endregion shared-core
