import { expect, test } from '@playwright/test';

import { expectNoPageHorizontalOverflow } from '../../../shared/layoutAssertions';
import {
  createParkingFlowState,
  installParkingFlowMocks,
  parkingFlowPaths,
} from '../shared/parkingFlowHarness';

const WIDTHS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

const PAGES = [
  {
    name: 'bookings',
    path: parkingFlowPaths.hostBookings,
    heading: 'Bookings',
    ready: 'text=Needs action',
  },
  {
    name: 'booking detail',
    path: parkingFlowPaths.hostBookingDetail,
    heading: 'Jamie Park',
    ready: 'text=jamie@example.com',
  },
  {
    name: 'pricing',
    path: parkingFlowPaths.hostPricing,
    heading: 'Pricing',
    ready: '#parking-weekday-rate',
  },
  {
    name: 'finance',
    path: '/org/sample-stays-ph/parking/slot-12a/finance',
    heading: 'Finance',
    ready: 'text=Cash flow',
  },
  {
    name: 'settings',
    path: '/org/sample-stays-ph/parking/slot-12a/settings',
    heading: 'Settings',
    ready: '#parking-code',
  },
] as const;

test.describe('@ci parking manual QA widths', () => {
  for (const viewport of WIDTHS) {
    test(`${viewport.name} parking pages render without horizontal overflow`, async ({ page }) => {
      const state = createParkingFlowState();
      state.status = 'PENDING_REVIEW';
      state.parkingId = 'parking-e2e-001';
      state.parkingSlug = 'slot-12a';
      state.parkingLabel = 'Tower 1 · B2 · 12A';
      state.endorsementSentAt = new Date().toISOString();
      await installParkingFlowMocks(page, state);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const target of PAGES) {
        await page.goto(target.path);
        await expect(page.getByRole('heading', { name: target.heading }).first()).toBeVisible({
          timeout: 20_000,
        });
        await expect(page.locator(target.ready).first()).toBeVisible({ timeout: 20_000 });
        await expectNoPageHorizontalOverflow(page);
      }
    });
  }

  test('phone pricing calendar keeps all seven day columns on screen', async ({ page }) => {
    const state = createParkingFlowState();
    state.status = 'PENDING_REVIEW';
    state.parkingId = 'parking-e2e-001';
    state.parkingSlug = 'slot-12a';
    state.parkingLabel = 'Tower 1 · B2 · 12A';
    await installParkingFlowMocks(page, state);
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto(parkingFlowPaths.hostPricing);
    await expect(page.getByText('Base Rate').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('button[aria-label*="per night"]').first()).toBeVisible({
      timeout: 20_000,
    });

    const rightEdges = await page
      .locator('button[aria-label*="per night"]')
      .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().right));
    expect(rightEdges.length).toBeGreaterThan(0);
    expect(Math.max(...rightEdges)).toBeLessThanOrEqual(367);
  });
});
