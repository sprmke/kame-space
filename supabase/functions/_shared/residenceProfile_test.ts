import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { SupabaseClient } from './supabaseJs.ts';
import {
  GENERIC_RESIDENCE_PROFILE,
  loadResidenceProfile,
  parseResidenceProfile,
  resolvePropertyValue,
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
