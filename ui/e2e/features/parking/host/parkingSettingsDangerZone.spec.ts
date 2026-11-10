import { expect, test } from '@playwright/test';

import { expectNoPageHorizontalOverflow } from '../../../shared/layoutAssertions';
import { createParkingFlowState, installParkingFlowMocks } from '../shared/parkingFlowHarness';

test.describe('parking settings danger zone @ci', () => {
  test('shows archive impact and blocks delete after a booking', async ({ page }) => {
    const state = createParkingFlowState();
    state.archiveImpact = {
      pendingOffers: 2,
      upcomingBookings: 1,
      bookingHistory: 3,
    };
    await installParkingFlowMocks(page, state);
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/org/sample-stays-ph/parking/slot-12a/settings');
    await expect(page.locator('#parking-code')).toBeVisible({ timeout: 20_000 });
    await expectNoPageHorizontalOverflow(page);

    const deleteButton = page.getByRole('button', { name: 'Delete parking' }).first();
    await expect(deleteButton).toBeDisabled();
    await expect(page.getByText(/can't be deleted/i)).toBeVisible();

    await page.getByRole('button', { name: 'Archive', exact: true }).first().click();
    await expect(page.getByText(/2 pending offers will be declined/i)).toBeVisible();
    await expect(page.getByText(/1 upcoming booking will stay in place/i)).toBeVisible();
  });
});
