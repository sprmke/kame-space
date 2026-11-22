import { expect, test } from '@playwright/test';

import { createParkingFlowState } from '../parking/shared/parkingFlowHarness';
import {
  createPropertyBookingParkingState,
  installPropertyBookingParkingMocks,
  propertyBookingParkingPaths,
} from '../parking/shared/propertyBookingParkingHarness';

const FUTURE_STAY = {
  check_in_date: '12-25-2026',
  check_out_date: '12-27-2026',
  cancellation_policy_snapshot: {
    policy: { presetId: 'flexible' },
    capturedAt: '2026-11-01T00:00:00.000Z',
    capturedFrom: 'guest_form',
    propertyPolicyVersionId: null,
    rendered: {
      title: 'Flexible',
      description: 'Free cancellation up to 1 day before check-in.',
      shortLabel: 'Flexible',
    },
  },
};

test.describe('@ci @critical cancel booking sheet', () => {
  test('a host cancel before check-in locks the full refund and emails the guest', async ({
    page,
  }) => {
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      bookingOverrides: FUTURE_STAY,
    });

    await page.goto(propertyBookingParkingPaths.bookingDetail);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Cancel booking' }).click();
    await expect(page.getByRole('heading', { name: 'Cancel booking' })).toBeVisible();

    // No open guest request, so the host cannot relabel this as the guest's cancel.
    await expect(page.getByText('Who asked?')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Reason' })).toContainText(
      'I cannot host this stay'
    );

    // Before check-in the host refund is the full amount, with no override control.
    await expect(
      page.getByText('A host cancellation before check-in refunds the full amount paid.')
    ).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Override the refund' })).toHaveCount(0);
    await expect(page.getByText('The guest is emailed about this cancellation.')).toBeVisible();

    await page.getByRole('button', { name: 'Keep booking' }).click();
    await expect(page.getByRole('heading', { name: 'Cancel booking' })).toHaveCount(0);
  });
});
