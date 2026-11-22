import { expect, test } from '@playwright/test';

import { seedSupabaseAuthSession } from '../../shared/authSeam';
import { GUEST_FORM_PROPERTY_SLUG, installGuestFormMocks } from './shared/guestFormHarness';
import { guestTripMock } from './shared/guestTripMock';

const BOOKING_ID = 'guest-form-e2e-booking-001';

function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

test.describe('@ci @critical guest trip urgent help', () => {
  test('an arrival problem reaches the host from the trip page', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page);

    const checkIn = manilaToday();
    const base = guestTripMock({ status: 'READY_FOR_CHECKIN' });
    await page.route('**/functions/v1/get-guest-trip**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...base,
            stay: { ...base.stay, checkInDate: checkIn, checkOutDate: addDays(checkIn, 1) },
          },
        }),
      });
    });

    let posted: Record<string, unknown> | null = null;
    await page.route('**/functions/v1/guest-trip-help**', async (route) => {
      posted = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            request: { id: 'e2e-help-1', kind: 'unsafe', status: 'open' },
            alreadyOpen: false,
          },
        }),
      });
    });

    await page.goto(`/properties/${GUEST_FORM_PROPERTY_SLUG}/trip?bookingId=${BOOKING_ID}`);

    const helpButton = page.getByRole('button', { name: 'Get help now' });
    await expect(helpButton).toBeVisible({ timeout: 20_000 });
    await helpButton.click();

    await expect(page.getByRole('heading', { name: 'Get help now' })).toBeVisible();
    await page.getByRole('button', { name: /Unsafe or emergency/ }).click();
    await expect(page.getByText('If anyone is in danger, call 911 first.')).toBeVisible();
    await page.getByLabel('What happened?').fill('No water and the front door will not lock.');
    await page.getByRole('button', { name: 'Send request' }).click();

    await expect(page.getByText('Help request sent')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Help requested' })).toBeVisible();
    expect(posted).toMatchObject({
      bookingId: BOOKING_ID,
      kind: 'unsafe',
      note: 'No water and the front door will not lock.',
    });
  });
});
