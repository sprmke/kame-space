import path from 'node:path';

import { expect, test } from '@playwright/test';

import { fillStable, guestFormPath, installGuestFormMocks } from './shared/guestFormHarness';
import { seedSupabaseAuthSession } from '../../shared/authSeam';

const VALID_ID_FIXTURE = path.join(process.cwd(), 'ui/public/icons/pwa-192.png');

test.describe('@smoke @critical guest form submit', () => {
  test('Airbnb guest can submit mocked form and land on the trip page', async ({ page }) => {
    test.setTimeout(60_000);

    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page, { allowPets: false, allowParking: false });

    await page.goto(guestFormPath('source=airbnb'));
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', {
      timeout: 20_000,
    });

    // `fillStable` because the dev sample seed can land a second time after these keystrokes.
    await fillStable(page.getByLabel('Airbnb Name'), 'Maria Santos');
    await fillStable(page.getByLabel('Email Address'), 'maria@example.com');
    await fillStable(page.getByLabel('Phone Number'), '09171234567');
    await fillStable(
      page.getByRole('textbox', { name: 'Address *', exact: true }),
      'Cebu City, Cebu'
    );
    await fillStable(page.getByLabel('Nationality'), 'Filipino');
    await fillStable(
      page.getByPlaceholder('Complete name of Primary Guest'),
      'Maria Santos'
    );
    await fillStable(
      page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: 'Primary Guest *' }) })
        .getByLabel('Age *'),
      '25'
    );
    // Dev builds auto-fill a sample ID, so this suite exercises the uploader state. The
    // method chooser (camera vs upload) only renders when no ID is attached yet.
    await page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Primary Guest *' }) })
      .locator('input[type="file"]')
      .setInputFiles(VALID_ID_FIXTURE);

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Stay', {
      timeout: 10_000,
    });

    const submit = page.getByRole('button', { name: 'Submit guest form' });
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();

    // The guest lands on their trip page, which says the request was sent — never
    // "confirmed", because the booking is still under review (plan D1, finding B1).
    await expect(page).toHaveURL(/\/properties\/solea-mactan\/trip\?/, { timeout: 30_000 });
    await expect(page.getByText('Request sent').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Booking Confirmed!')).toHaveCount(0);
  });
});
