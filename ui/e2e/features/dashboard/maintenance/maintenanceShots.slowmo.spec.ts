import { expect, test, type Page } from '@playwright/test';

import { installMaintenanceMocks } from './shared/maintenanceHarness';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../../team/shared/propertyTeamRbacHarness';

/**
 * Regenerates the after screenshots referenced by the Maintenance UX audit.
 * @demo — deterministic fixture data, no backend, never CI.
 *
 *   node_modules/.bin/playwright test \
 *     ui/e2e/features/dashboard/maintenance/maintenanceShots.slowmo.spec.ts --project=chromium
 *
 * Writes JPG-ready PNGs to `docs/workflow/qa/property-dashboard/maintenance/after/`.
 */

const OUT = 'docs/workflow/qa/property-dashboard/maintenance/after';

/** Wait for CSS transitions/animations and two frames instead of a fixed timeout. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY
        )
        .map((animation) => animation.finished.catch(() => undefined))
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
}

async function open(page: Page) {
  await page.goto(teamRbacPaths.maintenance);
  await expect(page.getByRole('heading', { name: 'Maintenance', exact: true }).first()).toBeVisible(
    {
      timeout: 20_000,
    }
  );
  await settle(page);
}

test.describe('maintenance screenshots @demo', () => {
  test.use({ viewport: { width: 1440, height: 960 }, actionTimeout: 12_000 });

  test('after screenshots at every resolution and flow', async ({ page }) => {
    test.setTimeout(600_000);
    const seedConsent = (target: Page) =>
      target.addInitScript(() => {
        try {
          localStorage.setItem('kh-cookie-consent', 'declined');
        } catch {
          /* storage blocked */
        }
      });
    await seedConsent(page);
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installMaintenanceMocks(page);

    const shotOn = async (target: Page, name: string) => {
      await settle(target);
      await target.screenshot({ path: `${OUT}/${name}.png` });
    };
    const shot = (name: string) => shotOn(page, name);

    // Desktop list.
    await open(page);
    await shot('01-desktop-1440');

    // Filters popover.
    await page.getByRole('button', { name: /More reminder filters/i }).click();
    await shot('02-desktop-filters');
    await page.getByRole('heading', { name: 'Maintenance', exact: true }).first().click();

    // Calendar with a day selected.
    await page.getByRole('button', { name: /Choose reminders view/ }).click();
    await page.getByRole('option', { name: 'Calendar', exact: true }).click();
    await settle(page);
    const day = page.getByRole('button', { name: /– \d+ reminders?$/ }).first();
    if (await day.count()) {
      await day.click();
      await settle(page);
    }
    await shot('03-desktop-calendar');
    await page.getByRole('button', { name: /Choose reminders view/ }).click();
    await page.getByRole('option', { name: 'Table', exact: true }).click();

    // Create dialog.
    await page
      .getByRole('button', { name: /Add reminder/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Label').fill('Replace balcony drain');
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Plumbing', exact: true }).click();
    await shot('04-desktop-create-details');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await shot('05-desktop-create-preview');
    await page.keyboard.press('Escape');
    await settle(page);
    const discard = page.getByRole('button', { name: /Discard/i });
    if (await discard.count()) await discard.first().click();

    // Laptop.
    await page.setViewportSize({ width: 1024, height: 800 });
    await open(page);
    await shot('06-laptop-1024');

    // Tablet.
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page);
    await shot('07-tablet-768');

    // Phone.
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await shot('08-phone-390');

    // No-match search state.
    await page.getByRole('searchbox', { name: 'Search reminders' }).fill('zzzz-no-match');
    await settle(page);
    await shot('09-phone-no-match');
    await page.getByRole('searchbox', { name: 'Search reminders' }).fill('');
    await settle(page);

    // Refine sheet.
    await page.getByRole('button', { name: /Refine reminders/i }).click();
    await shot('10-phone-refine');
    await page.getByRole('button', { name: 'Done' }).click();
    await settle(page);

    // Card actions.
    await page
      .getByRole('button', { name: /^Actions for / })
      .first()
      .click();
    await shot('11-phone-card-actions');
    await page.keyboard.press('Escape');
    await settle(page);

    // Recurring series sheet.
    await page.getByRole('button', { name: 'Actions for Deep clean kitchen' }).click();
    await page.getByRole('option', { name: /View series/i }).click();
    await settle(page);
    await shot('12-phone-series');
    await page.getByRole('button', { name: 'Close' }).click();
    await settle(page);

    // Create on phone: details, Telegram expanded, preview.
    await page.getByRole('button', { name: /Maintenance actions/i }).click();
    await page.getByRole('option', { name: /Add reminder/i }).click();
    await dialog.getByLabel('Label').fill('Deep clean balcony');
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Cleaning', exact: true }).click();
    await dialog.getByRole('checkbox', { name: 'Telegram reminders' }).click();
    await dialog.getByRole('checkbox', { name: 'Telegram reminders' }).scrollIntoViewIfNeeded();
    await shot('13-phone-create-telegram');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await settle(page);
    await shot('14-phone-preview');
    await page.keyboard.press('Escape');
    await settle(page);
    if (await discard.count()) await discard.first().click();
    await settle(page);

    // 320 / 375.
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page);
    await shot('16-phone-320');
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page);
    await shot('17-phone-375');

    // All dates (desktop, where the clear control lives).
    await page.setViewportSize({ width: 1440, height: 960 });
    await open(page);
    await page
      .getByRole('button', { name: 'Previous period' })
      .locator('xpath=following-sibling::button[1]')
      .click();
    await page.getByRole('button', { name: /Clear date filter/ }).click();
    await settle(page);
    await shot('15-desktop-all-dates');
  });

  test('after screenshots: empty states', async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('kh-cookie-consent', 'declined');
      } catch {
        /* storage blocked */
      }
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installMaintenanceMocks(page, { items: [] });
    await open(page);
    await expect(page.getByText('No reminders in this period')).toBeVisible();
    await page.screenshot({ path: `${OUT}/18-desktop-empty-period.png` });
    await page.getByRole('button', { name: 'View all dates' }).click();
    await expect(page.getByText('No reminders yet')).toBeVisible();
    await page.screenshot({ path: `${OUT}/19-desktop-empty-all-dates.png` });
  });

  test('after screenshots: dark theme', async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('kh-cookie-consent', 'declined');
      } catch {
        /* storage blocked */
      }
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installMaintenanceMocks(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page);
    await page.screenshot({ path: `${OUT}/20-desktop-dark.png` });
  });
});
