import { expect, test } from '@playwright/test';

import {
  installSettingsMocks,
  orgSettingsSections,
  parkingSettingsSections,
  propertySettingsSections,
  settingsPaths,
} from './shared/settingsHarness';
import { expectNoPageHorizontalOverflow } from '../../../shared/layoutAssertions';

/**
 * Settings module coverage — org, property, parking.
 *
 * The three pages share one shell but carry different section sets, permissions and
 * save paths. These tests pin the behaviours a host relies on: section navigation,
 * validation, save, unsaved-changes protection and the destructive confirmation.
 */

test.describe('property settings @ci', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsMocks(page, 'property');
  });

  test('renders every section and the grouped section nav', async ({ page }) => {
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    for (const section of propertySettingsSections) {
      await expect(page.locator(`#${section.id}`).first()).toBeAttached();
    }

    const nav = page.locator('[data-section-nav-scroll]').first();
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Basic Information' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Guest Form' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Integrations' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Listing status' })).toBeVisible();

    // Group headings keep 18 links scannable (labels render uppercase via CSS).
    await expect(nav.getByText('Listing', { exact: true })).toBeVisible();
    await expect(nav.getByText('Guest setup', { exact: true })).toBeVisible();
    await expect(nav.getByText('Connections', { exact: true })).toBeVisible();
    await expect(nav.getByText('Account', { exact: true })).toBeVisible();
  });

  test('renders Guest experience once', async ({ page }) => {
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#section-guest-experience')).toHaveCount(1);
    await expect(
      page
        .locator('[data-section-nav-scroll]')
        .getByRole('button', { name: 'Guest experience', exact: true })
    ).toHaveCount(1);
  });

  test.fixme('offers a section jump list on phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    // 18 cards on phone with no way to jump; the rail is desktop-only today.
    await expect(page.getByRole('button', { name: /jump to section/i })).toBeVisible();
  });
  // SET-P1-2: the section rail is hidden below `lg` and nothing replaces it.

  test.fixme('exposes one page heading id', async ({ page }) => {
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#property-settings-heading')).toHaveCount(1);
  });
  // SET-P3-2: mobile hero and desktop header are both mounted with the same id.

  test('saves a profile change and shows the success toast', async ({ page }) => {
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    const name = page.getByRole('textbox', { name: 'Property Name', exact: true });
    await name.fill('Solea Mactan Prime');

    const patch = page.waitForRequest(
      (request) =>
        request.url().includes('/functions/v1/update-property') && request.method() === 'PATCH'
    );
    await page.getByRole('button', { name: 'Save Changes' }).first().click();
    await patch;
    await expect(page.getByText('Settings saved')).toBeVisible();
  });

  test('warns before leaving with unsaved edits', async ({ page }) => {
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    await page
      .getByRole('textbox', { name: 'Property Name', exact: true })
      .fill('Solea Mactan Draft');
    await page.getByRole('link', { name: 'Bookings' }).first().click();

    await expect(page.getByText('Save your changes?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByRole('textbox', { name: 'Property Name', exact: true })).toHaveValue(
      'Solea Mactan Draft'
    );
  });

  test('section nav jumps to the card it names', async ({ page }) => {
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    const nav = page.locator('[data-section-nav-scroll]').first();
    await nav.getByRole('button', { name: 'Payment' }).click();

    await expect(page.locator('#section-payment')).toBeInViewport();
    // SET-P3-1: the active row is colour-only; it exposes no aria-current.
    await expect(nav.getByRole('button', { name: 'Payment' })).toHaveClass(
      /text-primary-foreground/
    );
  });

  test('location saves without a map pin when maps cannot load', async ({ page }) => {
    await page.route('**maps.googleapis.com/**', (route) => route.abort());
    await page.route('**maps.gstatic.com/**', (route) => route.abort());
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    await page.locator('#section-location').getByRole('button', { name: 'Manage' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#property-location-search').fill('Azure North Residences');
    await dialog.locator('#property-location-city').fill('San Fernando');
    await dialog.locator('#property-location-province').fill('Pampanga');
    await dialog.locator('#property-location-country').fill('Philippines');

    const save = dialog.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeEnabled();
    const patch = page.waitForRequest(
      (request) =>
        request.url().includes('/functions/v1/update-property') && request.method() === 'PATCH'
    );
    await save.click();
    await patch;
    await expect(page.getByText('Location saved')).toBeVisible();
  });

  test('residence and tower are editable', async ({ page }) => {
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    const residence = page.getByRole('combobox', { name: 'Residence', exact: true });
    await expect(residence).toBeEnabled();
    await expect(residence).toContainText('Azure North Residences');

    const tower = page.getByRole('combobox', { name: 'Tower', exact: true });
    await expect(tower).toBeEnabled();
    await expect(tower).toContainText('Monaco');

    await tower.click();
    await page.getByRole('option', { name: 'Bali', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  test('a required field shows an inline error', async ({ page }) => {
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    const name = page.getByRole('textbox', { name: 'Property Name', exact: true });
    await name.fill('');

    await expect(page.locator('#property-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Enter a property name')).toBeVisible();
    // The section nav flags the card that needs attention.
    await expect(
      page
        .locator('[data-section-nav-scroll]')
        .getByRole('button', { name: 'Basic Information' })
        .locator('[aria-hidden="true"], span')
    ).not.toHaveCount(0);
  });

  test('payment dialog opens with the primary GCash method', async ({ page }) => {
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    await page.locator('#section-payment').getByRole('button', { name: 'Manage' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Payment' })).toBeVisible();
    await expect(dialog.getByText('PRIMARY')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Add payment method' })).toBeVisible();
  });

  test('listing status asks for confirmation before pausing', async ({ page }) => {
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    await page.locator('#section-danger').getByRole('button', { name: 'Pause' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Pause new bookings?')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Pause bookings/ })).toBeVisible();
    await dialog.getByRole('button', { name: /Keep live|Cancel/ }).click();
    await expect(page.locator('#section-danger').getByText('LIVE')).toBeVisible();
  });

  test('phone layout keeps every card inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(settingsPaths.property);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    await expectNoPageHorizontalOverflow(page);

    for (const section of propertySettingsSections) {
      const card = page.locator(`#${section.id}`).first();
      if ((await card.count()) === 0) continue;
      await card.evaluate((element) => element.scrollIntoView({ block: 'start' }));
      await expectNoPageHorizontalOverflow(page);
    }
  });
});

test.describe('org settings @ci', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsMocks(page, 'org');
  });

  test('renders every section and owner-only controls', async ({ page }) => {
    await page.goto(settingsPaths.org);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    for (const section of orgSettingsSections) {
      await expect(page.locator(`#${section.id}`).first()).toBeAttached();
    }

    const nav = page.locator('[data-section-nav-scroll]').first();
    await expect(nav.getByText('Profile', { exact: true })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Danger zone' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete organization' })).toBeVisible();
  });

  test('saves the organization profile', async ({ page }) => {
    await page.goto(settingsPaths.org);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    await page
      .getByRole('textbox', { name: 'Organization name', exact: true })
      .fill('Sample Stays PH Group');

    const patch = page.waitForRequest(
      (request) =>
        request.url().includes('/functions/v1/update-organization') && request.method() === 'PATCH'
    );
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await patch;
    await expect(page.getByText('Settings saved')).toBeVisible();
  });

  test('delete requires the organization slug', async ({ page }) => {
    await page.goto(settingsPaths.org);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Delete organization' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Yes, delete organization' });
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel(/type .* to confirm/i).fill('sample-stays-ph');
    await expect(confirm).toBeEnabled();
  });

  test('AI platform toggle persists', async ({ page }) => {
    await page.goto(settingsPaths.org);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    const toggle = page.getByRole('switch', { name: /Enable AI for organization/i });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    const patch = page.waitForRequest(
      (request) =>
        request.url().includes('/functions/v1/ai-platform-settings') && request.method() === 'PATCH'
    );
    await toggle.click();
    await patch;
  });
});

test.describe('parking settings @ci', () => {
  test('renders sections and saves a change', async ({ page }) => {
    const { createParkingFlowState, installParkingFlowMocks } =
      await import('../../parking/shared/parkingFlowHarness');
    const state = createParkingFlowState();
    // Digits-only slot label, the only shape the settings validator accepts.
    state.slotLabel = '12';
    await installParkingFlowMocks(page, state);
    await page.goto(settingsPaths.parking);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    for (const section of parkingSettingsSections) {
      await expect(page.locator(`#${section.id}`).first()).toBeAttached();
    }

    // Slot number is read-only (derived from the parking code); edit the description.
    await page.locator('#parking-description').fill('Level 2, beside the lift lobby');
    const patch = page.waitForRequest(
      (request) =>
        request.url().includes('/functions/v1/update-parking') && request.method() === 'PATCH'
    );
    await page.getByRole('button', { name: 'Save Changes' }).first().click();
    await patch;
  });

  test('read-only members see the explainer instead of the form', async ({ page }) => {
    const { createParkingFlowState, installParkingFlowMocks } =
      await import('../../parking/shared/parkingFlowHarness');
    const state = createParkingFlowState();
    state.accessPermissions = ['bookings:view', 'finance:view', 'pricing:view', 'settings:view'];
    await installParkingFlowMocks(page, state);

    await page.goto(settingsPaths.parking);
    await expect(page.getByText(/You can view this page but not change it/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('#section-basic')).toHaveCount(0);
  });

  test('accepts a lettered slot label', async ({ page }) => {
    await installSettingsMocks(page, 'parking');
    await page.goto(settingsPaths.parking);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('textbox', { name: 'Slot number', exact: true })).toHaveValue(
      '12A'
    );
    await page.locator('#parking-description').fill('Level 2, beside the lift lobby');
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    await expect(page.getByText('Enter a valid slot number')).toHaveCount(0);
  });

  test('saves the address without a map pin when maps cannot load', async ({ page }) => {
    await page.route('**maps.googleapis.com/**', (route) => route.abort());
    await page.route('**maps.gstatic.com/**', (route) => route.abort());
    await installSettingsMocks(page, 'parking');
    await page.goto(settingsPaths.parking);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });

    await page
      .getByPlaceholder('Street address, building, city')
      .fill('One Palm Residences, Mactan');
    await page.locator('#property-location-city').fill('Lapu-Lapu');
    await page.locator('#property-location-province').fill('Cebu');
    await page.locator('#property-location-country').fill('Philippines');
    await page.keyboard.press('Tab');

    const save = page.getByRole('button', { name: 'Save Changes' }).first();
    await expect(save).toBeEnabled();
    const patch = page.waitForRequest(
      (request) =>
        request.url().includes('/functions/v1/update-parking') && request.method() === 'PATCH'
    );
    await save.click();
    await patch;
  });

  test('phone layout keeps every card inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installSettingsMocks(page, 'parking');
    await page.goto(settingsPaths.parking);
    await expect(page.locator('#section-basic')).toBeVisible({ timeout: 30_000 });
    await expectNoPageHorizontalOverflow(page);
  });
});

test.describe('property settings read-only role @ci', () => {
  test('a read-only member is redirected and never sees Settings', async ({ page }) => {
    await installSettingsMocks(page, 'property', { permissions: 'read_only' });
    await page.goto(settingsPaths.property);

    await expect(page).toHaveURL(
      new RegExp(`/org/sample-stays-ph/property/solea-mactan(/bookings)?(\\?|$)`)
    );
    await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  });
});
