import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  fulfillParkingPayment,
  installParkingFlowMocks,
  parkingFlowPaths,
} from '../shared/parkingFlowHarness';
import { setParkingScreenSuite } from '../shared/parkingScreenCapture';

test.describe('parking status privacy @ci', () => {
  test('signed-out viewer sees a sign-in row instead of host contact', async ({ page }) => {
    setParkingScreenSuite('parking-status-redaction');
    const state = createParkingFlowState();
    state.status = 'PENDING_PAYMENT';
    state.parkingId = 'parking-e2e-001';
    state.parkingLabel = 'Tower 1 · B2 · 12A';
    state.parkingSlug = 'slot-12a';
    fulfillParkingPayment(state);
    state.viewerOwnsBooking = false;
    await installParkingFlowMocks(page, state);

    await page.goto(parkingFlowPaths.guestStatus);
    await expect(page.getByText('Parking confirmed')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Host & endorsement' }).click();
    await expect(page.getByText(/Sign in with the email you booked with/i)).toBeVisible();
    await expect(page.getByText('Parking Host')).toHaveCount(0);
  });
});
