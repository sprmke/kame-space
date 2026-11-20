import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  installParkingFlowMocks,
  PARKING_PAYMENT_PREVIEW,
  parkingGuestStatusLabels,
  submitGuestParkingRequest,
} from '../shared/parkingFlowHarness';

test.describe('@ci parking guest payment breakdown', () => {
  test('pay screen shows rent plus service fee equal to the total', async ({ page }) => {
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await submitGuestParkingRequest(page, { skipScreens: true });
    state.status = 'PENDING_PAYMENT';
    state.parkingId = 'parking-e2e-001';
    state.parkingLabel = 'Tower 1 · B2 · 12A';
    state.parkingSlug = 'slot-12a';
    state.paymentExpiresAt = new Date(Date.now() + 45 * 60_000).toISOString();
    state.broadcastResponse = 'claimed';

    const statusReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/get-parking-booking-status') && res.ok()
    );
    await page.reload();
    await statusReady;
    await expect(
      page.getByRole('heading', { name: parkingGuestStatusLabels.payToConfirm })
    ).toBeVisible({ timeout: 20_000 });

    const money = (value: number) => `₱${value.toLocaleString('en-PH')}`;
    const breakdown = page.getByText('Service fee').locator('xpath=ancestor::div[3]');
    await expect(breakdown).toContainText(money(PARKING_PAYMENT_PREVIEW.hostGrossTotal));
    await expect(breakdown).toContainText(money(PARKING_PAYMENT_PREVIEW.guestFeeTotal));
    await expect(breakdown).toContainText(money(PARKING_PAYMENT_PREVIEW.guestChargeTotal));
    expect(PARKING_PAYMENT_PREVIEW.hostGrossTotal + PARKING_PAYMENT_PREVIEW.guestFeeTotal).toBe(
      PARKING_PAYMENT_PREVIEW.guestChargeTotal
    );
  });
});
