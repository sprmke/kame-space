import { expect, test } from '@playwright/test';

import { createParkingFlowState, installParkingFlowMocks } from '../shared/parkingFlowHarness';
import { setParkingScreenSuite } from '../shared/parkingScreenCapture';

test.describe('parking finance marketplace payouts @ci', () => {
  test('shows the read-only marketplace payout row', async ({ page }) => {
    setParkingScreenSuite('parking-finance-payouts');
    const state = createParkingFlowState();
    state.payments = [
      {
        id: 'txn-e2e-002',
        bookingId: 'booking-e2e-001',
        parkingId: 'parking-e2e-001',
        guestChargeTotal: 800,
        hostGrossTotal: 700,
        commissionPct: 0.1,
        hostNetTotal: 630,
        nights: 2,
        bookingChannel: 'direct_link',
        status: 'paid',
        paidAt: new Date().toISOString(),
        disbursedAt: null,
        disbursementReference: null,
        refundReviewAt: null,
        refundedAt: null,
        refundAmount: null,
        refundReason: null,
        failureReason: null,
      },
    ];
    await installParkingFlowMocks(page, state);

    await page.goto('/org/sample-stays-ph/parking/slot-12a/finance');
    await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();
    await expect(page.getByText('Marketplace payouts')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('₱630.00 net')).toBeVisible();
    await expect(page.getByText(/Direct link/)).toBeVisible();
  });
});
