/**
 * Host-side shape and validation for the structured arrival essentials (plan D7, task 7.3).
 *
 * Kept apart from `guestEssentials.ts` (the guest read path) because the two answer different
 * questions: this one validates what a host saves, that one withholds what a guest may see.
 * Separate files also keep the validators importable without the storage / settings stack.
 */

/** Field → column, in the order the editor renders. */
export const ESSENTIALS_FIELDS = {
  wifiName: 'wifi_name',
  wifiPassword: 'wifi_password',
  doorCode: 'door_code',
  unitFloor: 'unit_floor',
  parkingSlotNote: 'parking_slot_note',
  emergencyContactName: 'emergency_contact_name',
  emergencyContactPhone: 'emergency_contact_phone',
  buildingSecurityPhone: 'building_security_phone',
  garbageSchedule: 'garbage_schedule',
  quietHours: 'quiet_hours',
} as const;

export type EssentialsFieldKey = keyof typeof ESSENTIALS_FIELDS;

export const ESSENTIALS_MAX_LENGTH: Record<EssentialsFieldKey, number> = {
  wifiName: 120,
  wifiPassword: 120,
  doorCode: 60,
  unitFloor: 120,
  parkingSlotNote: 240,
  emergencyContactName: 120,
  emergencyContactPhone: 40,
  buildingSecurityPhone: 40,
  garbageSchedule: 160,
  quietHours: 120,
};

export const DEFAULT_REVEAL_LEAD_HOURS = 24;
export const MAX_REVEAL_LEAD_HOURS = 720;

/** Columns to select when reading the row back for the editor. */
export const ESSENTIALS_SELECT_COLUMNS =
  'wifi_name, wifi_password, door_code, unit_floor, parking_slot_note, emergency_contact_name, emergency_contact_phone, building_security_phone, garbage_schedule, quiet_hours, reveal_lead_hours';

export type GuestEssentialsAdminDto = Record<EssentialsFieldKey, string> & {
  revealLeadHours: number;
};

type Row = Record<string, unknown>;

/** Row → editor DTO. Missing cells become empty strings, not "undefined". */
export function toEssentialsAdminDto(row: Row | null | undefined): GuestEssentialsAdminDto {
  const out = {} as GuestEssentialsAdminDto;
  for (const [field, column] of Object.entries(ESSENTIALS_FIELDS) as Array<
    [EssentialsFieldKey, string]
  >) {
    const value = row?.[column];
    out[field] = typeof value === 'string' ? value : '';
  }
  const lead = Number(row?.reveal_lead_hours);
  out.revealLeadHours =
    Number.isFinite(lead) && lead >= 0 && lead <= MAX_REVEAL_LEAD_HOURS
      ? lead
      : DEFAULT_REVEAL_LEAD_HOURS;
  return out;
}

/** Control characters that have no place in a name, a password or a phone number. */
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

export type EssentialsPatchResult = {
  /** Column → value, ready to upsert. Empty when nothing was sent. */
  patch: Record<string, string | number>;
  /** Which fields the request changed, for the activity event. */
  changed: EssentialsFieldKey[];
  /** Human-readable reason the patch is rejected. */
  error?: string;
};

/**
 * Validates and trims a PATCH body.
 *
 * Only fields present in `raw` are written, so a request may update one field without
 * clearing the rest. `null` is treated as "clear this field".
 */
export function buildEssentialsPatch(raw: Record<string, unknown>): EssentialsPatchResult {
  const patch: Record<string, string | number> = {};
  const changed: EssentialsFieldKey[] = [];

  for (const [field, column] of Object.entries(ESSENTIALS_FIELDS) as Array<
    [EssentialsFieldKey, string]
  >) {
    if (!(field in raw)) continue;
    const value = raw[field];
    if (value !== null && typeof value !== 'string') {
      return { patch: {}, changed: [], error: `${field} must be text` };
    }
    const trimmed = String(value ?? '').trim();
    if (trimmed.length > ESSENTIALS_MAX_LENGTH[field]) {
      return { patch: {}, changed: [], error: `${field} is too long` };
    }
    if (CONTROL_CHARS.test(trimmed)) {
      return { patch: {}, changed: [], error: `${field} contains invalid characters` };
    }
    patch[column] = trimmed;
    changed.push(field);
  }

  if ('revealLeadHours' in raw) {
    const rawLead = raw.revealLeadHours;
    const lead = typeof rawLead === 'number' ? rawLead : Number(rawLead);
    if (rawLead === null || rawLead === '' || !Number.isFinite(lead)) {
      return { patch: {}, changed: [], error: 'Reveal lead must be a number of hours' };
    }
    if (lead < 0 || lead > MAX_REVEAL_LEAD_HOURS) {
      return {
        patch: {},
        changed: [],
        error: `Reveal lead must be between 0 and ${MAX_REVEAL_LEAD_HOURS} hours`,
      };
    }
    patch.reveal_lead_hours = Math.round(lead);
  }

  return { patch, changed };
}
