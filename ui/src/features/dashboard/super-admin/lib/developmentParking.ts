const LEGACY_PARKING_LEVEL_MAP: Record<string, string> = {
  B1: 'Level 1',
  B2: 'Level 2',
  B3: 'Level 3',
  G: 'Level 1',
  Ground: 'Level 1',
  '1st floor': 'Level 1',
  '2nd floor': 'Level 2',
  '3rd floor': 'Level 3',
  '2nd Floor': 'Level 2',
  '3rd Floor': 'Level 3',
};

export function normalizeDevelopmentParkingLevel(level: string): string {
  const trimmed = level.trim();
  return LEGACY_PARKING_LEVEL_MAP[trimmed] ?? trimmed;
}

export function normalizeDevelopmentParkingLevels(levels: string[]): string[] {
  return levels
    .map(normalizeDevelopmentParkingLevel)
    .filter((level, index, list) => level.length > 0 && list.indexOf(level) === index);
}

const AZURE_RESIDENCE_NAMES = new Set(['azure north residences', 'azure north']);

/**
 * Legacy fallback for rows that predate `settings.structure`. Every current development
 * reads its levels from the structure; this only keeps an old Azure row editable.
 */
export function defaultParkingLevelsForDevelopment(developmentName: string): readonly string[] {
  return AZURE_RESIDENCE_NAMES.has(developmentName.trim().toLowerCase())
    ? ['Level 1', 'Level 2', 'Level 3']
    : [];
}

export function readDevelopmentParkingLevels(
  developmentName: string,
  storedLevels: string[]
): string[] {
  const normalized = normalizeDevelopmentParkingLevels(storedLevels);
  if (normalized.length > 0) return normalized;

  const defaults = defaultParkingLevelsForDevelopment(developmentName);
  return defaults.length > 0 ? [...defaults] : [];
}
