import { expect, test } from '@playwright/test';

import { expectNoPageHorizontalOverflow } from '../../../shared/layoutAssertions';
import {
  createParkingFlowState,
  installParkingFlowMocks,
  parkingFlowPaths,
} from '../shared/parkingFlowHarness';

test.describe('@smoke @critical parking host mobile action bar', () => {
  test('phone booking detail keeps status actions in the bottom action bar', async ({ page }) => {
    const state = createParkingFlowState();
    state.status = 'PENDING_REVIEW';
    state.parkingId = 'parking-e2e-001';
    state.parkingSlug = 'slot-12a';
    state.parkingLabel = 'Tower 1 · B2 · 12A';
    await installParkingFlowMocks(page, state);
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto(parkingFlowPaths.hostBookingDetail);
    await expect(page.getByRole('heading', { name: 'Jamie Park' }).first()).toBeVisible({
      timeout: 20_000,
    });
    const bar = page.getByRole('toolbar');
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Approve for check-in' })).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });
});
