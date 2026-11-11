import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  developmentGuestContextFromRow,
  guestBuildingInfoFor,
  type DevelopmentGuestContextDto,
} from './developmentGuestInfo.ts';

function context(overrides: Partial<DevelopmentGuestContextDto> = {}): DevelopmentGuestContextDto {
  return {
    name: 'Test Residence',
    developerName: null,
    description: null,
    locationLabel: '',
    amenities: ['Pool'],
    poolFee: null,
    poolSchedule: '',
    guestRequirements: 'Bring an ID.',
    guestGuides: [{ id: 'wifi', title: 'Wi-Fi', content: 'Ask the lobby.' }],
    importantInfo: 'Water is shut off Tuesdays.',
    documentRequirementLabels: [],
    buildingRules: [{ id: 'no-smoking', text: 'No smoking in the unit.', type: 'prohibited' }],
    guestInfoVisibility: { stayGuide: true, propertyPage: true },
    ...overrides,
  };
}

Deno.test('guestBuildingInfoFor: returns the guest slice for an allowed surface', () => {
  const info = guestBuildingInfoFor(context(), 'stayGuide');
  assertEquals(info?.requirements, 'Bring an ID.');
  assertEquals(info?.guides.length, 1);
  assertEquals(info?.rules[0]?.type, 'prohibited');
});

Deno.test('guestBuildingInfoFor: a hidden surface returns null even when content exists', () => {
  const hidden = context({ guestInfoVisibility: { stayGuide: false, propertyPage: true } });
  assertEquals(guestBuildingInfoFor(hidden, 'stayGuide'), null);
  assertEquals(guestBuildingInfoFor(hidden, 'propertyPage')?.requirements, 'Bring an ID.');
});

Deno.test('guestBuildingInfoFor: an empty building renders no section', () => {
  const empty = context({
    amenities: [],
    guestRequirements: '',
    guestGuides: [],
    importantInfo: '',
    buildingRules: [],
  });
  assertEquals(guestBuildingInfoFor(empty, 'stayGuide'), null);
});

Deno.test('developmentGuestContextFromRow: reads rules and visibility, defaulting to shown', () => {
  const withSettings = developmentGuestContextFromRow({
    name: 'Test Residence',
    developer_name: null,
    description: null,
    location: null,
    city: null,
    settings: {
      buildingRules: [{ id: 'pool', text: 'Pool closes at 10 PM.', type: 'info' }],
      guestInfoVisibility: { stayGuide: false },
    },
  });
  assertEquals(withSettings.buildingRules[0]?.text, 'Pool closes at 10 PM.');
  assertEquals(withSettings.guestInfoVisibility, { stayGuide: false, propertyPage: true });

  const noSettings = developmentGuestContextFromRow({
    name: 'Test Residence',
    developer_name: null,
    description: null,
    location: null,
    city: null,
    settings: {},
  });
  assertEquals(noSettings.guestInfoVisibility, { stayGuide: true, propertyPage: true });
});
