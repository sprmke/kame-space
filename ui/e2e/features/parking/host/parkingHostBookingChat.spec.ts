import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  installParkingFlowMocks,
  parkingFlowPaths,
} from '../shared/parkingFlowHarness';

test.describe('@ci parking host booking chat shortcut', () => {
  test('chat icon opens the guest thread in this parking inbox, scoped to the parking', async ({
    page,
  }) => {
    const state = createParkingFlowState();
    state.status = 'PENDING_REVIEW';
    state.parkingId = 'parking-e2e-001';
    state.parkingSlug = 'slot-12a';
    state.parkingLabel = 'Tower 1 · B2 · 12A';
    await installParkingFlowMocks(page, state);

    await page.goto(parkingFlowPaths.hostBookings);
    await page.getByRole('button', { name: 'Open chat with Jamie Park' }).first().click();

    await expect(page).toHaveURL(
      /\/org\/sample-stays-ph\/parking\/slot-12a\/messages\?conversationId=conv-parking-1&platform=web/
    );
    const request = new URL(state.lastBookingChatsUrl!);
    expect(request.searchParams.get('parking_id')).toBe('parking-e2e-001');
    expect(request.searchParams.get('property_id')).toBeNull();
    expect(request.searchParams.get('booking_id')).toBe(state.bookingId);
  });

  test('chat icon is hidden without inbox:view on this parking', async ({ page }) => {
    const state = createParkingFlowState();
    state.status = 'PENDING_REVIEW';
    state.parkingId = 'parking-e2e-001';
    state.parkingSlug = 'slot-12a';
    state.accessPermissions = ['bookings:view'];
    await installParkingFlowMocks(page, state);

    await page.goto(parkingFlowPaths.hostBookings);
    await expect(
      page.getByRole('link', { name: 'Jamie Park', exact: true }).first()
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Open chat with/i })).toHaveCount(0);
  });
});
