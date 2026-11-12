import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { SupabaseClient } from './supabaseJs.ts';
import {
  GENERIC_RESIDENCE_PROFILE,
  formatParkingCodeForProfile,
  formatParkingLocation,
  loadResidenceProfile,
  parkingLevelsForTower,
  parkingSlotError,
  parkingSlotLocationError,
  parkingTypeForTower,
  parseResidenceProfile,
  residenceLocationSeed,
  resolvePropertyValue,
  sanitizeSlotLabel,
  normalizeResidenceStructure,
  unitNumberError,
  validateResidenceStructure,
  validateTowerForProfile,
} from './residenceProfile.ts';

Deno.test('parseResidenceProfile: null row is generic and has no building approvals', () => {
  const profile = parseResidenceProfile(null);

  assertEquals(profile.developmentId, null);
  assertEquals(profile.developmentName, null);
  assertEquals(profile.approvals.documentRequirements, []);
  assertEquals(profile.approvals.pmoEmail, null);
  assertEquals(profile.structure.propertyTowers, []);
});

Deno.test('parseResidenceProfile: malformed values degrade, never throw', () => {
  for (const settings of ['nope', 7, [], { structure: false, occupancy: 'x', stay: [] }]) {
    const profile = parseResidenceProfile({ id: 'dev-1', name: 'Somewhere', settings });
    assertEquals(profile.stay.checkInTime, GENERIC_RESIDENCE_PROFILE.stay.checkInTime);
    assertEquals(profile.occupancy.maxAdultsCap, GENERIC_RESIDENCE_PROFILE.occupancy.maxAdultsCap);
  }
});

Deno.test('parseResidenceProfile: caps above MAX_GUESTS are clamped', () => {
  const profile = parseResidenceProfile({
    id: 'dev-1',
    settings: { occupancy: { maxAdultsCap: 50 } },
  });

  assertEquals(profile.occupancy.maxAdultsCap, 5);
});

Deno.test('resolvePropertyValue: property value above the cap is clamped at read', () => {
  const profile = parseResidenceProfile({
    id: 'dev-1',
    settings: { occupancy: { maxAdultsCap: 3 } },
  });

  const resolved = resolvePropertyValue('occupancy.maxAdults', profile, { maxAdults: 9 });

  assertEquals(resolved.value, 3);
  assertEquals(resolved.clamped, true);
});

Deno.test('loadResidenceProfile: no development id returns the generic profile', async () => {
  const profile = await loadResidenceProfile({} as SupabaseClient, null);

  assertEquals(profile.developmentId, null);
  assertEquals(profile.approvals.documentRequirements, []);
});

Deno.test(
  'loadResidenceProfile: a load error throws in strict mode (never skips steps)',
  async () => {
    const failing = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'connection reset' } }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await assertRejects(
      () => loadResidenceProfile(failing, 'dev-1'),
      Error,
      "Could not load this residence's settings. Try again."
    );
  }
);

Deno.test('loadResidenceProfile: non-strict read surfaces get the generic profile', async () => {
  const failing = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: { message: 'connection reset' } }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const profile = await loadResidenceProfile(failing, 'dev-1', { strict: false });

  assertEquals(profile.developmentId, null);
});

Deno.test('loadResidenceProfile: parses a development row', async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'dev-1',
              name: 'Test Residence',
              slug: 'test-residence',
              type: 'SUBDIVISION',
              settings: {
                structure: {
                  towersRequired: false,
                  unitLabel: 'Lot',
                  unitNumberFormat: { preset: 'alnum', example: 'B12 L4' },
                },
                stay: { petsAllowed: false },
                occupancy: { maxAdultsCap: 2 },
              },
            },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const profile = await loadResidenceProfile(client, 'dev-1');

  assertEquals(profile.developmentName, 'Test Residence');
  assertEquals(profile.developmentType, 'SUBDIVISION');
  assertEquals(profile.structure.towersRequired, false);
  assertEquals(profile.structure.unitLabel, 'Lot');
  assertEquals(profile.stay.petsAllowed, false);
  assertEquals(profile.occupancy.maxAdultsCap, 2);
});

