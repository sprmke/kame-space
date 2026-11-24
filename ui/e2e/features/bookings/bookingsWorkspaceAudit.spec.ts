import { expect, test, type Page } from '@playwright/test';

import {
  BOOKING_ROW_IDS,
  bookingsPaths,
  capture,
  demoPause,
  demoScroll,
  dismissCookieConsent,
  installBookingsWorkspaceMocks,
} from './shared/bookingsWorkspaceHarness';

/**
 * Screenshot capture for the bookings UX review. @demo — never CI.
 *
 *   PLAYWRIGHT_CAPTURE_SCREENS=1 PLAYWRIGHT_PORT=4195 \
 *     bunx playwright test ui/e2e/features/bookings/bookingsWorkspaceAudit.spec.ts --project=chromium
 *
 * Writes to `docs/workflow/in-progress/bookings-ux-review/screenshots/`.
 */

const SHOTS = 'docs/workflow/in-progress/bookings-ux-review/screenshots';

async function settle(page: Page) {
  await dismissCookieConsent(page);
  await demoPause(page, 1);
}

test.describe('bookings workspace audit @demo', () => {
  test.describe('desktop 1440', () => {
    test.use({ viewport: { width: 1440, height: 960 } });

    test('list surfaces', async ({ page }) => {
      test.setTimeout(120_000);
      await installBookingsWorkspaceMocks(page);
      await page.goto(bookingsPaths.list);
      await settle(page);
      await expect(page.getByText('Action Required').first()).toBeVisible({ timeout: 30_000 });
      await capture(page, SHOTS, '01-desktop-list-table');

      await page.getByRole('button', { name: 'Filter by status' }).click();
      await demoPause(page, 1.2);
      await capture(page, SHOTS, '02-desktop-status-filter');
      // The list is longer than the popover: prove the remaining statuses are reachable.
      await page.mouse.move(430, 500);
      await page.mouse.wheel(0, 400);
      await demoPause(page, 1);
      await capture(page, SHOTS, '02b-desktop-status-filter-bottom');
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'More booking filters' }).click();
      await demoPause(page, 0.6);
      await capture(page, SHOTS, '03-desktop-more-filters');
      await page.keyboard.press('Escape');

      await page.goto(bookingsPaths.listView('kanban'));
      await expect(page).toHaveURL(/view=kanban/);
      await expect(
        page.getByRole('button', { name: /Open workflow for Maria Santos/ })
      ).toBeVisible({ timeout: 20_000 });
      await demoPause(page, 1);
      await capture(page, SHOTS, '04-desktop-kanban');

      await page.goto(bookingsPaths.listView('calendar'));
      await expect(page.getByText('Day details')).toBeVisible({ timeout: 20_000 });
      await demoPause(page, 1);
      await capture(page, SHOTS, '05-desktop-calendar');

      await page.goto(bookingsPaths.listView('card'));
      await expect(
        page.getByRole('button', { name: /Open booking for Maria Santos, maria@example.com/ })
      ).toBeVisible({ timeout: 20_000 });
      await demoPause(page, 1);
      await capture(page, SHOTS, '06-desktop-card');

      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(bookingsPaths.list);
      await expect(page.getByRole('link', { name: 'Maria Santos', exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await demoPause(page, 1);
      await capture(page, SHOTS, '07-desktop-table-dark');
    });

    test('detail surfaces', async ({ page }) => {
      test.setTimeout(180_000);
      await installBookingsWorkspaceMocks(page);
      await page.goto(bookingsPaths.detail());
      await settle(page);
      await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
        timeout: 30_000,
      });
      await demoPause(page, 2.5);
      await capture(page, SHOTS, '10-desktop-detail-overview');

      for (const [, name] of [
        ['Guests', '11-desktop-detail-guests'],
        ['Parking', '12-desktop-detail-parking'],
        ['Pricing', '13-desktop-detail-pricing'],
        ['Files', '14-desktop-detail-files'],
        ['Activity', '15-desktop-detail-activity'],
      ] as const) {
        const trigger = page.getByRole('tab', { name });
        if (await trigger.isVisible().catch(() => false)) {
          await trigger.click();
          await demoPause(page, 1);
          await capture(page, SHOTS, name);
        }
      }

      await page.emulateMedia({ colorScheme: 'dark' });
      await page.getByRole('tab', { name: 'Stay' }).click();
      await demoPause(page, 1);
      await capture(page, SHOTS, '16-desktop-detail-dark');
    });
  });

  test.describe('laptop 1024', () => {
    test.use({ viewport: { width: 1024, height: 768 } });

    test('list and detail', async ({ page }) => {
      test.setTimeout(120_000);
      await installBookingsWorkspaceMocks(page);
      await page.goto(bookingsPaths.list);
      await settle(page);
      await expect(page.getByText('Action Required').first()).toBeVisible({ timeout: 30_000 });
      await capture(page, SHOTS, '20-laptop-list');

      await page.goto(bookingsPaths.detail());
      await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
        timeout: 30_000,
      });
      await demoPause(page, 2.5);
      await capture(page, SHOTS, '21-laptop-detail');
    });
  });

  test.describe('tablet 768', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('list and detail', async ({ page }) => {
      test.setTimeout(120_000);
      await installBookingsWorkspaceMocks(page);
      await page.goto(bookingsPaths.list);
      await settle(page);
      await expect(page.getByText('Action Required').first()).toBeVisible({ timeout: 30_000 });
      await capture(page, SHOTS, '30-tablet-list');

      await page.getByRole('button', { name: 'Refine bookings' }).first().click();
      await demoPause(page, 1);
      await capture(page, SHOTS, '31-tablet-refine-sheet');
      await page.keyboard.press('Escape');

      await page.goto(bookingsPaths.detail());
      await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
        timeout: 30_000,
      });
      await demoPause(page, 2.5);
      await capture(page, SHOTS, '32-tablet-detail');
    });
  });

  test.describe('phone 390', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('list surfaces', async ({ page }) => {
      test.setTimeout(150_000);
      await installBookingsWorkspaceMocks(page);
      await page.goto(bookingsPaths.list);
      await settle(page);
      await expect(page.getByText('Action Required').first()).toBeVisible({ timeout: 30_000 });
      await capture(page, SHOTS, '40-phone-list');
      await demoScroll(page, 380, 0.8);
      await capture(page, SHOTS, '41-phone-list-scrolled');

      await page.getByRole('button', { name: 'Refine bookings' }).click();
      await demoPause(page, 1);
      await capture(page, SHOTS, '42-phone-refine-sheet');
      await page.keyboard.press('Escape');

      await page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-calendar-days') })
        .first()
        .click();
      await demoPause(page, 1);
      await capture(page, SHOTS, '43-phone-date-sheet');
      await page.keyboard.press('Escape');
    });

    test('detail surfaces', async ({ page }) => {
      test.setTimeout(150_000);
      await installBookingsWorkspaceMocks(page);
      await page.goto(bookingsPaths.detail());
      await settle(page);
      await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
        timeout: 30_000,
      });
      await demoPause(page, 2.5);
      await capture(page, SHOTS, '50-phone-detail');
      await demoScroll(page, 420, 0.8);
      await capture(page, SHOTS, '51-phone-detail-workflow');
      await demoScroll(page, 420, 0.8);
      await capture(page, SHOTS, '52-phone-detail-lower');
    });
  });

  test.describe('plan and permission variants', () => {
    test.use({ viewport: { width: 1440, height: 960 } });

    test('read-only member', async ({ page }) => {
      test.setTimeout(120_000);
      await installBookingsWorkspaceMocks(page, { permissionTemplate: 'read_only' });
      await page.goto(bookingsPaths.list);
      await settle(page);
      await demoPause(page, 1);
      await capture(page, SHOTS, '60-read-only-list');

      await page.goto(bookingsPaths.detail(BOOKING_ROW_IDS.pendingReview));
      await demoPause(page, 1);
      await demoPause(page, 2.5);
      await capture(page, SHOTS, '61-read-only-detail');
    });

    test('free plan detail', async ({ page }) => {
      test.setTimeout(120_000);
      await installBookingsWorkspaceMocks(page, {
        plan: 'free',
        primaryStatus: 'PENDING_REVIEW',
      });
      await page.goto(bookingsPaths.detail());
      await settle(page);
      await demoPause(page, 1);
      await demoPause(page, 2.5);
      await capture(page, SHOTS, '62-free-plan-detail');
    });
  });
});
