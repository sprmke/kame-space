import { expect, test } from '@playwright/test';

import { guestFormPath, installGuestFormMocks } from './shared/guestFormHarness';
import { seedSupabaseAuthSession } from '../../shared/authSeam';

test.describe('@ci guest form channel labels', () => {
  for (const [param, label] of [
    ['agoda', 'Agoda'],
    ['booking', 'Booking.com'],
    ['airbnb', 'Airbnb'],
  ] as const) {
    test(`?source=${param} uses ${label} wording`, async ({ page }) => {
      await seedSupabaseAuthSession(page, 'guest');
      await installGuestFormMocks(page, { allowPets: false, allowParking: false });
      await page.goto(guestFormPath(`source=${param}`));
      await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', {
        timeout: 20_000,
      });
      await expect(page.getByLabel(`${label} Name`)).toBeVisible();
    });
  }

  test('a completion link for an Agoda booking shows Agoda wording and locked dates', async ({
    page,
  }) => {
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page, { allowPets: false, allowParking: false });
    await page.route('**/functions/v1/get-form-completion**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            propertySlug: 'e2e-property',
            locked: true,
            stay: {
              checkInDate: '2027-09-01',
              checkOutDate: '2027-09-04',
              checkInTime: '14:00',
              checkOutTime: '11:00',
              numberOfNights: 3,
            },
            prefill: { primaryGuestName: 'Agoda guest', bookingSource: 'Agoda' },
          },
        }),
      })
    );
    await page.goto(guestFormPath('complete=test-token'));
    await expect(page.getByLabel('Agoda Name')).toBeVisible({ timeout: 20_000 });
  });
});