const AZURE_STRUCTURE = {
  id: 'dev-azure',
  name: 'Azure North Residences',
  type: 'CONDOMINIUM',
  settings: {
    structure: {
      towerLabel: 'Tower',
      unitLabel: 'Unit',
      towersRequired: true,
      propertyTowers: [
        { name: 'Monaco', code: 'Monaco', active: true },
        { name: 'Bali', code: 'Bali', active: true },
      ],
      parkingTowers: [
        {
          name: 'Monaco',
          code: 'M',
          active: true,
          levels: ['Level 1', 'Level 2'],
          parkingType: 'inside_tower',
        },
        {
          name: 'Bay',
          code: 'BY',
          active: true,
          levels: ['Level 1'],
          parkingType: 'outside_tower',
        },
      ],
      unitNumberFormat: { preset: 'digits4', example: '2604' },
      parkingSlotFormat: { preset: 'digits1to4', example: '26' },
      floorsMax: 29,
    },
  },
};

const AZURE_PROFILE = parseResidenceProfile(AZURE_STRUCTURE);

const GENERIC_PROFILE = parseResidenceProfile({ id: 'dev-lot', type: 'SUBDIVISION', settings: {} });

Deno.test('structure: 4-digit preset rejects letters and short units', () => {
  assertEquals(unitNumberError(AZURE_PROFILE, '12A'), 'Unit number does not match this residence\'s format (example: 2604)');
  assertEquals(unitNumberError(AZURE_PROFILE, '123'), 'Unit number does not match this residence\'s format (example: 2604)');
  assertEquals(unitNumberError(AZURE_PROFILE, '0101'), null);
});

Deno.test('structure: a generic residence accepts an alphanumeric lot number', () => {
  assertEquals(unitNumberError(GENERIC_PROFILE, 'Blk 3 Lot 5'), null);
  assertEquals(unitNumberError(GENERIC_PROFILE, ''), 'Unit number is required');
});

Deno.test('structure: tower list is enforced case-insensitively, empty list is permissive', () => {
  assertEquals(validateTowerForProfile(AZURE_PROFILE, 'monaco'), { ok: true, tower: 'Monaco' });
  assertEquals(validateTowerForProfile(AZURE_PROFILE, 'Bali'), { ok: true, tower: 'Bali' });
  const rejected = validateTowerForProfile(AZURE_PROFILE, 'Bay');
  assertEquals(rejected.ok, false);

  assertEquals(validateTowerForProfile(GENERIC_PROFILE, ''), { ok: true, tower: '' });
  assertEquals(validateTowerForProfile(GENERIC_PROFILE, 'Phase 2'), { ok: true, tower: 'Phase 2' });
});

Deno.test('structure: required towers reject an empty value', () => {
  const required = parseResidenceProfile({
    id: 'dev-1',
    settings: { structure: { towersRequired: true, propertyTowers: [] } },
  });

  const result = validateTowerForProfile(required, '');
  assertEquals(result.ok, false);
});

Deno.test('structure: parking levels and type come from the residence', () => {
  assertEquals(parkingLevelsForTower(AZURE_PROFILE, 'Bay'), ['Level 1']);
  assertEquals(parkingLevelsForTower(AZURE_PROFILE, 'Monaco'), ['Level 1', 'Level 2']);
  assertEquals(parkingTypeForTower(AZURE_PROFILE, 'Bay'), 'outside_tower');
  assertEquals(parkingTypeForTower(AZURE_PROFILE, 'Monaco'), 'inside_tower');
  assertEquals(parkingSlotLocationError(AZURE_PROFILE, 'Bali', 'Level 1') !== null, true);
  assertEquals(parkingSlotLocationError(AZURE_PROFILE, 'Bay', 'Level 2') !== null, true);
  assertEquals(parkingSlotLocationError(AZURE_PROFILE, 'Bay', 'Level 1'), null);
  assertEquals(parkingSlotLocationError(GENERIC_PROFILE, 'Anything', 'Any level'), null);
});

Deno.test('structure: slot sanitising keeps digits-only presets clean and alnum slots intact', () => {
  assertEquals(sanitizeSlotLabel(AZURE_PROFILE, 'B2-27'), '227');
  const alnum = parseResidenceProfile({
    id: 'dev-2',
    settings: { structure: { parkingSlotFormat: { preset: 'alnum', example: 'P-12' } } },
  });
  assertEquals(sanitizeSlotLabel(alnum, 'P-12'), 'P-12');
  assertEquals(parkingSlotError(alnum, 'P-12'), null);
});

