import { expect, test } from '@playwright/test';

import {
  BOOKING_ROW_IDS,
  bookingsPaths,
  demoPause,
  demoScroll,
  dismissCookieConsent,
  installBookingsWorkspaceMocks,
} from './shared/bookingsWorkspaceHarness';

/**
 * Slow-motion walkthrough of the Bookings workspace. @demo — headed, never CI.
 *
 *   bun run test:e2e:bookings:tour:video
 *
 * One scenario per flow so each recorded video stands on its own. Videos land in
 * `test-results/playwright-bookings-tour/<scenario>/video.webm`.
 */

// Readable recordings: the default 800px-wide capture makes 13px UI text mushy.
test.use({ video: { mode: 'on', size: { width: 1280, height: 800 } } });

test.describe('bookings tour @demo', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('01 list: stages, search, filters, view modes', async ({ page }) => {
    test.setTimeout(240_000);
    await installBookingsWorkspaceMocks(page);
    await page.goto(bookingsPaths.list);
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: 'Bookings', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Action Required: 5', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await demoPause(page, 2.2);

    // Stage cards: each click filters, second click clears.
    for (const label of ['Pending Docs: 4', 'Confirmed Stays: 1', 'History: 2']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await demoPause(page, 1.8);
      await page.getByRole('button', { name: label, exact: true }).click();
      await demoPause(page, 0.9);
    }

    // Search
    const search = page.locator('input[type="search"]:visible').first();
    await search.click();
    await search.pressSequentially('Maria', { delay: 90 });
    await demoPause(page, 1.8);
    await search.fill('');
    await demoPause(page, 1.2);

    // Status + more filters
    await page.getByRole('button', { name: 'Filter by status' }).click();
    await demoPause(page, 2);
    await page.getByRole('checkbox', { name: /Pending Review/i }).first().click();
    await demoPause(page, 1.8);
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.keyboard.press('Escape');
    await demoPause(page, 0.8);

    await page.getByRole('button', { name: 'More booking filters' }).click();
    await demoPause(page, 1.8);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);

    // The trigger's accessible name is its current value ("Priority"), not a purpose label.
    await page.getByRole('button', { name: /^Priority|^Check-in date|^Newest|^Oldest/ }).click();
    await demoPause(page, 1.6);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);

    // Table → Kanban → Calendar → back to table
    await page.goto(bookingsPaths.listView('kanban'));
    await expect(page.getByText('Maria Santos').first()).toBeVisible({ timeout: 20_000 });
    await demoPause(page, 2.4);
    await demoScroll(page, 260, 1);

    await page.goto(bookingsPaths.listView('calendar'));
    await expect(page.getByText('Day details')).toBeVisible({ timeout: 20_000 });
    await demoPause(page, 2.4);
    await page.getByText('26', { exact: true }).first().click();
    await demoPause(page, 2);

    await page.goto(bookingsPaths.listView('card'));
    await demoPause(page, 2);

    await page.goto(bookingsPaths.list);
    await demoPause(page, 1.6);
  });

  test('02 detail: overview, tabs, workflow rail', async ({ page }) => {
    test.setTimeout(240_000);
    await installBookingsWorkspaceMocks(page);
    await page.goto(bookingsPaths.detail());
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 2.4);

    await demoScroll(page, 420, 1);
    await demoPause(page, 1.6);
    await demoScroll(page, -420, 0.6);

    const tabs = page.getByRole('tablist', { name: 'Booking detail sections' });
    for (const [tab, pause] of [
      ['Guests', 2],
      ['Parking', 2.2],
      ['Pricing', 2],
      ['Files', 1.8],
      ['Activity', 2.2],
      ['Stay', 1.6],
    ] as const) {
      await tabs.getByRole('tab', { name: tab, exact: true }).click();
      await demoPause(page, pause);
    }

    // Header overflow + edit entry point
    await page.getByRole('button', { name: /More actions|More/i }).first().click();
    await demoPause(page, 2);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.8);
  });

  test('03 workflow: review, proceed to pending documents', async ({ page }) => {
    test.setTimeout(240_000);
    await installBookingsWorkspaceMocks(page, { primaryStatus: 'PENDING_REVIEW' });
    await page.goto(bookingsPaths.detail());
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 2.4);

    await page
      .getByRole('checkbox', { name: /I manually reviewed and confirmed/i })
      .check({ force: true });
    await demoPause(page, 2);

    const proceed = page.getByRole('button', { name: /^Proceed to Pending Documents/i });
    await expect(proceed).toBeVisible();
    await demoPause(page, 1.2);
    await proceed.click();
    await demoPause(page, 2.2);

    const confirm = page.getByRole('button', { name: 'Confirm' });
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await demoPause(page, 1.6);
    await confirm.click();
    await expect(page.getByText(/Pending Documents/i).first()).toBeVisible({ timeout: 15_000 });
    await demoPause(page, 2.4);
  });

  test('04 plan and permission variants', async ({ page }) => {
    test.setTimeout(240_000);
    await installBookingsWorkspaceMocks(page, { plan: 'free' });
    await page.goto(bookingsPaths.detail());
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 2.6);
    const triggers = page.getByRole('button', { name: /Automation Triggers/i }).first();
    if (await triggers.isVisible().catch(() => false)) {
      await triggers.click();
      await demoPause(page, 2.2);
      await demoScroll(page, 320, 0.8);
      await demoScroll(page, -320, 0.5);
    }

    // View-only teammate
    await page.goto(bookingsPaths.detail(BOOKING_ROW_IDS.pendingReview));
    await expect(page.getByRole('heading', { name: 'Ana Villanueva' })).toBeVisible({
      timeout: 20_000,
    });
    await demoPause(page, 2.4);
    await demoScroll(page, 320, 0.8);
    await demoPause(page, 1.6);
  });
});

test.describe('bookings tour phone @demo', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('05 phone: list, sheets and detail', async ({ page }) => {
    test.setTimeout(240_000);
    await installBookingsWorkspaceMocks(page);
    await page.goto(bookingsPaths.list);
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: 'Bookings', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 2.2);

    await page.getByRole('button', { name: 'Pending Docs: 4', exact: true }).click();
    await demoPause(page, 2);
    await page.getByRole('button', { name: 'Pending Docs: 4', exact: true }).click();
    await demoPause(page, 1);

    await demoScroll(page, 380, 0.9);
    await demoPause(page, 1.2);

    await page.getByRole('button', { name: 'Refine bookings' }).click();
    await demoPause(page, 2.2);
    await page.getByRole('checkbox', { name: /Pending Review/i }).first().click();
    await demoPause(page, 1.4);
    await page.getByRole('button', { name: 'Done' }).click();
    await demoPause(page, 1.6);

    await page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-calendar-days') })
      .first()
      .click();
    await demoPause(page, 2.2);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.8);

    await page.goto(bookingsPaths.detail());
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 20_000,
    });
    await demoPause(page, 2.4);
    await demoScroll(page, 420, 0.9);
    await demoPause(page, 1.6);
    await demoScroll(page, 420, 0.9);
    await demoPause(page, 1.6);
  });
});
