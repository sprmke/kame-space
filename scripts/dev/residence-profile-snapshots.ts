#!/usr/bin/env bun
/**
 * Residence Profile snapshot.
 *
 * Phase 0 changes no Azure behavior; this file is the proof at the resolver layer. It
 * snapshots the parsed Azure-shaped profile and the resolved values for a sample
 * property, then diffs them against the committed fixture.
 *
 * Email HTML, generated PDF field values and calendar titles get their own golden set in
 * Phase 3, before the orchestrator changes. This script does not claim to cover those.
 *
 * Usage:
 *   bun scripts/dev/residence-profile-snapshots.ts           # write the fixture
 *   bun scripts/dev/residence-profile-snapshots.ts --check   # fail on diff
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  GENERIC_RESIDENCE_PROFILE,
  parseResidenceProfile,
  resolvePropertyValue,
} from '../../supabase/functions/_shared/residenceProfile.ts';

const ROOT = join(import.meta.dir, '../..');
const FIXTURE = join(ROOT, 'scripts/dev/fixtures/residence-profile.snapshot.json');

/** Mirrors the Azure development row shape: towers, unit types, pool, PMO and today's steps. */
const AZURE_ROW = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Azure North Residences',
  slug: 'azure-north-residences',
  type: 'CONDOMINIUM',
  settings: {
    pmoEmail: 'stlmonaco.theresortresidences@azurenorth.com.ph',
    structure: {
      towerLabel: 'Tower',
      unitLabel: 'Unit',
      towersRequired: true,
      propertyTowers: ['Monaco', 'Bali', 'Barbados'],
      parkingTowers: [
        {
          name: 'Monaco',
          code: 'Monaco',
          levels: ['B1', 'B2', 'B3', 'G'],
          parkingType: 'inside_tower',
        },
        {
          name: 'Bali',
          code: 'Bali',
          levels: ['B1', 'B2', 'B3', 'G'],
          parkingType: 'inside_tower',
        },
        {
          name: 'Barbados',
          code: 'Barbados',
          levels: ['B1', 'B2', 'B3', 'G'],
          parkingType: 'inside_tower',
        },
        { name: 'Bay', code: 'BY', levels: ['G'], parkingType: 'outside_tower' },
      ],
      unitNumberFormat: { preset: 'digits4', example: '2604' },
      parkingSlotFormat: { preset: 'digits1to4', example: 'B2-27' },
      floorsMax: 29,
    },
    occupancy: {
      maxAdultsCap: 6,
      maxChildrenCap: 4,
      childMaxAge: 3,
      adultMinAge: 18,
      idRequiredFromAge: 18,
      primaryGuestMinAge: 18,
    },
    stay: {
      checkInTime: '14:00',
      checkOutTime: '12:00',
      petsAllowed: true,
      paidParkingAvailable: true,
      surpriseDecorAllowed: true,
      petTypes: ['Dog', 'Cat'],
      petVaccinationRequired: true,
    },
    workflowDefaults: {
      documentRequirements: [
        {
          id: 'gaf',
          label: 'GAF Request',
          order: 1,
          pdfTemplateId: 'gaf',
          approvalSource: 'email-listener',
          triggerCondition: 'always',
          calendarIcon: null,
        },
        {
          id: 'pet',
          label: 'Pet Approval',
          order: 2,
          pdfTemplateId: 'pet',
          approvalSource: 'email-listener',
          triggerCondition: 'has_pets',
          calendarIcon: '🐶',
        },
      ],
    },
  },
};

const SAMPLE_PROPERTY_SETTINGS = {
  maxAdults: 4,
  maxChildren: 0,
  floors: 26,
  checkInTime: '14:00',
  checkOutTime: '12:00',
  allowPets: true,
  allowParking: true,
  allowSurpriseDecor: true,
};

function buildSnapshot() {
  const azure = parseResidenceProfile(AZURE_ROW);
  return {
    generic: GENERIC_RESIDENCE_PROFILE,
    azure,
    sampleProperty: {
      maxAdults: resolvePropertyValue('occupancy.maxAdults', azure, SAMPLE_PROPERTY_SETTINGS),
      maxChildren: resolvePropertyValue('occupancy.maxChildren', azure, SAMPLE_PROPERTY_SETTINGS),
      checkInTime: resolvePropertyValue('stay.checkInTime', azure, SAMPLE_PROPERTY_SETTINGS),
      checkOutTime: resolvePropertyValue('stay.checkOutTime', azure, SAMPLE_PROPERTY_SETTINGS),
      petsAllowed: resolvePropertyValue('stay.petsAllowed', azure, SAMPLE_PROPERTY_SETTINGS),
      paidParkingAvailable: resolvePropertyValue(
        'stay.paidParkingAvailable',
        azure,
        SAMPLE_PROPERTY_SETTINGS
      ),
    },
  };
}

function main() {
  const check = process.argv.includes('--check');
  const snapshot = buildSnapshot();

  if (check) {
    if (!existsSync(FIXTURE)) {
      console.error(`Missing ${FIXTURE}. Run: bun scripts/dev/residence-profile-snapshots.ts`);
      process.exit(1);
    }
    // Compare values, not whitespace: the fixture is prettier-formatted.
    const committed = JSON.stringify(JSON.parse(readFileSync(FIXTURE, 'utf8')));
    if (committed !== JSON.stringify(snapshot)) {
      console.error('Residence profile snapshot changed.');
      console.error('If the change is intentional and Azure stays byte-identical, rewrite it:');
      console.error('  bun scripts/dev/residence-profile-snapshots.ts');
      process.exit(1);
    }
    console.log('OK — residence profile snapshot matches the committed fixture.');
    return;
  }

  writeFileSync(FIXTURE, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${FIXTURE}`);
}

main();
