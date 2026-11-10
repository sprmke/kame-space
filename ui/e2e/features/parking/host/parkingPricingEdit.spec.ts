import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  installParkingFlowMocks,
  parkingFlowPaths,
} from '../shared/parkingFlowHarness';
import { setParkingScreenSuite } from '../shared/parkingScreenCapture';

test.describe('parking pricing edit @ci', () => {
  test('shows the matching explainer and guards unsaved rate edits', async ({ page }) => {
    setParkingScreenSuite('parking-pricing-edit');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await page.goto(parkingFlowPaths.hostPricing);
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
    await expect(page.getByText(/Guests pay the platform rate:/i)).toBeVisible();

    const weekday = page.getByLabel('Weekday / night');
    await weekday.fill('275');
    await expect(weekday).toHaveValue('275');
    // Leaving with unsaved edits must prompt, not silently drop the change.
    await page.getByRole('link', { name: 'Bookings' }).first().click();
    await expect(page.getByText('Save your changes?')).toBeVisible({ timeout: 10_000 });
  });
});
