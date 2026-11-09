import type { SupabaseClient } from './supabaseJs.ts';
import {
  activeParkingTowers,
  parkingSlotError,
  parkingSlotLocationError,
  parkingTypeForTower,
  sanitizeSlotLabel,
  type ResidenceParkingType,
  type ResidenceProfile,
} from './residenceProfile.ts';
import {
  AZURE_NORTH_PARKING_TOWERS,
  DEFAULT_PARKING_RESIDENCE_NAME,
  getParkingLevelsForTower,
  inferParkingTypeForTower,
  isAzureNorthParkingTower,
  isParkingType,
  isValidParkingLevelForTower,
  isValidParkingSlotNumber,
  normalizeParkingLevel,
  sanitizeParkingSlotNumber,
  type ParkingType,
} from './parkingResidences.ts';

export const DUPLICATE_PARKING_SLOT_MESSAGE =
  'A parking slot with this residence, tower, level, and label already exists';

export type ParsedParkingSlotWithProfile =
  | {
      ok: true;
      tower: string;
      level: string;
      slotLabel: string;
      parkingType: ResidenceParkingType;
    }
  | { ok: false; error: string };

/**
 * Residence-aware parking slot parser. A residence with no configured parking towers
 * accepts any tower/level so a building without a slot structure is never locked out.
 */
export function parseParkingSlotWithProfile(
  body: Record<string, unknown>,
  profile: ResidenceProfile
): ParsedParkingSlotWithProfile {
  const tower = typeof body.tower === 'string' ? body.tower.trim() : '';
  const level = typeof body.level === 'string' ? body.level.trim() : '';
  const slotLabelRaw =
    typeof body.slotLabel === 'string'
      ? body.slotLabel.trim()
      : typeof body.slotNumber === 'string' || typeof body.slotNumber === 'number'
        ? String(body.slotNumber).trim()
        : '';
  const parkingTypeRaw =
    typeof body.parkingType === 'string'
      ? body.parkingType.trim()
      : typeof body.type === 'string'
        ? body.type.trim()
        : '';

  if (!tower || !level || !slotLabelRaw) {
    return { ok: false, error: 'Tower, level, and slot number are required' };
  }

  const locationMessage = parkingSlotLocationError(profile, tower, level);
  if (locationMessage) return { ok: false, error: locationMessage };

  const slotLabel = sanitizeSlotLabel(profile, slotLabelRaw);
  const slotMessage = parkingSlotError(profile, slotLabel);
  if (slotMessage) return { ok: false, error: slotMessage };

  const configured = activeParkingTowers(profile).length > 0;
  const parkingType = parkingTypeRaw
    ? parkingTypeRaw === 'outside_tower' ||
      parkingTypeRaw === 'motorcycle' ||
      parkingTypeRaw === 'inside_tower'
      ? (parkingTypeRaw as ResidenceParkingType)
      : null
    : configured
      ? parkingTypeForTower(profile, tower)
      : null;

  if (!parkingType) return { ok: false, error: 'Invalid parking type' };

  return { ok: true, tower, level, slotLabel, parkingType };
}

export type ParsedParkingSlot =
  | {
      ok: true;
      residenceName: string;
      tower: string;
      level: string;
      slotLabel: string;
      parkingType: ParkingType;
    }
  | { ok: false; error: string };

function normalizeSlotLabel(value: string): string {
  return sanitizeParkingSlotNumber(value);
}

export function parseParkingSlotFromBody(body: Record<string, unknown>): ParsedParkingSlot {
  const residenceName =
    (typeof body.residenceName === 'string' ? body.residenceName.trim() : '') ||
    DEFAULT_PARKING_RESIDENCE_NAME;
  const tower = typeof body.tower === 'string' ? body.tower.trim() : '';
  const level = normalizeParkingLevel(typeof body.level === 'string' ? body.level.trim() : '');
  const slotLabelRaw =
    typeof body.slotLabel === 'string'
      ? body.slotLabel.trim()
      : typeof body.slotNumber === 'string' || typeof body.slotNumber === 'number'
        ? String(body.slotNumber).trim()
        : '';
  const parkingTypeRaw =
    typeof body.parkingType === 'string'
      ? body.parkingType.trim()
      : typeof body.type === 'string'
        ? body.type.trim()
        : '';

  if (!tower || !level || !slotLabelRaw) {
    return { ok: false, error: 'Tower, level, and slot number are required' };
  }
  if (!isAzureNorthParkingTower(tower)) {
    return { ok: false, error: `Tower must be one of: ${AZURE_NORTH_PARKING_TOWERS.join(', ')}` };
  }
  if (!isValidParkingLevelForTower(tower, level)) {
    return {
      ok: false,
      error: `Level must be one of: ${getParkingLevelsForTower(tower).join(', ')}`,
    };
  }

  const slotLabel = normalizeSlotLabel(slotLabelRaw);
  if (!isValidParkingSlotNumber(slotLabel)) {
    return { ok: false, error: 'Slot number must be 1–4 digits' };
  }

  const parkingType = parkingTypeRaw
    ? isParkingType(parkingTypeRaw)
      ? parkingTypeRaw
      : null
    : inferParkingTypeForTower(tower);
  if (!parkingType) {
    return { ok: false, error: 'Invalid parking type' };
  }

  return {
    ok: true,
    residenceName,
    tower,
    level,
    slotLabel,
    parkingType,
  };
}

export async function findParkingSlotConflict(
  supabase: SupabaseClient,
  residenceName: string,
  tower: string,
  level: string,
  slotLabel: string,
  excludeParkingId?: string,
  developmentId?: string | null
): Promise<boolean> {
  let query = supabase
    .from('parkings')
    .select('id')
    .eq('tower', tower)
    .eq('level', level)
    .eq('slot_label', normalizeSlotLabel(slotLabel))
    .limit(1);

  // Prefer the real FK; fall back to the denormalized name for unlinked rows.
  if (developmentId) {
    query = query.eq('development_id', developmentId);
  } else {
    query = query.eq('residence_name', residenceName);
  }

  if (excludeParkingId) {
    query = query.neq('id', excludeParkingId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[parkingSlotUnit] conflict lookup:', error.message);
    throw new Error('Failed to verify parking slot availability');
  }
  return (data?.length ?? 0) > 0;
}

/** Merge host_modes on org when a new asset type is added. */
export async function ensureOrgHostMode(
  supabase: SupabaseClient,
  orgId: string,
  mode: 'property' | 'parking'
): Promise<void> {
  const { data, error } = await supabase
    .from('organizations')
    .select('host_modes')
    .eq('id', orgId)
    .maybeSingle();
  if (error || !data) return;

  const current = Array.isArray(data.host_modes) ? (data.host_modes as string[]) : [];
  if (current.includes(mode)) return;

  const { error: updateError } = await supabase
    .from('organizations')
    .update({ host_modes: [...current, mode], updated_at: new Date().toISOString() })
    .eq('id', orgId);
  if (updateError) {
    console.error('[parkingSlotUnit] ensureOrgHostMode:', updateError.message);
  }
}
