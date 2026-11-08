import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  fulfillParkingPayment,
  installParkingFlowMocks,
  parkingFlowPaths,
} from '../shared/parkingFlowHarness';
import { setParkingScreenSuite } from '../shared/parkingScreenCapture';

test.describe('parking host booking detail payment @ci', () => {
  test('shows the payment card and resends a failed endorsement', async ({ page }) => {
    setParkingScreenSuite('parking-host-detail-payment');
    const state = createParkingFlowState();
    state.status = 'PENDING_PAYMENT';
    fulfillParkingPayment(state);
    state.endorsementSentAt = null;
    state.endorsementSendError = 'The building admin email is not configured.';
    state.endorsementEmailSnapshot = null;
    state.hostContact = null;
    state.payments = [
      {
        id: 'txn-e2e-001',
        bookingId: 'booking-e2e-001',
        parkingId: 'parking-e2e-001',
        guestChargeTotal: 800,
        hostGrossTotal: 700,
        commissionPct: 0.1,
        hostNetTotal: 630,
        nights: 2,
        bookingChannel: 'standard',
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

    await page.goto(parkingFlowPaths.hostBookingDetail);
    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('₱800.00')).toBeVisible();
    await expect(page.getByText('₱630.00')).toBeVisible();
    await expect(page.getByText(/Not sent: The building admin email/i)).toBeVisible();

    await page.getByRole('button', { name: 'Resend endorsement' }).click();
    await expect(page.getByText('Endorsement sent')).toBeVisible({ timeout: 10_000 });
  });
});
