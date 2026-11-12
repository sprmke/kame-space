/**
 * list-residence-options — pure entry builder.
 * `index.ts` binds a server at module scope, so the builder is tested directly.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildResidenceOptions } from '../../_shared/residenceProfilePublic.ts';

Deno.test('buildResidenceOptions: maps ACTIVE rows to the public slice', () => {
  const [residence] = buildResidenceOptions([
    {
      id: 'dev-1',
      name: 'Test Residence',
      slug: 'test-residence',
      type: 'SUBDIVISION',
      settings: {
        pmoEmail: 'secret@example.com',
        structure: {
          towersRequired: false,
          unitLabel: 'Block & Lot',
          unitNumberFormat: { preset: 'alnum', example: 'Blk 3 Lot 5' },
        },
        occupancy: { maxAdultsCap: 4 },
        workflowDefaults: { documentRequirements: [{ id: 'gaf' }] },
      },
    },
  ]);

  assertEquals(residence.developmentId, 'dev-1');
  assertEquals(residence.name, 'Test Residence');
  assertEquals(residence.type, 'SUBDIVISION');
  assertEquals(residence.structure.unitLabel, 'Block & Lot');
  assertEquals(residence.structure.unitNumberFormat.preset, 'alnum');
  assertEquals(residence.occupancy.maxAdultsCap, 4);
});

Deno.test('buildResidenceOptions: never exposes approval recipients or steps', () => {
  const [residence] = buildResidenceOptions([
    {
      id: 'dev-1',
      name: 'Azure North Residences',
      slug: 'azure-north-residences',
      type: 'CONDOMINIUM',
      settings: {
        pmoEmail: 'secret@example.com',
        workflowDefaults: { documentRequirements: [{ id: 'gaf' }] },
      },
    },
  ]);

  const json = JSON.stringify(residence);
  assertEquals(json.includes('secret@example.com'), false);
  assertEquals(json.includes('documentRequirements'), false);
  assertEquals('approvals' in residence, false);
});
