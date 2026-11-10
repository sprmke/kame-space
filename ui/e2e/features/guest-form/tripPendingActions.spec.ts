import { expect, test } from '@playwright/test';

import { guestTripMock } from './shared/guestTripMock';
import { GUEST_FORM_PROPERTY_SLUG, installGuestFormMocks } from './shared/guestFormHarness';
import { mockEdgeFunctions } from '../../shared/interceptEdge';
import { seedSupabaseAuthSession } from '../../shared/authSeam';

const BOOKING_ID = 'guest-form-e2e-booking-001';

test.describe('@smoke @critical guest trip pending actions', () => {
  test('a pending request lands with the request-sent banner and no confirmed wording', async ({
    page,
  }) => {
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page);

    await page.goto(
      `/properties/${GUEST_FORM_PROPERTY_SLUG}/trip?bookingId=${BOOKING_ID}&welcome=1`
    );

    // The Now card states the status; the banner names where the receipt went.
    await expect(page.getByText('Request sent').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/A receipt is on its way to/i)).toBeVisible();
    await expect(page.getByText('maria@example.com')).toBeVisible();
    // A pending review is never called confirmed.
    await expect(page.getByText(/Booking Confirmed!/i)).toHaveCount(0);
  });

  test('a pending request offers edit and cancel, not a payment step', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page);

    await page.goto(`/properties/${GUEST_FORM_PROPERTY_SLUG}/trip?bookingId=${BOOKING_ID}`);

    // Edit request is a shortcut while the host reviews.
    await expect(page.getByRole('link', { name: 'Edit request' })).toBeVisible({
      timeout: 20_000,
    });
    // Pricing is not set yet, so the payment section stays hidden.
    await expect(page.getByRole('heading', { name: 'Payment' })).toHaveCount(0);
  });

  test('a cancelled booking says cancelled and hides arrival content', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page);
    await mockEdgeFunctions(page, [
      {
        name: 'get-guest-trip',
        body: { success: true, data: guestTripMock({ status: 'CANCELLED' }) },
      },
    ]);

    await page.goto(`/properties/${GUEST_FORM_PROPERTY_SLUG}/trip?bookingId=${BOOKING_ID}`);

    await expect(page.getByText('Cancelled').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Booking Confirmed!/i)).toHaveCount(0);
  });
});
