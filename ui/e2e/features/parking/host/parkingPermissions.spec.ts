import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  installParkingFlowMocks,
  parkingFlowPaths,
} from '../shared/parkingFlowHarness';
import { setParkingScreenSuite } from '../shared/parkingScreenCapture';

const VIEW_ONLY = [
  'bookings:view',
  'finance:view',
  'pricing:view',
  'notifications:view',
  'settings:view',
  'team:view',
  'inbox:view',
  'activity:view',
];

test.describe('parking permissions @ci', () => {
  test('view-only member sees no write actions and a restricted Settings page', async ({
    page,
  }) => {
    setParkingScreenSuite('parking-permissions-view-only');
    const state = createParkingFlowState();
    state.accessPermissions = VIEW_ONLY;
    await installParkingFlowMocks(page, state);

    await page.goto(parkingFlowPaths.hostBookings);
    await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New booking' })).toHaveCount(0);

    await page.goto('/org/sample-stays-ph/parking/slot-12a/settings');
    await expect(page.getByText(/You can view this page but not change it/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('pricing-only member can open and edit Pricing', async ({ page }) => {
    setParkingScreenSuite('parking-permissions-pricing-only');
    const state = createParkingFlowState();
    state.accessPermissions = ['bookings:view', 'pricing:view', 'pricing:edit'];
    await installParkingFlowMocks(page, state);

    await page.goto(parkingFlowPaths.hostPricing);
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
    await expect(page.getByLabel(/weekday/i).first()).toBeVisible();
  });
});
