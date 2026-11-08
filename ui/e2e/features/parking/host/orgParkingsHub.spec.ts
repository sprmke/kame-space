import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  installParkingFlowMocks,
} from '../shared/parkingFlowHarness';
import { setParkingScreenSuite } from '../shared/parkingScreenCapture';

test.describe('org parkings hub @ci', () => {
  test('lists parking slots and offers create', async ({ page }) => {
    setParkingScreenSuite('org-parkings-hub');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await page.goto('/org/sample-stays-ph/parkings');
    await expect(page.getByRole('heading', { name: 'Parkings' })).toBeVisible();
    await expect(page.getByText('Slot 12A')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Add parking/i }).first()).toBeVisible();
  });
});
