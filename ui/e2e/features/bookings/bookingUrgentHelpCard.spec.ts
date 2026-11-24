import { expect, test, type Page } from '@playwright/test';

import { createParkingFlowState } from '../parking/shared/parkingFlowHarness';
import {
  createPropertyBookingParkingState,
  installPropertyBookingParkingMocks,
  PROPERTY_BOOKING_ID,
  propertyBookingParkingPaths,
} from '../parking/shared/propertyBookingParkingHarness';

async function installOpenHelpCase(page: Page): Promise<{ resolved: () => boolean }> {
  const parkingState = createParkingFlowState();
  const propertyState = createPropertyBookingParkingState({ linked: false });
  await installPropertyBookingParkingMocks(page, parkingState, propertyState);

  let resolved = false;
  await page.route('**/functions/v1/booking-help**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            request: resolved
              ? null
              : {
                  id: 'e2e-help-1',
                  booking_id: PROPERTY_BOOKING_ID,
                  kind: 'cant_get_in',
                  note: 'Door code does not work',
                  status: 'open',
                  created_at: new Date().toISOString(),
                },
          },
        }),
      });
      return;
    }
    resolved = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { request: { id: 'e2e-help-1', status: 'resolved' } },
      }),
    });
  });

  return { resolved: () => resolved };
}

test.describe('@ci @critical booking urgent help card', () => {
  test('an open guest help case is visible and can be resolved', async ({ page }) => {
    const state = await installOpenHelpCase(page);

    await page.goto(propertyBookingParkingPaths.bookingDetail);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText("Guest needs help: Can't get in")).toBeVisible();
    await expect(page.getByText('Door code does not work')).toBeVisible();

    await page.getByRole('button', { name: 'Mark resolved' }).click();
    await expect(page.getByText('Help request resolved')).toBeVisible();
    await expect(page.getByText("Guest needs help: Can't get in")).toHaveCount(0);
    expect(state.resolved()).toBe(true);
  });

  test('a phone shows the open case without opening booking details', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installOpenHelpCase(page);

    await page.goto(propertyBookingParkingPaths.bookingDetail);
    await expect(page.getByText("Guest needs help: Can't get in")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Door code does not work')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark resolved' })).toBeVisible();
  });
});
