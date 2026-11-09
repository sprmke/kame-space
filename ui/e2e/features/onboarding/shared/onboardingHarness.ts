import { seedSupabaseAuthSession } from '../../../shared/authSeam';

import type { Page, Route } from '@playwright/test';

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

const nameAvailable = { success: true, data: { available: true, message: null } };

const towerUnitAvailable = {
  success: true,
  data: {
    available: true,
    hasActiveListing: false,
    message: null,
    conflict: null,
  },
};

/** Host session + empty org list + availability checks for onboarding wizard. */
export async function installOnboardingMocks(page: Page) {
  await seedSupabaseAuthSession(page, 'host');

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    switch (endpoint) {
      case 'list-organizations':
        await fulfillJson(route, { success: true, data: { organizations: [] } });
        return;
      case 'check-organization-name':
        await fulfillJson(route, nameAvailable);
        return;
      case 'check-property-name':
        await fulfillJson(route, nameAvailable);
        return;
      case 'check-tower-unit':
        await fulfillJson(route, towerUnitAvailable);
        return;
      case 'list-residence-options':
        await fulfillJson(route, {
          success: true,
          data: {
            residences: [
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
                      levels: ['Level 1', 'Level 2', 'Level 3'],
                      parkingType: 'inside_tower',
                    },
                  ],
                  unitNumberFormat: { preset: 'digits4', example: '2604' },
                  parkingSlotFormat: { preset: 'digits1to4', example: '26' },
                  floorsMax: 29,
                },
                location: {
                  latitude: 15.1696,
                  longitude: 120.5598,
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
            ],
          },
        });
        return;
      default:
        await route.continue();
    }
  });
}
