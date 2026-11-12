import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

const RESIDENCES = [
  {
    developmentId: 'dev-azure',
    name: 'Azure North Residences',
    type: 'CONDOMINIUM',
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
      ],
      unitNumberFormat: { preset: 'digits4', example: '2604' },
      parkingSlotFormat: { preset: 'digits1to4', example: '26' },
      floorsMax: 29,
    },
    location: {
      latitude: 15.1,
      longitude: 120.5,
      address: 'Azure',
      city: 'San Fernando',
      province: 'Pampanga',
      country: 'Philippines',
      zipCode: '',
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
    terms: {},
    copy: {},
  },
  {
    developmentId: 'dev-test-residence',
    name: 'Test Residence',
    type: 'SUBDIVISION',
    structure: {
      towerLabel: 'Phase',
      unitLabel: 'Block & Lot',
      towersRequired: false,
      propertyTowers: [],
      parkingTowers: [],
      unitNumberFormat: { preset: 'alnum', example: 'Blk 3 Lot 5' },
      parkingSlotFormat: { preset: 'alnum', example: 'P-12' },
      floorsMax: 2,
    },
    location: {
      latitude: null,
      longitude: null,
      address: null,
      city: null,
      province: null,
      country: null,
      zipCode: null,
    },
    occupancy: {
      maxAdultsCap: 4,
      maxChildrenCap: 3,
      childMaxAge: 3,
      adultMinAge: 18,
      idRequiredFromAge: 18,
      primaryGuestMinAge: 18,
    },
    stay: {
      checkInTime: '14:00',
      checkOutTime: '12:00',
      petsAllowed: false,
      paidParkingAvailable: false,
      surpriseDecorAllowed: true,
      petTypes: [],
      petVaccinationRequired: false,
    },
    terms: {},
    copy: {},
  },
];

test.describe('@ci org add listing residence rules', () => {
  test('switching residence swaps the tower and unit rules', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });

    await page.route('**/functions/v1/list-residence-options**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { residences: RESIDENCES } }),
      });
    });
    await page.route('**/functions/v1/check-property-name**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { available: true, message: null } }),
      });
    });

    let created: Record<string, unknown> | null = null;
    await page.route('**/functions/v1/create-property', async (route) => {
      created = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            property: {
              id: 'property-new',
              name: 'Lot 5',
              slug: 'lot-5',
              status: 'INACTIVE',
              residenceName: 'Test Residence',
              tower: null,
              unitNumber: 'Blk 3 Lot 5',
              towerAndUnit: 'Blk 3 Lot 5',
            },
            billingRequired: false,
          },
        }),
      });
    });

    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/properties`);
    await page.getByRole('button', { name: 'Add property', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('New listing')).toBeVisible({ timeout: 20_000 });

    // Azure first: tower select and a 4-digit unit hint.
    await expect(dialog.getByLabel('Tower')).toBeVisible();
    await expect(dialog.getByPlaceholder('2604')).toBeVisible();

    // Switch to a subdivision: no tower field, alphanumeric Block & Lot.
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Test Residence' }).click();

    await expect(dialog.getByLabel('Tower')).toHaveCount(0);
    await expect(dialog.getByLabel('Block & Lot')).toBeVisible();
    await expect(dialog.getByPlaceholder('Blk 3 Lot 5')).toBeVisible();

    await dialog.getByLabel('Block & Lot').fill('Blk 3 Lot 5');
    await dialog.getByLabel('Display name').fill('Lot 5');
    await dialog.getByRole('button', { name: 'Add property', exact: true }).click();

    await expect.poll(() => created).not.toBeNull();
    expect(created).toMatchObject({
      developmentId: 'dev-test-residence',
      residenceName: 'Test Residence',
      unitNumber: 'Blk 3 Lot 5',
    });
  });
});
