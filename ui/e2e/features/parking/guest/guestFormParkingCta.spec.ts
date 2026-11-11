import { expect, test } from '@playwright/test';

import { seedSupabaseAuthSession } from '../../../shared/authSeam';
import { mockEdgeFunctions } from '../../../shared/interceptEdge';
import { guestTripMock } from '../../guest-form/shared/guestTripMock';
import { setParkingScreenSuite } from '../shared/parkingScreenCapture';

const BOOKING_ID = 'property-booking-success-001';
const PROPERTY_SLUG = 'solea-mactan';
const FIND_PARKING_HREF = `/parkings?linkStay=${BOOKING_ID}`;

/**
 * A guest who ticked "need parking" on the form must still reach the marketplace.
 *
 * The old `/success` page carried this link. A submission lands on the trip page now, so the
 * link lives there (a **Find parking** shortcut while the host reviews).
 */
test.describe('@ci guest form parking CTA', () => {
  test('offers the marketplace link while the host reviews a request that needs parking', async ({
    page,
  }) => {
    setParkingScreenSuite('guest-form-parking-cta');
    await seedSupabaseAuthSession(page, 'guest');
    await mockEdgeFunctions(page, [
      {
        name: 'get-guest-trip',
        body: {
          success: true,
          data: guestTripMock({
            bookingId: BOOKING_ID,
            status: 'PENDING_REVIEW',
            parking: {
              requested: true,
              carPlate: 'ABC 1234',
              linkedBookingId: null,
              linkedStatus: null,
              findPath: FIND_PARKING_HREF,
            },
          }),
        },
      },
    ]);

    await page.goto(`/properties/${PROPERTY_SLUG}/trip?bookingId=${BOOKING_ID}`);

    // Request sent is the pending-review status word; it proves the trip page rendered.
    await expect(page.getByText('Request sent').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Find parking' })).toHaveAttribute(
      'href',
      FIND_PARKING_HREF
    );
  });

  test('shows no parking shortcut when the guest did not ask for parking', async ({ page }) => {
    setParkingScreenSuite('guest-form-parking-cta');
    await seedSupabaseAuthSession(page, 'guest');
    await mockEdgeFunctions(page, [
      { name: 'get-guest-trip', body: { success: true, data: guestTripMock() } },
    ]);

    await page.goto(`/properties/${PROPERTY_SLUG}/trip?bookingId=${BOOKING_ID}`);

    await expect(page.getByText('Request sent').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Find parking' })).toHaveCount(0);
  });
});
