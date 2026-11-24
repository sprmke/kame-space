import { expect, test } from '@playwright/test';

import {
  demoPause,
  demoSection,
  installSettingsMocks,
  settingsPaths,
} from './shared/settingsHarness';

/**
 * Slow-motion walkthrough of the settings surfaces. @demo — headed, never CI.
 *
 * One scenario per flow so each recorded video is watchable on its own:
 *   bun run test:e2e:settings:tour:video
 * Videos land in `test-results/playwright/<scenario>/video.webm`.
 */

test.describe('settings tour @demo', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('01 property settings overview and section rail', async ({ page }) => {
    test.setTimeout(180_000);
    await installSettingsMocks(page, 'property');
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    await demoPause(page, 1.4);

    const nav = page.locator('[data-section-nav-scroll]').first();
    for (const label of [
      'Basic information',
      'Property details',
      'Photos & videos',
      'Amenities',
      'House rules',
      'Cancellation',
      'Location',
      'Socials',
      'Search preview',
      'Guest form',
      'Guest experience',
      'Reviews & vouchers',
      'Payment',
      'Building forms',
      'Email automations',
      'Integrations',
      'Activity',
      'Listing status',
    ]) {
      await nav.getByRole('button', { name: label }).click();
      await demoPause(page, 0.55);
    }
  });

  test('02 property settings save and unsaved-changes guard', async ({ page }) => {
    test.setTimeout(180_000);
    await installSettingsMocks(page, 'property');
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    await demoPause(page, 1);

    await page
      .getByRole('textbox', { name: 'Property Name', exact: true })
      .fill('Solea Mactan Prime');
    await demoPause(page, 1);

    await page.getByRole('link', { name: 'Bookings' }).first().click();
    await expect(page.getByText('Save your changes?')).toBeVisible();
    await demoPause(page, 1.6);
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await demoPause(page, 0.8);

    await page.getByRole('button', { name: 'Save changes' }).first().click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await demoPause(page, 1.4);
  });

  test('03 property settings review cards', async ({ page }) => {
    test.setTimeout(240_000);
    await installSettingsMocks(page, 'property');
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    await demoPause(page, 0.8);

    for (const sectionId of [
      'section-details',
      'section-media',
      'section-amenities',
      'section-house-rules',
      'section-cancellation',
      'section-location',
      'section-branding',
      'section-search',
      'section-guest-form',
      'section-guest-experience',
      'section-guest-rewards',
      'section-payment',
      'section-building-forms',
      'section-email-automations',
      'section-integrations',
      'section-activity',
      'section-danger',
    ]) {
      const target = page.locator(`#${sectionId}`);
      if ((await target.count()) === 0) continue;
      await target.first().evaluate((element) => element.scrollIntoView({ block: 'start' }));
      await demoPause(page, 0.7);
    }
  });

  test('04 property settings dialogs', async ({ page }) => {
    test.setTimeout(240_000);
    await installSettingsMocks(page, 'property');
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    await page.locator('#section-amenities').getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 1.4);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);

    await page.locator('#section-house-rules').getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 1.4);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);

    await page.locator('#section-cancellation').getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 1.6);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await demoPause(page, 0.6);

    await page.locator('#section-payment').getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 1.4);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);

    await page.locator('#section-danger').getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 1.6);
    await page.keyboard.press('Escape');
    await demoPause(page, 0.6);
  });

  test('05 property settings phone layout', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await installSettingsMocks(page, 'property');
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    await demoPause(page, 1.2);

    for (const sectionId of [
      'section-basic',
      'section-details',
      'section-media',
      'section-amenities',
      'section-cancellation',
      'section-search',
      'section-guest-form',
      'section-payment',
      'section-email-automations',
      'section-danger',
    ]) {
      await demoSection(page, sectionId);
      await demoPause(page, 0.4);
    }
  });

  test('06 org settings overview and save', async ({ page }) => {
    test.setTimeout(180_000);
    await installSettingsMocks(page, 'org');
    await page.goto(settingsPaths.org);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    await demoPause(page, 1.2);

    const nav = page.locator('[data-section-nav-scroll]').first();
    for (const label of ['Socials', 'Superhost', 'AI features', 'Activity', 'Danger zone']) {
      await nav.getByRole('button', { name: label }).click();
      await demoPause(page, 0.8);
    }

    await nav.getByRole('button', { name: 'Basic information' }).click();
    await demoPause(page, 0.5);
    await page
      .getByRole('textbox', { name: 'Organization name', exact: true })
      .fill('Sample Stays PH Group');
    await demoPause(page, 0.8);
    await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
    await demoPause(page, 1.6);
  });

  test('07 org danger zone delete confirmation', async ({ page }) => {
    test.setTimeout(180_000);
    await installSettingsMocks(page, 'org');
    await page.goto(settingsPaths.org);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Delete organization' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 1.4);
    await page.getByRole('dialog').getByRole('textbox').fill('sample-stays-ph');
    await demoPause(page, 1.2);
  });

  test('08 parking settings overview, automations and location', async ({ page }) => {
    test.setTimeout(180_000);
    await installSettingsMocks(page, 'parking');
    await page.goto(settingsPaths.parking);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    await demoPause(page, 1.2);

    const nav = page.locator('[data-section-nav-scroll]').first();
    for (const label of ['Photos', 'Parking details', 'Amenities', 'Location', 'Automations']) {
      await nav.getByRole('button', { name: label }).click();
      await demoPause(page, 0.9);
    }

    await page.locator('#section-automations').getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await demoPause(page, 1.6);
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await demoPause(page, 0.6);
  });

  test('09 parking settings read-only role', async ({ page }) => {
    test.setTimeout(180_000);
    const { createParkingFlowState, installParkingFlowMocks } =
      await import('../../parking/shared/parkingFlowHarness');
    const state = createParkingFlowState();
    state.accessPermissions = ['bookings:view', 'finance:view', 'pricing:view', 'settings:view'];
    await installParkingFlowMocks(page, state);

    await page.goto(settingsPaths.parking);
    await expect(page.getByText(/You can view this page but not change it/i)).toBeVisible({
      timeout: 30_000,
    });
    await demoPause(page, 2);
  });
});
