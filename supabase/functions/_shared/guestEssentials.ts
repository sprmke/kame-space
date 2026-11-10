/**
 * Structured arrival essentials for a booking (plan D7).
 *
 * Wi-Fi password and door code are secrets. They live in their own table — never in
 * `properties.settings`, which every public listing read returns — and are withheld until
 * the reveal time, which is the property's check-in moment minus `reveal_lead_hours`.
 *
 * Per-booking overrides (a rotating door code) are merged on top, so a host never has to
 * change the property default for one stay.
 */

import { createServiceClient } from './orgAuth.ts';
import { manilaCheckInInstant } from './cancellationRefund.ts';

export type GuestEssentialsDto = {
  wifiName: string | null;
  /** Withheld (`null`) until the reveal time. */
  wifiPassword: string | null;
  /** Withheld (`null`) until the reveal time. */
  doorCode: string | null;
  unitFloor: string | null;
  parkingSlotNote: string | null;
  /**
   * Whether a door code exists at all. The value itself stays hidden until the reveal, so
   * without this the page cannot tell "no code for this property" apart from "not yet".
   */
  hasDoorCode: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  buildingSecurityPhone: string | null;
  garbageSchedule: string | null;
  quietHours: string | null;
  /** ISO timestamp the secrets become readable, or `null` when they already are. */
  revealAt: string | null;
  /** True when the property has at least one field worth showing. */
  hasAny: boolean;
};

type EssentialsRow = {
  wifi_name?: string | null;
  wifi_password?: string | null;
  door_code?: string | null;
  unit_floor?: string | null;
  parking_slot_note?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  building_security_phone?: string | null;
  garbage_schedule?: string | null;
  quiet_hours?: string | null;
  reveal_lead_hours?: number | null;
};

export type EssentialsOverride = {
  wifiName?: string | null;
  wifiPassword?: string | null;
  doorCode?: string | null;
  unitFloor?: string | null;
  parkingSlotNote?: string | null;
};

const DEFAULT_REVEAL_LEAD_HOURS = 24;

function str(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s || null;
}

/** Reads the per-booking override, ignoring anything that is not a string. */
export function parseEssentialsOverride(raw: unknown): EssentialsOverride {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const out: EssentialsOverride = {};
  const keys: Array<keyof EssentialsOverride> = [
    'wifiName',
    'wifiPassword',
    'doorCode',
    'unitFloor',
    'parkingSlotNote',
  ];
  for (const key of keys) {
    const value = str(record[key]);
    if (value) out[key] = value;
  }
  return out;
}

/**
 * The reveal moment for a booking's secrets.
 *
 * Returns `null` when the check-in date cannot be read, which reveals nothing. A booking
 * that has already started is past its reveal time, so the secrets are available.
 *
 * The lead is clamped to 0..720 hours: a negative value reveals exactly at check-in rather
 * than earlier, and 30 days is the longest a host may hand the code out in advance.
 */
export function resolveEssentialsRevealAt(
  checkInDate: string,
  checkInTime: string | null | undefined,
  revealLeadHours: number | null | undefined
): Date | null {
  const checkIn = manilaCheckInInstant(checkInDate, checkInTime);
  if (!checkIn) return null;
  const lead =
    typeof revealLeadHours === 'number' && Number.isFinite(revealLeadHours)
      ? Math.min(Math.max(revealLeadHours, 0), 720)
      : DEFAULT_REVEAL_LEAD_HOURS;
  return new Date(checkIn.getTime() - lead * 3_600_000);
}

/**
 * Builds the guest-facing essentials for a booking.
 *
 * `now` is injected so the reveal rule can be tested with a fixed clock.
 */
export function buildGuestEssentialsDto(input: {
  row: EssentialsRow;
  override?: EssentialsOverride;
  checkInDate: string;
  checkInTime: string | null | undefined;
  now: Date;
}): GuestEssentialsDto | null {
  const row = input.row;
  const override = input.override ?? {};
  const revealAt = resolveEssentialsRevealAt(
    input.checkInDate,
    input.checkInTime,
    row.reveal_lead_hours
  );
  const revealed = revealAt !== null && input.now.getTime() >= revealAt.getTime();

  const wifiName = override.wifiName ?? str(row.wifi_name);
  const unitFloor = override.unitFloor ?? str(row.unit_floor);
  const parkingSlotNote = override.parkingSlotNote ?? str(row.parking_slot_note);
  const emergencyContactName = str(row.emergency_contact_name);
  const emergencyContactPhone = str(row.emergency_contact_phone);
  const buildingSecurityPhone = str(row.building_security_phone);
  const garbageSchedule = str(row.garbage_schedule);
  const quietHours = str(row.quiet_hours);

  const rawWifiPassword = override.wifiPassword ?? str(row.wifi_password);
  const rawDoorCode = override.doorCode ?? str(row.door_code);

  const hasAny = Boolean(
    wifiName ||
      rawWifiPassword ||
      rawDoorCode ||
      unitFloor ||
      parkingSlotNote ||
      emergencyContactName ||
      emergencyContactPhone ||
      buildingSecurityPhone ||
      garbageSchedule ||
      quietHours
  );
  if (!hasAny) return null;

  return {
    wifiName,
    wifiPassword: revealed ? rawWifiPassword : null,
    doorCode: revealed ? rawDoorCode : null,
    unitFloor,
    parkingSlotNote,
    hasDoorCode: Boolean(rawDoorCode),
    emergencyContactName,
    emergencyContactPhone,
    buildingSecurityPhone,
    garbageSchedule,
    quietHours,
    // Only meaningful while something is still hidden.
    revealAt: !revealed && revealAt ? revealAt.toISOString() : null,
    hasAny,
  };
}

/** Loads and gates the essentials for one booking. Returns `null` when the property has none. */
export async function loadGuestEssentials(input: {
  propertyId: string;
  booking: {
    check_in_date?: unknown;
    check_in_time?: unknown;
    guest_essentials_override?: unknown;
  };
  now?: Date;
}): Promise<GuestEssentialsDto | null> {
  const propertyId = String(input.propertyId ?? '').trim();
  if (!propertyId) return null;

  const { data, error } = await createServiceClient()
    .from('property_guest_essentials')
    .select(
      'wifi_name, wifi_password, door_code, unit_floor, parking_slot_note, emergency_contact_name, emergency_contact_phone, building_security_phone, garbage_schedule, quiet_hours, reveal_lead_hours'
    )
    .eq('property_id', propertyId)
    .maybeSingle();

  if (error) {
    console.warn('[guestEssentials] load failed:', error.message);
    return null;
  }
  if (!data) return null;

  return buildGuestEssentialsDto({
    row: data as EssentialsRow,
    override: parseEssentialsOverride(input.booking.guest_essentials_override),
    checkInDate: String(input.booking.check_in_date ?? ''),
    checkInTime: (input.booking.check_in_time as string | null | undefined) ?? null,
    now: input.now ?? new Date(),
  });
}
