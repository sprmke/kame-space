/**
 * get-residence-profile — pure public-slice builder.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { toPublicResidenceProfile } from '../../_shared/residenceProfilePublic.ts';
import { parseResidenceProfile } from '../../_shared/residenceProfile.ts';

Deno.test('toPublicResidenceProfile: keeps structure, drops approvals', () => {
  const profile = parseResidenceProfile({
    id: 'dev-1',
    name: 'Somewhere',
    type: 'CONDOMINIUM',
    settings: {
      pmoEmail: 'secret@example.com',
      structure: { towerLabel: 'Building', towersRequired: true, propertyTowers: ['A'] },
      approvals: { buildingAdminLabel: 'HOA' },
      workflowDefaults: { documentRequirements: [{ id: 'gaf' }] },
    },
  });

  const publicProfile = toPublicResidenceProfile(profile);

  assertEquals(publicProfile.developmentId, 'dev-1');
  assertEquals(publicProfile.structure.towerLabel, 'Building');
  assertEquals(publicProfile.structure.propertyTowers.length, 1);
  assertEquals('approvals' in publicProfile, false);
  assertEquals(JSON.stringify(publicProfile).includes('secret@example.com'), false);
});

Deno.test('toPublicResidenceProfile: a null profile is generic, never Azure', () => {
  const publicProfile = toPublicResidenceProfile(parseResidenceProfile(null));

  assertEquals(publicProfile.developmentId, null);
  assertEquals(publicProfile.name, null);
  assertEquals(publicProfile.structure.propertyTowers, []);
});
