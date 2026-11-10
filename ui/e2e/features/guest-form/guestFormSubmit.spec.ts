import path from 'node:path';

import { expect, test } from '@playwright/test';

import { guestFormPath, installGuestFormMocks } from './shared/guestFormHarness';
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

    await page.getByLabel('Airbnb Name').fill('Maria Santos');
    await page.getByLabel('Email Address').fill('maria@example.com');
    await page.getByLabel('Phone Number').fill('09171234567');
    await page.getByRole('textbox', { name: 'Address *', exact: true }).fill('Cebu City, Cebu');
    await page.getByLabel('Nationality').fill('Filipino');
    await page.getByPlaceholder('Complete name of Primary Guest').fill('Maria Santos');
    await page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Primary Guest *' }) })
      .getByLabel('Age *')
      .fill('25');
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
