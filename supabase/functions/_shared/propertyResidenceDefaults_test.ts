import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { applyResidencePropertySeeds } from './propertyResidenceDefaults.ts';

const BASE = { maxAdults: 4, enabledAmenities: [], enabledHouseRules: [] };

Deno.test('applyResidencePropertySeeds: no seeds leaves the settings untouched (Azure)', () => {
  const settings = applyResidencePropertySeeds(BASE, { amenityIds: [], houseRuleIds: [] });
  assertEquals(settings, BASE);
  assertEquals(settings.enabledAmenities, []);
});

Deno.test('applyResidencePropertySeeds: copies the residence lists once', () => {
  const settings = applyResidencePropertySeeds(BASE, {
    amenityIds: ['pool', 'gym'],
    houseRuleIds: ['no-smoking'],
  });

  assertEquals(settings.enabledAmenities, ['pool', 'gym']);
  assertEquals(settings.enabledHouseRules, ['no-smoking']);
  assertEquals(settings.maxAdults, 4);
});

Deno.test('applyResidencePropertySeeds: drops blank ids instead of storing them', () => {
  const settings = applyResidencePropertySeeds(BASE, {
    amenityIds: ['pool', '  '],
    houseRuleIds: [''],
  });

  assertEquals(settings.enabledAmenities, ['pool']);
  assertEquals(settings.enabledHouseRules, []);
});
