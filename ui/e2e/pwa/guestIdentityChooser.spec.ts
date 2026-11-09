import { expect, test } from '@playwright/test';

import { guestFormPath, installGuestFormMocks } from '../features/guest-form/shared/guestFormHarness';
import { seedSupabaseAuthSession } from '../shared/authSeam';

/**
 * Runs against a **production build**, where the guest form's dev autofill is off. That is
 * the only place the ID method chooser renders: dev builds pre-fill a sample ID, so the slot
 * is already in the uploader state.
 *
 * Guards the guest-facing rule: an ID is required, but verifying with the camera and
 * uploading a photo are equal options, not a primary action with a hidden fallback.
 */
test.describe('@pwa guest form identity method chooser', () => {
  test('offers camera and upload as equal options for the primary guest', async ({ page }) => {
    test.setTimeout(90_000);

    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page, { allowPets: false, allowParking: false });

    await page.goto(guestFormPath('source=airbnb'));
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', {
      timeout: 30_000,
    });

    const primaryGuest = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Primary Guest *' }) });

    const camera = primaryGuest.getByRole('button', { name: /Verify with camera/i });
    const upload = primaryGuest.getByRole('button', { name: /Upload a photo/i });

    await expect(camera).toBeVisible();
    await expect(upload).toBeVisible();

    // The camera handoff needs the booking email first; once it is there, both options work.
    await page.getByLabel('Email Address').fill('maria@example.com');
    await expect(camera).toBeEnabled();
    await expect(upload).toBeEnabled();

    await upload.click();
    await expect(primaryGuest.locator('input[type="file"]')).toHaveCount(1);
    await expect(primaryGuest.getByRole('button', { name: /Choose another way/i })).toBeVisible();
  });

  test('camera option asks for the email when it is still empty', async ({ page }) => {
    test.setTimeout(90_000);

    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page, { allowPets: false, allowParking: false });

    await page.goto(guestFormPath('source=airbnb'));
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', {
      timeout: 30_000,
    });

    const primaryGuest = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Primary Guest *' }) });

    await expect(primaryGuest.getByText(/Enter your email to verify with camera/i)).toBeVisible();
    await expect(primaryGuest.getByRole('button', { name: /Verify with camera/i })).toBeDisabled();
    await expect(primaryGuest.getByRole('button', { name: /Upload a photo/i })).toBeEnabled();
  });
});