Deno.test('structure: display name and compact code keep the current shape', () => {
  assertEquals(formatParkingLocation(AZURE_PROFILE, 'Monaco', 'Level 1', '26'), 'Monaco - Level 1 - Slot 26');
  assertEquals(formatParkingCodeForProfile(AZURE_PROFILE, 'Monaco', 'Level 1', '26'), 'ML1S26');
  assertEquals(formatParkingCodeForProfile(AZURE_PROFILE, 'Bay', 'Level 1', '7'), 'BYL1S7');
  assertEquals(formatParkingCodeForProfile(AZURE_PROFILE, 'Unknown', 'Level 1', '7'), '');
});

Deno.test('structure: location seed returns null without coordinates', () => {
  assertEquals(residenceLocationSeed(GENERIC_PROFILE), null);
  const located = parseResidenceProfile({
    id: 'dev-3',
    settings: { latitude: 15.1, longitude: 120.5, address: 'Somewhere', city: 'City' },
  });
  const seed = residenceLocationSeed(located);
  assertEquals(seed?.address, 'Somewhere');
  assertEquals(seed?.settings.latitude, 15.1);
});

Deno.test('validateResidenceStructure: accepts a valid structure', () => {
  const structure = normalizeResidenceStructure({
    towerLabel: 'Tower',
    unitLabel: 'Unit',
    towersRequired: true,
    propertyTowers: [{ name: 'Monaco', code: 'M', active: true }],
    parkingTowers: [
      { name: 'Monaco', code: 'M', levels: ['Level 1'], parkingType: 'inside_tower' },
    ],
    unitNumberFormat: { preset: 'digits4', example: '2604' },
    parkingSlotFormat: { preset: 'digits1to4', example: '26' },
    floorsMax: 29,
  });

  assertEquals(validateResidenceStructure(structure), null);
});

Deno.test('validateResidenceStructure: rejects duplicates and empty names', () => {
  const base = normalizeResidenceStructure({
    towerLabel: 'Tower',
    unitLabel: 'Unit',
    propertyTowers: [{ name: 'A', code: 'A', active: true }],
    unitNumberFormat: { preset: 'alnum', example: '1' },
    parkingSlotFormat: { preset: 'alnum', example: '1' },
  });

  assertEquals(
    validateResidenceStructure({
      ...base,
      propertyTowers: [...base.propertyTowers, { name: 'a', code: 'a', active: true }],
    }),
    'Duplicate tower: a'
  );
  assertEquals(
    validateResidenceStructure({
      ...base,
      propertyTowers: [{ name: '  ', code: '', active: true }],
    }),
    'Every tower needs a name'
  );
  assertEquals(
    validateResidenceStructure({
      ...base,
      parkingTowers: [
        {
          name: 'Bay',
          code: 'BY',
          active: true,
          levels: ['Level 1', 'level 1'],
          parkingType: 'outside_tower',
        },
      ],
    }),
    'Duplicate level under Bay: level 1'
  );
});

Deno.test('validateResidenceStructure: custom patterns must compile and match the example', () => {
  const base = normalizeResidenceStructure({
    towerLabel: 'Tower',
    unitLabel: 'Unit',
    propertyTowers: [],
    unitNumberFormat: { preset: 'alnum', example: '1' },
    parkingSlotFormat: { preset: 'alnum', example: '1' },
  });

  const broken = {
    ...base,
    unitNumberFormat: { preset: 'custom' as const, pattern: '[', example: '1' },
  };
  assertEquals(
    validateResidenceStructure(broken),
    'Unit format pattern is not a valid regular expression'
  );

  const mismatch = {
    ...base,
    unitNumberFormat: { preset: 'custom' as const, pattern: '^[A-Z]{2}$', example: '12' },
  };
  assertEquals(validateResidenceStructure(mismatch), 'Unit format example does not match the pattern');

  const ok = {
    ...base,
    unitNumberFormat: { preset: 'custom' as const, pattern: '^[A-Z]{2}$', example: 'AB' },
  };
  assertEquals(validateResidenceStructure(ok), null);
});

Deno.test('validateResidenceStructure: floors and labels are bounded', () => {
  const base = normalizeResidenceStructure({
    towerLabel: 'Tower',
    unitLabel: 'Unit',
    unitNumberFormat: { preset: 'alnum', example: '1' },
    parkingSlotFormat: { preset: 'alnum', example: '1' },
  });

  assertEquals(validateResidenceStructure({ ...base, floorsMax: 0 }), 'Floors must be between 1 and 200');
  assertEquals(validateResidenceStructure({ ...base, towerLabel: ' ' }), 'Tower label cannot be empty');
});
